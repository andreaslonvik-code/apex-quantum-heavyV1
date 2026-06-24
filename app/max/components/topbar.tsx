'use client';

import Link from 'next/link';
import { SignOutButton, UserButton } from '@clerk/nextjs';
import { I18N, formatMoney, type Currency, type Lang } from './i18n';

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: 'sim' | 'live';
  /** Portfolio total in USD (Alpaca's native ledger). Topbar converts at render. */
  balance: number;
  accountId: string | null;
  botRunning: boolean;
  /** Display currency preference — affects how `balance` is rendered. */
  displayCurrency: Currency;
  /** USD→NOK rate. null = unknown, falls back to USD display. */
  fxRate: number | null;
  /** Toggle the display currency. */
  setDisplayCurrency: (c: Currency) => void;
  /** Disconnects the Alpaca account (does NOT sign the user out of Clerk).
   *  This is the ONLY real stop control — removing the connection takes the
   *  account out of the trading loop. (The old "halt" button was cosmetic:
   *  it never reached the server, so it was removed.) */
  onDisconnect: () => void;
}

/** Show the first 4 and last 3 chars of the account number, dot-out the rest. */
function maskAccount(id: string): string {
  if (!id || id.length <= 8) return id;
  return `${id.slice(0, 4)}•••••${id.slice(-3)}`;
}

export function Topbar({
  lang,
  setLang,
  mode,
  balance,
  accountId,
  botRunning,
  displayCurrency,
  fxRate,
  setDisplayCurrency,
  onDisconnect,
}: Props) {
  const t = I18N[lang];
  return (
    <header className="dbar-v8">
      <div className="dbar-left">
        <div className="aq-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aq-logo.png" alt="" />
        </div>
        <div className="aq-word v2-brand-wm">
          <span className="v2-apex">Apex</span> <span className="v2-quantum">Quantum</span>
          <span className="v2-max-tag">Max</span>
        </div>
        <div className="mode-toggle-v8">
          <span className={`mode-opt-v8 ${mode === 'sim' ? 'is-active' : ''}`}>
            <span className="mode-dot-v8 mode-dot-sim" />
            {t.sim}
          </span>
          <span className={`mode-opt-v8 ${mode === 'live' ? 'is-active' : ''}`}>
            <span className="mode-dot-v8 mode-dot-live-v8" />
            {t.liveShort}
          </span>
        </div>
        {accountId && (
          <span className="dbar-meta" title={accountId}>
            <b className="aq-mono">{maskAccount(accountId)}</b>
          </span>
        )}
        <span className="dbar-meta">
          {t.balance}: <b className="aq-mono cy">{formatMoney(balance, displayCurrency, fxRate, { decimals: 2 })}</b>
        </span>
      </div>
      <div className="dbar-right">
        <span className={`bot-pill ${botRunning ? 'bot-pill-on' : 'bot-pill-off'}`}>
          <span className="bot-pill-dot" />
          {botRunning ? t.botRunning : t.botPaused}
        </span>
        <div
          className="lang-tog ccy-tog"
          title={lang === 'no'
            ? 'Visningsvaluta · Alpaca handler alltid i USD'
            : 'Display currency · Alpaca always trades in USD'}
        >
          <button
            type="button"
            className={displayCurrency === 'USD' ? 'is-on' : ''}
            onClick={() => setDisplayCurrency('USD')}
            aria-label="Show amounts in USD"
          >
            $
          </button>
          <button
            type="button"
            className={displayCurrency === 'NOK' ? 'is-on' : ''}
            onClick={() => setDisplayCurrency('NOK')}
            aria-label="Show amounts in NOK"
          >
            kr
          </button>
        </div>
        <div className="lang-tog">
          <button className={lang === 'no' ? 'is-on' : ''} onClick={() => setLang('no')}>NO</button>
          <button className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        <Link
          href="/"
          className="btn-ghost-sm"
          title={lang === 'no' ? 'Tilbake til forsiden' : 'Back to homepage'}
        >
          {lang === 'no' ? 'Forside' : 'Homepage'}
        </Link>
        <button className="btn-ghost-sm" onClick={onDisconnect} title={lang === 'no' ? 'Koble Alpaca-kontoen fra' : 'Disconnect Alpaca account'}>
          {t.disconnect}
        </button>
        <SignOutButton redirectUrl="/">
          <button type="button" className="btn-ghost-sm" title={lang === 'no' ? 'Logg ut av Apex Quantum' : 'Sign out of Apex Quantum'}>
            {lang === 'no' ? 'Logg ut' : 'Sign out'}
          </button>
        </SignOutButton>
        <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} afterSignOutUrl="/" />
      </div>
    </header>
  );
}
