import { detectMarketingLang } from '@/lib/i18n/detect-lang';
import { InnsynClient } from './innsyn-client';

/**
 * Public transparency page — shows the leader cockpit's live Grok decisions
 * so prospective customers can see HOW the bot reasons, WHAT it acted on, and
 * WHEN it skipped. Bilingual; controlled by the same `aq-lang` cookie that
 * the marketing site uses.
 *
 * Server component delegates initial language detection; the client polls
 * `/api/transparency/timeline` for live updates.
 */
export const metadata = {
  title: 'Innsyn · Apex Quantum',
  description:
    'Live transparens — alle beslutninger boten har gjort, med begrunnelse og kildebruk. Oppdateres kontinuerlig.',
};

export default async function InnsynPage() {
  const lang = await detectMarketingLang();
  return <InnsynClient initialLang={lang} />;
}
