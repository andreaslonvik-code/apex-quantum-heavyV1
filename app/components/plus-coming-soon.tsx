'use client';

import { Fragment } from 'react';
import { SignOutButton, useUser } from '@clerk/nextjs';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY: Record<
  Lang,
  {
    eye: string;
    title: string;
    sub: string;
    bullets: readonly string[];
    foot: readonly string[];
    signedInAs: string;
    signOut: string;
    contact: string;
  }
> = {
  no: {
    eye: 'BETA — VENTELISTE',
    title: 'Du er på listen.',
    sub: 'Apex Quantum + er i lukket beta mens vi finjusterer signal-pipelinen. Du får e-post fra oss så snart tilgangen åpnes — uten ekstra ventetid.',
    bullets: [
      'Daglige AI-signaler med begrunnelse',
      'Ukentlige markedsrapporter',
      'Spør AI om hvilken som helst aksje',
      'Tilgjengelig globalt — du velger megler',
    ],
    foot: ['Beta åpner i løpet av kort tid', 'Vi varsler deg på e-post', 'Ingen forhåndsbetaling'],
    signedInAs: 'Pålogget som',
    signOut: 'Logg ut',
    contact: 'Spørsmål? Skriv til',
  },
  en: {
    eye: 'BETA — WAITLIST',
    title: 'You are on the list.',
    sub: 'Apex Quantum + is in closed beta while we tune the signal pipeline. You will get an email from us the moment access opens — no further waiting.',
    bullets: [
      'Daily AI signals with reasoning',
      'Weekly market reports',
      'Ask AI about any stock',
      'Available globally — pick any broker',
    ],
    foot: ['Beta opens shortly', 'We notify you by email', 'No prepayment'],
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    contact: 'Questions? Write to',
  },
};

export function PlusComingSoon() {
  return <PageShell>{(lang: Lang) => <Inner lang={lang} />}</PageShell>;
}

function Inner({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const { user } = useUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  return (
    <section style={{ padding: '160px 24px 120px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {t.eye}
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

        <div
          style={{
            marginTop: 48,
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

        <div className="m-foot-strip" style={{ justifyContent: 'center', marginTop: 32 }}>
          {t.foot.map((s, i) => (
            <Fragment key={i}>
              <span>{s}</span>
              {i < t.foot.length - 1 && <span className="m-foot-sep">•</span>}
            </Fragment>
          ))}
        </div>

        <p style={{ marginTop: 28, color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>
          {t.contact}{' '}
          <a href="mailto:post@apex-quantum.com" style={{ color: 'var(--aq-cyan)' }}>
            post@apex-quantum.com
          </a>
        </p>
      </div>
    </section>
  );
}
