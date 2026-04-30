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
import { selectEliteWithAI, getLatestAiSelection, type AiPortfolioPick } from './ai-portfolio';

// 60 min — slate refreshes hourly. Faster refresh causes excess turnover
// (every drop-out costs roundtrip spread on US stocks ~0.03-0.05 %).
// Hourly is fast enough to react to news regime shifts but slow enough
// that spread bleed stays manageable.
const CACHE_TTL_MS = 60 * 60 * 1000;

// Cron lambdas cold-start frequently — module-level cache dies between
// invocations, so every cold start would otherwise pay the full Grok
// portfolio call cost (up to 55 s) and time the cron out at the 60 s
// maxDuration. We pull the latest persisted selection from
// ai_portfolio_selections as the cold-start cache instead. Same TTL
// applies; only fully-stale rows trigger a fresh Grok call.
const DB_CACHE_TTL_MS = CACHE_TTL_MS;

export type EliteSource = 'ai' | 'sharpe-fallback';

interface CachedResult {
  ts: number;
  tickers: Set<string>;
  picks: AiPortfolioPick[];
  source: EliteSource;
}

let cached: CachedResult | null = null;

// In-flight promise so concurrent callers (e.g. 5 users fanned out in the
// same cron tick) wait on a single AI call instead of all firing their
// own 25 s Grok request in parallel.
let inFlight: Promise<{
  tickers: Set<string>;
  picks: AiPortfolioPick[];
  source: EliteSource;
}> | null = null;

export async function computeEliteTickers(
  creds: AlpacaCreds,
): Promise<{
  tickers: Set<string>;
  picks: AiPortfolioPick[];
  source: EliteSource;
  scanned: number;
  qualified: number;
}> {
  // 1) Hot in-memory cache (warm lambda)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return {
      tickers: cached.tickers,
      picks: cached.picks,
      source: cached.source,
      scanned: 0,
      qualified: cached.tickers.size,
    };
  }

  // 2) Cold-lambda fallback: read latest persisted selection from DB
  //    before paying for a fresh Grok call. Avoids the 60 s cron timeout
  //    that bites when every cold start hits xAI from scratch.
  const stored = await getLatestAiSelection();
  if (stored) {
    const ageMs = Date.now() - new Date(stored.selectedAt).getTime();
    if (ageMs < DB_CACHE_TTL_MS && stored.picks.length > 0) {
      // Backfill score for picks persisted before the score field was
      // added to the schema. Use rank-based defaults: 1st = 9.5, 2nd =
      // 9.0, etc — same shape sharpeFallback would produce.
      const picks = stored.picks.map((p, idx): AiPortfolioPick => ({
        ticker: p.ticker,
        reasoning: p.reasoning,
        score: typeof p.score === 'number' ? p.score : Math.max(7.5, 9.5 - idx * 0.25),
      }));
      const tickers = new Set(picks.map((p) => p.ticker.toUpperCase()));
      const source: EliteSource =
        stored.source === 'ai' ? 'ai' : 'sharpe-fallback';
      cached = { ts: Date.now() - ageMs, tickers, picks, source };
      console.log(
        `[ELITE] DB cache hit — age ${Math.round(ageMs / 1000)}s, source=${source}, picks=${picks.length}`
      );
      return {
        tickers, picks, source,
        scanned: 0, qualified: tickers.size,
      };
    }
  }

  // 3) Both caches stale → run the full AI portfolio call.
  if (!inFlight) {
    console.log('[ELITE] caches cold/stale — running selectEliteWithAI');
    inFlight = (async () => {
      try {
        const r = await selectEliteWithAI(creds);
        cached = {
          ts: Date.now(),
          tickers: r.tickers,
          picks: r.picks,
          source: r.source,
        };
        return { tickers: r.tickers, picks: r.picks, source: r.source };
      } finally {
        inFlight = null;
      }
    })();
  } else {
    console.log('[ELITE] AI call already in flight — joining');
  }
  const r = await inFlight;
  return {
    tickers: r.tickers,
    picks: r.picks,
    source: r.source,
    scanned: 0,
    qualified: r.tickers.size,
  };
}
