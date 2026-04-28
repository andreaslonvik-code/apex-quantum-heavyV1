'use client';

import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: 'sim' | 'live';
  balance: number;
  accountId: string | null;
  onDisconnect: () => void;
}

export function Topbar({ lang, setLang, mode, balance, accountId, onDisconnect }: Props) {
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
        <span className="tag tag-live">
          <span className="dot" />
          {mode === 'live' ? t.live : t.paper}
        </span>
        <span className="dbar-meta">
          {t.markets}: <b>US</b>
        </span>
        {accountId && (
          <span className="dbar-meta">
            {t.account}: <b className="aq-mono">{accountId}</b>
          </span>
        )}
        <span className="dbar-meta">
          {t.balance}: <b className="aq-mono cy">{fmtMoney(balance, lang)} {moneySuffix(lang)}</b>
        </span>
      </div>
      <div className="dbar-right">
        <div className="lang-tog">
          <button className={lang === 'no' ? 'is-on' : ''} onClick={() => setLang('no')}>NO</button>
          <button className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>EN</button>
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
        <button className="btn-ghost-sm" onClick={onDisconnect}>
          {t.disconnect}
        </button>
      </div>
    </header>
  );
}
