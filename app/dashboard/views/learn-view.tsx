'use client';

import type { PlusLang } from '@/lib/i18n/plus-lang';

const COPY = {
  no: {
    eye: 'LÆRING',
    title: 'Læringsmoduler',
    sub: 'Strukturert pensum fra nybegynner til avansert. Aksjebasis, fundamental og teknisk analyse, risiko og psykologi — med eksempler hentet direkte fra signal-feeden. Lansering i fase 3.',
    modules: ['Nybegynner — markedet 101', 'Mellom — fundamental analyse', 'Avansert — teknisk og makro'],
    soon: 'Kommer snart',
  },
  en: {
    eye: 'LEARN',
    title: 'Learning modules',
    sub: 'Structured curriculum from beginner to advanced. Stock basics, fundamental and technical analysis, risk and psychology — with examples pulled directly from the signal feed. Ships in phase 3.',
    modules: ['Beginner — markets 101', 'Intermediate — fundamental analysis', 'Advanced — technical and macro'],
    soon: 'Coming soon',
  },
  de: {
    eye: 'LERNEN',
    title: 'Lernmodule',
    sub: 'Strukturierter Lehrplan von Anfänger bis Fortgeschritten. Aktien-Grundlagen, fundamentale und technische Analyse, Risiko und Psychologie — mit Beispielen direkt aus dem Signal-Feed. In Phase 3.',
    modules: ['Anfänger — Märkte 101', 'Mittel — fundamentale Analyse', 'Fortgeschritten — Technik und Makro'],
    soon: 'Bald',
  },
  es: {
    eye: 'APRENDER',
    title: 'Módulos de aprendizaje',
    sub: 'Currículo estructurado de principiante a avanzado. Fundamentos, análisis fundamental y técnico, riesgo y psicología — con ejemplos del feed de señales. En fase 3.',
    modules: ['Principiante — mercados 101', 'Intermedio — análisis fundamental', 'Avanzado — técnico y macro'],
    soon: 'Pronto',
  },
  zh: {
    eye: '学习',
    title: '学习模块',
    sub: '从入门到高级的结构化课程。股票基础、基本面和技术分析、风险与心理——例子直接来自信号流。第三阶段上线。',
    modules: ['入门 — 市场 101', '中级 — 基本面分析', '高级 — 技术与宏观'],
    soon: '即将推出',
  },
} as const;

export function LearnView({ lang }: { lang: PlusLang }) {
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
      <div className="aqp-module-grid">
        {t.modules.map((m) => (
          <div key={m} className="aqp-module-card">
            <div className="aqp-module-title">{m}</div>
            <div className="aqp-module-soon">{t.soon}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
