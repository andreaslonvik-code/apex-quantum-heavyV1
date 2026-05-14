import type { AlpacaCreds, AlpacaPosition } from '@/lib/alpaca';
import { getAccount, getPositions } from '@/lib/alpaca';
import { getUserAllocation, type UserAllocation } from '@/lib/user-allocation';
import { BLUEPRINT_LIST, type AssetClass, type Blueprint } from '@/lib/blueprints';

/**
 * Snapshot of the leader's tradable state at one moment in time. Captured
 * once per cron tick and passed to every follower so each follower can
 * rebalance toward the leader's portfolio composition without making its
 * own Alpaca calls for leader data.
 */
export interface LeaderSnapshot {
  clerkUserId: string;
  equity: number;
  allocation: UserAllocation;
  /** Market value (USD) per ticker, partitioned by blueprint watchlist.
   *  A ticker that isn't in any blueprint's watchlist is dropped (e.g.
   *  leader holds a ticker we don't trade in this app). */
  positionsByBlueprint: Record<AssetClass, Map<string, number>>;
}

function normalizeSymbol(symbol: string): string {
  // Mirror of engine.ts normalizePositionSymbol — but keeping a private copy
  // here avoids forcing engine.ts to export internal helpers.
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]+USD$/.test(symbol) && symbol.length >= 6) {
    return `${symbol.slice(0, -3)}/USD`;
  }
  return symbol;
}

/**
 * Build the leader snapshot from a single Alpaca account read. Runs once at
 * the start of every cron tick (after the leader's own scan completes so we
 * capture fresh state). Returns null if either fetch fails — followers then
 * fall back to decision-stream mirroring for that tick.
 */
export async function fetchLeaderSnapshot(
  leaderCreds: AlpacaCreds,
  leaderClerkUserId: string,
): Promise<LeaderSnapshot | null> {
  const [acctRes, posRes, allocation] = await Promise.all([
    getAccount(leaderCreds),
    getPositions(leaderCreds),
    getUserAllocation(leaderClerkUserId),
  ]);
  if (!acctRes.success || !posRes.success) return null;

  const equity = parseFloat(acctRes.data.equity) || 0;
  const positionsByBlueprint: Record<AssetClass, Map<string, number>> = {
    stocks: new Map(),
    crypto: new Map(),
    commodities: new Map(),
  };

  // Map each ticker to its blueprint by watchlist membership. A ticker that
  // doesn't belong to any blueprint (e.g. leader manually bought something
  // off-watchlist) gets dropped — followers should not mirror trades they
  // can't reason about.
  const tickerToBlueprint = new Map<string, AssetClass>();
  for (const bp of BLUEPRINT_LIST) {
    for (const t of bp.watchlist) tickerToBlueprint.set(t, bp.id);
  }

  for (const pos of posRes.data) {
    if (pos.side !== 'long') continue; // never mirror short positions
    const ticker = normalizeSymbol(pos.symbol);
    const bpId = tickerToBlueprint.get(ticker);
    if (!bpId) continue;
    const mv = parseFloat(pos.market_value) || 0;
    if (mv <= 0) continue;
    positionsByBlueprint[bpId].set(ticker, mv);
  }

  return {
    clerkUserId: leaderClerkUserId,
    equity,
    allocation,
    positionsByBlueprint,
  };
}

export type MirrorAction = 'BUY' | 'SELL';
export interface MirrorOrder {
  ticker: string;
  action: MirrorAction;
  /** For BUY: dollar amount to spend. For partial SELL: dollar amount to free. */
  notional?: number;
  /** For full-exit SELL: share quantity (preferred for clean position close). */
  qty?: number;
  reason: string;
}

interface ComputeMirrorPlanArgs {
  leaderSnapshot: LeaderSnapshot;
  blueprint: Blueprint;
  followerEquity: number;
  /** Follower's allocation % to this blueprint (e.g. 33 = 33%). */
  followerAllocationPct: number;
  followerPositions: Map<string, AlpacaPosition>;
  followerInFlight: Set<string>;
  /** Buying power available for new BUYs. Engine passes remainingBuyingPower. */
  followerBuyingPower: number;
  /** Mechanical-stop cool-down (don't re-enter a name just stopped out). */
  cooldownTickers: Set<string>;
  fridayBlackout: boolean;
  isBearRegime: boolean;
}

/** Smallest delta we'll act on, to avoid order churn from price drift. */
const MIN_DELTA_USD = 50;
/** Sell ratios above this get a full-position exit (cleaner than fractional close). */
const FULL_EXIT_RATIO = 0.95;

/**
 * Compute the delta orders that move the follower's portfolio closer to the
 * leader's portfolio composition. Pure function — does not place orders,
 * does not call Alpaca. Caller (engine.runBlueprint) builds Alpaca order
 * requests and dispatches.
 *
 * Algorithm:
 *   1. leader_pct[ticker] = leader_position_value[ticker] / leader_bucket
 *   2. target[ticker] = leader_pct[ticker] × follower_bucket
 *   3. delta = target − follower_current_value
 *   4. BUY positive deltas, SELL negative deltas (cap below MIN_DELTA_USD)
 *
 * Safety:
 *   - Friday blackout blocks new equity BUYs (matches engine policy)
 *   - Cool-down blocks BUY into a recently stopped-out name
 *   - In-flight tickers are skipped (already in motion)
 *   - Bear regime halves all BUY notionals (gentler regime-aware sizing,
 *     mirrors engine's bearMultiplier)
 *   - SELL orders are NOT gated by friday-blackout/bear-regime — exits
 *     should always be allowed to free capital
 */
