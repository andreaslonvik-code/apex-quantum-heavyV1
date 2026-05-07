'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    eye: 'UNDER UTVIKLING',
    title: 'Apex Quantum Max kommer snart.',
    sub: 'Den fullautomatiske trading-motoren er under utvikling. I mellomtiden er Apex Quantum + tilgjengelig — signaler, rapporter og læring fra samme AI-grunnlag.',
    cta: 'Utforsk Apex Quantum +',
    cta2: 'Varsle meg',
    foot: ['Lansering planlagt 2026', 'Vi sender ett varsel — ingen spam'],
  },
  en: {
    eye: 'IN DEVELOPMENT',
    title: 'Apex Quantum Max is coming soon.',
    sub: 'The fully autonomous trading engine is under active development. In the meantime, Apex Quantum + is available — signals, reports and learning from the same AI foundation.',
    cta: 'Explore Apex Quantum +',
    cta2: 'Notify me',
    foot: ['Launch planned 2026', 'One notification — no spam'],
  },
} as const;

export function MaxComingSoon() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
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
              <div className="m-cta-row" style={{ justifyContent: 'center', marginTop: 36 }}>
                <Link href="/plus" className="btn-primary-v8 btn-lg">
                  {t.cta}
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <a href="mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me" className="btn-ghost-v8 btn-lg">
                  {t.cta2}
                </a>
              </div>
              <div className="m-foot-strip" style={{ justifyContent: 'center', marginTop: 28 }}>
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
      }}
    </PageShell>
  );
}
