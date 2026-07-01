'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import { ArrowRight, Check } from '@/app/components/marketing-v2/icons';
import { PLUS_FOR_SALE, PLUS_DEV_LABELS } from '@/lib/product-status';
import { LEGAL_LINES } from '@/lib/legal-copy';
import type { Lang } from '@/app/components/marketing/types';

/**
 * /pris — TiersV2-mønsteret gjenbygd lokalt med aqv2-klasser (§9),
 * sammenligningstabell i ledger-vokabular, FAQ med details/summary
 * og legal-band via PageShell. NOK primært; USD i EN-konteksten.
 */

type CmpCell = { check?: boolean; text?: string; none?: boolean };

const COPY = {
  no: {
    eye: 'Pris',
    titlePre: 'To planer. ',
    titleEm: 'Velg din vei',
    titlePost: '.',
    sub: 'Begynn med Apex Quantum + og lær markedet i ditt eget tempo. Apex Quantum Max — den autonome handelsmotoren — er under utvikling med lansering planlagt i 2026.',
    plus: {
      tag: 'TILGJENGELIG NÅ',
      tagline: 'Signaler, rapporter og læring.',
      currency: '199',
      cycle: 'kr / mnd',
      bullets: [
        'Daglige AI-signaler med begrunnelse',
        'Ukentlige markedsrapporter',
        'Læringsmoduler — nybegynner til avansert',
        'Praksisportefølje med live priser',
        'Ordbok og investeringsjournal',
        'Tilgjengelig globalt — ingen meglerbinding',
      ],
      cta: 'Start nå',
      cta2: 'Les mer',
    },
    max: {
      tag: 'UNDER UTVIKLING · 2026',
      tagline: 'Fullautomatisk AI-handel.',
      currency: '4 990',
      cycle: 'kr / mnd',
      bullets: [
        'Autonom handel via din egen Alpaca-konto',
        'US equities — NASDAQ, NYSE, ARCA, AMEX',
        'AES-256-GCM-krypterte API-nøkler',
        'Live cockpit, P&L og porteføljegraf',
        'Kill-switch — stans motoren når som helst',
        'E-poststøtte med 24 t responstid',
      ],
      cta: 'Varsle meg',
      cta2: 'Detaljer',
    },
    cmpEye: 'Sammenligning',
    cmpTitlePre: 'Side ved side, ',
    cmpTitleEm: 'linje for linje',
    cmpTitlePost: '.',
    cmpHead: ['', 'Plus', 'Max'],
    cmpRows: [
      { f: 'Pris per måned', plus: { text: '199 kr' }, max: { text: '4 990 kr' } },
      { f: 'Daglige AI-signaler med begrunnelse', plus: { check: true }, max: { check: true } },
      { f: 'Ukentlige markedsrapporter', plus: { check: true }, max: { check: true } },
      { f: 'Læringsmoduler og ordbok', plus: { check: true }, max: { none: true } },
      { f: 'Praksisportefølje og journal', plus: { check: true }, max: { none: true } },
      { f: 'Autonom ordreutførelse via Alpaca', plus: { none: true }, max: { check: true } },
      { f: 'Live cockpit med kill-switch', plus: { none: true }, max: { check: true } },
      { f: 'AES-256-GCM-krypterte API-nøkler', plus: { none: true }, max: { check: true } },
      { f: 'Binding', plus: { text: 'Ingen' }, max: { text: 'Ingen' } },
    ] as Array<{ f: string; plus: CmpCell; max: CmpCell }>,
    faqEye: 'FAQ',
    faqTitlePre: 'Ofte stilte ',
    faqTitleEm: 'spørsmål',
    faqTitlePost: '.',
    faqs: [
      ['Er det bindingstid?', 'Nei. Begge planene er løpende månedsabonnement uten binding. Du kan avslutte når som helst, og tilgangen løper ut måneden du allerede har betalt for.'],
      ['Hva er forskjellen på Plus og Max?', 'Plus er en lærings- og analyseplattform: du får signaler med begrunnelse, rapporter og læringsmoduler — og tar alle handelsbeslutninger selv, hos din egen megler. Max er den autonome motoren som legger inn ordre for deg via din egen Alpaca-konto. Max er under utvikling, med lansering planlagt i 2026.'],
      ['Handler dere med pengene mine?', 'Nei. Vi mottar, oppbevarer eller flytter aldri kundens midler. Max kobler seg til din egen Alpaca-konto via krypterte API-nøkler — midlene står hos megleren, og du kan koble fra når som helst.'],
      ['Hva betyr «paper trading»?', 'Paper trading dokumenterer hvordan motoren faktisk oppfører seg i ekte marked — uten at reell kapital står på spill.'],
      ['Hvilken valuta betaler jeg i?', 'Norske kunder betaler i NOK. Internasjonale kunder betaler tilsvarende beløp i USD. Priser oppgis inkludert merverdiavgift der det er aktuelt; ved betaling i utenlandsk valuta benyttes dagskursen ved fakturering.'],
      ['Er dette investeringsrådgivning?', 'Nei. Innholdet er generell markedsanalyse og læringsinnhold, ikke individuell investeringsrådgivning. Les risikofaktorene før du starter.'],
    ],
    foot: 'Priser oppgis inkludert merverdiavgift der det er aktuelt. Ved betaling i utenlandsk valuta benyttes dagskursen ved fakturering.',
    riskLink: 'Les risikofaktorene først →',
  },
  en: {
    eye: 'Pricing',
    titlePre: 'Two plans. ',
    titleEm: 'Pick your path',
    titlePost: '.',
    sub: 'Begin with Apex Quantum + and learn the market at your own pace. Apex Quantum Max — the autonomous trading engine — is in development with launch planned for 2026.',
    plus: {
      tag: 'AVAILABLE NOW',
      tagline: 'Signals, reports and learning.',
      currency: '19',
      cycle: '$ / month',
      bullets: [
        'Daily AI signals with reasoning',
        'Weekly market reports',
        'Learning modules — beginner to advanced',
        'Practice portfolio with live prices',
        'Glossary and investment journal',
        'Available globally — no broker lock-in',
      ],
      cta: 'Start now',
      cta2: 'Learn more',
    },
    max: {
      tag: 'IN DEVELOPMENT · 2026',
      tagline: 'Fully autonomous AI trading.',
      currency: '499',
      cycle: '$ / month',
      bullets: [
        'Autonomous trading via your own Alpaca account',
        'US equities — NASDAQ, NYSE, ARCA, AMEX',
        'AES-256-GCM encrypted API keys',
        'Live cockpit, P&L and portfolio chart',
        'Kill switch — stop the engine at any time',
        'Email support with 24 h response',
      ],
      cta: 'Notify me',
      cta2: 'Details',
    },
    cmpEye: 'Comparison',
    cmpTitlePre: 'Side by side, ',
    cmpTitleEm: 'line by line',
    cmpTitlePost: '.',
    cmpHead: ['', 'Plus', 'Max'],
    cmpRows: [
      { f: 'Price per month', plus: { text: '$19' }, max: { text: '$499' } },
      { f: 'Daily AI signals with reasoning', plus: { check: true }, max: { check: true } },
      { f: 'Weekly market reports', plus: { check: true }, max: { check: true } },
      { f: 'Learning modules and glossary', plus: { check: true }, max: { none: true } },
      { f: 'Practice portfolio and journal', plus: { check: true }, max: { none: true } },
      { f: 'Autonomous order execution via Alpaca', plus: { none: true }, max: { check: true } },
      { f: 'Live cockpit with kill switch', plus: { none: true }, max: { check: true } },
      { f: 'AES-256-GCM encrypted API keys', plus: { none: true }, max: { check: true } },
      { f: 'Commitment', plus: { text: 'None' }, max: { text: 'None' } },
    ] as Array<{ f: string; plus: CmpCell; max: CmpCell }>,
    faqEye: 'FAQ',
    faqTitlePre: 'Frequently asked ',
    faqTitleEm: 'questions',
    faqTitlePost: '.',
    faqs: [
      ['Is there a commitment period?', 'No. Both plans are rolling monthly subscriptions with no lock-in. Cancel any time; access runs to the end of the month already paid for.'],
      ['What is the difference between Plus and Max?', 'Plus is a learning and analysis platform: you get signals with reasoning, reports and learning modules — and make every trading decision yourself, at your own broker. Max is the autonomous engine that places orders for you via your own Alpaca account. Max is in development, with launch planned for 2026.'],
      ['Do you trade with my money?', 'No. We never receive, hold or move customer funds. Max connects to your own Alpaca account via encrypted API keys — the funds stay with the broker, and you can disconnect at any time.'],
      ['What does "paper trading" mean?', 'Paper trading documents how the engine actually behaves in a real market — without real capital at stake.'],
      ['Which currency do I pay in?', 'Norwegian customers pay in NOK. International customers pay the equivalent amount in USD. Prices include VAT where applicable; foreign-currency invoices use the daily exchange rate at billing time.'],
      ['Is this investment advice?', 'No. The content is general market analysis and educational material, not individual investment advice. Read the risk factors before you start.'],
    ],
    foot: 'Prices include VAT where applicable. Foreign-currency invoices use the daily exchange rate at billing time.',
    riskLink: 'Read the risk factors first →',
  },
} as const;

