import { cookies, headers } from 'next/headers';
import type { Lang } from '@/app/components/marketing/types';

export const LANG_COOKIE = 'aq-lang';

/**
 * Server-side language detection for the marketing site.
 * Order of precedence:
 *   1. Explicit user choice in `aq-lang` cookie (set by header toggler)
 *   2. Vercel edge-network country header (`x-vercel-ip-country`)
 *      → Norway gets `no`, everywhere else `en`
 *   3. Fallback `en` (most international audience)
 *
 * Header is automatically populated on Vercel deployments — no extra
 * API call, no third-party geolocation service needed.
 */
export async function detectMarketingLang(): Promise<Lang> {
  const cookieStore = await cookies();
  const explicit = cookieStore.get(LANG_COOKIE)?.value;
  if (explicit === 'no' || explicit === 'en') return explicit;

  const hdrs = await headers();
  const country = hdrs.get('x-vercel-ip-country')?.toUpperCase();
  return country === 'NO' ? 'no' : 'en';
}
