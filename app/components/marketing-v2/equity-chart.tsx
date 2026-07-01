'use client';

/**
 * <EquityChart/> — «Revisjonsberetningens» kurve (§8-04 i masterdirektivet).
 * Delt mellom record-seksjonen (landing), /innsyn og dashboards.
 *
 * - X-akse med EKTE datoer: punkt-tidsstempler fra Alpaca-historikken
 *   (timestampsMs) når tilgjengelig; fallback til LAUNCH_DATE_MS-estimat
 * - Drawdown-skygge: arealet mellom løpende maksimum og kurven
 *   (tapene vises like tydelig som gevinstene)
 * - Kurve i var(--aq-gold) — aldri hardkodet hex
 * - Ingen preserveAspectRatio-forvrengning: ResizeObserver måler
 *   containeren og viewBox følger ekte piksler (SSR-default 800×380),
 *   så strøktykkelse og gullprikk holder fasong
 * - Engangs tegneanimasjon ved viewport-entry (hoppes over ved
 *   prefers-reduced-motion; pathLength=1 er størrelses-uavhengig)
 * - Responsiv høyde: 380 → 280 (≤880px) → 220 (≤520px) via CSS
 */

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../marketing/types';
import { LAUNCH_DATE_MS, fmtCompactUsd } from '@/lib/marketing-format';

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtAxisDate(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function EquityChart({
  history,
  lang,
  timestampsMs,
}: {
  history: number[];
  lang: Lang;
  /** Real epoch-ms timestamps parallel to history — from Alpaca portfolio
   *  history. When absent (or mismatched), x-labels fall back to the old
   *  LAUNCH_DATE_MS + index estimate. */
  timestampsMs?: number[];
}) {
  const padTop = 10;
  const padBottom = 26; // plass til x-akse-datoer

  const rootRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  // Ekte containerdimensjoner (funn 15) — SSR-default 800×380.
  const [[cw, ch], setSize] = useState<[number, number]>([800, 380]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize(([pw, ph]) =>
          Math.round(r.width) === pw && Math.round(r.height) === ph
            ? [pw, ph]
            : [Math.round(r.width), Math.round(r.height)],
        );
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const raf = requestAnimationFrame(() => setDrawn(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const w = cw;
  const h = ch;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const innerH = h - padTop - padBottom;
  const sx = (i: number) => (i / Math.max(1, history.length - 1)) * w;
  const sy = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  const pts = history
    .map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`)
    .join(' ');
  const area = `0,${h - padBottom} ${pts} ${w},${h - padBottom}`;

  // Drawdown-skygge: løpende maksimum → kurven (ren derivasjon, ingen
  // let-reassignering under render — react-hooks-regelen)
  const peaks = history.reduce<number[]>((acc, v) => {
    acc.push(acc.length ? Math.max(acc[acc.length - 1], v) : v);
    return acc;
  }, []);
  const peakPts = peaks
    .map((p, i) => `${sx(i).toFixed(1)},${sy(p).toFixed(1)}`)
    .join(' ');
  const ddPolygon = `${peakPts} ${[...history]
    .map((_, ri) => {
      const i = history.length - 1 - ri;
      return `${sx(i).toFixed(1)},${sy(history[i]).toFixed(1)}`;
    })
    .join(' ')}`;

  const yTicks = [max, (min + max) / 2, min];

  // Tre datolabels: start / midt / «I DAG» — ekte punkt-tidsstempler
  // (funn 4+10) når de finnes; ellers gammel LAUNCH_DATE_MS-estimering.
  const lastIdx = history.length - 1;
  const midIdx = Math.floor(lastIdx / 2);
  const hasTs = timestampsMs != null && timestampsMs.length === history.length && history.length > 0;
  const tsAt = (i: number): number =>
    hasTs ? timestampsMs[i] : LAUNCH_DATE_MS + i * DAY_MS;
  const xLabels: Array<{ i: number; text: string }> = [
    { i: 0, text: fmtAxisDate(tsAt(0), lang) },
    { i: midIdx, text: fmtAxisDate(tsAt(midIdx), lang) },
    { i: lastIdx, text: lang === 'no' ? 'I DAG' : 'TODAY' },
  ];

  const last = history[lastIdx];

  return (
    <div ref={rootRef} className="record-chart" data-drawn={drawn || undefined}>
      {yTicks.map((v, i) => (
        <span key={i} className="y-lab" style={{ top: `${(sy(v) / h) * 100}%` }}>
          {fmtCompactUsd(v, lang)}
        </span>
      ))}
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <defs>
          <linearGradient id="rc-apex-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--aq-gold)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--aq-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1="0"
            x2={w}
            y1={padTop + innerH * p}
            y2={padTop + innerH * p}
            stroke="var(--aq-border-soft)"
            strokeDasharray="3 3"
          />
        ))}
        <line
          x1="0"
          x2={w}
          y1={h - padBottom}
          y2={h - padBottom}
          stroke="var(--aq-border)"
        />
        <polygon points={area} fill="url(#rc-apex-fill)" />
        <polygon points={ddPolygon} fill="rgba(165,50,65,0.08)" />
        <polyline
          points={pts}
          fill="none"
          stroke="var(--aq-gold)"
          strokeWidth="2.2"
          pathLength={1}
          className="rc-line"
        />
        <circle
          cx={w}
          cy={sy(last)}
          r="4"
          fill="var(--aq-gold)"
          className="rc-last-dot"
        />
      </svg>
      <div className="rc-x-labels" aria-hidden>
        {xLabels.map((l) => (
          <span
            key={l.i}
            style={{ left: `${(sx(l.i) / w) * 100}%` }}
            data-edge={l.i === 0 ? 'start' : l.i === lastIdx ? 'end' : undefined}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}
