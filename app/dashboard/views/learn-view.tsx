'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import {
  LESSONS,
  type Lesson,
  type LessonLevel,
  lessonText,
} from './learn-content';

const PROGRESS_KEY = 'aqp:lesson-progress';

const COPY = {
  no: {
    eye: 'LÆRING',
    title: 'Læringsmoduler',
    sub: 'Strukturert pensum fra nybegynner til avansert. Bygg fundamentet du trenger for å bruke Plus-signalene godt.',
    levels: { beginner: 'Nybegynner', intermediate: 'Mellom', advanced: 'Avansert' },
    minutes: (n: number) => `${n} min`,
    progress: (done: number, total: number) => `${done} av ${total} fullført`,
    start: 'Start',
    continue: 'Fortsett',
    review: 'Repeter',
    completed: 'Fullført ✓',
    markComplete: 'Marker som fullført',
    markUncomplete: 'Marker som ikke fullført',
    back: 'Tilbake til oversikt',
    fallback: 'Innholdet vises på engelsk inntil norsk oversettelse er klar.',
  },
  en: {
    eye: 'LEARN',
    title: 'Learning modules',
    sub: 'Structured curriculum from beginner to advanced. Build the foundation you need to use Plus signals well.',
    levels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    minutes: (n: number) => `${n} min`,
    progress: (done: number, total: number) => `${done} of ${total} completed`,
    start: 'Start',
    continue: 'Continue',
    review: 'Review',
    completed: 'Completed ✓',
    markComplete: 'Mark as complete',
    markUncomplete: 'Mark as not complete',
    back: 'Back to overview',
    fallback: 'Content shown in English until other-language translation is ready.',
  },
  de: {
    eye: 'LERNEN',
    title: 'Lernmodule',
    sub: 'Strukturierter Lehrplan von Anfänger bis Fortgeschritten. Baue das Fundament, um Plus-Signale gut zu nutzen.',
    levels: { beginner: 'Anfänger', intermediate: 'Mittel', advanced: 'Fortgeschritten' },
    minutes: (n: number) => `${n} Min.`,
    progress: (done: number, total: number) => `${done} von ${total} abgeschlossen`,
    start: 'Start',
    continue: 'Fortsetzen',
    review: 'Wiederholen',
    completed: 'Abgeschlossen ✓',
    markComplete: 'Als abgeschlossen markieren',
    markUncomplete: 'Als nicht abgeschlossen markieren',
    back: 'Zurück zur Übersicht',
    fallback: 'Inhalte werden auf Englisch angezeigt, bis die Übersetzung fertig ist.',
  },
  es: {
    eye: 'APRENDER',
    title: 'Módulos de aprendizaje',
    sub: 'Currículo estructurado de principiante a avanzado. Construye la base para usar bien las señales de Plus.',
    levels: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' },
    minutes: (n: number) => `${n} min`,
    progress: (done: number, total: number) => `${done} de ${total} completados`,
    start: 'Empezar',
    continue: 'Continuar',
    review: 'Repasar',
    completed: 'Completado ✓',
    markComplete: 'Marcar completado',
    markUncomplete: 'Marcar no completado',
    back: 'Volver',
    fallback: 'El contenido se muestra en inglés hasta que la traducción esté lista.',
  },
  zh: {
    eye: '学习',
    title: '学习模块',
    sub: '从入门到高级的结构化课程。打好基础以充分利用 Plus 信号。',
    levels: { beginner: '入门', intermediate: '中级', advanced: '高级' },
    minutes: (n: number) => `${n} 分钟`,
    progress: (done: number, total: number) => `已完成 ${done} / ${total}`,
    start: '开始',
    continue: '继续',
    review: '复习',
    completed: '已完成 ✓',
    markComplete: '标记为完成',
    markUncomplete: '标记为未完成',
    back: '返回',
    fallback: '在翻译完成前，内容以英文显示。',
  },
} as const;

const LEVELS: LessonLevel[] = ['beginner', 'intermediate', 'advanced'];

function readProgress(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    /* ignore */
  }
  return new Set();
}

function writeProgress(p: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(p)));
  } catch {
    /* ignore */
  }
}

