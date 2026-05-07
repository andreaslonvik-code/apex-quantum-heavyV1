'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SignOutButton, useUser } from '@clerk/nextjs';
import { MHeader } from '@/app/components/marketing/header';
import { MFooter } from '@/app/components/marketing/footer';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    eye: 'APEX QUANTUM +',
    title: 'Velkommen,',
    sub: 'Du er meldt på Apex Quantum +. Plattformen er under aktiv utvikling — daglige signaler, ukentlige rapporter, læringsmoduler og praksisportefølje kommer trinnvis. Vi gir deg beskjed på e-post når hver del lanseres.',
    rdyTitle: 'Hva som kommer',
    rdyItems: [
      ['Daglige AI-signaler', 'Med fullstendig begrunnelse for hvert signal — du lærer hvorfor, ikke bare hva.'],
      ['Ukentlige markedsrapporter', 'Sektorrotasjon, makro-faktorer og hva modellen følger med på neste uke.'],
      ['Læringsmoduler', 'Strukturert pensum fra nybegynner til avansert, med eksempler fra ekte signaler.'],
      ['Praksisportefølje', 'Bygg en virtuell portefølje med live priser. Test ideer uten å risikere kapital.'],
    ],
    maxTitle: 'Du har også tilgang til Apex Quantum Max',
    maxSub: 'Som tidlig allowlist-bruker har du full tilgang til den autonome trading-motoren mens den er under utvikling.',
    maxCta: 'Åpne Apex Quantum Max',
    signOut: 'Logg ut',
  },
  en: {
    eye: 'APEX QUANTUM +',
    title: 'Welcome,',
    sub: 'You are signed up for Apex Quantum +. The platform is under active development — daily signals, weekly reports, learning modules and practice portfolio launch progressively. We will notify you by email as each part ships.',
    rdyTitle: 'What is coming',
    rdyItems: [
      ['Daily AI signals', 'With full reasoning for every signal — you learn the why, not just the what.'],
      ['Weekly market reports', 'Sector rotation, macro factors and what the model is watching next week.'],
      ['Learning modules', 'Structured curriculum from beginner to advanced, with real signal examples.'],
      ['Practice portfolio', 'Build a virtual portfolio with live prices. Test ideas without risking capital.'],
    ],
    maxTitle: 'You also have access to Apex Quantum Max',
    maxSub: 'As an early allowlist user, you have full access to the autonomous trading engine while it is in development.',
    maxCta: 'Open Apex Quantum Max',
    signOut: 'Sign out',
  },
} as const;

interface Props {
  allowlisted: boolean;
}

export default function PlusDashboardClient({ allowlisted }: Props) {
  const [lang, setLang] = useState<Lang>('no');
  const { user } = useUser();
  const t = COPY[lang];
  const firstName = user?.firstName || user?.username || (lang === 'no' ? 'der' : 'there');

  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <MHeader lang={lang} setLang={setLang} />
      <main className="relative" style={{ zIndex: 2, padding: '120px 24px 80px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
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
            {t.title} {firstName}.
          </h1>
          <p
            style={{
              marginTop: 20,
              maxWidth: 680,
              color: 'rgba(255,255,255,0.65)',
              fontSize: 18,
              lineHeight: 1.6,
            }}
          >
            {t.sub}
          </p>

          {allowlisted && (
            <div
              className="m-feat-card"
              style={{
                marginTop: 48,
                padding: 32,
                borderColor: 'rgba(0,245,255,0.35)',
                background:
                  'linear-gradient(135deg, rgba(0,245,255,0.06), rgba(0,245,255,0.01))',
              }}
            >
              <div
                className="aq-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  color: 'var(--aq-cyan)',
                  marginBottom: 12,
                }}
              >
                APEX QUANTUM MAX · ALLOWLIST
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {t.maxTitle}
              </h2>
              <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.6 }}>
                {t.maxSub}
              </p>
              <Link
                href="/max"
                className="btn-primary-v8 btn-lg"
                style={{ marginTop: 20, display: 'inline-flex' }}
              >
                {t.maxCta}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

          <div style={{ marginTop: 64 }}>
            <div className="cap-sm">{t.rdyTitle}</div>
            <div
              style={{
                marginTop: 24,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {t.rdyItems.map(([title, desc]) => (
                <div key={title} className="m-feat-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h3>
                  <p
                    style={{
                      marginTop: 8,
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: 14,
                      lineHeight: 1.55,
                    }}
                  >
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 64 }}>
            <SignOutButton redirectUrl="/">
              <button type="button" className="btn-ghost-v8 btn-sm">
                {t.signOut}
              </button>
            </SignOutButton>
          </div>
        </div>
      </main>
      <MFooter lang={lang} />
    </>
  );
}
