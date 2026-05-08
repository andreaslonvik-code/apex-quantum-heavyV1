import { detectMarketingLang } from '@/lib/i18n/detect-lang';
import { LandingClient } from './landing-client';

export default async function LandingPage() {
  const initialLang = await detectMarketingLang();
  return <LandingClient initialLang={initialLang} />;
}
