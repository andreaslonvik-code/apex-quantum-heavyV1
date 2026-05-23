'use client';

import { useState } from 'react';
import './components/marketing-v2/styles.css';
import type { Lang } from './components/marketing/types';
import { HeaderV2 } from './components/marketing-v2/header';
import { HeroV2 } from './components/marketing-v2/hero';
import { ThesisV2 } from './components/marketing-v2/thesis';
import { PrinciplesV2 } from './components/marketing-v2/principles';
import { TiersV2 } from './components/marketing-v2/tiers';
import { RecordV2 } from './components/marketing-v2/record';
import { InsideV2 } from './components/marketing-v2/inside';
import { CTAV2, FooterV2 } from './components/marketing-v2/cta-footer';

/**
 * Landing page — Apex Quantum v2 editorial design (May 2026).
 * All component styling is scoped under `.aqv2` so the redesigned landing
 * does not affect /max, /dashboard, /plus or any other surface.
 */
export function LandingClient({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  return (
    <div className="aqv2">
      <div className="atmosphere" aria-hidden="true" />
      <div className="aqv2-grain" aria-hidden="true" />
      <HeaderV2 lang={lang} setLang={setLang} />
      <main>
        <HeroV2 lang={lang} />
        <ThesisV2 lang={lang} />
        <PrinciplesV2 lang={lang} />
        <TiersV2 lang={lang} />
        <RecordV2 lang={lang} />
        <InsideV2 lang={lang} />
        <CTAV2 lang={lang} />
        <FooterV2 lang={lang} />
      </main>
    </div>
  );
}
