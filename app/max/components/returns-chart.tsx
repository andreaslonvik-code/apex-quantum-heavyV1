'use client';

import { useMemo } from 'react';

export type ChartMode = 'return' | 'index';

interface Props {
  /** Equity values over time. If empty, renders a placeholder line. */
  points?: number[];
  /** S&P 500 (SPY) benchmark series, time-aligned to equity. */
  spyPoints?: number[];
  /** Nasdaq 100 (QQQ) benchmark series, time-aligned to equity. */
  qqqPoints?: number[];
  xTicks?: string[];
  /** When set, draws a peak label on the chart at the value's index. */
  peakIndex?: number;
  /**
   * 'return' — APEX equity area chart with faint benchmark overlays.
   * 'index'  — APEX, S&P 500 and NASDAQ 100 each rebased to % return from
   *            the period start, plotted as comparable lines for a direct
   *            head-to-head performance comparison.
   */
  mode?: ChartMode;
}

const DEFAULT_TICKS = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'];

/**
 * Re-base a benchmark series so it starts at the same value as the portfolio
 * series. The chart then visualizes RELATIVE performance (e.g. portfolio +1 %
 * vs SPY +0.5 %), not absolute price levels. Returns null if data isn't
 * usable (too short / non-positive starting point).
 */
function rebaseToPortfolio(bench: number[] | undefined, pts: number[]): number[] | null {
  if (!bench || bench.length < 2 || pts.length < 2) return null;
  const baseB = bench[0];
  const baseP = pts[0];
  if (baseB <= 0 || baseP <= 0) return null;
  // Bench should be the same length as pts (server pre-aligns by timestamp);
  // if not, fall back to index-stretching as a defensive measure.
  if (bench.length === pts.length) {
    return bench.map((v) => baseP * (v / baseB));
  }
  const scaled: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const idx = Math.min(
      bench.length - 1,
      Math.floor((i / (pts.length - 1)) * (bench.length - 1)),
    );
    scaled.push(baseP * (bench[idx] / baseB));
  }
  return scaled;
}

/**
 * Convert a price/equity series to percentage return from its first point
 * (e.g. [100, 110, 105] → [0, 10, 5]). Length-aligned to `targetLen` so the
 * portfolio and both benchmarks share one x-axis. Returns null if the data
 * isn't usable.
 */
function toPctSeries(series: number[] | undefined, targetLen: number): number[] | null {
  if (!series || series.length < 2 || targetLen < 2) return null;
  const base = series[0];
  if (base <= 0) return null;
  if (series.length === targetLen) {
    return series.map((v) => (v / base - 1) * 100);
  }
  const out: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.min(
      series.length - 1,
      Math.floor((i / (targetLen - 1)) * (series.length - 1)),
    );
    out.push((series[idx] / base - 1) * 100);
  }
  return out;
}

