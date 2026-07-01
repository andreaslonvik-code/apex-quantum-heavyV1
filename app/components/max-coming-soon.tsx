'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import { ArrowRight } from '@/app/components/marketing-v2/icons';
import { LEGAL_LINES } from '@/lib/legal-copy';
import type { Lang } from '@/app/components/marketing/types';

/**
 * /max — offentlig flate (MaxComingSoon), portert fra v8 til §9-malen:
 * gulltone-hero med Fraunces og mono dev-tag (uten blink), blueprint-
 * seksjon (12-mnd horisont, åtte sektorer — gjenbrukt copy fra tiers/
 * thesis), sikkerhet som mono-spesifikasjonstabell (pg-facts),
 * status-tidslinje i reasoning-step-mønsteret med ærlige datoer, og
 * venteliste-CTA mot /#venteliste. Legal-band via PageShell (§6 lag 3).
 * Regulatoriske setninger hentes fra lib/legal-copy — aldri hardkodet.
 */

const COPY = {
  no: {
    eye: 'Apex Quantum Max',
    devTag: 'UNDER UTVIKLING',
    titlePre: 'Motoren som ',
    titleEm: 'aldri sover',
    titlePost: '. Lansering 2026.',
    lede: 'Den autonome trading-motoren med 12-måneders investeringshorisont — drevet av en blueprint utviklet over et år, utført via Alpaca.',
    sub: 'Den fullautomatiske trading-motoren er under utvikling. I mellomtiden er Apex Quantum + tilgjengelig — signaler, rapporter og læring fra samme AI-grunnlag.',
    ctaWait: 'Sett meg på ventelisten',
    ctaPlus: 'Utforsk Apex Quantum +',
    foot: 'Lansering planlagt 2026 · Vi sender ett varsel — ingen spam',

    sec1Eye: '01 · Blueprinten',
    sec1Pre: 'Bygget for ',
    sec1Em: 'kvartaler',
    sec1Post: ' — ikke timer.',
    sec1Sub: 'Bygger en portefølje av AI-/semis-leaders fordelt på åtte sektorer og lar vinnerne ride. Drevet av en blueprint utviklet over et år. Utført via Alpaca, døgnet rundt.',
    feats: [
      { eye: '01 · Horisont', t: '12-måneders horisont', d: 'Rider normale pullbacks (−3 til −8 %) med vilje og lar vinnerne ride for kvartaler — ikke timer.' },
      { eye: '02 · Portefølje', t: 'Åtte sektorer', d: 'Bygger en portefølje av AI-/semis-leaders fordelt på åtte sektorer — bredde uten å miste fokus.' },
      { eye: '03 · Exit', t: 'Cutter ved trend-bryt', d: 'Cutter raskt ved ekte trend-bryt — FDA-avslag, dårlig earnings eller SMA50-brudd.' },
    ],

    sec2Eye: '02 · Sikkerhet',
    sec2Pre: 'Dine nøkler. ',
    sec2Em: 'Din konto',
    sec2Post: '.',
    sec2Sub: 'Max kobler seg til din egen Alpaca-konto via krypterte API-nøkler. Vi tar aldri imot, oppbevarer eller flytter dine midler.',
    specHead: 'SIKKERHET · SPESIFIKASJON',
    spec: [
      { k: 'KRYPTERING', v: 'AES-256-GCM' },
      { k: 'MEGLER', v: 'ALPACA MARKETS' },
      { k: 'API-NØKLER', v: 'KRYPTERT · PER BRUKER' },
      { k: 'KUNDEMIDLER', v: 'HOS MEGLER — ALDRI HOS OSS' },
    ],

    sec3Eye: '03 · Status',
    sec3Pre: 'Hvor motoren ',
    sec3Em: 'står',
    sec3Post: '.',
    st1Tag: ['BLUEPRINT', 'ferdig'],
    st1D: 'Reglene for hva som kjøpes, hvorfor, og når det selges — utviklet over et år før første ordre ble sendt.',
    st2Tag: ['PAPER TRADING', 'live siden mai 2026'],
    st2D: 'Motoren handler døgnet rundt med simulert kapital via Alpaca — hvert tall publiseres med kilde og tidsstempel.',
    st3Tag: ['FSC-SØKNAD', 'under behandling'],
    st4Tag: ['LANSERING', '2026'],
    st4D: 'Lansering planlagt 2026. Ventelisten får ett varsel når vi åpner — ingen spam.',

    sec4Eye: '04 · Venteliste',
    sec4Pre: 'Still deg ',
    sec4Em: 'først',
    sec4Post: ' i køen.',
  },
  en: {
    eye: 'Apex Quantum Max',
    devTag: 'IN DEVELOPMENT',
    titlePre: 'The engine that ',
    titleEm: 'never sleeps',
    titlePost: '. Launching 2026.',
    lede: 'The autonomous trading engine with a 12-month investment horizon — driven by a blueprint developed over a year, executed via Alpaca.',
    sub: 'The fully autonomous trading engine is under active development. In the meantime, Apex Quantum + is available — signals, reports and learning from the same AI foundation.',
    ctaWait: 'Join the waitlist',
    ctaPlus: 'Explore Apex Quantum +',
    foot: 'Launch planned 2026 · One notification — no spam',

    sec1Eye: '01 · The blueprint',
    sec1Pre: 'Built for ',
    sec1Em: 'quarters',
    sec1Post: ' — not hours.',
    sec1Sub: 'Builds a portfolio of AI/semis leaders across eight sectors and lets winners ride. Driven by a blueprint developed over a year. Executed via Alpaca, around the clock.',
    feats: [
      { eye: '01 · Horizon', t: '12-month horizon', d: 'Rides normal pullbacks (−3 to −8 %) on purpose and lets winners ride for quarters — not hours.' },
      { eye: '02 · Portfolio', t: 'Eight sectors', d: 'Builds a portfolio of AI/semis leaders across eight sectors — breadth without losing focus.' },
      { eye: '03 · Exit', t: 'Cuts on real breaks', d: 'Cuts fast on real trend breaks — FDA rejection, bad earnings or an SMA50 break.' },
    ],

    sec2Eye: '02 · Security',
    sec2Pre: 'Your keys. ',
    sec2Em: 'Your account',
    sec2Post: '.',
    sec2Sub: 'Max connects to your own Alpaca account via encrypted API keys. We never receive, hold or move your funds.',
    specHead: 'SECURITY · SPECIFICATION',
    spec: [
      { k: 'ENCRYPTION', v: 'AES-256-GCM' },
      { k: 'BROKER', v: 'ALPACA MARKETS' },
      { k: 'API KEYS', v: 'ENCRYPTED · PER USER' },
      { k: 'CLIENT FUNDS', v: 'AT BROKER — NEVER WITH US' },
    ],

    sec3Eye: '03 · Status',
    sec3Pre: 'Where the engine ',
    sec3Em: 'stands',
    sec3Post: '.',
    st1Tag: ['BLUEPRINT', 'complete'],
    st1D: 'The rules for what is bought, why, and when it is sold — developed over a year before the first order was placed.',
    st2Tag: ['PAPER TRADING', 'live since May 2026'],
    st2D: 'The engine trades around the clock with simulated capital via Alpaca — every figure is published with source and timestamp.',
    st3Tag: ['FSC APPLICATION', 'under review'],
    st4Tag: ['LAUNCH', '2026'],
    st4D: 'Launch planned 2026. The waitlist gets one notification when we open — no spam.',

    sec4Eye: '04 · Waitlist',
    sec4Pre: 'Be ',
    sec4Em: 'first',
    sec4Post: ' in line.',
  },
} as const;

