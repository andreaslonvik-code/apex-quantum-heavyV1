'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import type { Lang } from './types';

const HERO = {
  no: {
    badge: 'AI-drevet aksjeinnsikt — Plus tilgjengelig nå',
    title: 'Apex Quantum',
    accent: 'AI-drevet aksjeinnsikt for alle nivåer',
    desc: 'Lær aksjemarkedet med AI som læremester, eller la den fullautomatiske motoren ta over når den lanseres. Apex Quantum + gir deg daglige signaler med begrunnelse, ukentlige rapporter og strukturert læring fra kun 199 kr/mnd. Apex Quantum Max — den autonome trading-motoren — kommer snart.',
    feats: [
      ['→', 'Daglige AI-signaler med fullstendig begrunnelse'],
      ['→', 'Ukentlige markedsrapporter på norsk'],
      ['→', 'Læringsmoduler — nybegynner til avansert'],
      ['→', 'Praksisportefølje med live priser'],
      ['→', 'Tilgjengelig globalt — du velger megler'],
      ['→', 'Apex Quantum Max kommer snart'],
    ],
    cta: 'Start med Apex Quantum +',
    cta2: 'Se produktene',
    foot: ['Apex Quantum + fra 199 kr/mnd', 'Ingen binding', 'Apex Quantum Max — kommer snart'],
  },
  en: {
    badge: 'AI-powered market insight — Plus available now',
    title: 'Apex Quantum',
    accent: 'AI-powered market insight at every level',
    desc: 'Learn the stock market with AI as your tutor, or let the fully autonomous engine take over once it launches. Apex Quantum + gives you daily signals with reasoning, weekly reports and structured learning from just $19/month. Apex Quantum Max — the autonomous trading engine — is coming soon.',
    feats: [
      ['→', 'Daily AI signals with full reasoning'],
      ['→', 'Weekly market reports'],
      ['→', 'Learning modules — beginner to advanced'],
      ['→', 'Practice portfolio with live prices'],
      ['→', 'Available globally — pick any broker'],
      ['→', 'Apex Quantum Max coming soon'],
    ],
    cta: 'Start with Apex Quantum +',
    cta2: 'See products',
    foot: ['Apex Quantum + from $19/month', 'No commitment', 'Apex Quantum Max — coming soon'],
  },
} as const;

export function Hero({ lang }: { lang: Lang }) {
  const t = HERO[lang];
  return (
    <section className="m-hero">
      <div className="m-hero-inner">
        <div className="m-badge">
          <span className="m-badge-dot" />
          <span>{t.badge}</span>
        </div>
        <h1 className="m-hero-title">
          {t.title}
          <span className="m-hero-accent">{t.accent}</span>
        </h1>
        <p className="m-hero-desc">{t.desc}</p>
        <div className="m-feats">
          {t.feats.map(([ic, tx], i) => (
            <div key={i} className="m-feat">
              <span className="m-feat-ic">{ic}</span>
              <span className="m-feat-tx">{tx}</span>
            </div>
          ))}
        </div>
        <div className="m-cta-row">
          <Link href="/sign-up" className="btn-primary-v8 btn-lg">
            {t.cta}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="#produkter" className="btn-ghost-v8 btn-lg">{t.cta2}</a>
        </div>
        <div className="m-foot-strip">
          {t.foot.map((s, i) => (
            <Fragment key={i}>
              <span>{s}</span>
              {i < t.foot.length - 1 && <span className="m-foot-sep">•</span>}
            </Fragment>
          ))}
        </div>
      </div>
      <HeroEmblem />
    </section>
  );
}

function HeroEmblem() {
  return (
    <div className="m-emblem" aria-hidden="true">
      <div className="m-emblem-orbit" />
      <div className="m-emblem-orbit2" />
      <svg className="m-emblem-svg" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="hg-cy" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#00F5FF" />
            <stop offset="100%" stopColor="#0088A8" />
          </linearGradient>
          <linearGradient id="hg-chrome" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#E9F8FF" />
            <stop offset="50%" stopColor="#7FB7E6" />
            <stop offset="100%" stopColor="#0B1A2E" />
          </linearGradient>
          <radialGradient id="hg-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#00F5FF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00F5FF" stopOpacity="0" />
          </radialGradient>
          <pattern id="hg-hex" x="0" y="0" width="34" height="30" patternUnits="userSpaceOnUse">
            <path
              d="M17 0 L34 8.5 L34 21.5 L17 30 L0 21.5 L0 8.5 Z"
              fill="none"
              stroke="rgba(0,245,255,0.15)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <circle cx="200" cy="200" r="180" fill="url(#hg-glow)" />
        <circle cx="200" cy="200" r="160" fill="url(#hg-hex)" opacity="0.9" />
        <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(0,245,255,0.15)" strokeWidth="1" />
        <circle
          cx="200"
          cy="200"
          r="120"
          fill="none"
          stroke="rgba(0,245,255,0.2)"
          strokeWidth="0.7"
          strokeDasharray="2 4"
        />
        <g transform="translate(200 200)">
          <polygon
            points="0,-110 20,-30 110,0 20,30 0,110 -20,30 -110,0 -20,-30"
            fill="url(#hg-chrome)"
            stroke="rgba(0,245,255,0.5)"
            strokeWidth="1"
          />
          <polygon
            points="0,-70 12,-20 70,0 12,20 0,70 -12,20 -70,0 -12,-20"
            fill="rgba(255,255,255,0.95)"
            opacity="0.9"
          />
          <circle cx="0" cy="0" r="14" fill="url(#hg-cy)" />
        </g>
        <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(0,245,255,0.25)" strokeWidth="0.5" />
        <line x1="200" y1="0" x2="200" y2="400" stroke="rgba(0,245,255,0.18)" strokeWidth="0.5" />
      </svg>
    </div>
  );
}
