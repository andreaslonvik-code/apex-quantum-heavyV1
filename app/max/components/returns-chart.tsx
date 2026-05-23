'use client';

import { useMemo } from 'react';

interface Props {
  /** APEX portfolio equity values over time (real USD). */
  points?: number[];
  /** Real S&P 500 (^GSPC) level, aligned to the equity timestamps. */
  sp500Points?: number[];
  /** Real NASDAQ Composite (^IXIC) level, aligned to equity timestamps. */
  nasdaqPoints?: number[];
  xTicks?: string[];
}

const DEFAULT_TICKS = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'];

const W = 1200;
const H = 320;
const PAD_L = 24;
const PAD_R = 56; // room for the right-side percentage axis (Nordnet-style)
const PAD_TB = 24;

/**
 * Re-base a series to percentage return from its first point. All three
 * series share a single % scale on the chart — Nordnet's default view.
 */
function toPctReturn(values: number[]): number[] {
  if (values.length === 0) return [];
  const base = values[0];
  if (!Number.isFinite(base) || base <= 0) return values.map(() => 0);
  return values.map((v) => (v / base - 1) * 100);
}

export function ReturnsChart({ points, sp500Points, nasdaqPoints, xTicks = DEFAULT_TICKS }: Props) {
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

  const n = pts.length;

  const apexPct = useMemo(() => toPctReturn(pts), [pts]);
  const sp500Pct = useMemo(
    () => (sp500Points && sp500Points.length === n ? toPctReturn(sp500Points) : null),
    [sp500Points, n],
  );
  const nasdaqPct = useMemo(
    () => (nasdaqPoints && nasdaqPoints.length === n ? toPctReturn(nasdaqPoints) : null),
    [nasdaqPoints, n],
  );

  // Y-axis: percentage scale shared by all three series. Always include 0 %
  // so break-even is in view; pad by 5 % of the range so the lines aren't
  // clipped against the chart edges (matches Nordnet's breathing room).
  const allValues = [
    ...apexPct,
    ...(sp500Pct ?? []),
    ...(nasdaqPct ?? []),
    0,
  ];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = Math.max(0.5, rawMax - rawMin);
  const yMin = rawMin - range * 0.05;
  const yMax = rawMax + range * 0.05;
  const yRange = yMax - yMin || 1;

  const x = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_TB + (1 - (v - yMin) / yRange) * (H - PAD_TB * 2);

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const apexPath = linePath(apexPct);
  const apexArea = `${apexPath} L${x(n - 1)},${H - PAD_TB} L${PAD_L},${H - PAD_TB} Z`;
  const sp500Path = sp500Pct ? linePath(sp500Pct) : null;
  const nasdaqPath = nasdaqPct ? linePath(nasdaqPct) : null;

  // Five y-axis tick values from top (yMax) down to bottom (yMin). Format
  // depends on the range — small ranges show 2 decimals so subtle moves
  // are still labelled meaningfully.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ p, val: yMax - p * yRange }));
  const tickDecimals = yRange < 5 ? 1 : 0;
  const fmtPct = (v: number) =>
    `${v >= 0 ? '+' : ''}${v.toFixed(tickDecimals)} %`;

  // Zero reference line — slightly brighter than the regular gridlines.
  const zeroVisible = yMin <= 0 && 0 <= yMax;
  const zeroY = zeroVisible ? y(0) : null;

  const apexEnd = apexPct[n - 1];

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

        {/* Horizontal gridlines */}
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

        {/* Zero reference line — a touch brighter so break-even is visible */}
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

        {/* APEX portfolio — prominent area + line */}
        <path d={apexArea} fill="url(#rc-grn)" />
        <path d={apexPath} stroke="url(#rc-line)" strokeWidth="2" fill="none" />

        {/* S&P 500 — dashed, discrete overlay */}
        {sp500Path && (
          <path
            d={sp500Path}
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="3 4"
          />
        )}

        {/* NASDAQ Composite — dashed, discrete overlay */}
        {nasdaqPath && (
          <path
            d={nasdaqPath}
            stroke="rgba(96,165,250,0.45)"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="2 3"
          />
        )}

        {/* Pulsing end-marker on APEX */}
        <circle cx={x(n - 1)} cy={y(apexEnd)} r="4" fill="#34D399">
          <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite" />
        </circle>

        {/* Right-side percentage axis (Nordnet-style) */}
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

        {/* Small end-labels for the dashed lines so it's clear which is which */}
        {sp500Pct && (
          <text
            x={x(n - 1) + 4}
            y={y(sp500Pct[n - 1]) - 3}
            fontSize="9"
            fontFamily="JetBrains Mono"
            fill="rgba(255,255,255,0.55)"
            textAnchor="start"
          >
            S&amp;P
          </text>
        )}
        {nasdaqPct && (
          <text
            x={x(n - 1) + 4}
            y={y(nasdaqPct[n - 1]) - 3}
            fontSize="9"
            fontFamily="JetBrains Mono"
            fill="rgba(96,165,250,0.6)"
            textAnchor="start"
          >
            NASDAQ
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
