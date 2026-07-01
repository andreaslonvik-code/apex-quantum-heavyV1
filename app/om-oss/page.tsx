'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';
import { LEGAL_LINES, REG_STATUS } from '@/lib/legal-copy';

/**
 * /om-oss — den mest redaksjonelle siden (§9): Anfangen-drop-cap på
 * parchment, grunnleggerhistorie, tidslinje i reasoning-step-mønsteret,
 * «Selskapsfakta»-panel i mono nøkkel/verdi med lisensstatus fra
 * REG_STATUS, og regulatorisk status som egen h2 med tekst fra
 * lib/legal-copy. Legal-band via PageShell (§6 lag 3).
 */

const COPY = {
  no: {
    eye: 'Om oss',
    titlePre: 'Maskiner som arbeider. ',
    titleEm: 'Mennesker som står til ansvar',
    titlePost: '.',
    lede: 'Apex Quantum AS er et norsk teknologiselskap som bygger autonome handelssystemer for det amerikanske aksjemarkedet.',
    storyEye: '01 · Historien',
    storyTitle: 'Hvorfor vi bygger dette.',
    storyLede:
      'Apex Quantum ble startet på en enkel observasjon: de kvantitative strategiene som flytter markedene har vært forbeholdt hedgefond og proprietære handelsbord — ikke fordi de er magiske, men fordi infrastrukturen har vært dyr.',
    story: [
      'Vi brukte ett år på å utvikle en blueprint for hvordan AI-drevet aksjeanalyse skal utføres: hvilke kilder som veier tyngst, når modellen skal være forsiktig, og hvordan hver beslutning skal begrunnes før den får konsekvenser. I mai 2026 satte vi motoren live på Alpaca paper trading — simulert kapital, ekte marked, hver handel logget.',
      'Plattformen kobler seg til kundens egen meglerkonto via krypterte API-nøkler. Vi tar aldri imot, oppbevarer eller flytter kundens midler. Det er ikke et markedsføringspoeng — det er en arkitekturbeslutning som gjør at kunden alltid kan koble fra og trekke ut midler uten innblanding fra oss.',
      'Vi er et lite team med bakgrunn fra programvareutvikling, AI-forskning og kvantitativ handel. Alt vi publiserer av tall kan spores til en kjørende kilde med tidsstempel — det som ikke kan dokumenteres, vises ikke.',
    ],
    byline: '— Grunnleggeren, mai 2026',
    tlEye: '02 · Tidslinjen',
    tlTitlePre: 'Dag for dag, ',
    tlTitleEm: 'dokumentert',
    tlTitlePost: '.',
    timeline: [
      { tag: ['2025–2026', 'utvikling'], d: 'Blueprinten for AI-drevet aksjeanalyse utvikles over ett år — kildevekting, risikoregler og krav om begrunnelse per beslutning.' },
      { tag: ['MAI 2026', 'paper trading live'], d: 'Motoren settes live på Alpaca paper trading. Hver ordre, begrunnelse og hvert utfall logges — historikken bygges dag for dag, ingen tilbakeberegnede tall.' },
      { tag: ['FSC-SØKNAD', 'under behandling'], d: 'Lisenssøknad for Robotic and Artificial Intelligence Enabled Advisory Services er levert til Financial Services Commission, Mauritius. Lisensen er ennå ikke innvilget.' },
      { tag: ['2026/27', 'Apex Quantum Max'], d: 'Lansering av den autonome handelsmotoren er planlagt når lisens og infrastruktur er på plass.' },
    ],
    factsHead: 'Selskapsfakta',
    facts: [
      { k: 'Selskap', v: 'Apex Quantum AS' },
      { k: 'Org.nr', v: '921 269 962' },
      { k: 'Jurisdiksjon', v: 'Norge' },
      { k: 'Paper trading fra', v: 'Mai 2026' },
      { k: 'Lisensstatus', v: 'FSC MAURITIUS · UNDER BEHANDLING', tone: 'warn' as const },
      { k: 'Konsesjon (NO)', v: 'FORELIGGER IKKE', tone: 'faint' as const },
      { k: 'Megler', v: 'Alpaca Markets' },
      { k: 'Modus', v: 'PAPER TRADING' },
      { k: 'Kontakt', v: 'post@apex-quantum.com' },
    ],
    regEye: '03 · Regulatorisk status',
    regTitlePre: 'Der vi står, ',
    regTitleEm: 'uten omskriving',
    regTitlePost: '.',
    regLink: 'Fullstendige risikofaktorer →',
  },
  en: {
    eye: 'About us',
    titlePre: 'Machines that work. ',
    titleEm: 'People who answer for them',
    titlePost: '.',
    lede: 'Apex Quantum AS is a Norwegian technology company building autonomous trading systems for the US equity market.',
    storyEye: '01 · The story',
    storyTitle: 'Why we build this.',
    storyLede:
      'Apex Quantum started from a simple observation: the quantitative strategies that move markets have been reserved for hedge funds and proprietary desks — not because they are magic, but because the infrastructure has been expensive.',
    story: [
      'We spent a year developing a blueprint for how AI-driven equity analysis should be performed: which sources carry the most weight, when the model should be cautious, and how every decision must be justified before it has consequences. In May 2026 we put the engine live on Alpaca paper trading — simulated capital, real market, every trade logged.',
      'The platform connects to the customer’s own broker account via encrypted API keys. We never receive, hold or move customer funds. That is not a marketing point — it is an architectural decision that means the customer can always disconnect and withdraw without our involvement.',
      'We are a small team with backgrounds in software engineering, AI research and quantitative trading. Every figure we publish traces back to a running source with a timestamp — what cannot be documented is not shown.',
    ],
    byline: '— The founder, May 2026',
    tlEye: '02 · The timeline',
    tlTitlePre: 'Day by day, ',
    tlTitleEm: 'documented',
    tlTitlePost: '.',
    timeline: [
      { tag: ['2025–2026', 'development'], d: 'The blueprint for AI-driven equity analysis is developed over a year — source weighting, risk rules, and a reasoning requirement for every decision.' },
      { tag: ['MAY 2026', 'paper trading live'], d: 'The engine goes live on Alpaca paper trading. Every order, rationale and outcome is logged — the record is built day by day, no back-calculated figures.' },
      { tag: ['FSC APPLICATION', 'under review'], d: 'A licence application for Robotic and Artificial Intelligence Enabled Advisory Services has been filed with the Financial Services Commission, Mauritius. The licence has not yet been granted.' },
      { tag: ['2026/27', 'Apex Quantum Max'], d: 'Launch of the autonomous trading engine is planned once licensing and infrastructure are in place.' },
    ],
    factsHead: 'Company facts',
    facts: [
      { k: 'Company', v: 'Apex Quantum AS' },
      { k: 'Org. no', v: '921 269 962' },
      { k: 'Jurisdiction', v: 'Norway' },
      { k: 'Paper trading since', v: 'May 2026' },
      { k: 'Licence status', v: 'FSC MAURITIUS · UNDER REVIEW', tone: 'warn' as const },
      { k: 'Authorisation (NO)', v: 'NOT HELD', tone: 'faint' as const },
      { k: 'Broker', v: 'Alpaca Markets' },
      { k: 'Mode', v: 'PAPER TRADING' },
      { k: 'Contact', v: 'post@apex-quantum.com' },
    ],
    regEye: '03 · Regulatory status',
    regTitlePre: 'Where we stand, ',
    regTitleEm: 'plainly stated',
    regTitlePost: '.',
    regLink: 'Full risk factors →',
  },
} as const;