export function MaxComingSoon() {
  return (
    <PageShell legalBand>
      {(lang: Lang) => {
        const t = COPY[lang];
        // Ærlige datoer (§9): Blueprint ferdig → Paper trading live mai 2026
        // → FSC-søknad under behandling (L2, kanonisk) → Lansering 2026.
        const steps = [
          { tag: t.st1Tag, d: t.st1D },
          { tag: t.st2Tag, d: t.st2D },
          { tag: t.st3Tag, d: LEGAL_LINES[lang].l2 },
          { tag: t.st4Tag, d: t.st4D },
        ];
        return (
          <>
            {/* Hero — gulltoner, Fraunces med gull-kursiv em */}
            <section className="pg-hero">
              <div className="container">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span className="eyebrow"><span className="rule" />{t.eye}</span>
                  <span className="aqv2-tag dev">{t.devTag}</span>
                </div>
                <h1>
                  {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-lede">{t.lede}</p>
                <p className="pg-sub">{t.sub}</p>
                <div className="hero-ctas pg-cta-row" style={{ marginTop: 32 }}>
                  <Link href="/#venteliste" className="btn btn-gold btn-lg">
                    {t.ctaWait} <ArrowRight size={16} />
                  </Link>
                  <Link href="/plus" className="btn btn-ghost btn-lg">{t.ctaPlus}</Link>
                </div>
                <p className="pg-mononote" style={{ marginTop: 24 }}>{t.foot}</p>
              </div>
            </section>

            {/* Blueprint — 12-mnd horisont, åtte sektorer (principles-mønsteret) */}
            <section className="pg-section" style={{ paddingTop: 24 }}>
              <div className="container">
                <div className="aq-gullsnitt" aria-hidden style={{ marginBottom: 56 }} />
                <span className="eyebrow"><span className="rule" />{t.sec1Eye}</span>
                <h2 className="pg-h2">
                  {t.sec1Pre}<em>{t.sec1Em}</em>{t.sec1Post}
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

            {/* Sikkerhet — mono-spesifikasjonstabell */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.sec2Eye}</span>
                <h2 className="pg-h2">
                  {t.sec2Pre}<em>{t.sec2Em}</em>{t.sec2Post}
                </h2>
                <p className="pg-h2-sub">{t.sec2Sub}</p>
                <div className="pg-facts" style={{ maxWidth: 560, marginTop: 40 }}>
                  <div className="pg-facts-head">{t.specHead}</div>
                  {t.spec.map((row) => (
                    <div key={row.k} className="pg-facts-row">
                      <span className="pg-facts-key">{row.k}</span>
                      <span className="pg-facts-val">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Status — reasoning-step-tidslinje med ærlige datoer */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.sec3Eye}</span>
                <h2 className="pg-h2">
                  {t.sec3Pre}<em>{t.sec3Em}</em>{t.sec3Post}
                </h2>
                <div className="reasoning" style={{ marginTop: 48, maxWidth: 720 }}>
                  {steps.map((s) => (
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

            {/* Venteliste-CTA — lenker til /#venteliste (§8-05) */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.sec4Eye}</span>
                <h2 className="pg-h2">
                  {t.sec4Pre}<em>{t.sec4Em}</em>{t.sec4Post}
                </h2>
                <div className="hero-ctas pg-cta-row" style={{ marginTop: 36 }}>
                  <Link href="/#venteliste" className="btn btn-gold btn-lg">
                    {t.ctaWait} <ArrowRight size={16} />
                  </Link>
                </div>
                <p className="pg-mononote" style={{ marginTop: 24 }}>{t.foot}</p>
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
