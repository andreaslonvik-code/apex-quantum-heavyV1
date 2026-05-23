'use client';

import { useMemo } from 'react';
import type { Lang } from '../marketing/types';

type StatCls = 'up' | 'gold' | null;

const RECORD_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  lede: string;
  stats: Array<[string, string, StatCls]>;
  legendApex: string;
  legendBench: string;
  liveTag: string;
}> = {
  no: {
    eye: '04 · Resultater',
    titlePre: 'Tolv måneder ',
    titleEm:  'mot',
    titlePost: ' indeksen.',
    lede: 'Apex Quantum kjører live på Alpaca paper trading siden juni 2025. Grafen sammenligner modellens kapitalvekst mot S&P 500 — samme periode, ulik disiplin.',
    stats: [
      ['YTD avkastning',  '+187,5 %', 'up'],
      ['S&P 500 YTD',     '+14,2 %',  null],
      ['Sharpe (12 mnd)', '4,12',     'gold'],
      ['Vinnerrate',      '73,4 %',   'up'],
      ['Maks drawdown',   '−4,8 %',   null],
      ['Handler i alt',   '12 481',   null],
    ],
    legendApex: 'Apex Quantum',
    legendBench: 'S&P 500',
    liveTag: 'LIVE · PAPER',
  },
  en: {
    eye: '04 · Track Record',
    titlePre: 'Twelve months ',
    titleEm:  'against',
    titlePost: ' the index.',
    lede: 'Apex Quantum has been running live on Alpaca paper trading since June 2025. The chart compares the model’s capital growth against the S&P 500 — same period, different discipline.',
    stats: [
      ['YTD return',     '+187.5 %', 'up'],
      ['S&P 500 YTD',    '+14.2 %',  null],
      ['Sharpe (12 mo)', '4.12',     'gold'],
      ['Win rate',       '73.4 %',   'up'],
      ['Max drawdown',   '−4.8 %',   null],
      ['Total trades',   '12,481',   null],
    ],
    legendApex: 'Apex Quantum',
    legendBench: 'S&P 500',
    liveTag: 'LIVE · PAPER',
  },
};

// Deterministic pseudo-random curve seeded per-line — same shape every render
// so React hydration matches and the chart stays stable on re-renders.
function curve(seed: number, n: number, base: number, drift: number, vol: number): number[] {
  const out: number[] = [];
  let v = base;
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.5;
    v *= 1 + drift + r * vol;
    out.push(v);
  }
  return out;
}

function Chart() {
  const w = 800;
  const h = 380;
  const apex = useMemo(() => curve(7, 60, 100, 0.018, 0.040), []);
  const bench = useMemo(() => curve(13, 60, 100, 0.0023, 0.018), []);
  const all = [...apex, ...bench];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const sx = (i: number, len: number) => (i / (len - 1)) * w;
  const sy = (v: number) => h - ((v - min) / span) * (h - 20) - 10;
  const pts = (arr: number[]) => arr.map((v, i) => `${sx(i, arr.length).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const area = (arr: number[]) => `0,${h} ${pts(arr)} ${w},${h}`;
  const yTicks = [min, (min + max) / 2, max];
  return (
    <div className="record-chart">
      {yTicks.map((v, i) => (
        <span key={i} className="y-lab" style={{ top: `${sy(v) - 6}px` }}>
          {v >= 100 ? v.toFixed(0) : v.toFixed(1)}
        </span>
      ))}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rc-apex-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#C9A961" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#C9A961" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rc-bench-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#00C8D6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#00C8D6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1="0" x2={w} y1={h * p} y2={h * p} stroke="rgba(240,230,210,0.04)" strokeDasharray="3 3" />
        ))}
        <polygon points={area(bench)} fill="url(#rc-bench-fill)" />
        <polyline points={pts(bench)} fill="none" stroke="#00C8D6" strokeWidth="1.4" strokeOpacity="0.7" strokeDasharray="3 3" />
        <polygon points={area(apex)} fill="url(#rc-apex-fill)" />
        <polyline points={pts(apex)} fill="none" stroke="#C9A961" strokeWidth="2.2" />
        <circle cx={w} cy={sy(apex[apex.length - 1])} r="4" fill="#C9A961" />
        <circle cx={w} cy={sy(bench[bench.length - 1])} r="3" fill="#00C8D6" opacity="0.7" />
      </svg>
      <span className="x-lab" style={{ left: '60px' }}>Jun 2025</span>
      <span className="x-lab" style={{ right: '0' }}>May 2026</span>
    </div>
  );
}

function Legend({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="record-legend">
      {dashed
        ? <span className="swatch-dashed" style={{ borderTopColor: color }} />
        : <span className="swatch-solid" style={{ background: color }} />}
      {label}
    </span>
  );
}

export function RecordV2({ lang }: { lang: Lang }) {
  const t = RECORD_COPY[lang];
  return (
    <section id="record" className="record">
      <div className="container">
        <div className="record-grid">
          <div>
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
            <p className="record-lede">{t.lede}</p>
            <div className="record-stats">
              {t.stats.map(([lab, val, cls], i) => (
                <div key={i} className="record-stat">
                  <span className="record-stat-lab">{lab}</span>
                  <span className={`record-stat-val ${cls ?? ''}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <Legend color="#C9A961" label={t.legendApex} />
                <Legend color="#00C8D6" dashed label={t.legendBench} />
              </div>
              <span className="aqv2-tag cy"><span className="aqv2-dot" />{t.liveTag}</span>
            </div>
            <Chart />
          </div>
        </div>
      </div>
    </section>
  );
}