export default function OmOssPage() {
  return (
    <PageShell legalBand>
      {(lang: Lang) => {
        const t = COPY[lang];
        const lines = LEGAL_LINES[lang];
        const reg = REG_STATUS[lang];
        return (
          <>
            {/* Hode */}
            <section className="pg-hero">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.eye}</span>
                <h1>
                  {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-lede">{t.lede}</p>
              </div>
            </section>

            {/* Historien — parchment-bånd med Anfangen (§8-02-mønsteret) */}
            <section className="band-parch">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.storyEye}</span>
                <div className="pg-story">
                  <p className="pg-story-lede pg-dropcap">{t.storyLede}</p>
                  {t.story.map((p) => (
                    <p key={p.slice(0, 32)}>{p}</p>
                  ))}
                  <span className="pg-byline">{t.byline}</span>
                </div>
              </div>
            </section>

            {/* Tidslinje + Selskapsfakta */}
            <section className="pg-section">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.tlEye}</span>
                <h2 className="pg-h2">
                  {t.tlTitlePre}<em>{t.tlTitleEm}</em>{t.tlTitlePost}
                </h2>
                <div className="pg-about-grid">
                  <div className="reasoning">
                    {t.timeline.map((step) => (
                      <div key={step.tag[0]} className="reasoning-step">
                        <span className="step-tag">
                          {step.tag[0]}<span className="time">· {step.tag[1]}</span>
                        </span>
                        <span className="step-line">{step.d}</span>
                      </div>
                    ))}
                  </div>
                  <aside className="pg-facts" aria-label={t.factsHead}>
                    <div className="pg-facts-head">{t.factsHead}</div>
                    {t.facts.map((row) => (
                      <div key={row.k} className="pg-facts-row">
                        <span className="pg-facts-key">{row.k}</span>
                        <span
                          className={
                            'tone' in row && row.tone
                              ? `pg-facts-val ${row.tone}`
                              : 'pg-facts-val'
                          }
                        >
                          {row.v}
                        </span>
                      </div>
                    ))}
                  </aside>
                </div>
              </div>
            </section>

            {/* Regulatorisk status — ærlig tekst fra legal-copy */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.regEye}</span>
                <h2 className="pg-h2">
                  {t.regTitlePre}<em>{t.regTitleEm}</em>{t.regTitlePost}
                </h2>
                <div className="pg-regcards">
                  <div className="pg-regcard">
                    <span className="pg-regcard-label">{reg.fscLabel}</span>
                    <span className="pg-regcard-status" data-tone="warn">
                      <span className="pg-dot" data-tone="warn" aria-hidden />
                      {reg.fscStatus}
                    </span>
                  </div>
                  <div className="pg-regcard">
                    <span className="pg-regcard-label">{reg.ftLabel}</span>
                    <span className="pg-regcard-status" data-tone="faint">
                      <span className="pg-dot" data-tone="faint" aria-hidden />
                      {reg.ftStatus}
                    </span>
                  </div>
                </div>
                <div style={{ maxWidth: 760, marginTop: 32 }}>
                  <p className="pg-sub" style={{ marginTop: 0 }}>{lines.l1}</p>
                  <p className="pg-sub">{lines.l2}</p>
                  <p className="pg-sub">{lines.l3}</p>
                  <p className="pg-mononote" style={{ marginTop: 24 }}>
                    <Link href="/risikofaktorer" style={{ color: 'var(--aq-cyan-hi)' }}>
                      {t.regLink}
                    </Link>
                  </p>
                </div>
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
