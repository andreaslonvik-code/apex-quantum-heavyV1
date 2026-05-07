'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import type { Lang } from './types';

export function CTA({ lang }: { lang: Lang }) {
  const t =
    lang === 'no'
      ? {
          eye: 'KOM I GANG',
          title: 'Begynn med Apex Quantum +.',
          sub: 'Daglige AI-signaler med begrunnelse, ukentlige rapporter og strukturert læring — for 199 kr/mnd. Den fullautomatiske Max-motoren kommer snart.',
          cta: 'Start nå',
          cta2: 'Varsle meg om Max',
          foot: ['Fra 199 kr/mnd', 'Ingen binding', 'Apex Quantum Max — under utvikling'],
        }
      : {
          eye: 'GET STARTED',
          title: 'Begin with Apex Quantum +.',
          sub: 'Daily AI signals with reasoning, weekly reports and structured learning — for $19/month. The fully autonomous Max engine is coming soon.',
          cta: 'Start now',
          cta2: 'Notify me about Max',
          foot: ['From $19/month', 'No commitment', 'Apex Quantum Max — in development'],
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
          <Link href="/sign-up" className="btn-primary-v8 btn-lg">
            {t.cta}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me" className="btn-ghost-v8 btn-lg">{t.cta2}</a>
        </div>
        <div className="m-foot-strip">
          {t.foot.map((s, i) => (
            <Fragment key={i}>
              <span>{s}</span>
              {i < t.foot.length - 1 && <span className="m-foot-sep">•</span>}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
