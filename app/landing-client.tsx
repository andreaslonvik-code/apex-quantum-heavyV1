'use client';

import { useEffect, useState } from 'react';
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
import { LegalBand } from './components/marketing-v2/legal-band';

/**
 * Landing page — Apex Quantum v2 editorial design («Hovedboken»).
 * KPIs and the track-record chart are driven by live numbers from the
 * leader's paper Alpaca account (`getLeaderMarketingStats`). Hardcoded
 * design-prototype numbers are deliberately removed — every figure shown
 * traces back to the live cockpit. Falls back gracefully (designed error
 * states in identical dimensions) if live data is unavailable.
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

  // Seksjons-reveal (§11): IntersectionObserver, én gang, 600ms opacity +
  // translateY(8px). Klassen settes av JS KUN på elementer under folden —
  // uten JS (og ved prefers-reduced-motion) er alt synlig fra start.
  // Hero/LCP har ikke data-reveal og animeres aldri.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.aqv2 [data-reveal]'));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    for (const el of els) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.85) {
        el.classList.add('aq-reveal');
        io.observe(el);
      }
    }
    return () => io.disconnect();
  }, []);

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
        <LegalBand lang={lang} />
        <FooterV2 lang={lang} />
      </main>
    </div>
  );
}
