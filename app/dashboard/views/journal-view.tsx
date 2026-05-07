'use client';

import type { PlusLang } from '@/lib/i18n/plus-lang';

const COPY = {
  no: {
    eye: 'MIN JOURNAL',
    title: 'Investerings-journal',
    sub: 'Logg hver beslutning: tese, tidshorisont, hva du forventer, hva som vil få deg til å selge. Etter noen måneder ser du dine egne mønstre — og lærer mer av journalen enn av noe kurs. Lansering i fase 2.',
    soon: 'Kommer snart',
  },
  en: {
    eye: 'MY JOURNAL',
    title: 'Investment journal',
    sub: 'Log every decision: thesis, time horizon, what you expect, what would make you sell. After a few months you see your own patterns — and learn more from the journal than any course. Ships in phase 2.',
    soon: 'Coming soon',
  },
  de: {
    eye: 'MEIN JOURNAL',
    title: 'Investment-Journal',
    sub: 'Jede Entscheidung protokollieren: These, Zeithorizont, Erwartung, was zum Verkauf führen würde. Nach einigen Monaten erkennen Sie Muster und lernen mehr als aus jedem Kurs. In Phase 2.',
    soon: 'Bald',
  },
  es: {
    eye: 'MI DIARIO',
    title: 'Diario de inversión',
    sub: 'Registra cada decisión: tesis, horizonte, expectativa, qué te haría vender. Tras unos meses verás patrones propios y aprenderás más que con cualquier curso. En fase 2.',
    soon: 'Pronto',
  },
  zh: {
    eye: '我的日志',
    title: '投资日志',
    sub: '记录每一个决定：论点、时间范围、预期、卖出条件。几个月后你会看到自己的模式，比任何课程都学得多。第二阶段上线。',
    soon: '即将推出',
  },
} as const;

export function JournalView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
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
      <div className="aqp-empty-card">
        <div className="aqp-empty-title">{t.soon}</div>
      </div>
    </div>
  );
}
