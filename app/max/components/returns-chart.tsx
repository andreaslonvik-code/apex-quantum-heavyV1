'use client';

import { useMemo } from 'react';

interface Props {
  /** APEX portfolio equity values over time (real USD). */
  points?: number[];
  /** Real S&P 500 (^GSPC) index level, aligned to the equity timestamps. */
  sp500Points?: number[];
  /** Real NASDAQ Composite (^IXIC) index level, aligned to equity timestamps. */
  nasdaqPoints?: number[];
  xTicks?: string[];
}

const DEFAULT_TICKS = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'];

const W = 1200;
const H = 320;
const PAD = 24;

/**
 * Build a y-mapper for one series, scaled independently to the chart height.
 * The three plotted series (portfolio in USD millions, indices in points) are
 * on wildly different magnitudes — each gets its own scale so its shape is
 * readable; the real value at each line's end is shown in the label.
 */
function scalerFor(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
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
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const linePath = (values: number[], y: (v: number) => number) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // Benchmarks drawn only when the aligned series matches the equity length
  // (the API aligns by timestamp; a Yahoo miss yields an empty series →
  // that line is simply omitted rather than rendered wrong).
  const sp500 = sp500Points && sp500Points.length === n ? sp500Points : null;
  const nasdaq = nasdaqPoints && nasdaqPoints.length === n ? nasdaqPoints : null;

  const indexLines = useMemo(() => {
    const out: Array<{
      key: string;
      label: string;
      color: string;
      strokeWidth: number;
      path: string;
      endY: number;
      endValue: string;
    }> = [];
    const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
    const add = (
      key: string,
      label: string,
      color: string,
      strokeWidth: number,
      data: number[] | null,
      prefix: string,
    ) => {
      if (!data) return;
      const y = scalerFor(data);
      out.push({
        key,
        label,
        color,
        strokeWidth,
        path: linePath(data, y),
        endY: y(data[n - 1]),
        endValue: `${prefix}${fmt(data[n - 1])}`,
      });
    };
    add('apex', 'APEX QUANTUM', '#34D399', 2.2, pts, '$');
    add('sp', 'S&P 500', 'rgba(255,255,255,0.82)', 1.6, sp500, '');
    add('nd', 'NASDAQ', 'rgba(96,165,250,0.95)', 1.6, nasdaq, '');
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, sp500, nasdaq, n]);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
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
        {indexLines.map((ln) => (
          <path
            key={ln.key}
            d={ln.path}
            stroke={ln.color}
            strokeWidth={ln.strokeWidth}
            fill="none"
          />
        ))}
        {indexLines.map((ln) => (
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
