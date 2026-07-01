'use client';

/**
 * Morgenutgaven i Plus-dashboardets page-heads (§5.5 / §10b).
 * Mapper PlusLang → det delte Lang-mønsteret (no/en) og gjenbruker
 * <EditionLine/> fra marketing-v2 — binder Plus og Max visuelt.
 */

import type { PlusLang } from '@/lib/i18n/plus-lang';
import { EditionLine } from '@/app/components/marketing-v2/edition-line';

export function EditionRow({ lang }: { lang: PlusLang }) {
  return (
    <div className="aqp-edition-row">
      <EditionLine lang={lang === 'no' ? 'no' : 'en'} />
    </div>
  );
}