export function ReturnsChart({
  points,
  spyPoints,
  qqqPoints,
  xTicks = DEFAULT_TICKS,
  peakIndex,
  mode = 'return',
}: Props) {
  const pts = useMemo(() => {
    if (points && points.length > 1) return points;
    const out: number[] = [];
    let v = 1_000_000;
    for (let i = 0; i < 120; i++) {
      // Deterministic placeholder curve (no Math.random — keeps useMemo pure).
      v += (Math.sin(i / 9) + 0.6) * 450 + Math.sin(i / 2.3) * 120;
      out.push(v);
    }
    return out;
  }, [points]);

  const isIndex = mode === 'index';

  // Return mode: benchmarks rebased to the portfolio's starting value.
  const spy = useMemo(() => rebaseToPortfolio(spyPoints, pts), [spyPoints, pts]);
  const qqq = useMemo(() => rebaseToPortfolio(qqqPoints, pts), [qqqPoints, pts]);

  // Index mode: each series expressed as its own % return from period start.
  const apexPct = useMemo(() => toPctSeries(pts, pts.length), [pts]);
  const spyPct = useMemo(() => toPctSeries(spyPoints, pts.length), [spyPoints, pts.length]);
  const qqqPct = useMemo(() => toPctSeries(qqqPoints, pts.length), [qqqPoints, pts.length]);

  const W = 1200;
  const H = 320;
  const pad = 24;

  // Active series for the chosen mode.
  const apexSeries = isIndex ? apexPct ?? pts.map(() => 0) : pts;
  const spySeries = isIndex ? spyPct : spy;
  const qqqSeries = isIndex ? qqqPct : qqq;

  const allValues: number[] = [
    ...apexSeries,
    ...(spySeries ?? []),
    ...(qqqSeries ?? []),
    ...(isIndex ? [0] : []), // keep the 0 % baseline in frame
  ];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const n = apexSeries.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const toPath = (s: number[]) =>
    s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const path = toPath(apexSeries);
  // Area fill only in return mode — an index comparison reads cleaner as lines.
  const area = isIndex ? null : `${path} L${x(n - 1)},${H - pad} L${pad},${H - pad} Z`;
  const spyPath = spySeries ? toPath(spySeries) : null;
  const qqqPath = qqqSeries ? toPath(qqqSeries) : null;

  // Peak marker — return mode only (an index comparison has no single peak).
  const pi = !isIndex
    ? typeof peakIndex === 'number'
      ? peakIndex
      : pts.indexOf(Math.max(...pts))
    : -1;
  const peakX = pi >= 0 ? x(pi) : null;
  const peakY = pi >= 0 ? y(pts[pi]) : null;
  const peakValue = pi >= 0 ? pts[pi] : null;

  // 0 % reference line — index mode only.
  const baselineY = isIndex ? y(0) : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id="rc-grn" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rc-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={pad}
            x2={W - pad}
            y1={pad + p * (H - pad * 2)}
            y2={pad + p * (H - pad * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="2 4"
          />
        ))}
        {baselineY !== null && (
          <line
            x1={pad}
            x2={W - pad}
            y1={baselineY}
            y2={baselineY}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1"
          />
        )}
        {area && <path d={area} fill="url(#rc-grn)" />}
        {spyPath && (
          <path
            d={spyPath}
            stroke={isIndex ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)'}
            strokeWidth={isIndex ? 1.8 : 1.4}
            fill="none"
            strokeDasharray={isIndex ? undefined : '4 5'}
          />
        )}
        {qqqPath && (
          <path
            d={qqqPath}
            stroke={isIndex ? 'rgba(96,165,250,0.9)' : 'rgba(96,165,250,0.55)'}
            strokeWidth={isIndex ? 1.8 : 1.4}
            fill="none"
            strokeDasharray={isIndex ? undefined : '2 3'}
          />
        )}
        <path d={path} stroke="url(#rc-line)" strokeWidth="2" fill="none" />
        <circle cx={x(n - 1)} cy={y(apexSeries[n - 1])} r="4" fill="#34D399">
          <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite" />
        </circle>

        {peakX !== null && peakY !== null && peakValue !== null && pi !== n - 1 && (
          <g>
            <circle cx={peakX} cy={peakY} r="4" fill="rgba(255,255,255,0.85)" />
            <text
              x={peakX}
              y={peakY - 12}
              textAnchor="middle"
              fontSize="11"
              fontFamily="JetBrains Mono"
              fill="rgba(255,255,255,0.7)"
            >
              Topp {peakValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </text>
          </g>
        )}
        {spyPath && spySeries && (
          <text
            x={x(n - 1) + 4}
            y={y(spySeries[n - 1]) + 4}
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill={isIndex ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'}
            textAnchor="start"
          >
            S&amp;P 500
          </text>
        )}
        {qqqPath && qqqSeries && (
          <text
            x={x(n - 1) + 4}
            y={y(qqqSeries[n - 1]) - 8}
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill="rgba(96,165,250,0.85)"
            textAnchor="start"
          >
            NASDAQ 100
          </text>
        )}
      </svg>
      <div className="chart-x">
        {xTicks.map((tk) => (
          <span key={tk}>{tk}</span>
        ))}
      </div>
    </div>
  );
}
