/**
 * «Viktig informasjon»-båndet — §6 lag 3. Pre-footer-kolofon på
 * tallsider (/, /plus, /pris, /om-oss, MaxComingSoon). Dette er
 * innhold, ikke varsel — ingen dismiss, ingen overlay.
 */

import type { Lang } from '../marketing/types';
import { LEGAL_BAND, LEGAL_LINES } from '@/lib/legal-copy';

export function LegalBand({ lang }: { lang: Lang }) {
  const lines = LEGAL_LINES[lang];
  const t = LEGAL_BAND[lang];
  return (
    <aside className="aq-legal-band" aria-label={t.ariaLabel}>
      <div className="aq-gullsnitt" aria-hidden />
      <div className="aq-legal-band-inner">
        <h2 className="aq-legal-band-title">{t.title}</h2>
        <div className="aq-legal-band-cols">
          <p>{lines.l1}</p>
          <p>{lines.l2}</p>
          <p>{lines.l3}</p>
          <p>{lines.l4}</p>
          <p>{lines.l5}</p>
        </div>
      </div>
    </aside>
  );
}
