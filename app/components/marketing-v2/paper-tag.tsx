/**
 * <PaperTag/> — §5.2. Mono-etikett med gull-dot. Obligatorisk i samme
 * synsfelt som enhver KPI-gruppe (anti-slop-kontrakten §13.12).
 */

import type { Lang } from '../marketing/types';
import { PAPER_TAG } from '@/lib/legal-copy';

export function PaperTag({ lang }: { lang: Lang }) {
  return (
    <span className="aq-paper-tag">
      <span className="aq-paper-tag-dot" aria-hidden />
      {PAPER_TAG[lang]}
    </span>
  );
}
