// Apex Quantum target-allocation engine.
//
// Takes the AI-portfolio's scored picks and produces concrete dollar
// targets per ticker that the trading engine drives positions toward.
//
// Why tier-caps instead of pure score² weighting? Pure score² collapses
// to 35-40 % in the top name when scores are close (which Grok often
// produces). Tier-caps give predictable concentration: top conviction
// gets one slot at 32 %, second 20 %, etc — matches how a human PM would
// run a 8-position book aiming for full deployment with conviction-tilt.
//
// Sum of tier weights × cash factor = % of equity actually deployed.
// Default tier sums to 100 %; we scale by (1 - cash buffer) so the
// engine targets ~98 % deployed and keeps 2 % for slippage / day-trade
// frictions.

import type { AiPortfolioPick } from './ai-portfolio';

/** Tier weights — sum to 1.00. Sorted by score desc, slot-1 gets index 0. */
export const ELITE_TIER_WEIGHTS: readonly number[] = [
  0.32,  // 1st conviction
  0.20,  // 2nd
  0.15,  // 3rd
  0.12,  // 4th
  0.08,  // 5th
  0.06,  // 6th
  0.04,  // 7th
  0.03,  // 8th
];

/** Hold this much of equity in cash for slippage + intraday frictions. */
export const CASH_BUFFER_PCT = 0.01;

/** Hard floor — picks below this score get zero weight. */
export const MIN_PICK_SCORE = 7.5;

/** Per-ticker hard ceiling regardless of tier (sanity guardrail). */
export const ABSOLUTE_TICKER_CAP = 0.35;

export interface AllocationTarget {
  ticker: string;
  /** Fraction of equity targeted (e.g. 0.32 = 32 %). */
  weight: number;
  /** Conviction score that produced this weight. */
  score: number;
  /** Rank in the elite slate, 1-indexed. */
  rank: number;
}

/**
 * Compute target weights from scored picks. Returns picks sorted by score
 * with weights from the tier table. Picks below MIN_PICK_SCORE get
 * dropped entirely — better to under-deploy than to fill the slate with
 * weak conviction.
 */
export function computeTargetWeights(picks: AiPortfolioPick[]): AllocationTarget[] {
  const filtered = picks
    .filter((p) => p.score >= MIN_PICK_SCORE)
    .sort((a, b) => b.score - a.score);

  if (filtered.length === 0) return [];

  const slate = filtered.slice(0, ELITE_TIER_WEIGHTS.length);
  const cashFactor = 1 - CASH_BUFFER_PCT;

  // If we have fewer picks than tiers, the unused tier weight gets
  // proportionally redistributed across the picks we do have so the
  // book still aims for ~98 % deployed.
  const usedTierSum = ELITE_TIER_WEIGHTS
    .slice(0, slate.length)
    .reduce((s, w) => s + w, 0);
  const tierScale = usedTierSum > 0 ? 1 / usedTierSum : 1;

  return slate.map((pick, idx) => {
    const rawWeight = ELITE_TIER_WEIGHTS[idx] * tierScale * cashFactor;
    const weight = Math.min(rawWeight, ABSOLUTE_TICKER_CAP);
    return {
      ticker: pick.ticker.toUpperCase(),
      weight,
      score: pick.score,
      rank: idx + 1,
    };
  });
}

/**
 * Convert weight targets into dollar targets given current equity.
 */
export function targetDollars(targets: AllocationTarget[], equity: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of targets) out.set(t.ticker, equity * t.weight);
  return out;
}
