'use client';

import { useState, type ReactNode } from 'react';
import { MHeader } from './header';
import { MFooter } from './footer';
import type { Lang } from './types';

/**
 * Shared chrome for sub-pages reached from the marketing footer / header.
 * Mirrors the structure of `app/page.tsx` so headers, ambient effects, and
 * footers stay aligned across all marketing surfaces.
 */
export function PageShell({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLang] = useState<Lang>('no');
  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <MHeader lang={lang} setLang={setLang} />
      <main className="relative" style={{ zIndex: 2 }}>
        {children(lang)}
        <MFooter lang={lang} />
      </main>
    </>
  );
}

/**
 * Generic article-style body block for legal / informational pages.
 * Sections accept either NO or EN content; the host page picks based on lang.
 */
export function ArticleBody({
  title,
  updatedLabel,
  updatedDate,
  body,
}: {
  title: string;
  updatedLabel: string;
  updatedDate: string;
  body: ReactNode;
}) {
  return (
    <section style={{ padding: '140px 24px 80px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            marginTop: 16,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 14,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {updatedLabel}: {updatedDate}
        </p>
        <div
          style={{
            marginTop: 40,
            color: 'rgba(255,255,255,0.78)',
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          {body}
        </div>
      </div>
    </section>
  );
}
