'use client';

import { useState } from 'react';
import { MHeader } from './components/marketing/header';
import { Hero } from './components/marketing/hero';
import { Stats } from './components/marketing/stats';
import { Features } from './components/marketing/features';
import { LiveReport } from './components/marketing/live-report';
import { CTA } from './components/marketing/cta';
import { MFooter } from './components/marketing/footer';
import type { Lang } from './components/marketing/types';

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('no');
  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <MHeader lang={lang} setLang={setLang} />
      <main className="relative" style={{ zIndex: 2 }}>
        <Hero lang={lang} />
        <Stats lang={lang} />
        <Features lang={lang} />
        <LiveReport lang={lang} />
        <CTA lang={lang} />
        <MFooter lang={lang} />
      </main>
    </>
  );
}
