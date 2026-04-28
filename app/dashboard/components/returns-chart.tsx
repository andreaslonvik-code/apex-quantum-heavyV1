'use client';

import { useMemo } from 'react';

interface Props {
  /** Array of equity points to render. If empty, generates a placeholder line. */
  points?: number[];
  /** X-axis tick labels matching `ticks` count, evenly spaced. */
  xTicks?: string[];
}

const DEFAULT_TICKS = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'];

export function ReturnsChart({ points, xTicks = DEFAULT_TICKS }: Props) {
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

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const W = 1200;
  const H = 320;
  const pad = 24;
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1)},${H - pad} L${pad},${H - pad} Z`;

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
        <path d={path} stroke="url(#rc-line)" strokeWidth="2" fill="none" />
        <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4" fill="#34D399">
          <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
        {[max, (max + min) / 2, min].map((v, i) => (
          <text
            key={i}
            x={W - pad + 4}
            y={pad + i * ((H - pad * 2) / 2) + 4}
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill="rgba(255,255,255,0.35)"
            textAnchor="start"
          >
            {Math.round(v).toLocaleString('en-US')}
          </text>
        ))}
      </svg>
      <div className="chart-x">
        {xTicks.map((tk) => (
          <span key={tk}>{tk}</span>
        ))}
      </div>
    </div>
  );
}
