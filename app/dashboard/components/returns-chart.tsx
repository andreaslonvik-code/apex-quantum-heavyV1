'use client';

import { useMemo } from 'react';

interface Props {
  /** Equity values over time. If empty, renders a placeholder line. */
  points?: number[];
  /** S&P 500 benchmark series, same length / sampling cadence as `points`. */
  benchPoints?: number[];
  xTicks?: string[];
  /** When set, draws a peak label on the chart at the value's index. */
  peakIndex?: number;
}

const DEFAULT_TICKS = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'];

export function ReturnsChart({ points, benchPoints, xTicks = DEFAULT_TICKS, peakIndex }: Props) {
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

  // Normalise the benchmark to start at the same value as the portfolio so
  // the visual overlay tracks relative performance, not absolute price.
  const bench = useMemo(() => {
    if (!benchPoints || benchPoints.length < 2 || pts.length < 2) return null;
    const baseB = benchPoints[0];
    const baseP = pts[0];
    if (baseB <= 0 || baseP <= 0) return null;
    const scaled: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const idx = Math.min(benchPoints.length - 1, Math.floor((i / (pts.length - 1)) * (benchPoints.length - 1)));
      scaled.push(baseP * (benchPoints[idx] / baseB));
    }
    return scaled;
  }, [benchPoints, pts]);

  const W = 1200;
  const H = 320;
  const pad = 24;

  const allValues: number[] = [...pts, ...(bench ?? [])];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1)},${H - pad} L${pad},${H - pad} Z`;
  const benchPath = bench
    ? bench.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
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
        {benchPath && (
          <path d={benchPath} stroke="rgba(255,255,255,0.32)" strokeWidth="1.4" fill="none" strokeDasharray="4 5" />
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
        {benchPath && bench && (
          <text
            x={x(bench.length - 1) + 4}
            y={y(bench[bench.length - 1]) + 4}
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill="rgba(255,255,255,0.5)"
            textAnchor="start"
          >
            S&amp;P 500
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
