'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

type IconKey = 'signal' | 'report' | 'lesson' | 'glossary' | 'paper' | 'journal';

const COPY = {
  no: {
    eye: 'APEX QUANTUM +',
    title: 'Bli kjent med aksjemarkedet',
    accent: '— med AI som læremester.',
    desc: 'Apex Quantum + er en lærings- og analyseplattform for deg som vil forstå hvordan markedet fungerer. AI-en er drevet av en blueprint utviklet over et år for ekspertise i aksjeanalyse. Daglige signaler med begrunnelse, ukentlige rapporter, kursmoduler fra nybegynner til avansert, og en risikofri praksisportefølje. Du velger megler selv. Du tar beslutningene.',
    bullets: [
      'Daglige signaler med fullstendig begrunnelse',
      'Ukentlige markedsrapporter på norsk',
      'Læringsmoduler fra nybegynner til avansert',
      'Praksisportefølje med live priser, ingen ekte penger',
      'Globalt tilgjengelig — du velger handelsplattform',
    ],
    cta: 'Start nå — 199 kr/mnd',
    cta2: 'Se alt som er inkludert',
    foot: ['Ingen binding', 'Avbryt når som helst', 'Tilgjengelig globalt'],

    sec1Eye: 'INNHOLD',
    sec1Title: 'Hva du får',
    sec1Sub: 'Alt du trenger for å lære og navigere markedet — i ett abonnement.',
    feats: [
      {
        ic: 'signal' as const,
        t: 'Daglige AI-signaler',
        d: 'Hver dag publiserer modellen et utvalg signaler — kjøp, salg eller observér — med fullstendig begrunnelse. Du lærer hvorfor, ikke bare hva.',
      },
      {
        ic: 'report' as const,
        t: 'Ukentlige rapporter',
        d: 'Markedsoppsummering hver søndag: hva som beveget kursene, sektorrotasjoner, makro-faktorer og hva modellen følger med på neste uke.',
      },
      {
        ic: 'lesson' as const,
        t: 'Strukturert læring',
        d: 'Moduler i tre nivåer — nybegynner, mellom, avansert. Aksjebasis, fundamental og teknisk analyse, risikostyring og psykologi.',
      },
      {
        ic: 'glossary' as const,
        t: 'Ordbok og verktøy',
        d: 'Forklaringer på alle begreper du møter — fra P/E og EBITDA til support, momentum og volatilitet. Søkbar og kontekstuell.',
      },
      {
        ic: 'paper' as const,
        t: 'Praksisportefølje',
        d: 'Øv risikofritt med live markedsdata. Bygg en virtuell portefølje, test ideer og se hvordan de utvikler seg over tid — uten å risikere kapital.',
      },
      {
        ic: 'journal' as const,
        t: 'Investeringsjournal',
        d: 'Logg hver beslutning, tese og utfall. Etter noen måneder ser du dine egne mønstre — og lærer mer av journalen enn av noe kurs.',
      },
    ],

    sec2Eye: 'SLIK FUNGERER DET',
    sec2Title: 'Tre steg, hver dag.',
    steps: [
      {
        n: '01',
        t: 'Motta signalet',
        d: 'Du får varsel i appen og på e-post når modellen publiserer et nytt signal. Hvert signal kommer med ticker, retning, konfidensnivå og full begrunnelse.',
      },
      {
        n: '02',
        t: 'Forstå begrunnelsen',
        d: 'Les hvorfor modellen mener det den mener. Lær teknikkene som ligger bak — fundamental analyse, momentum, makro-kontekst — gjennom konkrete eksempler.',
      },
      {
        n: '03',
        t: 'Du bestemmer',
        d: 'Apex Quantum + handler ikke for deg. Bruk signalet som læring eller utgangspunkt for egen analyse, og handle selv hos megleren du foretrekker.',
      },
    ],

    sec3Eye: 'PRIS',
    sec3Title: 'Én plan. Lavt nok til at det lønner seg å lære.',
    sec3Sub: 'Ingen binding. Ingen suksesshonorar. Avbryt når som helst.',
    planName: 'Apex Quantum +',
    price: '199 kr',
    cycle: '/mnd',
    altPrice: '≈ $19/mnd internasjonalt',
    planBullets: [
      'Daglige signaler med begrunnelse',
      'Ukentlige markedsrapporter',
      'Alle læringsmoduler (nybegynner → avansert)',
      'Ordbok, journal og praksisportefølje',
      'Tilgang globalt — ingen meglerbinding',
      'E-poststøtte',
    ],
    primaryCta: 'Start læringen',

    discTitle: 'Ansvarsfraskrivelse',
    discBody:
      'Apex Quantum + er en lærings- og analyseplattform. Innholdet er generell informasjon og ikke individuell investeringsrådgivning. Handel innebærer risiko, og tidligere resultater er ingen garanti for fremtidige resultater. Du tar alle investeringsbeslutninger på egen hånd.',
  },
  en: {
    eye: 'APEX QUANTUM +',
    title: 'Get to know the stock market',
    accent: '— with AI as your tutor.',
    desc: 'Apex Quantum + is a learning and analysis platform for people who want to understand how markets work. The AI is driven by a blueprint developed over a year for stock-analysis expertise. Daily signals with reasoning, weekly reports, course modules from beginner to advanced, and a risk-free practice portfolio. You choose your broker. You make the calls.',
    bullets: [
      'Daily signals with full reasoning',
      'Weekly market reports',
      'Learning modules from beginner to advanced',
      'Practice portfolio with live prices, no real money',
      'Available globally — pick any broker',
    ],
    cta: 'Start now — $19/mo',
    cta2: 'See everything included',
    foot: ['No commitment', 'Cancel anytime', 'Available globally'],

    sec1Eye: 'WHAT IS INCLUDED',
    sec1Title: 'What you get',
    sec1Sub: 'Everything you need to learn and navigate the market — in one subscription.',
    feats: [
      {
        ic: 'signal' as const,
        t: 'Daily AI signals',
        d: 'Every day the model publishes a curated set of signals — buy, sell or observe — with full reasoning. You learn the why, not just the what.',
      },
      {
        ic: 'report' as const,
        t: 'Weekly reports',
        d: 'Sunday market wrap: what moved prices, sector rotations, macro factors, and what the model is watching next week.',
      },
      {
        ic: 'lesson' as const,
        t: 'Structured learning',
        d: 'Three-tier modules — beginner, intermediate, advanced. Stock basics, fundamental and technical analysis, risk and psychology.',
      },
      {
        ic: 'glossary' as const,
        t: 'Glossary and tools',
        d: 'Explanations for every term you meet — from P/E and EBITDA to support, momentum and volatility. Searchable and contextual.',
      },
      {
        ic: 'paper' as const,
        t: 'Practice portfolio',
        d: 'Practice risk-free with live market data. Build a virtual portfolio, test ideas and see how they develop — without risking capital.',
      },
      {
        ic: 'journal' as const,
        t: 'Investment journal',
        d: 'Log every decision, thesis and outcome. After a few months you see your own patterns — and learn more from the journal than any course.',
      },
    ],

    sec2Eye: 'HOW IT WORKS',
    sec2Title: 'Three steps, every day.',
    steps: [
      {
        n: '01',
        t: 'Receive the signal',
        d: 'You get notified in the app and by email when the model publishes a new signal. Every signal comes with ticker, direction, confidence and full reasoning.',
      },
      {
        n: '02',
        t: 'Understand the reasoning',
        d: 'Read why the model thinks what it thinks. Learn the underlying techniques — fundamental analysis, momentum, macro context — through concrete examples.',
      },
      {
        n: '03',
        t: 'You decide',
        d: 'Apex Quantum + does not trade for you. Use the signal as a learning input or starting point for your own analysis, and trade yourself at the broker you prefer.',
      },
    ],

    sec3Eye: 'PRICING',
    sec3Title: 'One plan. Low enough that learning pays off.',
    sec3Sub: 'No commitment. No performance fees. Cancel anytime.',
    planName: 'Apex Quantum +',
    price: '$19',
    cycle: '/month',
    altPrice: '≈ 199 kr/month for Norwegian customers',
    planBullets: [
      'Daily signals with reasoning',
      'Weekly market reports',
      'All learning modules (beginner → advanced)',
      'Glossary, journal and practice portfolio',
      'Global access — no broker lock-in',
      'Email support',
    ],
    primaryCta: 'Start learning',

    discTitle: 'Disclaimer',
    discBody:
      'Apex Quantum + is a learning and analysis platform. The content is general information and not individual investment advice. Trading involves risk and past performance is not a guarantee of future results. You make all investment decisions yourself.',
  },
} as const;

