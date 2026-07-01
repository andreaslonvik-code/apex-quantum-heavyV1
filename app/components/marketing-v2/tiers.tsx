'use client';

import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { PLUS_FOR_SALE, PLUS_DEV_LABELS } from '@/lib/product-status';
import type { Lang } from '../marketing/types';
import { ArrowRight, Check } from './icons';

export interface TierData {
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

/** Delt tier-copy — /pris gjenbruker kortene herfra (funn 14): én sannhet
 *  for navn, tag, pris og feature-punkter på tvers av landing og prisside. */
export const TIERS_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  sub: string;
  note: string;
  waitPlaceholder: string;
  waitAria: string;
  plus: TierData;
  max: TierData;
}> = {
  no: {
    eye: '03 · Produktene',
    titlePre: 'To måter å bruke ',
    titleEm:  'Apex Quantum',
    titlePost: '.',
    sub: 'Lær markedet med signaler og rapporter — eller la den fullautomatiske motoren ta over når den lanseres.',
    note: 'BEGGE: AES-256-GCM-KRYPTERTE NØKLER · INGEN BINDING · NO/EN',
    waitPlaceholder: 'din@epost.no',
    waitAria: 'E-postadresse for Max-ventelisten',
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
      name: 'Max', tag: 'UNDER UTVIKLING · LANSERING 2026',
      tagline: 'Fullautomatisk AI-trading.',
      currency: '4 990', cycle: 'kr / mnd',
      desc: 'Den autonome trading-motoren med 12-måneders investeringshorisont. Bygger en portefølje av AI-/semis-leaders fordelt på åtte sektorer og lar vinnerne ride for kvartaler — ikke timer. Drevet av en blueprint utviklet over et år. Utført via Alpaca, døgnet rundt. Lansering planlagt 2026.',
      bullets: [
        '12-måneders horisont — rider normale pullbacks (−3 til −8 %) med vilje',
        'Cutter raskt ved ekte trend-bryt (FDA-avslag, dårlig earnings, SMA50-brudd)',
        'Fullautomatisk handel via Alpaca, krypterte API-nøkler (AES-256-GCM)',
        'Live cockpit, P&L og porteføljegraf',
        'Stans når som helst ved frakobling',
        'Ta ut avkastning på ett klikk',
      ],
      cta1: 'Sett meg på ventelisten', cta2: 'Detaljer',
    },
  },
  en: {
    eye: '03 · The Products',
    titlePre: 'Two ways to use ',
    titleEm:  'Apex Quantum',
    titlePost: '.',
    sub: 'Learn the market with signals and reports — or let the fully autonomous engine take over once it launches.',
    note: 'BOTH: AES-256-GCM ENCRYPTED KEYS · NO COMMITMENT · NO/EN',
    waitPlaceholder: 'you@email.com',
    waitAria: 'Email address for the Max waitlist',
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
      name: 'Max', tag: 'IN DEVELOPMENT · LAUNCHING 2026',
      tagline: 'Fully autonomous AI trading.',
      currency: '499', cycle: '$ / month',
      desc: 'The autonomous trading engine with a 12-month investment horizon. Builds a portfolio of AI/semis leaders across eight sectors and lets winners ride for quarters — not hours. Driven by a blueprint developed over a year. Executed via Alpaca, around the clock. Launch planned 2026.',
      bullets: [
        '12-month horizon — rides normal pullbacks (−3 to −8 %) on purpose',
        'Cuts fast on real breakdowns (FDA rejection, bad earnings, SMA50 break)',
        'Fully automated trading via Alpaca, encrypted API keys (AES-256-GCM)',
        'Live cockpit, P&L and portfolio chart',
        'Stop anytime by disconnecting',
        'Withdraw profits with one click',
      ],
      cta1: 'Join the waitlist', cta2: 'Details',
    },
  },
};

