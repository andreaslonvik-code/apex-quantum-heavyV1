'use client';

import type { PlusLang } from '@/lib/i18n/plus-lang';

const COPY = {
  no: {
    eye: 'RAPPORTER',
    title: 'Ukentlige markedsrapporter',
    sub: 'Hver søndag publiseres en regional gjennomgang: hva som beveget kursene, sektorrotasjoner, makro-faktorer og hva modellen følger med på neste uke. Ekte rapport-pipeline lanseres i fase 2.',
    placeholderTitle: 'Ingen rapporter publisert ennå',
    placeholderSub: 'Når den første rapporten er klar, varsles du på e-post og vi viser den her.',
  },
  en: {
    eye: 'REPORTS',
    title: 'Weekly market reports',
    sub: 'Every Sunday a regional review: what moved prices, sector rotations, macro factors, and what the model is watching next week. Real pipeline ships in phase 2.',
    placeholderTitle: 'No reports published yet',
    placeholderSub: 'When the first report is ready you will be notified by email and we will show it here.',
  },
  de: {
    eye: 'BERICHTE',
    title: 'Wöchentliche Marktberichte',
    sub: 'Jeden Sonntag eine regionale Übersicht: Was die Kurse bewegte, Sektorrotationen, Makrofaktoren und was das Modell für nächste Woche beobachtet. Echte Pipeline kommt in Phase 2.',
    placeholderTitle: 'Noch keine Berichte veröffentlicht',
    placeholderSub: 'Sobald der erste Bericht fertig ist, erhalten Sie eine E-Mail und wir zeigen ihn hier.',
  },
  es: {
    eye: 'INFORMES',
    title: 'Informes semanales',
    sub: 'Cada domingo una revisión regional: qué movió los precios, rotación sectorial, macro y qué vigila el modelo la próxima semana. Pipeline real en fase 2.',
    placeholderTitle: 'Aún no hay informes',
    placeholderSub: 'Cuando esté el primer informe te avisaremos por email y lo mostraremos aquí.',
  },
  zh: {
    eye: '报告',
    title: '每周市场报告',
    sub: '每周日发布区域回顾：价格驱动因素、行业轮动、宏观因素，以及模型下周关注的方向。真实管线将在第二阶段上线。',
    placeholderTitle: '尚未发布报告',
    placeholderSub: '第一份报告就绪后，我们会通过邮件通知并在此展示。',
  },
} as const;

export function ReportsView({ lang }: { lang: PlusLang }) {
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
        <div className="aqp-empty-title">{t.placeholderTitle}</div>
        <p className="aqp-empty-sub">{t.placeholderSub}</p>
      </div>
    </div>
  );
}
