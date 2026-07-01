'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import { ArrowRight, Check } from '@/app/components/marketing-v2/icons';
import { PLUS_FOR_SALE, PLUS_DEV_LABELS } from '@/lib/product-status';
import type { Lang } from '@/app/components/marketing/types';

/**
 * /plus — portert fra v8 (.m-*, btn-*-v8) til aqv2-vokabularet (§9).
 * Hero i Fraunces med produktnavn i cyan-kursiv, funksjonsgrid i
 * principles-mønsteret, «Tre steg» i reasoning-step-mønsteret og
 * priskortet som TiersV2-Plus-kortet. Legal-band via PageShell.
 */

const COPY = {
  no: {
    eye: 'Apex Quantum +',
    titlePre: 'Lær markedet. ',
    titleEm: 'Behold kontrollen',
    titlePost: '.',
    lede: 'Daglige AI-signaler med fullstendig begrunnelse, ukentlige rapporter og strukturert læring — for deg som vil forstå hvordan markedet fungerer.',
    sub: 'Du velger megler selv. Du tar beslutningene. Apex Quantum + handler aldri for deg — den viser deg hvorfor, ikke bare hva.',
    cta2: 'Se alt som er inkludert',
    foot: 'Ingen binding · Avbryt når som helst · Tilgjengelig globalt',

    sec1Eye: '01 · Innhold',
    sec1Pre: 'Hva du ',
    sec1Em: 'får',
    sec1Post: '.',
    sec1Sub: 'Alt du trenger for å lære og navigere markedet — i ett abonnement.',
    feats: [
      { eye: '01 · Signaler', t: 'Daglige AI-signaler', d: 'Hver dag publiserer modellen et utvalg signaler — kjøp, salg eller observér — med fullstendig begrunnelse. Du lærer hvorfor, ikke bare hva.' },
      { eye: '02 · Rapporter', t: 'Ukentlige rapporter', d: 'Markedsoppsummering hver søndag: hva som beveget kursene, sektorrotasjoner, makro-faktorer og hva modellen følger med på neste uke.' },
      { eye: '03 · Læring', t: 'Strukturert læring', d: 'Moduler i tre nivåer — nybegynner, mellom, avansert. Aksjebasis, fundamental og teknisk analyse, risikostyring og psykologi.' },
      { eye: '04 · Ordbok', t: 'Ordbok og verktøy', d: 'Forklaringer på alle begreper du møter — fra P/E og EBITDA til support, momentum og volatilitet. Søkbar og kontekstuell.' },
      { eye: '05 · Praksis', t: 'Praksisportefølje', d: 'Øv risikofritt med live markedsdata. Bygg en virtuell portefølje, test ideer og se hvordan de utvikler seg over tid — uten å risikere kapital.' },
      { eye: '06 · Journal', t: 'Investeringsjournal', d: 'Logg hver beslutning, tese og utfall. Etter noen måneder ser du dine egne mønstre — og lærer mer av journalen enn av noe kurs.' },
    ],

    sec2Eye: '02 · Slik fungerer det',
    sec2Pre: 'Tre steg, ',
    sec2Em: 'hver dag',
    sec2Post: '.',
    steps: [
      { tag: ['SIGNAL', 'hver morgen'], d: 'Du får varsel i appen og på e-post når modellen publiserer et nytt signal. Hvert signal kommer med ticker, retning, konfidensnivå og full begrunnelse.' },
      { tag: ['BEGRUNNELSE', 'fullt synlig'], d: 'Les hvorfor modellen mener det den mener. Lær teknikkene som ligger bak — fundamental analyse, momentum, makro-kontekst — gjennom konkrete eksempler.' },
      { tag: ['BESLUTNING', 'din egen'], d: 'Apex Quantum + handler ikke for deg. Bruk signalet som læring eller utgangspunkt for egen analyse, og handle selv hos megleren du foretrekker.' },
    ],

    sec3Eye: '03 · Pris',
    sec3Pre: 'Én plan. Lavt nok til at det ',
    sec3Em: 'lønner seg å lære',
    sec3Post: '.',
    sec3Sub: 'Ingen binding. Ingen suksesshonorar. Avbryt når som helst.',
    tier: {
      tag: 'TILGJENGELIG NÅ',
      tagline: 'Signaler, rapporter og læring.',
      currency: '199',
      cycle: 'kr / mnd',
      bullets: [
        'Daglige signaler med fullstendig begrunnelse',
        'Ukentlige markedsrapporter',
        'Læringsmoduler — nybegynner til avansert',
        'Ordbok, journal og praksisportefølje',
        'Tilgjengelig globalt — ingen meglerbinding',
        'E-poststøtte',
      ],
      cta1: 'Start læringen',
      cta2: 'Se full prisoversikt',
    },
    riskLink: 'Les risikofaktorene først →',
  },
  en: {
    eye: 'Apex Quantum +',
    titlePre: 'Learn the market. ',
    titleEm: 'Keep control',
    titlePost: '.',
    lede: 'Daily AI signals with full reasoning, weekly reports and structured learning — for people who want to understand how the market works.',
    sub: 'You pick the broker. You make the calls. Apex Quantum + never trades for you — it shows you the why, not just the what.',
    cta2: 'See everything included',
    foot: 'No commitment · Cancel anytime · Available globally',

    sec1Eye: '01 · What is included',
    sec1Pre: 'What you ',
    sec1Em: 'get',
    sec1Post: '.',
    sec1Sub: 'Everything you need to learn and navigate the market — in one subscription.',
    feats: [
      { eye: '01 · Signals', t: 'Daily AI signals', d: 'Every day the model publishes a curated set of signals — buy, sell or observe — with full reasoning. You learn the why, not just the what.' },
      { eye: '02 · Reports', t: 'Weekly reports', d: 'Sunday market wrap: what moved prices, sector rotations, macro factors, and what the model is watching next week.' },
      { eye: '03 · Learning', t: 'Structured learning', d: 'Three-tier modules — beginner, intermediate, advanced. Stock basics, fundamental and technical analysis, risk and psychology.' },
      { eye: '04 · Glossary', t: 'Glossary and tools', d: 'Explanations for every term you meet — from P/E and EBITDA to support, momentum and volatility. Searchable and contextual.' },
      { eye: '05 · Practice', t: 'Practice portfolio', d: 'Practice risk-free with live market data. Build a virtual portfolio, test ideas and see how they develop — without risking capital.' },
      { eye: '06 · Journal', t: 'Investment journal', d: 'Log every decision, thesis and outcome. After a few months you see your own patterns — and learn more from the journal than any course.' },
    ],

    sec2Eye: '02 · How it works',
    sec2Pre: 'Three steps, ',
    sec2Em: 'every day',
    sec2Post: '.',
    steps: [
      { tag: ['SIGNAL', 'every morning'], d: 'You get notified in the app and by email when the model publishes a new signal. Every signal comes with ticker, direction, confidence and full reasoning.' },
      { tag: ['REASONING', 'fully visible'], d: 'Read why the model thinks what it thinks. Learn the underlying techniques — fundamental analysis, momentum, macro context — through concrete examples.' },
      { tag: ['DECISION', 'your own'], d: 'Apex Quantum + does not trade for you. Use the signal as a learning input or a starting point for your own analysis, and trade at the broker you prefer.' },
    ],

    sec3Eye: '03 · Pricing',
    sec3Pre: 'One plan. Low enough that ',
    sec3Em: 'learning pays off',
    sec3Post: '.',
    sec3Sub: 'No commitment. No performance fees. Cancel anytime.',
    tier: {
      tag: 'AVAILABLE NOW',
      tagline: 'Signals, reports and learning.',
      currency: '19',
      cycle: '$ / month',
      bullets: [
        'Daily signals with full reasoning',
        'Weekly market reports',
        'Learning modules — beginner to advanced',
        'Glossary, journal and practice portfolio',
        'Available globally — no broker lock-in',
        'Email support',
      ],
      cta1: 'Start learning',
      cta2: 'See full pricing',
    },
    riskLink: 'Read the risk factors first →',
  },
} as const;

