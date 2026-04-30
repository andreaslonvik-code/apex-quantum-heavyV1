'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    eye: 'PRIS',
    title: 'Én plan. Full tilgang.',
    sub: 'Apex Quantum er en abonnementstjeneste. Ingen gjemte gebyrer, ingen suksesshonorar. Du beholder 100 % av avkastningen.',
    planName: 'Apex Quantum',
    price: '4 990 kr',
    cycle: '/mnd',
    altPrice: '≈ $499/mnd for utenlandske kunder',
    cta: 'Koble til Alpaca',
    bullets: [
      'Autonom AI-handel med Grok-4-Heavy',
      'US equities — NASDAQ, NYSE, ARCA, AMEX',
      'AES-256-GCM krypterte API-nøkler',
      'Live cockpit, P&L og porteføljegraf',
      'Ta ut avkastning på ett klikk',
      'E-poststøtte med 24t responstid',
      '30 dagers risikofri prøveperiode',
      'Avslutt når du vil',
    ],
    foot: 'Prisen oppgis eksklusive merverdiavgift der det er aktuelt. Ved betaling i utenlandsk valuta benyttes dagskursen ved fakturering.',
  },
  en: {
    eye: 'PRICING',
    title: 'One plan. Full access.',
    sub: 'Apex Quantum is a subscription product. No hidden fees, no performance fees. You keep 100% of the upside.',
    planName: 'Apex Quantum',
    price: '$499',
    cycle: '/month',
    altPrice: '≈ 4 990 kr/month for Norwegian customers',
    cta: 'Connect Alpaca',
    bullets: [
      'Autonomous AI trading with Grok-4-Heavy',
      'US equities — NASDAQ, NYSE, ARCA, AMEX',
      'AES-256-GCM encrypted API keys',
      'Live cockpit, P&L and portfolio chart',
      'Withdraw profits with one click',
      'Email support with 24h response',
      '30-day risk-free trial',
      'Cancel anytime',
    ],
    foot: 'Prices are quoted exclusive of VAT where applicable. Foreign-currency invoices use the daily exchange rate at billing time.',
  },
} as const;

export default function PrisPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
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
              className="m-live-card"
              style={{ maxWidth: 520, margin: '64px auto 0', padding: 40, textAlign: 'center' }}
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
                {t.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      display: 'flex',
                      gap: 12,
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: 15,
                    }}
                  >
                    <span style={{ color: 'var(--aq-cyan)' }}>→</span>
                    {b}
                  </li>
                ))}
              </ul>
              <Link href="/connect-alpaca" className="btn-primary-v8 btn-lg" style={{ marginTop: 32 }}>
                {t.cta}
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
              {t.foot}
            </p>
          </section>
        );
      }}
    </PageShell>
  );
}
