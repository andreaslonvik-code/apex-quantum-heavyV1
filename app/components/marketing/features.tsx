'use client';

import type { ReactNode } from 'react';
import type { Lang } from './types';

type IconKey = 'chart' | 'stock' | 'ai' | 'speed' | 'graph' | 'withdraw';

const FEAT = {
  no: {
    title: 'Kraftige funksjoner',
    sub: 'Alt du trenger for autonom aksjehandel via Alpaca',
    feats: [
      { ic: 'chart' as const,    em: '🇺🇸', t: 'US Equities',          d: 'Apex Quantum handler aksjer på NASDAQ, NYSE, ARCA og AMEX gjennom Alpaca Trading API.' },
      { ic: 'stock' as const,    em: '📊', t: 'Kun aksjehandel',       d: 'Fokusert på aksjer (equities). Ingen CFD, futures, options eller andre derivater.' },
      { ic: 'ai' as const,       em: '🤖', t: 'Grok-4-Heavy AI',       d: 'Bruker xAI Grok-4-Heavy for markedsanalyse, signaldeteksjon og porteføljoptimalisering.' },
      { ic: 'speed' as const,    em: '⚡', t: 'Automatisk handling',   d: 'Handler hvert 2. sekund med optimaliserte strategier og risikostyring.' },
      { ic: 'graph' as const,    em: '📈', t: 'Porteføljegraf',        d: 'Se porteføljeverdi over tid, avkastning i % og USD, live P&L per posisjon.' },
      { ic: 'withdraw' as const, em: '💰', t: 'Ta ut avkastning',      d: 'Realisér gevinster på ett klikk. Selg posisjoner og sett kontoen tilbake til startkapital.' },
    ],
    secLeft: 'Sikkert og sertifisert',
    secLeftEm: '🛡️',
    secLeftItems: [
      'Per-bruker Alpaca API-nøkler kryptert med AES-256-GCM',
      'Rate-limiting og DDoS-beskyttelse',
      'Strukturert logging for revisjon',
      'Legale ansvarsfraskrivelser inkludert',
    ],
    secRight: 'Åpenhet og kontroll',
    secRightEm: '📊',
    secRightItems: [
      'Live dashboard med porteføljeoversikt',
      'Handelslogg og performance-metrikker',
      'Paper Trading eller Live — du velger via Alpaca-konto',
      'Avkoblingsmulighet når som helst',
    ],
    eyebrow: 'PLATTFORM',
  },
  en: {
    title: 'Powerful features',
    sub: 'Everything you need for autonomous equity trading via Alpaca',
    feats: [
      { ic: 'chart' as const,    em: '🇺🇸', t: 'US Equities',         d: 'Apex Quantum trades stocks on NASDAQ, NYSE, ARCA, and AMEX through the Alpaca Trading API.' },
      { ic: 'stock' as const,    em: '📊', t: 'Equities Only',        d: 'Focused on stocks (equities). No CFD, futures, options or other derivatives.' },
      { ic: 'ai' as const,       em: '🤖', t: 'Grok-4-Heavy AI',      d: 'Uses xAI Grok-4-Heavy for market analysis, signal detection and portfolio optimization.' },
      { ic: 'speed' as const,    em: '⚡', t: 'Autonomous Trading',   d: 'Trades every 2 seconds with optimized strategies and risk management.' },
      { ic: 'graph' as const,    em: '📈', t: 'Portfolio Chart',      d: 'See portfolio value over time, returns in % and USD, live P&L per position.' },
      { ic: 'withdraw' as const, em: '💰', t: 'Withdraw Profits',     d: 'Realize gains with one click. Sell positions and reset to starting capital.' },
    ],
    secLeft: 'Secure & Certified',
    secLeftEm: '🛡️',
    secLeftItems: [
      'Per-user Alpaca API keys encrypted with AES-256-GCM',
      'Rate-limiting and DDoS protection',
      'Structured audit logging',
      'Legal disclaimers included',
    ],
    secRight: 'Transparency & Control',
    secRightEm: '📊',
    secRightItems: [
      'Live dashboard with portfolio overview',
      'Trade log and performance metrics',
      'Paper Trading or Live — you choose via Alpaca',
      'Disconnect anytime',
    ],
    eyebrow: 'PLATFORM',
  },
} as const;

const ICON: Record<IconKey, ReactNode> = {
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17V11" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v10M7 12h10" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.5 6.5 7 1-5.5 5 1.5 7-6.5-3.5-6.5 3.5 1.5-7-5.5-5 7-1 3.5-6.5z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  speed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  graph: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  withdraw: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <path d="M1 10h22" />
    </svg>
  ),
};

export function Features({ lang }: { lang: Lang }) {
  const t = FEAT[lang];
  return (
    <section id="features" className="m-features">
      <div className="m-features-inner">
        <div className="m-section-head">
          <div className="m-eyebrow">
            <span className="m-badge-dot" />
            {t.eyebrow}
          </div>
          <h2 className="m-section-t">{t.title}</h2>
          <p className="m-section-sub">{t.sub}</p>
        </div>
        <div className="m-feat-grid">
          {t.feats.map((f, i) => (
            <div key={i} className="m-feat-card">
              <div className="m-feat-icbox">{ICON[f.ic]}</div>
              <h3 className="m-feat-t">
                <span className="m-feat-em">{f.em}</span>
                {f.t}
              </h3>
              <p className="m-feat-d">{f.d}</p>
            </div>
          ))}
        </div>
        <div id="sikkerhet" className="m-trust-row">
          <div className="m-trust">
            <h3 className="m-trust-t">
              <span className="m-feat-em">{t.secLeftEm}</span>
              {t.secLeft}
            </h3>
            <ul className="m-trust-list">
              {t.secLeftItems.map((it, i) => (
                <li key={i}>
                  <span className="m-tick">✓</span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
          <div className="m-trust">
            <h3 className="m-trust-t">
              <span className="m-feat-em">{t.secRightEm}</span>
              {t.secRight}
            </h3>
            <ul className="m-trust-list">
              {t.secRightItems.map((it, i) => (
                <li key={i}>
                  <span className="m-tick">✓</span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
