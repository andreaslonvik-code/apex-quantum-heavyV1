// Apex Quantum portfolio optimizer.
//
// Picks the elite portfolio dynamically from the 102-ticker universe by
// risk-adjusted momentum. The trading engine (Vercel cron, on-demand route,
// Inngest tick) calls computeElitePortfolio() at the start of each scan and
// rebalances every user's account toward whatever the optimizer returns —
// EXIT for tickers that fall out, UNDERWEIGHT-build for tickers that come
// in, REBALANCE for weight changes.
//
// Algorithm
//   1. Fetch 30 daily bars per universe ticker from Alpaca (parallel chunks).
//   2. For each ticker compute:
//        return30d = closes[last] / closes[first] − 1
//        vol30d    = annualised stddev of log returns over the window
//        sharpe    = return30d / vol30d  (risk-adjusted momentum)
//   3. Sort descending by sharpe; require sharpe > 0 (no negative-momentum
//      names in the elite list).
//   4. Greedy top-N (= 14) with a per-sector cap so no single sector can
//      dominate even if it has the strongest momentum.
//   5. Score-proportional weights, clipped to [MIN_WEIGHT_PCT,
//      MAX_WEIGHT_PCT], renormalised to exactly 100.
//   6. Cache the result for CACHE_TTL_MS (1 hour). Cron ticks within the
//      cache window get the same answer; rotation happens once per hour.
//
// Fallback
//   If Alpaca returns too few valid bars (cold market data, outage, etc.)
//   we return a hand-curated SEED_PORTFOLIO so the trading engine never
//   trades a malformed universe.

import { getStockBars, type AlpacaCreds } from './alpaca';
import {
  WATCHLIST,
  SYMBOL_TO_SECTOR,
  SECTOR_VOLATILITY,
  TICKER_NAME,
  type EliteEntry,
  type SectorKey,
} from './blueprint';

const ELITE_SIZE = 14;
const MIN_WEIGHT_PCT = 2;
const MAX_WEIGHT_PCT = 25;
const MAX_PER_SECTOR = 4;
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
 * Hand-curated fallback used only when the optimizer can't get enough Alpaca
 * data. Kept here (not exported from blueprint.ts) so consumers can't bypass
 * the optimizer by importing the seed directly.
 */
const SEED_PORTFOLIO: Readonly<Record<string, EliteEntry>> = {
  MU:   { name: 'Micron Technology',     targetWeight: 22, volatility: 4 },
  AVGO: { name: 'Broadcom',              targetWeight: 14, volatility: 3 },
  VRT:  { name: 'Vertiv',                targetWeight: 13, volatility: 3 },
  CEG:  { name: 'Constellation Energy',  targetWeight: 11, volatility: 3 },
  PLTR: { name: 'Palantir',              targetWeight: 10, volatility: 5 },
  SMCI: { name: 'Super Micro',           targetWeight: 6,  volatility: 5 },
  TSLA: { name: 'Tesla',                 targetWeight: 5,  volatility: 5 },
  OKLO: { name: 'Oklo Inc',              targetWeight: 4,  volatility: 5 },
  COIN: { name: 'Coinbase',              targetWeight: 3,  volatility: 5 },
  IONQ: { name: 'IonQ',                  targetWeight: 2,  volatility: 5 },
  RKLB: { name: 'Rocket Lab',            targetWeight: 2,  volatility: 5 },
  HELP: { name: 'Heritage Global',       targetWeight: 3,  volatility: 4 },
  XOM:  { name: 'ExxonMobil',            targetWeight: 3,  volatility: 2 },
  OXY:  { name: 'Occidental',            targetWeight: 2,  volatility: 4 },
};

interface CachedResult {
  ts: number;
  portfolio: Record<string, EliteEntry>;
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
 * Returns the elite portfolio for the next trading scan. Cached for
 * CACHE_TTL_MS — within a cache window every caller gets the same answer.
 *
 * The optimizer is universe-wide (not per-user) so any working `creds`
 * object works to pull the market data.
 */
export async function computeElitePortfolio(
  creds: AlpacaCreds,
): Promise<{ portfolio: Record<string, EliteEntry>; source: 'optimizer' | 'seed'; scanned: number; qualified: number }> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return {
      portfolio: cached.portfolio,
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

  // If we got too few stats — fallback to the seed list. The trading engine
  // can't safely trade a universe that's mostly unknown.
  if (stats.length < ELITE_SIZE * 1.5) {
    cached = {
      ts: Date.now(),
      portfolio: { ...SEED_PORTFOLIO },
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
    return {
      portfolio: cached.portfolio,
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
  }

  stats.sort((a, b) => b.sharpe - a.sharpe);

  // Greedy top-N with sector cap.
  const sectorCount = new Map<SectorKey, number>();
  const selected: TickerStats[] = [];
  for (const s of stats) {
    if (selected.length >= ELITE_SIZE) break;
    if (s.sharpe <= 0) break; // no negative-momentum names in elite
    const sector = SYMBOL_TO_SECTOR[s.ticker];
    if (sector) {
      const cnt = sectorCount.get(sector) || 0;
      if (cnt >= MAX_PER_SECTOR) continue;
      sectorCount.set(sector, cnt + 1);
    }
    selected.push(s);
  }

  // If almost everything has negative momentum — bear market regime — fall
  // back to seed rather than concentrating into 1-2 names.
  if (selected.length < 5) {
    cached = {
      ts: Date.now(),
      portfolio: { ...SEED_PORTFOLIO },
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
    return {
      portfolio: cached.portfolio,
      source: 'seed',
      scanned,
      qualified: stats.length,
    };
  }

  // Score-proportional weights with min/max caps.
  const totalScore = selected.reduce((s, t) => s + Math.max(t.sharpe, 0.1), 0);
  const portfolio: Record<string, EliteEntry> = {};
  for (const s of selected) {
    const sector = SYMBOL_TO_SECTOR[s.ticker];
    const vol = sector ? SECTOR_VOLATILITY[sector] : 3;
    let weight = (Math.max(s.sharpe, 0.1) / totalScore) * 100;
    weight = Math.max(MIN_WEIGHT_PCT, Math.min(MAX_WEIGHT_PCT, weight));
    portfolio[s.ticker] = {
      name: TICKER_NAME[s.ticker] || s.ticker,
      targetWeight: weight,
      volatility: vol,
    };
  }

  // Renormalise so weights sum to exactly 100.
  const sum = Object.values(portfolio).reduce((s, e) => s + e.targetWeight, 0);
  if (sum > 0) {
    const scale = 100 / sum;
    for (const t of Object.keys(portfolio)) {
      portfolio[t].targetWeight = Math.round(portfolio[t].targetWeight * scale);
    }
  }
  // After rounding, total may be off by 1-2 — adjust the largest holding.
  const totalAfter = Object.values(portfolio).reduce((s, e) => s + e.targetWeight, 0);
  if (totalAfter !== 100 && Object.keys(portfolio).length > 0) {
    const sorted = Object.entries(portfolio).sort((a, b) => b[1].targetWeight - a[1].targetWeight);
    sorted[0][1].targetWeight += 100 - totalAfter;
  }

  cached = {
    ts: Date.now(),
    portfolio,
    source: 'optimizer',
    scanned,
    qualified: stats.length,
  };
  return {
    portfolio,
    source: 'optimizer',
    scanned,
    qualified: stats.length,
  };
}
