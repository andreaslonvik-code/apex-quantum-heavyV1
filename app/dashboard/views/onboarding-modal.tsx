'use client';

import { useEffect, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';

const STORAGE_KEY = 'aqp:onboarded';

const COPY = {
  no: {
    title: 'Velkommen til Apex Quantum +',
    sub: 'Tre minutter på en kort gjennomgang så bruker du plattformen som en proff.',
    steps: [
      {
        eye: 'SIGNALER',
        title: 'Daglig markedsanalyse',
        body: 'Hver dag kl. 08:00 publiseres et utvalg AI-signaler fra global watchlist — med begrunnelse, katalysatorer og risiko. Du forstår hvorfor, ikke bare hva.',
      },
      {
        eye: 'SPØR AI',
        title: 'Din egen analytiker, 24/7',
        body: 'Spør AI om hvilken som helst aksje. Modellen kjører live søk og forklarer pedagogisk. Aldri konkrete kjøps- eller salgsanbefalinger — du tar beslutningene.',
      },
      {
        eye: 'LÆRING + JOURNAL',
        title: 'Bygg ekspertisen din',
        body: 'Strukturerte leksjoner fra nybegynner til avansert. Logg beslutningene dine i journalen og se mønstrene dine over tid — det er der den ekte læringen skjer.',
      },
    ],
    next: 'Neste',
    skip: 'Hopp over',
    done: 'Kom i gang',
  },
  en: {
    title: 'Welcome to Apex Quantum +',
    sub: 'Three minutes on a short tour and you use the platform like a pro.',
    steps: [
      {
        eye: 'SIGNALS',
        title: 'Daily market analysis',
        body: 'Every day at 08:00 CET we publish a curated set of AI signals from the global watchlist — with reasoning, catalysts and risk. You understand why, not just what.',
      },
      {
        eye: 'ASK AI',
        title: 'Your own analyst, 24/7',
        body: 'Ask AI about any stock. The model runs live search and explains educationally. Never specific buy or sell calls — you make the decisions.',
      },
      {
        eye: 'LEARN + JOURNAL',
        title: 'Build your expertise',
        body: 'Structured lessons from beginner to advanced. Log your decisions in the journal and see your patterns over time — that is where real learning happens.',
      },
    ],
    next: 'Next',
    skip: 'Skip',
    done: 'Get started',
  },
  de: {
    title: 'Willkommen bei Apex Quantum +',
    sub: 'Drei Minuten Kurzeinführung und Sie nutzen die Plattform wie ein Profi.',
    steps: [
      {
        eye: 'SIGNALE',
        title: 'Tägliche Marktanalyse',
        body: 'Täglich um 08:00 MEZ veröffentlichen wir KI-Signale aus der globalen Watchlist — mit Begründung, Katalysatoren und Risiken.',
      },
      {
        eye: 'KI FRAGEN',
        title: 'Ihr eigener Analyst, 24/7',
        body: 'Fragen Sie die KI zu jeder Aktie. Live-Recherche, pädagogisch erklärt. Keine konkreten Kauf-/Verkaufsempfehlungen — Sie entscheiden.',
      },
      {
        eye: 'LERNEN + JOURNAL',
        title: 'Bauen Sie Expertise auf',
        body: 'Strukturierte Lektionen vom Anfänger bis Fortgeschrittenen. Loggen Sie Entscheidungen im Journal und erkennen Sie Muster über Zeit.',
      },
    ],
    next: 'Weiter',
    skip: 'Überspringen',
    done: 'Loslegen',
  },
  es: {
    title: 'Bienvenido a Apex Quantum +',
    sub: 'Tres minutos de tour rápido y usas la plataforma como un profesional.',
    steps: [
      {
        eye: 'SEÑALES',
        title: 'Análisis diario',
        body: 'Cada día a las 08:00 CET publicamos señales IA de la lista global — con razonamiento, catalizadores y riesgos.',
      },
      {
        eye: 'PREGUNTAR IA',
        title: 'Tu propio analista, 24/7',
        body: 'Pregunta a la IA sobre cualquier acción. Búsqueda en vivo, explicación pedagógica. Nunca recomendaciones específicas — tú decides.',
      },
      {
        eye: 'APRENDER + DIARIO',
        title: 'Construye tu experiencia',
        body: 'Lecciones estructuradas de principiante a avanzado. Registra decisiones y observa tus patrones con el tiempo.',
      },
    ],
    next: 'Siguiente',
    skip: 'Saltar',
    done: 'Empezar',
  },
  zh: {
    title: '欢迎使用 Apex Quantum +',
    sub: '三分钟快速导览，让你像专业人士一样使用平台。',
    steps: [
      {
        eye: '信号',
        title: '每日市场分析',
        body: '每天 CET 08:00 发布来自全球观察清单的 AI 信号——附带推理、催化剂与风险。',
      },
      {
        eye: '问 AI',
        title: '你的专属分析师，24/7',
        body: '问 AI 关于任何股票。实时搜索，教学式解释。从不给出具体买卖建议——你自己决定。',
      },
      {
        eye: '学习 + 日志',
        title: '建立你的专业',
        body: '从入门到高级的结构化课程。在日志中记录决定，发现自己的模式。',
      },
    ],
    next: '下一步',
    skip: '跳过',
    done: '开始使用',
  },
} as const;

interface Props {
  lang: PlusLang;
}

export function OnboardingModal({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const t = COPY[lang];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(STORAGE_KEY) === '1';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;
  const isLast = step === t.steps.length - 1;
  const current = t.steps[step];

  return (
    <div className="aqp-onb-overlay" role="dialog" aria-modal="true" aria-labelledby="aqp-onb-title">
      <div className="aqp-onb-card">
        <header className="aqp-onb-head">
          <h2 id="aqp-onb-title" className="aqp-onb-title">
            {t.title}
          </h2>
          <p className="aqp-onb-sub">{t.sub}</p>
        </header>

        <div className="aqp-onb-step">
          <div className="aqp-onb-eye">
            <span className="m-badge-dot" />
            {current.eye}
          </div>
          <h3 className="aqp-onb-step-title">{current.title}</h3>
          <p className="aqp-onb-step-body">{current.body}</p>
        </div>

        <div className="aqp-onb-progress">
          {t.steps.map((_, i) => (
            <span
              key={i}
              className={`aqp-onb-dot ${i === step ? 'is-on' : i < step ? 'is-done' : ''}`}
            />
          ))}
        </div>

        <div className="aqp-onb-actions">
          <button type="button" className="btn-ghost-v8 btn-sm" onClick={close}>
            {t.skip}
          </button>
          <button
            type="button"
            className="btn-primary-v8 btn-sm"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
          >
            {isLast ? t.done : t.next}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
