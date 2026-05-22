'use client';

import { useMemo } from 'react';

export type ChartMode = 'return' | 'index';

interface Props {
  /** APEX portfolio equity values over time. */
  points?: number[];
  /** Real S&P 500 (^GSPC) index level, aligned to the equity timestamps. */
  sp500Points?: number[];
  /** Real NASDAQ Composite (^IXIC) index level, aligned to equity timestamps. */
  nasdaqPoints?: number[];
  xTicks?: string[];
  /** When set, draws a peak label at this index (return mode only). */
  peakIndex?: number;
  /**
   * 'return' — APEX portfolio alone (area chart). "How is my money doing."
   * 'index'  — APEX vs S&P 500 vs NASDAQ Composite, each plotted at its real
   *            level on its own scale. "Me versus the market."
   */
  mode?: ChartMode;
}

const DEFAULT_TICKS = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'];

const W = 1200;
const H = 320;
const PAD = 24;

/**
 * Build a y-mapper for one series, scaled independently to the chart height.
 * Index mode plots three series of wildly different magnitude (portfolio in
 * USD millions, indices in points) — each gets its own scale so its shape is
 * readable; the real value is shown in the end-label.
 */
function scalerFor(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
}

export function ReturnsChart({
  points,
  sp500Points,
  nasdaqPoints,
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
  const n = pts.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const linePath = (values: number[], y: (v: number) => number) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // ── RETURN MODE — APEX portfolio alone ────────────────────────────────
  const apexY = useMemo(() => scalerFor(pts), [pts]);
  const apexPath = linePath(pts, apexY);
  const apexArea = `${apexPath} L${x(n - 1)},${H - PAD} L${PAD},${H - PAD} Z`;

  const pi = !isIndex
    ? typeof peakIndex === 'number'
      ? peakIndex
      : pts.indexOf(Math.max(...pts))
    : -1;

  // ── INDEX MODE — APEX vs S&P 500 vs NASDAQ Composite, real levels ──────
  // Each benchmark is only drawn when its aligned series matches the equity
  // length (the API aligns them by timestamp; a Yahoo miss yields an empty
  // series → that line is simply omitted rather than drawn wrong).
  const sp500 = isIndex && sp500Points && sp500Points.length === n ? sp500Points : null;
  const nasdaq = isIndex && nasdaqPoints && nasdaqPoints.length === n ? nasdaqPoints : null;

  const indexLines = useMemo(() => {
    if (!isIndex) return [];
    const out: Array<{
      key: string;
      label: string;
      color: string;
      path: string;
      endY: number;
      endValue: string;
    }> = [];
    const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
    const add = (
      key: string,
      label: string,
      color: string,
      data: number[] | null,
      prefix: string,
    ) => {
      if (!data) return;
      const y = scalerFor(data);
      out.push({
        key,
        label,
        color,
        path: linePath(data, y),
        endY: y(data[n - 1]),
        endValue: `${prefix}${fmt(data[n - 1])}`,
      });
    };
    add('apex', 'APEX QUANTUM', '#34D399', pts, '$');
    add('sp', 'S&P 500', 'rgba(255,255,255,0.82)', sp500, '');
    add('nd', 'NASDAQ', 'rgba(96,165,250,0.95)', nasdaq, '');
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIndex, pts, sp500, nasdaq, n]);

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
            x1={PAD}
            x2={W - PAD}
            y1={PAD + p * (H - PAD * 2)}
            y2={PAD + p * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="2 4"
          />
        ))}

        {!isIndex && (
          <>
            <path d={apexArea} fill="url(#rc-grn)" />
            <path d={apexPath} stroke="url(#rc-line)" strokeWidth="2" fill="none" />
            <circle cx={x(n - 1)} cy={apexY(pts[n - 1])} r="4" fill="#34D399">
              <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
            {pi >= 0 && pi !== n - 1 && (
              <g>
                <circle cx={x(pi)} cy={apexY(pts[pi])} r="4" fill="rgba(255,255,255,0.85)" />
                <text
                  x={x(pi)}
                  y={apexY(pts[pi]) - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="JetBrains Mono"
                  fill="rgba(255,255,255,0.7)"
                >
                  Topp {pts[pi].toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </text>
              </g>
            )}
          </>
        )}

        {isIndex &&
          indexLines.map((ln) => (
            <path
              key={ln.key}
              d={ln.path}
              stroke={ln.color}
              strokeWidth={ln.key === 'apex' ? 2.2 : 1.8}
              fill="none"
            />
          ))}
        {isIndex &&
          indexLines.map((ln) => (
            <text
              key={`${ln.key}-lbl`}
              x={x(n - 1) + 5}
              y={ln.endY + 3}
              fontSize="10"
              fontFamily="JetBrains Mono"
              fill={ln.color}
              textAnchor="start"
            >
              {ln.label} {ln.endValue}
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
