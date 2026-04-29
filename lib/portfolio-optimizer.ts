// Apex Quantum portfolio optimizer.
//
// Picks the elite-8 portfolio dynamically each hour. As of the AI-driven
// upgrade this is now a thin wrapper over lib/ai-portfolio.ts:
//
//   1. selectEliteWithAI() asks Grok-4-Heavy to pick 8 tickers from the
//      102 universe, integrating per-ticker Sharpe stats AND the latest
//      news / sentiment intel. Grok returns picks + reasoning + thesis +
//      confidence.
//   2. If Grok fails, returns invalid picks, or has confidence < 0.4 →
//      sharpeFallback inside ai-portfolio.ts ranks by 30-day risk-adjusted
//      momentum (the previous behaviour). Trading never breaks because of
//      an AI hiccup.
//   3. Result is cached for 1 hour at this layer so the trading engine's
//      per-minute scan reads from cache (no API calls per tick).
//
// The trading engine sees the same Set<string> of elite tickers — only the
// decider has changed.

import { type AlpacaCreds } from './alpaca';
import { selectEliteWithAI } from './ai-portfolio';

// 15 min — AI runs 4× per hour instead of 1×. Higher cadence means more
// reactive portfolio (catches news + market movement faster) at ~4× Grok
// cost. Trade-off worth it given the autonomy mandate; tune up later if
// cost becomes the binding constraint.
const CACHE_TTL_MS = 15 * 60 * 1000;

export type EliteSource = 'grok-4-heavy' | 'sharpe-fallback';

interface CachedResult {
  ts: number;
  tickers: Set<string>;
  source: EliteSource;
}

let cached: CachedResult | null = null;

export async function computeEliteTickers(
  creds: AlpacaCreds,
): Promise<{ tickers: Set<string>; source: EliteSource; scanned: number; qualified: number }> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return {
      tickers: cached.tickers,
      source: cached.source,
      scanned: 0,
      qualified: cached.tickers.size,
    };
  }

  const r = await selectEliteWithAI(creds);
  cached = {
    ts: Date.now(),
    tickers: r.tickers,
    source: r.source,
  };
  return {
    tickers: r.tickers,
    source: r.source,
    scanned: 0,
    qualified: r.tickers.size,
  };
}
