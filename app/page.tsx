import { detectMarketingLang } from '@/lib/i18n/detect-lang';
import { getLeaderMarketingStats } from '@/lib/marketing-stats';
import { LandingClient } from './landing-client';

export default async function LandingPage() {
  const [initialLang, stats] = await Promise.all([
    detectMarketingLang(),
    getLeaderMarketingStats(),
  ]);
  return <LandingClient initialLang={initialLang} stats={stats} />;
}