export default function PlusPage() {
  return (
    <PageShell legalBand>
      {(lang: Lang) => {
        const t = COPY[lang];
        const available = PLUS_FOR_SALE;
        const tierTag = available ? t.tier.tag : PLUS_DEV_LABELS[lang].tag;
        const tierCta = available ? t.tier.cta1 : PLUS_DEV_LABELS[lang].cta;
        return (
          <>
            {/* Hero */}
            <section className="pg-hero">
              <div className="container">
                <span className="eyebrow cy"><span className="rule" />{t.eye}</span>
                <h1>
                  {t.titlePre}<em className="cy">{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-lede">{t.lede}</p>
                <p className="pg-sub">{t.sub}</p>
                <div className="hero-ctas pg-cta-row" style={{ marginTop: 32 }}>
                  {available ? (
                    <Link href="/sign-up" className="btn btn-cyan btn-lg">
                      {tierCta} <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-lg" disabled>
                      {tierCta}
                    </button>
                  )}
                  <a href="#innhold" className="btn btn-ghost btn-lg">{t.cta2}</a>
                </div>
                <p className="pg-mononote" style={{ marginTop: 24 }}>{t.foot}</p>
              </div>
            </section>

            {/* Funksjonsgrid — principles-mønsteret */}
            <section id="innhold" className="pg-section" style={{ paddingTop: 24 }}>
              <div className="container">
                <div className="aq-gullsnitt" aria-hidden style={{ marginBottom: 56 }} />
                <span className="eyebrow cy"><span className="rule" />{t.sec1Eye}</span>
                <h2 className="pg-h2">
                  {t.sec1Pre}<em className="cy">{t.sec1Em}</em>{t.sec1Post}
                </h2>
                <p className="pg-h2-sub">{t.sec1Sub}</p>
                <div className="pg-featgrid">
                  {t.feats.map((f) => (
                    <div key={f.eye} className="pg-feat">
                      <span className="pg-feat-eye">{f.eye}</span>
                      <h3>{f.t}</h3>
                      <p>{f.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Tre steg — reasoning-step-mønsteret */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow cy"><span className="rule" />{t.sec2Eye}</span>
                <h2 className="pg-h2">
                  {t.sec2Pre}<em className="cy">{t.sec2Em}</em>{t.sec2Post}
                </h2>
                <div className="reasoning" style={{ marginTop: 48, maxWidth: 720 }}>
                  {t.steps.map((s) => (
                    <div key={s.tag[0]} className="reasoning-step">
                      <span className="step-tag">
                        {s.tag[0]}<span className="time">· {s.tag[1]}</span>
                      </span>
                      <span className="step-line">{s.d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Pris — TiersV2-Plus-kortet gjenbrukt */}
            <section id="pris" className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow cy"><span className="rule" />{t.sec3Eye}</span>
                <h2 className="pg-h2">
                  {t.sec3Pre}<em className="cy">{t.sec3Em}</em>{t.sec3Post}
                </h2>
                <p className="pg-h2-sub">{t.sec3Sub}</p>
                <div style={{ maxWidth: 560, marginTop: 48 }}>
                  <div className={available ? 'tier' : 'tier dev'}>
                    <div className="tier-head">
                      <h3 className="tier-name">
                        <span>Apex Quantum </span>
                        <span className="cyan">+</span>
                      </h3>
                      <span className={available ? 'aqv2-tag cy' : 'aqv2-tag dev'}>
                        {available ? <span className="aqv2-dot" /> : null}
                        {tierTag}
                      </span>
                    </div>
                    <p className="tier-tagline">{t.tier.tagline}</p>
                    <div className="tier-price-row">
                      <span className="tier-price">{t.tier.currency}</span>
                      <span className="tier-cycle">{t.tier.cycle}</span>
                    </div>
                    <ul>
                      {t.tier.bullets.map((b) => (
                        <li key={b}><span className="mark"><Check /></span>{b}</li>
                      ))}
                    </ul>
                    <div className="tier-actions">
                      {available ? (
                        <Link href="/sign-up" className="btn btn-cyan">
                          {tierCta} <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <button type="button" className="btn btn-cyan" disabled>
                          {tierCta}
                        </button>
                      )}
                      <Link href="/pris" className="btn btn-ghost">{t.tier.cta2}</Link>
                    </div>
                  </div>
                </div>
                <p className="pg-mononote" style={{ marginTop: 28 }}>
                  <Link href="/risikofaktorer" style={{ color: 'var(--aq-cyan-hi)' }}>
                    {t.riskLink}
                  </Link>
                </p>
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
