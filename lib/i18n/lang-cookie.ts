import type { Lang } from '@/app/components/marketing/types';

export const LANG_COOKIE = 'aq-lang';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Client-side helper to read the explicit-language cookie. SSR-safe —
 * returns `null` when document is unavailable. Use `detectMarketingLang`
 * on the server instead.
 */
export function readLangCookie(): Lang | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)aq-lang=(no|en)(?:;|$)/);
  return match ? (match[1] as Lang) : null;
}

/**
 * Persist the user's explicit language choice. Lifetime = 1 year.
 * The cookie wins over geo-detection on the server next time.
 */
export function writeLangCookie(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
