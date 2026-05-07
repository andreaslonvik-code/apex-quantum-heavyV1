'use client';

import { useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import { PLUS_WATCHLIST, type PlusRegion } from '@/lib/blueprints/plus';
import { type PlusAction, SEED_SIGNALS } from './seed-signals';

const COPY = {
  no: {
    eye: 'I DAG',
    title: 'Dagens signaler',
    sub: 'AI-genererte signaler fra global watchlist. Hver med begrunnelse, katalysatorer og risiko — slik at du forstår *hvorfor*, ikke bare *hva*.',
    allRegions: 'Alle regioner',
    catalysts: 'Katalysatorer',
    risks: 'Risikofaktorer',
    horizon: 'Tidshorisont',
    confidence: 'Konfidens',
    askAi: 'Spør AI',
    horizons: { short: 'Kort (uker)', medium: 'Medium (måneder)', long: 'Lang (kvartaler)' },
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD', WATCH: 'OBSERVÉR' },
    disclaimer:
      'Apex Quantum + er en lærings- og analyseplattform. Innholdet er ikke individuell investeringsrådgivning. Tidligere resultater er ingen garanti for fremtidige resultater.',
    seedNote: 'Demonstrasjonssignaler — ekte signal-pipeline kobles på når Grok-jobben er live.',
  },
  en: {
    eye: 'TODAY',
    title: "Today's signals",
    sub: 'AI-generated signals from the global watchlist. Each with reasoning, catalysts and risk — so you understand the *why*, not just the *what*.',
    allRegions: 'All regions',
    catalysts: 'Catalysts',
    risks: 'Risks',
    horizon: 'Time horizon',
    confidence: 'Confidence',
    askAi: 'Ask AI',
    horizons: { short: 'Short (weeks)', medium: 'Medium (months)', long: 'Long (quarters)' },
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', WATCH: 'WATCH' },
    disclaimer:
      'Apex Quantum + is a learning and analysis platform. Content is not individual investment advice. Past performance is no guarantee of future results.',
    seedNote: 'Demonstration signals — real pipeline activates once the Grok job is live.',
  },
  de: {
    eye: 'HEUTE',
    title: 'Signale heute',
    sub: 'KI-generierte Signale aus der globalen Watchlist. Jedes mit Begründung, Katalysatoren und Risiken — damit Sie das *Warum* verstehen, nicht nur das *Was*.',
    allRegions: 'Alle Regionen',
    catalysts: 'Katalysatoren',
    risks: 'Risiken',
    horizon: 'Zeithorizont',
    confidence: 'Konfidenz',
    askAi: 'KI fragen',
    horizons: { short: 'Kurz (Wochen)', medium: 'Mittel (Monate)', long: 'Lang (Quartale)' },
    actions: { BUY: 'KAUFEN', SELL: 'VERKAUFEN', HOLD: 'HALTEN', WATCH: 'BEOBACHTEN' },
    disclaimer:
      'Apex Quantum + ist eine Lern- und Analyseplattform. Inhalte sind keine individuelle Anlageberatung. Frühere Ergebnisse sind keine Garantie für künftige.',
    seedNote: 'Demo-Signale — echte Pipeline läuft, sobald der Grok-Job live ist.',
  },
  es: {
    eye: 'HOY',
    title: 'Señales de hoy',
    sub: 'Señales generadas por IA de la lista global. Cada una con razonamiento, catalizadores y riesgos — para que entiendas el *por qué*, no solo el *qué*.',
    allRegions: 'Todas las regiones',
    catalysts: 'Catalizadores',
    risks: 'Riesgos',
    horizon: 'Horizonte temporal',
    confidence: 'Confianza',
    askAi: 'Preguntar IA',
    horizons: { short: 'Corto (semanas)', medium: 'Medio (meses)', long: 'Largo (trimestres)' },
    actions: { BUY: 'COMPRAR', SELL: 'VENDER', HOLD: 'MANTENER', WATCH: 'OBSERVAR' },
    disclaimer:
      'Apex Quantum + es una plataforma de aprendizaje y análisis. El contenido no es asesoramiento de inversión individual. Resultados pasados no garantizan resultados futuros.',
    seedNote: 'Señales de demostración — el pipeline real se activa cuando el job de Grok esté en vivo.',
  },
  zh: {
    eye: '今日',
    title: '今日信号',
    sub: 'AI 从全球观察清单生成的信号，附带推理、催化剂与风险——让你理解*为什么*，而不仅仅是*什么*。',
    allRegions: '所有地区',
    catalysts: '催化剂',
    risks: '风险',
    horizon: '时间范围',
    confidence: '信心',
    askAi: '问AI',
    horizons: { short: '短期（周）', medium: '中期（月）', long: '长期（季度）' },
    actions: { BUY: '买入', SELL: '卖出', HOLD: '持有', WATCH: '观察' },
    disclaimer:
      'Apex Quantum + 是学习与分析平台。内容非个人投资建议。过往业绩不保证未来表现。',
    seedNote: '演示信号——真实管线在 Grok 任务上线后启用。',
  },
} as const;

const REGION_LABELS: Record<PlusLang, Record<PlusRegion, string>> = {
  no: { NO: 'Norge', EU: 'Europa', US: 'USA', TW: 'Taiwan', KR: 'Korea', JP: 'Japan', HK: 'Hongkong', IN: 'India' },
  en: { NO: 'Norway', EU: 'Europe', US: 'USA', TW: 'Taiwan', KR: 'Korea', JP: 'Japan', HK: 'Hong Kong', IN: 'India' },
  de: { NO: 'Norwegen', EU: 'Europa', US: 'USA', TW: 'Taiwan', KR: 'Korea', JP: 'Japan', HK: 'Hongkong', IN: 'Indien' },
  es: { NO: 'Noruega', EU: 'Europa', US: 'EEUU', TW: 'Taiwán', KR: 'Corea', JP: 'Japón', HK: 'Hong Kong', IN: 'India' },
  zh: { NO: '挪威', EU: '欧洲', US: '美国', TW: '台湾', KR: '韩国', JP: '日本', HK: '香港', IN: '印度' },
};

const REGIONS: PlusRegion[] = ['NO', 'EU', 'US', 'TW', 'KR', 'JP', 'HK', 'IN'];

function actionColor(action: PlusAction): { bg: string; fg: string; border: string } {
  switch (action) {
    case 'BUY':
      return { bg: 'rgba(16,185,129,0.12)', fg: '#34D399', border: 'rgba(16,185,129,0.35)' };
    case 'SELL':
      return { bg: 'rgba(239,68,68,0.12)', fg: '#F87171', border: 'rgba(239,68,68,0.35)' };
    case 'HOLD':
      return { bg: 'rgba(245,196,67,0.12)', fg: '#F5C443', border: 'rgba(245,196,67,0.35)' };
    case 'WATCH':
      return { bg: 'rgba(0,245,255,0.10)', fg: '#5CFAFF', border: 'rgba(0,245,255,0.30)' };
  }
}

export function SignalsView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [region, setRegion] = useState<PlusRegion | 'ALL'>('ALL');

  const filtered = useMemo(() => {
    if (region === 'ALL') return SEED_SIGNALS;
    return SEED_SIGNALS.filter((s) => s.region === region);
  }, [region]);

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

      <div className="aqp-filter-row">
        <button
          type="button"
          className={`aqp-chip ${region === 'ALL' ? 'is-on' : ''}`}
          onClick={() => setRegion('ALL')}
        >
          {t.allRegions}
        </button>
        {REGIONS.map((r) => {
          const count = SEED_SIGNALS.filter((s) => s.region === r).length;
          if (count === 0) return null;
          return (
            <button
              key={r}
              type="button"
              className={`aqp-chip ${region === r ? 'is-on' : ''}`}
              onClick={() => setRegion(r)}
            >
              {REGION_LABELS[lang][r]} <span className="aqp-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="aqp-seed-note">{t.seedNote}</div>

      <div className="aqp-signal-stack">
        {filtered.map((s) => {
          const ac = actionColor(s.action);
          const meta = PLUS_WATCHLIST.find((w) => w.ticker === s.ticker);
          return (
            <article key={s.id} className="aqp-signal-card">
              <header className="aqp-signal-head">
                <div className="aqp-signal-id">
                  <div className="aqp-ticker">{s.ticker}</div>
                  <div className="aqp-ticker-name">{meta?.name ?? s.ticker}</div>
                </div>
                <div
                  className="aqp-action-pill"
                  style={{ background: ac.bg, color: ac.fg, borderColor: ac.border }}
                >
                  {t.actions[s.action]}
                </div>
              </header>

              <div className="aqp-signal-meta">
                <span className="aqp-meta-item">
                  <span className="aqp-meta-key">{REGION_LABELS[lang][s.region]}</span>
                </span>
                <span className="aqp-meta-sep">·</span>
                <span className="aqp-meta-item">
                  <span className="aqp-meta-key">{t.confidence}:</span>{' '}
                  <span className="aqp-meta-val">{s.confidence}%</span>
                </span>
                <span className="aqp-meta-sep">·</span>
                <span className="aqp-meta-item">
                  <span className="aqp-meta-key">{t.horizon}:</span>{' '}
                  <span className="aqp-meta-val">{t.horizons[s.timeHorizon]}</span>
                </span>
              </div>

              <p className="aqp-signal-reasoning">{s.reasoning[lang]}</p>

              <div className="aqp-signal-grid">
                <div className="aqp-signal-block">
                  <div className="aqp-block-head">
                    <span className="aqp-block-dot aqp-block-dot--catalyst" />
                    {t.catalysts}
                  </div>
                  <ul className="aqp-block-list">
                    {s.catalysts[lang].map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="aqp-signal-block">
                  <div className="aqp-block-head">
                    <span className="aqp-block-dot aqp-block-dot--risk" />
                    {t.risks}
                  </div>
                  <ul className="aqp-block-list">
                    {s.risks[lang].map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="aqp-disclaimer">{t.disclaimer}</p>
    </div>
  );
}
