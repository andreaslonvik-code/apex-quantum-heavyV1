'use client';

import { useMemo } from 'react';

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

export function ReturnsChart({
  points,
  spyPoints,
  qqqPoints,
  xTicks = DEFAULT_TICKS,
  peakIndex,
}: Props) {
  const pts = useMemo(() => {
    if (points && points.length > 1) return points;
    const out: number[] = [];
    let v = 1_000_000;
    for (let i = 0; i < 120; i++) {
      v += (Math.sin(i / 9) + 0.6) * 450 + (Math.random() - 0.45) * 900;
      out.push(v);
    }
    return out;
  }, [points]);

  const spy = useMemo(() => rebaseToPortfolio(spyPoints, pts), [spyPoints, pts]);
  const qqq = useMemo(() => rebaseToPortfolio(qqqPoints, pts), [qqqPoints, pts]);

  const W = 1200;
  const H = 320;
  const pad = 24;

  const allValues: number[] = [...pts, ...(spy ?? []), ...(qqq ?? [])];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1)},${H - pad} L${pad},${H - pad} Z`;
  const spyPath = spy
    ? spy.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    : null;
  const qqqPath = qqq
    ? qqq.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    : null;

  // Peak marker.
  const pi = typeof peakIndex === 'number' ? peakIndex : pts.indexOf(Math.max(...pts));
  const peakX = pi >= 0 ? x(pi) : null;
  const peakY = pi >= 0 ? y(pts[pi]) : null;
  const peakValue = pi >= 0 ? pts[pi] : null;

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
        <path d={area} fill="url(#rc-grn)" />
        {spyPath && (
          <path
            d={spyPath}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.4"
            fill="none"
            strokeDasharray="4 5"
          />
        )}
        {qqqPath && (
          <path
            d={qqqPath}
            stroke="rgba(96,165,250,0.55)"
            strokeWidth="1.4"
            fill="none"
            strokeDasharray="2 3"
          />
        )}
        <path d={path} stroke="url(#rc-line)" strokeWidth="2" fill="none" />
        <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4" fill="#34D399">
          <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite" />
        </circle>

        {peakX !== null && peakY !== null && peakValue !== null && pi !== pts.length - 1 && (
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
        {spyPath && spy && (
          <text
            x={x(spy.length - 1) + 4}
            y={y(spy[spy.length - 1]) + 4}
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill="rgba(255,255,255,0.6)"
            textAnchor="start"
          >
            S&amp;P 500
          </text>
        )}
        {qqqPath && qqq && (
          <text
            x={x(qqq.length - 1) + 4}
            y={y(qqq[qqq.length - 1]) - 8}
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
