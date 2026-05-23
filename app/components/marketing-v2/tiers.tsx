'use client';

import type { Lang } from '../marketing/types';
import { ArrowRight, Check } from './icons';

interface TierData {
  name: string;
  tag: string;
  tagline: string;
  currency: string;
  cycle: string;
  bullets: string[];
  cta1: string;
  cta2: string;
}

const TIERS_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  sub: string;
  plus: TierData;
  max: TierData;
}> = {
  no: {
    eye: '03 · Produktene',
    titlePre: 'To måter å ',
    titleEm:  'eie',
    titlePost: ' blåkopien.',
    sub: 'Lær med Plus. Lås opp motoren med Max når den ankommer. Prisen er den samme for alle — fordi resultatene skal være det også.',
    plus: {
      name: 'Plus', tag: 'TILGJENGELIG NÅ',
      tagline: 'For investoren som vil forstå selv.',
      currency: '199', cycle: '/ mnd · NOK',
      bullets: [
        'Daglige signaler med fullstendig begrunnelse',
        'Ukentlige markedsrapporter på norsk og engelsk',
        'Tilgang til hele blåkopien — alle indikatorer, all logikk',
        'Praksisportefølje med live priser',
        'Tilgjengelig globalt — du velger megler',
      ],
      cta1: 'Opprett konto', cta2: 'Hva er inkludert',
    },
    max: {
      name: 'Max', tag: 'KOMMER 2026',
      tagline: 'For den som vil ha motoren i arbeid.',
      currency: '4 990', cycle: '/ mnd · NOK',
      bullets: [
        'Fullautomatisk handel via Alpaca Trading API',
        'AI med selvlærende parametere — kontinuerlig kalibrering',
        'AES-256-GCM-kryptering på alle API-nøkler',
        'Live cockpit, P&L per posisjon, og kill-switch',
        'Ta ut avkastning på ett klikk',
      ],
      cta1: 'Varsle meg', cta2: 'Tekniske detaljer',
    },
  },
  en: {
    eye: '03 · The Products',
    titlePre: 'Two ways to ',
    titleEm:  'own',
    titlePost: ' the blueprint.',
    sub: 'Learn with Plus. Unlock the engine with Max when it arrives. The price is the same for everyone — because the results should be, too.',
    plus: {
      name: 'Plus', tag: 'AVAILABLE NOW',
      tagline: 'For the investor who wants to understand.',
      currency: '19', cycle: '/ mo · USD',
      bullets: [
        'Daily signals with full reasoning',
        'Weekly market reports in Norwegian and English',
        'Access to the full blueprint — every indicator, all logic',
        'Practice portfolio with live prices',
        'Available globally — pick any broker',
      ],
      cta1: 'Create account', cta2: 'What’s included',
    },
    max: {
      name: 'Max', tag: 'SHIPPING 2026',
      tagline: 'For the one who wants the engine working.',
      currency: '499', cycle: '/ mo · USD',
      bullets: [
        'Fully autonomous trading via Alpaca Trading API',
        'AI with self-tuning parameters — continuous calibration',
        'AES-256-GCM encryption on every API key',
        'Live cockpit, per-position P&L, and kill switch',
        'Withdraw realised profits with one click',
      ],
      cta1: 'Notify me', cta2: 'Technical specs',
    },
  },
};

function Tier({ data, kind, available }: { data: TierData; kind: 'cyan' | 'gold'; available: boolean }) {
  const cls = kind === 'gold' ? 'tier gold' : 'tier';
  const tagCls = kind === 'gold' ? 'aqv2-tag gold' : available ? 'aqv2-tag cy' : 'aqv2-tag dev';
  return (
    <div className={available ? cls : `${cls} dev`}>
      <div className="tier-head">
        <h3 className="tier-name">
          <span>Apex Quantum </span>
          <span className={kind}>{data.name}</span>
        </h3>
        <span className={tagCls}>
          {available ? <span className="aqv2-dot" /> : null}
          {data.tag}
        </span>
      </div>
      <p className="tier-tagline">{data.tagline}</p>
      <div className="tier-price-row">
        <span className="tier-price">{data.currency}</span>
        <span className="tier-cycle">{data.cycle}</span>
      </div>
      <ul>
        {data.bullets.map((b) => (
          <li key={b}><span className="mark"><Check /></span>{b}</li>
        ))}
      </ul>
      <div className="tier-actions">
        <button type="button" className={kind === 'gold' ? 'btn btn-gold' : 'btn btn-cyan'} disabled={!available}>
          {data.cta1} <ArrowRight size={14} />
        </button>
        <button type="button" className="btn btn-ghost">{data.cta2}</button>
      </div>
    </div>
  );
}

export function TiersV2({ lang }: { lang: Lang }) {
  const t = TIERS_COPY[lang];
  return (
    <section id="products" className="tiers">
      <div className="container">
        <div className="tiers-head">
          <span className="eyebrow"><span className="rule" />{t.eye}</span>
          <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
          <p>{t.sub}</p>
        </div>
        <div className="tiers-grid">
          <Tier data={t.plus} kind="cyan" available />
          <Tier data={t.max}  kind="gold" available={false} />
        </div>
      </div>
    </section>
  );
}