/** Fagtermer med title-tooltip (§8-05). */
const TERM_TITLES: Record<Lang, Record<string, string>> = {
  no: {
    'SMA50': '50-dagers glidende gjennomsnitt — teknisk trendindikator',
    'FDA': 'U.S. Food and Drug Administration — amerikansk legemiddelmyndighet',
    'AES-256-GCM': 'Krypteringsstandard brukt for lagring av API-nøkler',
    'P&L': 'Gevinst og tap (profit and loss)',
  },
  en: {
    'SMA50': '50-day simple moving average — technical trend indicator',
    'FDA': 'U.S. Food and Drug Administration',
    'AES-256-GCM': 'Encryption standard used for storing API keys',
    'P&L': 'Profit and loss',
  },
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderBullet(text: string, lang: Lang): ReactNode {
  const titles = TERM_TITLES[lang];
  const re = new RegExp(`(${Object.keys(titles).map(escapeRe).join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    titles[part] ? (
      <span key={i} className="tier-term" title={titles[part]}>{part}</span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Max-venteliste (§8-05): e-postfelt + gullknapp. Submit åpner samme
 * mailto som før med utfylt emne — ingen ny backend.
 */
export function MaxWaitlist({ lang, cta, placeholder, ariaLabel }: {
  lang: Lang;
  cta: string;
  placeholder: string;
  ariaLabel: string;
}) {
  const [email, setEmail] = useState('');
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const subject = lang === 'no' ? 'Apex Quantum Max — venteliste' : 'Apex Quantum Max — waitlist';
    const body = lang === 'no'
      ? `Sett meg på ventelisten. E-post: ${email}`
      : `Add me to the waitlist. Email: ${email}`;
    window.location.href = `mailto:post@apex-quantum.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <form className="tier-wait" onSubmit={onSubmit}>
      <input
        type="email"
        required
        className="tier-wait-input"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="btn btn-gold">
        {cta} <ArrowRight size={14} />
      </button>
    </form>
  );
}

export function Tier({
  data,
  kind,
  available,
  primaryTag,
  lang,
  actions,
}: {
  data: TierData;
  kind: 'cyan' | 'gold';
  available: boolean;
  primaryTag: string;
  lang: Lang;
  actions: ReactNode;
}) {
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
          <li key={b}><span className="mark"><Check /></span><span>{renderBullet(b, lang)}</span></li>
        ))}
      </ul>
      <div className="tier-actions">{actions}</div>
    </div>
  );
}

export function TiersV2({ lang }: { lang: Lang }) {
  const t = TIERS_COPY[lang];
  const plusTag = PLUS_FOR_SALE ? t.plus.tag : PLUS_DEV_LABELS[lang].tag;
  const plusCta = PLUS_FOR_SALE ? t.plus.cta1 : PLUS_DEV_LABELS[lang].cta;
  return (
    <section id="products" className="tiers" data-reveal>
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
            primaryTag={plusTag}
            lang={lang}
            actions={
              <>
                <Link
                  href={PLUS_FOR_SALE ? '/sign-up' : '#'}
                  className="btn btn-cyan"
                  aria-disabled={!PLUS_FOR_SALE}
                  style={!PLUS_FOR_SALE ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                >
                  {plusCta} <ArrowRight size={14} />
                </Link>
                <Link href="/plus" className="btn btn-ghost">{t.plus.cta2}</Link>
              </>
            }
          />
          {/* id="venteliste" — ankeret CTA-seksjonens Max-lenke peker på */}
          <div id="venteliste" className="tiers-anchor">
            <Tier
              data={t.max}
              kind="gold"
              available={false}
              primaryTag={t.max.tag}
              lang={lang}
              actions={
                <>
                  <MaxWaitlist
                    lang={lang}
                    cta={t.max.cta1}
                    placeholder={t.waitPlaceholder}
                    ariaLabel={t.waitAria}
                  />
                  <Link href="/pris" className="btn btn-ghost">{t.max.cta2}</Link>
                </>
              }
            />
          </div>
        </div>
        <p className="tiers-note">{t.note}</p>
      </div>
    </section>
  );
}
