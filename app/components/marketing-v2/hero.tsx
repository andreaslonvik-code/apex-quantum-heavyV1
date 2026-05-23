'use client';

import Link from 'next/link';
import type { Lang } from '../marketing/types';
import type { MarketingStats } from '@/lib/marketing-stats';
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
  panelFoot: [string, string];
  panelEmpty: string;
  kpiYtd: string;
  kpiCapital: string;
  kpiPositions: string;
}> = {
  no: {
    eye: 'Apex Quantum · AI-drevet aksjeinnsikt',
    titleA: 'Lær markedet,',
    titleB: 'eller la motoren ',
    titleEm: 'ta over',
    titleC: '.',
    desc: 'Apex Quantum + gir deg daglige AI-signaler med fullstendig begrunnelse, ukentlige rapporter og strukturert læring fra 199 kr/mnd. Apex Quantum Max — den autonome trading-motoren via Alpaca — lanseres i 2026. Drevet av en blueprint utviklet over et år for ekspertise i aksjeanalyse.',
    ctaPrimary: 'Start med Apex Quantum +',
    ctaSecondary: 'Se produktene',
    panelTitle: 'Live posisjoner · paper trading',
    panelFoot: ['Auto-oppdatert', 'NASDAQ · NYSE · ARCA'],
    panelEmpty: 'Ingen åpne posisjoner akkurat nå.',
    kpiYtd: 'YTD avkastning',
    kpiCapital: 'Forvaltet kapital',
    kpiPositions: 'Aktive posisjoner',
  },
  en: {
    eye: 'Apex Quantum · AI-powered market insight',
    titleA: 'Learn the market,',
    titleB: 'or let the engine ',
    titleEm: 'take over',
    titleC: '.',
    desc: 'Apex Quantum + gives you daily AI signals with full reasoning, weekly reports and structured learning from $19/month. Apex Quantum Max — the autonomous trading engine via Alpaca — launches in 2026. Driven by a blueprint developed over a year for stock-analysis expertise.',
    ctaPrimary: 'Start with Apex Quantum +',
    ctaSecondary: 'See the products',
    panelTitle: 'Live positions · paper trading',
    panelFoot: ['Live · auto-refresh', 'NASDAQ · NYSE · ARCA'],
    panelEmpty: 'No open positions right now.',
    kpiYtd: 'YTD return',
    kpiCapital: 'Capital under model',
    kpiPositions: 'Active positions',
  },
};

function fmtPct(v: number | null, lang: Lang): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '−';
  const abs = Math.abs(v).toFixed(1).replace('.', lang === 'no' ? ',' : '.');
  return `${sign}${abs} %`;
}

function fmtUsd(v: number | null, lang: Lang): string {
  if (v == null || v <= 0) return '—';
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m.toFixed(2).replace('.', lang === 'no' ? ',' : '.')}M`;
  }
  return `$${Math.round(v).toLocaleString(lang === 'no' ? 'nb-NO' : 'en-US')}`;
}

export function HeroV2({ lang, stats }: { lang: Lang; stats: MarketingStats }) {
  const t = HERO_COPY[lang];
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
            {stats.ok && (
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="hero-meta-num em">{fmtPct(stats.ytdReturnPct, lang)}</span>
                  <span className="hero-meta-lab">{t.kpiYtd}</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num gold">{fmtUsd(stats.totalValue, lang)}</span>
                  <span className="hero-meta-lab">{t.kpiCapital}</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num">{stats.positionsHeld ?? '—'}</span>
                  <span className="hero-meta-lab">{t.kpiPositions}</span>
                </div>
              </div>
            )}
          </div>
          <div className="hero-right">
            <div className="hero-panel">
              <div className="panel-head">
                <span className="panel-title">{t.panelTitle}</span>
                <span className="aqv2-tag cy"><span className="aqv2-dot" />LIVE</span>
              </div>
              <div className="panel-rows">
                {stats.positions.length === 0 ? (
                  <div className="panel-row" style={{ gridTemplateColumns: '1fr' }}>
                    <span style={{ color: 'var(--aq-muted)', fontSize: 13 }}>{t.panelEmpty}</span>
                  </div>
                ) : (
                  stats.positions.map((p) => (
                    <div key={p.ticker} className="panel-row">
                      <span className="tk">
                        <span className={`swatch-${p.side}`} />{p.ticker}
                      </span>
                      <span className="px">$ {p.price.toFixed(2)}</span>
                      <span className={`chg chg-${p.side}`}>
                        {p.changePct >= 0 ? '+' : '−'}{Math.abs(p.changePct).toFixed(2)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="hero-panel-foot">
                <span>{t.panelFoot[0]}</span>
                <span>{t.panelFoot[1]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
