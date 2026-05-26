'use client';

import type { Lang } from '../marketing/types';
import type { MarketingStats } from '@/lib/marketing-stats';

const RECORD_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  lede: string;
  ledeNoData: string;
  kpiYtd: string;
  kpiDrawdown: string;
  kpiCapital: string;
  kpiPositions: string;
  legendApex: string;
  liveTag: string;
  emptyChart: string;
}> = {
  no: {
    eye: '04 · Resultater',
    titlePre: 'Disiplin ',
    titleEm: 'mot',
    titlePost: ' markedet.',
    lede: 'Apex Quantum kjører live på Alpaca paper trading. Tallene under speiles direkte fra leder-kontoens cockpit — ingen prototyper, ingen tilbakeberegnede backtests.',
    ledeNoData: 'Live-tall fra leder-kontoen blir publisert her så snart cockpit-data er tilgjengelig.',
    kpiYtd: 'Dager siden oppstart',
    kpiDrawdown: 'Maks drawdown',
    kpiCapital: 'Forvaltet kapital',
    kpiPositions: 'Aktive posisjoner',
    legendApex: 'Apex Quantum',
    liveTag: 'LIVE · PAPER',
    emptyChart: 'For lite historikk til å vise kurve enda.',
  },
  en: {
    eye: '04 · Track Record',
    titlePre: 'Discipline ',
    titleEm: 'against',
    titlePost: ' the market.',
    lede: 'Apex Quantum runs live on Alpaca paper trading. The numbers below mirror the leader account’s cockpit directly — no prototypes, no back-tested figures.',
    ledeNoData: 'Live numbers from the leader account will appear here as soon as cockpit data is available.',
    kpiYtd: 'Days since launch',
    kpiDrawdown: 'Max drawdown',
    kpiCapital: 'Capital under model',
    kpiPositions: 'Active positions',
    legendApex: 'Apex Quantum',
    liveTag: 'LIVE · PAPER',
    emptyChart: 'Not enough history to plot yet.',
  },
};

/**
 * Days since Apex Quantum went live on 2026-05-06. Same source-of-truth
 * as the hero KPI — keep these two in lock-step. If the launch date ever
 * shifts (e.g. corporate re-launch), update both `LAUNCH_DATE_MS`
 * constants. Computed on render so the number flips at midnight UTC.
 */
const LAUNCH_DATE_MS = Date.UTC(2026, 4, 6);
function daysSinceLaunch(): number {
  const days = Math.floor((Date.now() - LAUNCH_DATE_MS) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

function fmtUsd(v: number | null, lang: Lang): string {
  if (v == null || v <= 0) return '—';
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m.toFixed(2).replace('.', lang === 'no' ? ',' : '.')}M`;
  }
  return `$${Math.round(v).toLocaleString(lang === 'no' ? 'nb-NO' : 'en-US')}`;
}

function fmtCompactUsd(v: number, lang: Lang): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2).replace('.', lang === 'no' ? ',' : '.')}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

function EquityChart({ history, lang }: { history: number[]; lang: Lang }) {
  const w = 800;
  const h = 380;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const sx = (i: number) => (i / Math.max(1, history.length - 1)) * w;
  const sy = (v: number) => h - ((v - min) / span) * (h - 20) - 10;
  const pts = history.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  const yTicks = [max, (min + max) / 2, min];
  return (
    <div className="record-chart">
      {yTicks.map((v, i) => (
        <span key={i} className="y-lab" style={{ top: `${sy(v) - 6}px` }}>
          {fmtCompactUsd(v, lang)}
        </span>
      ))}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rc-apex-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#C9A961" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#C9A961" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1="0" x2={w} y1={h * p} y2={h * p} stroke="rgba(240,230,210,0.04)" strokeDasharray="3 3" />
        ))}
        <polygon points={area} fill="url(#rc-apex-fill)" />
        <polyline points={pts} fill="none" stroke="#C9A961" strokeWidth="2.2" />
        <circle cx={w} cy={sy(history[history.length - 1])} r="4" fill="#C9A961" />
      </svg>
    </div>
  );
}

export function RecordV2({ lang, stats }: { lang: Lang; stats: MarketingStats }) {
  const t = RECORD_COPY[lang];
  return (
    <section id="record" className="record">
      <div className="container">
        <div className="record-grid">
          <div>
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
            <p className="record-lede">{stats.ok ? t.lede : t.ledeNoData}</p>
            {stats.ok && (
              <div className="record-stats">
                <div className="record-stat">
                  <span className="record-stat-lab">{t.kpiYtd}</span>
                  <span className="record-stat-val">{daysSinceLaunch()}</span>
                </div>
                <div className="record-stat">
                  <span className="record-stat-lab">{t.kpiDrawdown}</span>
                  <span className="record-stat-val">
                    {stats.maxDrawdownPct == null
                      ? '—'
                      : `−${stats.maxDrawdownPct.toFixed(1).replace('.', lang === 'no' ? ',' : '.')} %`}
                  </span>
                </div>
                <div className="record-stat">
                  <span className="record-stat-lab">{t.kpiCapital}</span>
                  <span className="record-stat-val gold">{fmtUsd(stats.totalValue, lang)}</span>
                </div>
                <div className="record-stat">
                  <span className="record-stat-lab">{t.kpiPositions}</span>
                  <span className="record-stat-val">{stats.positionsHeld ?? '—'}</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <span className="record-legend">
                <span className="swatch-solid" style={{ background: '#C9A961' }} />
                {t.legendApex}
              </span>
              <span className="aqv2-tag cy"><span className="aqv2-dot" />{t.liveTag}</span>
            </div>
            {stats.hasChart ? (
              <EquityChart history={stats.equityHistory} lang={lang} />
            ) : (
              <div className="record-chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--aq-muted)', fontSize: 13, fontFamily: 'var(--aq-font-mono)', letterSpacing: '0.08em' }}>
                  {t.emptyChart}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
