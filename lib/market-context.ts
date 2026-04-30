// Market-context layer: VIX (volatility regime) + earnings calendar.
//
// Two independent feeds the trading engine reads at the start of each scan:
//
//   • VIX level → global BUY-size multiplier. Standard finance practice:
//     trade smaller in high-vol regimes because stop-outs become common.
//     Cached 5 min (VIX moves slowly enough).
//
//   • Earnings calendar → block BUYs on tickers reporting in the next ~24 h.
//     Earnings = binary event we can't manage with stops because pre-market
//     gaps bypass STOPLOSS. Cached 6 h per ticker in Supabase
//     (earnings_calendar table) so we don't hit Yahoo Finance constantly.
//
// Both fail safe: if Yahoo is unreachable / returns garbage / Supabase
// errors, we return neutral values (VIX=15, no upcoming earnings) and
// trading proceeds normally rather than freezing.

import yahooFinance from 'yahoo-finance2';
import { createAdminClient } from '@/utils/supabase/admin';

// yahoo-finance2's quote/quoteSummary overloads don't narrow nicely without
// explicit casts — these types capture just the fields we actually read.
type YahooQuote = { regularMarketPrice?: number };
type YahooSummary = { calendarEvents?: { earnings?: { earningsDate?: unknown[] } } };

// ─────────────────────────────────────────────────────────────────────────────
// VIX
// ─────────────────────────────────────────────────────────────────────────────

const VIX_CACHE_TTL_MS = 5 * 60 * 1000;
let vixCache: { ts: number; level: number } | null = null;

/** Returns the most recent VIX close. Falls back to 15 (calm regime) on error. */
export async function getVixLevel(): Promise<number> {
  if (vixCache && Date.now() - vixCache.ts < VIX_CACHE_TTL_MS) return vixCache.level;
  try {
    const q = (await yahooFinance.quote('^VIX')) as YahooQuote | undefined;
    const level = Number(q?.regularMarketPrice);
    if (!Number.isFinite(level) || level <= 0) {
      return vixCache?.level ?? 15;
    }
    vixCache = { ts: Date.now(), level };
    return level;
  } catch (e) {
    console.error('[MARKET-CONTEXT] VIX fetch failed:', e);
    return vixCache?.level ?? 15;
  }
}

/**
 * Map VIX level to a global BUY-size multiplier. Calibrated against typical
 * regime classifications in equity research:
 *   < 15  → calm: full size
 *   15-20 → normal: slight throttle
 *   20-25 → elevated: half-size
 *   25-30 → stressed: quarter-size
 *   > 30  → panic: minimal positioning
 */
export function vixBuyFactor(vix: number): number {
  if (!Number.isFinite(vix) || vix <= 0) return 1.0;
  if (vix < 15) return 1.0;
  if (vix < 20) return 0.85;
  if (vix < 25) return 0.5;
  if (vix < 30) return 0.25;
  return 0.1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Earnings calendar
// ─────────────────────────────────────────────────────────────────────────────

const EARNINGS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const EARNINGS_BLOCK_WINDOW_MS = 24 * 60 * 60 * 1000; // block buys 24 h before
// In-memory hot cache so a single scan doesn't query Supabase 102 times.
const hotCache: Map<string, { fetchedAt: number; nextEarningsAt: Date | null }> = new Map();

interface SupabaseEarningsRow {
  ticker: string;
  next_earnings_at: string | null;
  fetched_at: string;
}

async function readSupabase(ticker: string): Promise<{ fetchedAt: Date; nextEarningsAt: Date | null } | null> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from('earnings_calendar')
      .select('ticker, next_earnings_at, fetched_at')
      .eq('ticker', ticker.toUpperCase())
      .maybeSingle<SupabaseEarningsRow>();
    if (!data) return null;
    return {
      fetchedAt: new Date(data.fetched_at),
      nextEarningsAt: data.next_earnings_at ? new Date(data.next_earnings_at) : null,
    };
  } catch {
    return null;
  }
}

async function writeSupabase(ticker: string, nextEarningsAt: Date | null): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.from('earnings_calendar').upsert(
      {
        ticker: ticker.toUpperCase(),
        next_earnings_at: nextEarningsAt ? nextEarningsAt.toISOString() : null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'ticker' },
    );
  } catch {
    /* best-effort cache; trading proceeds */
  }
}

async function fetchYahooEarnings(ticker: string): Promise<Date | null> {
  try {
    const summary = (await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] })) as YahooSummary | undefined;
    const earnings = summary?.calendarEvents?.earnings;
    const earningsDates = earnings?.earningsDate;
    if (!Array.isArray(earningsDates) || earningsDates.length === 0) return null;
    // earningsDate is an array of Dates — pick the soonest in the future.
    const now = Date.now();
    const future = earningsDates
      .map((d) => (d instanceof Date ? d : new Date(d as unknown as string)))
      .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now)
      .sort((a, b) => a.getTime() - b.getTime());
    return future[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the next scheduled earnings date for a ticker, or null if unknown
 * / no upcoming report. Cached in Supabase (earnings_calendar table) for 6 h
 * with an in-memory hot cache layered on top.
 */
export async function getNextEarnings(ticker: string): Promise<Date | null> {
  const upper = ticker.toUpperCase();
  const now = Date.now();

  const hot = hotCache.get(upper);
  if (hot && now - hot.fetchedAt < EARNINGS_CACHE_TTL_MS) return hot.nextEarningsAt;

  const persisted = await readSupabase(upper);
  if (persisted && now - persisted.fetchedAt.getTime() < EARNINGS_CACHE_TTL_MS) {
    hotCache.set(upper, { fetchedAt: persisted.fetchedAt.getTime(), nextEarningsAt: persisted.nextEarningsAt });
    return persisted.nextEarningsAt;
  }

  const fresh = await fetchYahooEarnings(upper);
  hotCache.set(upper, { fetchedAt: now, nextEarningsAt: fresh });
  await writeSupabase(upper, fresh);
  return fresh;
}

/**
 * True iff the ticker has earnings within the next EARNINGS_BLOCK_WINDOW_MS.
 * Trading engine uses this to veto BUYs on tickers about to report.
 */
export async function hasImminentEarnings(ticker: string): Promise<boolean> {
  const next = await getNextEarnings(ticker);
  if (!next) return false;
  const ms = next.getTime() - Date.now();
  return ms > 0 && ms < EARNINGS_BLOCK_WINDOW_MS;
}
