'use client';

/**
 * Statuslinjen <StatusLine/> — §5.6. 32px bunnlinje i dashboards.
 * Kun sanne, målte verdier: modus, datakilde, siste synk + risikolenke.
 */

import Link from 'next/link';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: { mode: 'PAPER TRADING · SIMULERT KAPITAL', data: 'DATA: ALPACA', sync: 'SIST SYNK', risk: 'Risiko →' },
  en: { mode: 'PAPER TRADING · SIMULATED CAPITAL', data: 'DATA: ALPACA', sync: 'LAST SYNC', risk: 'Risk →' },
} satisfies Record<Lang, Record<string, string>>;

export function StatusLine({
  lang,
  lastSync,
  modeOverride,
}: {
  lang: Lang;
  /** «HH:MM:SS» — ekte tidsstempel fra siste datasynk; null → «—» */
  lastSync?: string | null;
  modeOverride?: string;
}) {
  const t = COPY[lang];
  return (
    <div className="aq-statusline">
      <span>{modeOverride ?? t.mode}</span>
      <span className="aq-statusline-mid">{t.data}</span>
      <span className="aq-statusline-right">
        <span suppressHydrationWarning>
          {t.sync} {lastSync ?? '—'}
        </span>
        <Link href="/risikofaktorer">{t.risk}</Link>
      </span>
    </div>
  );
}
