'use client';

import type { Lang } from '../marketing/types';
import { ArrowRight } from './icons';

type MetaCls = 'em' | 'gold' | null;

const HERO_COPY: Record<Lang, {
  eye: string;
  titleA: string;
  titleB: string;
  titleEm: string;
  titleC: string;
  desc: string;
  ctaPrimary: string;
  ctaSecondary: string;
  meta: Array<[string, string, MetaCls]>;
  panelTitle: string;
  panelFoot: [string, string];
}> = {
  no: {
    eye: 'Apex Quantum · siden 2024',
    titleA: 'Markedet hviler aldri.',
    titleB: 'Ikke vår ',
    titleEm: 'blåkopi',
    titleC: ' heller.',
    desc: 'AI-drevet aksjeinnsikt for seriøse investorer. Plus leverer signaler og resonnement, daglig. Max — den autonome motoren — utfører handler døgnet rundt når den lanseres i 2026.',
    ctaPrimary: 'Få tilgang',
    ctaSecondary: 'Les filosofien',
    meta: [
      ['+187,5%', 'YTD avkastning', 'em'],
      ['4,12',    'Sharpe-ratio',    null],
      ['73,4%',   'Vinnerrate',      null],
      ['$2,4M',   'Forvaltet kapital', 'gold'],
    ],
    panelTitle: 'Live posisjoner · paper trading',
    panelFoot: ['Auto-oppdatert', 'NASDAQ · NYSE · ARCA'],
  },
  en: {
    eye: 'Apex Quantum · since 2024',
    titleA: 'The market never rests.',
    titleB: 'Neither does our ',
    titleEm: 'blueprint',
    titleC: '.',
    desc: 'AI-driven equity intelligence for serious investors. Plus delivers signals and reasoning, daily. Max — the autonomous engine — executes around the clock when it ships in 2026.',
    ctaPrimary: 'Get access',
    ctaSecondary: 'Read the thesis',
    meta: [
      ['+187.5%', 'YTD return',           'em'],
      ['4.12',    'Sharpe ratio',         null],
      ['73.4%',   'Win rate',             null],
      ['$2.4M',   'Capital under model',  'gold'],
    ],
    panelTitle: 'Live positions · paper trading',
    panelFoot: ['Live · auto-refresh', 'NASDAQ · NYSE · ARCA'],
  },
};

const HERO_POSITIONS: Array<{ sw: 'up' | 'gold' | 'dn'; tk: string; px: string; chg: string; cls: 'chg-up' | 'chg-dn' }> = [
  { sw: 'up',   tk: 'NVDA', px: '1,184.30', chg: '+2.84%', cls: 'chg-up' },
  { sw: 'gold', tk: 'MU',   px: '110.50',   chg: '+0.43%', cls: 'chg-up' },
  { sw: 'up',   tk: 'AMD',  px: '165.22',   chg: '+1.12%', cls: 'chg-up' },
  { sw: 'dn',   tk: 'TSLA', px: '244.12',   chg: '−1.42%', cls: 'chg-dn' },
  { sw: 'up',   tk: 'AAPL', px: '191.65',   chg: '+0.08%', cls: 'chg-up' },
  { sw: 'up',   tk: 'MSFT', px: '438.91',   chg: '+0.92%', cls: 'chg-up' },
];

export function HeroV2({ lang }: { lang: Lang }) {
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
              <a href="#products" className="btn btn-gold btn-lg">
                {t.ctaPrimary} <ArrowRight size={16} />
              </a>
              <a href="#thesis" className="btn btn-ghost btn-lg">{t.ctaSecondary}</a>
            </div>
            <div className="hero-meta">
              {t.meta.map(([num, lab, cls], i) => (
                <div key={i} className="hero-meta-item">
                  <span className={`hero-meta-num ${cls ?? ''}`}>{num}</span>
                  <span className="hero-meta-lab">{lab}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-panel">
              <div className="panel-head">
                <span className="panel-title">{t.panelTitle}</span>
                <span className="aqv2-tag cy"><span className="aqv2-dot" />LIVE</span>
              </div>
              <div className="panel-rows">
                {HERO_POSITIONS.map((p) => (
                  <div key={p.tk} className="panel-row">
                    <span className="tk"><span className={`swatch-${p.sw}`} />{p.tk}</span>
                    <span className="px">$ {p.px}</span>
                    <span className={`chg ${p.cls}`}>{p.chg}</span>
                  </div>
                ))}
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
