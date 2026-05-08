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

// Inline-formatting helper: bold (**x**) and inline code (`x`).
// Returns ReactNodes, splitting the text into spans/strong/code as needed.
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Match **bold** or `code` greedily, in order of appearance.
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<code key={key++} className="aqp-inline-code">{tok.slice(1, -1)}</code>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const CALLOUT_LABELS: Record<string, { label: Record<'no' | 'en', string>; cls: string }> = {
  example: { label: { no: 'Eksempel', en: 'Example' }, cls: 'aqp-cb--example' },
  key: { label: { no: 'Nøkkelinnsikt', en: 'Key insight' }, cls: 'aqp-cb--key' },
  warn: { label: { no: 'Advarsel', en: 'Warning' }, cls: 'aqp-cb--warn' },
  formula: { label: { no: 'Formel', en: 'Formula' }, cls: 'aqp-cb--formula' },
  data: { label: { no: 'Tall fra markedet', en: 'Live numbers' }, cls: 'aqp-cb--data' },
};

function renderCallout(
  kind: keyof typeof CALLOUT_LABELS,
  bodyLines: string[],
  langForLabel: 'no' | 'en',
  k: number,
) {
  const cfg = CALLOUT_LABELS[kind];
  const text = bodyLines.join('\n').trim();
  return (
    <aside key={k} className={`aqp-cb ${cfg.cls}`}>
      <div className="aqp-cb-label">{cfg.label[langForLabel]}</div>
      {text.split(/\n{1,}/).map((line, j) => (
        <p key={j} className="aqp-cb-body">{inline(line)}</p>
      ))}
    </aside>
  );
}

