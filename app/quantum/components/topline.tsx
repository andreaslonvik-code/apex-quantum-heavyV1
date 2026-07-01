'use client';

/**
 * Topplinjen (§10) — 56px. Fraunces-ordmerke + MAX-tag, Oslo-klokke
 * (sekundene ER liv-indikatoren, ingen pulserende dot), ekte
 * NASDAQ-åpningstidsstatus, PAPER/LIVE-badge fra faktisk kontomiljø,
 * ekte Alpaca-tilkoblingsstatus og Clerk-brukermeny.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import type { Lang } from '@/app/components/marketing/types';
import { COCKPIT_COPY } from '../lib/copy';
import { isNasdaqOpen } from '../lib/market-hours';

const OSLO_FMT = new Intl.DateTimeFormat('no-NO', {
  timeZone: 'Europe/Oslo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

export function Topline({
  lang,
  connected,
  environment,
}: {
  lang: Lang;
  /** null = ukjent (laster) */
  connected: boolean | null;
  environment: 'paper' | 'live';
}) {
  const t = COCKPIT_COPY[lang];
  const [clock, setClock] = useState('');
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(OSLO_FMT.format(now).replace(',', ''));
      setMarketOpen(isNasdaqOpen(now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="aq-ck-top">
      <div className="aq-ck-top-left">
        <Link href="/" className="aq-ck-brand">
          Apex <em>Quantum</em>
        </Link>
        <span className="aq-ck-maxtag">Max</span>
      </div>

      <span className="aq-ck-clock" suppressHydrationWarning>
        {clock || '—'}
      </span>

      <div className="aq-ck-top-right">
        <span className="aq-ck-stat" suppressHydrationWarning>
          <span
            className="aq-ck-dot"
            data-tone={marketOpen ? 'up' : undefined}
            aria-hidden
          />
          <span className="aq-ck-stat-label">
            {marketOpen == null ? '—' : marketOpen ? t.marketOpen : t.marketClosed}
          </span>
        </span>

        <span className="aq-ck-badge" data-env={environment === 'live' ? 'live' : undefined}>
          {environment === 'live' ? 'LIVE' : 'PAPER'}
        </span>

        <span className="aq-ck-stat">
          <span
            className="aq-ck-dot"
            data-tone={connected ? 'live' : undefined}
            aria-hidden
          />
          {connected == null ? (
            <span className="aq-ck-stat-label">—</span>
          ) : connected ? (
            <span className="aq-ck-stat-label">{t.alpacaConnected}</span>
          ) : (
            <Link href="/connect-alpaca">{t.connectCta}</Link>
          )}
        </span>

        <SignedIn>
          <UserButton
            appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }}
            afterSignOutUrl="/"
          />
        </SignedIn>
        <SignedOut>
          <Link href="/sign-in" className="aq-ck-signin">
            {t.signIn}
          </Link>
        </SignedOut>
      </div>
    </header>
  );
}
