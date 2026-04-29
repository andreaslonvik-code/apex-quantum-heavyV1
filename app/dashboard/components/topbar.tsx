'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';
import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: 'sim' | 'live';
  balance: number;
  accountId: string | null;
  botRunning: boolean;
  /** Disconnects the Alpaca account (does NOT sign the user out of Clerk). */
  onDisconnect: () => void;
  /** Halts all trading (kill switch). */
  onStopAll: () => void;
}

/** Show the first 4 and last 3 chars of the account number, dot-out the rest. */
function maskAccount(id: string): string {
  if (!id || id.length <= 8) return id;
  return `${id.slice(0, 4)}•••••${id.slice(-3)}`;
}

export function Topbar({ lang, setLang, mode, balance, accountId, botRunning, onDisconnect, onStopAll }: Props) {
  const t = I18N[lang];
  return (
    <header className="dbar-v8">
      <div className="dbar-left">
        <div className="aq-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aq-logo.png" alt="" />
        </div>
        <div className="aq-word">
          APEX <span className="grad">QUANTUM</span>
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
          {t.balance}: <b className="aq-mono cy">{fmtMoney(balance, lang)} {moneySuffix(lang)}</b>
        </span>
      </div>
      <div className="dbar-right">
        <span className={`bot-pill ${botRunning ? 'bot-pill-on' : 'bot-pill-off'}`}>
          <span className="bot-pill-dot" />
          {botRunning ? t.botRunning : t.botPaused}
        </span>
        <button type="button" className="stop-all-btn" onClick={onStopAll}>
          {t.stopAll}
        </button>
        <div className="lang-tog">
          <button className={lang === 'no' ? 'is-on' : ''} onClick={() => setLang('no')}>NO</button>
          <button className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
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
