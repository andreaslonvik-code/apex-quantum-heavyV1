'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { SignOutButton, useUser } from '@clerk/nextjs';
import { PageShell } from '@/app/components/marketing/page-shell';
import { PLUS_FOR_SALE, PLUS_DEV_LABELS } from '@/lib/product-status';
import { PLUS_SALES_PAUSED } from '@/lib/legal-copy';
import type { Lang } from '@/app/components/marketing/types';

const COPY: Record<
  Lang,
  {
    eye: string;
    title: string;
    sub: string;
    eyeSoon: string;
    titleSoon: string;
    subSoonPre: string;
    subSoonPost: string;
    bullets: readonly string[];
    foot: readonly string[];
    signedInAs: string;
    signOut: string;
    contact: string;
    startCta: string;
    starting: string;
    price: string;
  }
> = {
  no: {
    eye: 'BETA — VENTELISTE',
    title: 'Du er på listen.',
    sub: 'Apex Quantum + er i lukket beta mens vi finjusterer signal-pipelinen. Du kan starte abonnement nå og få full tilgang så snart beta åpnes for ditt nivå — eller vente til vi åpner bredt.',
    eyeSoon: 'UNDER UTVIKLING',
    titleSoon: 'Snart tilgjengelig.',
    subSoonPre: 'Apex Quantum + er under utvikling, og nye abonnement er midlertidig stengt.',
    subSoonPost: 'Eksisterende abonnenter beholder full tilgang — vi sier fra her så snart vi åpner igjen.',
    bullets: [
      'Daglige AI-signaler med begrunnelse',
      'Ukentlige markedsrapporter',
      'Spør AI om hvilken som helst aksje',
      'Tilgjengelig globalt — du velger megler',
    ],
    foot: ['Avbryt når som helst', 'Ingen bindingstid', 'Ingen suksesshonorar'],
    signedInAs: 'Pålogget som',
    signOut: 'Logg ut',
    contact: 'Spørsmål? Skriv til',
    startCta: 'Start abonnement',
    starting: 'Sender deg til Stripe…',
    price: '199 kr/mnd',
  },
  en: {
    eye: 'BETA — WAITLIST',
    title: 'You are on the list.',
    sub: 'Apex Quantum + is in closed beta while we tune the signal pipeline. You can start a subscription now and get full access the moment beta opens for your tier — or wait until we open widely.',
    eyeSoon: 'IN DEVELOPMENT',
    titleSoon: 'Coming soon.',
    subSoonPre: 'Apex Quantum + is in development, and new subscriptions are temporarily closed.',
    subSoonPost: 'Existing subscribers keep full access — we will post here the moment we reopen.',
    bullets: [
      'Daily AI signals with reasoning',
      'Weekly market reports',
      'Ask AI about any stock',
      'Available globally — pick any broker',
    ],
    foot: ['Cancel anytime', 'No commitment period', 'No performance fees'],
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    contact: 'Questions? Write to',
    startCta: 'Start subscription',
    starting: 'Redirecting to Stripe…',
    price: '199 kr/mo',
  },
};

function LegalNote({ lang }: { lang: Lang }) {
  const cyan = { color: 'var(--aq-cyan)' };
  if (lang === 'no') {
    return (
      <>
        Ved å starte abonnement godtar du{' '}
        <Link href="/vilkar" style={cyan}>vilkårene</Link>
        {' og '}
        <Link href="/personvern" style={cyan}>personvernerklæringen</Link>
        . Apex Quantum + er ikke individuell investeringsrådgivning.
      </>
    );
  }
  return (
    <>
      By starting a subscription you accept the{' '}
      <Link href="/vilkar" style={cyan}>terms</Link>
      {' and '}
      <Link href="/personvern" style={cyan}>privacy policy</Link>
      . Apex Quantum + is not individual investment advice.
    </>
  );
}

export function PlusComingSoon() {
  return <PageShell>{(lang: Lang) => <Inner lang={lang} />}</PageShell>;
}

function Inner({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const { user } = useUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/plus/checkout', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        const msg = data.detail
          ? `${data.error || 'error'}: ${data.detail}`
          : data.error || 'unknown';
        throw new Error(msg);
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      setStarting(false);
    }
  };

  return (
    <section style={{ padding: '160px 24px 120px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {PLUS_FOR_SALE ? t.eye : t.eyeSoon}
        </div>
        <h1
          style={{
            marginTop: 16,
            fontSize: 'clamp(40px, 6vw, 60px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          {PLUS_FOR_SALE ? t.title : t.titleSoon}
        </h1>
        <p
          style={{
            marginTop: 20,
            color: 'rgba(255,255,255,0.62)',
            fontSize: 18,
            lineHeight: 1.6,
          }}
        >
          {PLUS_FOR_SALE ? t.sub : `${t.subSoonPre} ${PLUS_SALES_PAUSED[lang]} ${t.subSoonPost}`}
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '40px auto 0',
            maxWidth: 480,
            display: 'grid',
            gap: 12,
            textAlign: 'left',
          }}
        >
          {t.bullets.map((b) => (
            <li key={b} style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
              <span style={{ color: 'var(--aq-cyan)' }}>→</span>
              {b}
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {PLUS_FOR_SALE ? (
            <>
              <button
                type="button"
                className="btn-primary-v8 btn-lg"
                onClick={handleStart}
                disabled={starting}
              >
                {starting ? t.starting : `${t.startCta} — ${t.price}`}
                {!starting && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
              <div className="m-foot-strip" style={{ justifyContent: 'center' }}>
                {t.foot.map((s, i) => (
                  <Fragment key={i}>
                    <span>{s}</span>
                    {i < t.foot.length - 1 && <span className="m-foot-sep">•</span>}
                  </Fragment>
                ))}
              </div>
              {error && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 14px',
                    background: 'var(--aq-down-tint)',
                    border: '1px solid var(--aq-down)',
                    borderRadius: 4,
                    fontSize: 13,
                    color: 'var(--aq-down-hi)',
                  }}
                >
                  {error}
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="btn-ghost-v8 btn-lg"
              disabled
              style={{ opacity: 0.55, cursor: 'not-allowed' }}
            >
              {PLUS_DEV_LABELS[lang].cta}
            </button>
          )}
        </div>

        {PLUS_FOR_SALE && (
          <p
            style={{
              marginTop: 24,
              maxWidth: 520,
              marginLeft: 'auto',
              marginRight: 'auto',
              fontSize: 12,
              color: 'var(--aq-muted)',
              lineHeight: 1.55,
            }}
          >
            <LegalNote lang={lang} />
          </p>
        )}

        <div
          style={{
            marginTop: 56,
            padding: '20px 24px',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid var(--aq-border)',
            borderRadius: 12,
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div className="cap-sm">{t.signedInAs}</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>{email ?? '—'}</div>
          <SignOutButton redirectUrl="/">
            <button type="button" className="btn-ghost-v8 btn-sm" style={{ marginTop: 8 }}>
              {t.signOut}
            </button>
          </SignOutButton>
        </div>

        <p style={{ marginTop: 28, color: 'var(--aq-muted)', fontSize: 13 }}>
          {t.contact}{' '}
          <a href="mailto:post@apex-quantum.com" style={{ color: 'var(--aq-cyan)' }}>
            post@apex-quantum.com
          </a>
        </p>
      </div>
    </section>
  );
}
