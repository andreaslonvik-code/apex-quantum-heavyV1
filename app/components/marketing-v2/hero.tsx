'use client';

import Link from 'next/link';
import type { Lang } from '../marketing/types';
import type { MarketingStats } from '@/lib/marketing-stats';
import { daysSinceLaunch, fmtPct, fmtUsd, fmtSyncTime } from '@/lib/marketing-format';
import { SourceNote } from './source-note';
import { PaperTag } from './paper-tag';
import { ArrowRight } from './icons';

const HERO_COPY: Record<Lang, {
  eye: string;
  titleA: string;
  titleB: string;
  titleEm: string;
  titleC: string;
  desc: string;
  ctaPrimary: string;
  ctaSecondary: string;
  panelTitle: string;
  panelSync: string;
  panelExchanges: string;
  panelEmpty: string;
  panelOffline: string;
  panelMore: (n: number) => string;
  /** Tail of the return KPI label — prefixed with the live day-count.
   *  E.g. "20 dager siden oppstart · paper". */
  kpiYtdSuffix: string;
  kpiErr: string;
  kpiCapital: string;
  kpiPositions: string;
}> = {
  no: {
    eye: 'Apex Quantum · AI-drevet aksjeinnsikt',
    titleA: 'Lær markedet',
    titleB: 'eller la ',
    titleEm: 'KI-motoren',
    titleC: ' ta over.',
    desc: 'Apex Quantum + gir deg daglige AI-signaler med fullstendig begrunnelse, ukentlige rapporter og strukturert læring fra 199 kr/mnd. Apex Quantum Max — den autonome trading-motoren via Alpaca — lanseres i 2026.',
    ctaPrimary: 'Start med Apex Quantum +',
    ctaSecondary: 'Se produktene',
    panelTitle: 'Live posisjoner · paper trading',
    panelSync: 'SYNK',
    panelExchanges: 'NASDAQ · NYSE · ARCA',
    panelEmpty: 'Ingen åpne posisjoner akkurat nå.',
    panelOffline: 'FRAKOBLET',
    panelMore: (n) => `+${n} flere posisjoner →`,
    kpiYtdSuffix: 'dager siden oppstart · paper',
    kpiErr: 'LIVE-DATA UTILGJENGELIG · PRØVER IGJEN',
    kpiCapital: 'Forvaltet kapital',
    kpiPositions: 'Aktive posisjoner',
  },
  en: {
    eye: 'Apex Quantum · AI-powered market insight',
    titleA: 'Learn the market',
    titleB: 'or let the ',
    titleEm: 'AI engine',
    titleC: ' take over.',
    desc: 'Apex Quantum + gives you daily AI signals with full reasoning, weekly reports and structured learning from $19/month. Apex Quantum Max — the autonomous trading engine via Alpaca — launches in 2026.',
    ctaPrimary: 'Start with Apex Quantum +',
    ctaSecondary: 'See the products',
    panelTitle: 'Live positions · paper trading',
    panelSync: 'SYNC',
    panelExchanges: 'NASDAQ · NYSE · ARCA',
    panelEmpty: 'No open positions right now.',
    panelOffline: 'OFFLINE',
    panelMore: (n) => `+${n} more positions →`,
    kpiYtdSuffix: 'days since launch · paper',
    kpiErr: 'LIVE DATA UNAVAILABLE · RETRYING',
    kpiCapital: 'Capital under model',
    kpiPositions: 'Active positions',
  },
};

export function HeroV2({ lang, stats }: { lang: Lang; stats: MarketingStats }) {
  const t = HERO_COPY[lang];
  const ytdUp = (stats.ytdReturnPct ?? 0) >= 0;
  const hiddenPositions = Math.max(0, (stats.positionsHeld ?? 0) - stats.positions.length);
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div className="hero-left">
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <h1 className="hero-display">
              {t.titleA}<br />
              {t.titleB}<em>{t.titleEm}</em>{t.titleC}
            </h1>
            <p className="hero-desc">{t.desc}</p>
            <div className="hero-ctas">
              <Link href="/sign-up" className="btn btn-gold btn-lg">
                {t.ctaPrimary} <ArrowRight size={16} />
              </Link>
              <a href="#products" className="btn btn-ghost btn-lg">{t.ctaSecondary}</a>
            </div>
            {/* KPI-raden rendres ALLTID — feiltilstand med «—»-verdier i
                identiske dimensjoner så layouten aldri hopper (§8-01c). */}
            <div className="hero-meta">
              <div className="hero-meta-item">
                <span className={`hero-meta-num${stats.ok && stats.ytdReturnPct != null ? (ytdUp ? ' em' : ' dn') : ''}`}>
                  {stats.ok ? (
                    <>
                      {fmtPct(stats.ytdReturnPct, lang)}
                      <SourceNote lang={lang} asOfIso={stats.asOfIso} />
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <span className={`hero-meta-lab${stats.ok ? '' : ' err'}`}>
                  {stats.ok ? `${daysSinceLaunch()} ${t.kpiYtdSuffix}` : t.kpiErr}
                </span>
              </div>
              <div className="hero-meta-item">
                <span className="hero-meta-num gold">
                  {stats.ok ? (
                    <>
                      {fmtUsd(stats.totalValue, lang)}
                      <SourceNote lang={lang} asOfIso={stats.asOfIso} />
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="hero-meta-lab">{t.kpiCapital}</span>
              </div>
              <div className="hero-meta-item">
                <span className="hero-meta-num">{stats.ok ? (stats.positionsHeld ?? '—') : '—'}</span>
                <span className="hero-meta-lab">{t.kpiPositions}</span>
              </div>
            </div>
            <div className="hero-meta-paper">
              <PaperTag lang={lang} />
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-panel">
              <div className="panel-head">
                <span className="panel-title">{t.panelTitle}</span>
                {stats.ok ? (
                  <span className="aqv2-tag cy"><span className="aqv2-dot" />LIVE</span>
                ) : (
                  <span className="aqv2-tag dev">{t.panelOffline}</span>
                )}
              </div>
              {!stats.ok ? (
                <div className="hero-panel-hatch aq-hatch">{t.kpiErr}</div>
              ) : stats.positions.length === 0 ? (
                <div className="hero-panel-hatch aq-hatch">{t.panelEmpty}</div>
              ) : (
                <div className="panel-rows">
                  {stats.positions.slice(0, 6).map((p) => (
                    <div key={p.ticker} className="panel-row">
                      <span className="tk">
                        <span className={`swatch-${p.side}`} />{p.ticker}
                      </span>
                      <span className="px">$ {p.price.toFixed(2)}</span>
                      <span className={`chg chg-${p.side}`}>
                        {p.changePct >= 0 ? '+' : '−'}{Math.abs(p.changePct).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                  {hiddenPositions > 0 && (
                    <Link href="/innsyn" className="panel-more">
                      {t.panelMore(hiddenPositions)}
                    </Link>
                  )}
                </div>
              )}
              <div className="hero-panel-foot">
                <span>{t.panelSync} {stats.ok ? fmtSyncTime(stats.asOfIso) : '—'}</span>
                <span>{t.panelExchanges}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
