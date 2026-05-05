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

/** Tier weights — sum to 1.00. Sorted by score desc, slot-1 gets index 0.
 *  Supports 3-8 picks per v6.1 spec. Variable slate size is handled by
 *  computeTargetWeights' tierScale: fewer picks = automatically more
 *  concentration on top names, more picks = broader spread. Weights
 *  are heavy-headed with a long lotto tail for IONQ/HELP/RKLB-class
 *  catalyst plays. */
export const ELITE_TIER_WEIGHTS: readonly number[] = [
  0.25,  // 1st conviction (kjerne)
  0.22,  // 2nd
  0.19,  // 3rd
  0.14,  // 4th
  0.12,  // 5th
  0.04,  // 6th (lotto)
  0.02,  // 7th (lotto)
  0.02,  // 8th (lotto)
];

/** Hold this much of equity in cash for slippage + intraday frictions.
 *  0.5 % is the minimum buffer that still covers normal spread bleed on
 *  large-cap names. Targeting ~99.5 % deployed maximises capital working
 *  toward the asymmetric-upside thesis. */
export const CASH_BUFFER_PCT = 0.005;

/** Hard floor — picks below this score get zero weight. 8.0 keeps the
 *  slate full (5 picks) even on days where Grok scores conservatively,
 *  prioritising deployment over picky filtering. The fallback at line ~76
 *  guards us from deploying with nothing, but that fallback should rarely
 *  fire with a score floor this permissive. */
export const MIN_PICK_SCORE = 8.0;

/** Per-ticker hard ceiling regardless of tier (sanity guardrail). Top
 *  tier is now 35 %; 40 % gives a small headroom for price appreciation
 *  before the per-ticker cap kicks in on rebalance buys. */
export const ABSOLUTE_TICKER_CAP = 0.40;

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
  let filtered = picks
    .filter((p) => p.score >= MIN_PICK_SCORE)
    .sort((a, b) => b.score - a.score);

  // Fallback: if no pick clears the 9.5 threshold but we got picks back,
  // use the top-3 anyway. Better to deploy with slightly lower-conviction
  // names than to sit in cash through what may be the entry day for the
  // next high-conviction setup.
  if (filtered.length === 0 && picks.length > 0) {
    filtered = [...picks].sort((a, b) => b.score - a.score).slice(0, 3);
  }

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
