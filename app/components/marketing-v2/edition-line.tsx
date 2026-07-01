'use client';

/**
 * Morgenutgaven <EditionLine/> — §5.5. Redaksjonelt tidsanker:
 * «Tirsdag 1. juli · Utgave 56». Rammer kort historikk som en avis'
 * løpende utgivelse. Brukes i record-seksjonen og dashboard-hodene.
 */

import type { Lang } from '../marketing/types';
import { daysSinceLaunch } from '@/lib/marketing-format';

export function EditionLine({ lang }: { lang: Lang }) {
  const now = new Date();
  // Fast avissone (Europe/Oslo) så server (UTC) og klient alltid formaterer
  // samme kalenderdag — suppressHydrationWarning sitter på de tekstbærende
  // elementene (React undertrykker kun mismatch i elementets EGEN tekst).
  const date = now.toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Oslo',
  });
  const cap = date.charAt(0).toUpperCase() + date.slice(1);
  const edition = lang === 'no' ? 'Utgave' : 'Edition';
  return (
    <span className="aq-edition">
      <em suppressHydrationWarning>{cap}</em>
      <span className="aq-edition-sep" aria-hidden>
        ·
      </span>
      <span className="aq-edition-no" suppressHydrationWarning>
        {edition} {daysSinceLaunch()}
      </span>
    </span>
  );
}
