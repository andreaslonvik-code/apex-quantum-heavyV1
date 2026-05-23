'use client';

import { useState } from 'react';
import './components/marketing-v2/styles.css';
import type { Lang } from './components/marketing/types';
import type { MarketingStats } from '@/lib/marketing-stats';
import { HeaderV2 } from './components/marketing-v2/header';
import { HeroV2 } from './components/marketing-v2/hero';
import { ThesisV2 } from './components/marketing-v2/thesis';
import { PrinciplesV2 } from './components/marketing-v2/principles';
import { TiersV2 } from './components/marketing-v2/tiers';
import { RecordV2 } from './components/marketing-v2/record';
import { InsideV2 } from './components/marketing-v2/inside';
import { CTAV2, FooterV2 } from './components/marketing-v2/cta-footer';

/**
 * Landing page — Apex Quantum v2 editorial design.
 * KPIs and the track-record chart are driven by live numbers from the
 * leader's paper Alpaca account (`getLeaderMarketingStats`). Hardcoded
 * design-prototype numbers are deliberately removed — every figure shown
 * traces back to the live cockpit. Falls back gracefully (omits numbers
 * rather than fabricates them) if live data is unavailable.
 *
 * All component styling is scoped under `.aqv2`, so the redesign does not
 * affect /max, /dashboard, /plus.
 */
export function LandingClient({
  initialLang,
  stats,
}: {
  initialLang: Lang;
  stats: MarketingStats;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  return (
    <div className="aqv2">
      <div className="atmosphere" aria-hidden="true" />
      <div className="aqv2-grain" aria-hidden="true" />
      <HeaderV2 lang={lang} setLang={setLang} />
      <main>
        <HeroV2 lang={lang} stats={stats} />
        <ThesisV2 lang={lang} />
        <PrinciplesV2 lang={lang} />
        <TiersV2 lang={lang} />
        <RecordV2 lang={lang} stats={stats} />
        <InsideV2 lang={lang} />
        <CTAV2 lang={lang} />
        <FooterV2 lang={lang} />
      </main>
    </div>
  );
}
