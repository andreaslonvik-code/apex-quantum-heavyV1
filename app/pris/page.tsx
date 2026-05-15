'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import { PLUS_FOR_SALE, PLUS_DEV_LABELS } from '@/lib/product-status';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    eye: 'PRIS',
    title: 'To planer. Velg din vei.',
    sub: 'Begynn med Apex Quantum + og lær markedet i ditt eget tempo. Apex Quantum Max — den fullautomatiske trading-motoren — kommer snart.',
    plus: {
      tag: 'TILGJENGELIG NÅ',
      name: 'Apex Quantum +',
      tagline: 'Signaler, rapporter og læring',
      price: '199 kr',
      cycle: '/mnd',
      altPrice: '≈ $19/mnd internasjonalt',
      bullets: [
        'Daglige AI-signaler med begrunnelse',
        'Ukentlige markedsrapporter',
        'Læringsmoduler — nybegynner til avansert',
        'Praksisportefølje med live priser',
        'Ordbok og investeringsjournal',
        'Tilgjengelig globalt — ingen meglerbinding',
        'E-poststøtte',
        'Ingen binding — avbryt når som helst',
      ],
      cta: 'Start nå',
      ctaHref: '/sign-up',
      ctaPrimary: true,
    },
    max: {
      tag: 'UNDER UTVIKLING',
      name: 'Apex Quantum Max',
      tagline: 'Fullautomatisk AI-trading',
      price: '4 990 kr',
      cycle: '/mnd',
      altPrice: '≈ $499/mnd for utenlandske kunder',
      bullets: [
        'Autonom AI-handel — drevet av en blueprint utviklet over et år',
        'US equities — NASDAQ, NYSE, ARCA, AMEX',
        'AES-256-GCM krypterte API-nøkler',
        'Live cockpit, P&L og porteføljegraf',
        'Ta ut avkastning på ett klikk',
        'E-poststøtte med 24t responstid',
        'Lansering planlagt 2026',
      ],
      cta: 'Varsle meg',
      ctaHref: 'mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me',
      ctaPrimary: false,
    },
    foot: 'Priser oppgis eksklusive merverdiavgift der det er aktuelt. Ved betaling i utenlandsk valuta benyttes dagskursen ved fakturering.',
  },
  en: {
    eye: 'PRICING',
    title: 'Two plans. Pick your path.',
    sub: 'Begin with Apex Quantum + and learn the market at your own pace. Apex Quantum Max — the fully autonomous trading engine — is coming soon.',
    plus: {
      tag: 'AVAILABLE NOW',
      name: 'Apex Quantum +',
      tagline: 'Signals, reports and learning',
      price: '$19',
      cycle: '/month',
      altPrice: '≈ 199 kr/month for Norwegian customers',
      bullets: [
        'Daily AI signals with reasoning',
        'Weekly market reports',
        'Learning modules — beginner to advanced',
        'Practice portfolio with live prices',
        'Glossary and investment journal',
        'Available globally — no broker lock-in',
        'Email support',
        'No commitment — cancel anytime',
      ],
      cta: 'Start now',
      ctaHref: '/sign-up',
      ctaPrimary: true,
    },
    max: {
      tag: 'IN DEVELOPMENT',
      name: 'Apex Quantum Max',
      tagline: 'Fully autonomous AI trading',
      price: '$499',
      cycle: '/month',
      altPrice: '≈ 4 990 kr/month for Norwegian customers',
      bullets: [
        'Autonomous AI trading — driven by a blueprint developed over a year',
        'US equities — NASDAQ, NYSE, ARCA, AMEX',
        'AES-256-GCM encrypted API keys',
        'Live cockpit, P&L and portfolio chart',
        'Withdraw profits with one click',
        'Email support with 24h response',
        'Launch planned 2026',
      ],
      cta: 'Notify me',
      ctaHref: 'mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me',
      ctaPrimary: false,
    },
    foot: 'Prices are quoted exclusive of VAT where applicable. Foreign-currency invoices use the daily exchange rate at billing time.',
  },
} as const;

export default function PrisPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        // Plus sales are paused (see lib/product-status.ts) — show the
        // in-development badge and a disabled CTA, mirroring the Max plan.
        const plusPlan = {
          ...t.plus,
          tag: PLUS_FOR_SALE ? t.plus.tag : PLUS_DEV_LABELS[lang].tag,
          cta: PLUS_FOR_SALE ? t.plus.cta : PLUS_DEV_LABELS[lang].cta,
          ctaPrimary: PLUS_FOR_SALE,
          ctaDisabled: !PLUS_FOR_SALE,
        };
        const plans = [plusPlan, { ...t.max, ctaDisabled: false }];
        return (
          <section style={{ padding: '140px 24px 96px' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
              <div className="m-eyebrow">
                <span className="m-badge-dot" />
                {t.eye}
              </div>
              <h1
                style={{
                  marginTop: 16,
                  fontSize: 'clamp(40px, 6vw, 64px)',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                }}
              >
                {t.title}
              </h1>
              <p
                style={{
                  marginTop: 20,
                  color: 'rgba(255,255,255,0.62)',
                  fontSize: 18,
                  lineHeight: 1.6,
                }}
              >
                {t.sub}
              </p>
            </div>

            <div
              style={{
                maxWidth: 980,
                margin: '64px auto 0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24,
                alignItems: 'stretch',
              }}
            >
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className="m-live-card"
                  style={{
                    padding: 36,
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: plan.ctaPrimary ? 1 : 0.92,
                  }}
                >
                  <div
                    className="aq-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      color: plan.ctaPrimary ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.45)',
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
                        background: plan.ctaPrimary ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.4)',
                        boxShadow: plan.ctaPrimary ? '0 0 8px rgba(0,245,255,0.6)' : 'none',
                      }}
                    />
                    {plan.tag}
                  </div>
                  <div className="cap-sm">{plan.name}</div>
                  <p
                    style={{
                      margin: '6px 0 0',
                      color: 'rgba(255,255,255,0.55)',
                      fontSize: 14,
                    }}
                  >
                    {plan.tagline}
                  </p>
                  <div
                    style={{
                      marginTop: 24,
                      fontSize: 56,
                      fontWeight: 700,
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                    }}
                  >
                    {plan.price}
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.6)',
                        marginLeft: 6,
                      }}
                    >
                      {plan.cycle}
                    </span>
                  </div>
                  <div
                    className="aq-mono"
                    style={{ marginTop: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}
                  >
                    {plan.altPrice}
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '32px 0 0',
                      display: 'grid',
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    {plan.bullets.map((b) => (
                      <li
                        key={b}
                        style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.85)', fontSize: 15 }}
                      >
                        <span style={{ color: plan.ctaPrimary ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.45)' }}>→</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {plan.ctaDisabled ? (
                    <button
                      type="button"
                      className="btn-ghost-v8 btn-lg"
                      disabled
                      style={{ marginTop: 32, opacity: 0.55, cursor: 'not-allowed' }}
                    >
                      {plan.cta}
                    </button>
                  ) : plan.ctaHref.startsWith('mailto:') ? (
                    <a
                      href={plan.ctaHref}
                      className={plan.ctaPrimary ? 'btn-primary-v8 btn-lg' : 'btn-ghost-v8 btn-lg'}
                      style={{ marginTop: 32 }}
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaHref}
                      className={plan.ctaPrimary ? 'btn-primary-v8 btn-lg' : 'btn-ghost-v8 btn-lg'}
                      style={{ marginTop: 32 }}
                    >
                      {plan.cta}
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              ))}
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
              {t.foot}
            </p>
          </section>
        );
      }}
    </PageShell>
  );
}
