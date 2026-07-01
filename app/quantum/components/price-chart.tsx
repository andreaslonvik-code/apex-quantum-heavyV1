'use client';

/**
 * Hovedflatens graf (§10): porteføljens EKTE utvikling fra
 * /api/apex/performance — omtegnet i editorial grafspråk. Gullkurve
 * 2.2px, slate-grid, mono-akser med datoer, drawdown-skravering,
 * cyan crosshair med 0ms transition og mono-tooltip i ink-deep.
 *
 * Den gamle Math.random-genererte kursserien (fiktive priser for
 * hardkodede tickere) er fjernet — §13.2 forbyr udokumenterte tall.
 * Ingen entry-animasjon: investoren ser tallene umiddelbart (§11).
 */

import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Lang } from '@/app/components/marketing/types';
import { fmtCompactUsd } from '@/lib/marketing-format';
import { COCKPIT_COPY } from '../lib/copy';
import type { CockpitPerformance, CockpitTf } from '../lib/types';

const TFS: CockpitTf[] = ['1H', '24H', '7D', '30D', 'YTD', 'ALL'];

interface Row {
  label: string;
  value: number;
  /** [kurve, løpende maksimum] → drawdown-bånd */
  dd: [number, number];
}

function tsLabel(unixSec: number, spanDays: number, lang: Lang): string {
  const d = new Date(unixSec * 1000);
  if (spanDays <= 2) {
    return d.toLocaleTimeString(lang === 'no' ? 'nb-NO' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  lang,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | number[]; dataKey?: string }>;
  label?: string;
  lang: Lang;
}) {
  if (!active || !payload?.length) return null;
  const v = payload.find((p) => p.dataKey === 'value')?.value;
  if (typeof v !== 'number') return null;
  return (
    <div
      style={{
        background: 'var(--aq-ink-deep)',
        border: '1px solid var(--aq-border)',
        borderRadius: 4,
        padding: '8px 10px',
        fontFamily: 'var(--aq-font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'var(--aq-text-mid)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ color: 'var(--aq-faint)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--aq-text)' }}>
        ${v.toLocaleString(lang === 'no' ? 'nb-NO' : 'en-US', { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}

export function PriceChart({
  lang,
  connected,
  performance,
  tf,
  onTf,
}: {
  lang: Lang;
  connected: boolean | null;
  performance: CockpitPerformance | null;
  tf: CockpitTf;
  onTf: (tf: CockpitTf) => void;
}) {
  const t = COCKPIT_COPY[lang];

  const rows: Row[] = useMemo(() => {
    const data = performance?.chartData ?? [];
    if (data.length < 2) return [];
    const first = data[0]?.timestamp ?? 0;
    const last = data[data.length - 1]?.timestamp ?? 0;
    const spanDays = Math.max(0, (last - first) / 86400);
    let peak = -Infinity;
    return data.map((d, i) => {
      peak = Math.max(peak, d.value);
      return {
        label: d.timestamp ? tsLabel(d.timestamp, spanDays, lang) : String(i),
        value: d.value,
        dd: [d.value, peak] as [number, number],
      };
    });
  }, [performance, lang]);

  return (
    <section className="aq-panel" aria-label={t.chartTitle}>
      <div className="aq-panel-head">
        <span>{t.chartTitle}</span>
        <div className="aq-ck-chart-tabs" role="tablist" aria-label="Tidsvindu">
          {TFS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tf === k}
              data-on={tf === k || undefined}
              onClick={() => onTf(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {connected === false ? (
        <div className="aq-hatch aq-ck-hatch-fill">{t.noAccount}</div>
      ) : rows.length === 0 ? (
        <div className="aq-hatch aq-ck-hatch-fill">
          {performance == null ? t.dataUnavailable : t.chartEmpty}
        </div>
      ) : (
        <div className="aq-ck-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                stroke="var(--aq-slate)"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={{ stroke: 'var(--aq-border)' }}
                tickLine={false}
                tick={{
                  fill: 'var(--aq-faint)',
                  fontSize: 10,
                  fontFamily: 'var(--aq-font-mono)',
                }}
                interval="preserveStartEnd"
                minTickGap={48}
              />
              <YAxis
                domain={['dataMin', 'dataMax']}
                axisLine={false}
                tickLine={false}
                width={54}
                tick={{
                  fill: 'var(--aq-faint)',
                  fontSize: 10,
                  fontFamily: 'var(--aq-font-mono)',
                }}
                tickFormatter={(v: number) => fmtCompactUsd(v, lang)}
              />
              <Tooltip
                content={<ChartTooltip lang={lang} />}
                isAnimationActive={false}
                cursor={{ stroke: 'var(--aq-cyan)', strokeWidth: 1 }}
              />
              {/* Drawdown-skravering: løpende maksimum → kurven */}
              <Area
                dataKey="dd"
                stroke="none"
                fill="var(--aq-down)"
                fillOpacity={0.08}
                isAnimationActive={false}
                activeDot={false}
              />
              <Line
                dataKey="value"
                type="linear"
                stroke="var(--aq-gold)"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
                activeDot={{
                  r: 3,
                  fill: 'var(--aq-gold)',
                  stroke: 'var(--aq-ink-deep)',
                  strokeWidth: 1,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
