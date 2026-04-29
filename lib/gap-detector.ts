// Overnight gap detector.
//
// At the start of each regular session, fetch the previous regular-close
// + today's open per universe ticker and compute the gap %:
//
//   gap = (today_open - prev_close) / prev_close
//
// Big positive gaps on UP-trending names = continuation play (GAP_UP).
// Big negative gaps = avoid until the dust settles (GAP_DOWN — blocks
// entries for the day on that ticker; we don't fade since we can't short).
//
// Cached 30 min from first fetch. After that the gap is stale — early
// session reaction is over and intraday DIP/RSI signals take over.

import { getStockBars, type AlpacaCreds } from './alpaca';
import { WATCHLIST } from './blueprint';

export interface GapEntry {
  /** Overnight gap %, e.g. 0.024 = +2.4 %. */
  gap: number;
  prevClose: number;
  todayOpen: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — early-session window
const FETCH_CONCURRENCY = 12;

interface GapCache {
  ts: number;
  byTicker: Map<string, GapEntry>;
}

let cached: GapCache | null = null;

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/**
 * Returns gap % per ticker (where data exists). Caches for 30 min so the
 * 102-ticker bars fetch only happens once per session-open window.
 *
 * Bar API call: `timeframe: '1Day', limit: 2`. Last-2 daily bars give us
 * yesterday's close and today's open (today's bar is the in-progress
 * regular-session bar, which Alpaca starts populating at 09:30 ET).
 *
 * If the in-progress bar isn't available yet (first minute after open),
 * we skip that ticker for this scan — gap will populate on the next.
 */
export async function getOvernightGaps(creds: AlpacaCreds): Promise<Map<string, GapEntry>> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.byTicker;

  const byTicker = new Map<string, GapEntry>();
  await runInChunks(WATCHLIST, FETCH_CONCURRENCY, async (ticker) => {
    const r = await getStockBars(creds, ticker, { timeframe: '1Day', limit: 2 });
    if (!r.success || r.data.length < 2) return;
    const prev = r.data[r.data.length - 2];
    const today = r.data[r.data.length - 1];
    const prevClose = prev.c;
    const todayOpen = today.o;
    if (prevClose <= 0 || todayOpen <= 0) return;
    const gap = (todayOpen - prevClose) / prevClose;
    if (!Number.isFinite(gap)) return;
    byTicker.set(ticker, { gap, prevClose, todayOpen });
  });

  cached = { ts: Date.now(), byTicker };
  return byTicker;
}

/** Force a recompute on next call. Useful after market open. */
export function invalidateGapCache(): void {
  cached = null;
}
