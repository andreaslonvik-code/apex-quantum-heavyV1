// Apex Quantum portfolio optimizer.
//
// Ranks the 102-ticker universe by risk-adjusted momentum (30-day return /
// annualised volatility) and returns the top-8 names as the "preferred"
// elite set. The trading engine treats this as a soft preference signal —
// elite tickers get a score bonus when intraday BUY signals (DIP / RSI_LOW
// / GAP_UP) compete for the limited 8-position slot budget. They are NOT
// the only tickers that can be traded; the engine scans and trades across
// the full 102-ticker universe.
//
// Cached for 1 hour. Falls back to a curated SEED set if Alpaca returns
// too little data (cold start, outage, broad bear market with all
// negative momentum).

import { getStockBars, type AlpacaCreds } from './alpaca';
import {
  WATCHLIST,
  SYMBOL_TO_SECTOR,
  type SectorKey,
} from './blueprint';

const ELITE_SIZE = 8;
const MAX_PER_SECTOR = 3;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const PRICE_FETCH_CONCURRENCY = 12;
const TRADING_DAYS = 252;

interface TickerStats {
  ticker: string;
  return30d: number;
  vol30d: number;
  sharpe: number;
}

/**
 * Fallback set used only when the optimizer can't get enough Alpaca data.
 * Mirrors the original v6.1 blueprint anchor names. Kept private so
 * consumers can't bypass the optimizer.
 */
const SEED_TICKERS = new Set<string>([
  'MU', 'VRT', 'AVGO', 'CEG', 'PLTR', 'HELP', 'IONQ', 'RKLB',
]);

interface CachedResult {
  ts: number;
  tickers: Set<string>;
  source: 'optimizer' | 'seed';
  scanned: number;
  qualified: number;
}

let cached: CachedResult | null = null;

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/**
 * Returns the preferred elite tickers for the next trading window. Cached
 * for CACHE_TTL_MS. Universe-wide (not per-user) so any working `creds`
 * works to pull market data — first user that calls populates the cache,
 * everyone else gets it free.
 */
export async function computeEliteTickers(
  creds: AlpacaCreds,
): Promise<{ tickers: Set<string>; source: 'optimizer' | 'seed'; scanned: number; qualified: number }> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return {
      tickers: cached.tickers,
      source: cached.source,
      scanned: cached.scanned,
      qualified: cached.qualified,
    };
  }

  const stats: TickerStats[] = [];
  let scanned = 0;
  await runInChunks(WATCHLIST, PRICE_FETCH_CONCURRENCY, async (ticker) => {
    scanned++;
    const bars = await getStockBars(creds, ticker, { timeframe: '1Day', limit: 30 });
    if (!bars.success || bars.data.length < 20) return;
    const closes = bars.data.map((b) => b.c).filter((c) => c > 0);
    if (closes.length < 20) return;

    const ret30d = closes[closes.length - 1] / closes[0] - 1;
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const meanRet = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / logReturns.length;
    const vol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS);
    if (!Number.isFinite(vol) || vol <= 0) return;

    const sharpe = ret30d / vol;
    if (!Number.isFinite(sharpe)) return;

    stats.push({ ticker, return30d: ret30d, vol30d: vol, sharpe });
  });

  if (stats.length < ELITE_SIZE * 1.5) {
    cached = {
      ts: Date.now(),
      tickers: new Set(SEED_TICKERS),
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
    return {
      tickers: cached.tickers,
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
  }

  stats.sort((a, b) => b.sharpe - a.sharpe);

  const sectorCount = new Map<SectorKey, number>();
  const selected: TickerStats[] = [];
  for (const s of stats) {
    if (selected.length >= ELITE_SIZE) break;
    if (s.sharpe <= 0) break;
    const sector = SYMBOL_TO_SECTOR[s.ticker];
    if (sector) {
      const cnt = sectorCount.get(sector) || 0;
      if (cnt >= MAX_PER_SECTOR) continue;
      sectorCount.set(sector, cnt + 1);
    }
    selected.push(s);
  }

  if (selected.length < 5) {
    // Almost everything has negative momentum — bear market regime. Fall
    // back to seed rather than concentrating into 1-2 names.
    cached = {
      ts: Date.now(),
      tickers: new Set(SEED_TICKERS),
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
    return {
      tickers: cached.tickers,
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
  }

  const tickers = new Set(selected.map((s) => s.ticker));
  cached = {
    ts: Date.now(),
    tickers,
    source: 'optimizer',
    scanned,
    qualified: stats.length,
  };
  return { tickers, source: 'optimizer', scanned, qualified: stats.length };
}