function renderMarkdown(body: string) {
  const blocks = body.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={i} className="aqp-report-h1">
          {trimmed.replace(/^#\s+/, '')}
        </h2>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={i} className="aqp-report-h2">
          {trimmed.replace(/^##\s+/, '')}
        </h3>
      );
    }
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
      return (
        <ul key={i} className="aqp-report-list">
          {items.map((it, j) => (
            <li key={j}>{it}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="aqp-report-p">
        {trimmed}
      </p>
    );
  });
}

export function LearnView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [progress, setProgress] = useState<Set<string>>(() => new Set());
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(readProgress());
  }, []);

  const toggleProgress = (id: string) => {
    setProgress((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeProgress(next);
      return next;
    });
  };

  const lessonsByLevel = useMemo(() => {
    return {
      beginner: LESSONS.filter((l) => l.level === 'beginner'),
      intermediate: LESSONS.filter((l) => l.level === 'intermediate'),
      advanced: LESSONS.filter((l) => l.level === 'advanced'),
    };
  }, []);

  const openLesson: Lesson | undefined = openLessonId
    ? LESSONS.find((l) => l.id === openLessonId)
    : undefined;

  if (openLesson) {
    const text = lessonText(openLesson, lang);
    const isComplete = progress.has(openLesson.id);
    return (
      <div className="aqp-content">
        <button
          type="button"
          className="aqp-owned-toggle"
          onClick={() => setOpenLessonId(null)}
          style={{ marginBottom: 24 }}
        >
          ← {t.back}
        </button>

        <div className="aqp-page-head">
          <div className="m-eyebrow">
            <span className="m-badge-dot" />
            {t.levels[openLesson.level].toUpperCase()} · {t.minutes(openLesson.readMinutes)}
          </div>
          <h1 className="aqp-page-title">{text.title}</h1>
          <p className="aqp-page-sub">{text.summary}</p>
        </div>

        {text.fallbackToEn && <div className="aqp-lang-note">{t.fallback}</div>}

        <article className="aqp-report-body" style={{ marginTop: 16 }}>
          {renderMarkdown(text.body)}
        </article>

        <div style={{ marginTop: 48, display: 'flex', gap: 12 }}>
          <button
            type="button"
            className={isComplete ? 'btn-ghost-v8 btn-sm' : 'btn-primary-v8 btn-sm'}
            onClick={() => toggleProgress(openLesson.id)}
          >
            {isComplete ? t.markUncomplete : t.markComplete}
          </button>
          <button type="button" className="btn-ghost-v8 btn-sm" onClick={() => setOpenLessonId(null)}>
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="aqp-content">
      <div className="aqp-page-head">
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {t.eye}
        </div>
        <h1 className="aqp-page-title">{t.title}</h1>
        <p className="aqp-page-sub">{t.sub}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {LEVELS.map((level) => {
          const lessons = lessonsByLevel[level];
          if (lessons.length === 0) return null;
          const done = lessons.filter((l) => progress.has(l.id)).length;
          return (
            <section key={level}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
                  {t.levels[level]}
                </h2>
                <span className="cap-sm">{t.progress(done, lessons.length)}</span>
              </div>
              <div className="aqp-module-grid">
                {lessons.map((lesson) => {
                  const text = lessonText(lesson, lang);
                  const isComplete = progress.has(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      className="aqp-module-card aqp-module-card--clickable"
                      onClick={() => setOpenLessonId(lesson.id)}
                    >
                      <div
                        className="aq-mono"
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.10em',
                          color: 'rgba(255,255,255,0.45)',
                          marginBottom: 8,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.minutes(lesson.readMinutes)}
                      </div>
                      <div className="aqp-module-title">{text.title}</div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: 'rgba(255,255,255,0.62)',
                          lineHeight: 1.5,
                        }}
                      >
                        {text.summary}
                      </div>
                      <div style={{ marginTop: 14 }}>
                        {isComplete ? (
                          <span className="aqp-module-soon" style={{ background: 'rgba(16,185,129,0.10)', color: '#34D399', borderColor: 'rgba(16,185,129,0.25)' }}>
                            {t.completed}
                          </span>
                        ) : (
                          <span className="aqp-module-soon" style={{ background: 'rgba(0,245,255,0.07)', color: 'var(--aq-cyan)', borderColor: 'rgba(0,245,255,0.20)' }}>
                            {t.start}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
