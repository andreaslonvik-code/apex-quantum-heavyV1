'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import type { Lang } from './types';

export function CTA({ lang }: { lang: Lang }) {
  const t =
    lang === 'no'
      ? {
          eye: 'KOM I GANG',
          title: 'Slipp agenten løs på kontoen din.',
          sub: 'Lim inn dine egne Alpaca-nøkler. Vi krypterer dem AES-256-GCM. Du beholder full kontroll — koble fra når som helst.',
          cta: 'Koble til Alpaca',
          cta2: 'Book demo',
          foot: ['Fra 499 kr/mnd', '30 dagers risikofri prøveperiode', 'Avslutt når du vil'],
        }
      : {
          eye: 'GET STARTED',
          title: 'Let the agent loose on your account.',
          sub: 'Paste your own Alpaca keys. We encrypt them AES-256-GCM. You keep full control — disconnect anytime.',
          cta: 'Connect Alpaca',
          cta2: 'Book a demo',
          foot: ['From $49/month', '30-day risk-free trial', 'Cancel anytime'],
        };
  return (
    <section id="pris" className="m-cta">
      <div className="m-cta-card">
        <div className="m-cta-glow" />
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {t.eye}
        </div>
        <h2 className="m-cta-t">{t.title}</h2>
        <p className="m-cta-sub">{t.sub}</p>
        <div className="m-cta-row">
          <Link href="/connect-alpaca" className="btn-primary-v8 btn-lg">
            {t.cta}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="mailto:post@apex-quantum.com" className="btn-ghost-v8 btn-lg">{t.cta2}</a>
        </div>
        <div className="m-foot-strip">
          {t.foot.map((s, i) => (
            <Fragment key={i}>
              <span>🔐 {s}</span>
              {i < t.foot.length - 1 && <span className="m-foot-sep">•</span>}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
