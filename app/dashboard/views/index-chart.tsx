'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';

type Range = '1mo' | '3mo' | '6mo' | '1y';

interface ChartPoint {
  t: number;
  c: number;
}

const RANGES: Range[] = ['1mo', '3mo', '6mo', '1y'];

const COPY = {
  no: {
    eye: 'Indekssammenligning',
    title: 'S&P 500 vs Nasdaq',
    sub: 'Avkastning rebasert til 0 % ved start av perioden.',
    rangeLabels: { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Å' } as Record<Range, string>,
    loading: 'Henter indeksdata…',
    empty: 'Ingen indeksdata tilgjengelig akkurat nå.',
  },
  en: {
    eye: 'Index comparison',
    title: 'S&P 500 vs Nasdaq',
    sub: 'Returns rebased to 0 % at the start of the period.',
    rangeLabels: { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y' } as Record<Range, string>,
    loading: 'Fetching index data…',
    empty: 'No index data available right now.',
  },
  de: {
    eye: 'Index-Vergleich',
    title: 'S&P 500 vs Nasdaq',
    sub: 'Renditen rebasiert auf 0 % zu Beginn des Zeitraums.',
    rangeLabels: { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1J' } as Record<Range, string>,
    loading: 'Lade Indexdaten…',
    empty: 'Aktuell keine Indexdaten verfügbar.',
  },
  es: {
    eye: 'Comparación de índices',
    title: 'S&P 500 vs Nasdaq',
    sub: 'Rentabilidad rebajada a 0 % al inicio del periodo.',
    rangeLabels: { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1A' } as Record<Range, string>,
    loading: 'Cargando datos de índices…',
    empty: 'No hay datos de índices disponibles.',
  },
  zh: {
    eye: '指数对比',
    title: '标普 500 vs 纳斯达克',
    sub: '回报以期初为 0 % 重新基准化。',
    rangeLabels: { '1mo': '1月', '3mo': '3月', '6mo': '6月', '1y': '1年' } as Record<Range, string>,
    loading: '加载指数数据…',
    empty: '暂无指数数据。',
  },
} as const;

async function fetchIndex(symbol: string, range: Range): Promise<ChartPoint[]> {
  const res = await fetch(
    `/api/plus/chart?ticker=${encodeURIComponent(symbol)}&range=${range}`,
    { credentials: 'include' },
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.points)) return [];
  return data.points as ChartPoint[];
}

/**
 * Align two daily-close series by timestamp. Yahoo returns each index on its
 * own calendar (^GSPC and ^IXIC trade in lockstep, but holidays or partial
 * sessions can drop a bar from one and not the other). We keep only the
 * shared days so the % return at any x-position is a fair comparison.
 */
function alignByTimestamp(
  a: ChartPoint[],
  b: ChartPoint[],
): { ts: number[]; aValues: number[]; bValues: number[] } {
  const byT = new Map<number, number>();
  for (const p of a) byT.set(p.t, p.c);
  const ts: number[] = [];
  const aValues: number[] = [];
  const bValues: number[] = [];
  for (const p of b) {
    const av = byT.get(p.t);
    if (typeof av === 'number') {
      ts.push(p.t);
      aValues.push(av);
      bValues.push(p.c);
    }
  }
  return { ts, aValues, bValues };
}

function toPctReturn(values: number[]): number[] {
  if (values.length === 0) return [];
  const base = values[0];
  if (!Number.isFinite(base) || base <= 0) return values.map(() => 0);
  return values.map((v) => (v / base - 1) * 100);
}

const W = 720;
const H = 220;
const PAD_L = 14;
const PAD_R = 60;
const PAD_TB = 18;

export function IndexChart({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [range, setRange] = useState<Range>('3mo');
  const [sp500, setSp500] = useState<ChartPoint[] | null>(null);
  const [nasdaq, setNasdaq] = useState<ChartPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [sp, ix] = await Promise.all([
          fetchIndex('^GSPC', range),
          fetchIndex('^IXIC', range),
        ]);
        if (cancelled) return;
        setSp500(sp);
        setNasdaq(ix);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const series = useMemo(() => {
    if (!sp500 || !nasdaq || sp500.length < 2 || nasdaq.length < 2) return null;
    const { ts, aValues, bValues } = alignByTimestamp(sp500, nasdaq);
    if (ts.length < 2) return null;
    return {
      ts,
      spPct: toPctReturn(aValues),
      ixPct: toPctReturn(bValues),
    };
  }, [sp500, nasdaq]);

  if (loading && !series) {
    return (
      <div className="aqp-index-card">
        <div className="aqp-index-head">
          <div className="aqp-index-eye">{t.eye}</div>
          <h2 className="aqp-index-title">{t.title}</h2>
        </div>
        <div className="aqp-empty" style={{ minHeight: 180 }}>{t.loading}</div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="aqp-index-card">
        <div className="aqp-index-head">
          <div className="aqp-index-eye">{t.eye}</div>
          <h2 className="aqp-index-title">{t.title}</h2>
        </div>
        <div className="aqp-empty" style={{ minHeight: 180 }}>{t.empty}</div>
      </div>
    );
  }

  const { ts, spPct, ixPct } = series;
  const n = ts.length;
  const all = [...spPct, ...ixPct, 0];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const padR = Math.max(0.5, rawMax - rawMin) * 0.08;
  const yMin = rawMin - padR;
  const yMax = rawMax + padR;
  const yRange = yMax - yMin || 1;

  const x = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_TB + (1 - (v - yMin) / yRange) * (H - PAD_TB * 2);

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const spPath = linePath(spPct);
  const ixPath = linePath(ixPct);

  const spEnd = spPct[n - 1];
  const ixEnd = ixPct[n - 1];

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ p, val: yMax - p * yRange }));
  const tickDecimals = yRange < 5 ? 1 : 0;
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(tickDecimals)}%`;

  const zeroVisible = yMin <= 0 && 0 <= yMax;
  const zeroY = zeroVisible ? y(0) : null;

  const firstDate = new Date(ts[0] * 1000);
  const lastDate = new Date(ts[n - 1] * 1000);
  const dateFmt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const locale = lang === 'zh' ? 'zh-CN' : lang;

  return (
    <div className="aqp-index-card">
      <div className="aqp-index-head">
        <div>
          <div className="aqp-index-eye">{t.eye}</div>
          <h2 className="aqp-index-title">{t.title}</h2>
          <p className="aqp-index-sub">{t.sub}</p>
        </div>
        <div className="aqp-index-ranges">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`aqp-index-range ${range === r ? 'is-on' : ''}`}
              onClick={() => setRange(r)}
            >
              {t.rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="aqp-index-legend">
        <span className="aqp-index-legend-item aqp-index-legend-item--sp">
          <span className="aqp-index-swatch aqp-index-swatch--sp" />
          S&P 500
          <span className={`aqp-index-legend-num ${spEnd >= 0 ? 'is-up' : 'is-down'}`}>
            {spEnd >= 0 ? '+' : ''}
            {spEnd.toFixed(2)}%
          </span>
        </span>
        <span className="aqp-index-legend-item aqp-index-legend-item--ix">
          <span className="aqp-index-swatch aqp-index-swatch--ix" />
          Nasdaq
          <span className={`aqp-index-legend-num ${ixEnd >= 0 ? 'is-up' : 'is-down'}`}>
            {ixEnd >= 0 ? '+' : ''}
            {ixEnd.toFixed(2)}%
          </span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="aqp-index-svg" preserveAspectRatio="none">
        {yTicks.map(({ p }, i) => (
          <line
            key={i}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_TB + p * (H - PAD_TB * 2)}
            y2={PAD_TB + p * (H - PAD_TB * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="2 4"
          />
        ))}

        {zeroY !== null && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
        )}

        <path
          d={spPath}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.4"
          fill="none"
          strokeDasharray="3 4"
        />
        <path
          d={ixPath}
          stroke="rgba(96,165,250,0.85)"
          strokeWidth="1.4"
          fill="none"
          strokeDasharray="2 3"
        />

        {yTicks.map(({ p, val }, i) => (
          <text
            key={`yt-${i}`}
            x={W - PAD_R + 6}
            y={PAD_TB + p * (H - PAD_TB * 2) + 3}
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill="rgba(255,255,255,0.5)"
            textAnchor="start"
          >
            {fmtPct(val)}
          </text>
        ))}

        <text
          x={x(n - 1) + 4}
          y={y(spEnd) - 3}
          fontSize="9"
          fontFamily="JetBrains Mono"
          fill="rgba(255,255,255,0.7)"
        >
          S&amp;P
        </text>
        <text
          x={x(n - 1) + 4}
          y={y(ixEnd) + 10}
          fontSize="9"
          fontFamily="JetBrains Mono"
          fill="rgba(96,165,250,0.85)"
        >
          NDX
        </text>
      </svg>

      <div className="aqp-index-xaxis">
        <span>{firstDate.toLocaleDateString(locale, dateFmt)}</span>
        <span>{lastDate.toLocaleDateString(locale, dateFmt)}</span>
      </div>
    </div>
  );
}
