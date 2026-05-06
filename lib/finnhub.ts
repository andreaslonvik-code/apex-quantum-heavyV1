/**
 * Finnhub client — used for earnings calendar + company news. Auth via
 * FINNHUB_API_KEY (free tier: 60 calls/min, sufficient for our cadence).
 *
 * Both functions fail-soft: if the API key is missing or the call errors,
 * we return empty data so the engine can still trade — it just loses the
 * earnings-blackout and news-density layers. The engine's filter treats
 * "no earnings data" as "earnings unknown, allow trade" (intentional —
 * we'd rather trade with reduced-but-not-zero confidence than freeze).
 */

const BASE_URL = 'https://finnhub.io/api/v1';
const REQUEST_TIMEOUT_MS = 8_000;

export interface EarningsEntry {
  symbol: string;
  /** ISO date string, e.g. "2026-05-12" */
  date: string;
  /** Earnings quarter, e.g. 1, 2, 3, 4 */
  quarter?: number;
  /** "bmo" = before market open, "amc" = after market close */
  hour?: string;
}

export interface NewsArticle {
  /** Unix timestamp in seconds */
  datetime: number;
  headline: string;
  source: string;
  url: string;
}

function getApiKey(): string | null {
  const k = process.env.FINNHUB_API_KEY;
  return k && k.length > 0 ? k : null;
}

async function finnhubFetch<T>(path: string): Promise<T | null> {
  const key = getApiKey();
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${BASE_URL}${path}${sep}token=${key}`, {
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Earnings for ALL companies in a date window. Bulk-fetch is critical —
 * without it we'd burn 46 calls per scan (one per ticker). With it, ONE
 * call gets the whole watchlist.
 *
 * `from` / `to` are ISO date strings, e.g. "2026-05-07".
 */
export async function getEarningsCalendar(
  from: string,
  to: string,
): Promise<EarningsEntry[]> {
  type Resp = { earningsCalendar?: EarningsEntry[] };
  const r = await finnhubFetch<Resp>(`/calendar/earnings?from=${from}&to=${to}`);
  return r?.earningsCalendar ?? [];
}

/**
 * Company-specific news in a date window. Per-ticker, so for 46-ticker
 * watchlist this is 46 calls. Cache aggressively (30 min TTL).
 *
 * `from` / `to` are ISO date strings.
 */
export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string,
): Promise<NewsArticle[]> {
  const r = await finnhubFetch<NewsArticle[] | { error?: string }>(
    `/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
  );
  if (!Array.isArray(r)) return [];
  return r;
}