function CmpValue({ cell, kind }: { cell: CmpCell; kind: 'cyan' | 'gold' }) {
  if (cell.check) {
    return (
      <span className="pg-cmp-val">
        <span className={kind === 'gold' ? 'mark-gold' : 'mark-cy'}><Check /></span>
      </span>
    );
  }
  if (cell.none) return <span className="pg-cmp-val none">—</span>;
  return <span className="pg-cmp-val">{cell.text}</span>;
}

export default function PrisPage() {
  return (
    <PageShell legalBand>
      {(lang: Lang) => {
        const t = COPY[lang];
        const L = LEGAL_LINES[lang];
        // Kanoniske juridiske setninger skjøtes inn fra lib/legal-copy —
        // FAQ 4 (paper trading) får L5+L4, FAQ 6 (rådgivning) får L3.
        const faqs = t.faqs.map(([q, a], i) => {
          if (i === 3) return [q, `${L.l5} ${a} ${L.l4}`] as const;
          if (i === 5) return [q, `${a} ${L.l3}`] as const;
          return [q, a] as const;
        });
        const plusAvailable = PLUS_FOR_SALE;
        const plusTag = plusAvailable ? t.plus.tag : PLUS_DEV_LABELS[lang].tag;
        const plusCta = plusAvailable ? t.plus.cta : PLUS_DEV_LABELS[lang].cta;
        const maxMailto =
          'mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me';
        return (
          <>
            {/* Hode */}
            <section className="pg-hero">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.eye}</span>
                <h1>
                  {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-sub" style={{ fontSize: 17 }}>{t.sub}</p>
              </div>
            </section>

            {/* Tiers — TiersV2-mønsteret, bygget lokalt */}
            <section className="pg-section" style={{ paddingTop: 8 }}>
              <div className="container">
                <div className="tiers-grid">
                  {/* Plus — cyan */}
                  <div className={plusAvailable ? 'tier' : 'tier dev'}>
                    <div className="tier-head">
                      <h3 className="tier-name">
                        <span>Apex Quantum </span>
                        <span className="cyan">+</span>
                      </h3>
                      <span className={plusAvailable ? 'aqv2-tag cy' : 'aqv2-tag dev'}>
                        {plusAvailable ? <span className="aqv2-dot" /> : null}
                        {plusTag}
                      </span>
                    </div>
                    <p className="tier-tagline">{t.plus.tagline}</p>
                    <div className="tier-price-row">
                      <span className="tier-price">{t.plus.currency}</span>
                      <span className="tier-cycle">{t.plus.cycle}</span>
                    </div>
                    <ul>
                      {t.plus.bullets.map((b) => (
                        <li key={b}><span className="mark"><Check /></span>{b}</li>
                      ))}
                    </ul>
                    <div className="tier-actions">
                      {plusAvailable ? (
                        <Link href="/sign-up" className="btn btn-cyan">
                          {plusCta} <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <button type="button" className="btn btn-cyan" disabled>
                          {plusCta}
                        </button>
                      )}
                      <Link href="/plus" className="btn btn-ghost">{t.plus.cta2}</Link>
                    </div>
                  </div>

                  {/* Max — gull */}
                  <div className="tier gold dev">
                    <div className="tier-head">
                      <h3 className="tier-name">
                        <span>Apex Quantum </span>
                        <span className="gold">Max</span>
                      </h3>
                      <span className="aqv2-tag gold">{t.max.tag}</span>
                    </div>
                    <p className="tier-tagline">{t.max.tagline}</p>
                    <div className="tier-price-row">
                      <span className="tier-price">{t.max.currency}</span>
                      <span className="tier-cycle">{t.max.cycle}</span>
                    </div>
                    <ul>
                      {t.max.bullets.map((b) => (
                        <li key={b}><span className="mark"><Check /></span>{b}</li>
                      ))}
                    </ul>
                    <div className="tier-actions">
                      <a href={maxMailto} className="btn btn-gold">
                        {t.max.cta} <ArrowRight size={14} />
                      </a>
                      <Link href="/max" className="btn btn-ghost">{t.max.cta2}</Link>
                    </div>
                  </div>
                </div>
                <p className="pg-mononote" style={{ marginTop: 24 }}>
                  {lang === 'no'
                    ? 'BEGGE: AES-256-GCM-krypterte nøkler · Ingen binding · NO/EN'
                    : 'BOTH: AES-256-GCM encrypted keys · No commitment · NO/EN'}
                </p>
              </div>
            </section>

            {/* Sammenligningstabell — ledger-vokabular */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.cmpEye}</span>
                <h2 className="pg-h2">
                  {t.cmpTitlePre}<em>{t.cmpTitleEm}</em>{t.cmpTitlePost}
                </h2>
                <div className="pg-cmp">
                  <div className="pg-cmp-row head">
                    <span>{t.cmpHead[0]}</span>
                    <span className="cy">{t.cmpHead[1]}</span>
                    <span className="gold">{t.cmpHead[2]}</span>
                  </div>
                  {t.cmpRows.map((row) => (
                    <div key={row.f} className="pg-cmp-row">
                      <span className="pg-cmp-feature">{row.f}</span>
                      <CmpValue cell={row.plus} kind="cyan" />
                      <CmpValue cell={row.max} kind="gold" />
                    </div>
                  ))}
                </div>
                <p className="pg-sub" style={{ fontSize: 13.5, marginTop: 20 }}>{t.foot}</p>
              </div>
            </section>

            {/* FAQ */}
            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.faqEye}</span>
                <h2 className="pg-h2">
                  {t.faqTitlePre}<em>{t.faqTitleEm}</em>{t.faqTitlePost}
                </h2>
                <div className="pg-faq">
                  {faqs.map(([q, a]) => (
                    <details key={q}>
                      <summary>
                        {q}
                        <svg
                          className="pg-faq-chev"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </summary>
                      <p className="pg-faq-body">{a}</p>
                    </details>
                  ))}
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
