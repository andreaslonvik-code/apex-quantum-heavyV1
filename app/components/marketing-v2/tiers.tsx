'use client';

import Link from 'next/link';
import { PLUS_FOR_SALE, PLUS_DEV_LABELS } from '@/lib/product-status';
import type { Lang } from '../marketing/types';
import { ArrowRight, Check } from './icons';

interface TierData {
  name: string;
  tag: string;
  tagline: string;
  currency: string;
  cycle: string;
  desc: string;
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
    titlePre: 'To måter å bruke ',
    titleEm:  'Apex Quantum',
    titlePost: '.',
    sub: 'Lær markedet med signaler og rapporter — eller la den fullautomatiske motoren ta over når den lanseres.',
    plus: {
      name: 'Plus', tag: 'TILGJENGELIG NÅ',
      tagline: 'Signaler, rapporter og læring.',
      currency: '199', cycle: 'kr / mnd',
      desc: 'For deg som vil forstå markedet selv. Daglige AI-signaler med begrunnelse, ukentlige rapporter, læringsmoduler og praksisportefølje. Du velger megler. Du tar beslutningene.',
      bullets: [
        'Daglige signaler med fullstendig begrunnelse',
        'Ukentlige markedsrapporter',
        'Læringsmoduler — nybegynner til avansert',
        'Praksisportefølje med live priser',
        'Tilgjengelig globalt — ingen meglerbinding',
      ],
      cta1: 'Start nå', cta2: 'Les mer',
    },
    max: {
      name: 'Max', tag: 'UNDER UTVIKLING',
      tagline: 'Fullautomatisk AI-trading.',
      currency: '4 990', cycle: 'kr / mnd',
      desc: 'Den autonome trading-motoren med 12-måneders investeringshorisont. Bygger en portefølje av AI-/semis-leaders fordelt på åtte sektorer og lar vinnerne ride for kvartaler — ikke timer. Drevet av en blueprint utviklet over et år. Utført via Alpaca, døgnet rundt. Lansering planlagt 2026.',
      bullets: [
        '12-måneders horisont — rider normale pullbacks (-3 til -8 %) med vilje',
        'Cutter raskt ved ekte trend-bryt (FDA-avslag, dårlig earnings, SMA50-brudd)',
        'Fullautomatisk handel via Alpaca, krypterte API-nøkler (AES-256-GCM)',
        'Live cockpit, P&L og porteføljegraf',
        'Ta ut avkastning på ett klikk',
      ],
      cta1: 'Varsle meg', cta2: 'Detaljer',
    },
  },
  en: {
    eye: '03 · The Products',
    titlePre: 'Two ways to use ',
    titleEm:  'Apex Quantum',
    titlePost: '.',
    sub: 'Learn the market with signals and reports — or let the fully autonomous engine take over once it launches.',
    plus: {
      name: 'Plus', tag: 'AVAILABLE NOW',
      tagline: 'Signals, reports and learning.',
      currency: '19', cycle: '$ / month',
      desc: 'For those who want to understand the market themselves. Daily AI signals with reasoning, weekly reports, learning modules and a practice portfolio. You pick the broker. You make the calls.',
      bullets: [
        'Daily signals with full reasoning',
        'Weekly market reports',
        'Learning modules — beginner to advanced',
        'Practice portfolio with live prices',
        'Available globally — no broker lock-in',
      ],
      cta1: 'Start now', cta2: 'Learn more',
    },
    max: {
      name: 'Max', tag: 'IN DEVELOPMENT',
      tagline: 'Fully autonomous AI trading.',
      currency: '499', cycle: '$ / month',
      desc: 'The autonomous trading engine with a 12-month investment horizon. Builds a portfolio of AI/semis leaders across eight sectors and lets winners ride for quarters — not hours. Driven by a blueprint developed over a year. Executed via Alpaca, around the clock. Launch planned 2026.',
      bullets: [
        '12-month horizon — rides normal pullbacks (-3 to -8 %) on purpose',
        'Cuts fast on real breakdowns (FDA rejection, bad earnings, SMA50 break)',
        'Fully automated trading via Alpaca, encrypted API keys (AES-256-GCM)',
        'Live cockpit, P&L and portfolio chart',
        'Withdraw profits with one click',
      ],
      cta1: 'Notify me', cta2: 'Details',
    },
  },
};

function Tier({
  data,
  kind,
  available,
  primaryHref,
  secondaryHref,
  primaryTag,
  primaryCta,
}: {
  data: TierData;
  kind: 'cyan' | 'gold';
  available: boolean;
  primaryHref: string;
  secondaryHref: string;
  primaryTag: string;
  primaryCta: string;
}) {
  const cls = kind === 'gold' ? 'tier gold' : 'tier';
  const tagCls = kind === 'gold' ? 'aqv2-tag gold' : available ? 'aqv2-tag cy' : 'aqv2-tag dev';
  const isMailto = primaryHref.startsWith('mailto:');
  return (
    <div className={available ? cls : `${cls} dev`}>
      <div className="tier-head">
        <h3 className="tier-name">
          <span>Apex Quantum </span>
          <span className={kind}>{data.name}</span>
        </h3>
        <span className={tagCls}>
          {available ? <span className="aqv2-dot" /> : null}
          {primaryTag}
        </span>
      </div>
      <p className="tier-tagline">{data.tagline}</p>
      <div className="tier-price-row">
        <span className="tier-price">{data.currency}</span>
        <span className="tier-cycle">{data.cycle}</span>
      </div>
      <p style={{ color: 'var(--aq-text-mid)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 8px' }}>{data.desc}</p>
      <ul>
        {data.bullets.map((b) => (
          <li key={b}><span className="mark"><Check /></span>{b}</li>
        ))}
      </ul>
      <div className="tier-actions">
        {isMailto ? (
          <a href={primaryHref} className={kind === 'gold' ? 'btn btn-gold' : 'btn btn-cyan'}>
            {primaryCta} <ArrowRight size={14} />
          </a>
        ) : (
          <Link
            href={primaryHref}
            className={kind === 'gold' ? 'btn btn-gold' : 'btn btn-cyan'}
            aria-disabled={!available}
            style={!available ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
          >
            {primaryCta} <ArrowRight size={14} />
          </Link>
        )}
        <Link href={secondaryHref} className="btn btn-ghost">{data.cta2}</Link>
      </div>
    </div>
  );
}

export function TiersV2({ lang }: { lang: Lang }) {
  const t = TIERS_COPY[lang];
  const plusTag = PLUS_FOR_SALE ? t.plus.tag : PLUS_DEV_LABELS[lang].tag;
  const plusCta = PLUS_FOR_SALE ? t.plus.cta1 : PLUS_DEV_LABELS[lang].cta;
  return (
    <section id="products" className="tiers">
      <div className="container">
        <div className="tiers-head">
          <span className="eyebrow"><span className="rule" />{t.eye}</span>
          <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
          <p>{t.sub}</p>
        </div>
        <div className="tiers-grid">
          <Tier
            data={t.plus}
            kind="cyan"
            available={PLUS_FOR_SALE}
            primaryHref={PLUS_FOR_SALE ? '/sign-up' : '#'}
            secondaryHref="/plus"
            primaryTag={plusTag}
            primaryCta={plusCta}
          />
          <Tier
            data={t.max}
            kind="gold"
            available={false}
            primaryHref="mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me"
            secondaryHref="/pris"
            primaryTag={t.max.tag}
            primaryCta={t.max.cta1}
          />
        </div>
      </div>
    </section>
  );
}
