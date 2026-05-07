'use client';

import Link from 'next/link';
import type { Lang } from './types';

const COPY = {
  no: {
    eye: 'PRODUKTER',
    title: 'To måter å bruke Apex Quantum.',
    sub: 'Lær markedet med signaler og rapporter — eller la den fullautomatiske motoren ta over når den lanseres.',
    plus: {
      tag: 'TILGJENGELIG NÅ',
      name: 'Apex Quantum +',
      tagline: 'Signaler, rapporter og læring',
      price: '199 kr',
      cycle: '/mnd',
      desc: 'For deg som vil forstå markedet selv. Daglige AI-signaler med begrunnelse, ukentlige rapporter, læringsmoduler og praksisportefølje. Du velger megler. Du tar beslutningene.',
      bullets: [
        'Daglige signaler med fullstendig begrunnelse',
        'Ukentlige markedsrapporter',
        'Læringsmoduler — nybegynner til avansert',
        'Praksisportefølje med live priser',
        'Tilgjengelig globalt — ingen meglerbinding',
      ],
      cta: 'Start nå',
      cta2: 'Les mer',
    },
    max: {
      tag: 'UNDER UTVIKLING',
      name: 'Apex Quantum Max',
      tagline: 'Fullautomatisk AI-trading',
      price: '4 990 kr',
      cycle: '/mnd',
      desc: 'Den autonome trading-motoren. AI-en analyserer markedsdynamikk og utfører aksjehandel for deg via Alpaca, døgnet rundt — drevet av en blueprint utviklet over et år for ekspertise i aksjeanalyse. Lansering planlagt 2026.',
      bullets: [
        'Fullautomatisk handel via Alpaca',
        'AI med selvlærende parametere',
        'Krypterte API-nøkler (AES-256-GCM)',
        'Live cockpit, P&L og porteføljegraf',
        'Ta ut avkastning på ett klikk',
      ],
      cta: 'Varsle meg',
      cta2: 'Detaljer',
    },
  },
  en: {
    eye: 'PRODUCTS',
    title: 'Two ways to use Apex Quantum.',
    sub: 'Learn the market with signals and reports — or let the fully autonomous engine take over once it launches.',
    plus: {
      tag: 'AVAILABLE NOW',
      name: 'Apex Quantum +',
      tagline: 'Signals, reports and learning',
      price: '$19',
      cycle: '/month',
      desc: 'For those who want to understand the market themselves. Daily AI signals with reasoning, weekly reports, learning modules and a practice portfolio. You pick the broker. You make the calls.',
      bullets: [
        'Daily signals with full reasoning',
        'Weekly market reports',
        'Learning modules — beginner to advanced',
        'Practice portfolio with live prices',
        'Available globally — no broker lock-in',
      ],
      cta: 'Start now',
      cta2: 'Learn more',
    },
    max: {
      tag: 'IN DEVELOPMENT',
      name: 'Apex Quantum Max',
      tagline: 'Fully autonomous AI trading',
      price: '$499',
      cycle: '/month',
      desc: 'The autonomous trading engine. AI analyzes market dynamics and executes equity trading for you via Alpaca, around the clock — driven by a blueprint developed over a year for stock-analysis expertise. Launch planned 2026.',
      bullets: [
        'Fully automated trading via Alpaca',
        'AI with self-tuning parameters',
        'Encrypted API keys (AES-256-GCM)',
        'Live cockpit, P&L and portfolio chart',
        'Withdraw profits with one click',
      ],
      cta: 'Notify me',
      cta2: 'Details',
    },
  },
} as const;

export function ProductCards({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  return (
    <section id="produkter" className="m-features">
      <div className="m-features-inner">
        <div className="m-section-head">
          <div className="m-eyebrow">
            <span className="m-badge-dot" />
            {t.eye}
          </div>
          <h2 className="m-section-t">{t.title}</h2>
          <p className="m-section-sub">{t.sub}</p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            marginTop: 48,
            alignItems: 'stretch',
          }}
        >
          <ProductCard
            available
            tag={t.plus.tag}
            name={t.plus.name}
            tagline={t.plus.tagline}
            price={t.plus.price}
            cycle={t.plus.cycle}
            desc={t.plus.desc}
            bullets={[...t.plus.bullets]}
            primaryCta={t.plus.cta}
            primaryHref="/sign-up"
            secondaryCta={t.plus.cta2}
            secondaryHref="/plus"
          />
          <ProductCard
            available={false}
            tag={t.max.tag}
            name={t.max.name}
            tagline={t.max.tagline}
            price={t.max.price}
            cycle={t.max.cycle}
            desc={t.max.desc}
            bullets={[...t.max.bullets]}
            primaryCta={t.max.cta}
            primaryHref="mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me"
            secondaryCta={t.max.cta2}
            secondaryHref="/pris"
          />
        </div>
      </div>
    </section>
  );
}

interface ProductCardProps {
  available: boolean;
  tag: string;
  name: string;
  tagline: string;
  price: string;
  cycle: string;
  desc: string;
  bullets: string[];
  primaryCta: string;
  primaryHref: string;
  secondaryCta: string;
  secondaryHref: string;
}

function ProductCard({
  available,
  tag,
  name,
  tagline,
  price,
  cycle,
  desc,
  bullets,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
}: ProductCardProps) {
  return (
    <div
      className="m-feat-card"
      style={{
        padding: 36,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        opacity: available ? 1 : 0.92,
      }}
    >
      <div
        className="aq-mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: available ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.45)',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: available ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.4)',
            boxShadow: available ? '0 0 8px rgba(0,245,255,0.6)' : 'none',
          }}
        />
        {tag}
      </div>
      <h3 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{name}</h3>
      <p
        style={{
          margin: '6px 0 0',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 14,
          letterSpacing: '0.01em',
        }}
      >
        {tagline}
      </p>
      <div style={{ marginTop: 28, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>
          {price}
        </span>
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)' }}>{cycle}</span>
      </div>
      <p
        style={{
          marginTop: 20,
          color: 'rgba(255,255,255,0.7)',
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
        {desc}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '24px 0 0',
          display: 'grid',
          gap: 10,
          flex: 1,
        }}
      >
        {bullets.map((b) => (
          <li key={b} style={{ display: 'flex', gap: 10, color: 'rgba(255,255,255,0.82)', fontSize: 14 }}>
            <span style={{ color: available ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.45)' }}>→</span>
            {b}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        {primaryHref.startsWith('mailto:') ? (
          <a href={primaryHref} className={available ? 'btn-primary-v8 btn-sm' : 'btn-ghost-v8 btn-sm'}>
            {primaryCta}
          </a>
        ) : (
          <Link href={primaryHref} className={available ? 'btn-primary-v8 btn-sm' : 'btn-ghost-v8 btn-sm'}>
            {primaryCta}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
        <Link href={secondaryHref} className="btn-ghost-v8 btn-sm">
          {secondaryCta}
        </Link>
      </div>
    </div>
  );
}