export function computeMirrorPlan(args: ComputeMirrorPlanArgs): MirrorOrder[] {
  const {
    leaderSnapshot,
    blueprint,
    followerEquity,
    followerAllocationPct,
    followerPositions,
    followerInFlight,
    followerBuyingPower,
    cooldownTickers,
    fridayBlackout,
    isBearRegime,
  } = args;

  const orders: MirrorOrder[] = [];
  const watchlistSet = new Set<string>(blueprint.watchlist);
  const isCrypto = blueprint.id === 'crypto';

  const leaderBucket = (leaderSnapshot.equity * leaderSnapshot.allocation[blueprint.id]) / 100;
  const followerBucket = (followerEquity * followerAllocationPct) / 100;

  // Edge: leader has zero allocation to this bucket. Follower should exit
  // everything in this bucket too — keeps cross-bucket allocations aligned.
  if (leaderBucket <= 0) {
    for (const [ticker, pos] of followerPositions) {
      if (followerInFlight.has(ticker)) continue;
      const qty = parseFloat(pos.qty) || 0;
      if (qty <= 0) continue;
      orders.push({
        ticker,
        action: 'SELL',
        qty,
        reason: 'mirror_exit_leader_zero_alloc',
      });
    }
    return orders;
  }

  // Edge: follower has zero allocation either. Nothing to do here — the
  // blueprint-deallocated path in engine.runBlueprint handles existing
  // positions when bucketCapital <= 0.
  if (followerBucket <= 0) return [];

  // Build leader's per-ticker % within the bucket.
  const leaderPctByTicker = new Map<string, number>();
  const leaderHoldings = leaderSnapshot.positionsByBlueprint[blueprint.id];
  for (const [ticker, marketValue] of leaderHoldings) {
    if (!watchlistSet.has(ticker)) continue;
    leaderPctByTicker.set(ticker, marketValue / leaderBucket);
  }

  // Universe of tickers to consider = leader holds OR follower holds
  // (intersected with this blueprint's watchlist).
  const universe = new Set<string>();
  for (const t of leaderPctByTicker.keys()) universe.add(t);
  for (const [t] of followerPositions) {
    if (watchlistSet.has(t)) universe.add(t);
  }

  const bearMultiplier = isBearRegime ? 0.5 : 1.0;
  let remainingBP = Math.max(0, followerBuyingPower) * 0.95;

  // Sort universe: SELLs first (free capital), then BUYs. The engine's
  // sequential placement honours this ordering — important when follower
  // has limited buying power.
  const sortedUniverse: Array<{ ticker: string; delta: number }> = [];
  for (const ticker of universe) {
    const followerPos = followerPositions.get(ticker);
    const currentValue = followerPos ? parseFloat(followerPos.market_value) || 0 : 0;
    const targetPct = leaderPctByTicker.get(ticker) ?? 0;
    const targetValue = targetPct * followerBucket;
    sortedUniverse.push({ ticker, delta: targetValue - currentValue });
  }
  sortedUniverse.sort((a, b) => a.delta - b.delta); // most-negative first

  for (const { ticker, delta } of sortedUniverse) {
    if (followerInFlight.has(ticker)) continue;
    if (Math.abs(delta) < MIN_DELTA_USD) continue;

    if (delta > 0) {
      // BUY delta to top up toward target
      if (fridayBlackout && !isCrypto) {
        // Don't queue BUYs into Friday-afternoon blackout — same policy as
        // the decision-stream engine. Will retry on Monday.
        continue;
      }
      if (cooldownTickers.has(ticker)) {
        // Recently stopped out — whipsaw protection. Will retry after
        // 5-day cool-down expires.
        continue;
      }
      let buyNotional = delta * bearMultiplier;
      if (buyNotional > remainingBP) buyNotional = remainingBP;
      if (buyNotional < MIN_DELTA_USD) continue;
      orders.push({
        ticker,
        action: 'BUY',
        notional: Math.round(buyNotional * 100) / 100,
        reason: 'mirror_topup',
      });
      remainingBP -= buyNotional;
    } else {
      // SELL |delta| to trim toward target (or full-exit if delta is most
      // of the current position).
      const followerPos = followerPositions.get(ticker);
      if (!followerPos) continue;
      const posQty = parseFloat(followerPos.qty) || 0;
      const posValue = parseFloat(followerPos.market_value) || 0;
      if (posQty <= 0 || posValue <= 0) continue;
      const sellRatio = Math.abs(delta) / posValue;
      if (sellRatio >= FULL_EXIT_RATIO) {
        orders.push({
          ticker,
          action: 'SELL',
          qty: posQty,
          reason: leaderPctByTicker.has(ticker) ? 'mirror_trim_full' : 'mirror_exit',
        });
      } else {
        // Partial trim — sell proportional quantity (rounded down to avoid
        // overselling). Notional partial-sell is awkward on Alpaca; qty is
        // cleaner and gives deterministic fills.
        const sellQty = Math.floor(posQty * sellRatio * 1000) / 1000;
        if (sellQty <= 0) continue;
        orders.push({
          ticker,
          action: 'SELL',
          qty: sellQty,
          reason: 'mirror_trim',
        });
      }
    }
  }

  return orders;
}