const ICON: Record<IconKey, ReactNode> = {
  signal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h3l3-9 4 18 3-9h7" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8M8 17h6M8 9h2" />
    </svg>
  ),
  lesson: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  glossary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  paper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  journal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
};

export default function PlusPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <>
            {/* Hero */}
            <section className="m-hero" style={{ paddingTop: 140 }}>
              <div className="m-hero-inner">
                <div className="m-badge">
                  <span className="m-badge-dot" />
                  <span>{t.eye}</span>
                </div>
                <h1 className="m-hero-title">
                  {t.title}
                  <span className="m-hero-accent">{t.accent}</span>
                </h1>
                <p className="m-hero-desc">{t.desc}</p>
                <div className="m-feats">
                  {t.bullets.map((b, i) => (
                    <div key={i} className="m-feat">
                      <span className="m-feat-ic">→</span>
                      <span className="m-feat-tx">{b}</span>
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
                  <a href="#innhold" className="btn-ghost-v8 btn-lg">{t.cta2}</a>
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
            </section>

            {/* What you get */}
            <section id="innhold" className="m-features">
              <div className="m-features-inner">
                <div className="m-section-head">
                  <div className="m-eyebrow">
                    <span className="m-badge-dot" />
                    {t.sec1Eye}
                  </div>
                  <h2 className="m-section-t">{t.sec1Title}</h2>
                  <p className="m-section-sub">{t.sec1Sub}</p>
                </div>
                <div className="m-feat-grid">
                  {t.feats.map((f, i) => (
                    <div key={i} className="m-feat-card">
                      <div className="m-feat-icbox">{ICON[f.ic]}</div>
                      <h3 className="m-feat-t">{f.t}</h3>
                      <p className="m-feat-d">{f.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* How it works */}
            <section className="m-features" style={{ paddingTop: 0 }}>
              <div className="m-features-inner">
                <div className="m-section-head">
                  <div className="m-eyebrow">
                    <span className="m-badge-dot" />
                    {t.sec2Eye}
                  </div>
                  <h2 className="m-section-t">{t.sec2Title}</h2>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 24,
                    marginTop: 48,
                  }}
                >
                  {t.steps.map((s) => (
                    <div key={s.n} className="m-feat-card">
                      <div
                        className="aq-mono"
                        style={{
                          color: 'var(--aq-cyan)',
                          fontSize: 13,
                          letterSpacing: '0.08em',
                          marginBottom: 16,
                        }}
                      >
                        {s.n}
                      </div>
                      <h3 className="m-feat-t">{s.t}</h3>
                      <p className="m-feat-d">{s.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Pricing */}
            <section className="m-cta" id="pris">
              <div className="m-cta-card">
                <div className="m-cta-glow" />
                <div className="m-eyebrow">
                  <span className="m-badge-dot" />
                  {t.sec3Eye}
                </div>
                <h2 className="m-cta-t">{t.sec3Title}</h2>
                <p className="m-cta-sub">{t.sec3Sub}</p>

                <div
                  className="m-live-card"
                  style={{ maxWidth: 520, margin: '40px auto 0', padding: 40, textAlign: 'center' }}
                >
                  <div className="cap-sm">{t.planName}</div>
                  <div
                    style={{
                      marginTop: 18,
                      fontSize: 64,
                      fontWeight: 700,
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                    }}
                  >
                    {t.price}
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.6)',
                        marginLeft: 6,
                      }}
                    >
                      {t.cycle}
                    </span>
                  </div>
                  <div
                    className="aq-mono"
                    style={{ marginTop: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}
                  >
                    {t.altPrice}
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '32px 0 0',
                      textAlign: 'left',
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    {t.planBullets.map((b) => (
                      <li
                        key={b}
                        style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.85)', fontSize: 15 }}
                      >
                        <span style={{ color: 'var(--aq-cyan)' }}>→</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link href="/sign-up" className="btn-primary-v8 btn-lg" style={{ marginTop: 32 }}>
                    {t.primaryCta}
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                <p
                  style={{
                    maxWidth: 720,
                    margin: '40px auto 0',
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    textAlign: 'center',
                  }}
                >
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.discTitle}.</strong>{' '}
                  {t.discBody}
                </p>
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
