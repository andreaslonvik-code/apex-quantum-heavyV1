/**
 * Calendar / catalyst layer — wraps Finnhub for earnings + news lookups
 * with module-level caching so we don't burn the API quota.
 *
 * Vercel serverless: each invocation may or may not share module state
 * with the next. The cache helps WITHIN a scan (one fetch covers all
 * 46 tickers' earnings). Across scans, cold starts re-fetch — that's
 * acceptable since cron is once/min and bulk earnings = 1 call/scan.
 *
 * News: per-ticker, cached 30 min. With 10-min Grok cadence, we re-fetch
 * news every 3rd scan — within Finnhub free tier (60 calls/min).
 */

import { getCompanyNews, getEarningsCalendar, type EarningsEntry } from '@/lib/finnhub';

interface EarningsCache {
  fetchedAt: number;
  byTicker: Map<string, string>; // ticker → ISO date of next earnings
}

interface NewsCache {
  byTicker: Map<
    string,
    { fetchedAt: number; count24h: number; headlines: string[] }
  >;
}

const EARNINGS_TTL_MS = 6 * 60 * 60 * 1000; // 6 h — earnings dates rarely shift intraday
const NEWS_TTL_MS = 30 * 60 * 1000; // 30 min

const earningsCache: EarningsCache = { fetchedAt: 0, byTicker: new Map() };
const newsCache: NewsCache = { byTicker: new Map() };

function isoDateNDaysFromNow(n: number): string {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Refresh the earnings cache (one bulk Finnhub call covering the next 14
 * days). Cache TTL of 6 h is safe — earnings dates are announced weeks
 * ahead and rarely shift intraday.
 */
async function refreshEarningsCache(): Promise<void> {
  const now = Date.now();
  if (now - earningsCache.fetchedAt < EARNINGS_TTL_MS && earningsCache.byTicker.size > 0) {
    return;
  }
  const from = isoDateNDaysFromNow(0);
  const to = isoDateNDaysFromNow(14);
  const entries: EarningsEntry[] = await getEarningsCalendar(from, to);
  const newMap = new Map<string, string>();
  for (const e of entries) {
    if (!e.symbol || !e.date) continue;
    const existing = newMap.get(e.symbol);
    // Keep the EARLIEST upcoming date if the API returns multiple.
    if (!existing || e.date < existing) {
      newMap.set(e.symbol, e.date);
    }
  }
  earningsCache.byTicker = newMap;
  earningsCache.fetchedAt = now;
}

/**
 * Days until a ticker's next earnings. Returns null if the ticker has no
 * earnings in the next 14 days OR the cache failed to populate (no API key,
 * Finnhub down). The engine treats null as "earnings unknown, allow trade".
 */
export async function daysToEarnings(ticker: string): Promise<number | null> {
  await refreshEarningsCache();
  const dateStr = earningsCache.byTicker.get(ticker);
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (!Number.isFinite(target)) return null;
  const diffMs = target - Date.now();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * News count + top headlines for a ticker in last 24 h. Cached 30 min.
 * Top 5 headlines are passed to Grok for sentiment assessment (we don't have
 * a direct sentiment API on Finnhub free tier, so the LLM does it from
 * the headline text).
 */
async function refreshNewsCache(ticker: string): Promise<{
  count24h: number;
  headlines: string[];
}> {
  const now = Date.now();
  const cached = newsCache.byTicker.get(ticker);
  if (cached && now - cached.fetchedAt < NEWS_TTL_MS) {
    return { count24h: cached.count24h, headlines: cached.headlines };
  }
  const from = isoDateNDaysFromNow(-1);
  const to = isoDateNDaysFromNow(0);
  const articles = await getCompanyNews(ticker, from, to);
  const cutoff = (now - 24 * 60 * 60 * 1000) / 1000; // sec
  const recent = articles.filter((a) => a.datetime >= cutoff);
  // Sort by recency, take top 5 headlines (truncated to 100 chars each
  // to keep prompt size manageable across 46 tickers).
  recent.sort((a, b) => b.datetime - a.datetime);
  const headlines = recent
    .slice(0, 5)
    .map((a) => (a.headline || '').slice(0, 100))
    .filter((h) => h.length > 0);
  newsCache.byTicker.set(ticker, {
    fetchedAt: now,
    count24h: recent.length,
    headlines,
  });
  return { count24h: recent.length, headlines };
}

export async function newsCount24h(ticker: string): Promise<number> {
  return (await refreshNewsCache(ticker)).count24h;
}

export async function newsHeadlines24h(ticker: string): Promise<string[]> {
  return (await refreshNewsCache(ticker)).headlines;
}

/** Bulk pre-fetch: pull news for all tickers in parallel before snapshot loop. */
export async function prefetchNews(tickers: readonly string[]): Promise<void> {
  await Promise.allSettled(tickers.map((t) => newsCount24h(t)));
}
