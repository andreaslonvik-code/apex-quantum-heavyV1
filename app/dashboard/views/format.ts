/**
 * Lokal tallformatering for Plus-dashboardet (§13.12).
 * Prosentverdier vises ALLTID med ekte U+2212-minus («−», aldri
 * ASCII-bindestrek) og desimaltegn etter språk: no/de/es bruker
 * komma, en/zh bruker punktum. tabular-nums håndteres i CSS.
 */

import type { PlusLang } from '@/lib/i18n/plus-lang';

const COMMA_DECIMAL_LANGS: ReadonlySet<PlusLang> = new Set(['no', 'de', 'es']);

/**
 * Formater et prosenttall (allerede i prosent, f.eks. -4.2 → «−4,2%»).
 * Positive verdier får «+», negative U+2212. null/NaN → «—».
 */
export function fmtPctPlus(
  v: number | null | undefined,
  lang: PlusLang,
  decimals = 2,
): string {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v < 0 ? '−' : '+';
  let abs = Math.abs(v).toFixed(decimals);
  if (COMMA_DECIMAL_LANGS.has(lang)) abs = abs.replace('.', ',');
  return `${sign}${abs}%`;
}
