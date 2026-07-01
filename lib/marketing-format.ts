/**
 * Delte formateringshjelpere for alle tall-visninger.
 * Flyttet fra hero.tsx/record.tsx (identisk oppførsel) — én kilde.
 * Norm: minus er alltid U+2212 («−»), aldri bindestrek.
 */

import type { Lang } from '@/app/components/marketing/types';

/** Paper trading-oppstart. Endres KUN ved reell re-lansering. */
export const LAUNCH_DATE_MS = Date.UTC(2026, 4, 6); // month is 0-indexed → 4 = May

/** Hele dager siden oppstart; minimum 1 så copy aldri viser «0 dager». */
export function daysSinceLaunch(): number {
  const days = Math.floor((Date.now() - LAUNCH_DATE_MS) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

export function fmtPct(v: number | null, lang: Lang): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '−';
  const abs = Math.abs(v).toFixed(1).replace('.', lang === 'no' ? ',' : '.');
  return `${sign}${abs} %`;
}

export function fmtUsd(v: number | null, lang: Lang): string {
  if (v == null || v <= 0) return '—';
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m.toFixed(2).replace('.', lang === 'no' ? ',' : '.')}M`;
  }
  return `$${Math.round(v).toLocaleString(lang === 'no' ? 'nb-NO' : 'en-US')}`;
}

export function fmtCompactUsd(v: number, lang: Lang): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2).replace('.', lang === 'no' ? ',' : '.')}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

/** «HH:MM UTC» fra ISO-tidsstempel — brukes i Kildenoten og panel-føtter. */
export function fmtSyncTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}