function renderTable(rows: string[], k: number) {
  // First row = header. Second row may be separator (---|---), skip if so.
  const cells = rows
    .map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    .filter((cols) => !cols.every((c) => /^-+$/.test(c)));
  if (cells.length === 0) return null;
  const [head, ...body] = cells;
  return (
    <div key={k} className="aqp-tbl-wrap">
      <table className="aqp-tbl">
        <thead>
          <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, j) => (
            <tr key={j}>{row.map((c, m) => <td key={m}>{inline(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VizTrendChannel() {
  return (
    <svg className="aqp-viz" viewBox="0 0 320 140" role="img" aria-label="Trend-kanal illustrasjon">
      <defs>
        <linearGradient id="aqpTrend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,245,255,0.30)" />
          <stop offset="100%" stopColor="rgba(0,245,255,0)" />
        </linearGradient>
      </defs>
      <line x1="10" y1="40" x2="310" y2="20" stroke="rgba(0,245,255,0.45)" strokeDasharray="4 4" strokeWidth="1.5" />
      <line x1="10" y1="120" x2="310" y2="100" stroke="rgba(0,245,255,0.45)" strokeDasharray="4 4" strokeWidth="1.5" />
      <path d="M10,90 L40,75 L70,95 L100,60 L130,80 L160,55 L190,70 L220,40 L250,60 L280,30 L310,50" fill="none" stroke="#5CFAFF" strokeWidth="2" />
      <text x="14" y="14" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="monospace">øvre motstand</text>
      <text x="14" y="135" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="monospace">nedre støtte</text>
    </svg>
  );
}

function VizOrderBook() {
  return (
    <svg className="aqp-viz" viewBox="0 0 320 160" role="img" aria-label="Ordrebok illustrasjon">
      <text x="10" y="14" fill="rgba(255,255,255,0.6)" fontSize="10" fontFamily="monospace">BID</text>
      <text x="280" y="14" fill="rgba(255,255,255,0.6)" fontSize="10" fontFamily="monospace">ASK</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`b${i}`}>
          <rect x={10} y={26 + i * 24} width={120 - i * 8} height={18} fill="rgba(16,185,129,0.18)" />
          <text x={14} y={39 + i * 24} fill="#34D399" fontSize="11" fontFamily="monospace">
            {(975.4 - i * 0.1).toFixed(1)}
          </text>
          <text x={86} y={39 + i * 24} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">
            {120 - i * 16}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`a${i}`}>
          <rect x={190 + i * 8} y={26 + i * 24} width={120 - i * 8} height={18} fill="rgba(239,68,68,0.18)" />
          <text x={194 + i * 8} y={39 + i * 24} fill="#F87171" fontSize="11" fontFamily="monospace">
            {(975.6 + i * 0.1).toFixed(1)}
          </text>
          <text x={266 + i * 8} y={39 + i * 24} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">
            {100 - i * 12}
          </text>
        </g>
      ))}
    </svg>
  );
}

function VizCandlestick() {
  return (
    <svg className="aqp-viz" viewBox="0 0 320 160" role="img" aria-label="Candlestick anatomi">
      <line x1="160" y1="20" x2="160" y2="140" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <rect x="142" y="55" width="36" height="55" fill="rgba(16,185,129,0.55)" stroke="#34D399" strokeWidth="1.5" />
      <text x="200" y="30" fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="monospace">høy 982.0</text>
      <line x1="180" y1="26" x2="195" y2="26" stroke="rgba(255,255,255,0.5)" strokeDasharray="2 2" />
      <text x="200" y="62" fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="monospace">åpning 968.0</text>
      <line x1="180" y1="58" x2="195" y2="58" stroke="rgba(255,255,255,0.5)" strokeDasharray="2 2" />
      <text x="200" y="115" fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="monospace">slutt 975.0</text>
      <line x1="180" y1="111" x2="195" y2="111" stroke="rgba(255,255,255,0.5)" strokeDasharray="2 2" />
      <text x="200" y="148" fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="monospace">lav 962.0</text>
      <line x1="180" y1="144" x2="195" y2="144" stroke="rgba(255,255,255,0.5)" strokeDasharray="2 2" />
    </svg>
  );
}

const VIZ_MAP: Record<string, React.ComponentType> = {
  'trend-channel': VizTrendChannel,
  'order-book': VizOrderBook,
  candlestick: VizCandlestick,
};

function renderMarkdown(body: string, langForLabel: 'no' | 'en' = 'no') {
  const blocks = body.split(/\n{2,}/);
  const out: React.ReactNode[] = [];
  blocks.forEach((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    // Headings
    if (trimmed.startsWith('# ')) {
      out.push(<h2 key={i} className="aqp-report-h1">{trimmed.replace(/^#\s+/, '')}</h2>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      out.push(<h3 key={i} className="aqp-report-h2">{trimmed.replace(/^##\s+/, '')}</h3>);
      return;
    }
    if (trimmed.startsWith('### ')) {
      out.push(<h4 key={i} className="aqp-report-h3">{trimmed.replace(/^###\s+/, '')}</h4>);
      return;
    }

    // Visualization shortcode: [viz:<name>]
    const vizMatch = trimmed.match(/^\[viz:([a-z-]+)\]$/);
    if (vizMatch) {
      const Comp = VIZ_MAP[vizMatch[1]];
      if (Comp) {
        out.push(<div key={i} className="aqp-viz-wrap"><Comp /></div>);
        return;
      }
    }

    // Callout: lines starting with `> [!kind]` followed by `> ...`
    const calloutMatch = trimmed.match(/^>\s*\[!(\w+)\]\s*\n([\s\S]*)$/) ||
      trimmed.match(/^>\s*\[!(\w+)\]\s*$/);
    if (calloutMatch && CALLOUT_LABELS[calloutMatch[1] as keyof typeof CALLOUT_LABELS]) {
      const kind = calloutMatch[1] as keyof typeof CALLOUT_LABELS;
      const rest = (calloutMatch[2] ?? '').split('\n').map((l) => l.replace(/^>\s?/, ''));
      out.push(renderCallout(kind, rest, langForLabel, i));
      return;
    }

    // Tables: lines starting with `|`
    if (trimmed.startsWith('|') && trimmed.includes('\n')) {
      const rows = trimmed.split('\n').filter((l) => l.startsWith('|'));
      const tbl = renderTable(rows, i);
      if (tbl) {
        out.push(tbl);
        return;
      }
    }

    // Bullet list
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
      out.push(
        <ul key={i} className="aqp-report-list">
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </ul>,
      );
      return;
    }

    // Default paragraph
    out.push(<p key={i} className="aqp-report-p">{inline(trimmed)}</p>);
  });
  return out;
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
          {renderMarkdown(text.body, lang === 'no' ? 'no' : 'en')}
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
