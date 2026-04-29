// Apex Quantum self-learning layer.
//
// Three responsibilities:
//   1. Record every successful BUY as a FIFO lot in position_lots, tagged
//      with the entry signal type that originated it.
//   2. On every successful SELL, FIFO-close the oldest open lots for that
//      user+ticker and compute realised P&L per lot — attributing it back
//      to the entry signal.
//   3. Periodically (daily, via /api/cron/learn) aggregate closed lots,
//      compute hit rate + avg return per BUY signal type, and update
//      signal_multipliers with bounded steps. The trading engine reads
//      these multipliers and scales BUY sizing accordingly — successful
//      signals get bigger bets, failing signals get throttled.
//
// Only BUY-side alpha signals (DIP / RSI_LOW / UNDERWEIGHT) are learnable.
// Risk-management signals (EXIT / STOPLOSS / OVERWEIGHT / REBALANCE) always
// run at full strength — we never want to dampen "get me out" logic.

import { createAdminClient } from '@/utils/supabase/admin';

export const LEARNABLE_SIGNALS = ['DIP', 'RSI_LOW', 'UNDERWEIGHT'] as const;
export type LearnableSignal = (typeof LEARNABLE_SIGNALS)[number];

const CACHE_TTL_MS = 15 * 60 * 1000;
const LEARNING_WINDOW_DAYS = 60;
const MIN_SAMPLE_SIZE = 10;
const MAX_STEP_PER_UPDATE = 0.10;
const MIN_MULTIPLIER = 0.5;
const MAX_MULTIPLIER = 1.5;

interface MultipliersCache {
  ts: number;
  byType: Map<string, number>;
}

let cached: MultipliersCache | null = null;

function neutralMultipliers(): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of LEARNABLE_SIGNALS) m.set(s, 1.0);
  return m;
}

/**
 * Read current learned multipliers. Cached for 15 minutes — the trading
 * engine calls this every scan, so we don't want to hit Supabase 60×/hour.
 * Fail-safe: any error returns neutral 1.0 multipliers so a database hiccup
 * never breaks trading.
 */
export async function getSignalMultipliers(): Promise<Map<string, number>> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.byType;

  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('signal_multipliers')
      .select('signal_type, multiplier');
    if (error || !data) {
      const m = neutralMultipliers();
      cached = { ts: Date.now(), byType: m };
      return m;
    }
    const m = neutralMultipliers();
    for (const row of data) {
      m.set(String(row.signal_type), Number(row.multiplier));
    }
    cached = { ts: Date.now(), byType: m };
    return m;
  } catch {
    const m = neutralMultipliers();
    cached = { ts: Date.now(), byType: m };
    return m;
  }
}

/**
 * Returns multiplier for a signal type. EXIT/STOPLOSS/OVERWEIGHT and any
 * non-learnable signal returns 1.0 — risk-management runs at full strength.
 */
export function multiplierFor(signalType: string, multipliers: Map<string, number>): number {
  if (!(LEARNABLE_SIGNALS as readonly string[]).includes(signalType)) return 1.0;
  return multipliers.get(signalType) ?? 1.0;
}

/**
 * Record a successful BUY as an open FIFO lot. Best-effort — if Supabase
 * is unavailable we log and continue (the order already executed on
 * Alpaca, no point throwing).
 */
export async function recordEntryLot(input: {
  clerkUserId: string;
  ticker: string;
  qty: number;
  entryPrice: number;
  signalType: string;
  signalReason?: string;
}): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.from('position_lots').insert({
      clerk_user_id: input.clerkUserId,
      ticker: input.ticker.toUpperCase(),
      qty_remaining: input.qty,
      qty_initial: input.qty,
      entry_price: input.entryPrice,
      entry_signal_type: input.signalType,
      entry_signal_reason: input.signalReason ?? null,
      status: 'open',
    });
  } catch (e) {
    console.error('[LEARNING] recordEntryLot failed:', e);
  }
}

/**
 * FIFO-close oldest open lots for this user+ticker until `qty` shares are
 * accounted for. For each lot we touch:
 *   - Compute realised P&L on the closed slice = (exit − entry) × shares
 *   - Subtract closed shares from qty_remaining
 *   - If qty_remaining hits 0: mark closed, record exit_price/signal/at,
 *     accumulate realized_pnl
 *   - Otherwise: leave open with reduced qty_remaining and accumulate
 *     realized_pnl on the partial slice
 *
 * Returns total P&L attributed and a breakdown by entry signal type for
 * telemetry. Best-effort — never throws.
 */
export async function closeEntryLots(input: {
  clerkUserId: string;
  ticker: string;
  qty: number;
  exitPrice: number;
  exitSignalType: string;
}): Promise<{ realisedPnl: number; byEntrySignal: Record<string, number> }> {
  const out = { realisedPnl: 0, byEntrySignal: {} as Record<string, number> };
  if (input.qty <= 0) return out;
  try {
    const sb = createAdminClient();
    const { data: openLots, error } = await sb
      .from('position_lots')
      .select('id, qty_remaining, entry_price, entry_signal_type, realized_pnl')
      .eq('clerk_user_id', input.clerkUserId)
      .eq('ticker', input.ticker.toUpperCase())
      .eq('status', 'open')
      .order('entry_at', { ascending: true });
    if (error || !openLots || openLots.length === 0) return out;

    let remaining = input.qty;
    const exitAt = new Date().toISOString();
    for (const lot of openLots) {
      if (remaining <= 0) break;
      const lotQty = Number(lot.qty_remaining);
      const closeFromLot = Math.min(lotQty, remaining);
      const entryPrice = Number(lot.entry_price);
      const slicePnl = (input.exitPrice - entryPrice) * closeFromLot;
      const newRemaining = lotQty - closeFromLot;
      const accumulatedPnl = Number(lot.realized_pnl ?? 0) + slicePnl;

      const update: Record<string, unknown> = {
        qty_remaining: newRemaining,
        realized_pnl: accumulatedPnl,
      };
      if (newRemaining <= 0) {
        update.status = 'closed';
        update.exit_price = input.exitPrice;
        update.exit_signal_type = input.exitSignalType;
        update.exit_at = exitAt;
      }
      await sb.from('position_lots').update(update).eq('id', lot.id);

      out.realisedPnl += slicePnl;
      const sig = String(lot.entry_signal_type);
      out.byEntrySignal[sig] = (out.byEntrySignal[sig] ?? 0) + slicePnl;
      remaining -= closeFromLot;
    }
  } catch (e) {
    console.error('[LEARNING] closeEntryLots failed:', e);
  }
  return out;
}

export interface SignalUpdate {
  signal_type: string;
  hit_rate: number;
  avg_pnl_pct: number;
  sample_size: number;
  prev_multiplier: number;
  new_multiplier: number;
}

/**
 * Read closed lots from the last LEARNING_WINDOW_DAYS, compute per-signal
 * stats, and update signal_multipliers with bounded steps:
 *   target = clip(1.0 + (hit_rate − 0.5) × 2, 0.5, 1.5)
 *   new    = clip(prev + clip(target − prev, ±MAX_STEP_PER_UPDATE), 0.5, 1.5)
 *
 * Bounded so a single noisy window can never swing the multiplier by more
 * than MAX_STEP_PER_UPDATE. Convergence to a target multiplier takes ~10
 * update windows = ~10 days at the daily cron cadence.
 *
 * Skips signal types with fewer than MIN_SAMPLE_SIZE closed trades (not
 * enough data to learn from).
 */
export async function computeAndUpdateMultipliers(): Promise<{
  updated: SignalUpdate[];
  skipped: string[];
  windowDays: number;
}> {
  const sb = createAdminClient();
  const sinceIso = new Date(Date.now() - LEARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: lots } = await sb
    .from('position_lots')
    .select('entry_signal_type, entry_price, exit_price, qty_initial')
    .eq('status', 'closed')
    .gte('exit_at', sinceIso);

  const byType = new Map<
    string,
    { wins: number; total: number; pnlPctSum: number }
  >();
  for (const lot of lots ?? []) {
    const entryPrice = Number(lot.entry_price);
    const exitPrice = Number(lot.exit_price);
    if (entryPrice <= 0 || exitPrice <= 0) continue;
    const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    const t = String(lot.entry_signal_type);
    const cur = byType.get(t) ?? { wins: 0, total: 0, pnlPctSum: 0 };
    if (pnlPct > 0) cur.wins++;
    cur.total++;
    cur.pnlPctSum += pnlPct;
    byType.set(t, cur);
  }

  const { data: currentRows } = await sb
    .from('signal_multipliers')
    .select('signal_type, multiplier');
  const currentByType = new Map<string, number>();
  for (const r of currentRows ?? []) {
    currentByType.set(String(r.signal_type), Number(r.multiplier));
  }

  const updated: SignalUpdate[] = [];
  const skipped: string[] = [];

  for (const sigType of LEARNABLE_SIGNALS) {
    const stats = byType.get(sigType);
    const prev = currentByType.get(sigType) ?? 1.0;
    if (!stats || stats.total < MIN_SAMPLE_SIZE) {
      skipped.push(sigType);
      continue;
    }
    const hitRate = stats.wins / stats.total;
    const avgPnlPct = stats.pnlPctSum / stats.total;

    let target = 1.0 + (hitRate - 0.5) * 2;
    target = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, target));

    const step = Math.max(-MAX_STEP_PER_UPDATE, Math.min(MAX_STEP_PER_UPDATE, target - prev));
    let newMul = prev + step;
    newMul = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, newMul));
    newMul = Math.round(newMul * 100) / 100;

    await sb.from('signal_multipliers').upsert({
      signal_type: sigType,
      multiplier: newMul,
      hit_rate: Math.round(hitRate * 100) / 100,
      avg_pnl_pct: Math.round(avgPnlPct * 100) / 100,
      sample_size: stats.total,
      updated_at: new Date().toISOString(),
    });

    updated.push({
      signal_type: sigType,
      hit_rate: Math.round(hitRate * 1000) / 1000,
      avg_pnl_pct: Math.round(avgPnlPct * 100) / 100,
      sample_size: stats.total,
      prev_multiplier: prev,
      new_multiplier: newMul,
    });
  }

  // Invalidate the multiplier cache so the next scan picks up the update.
  cached = null;

  return { updated, skipped, windowDays: LEARNING_WINDOW_DAYS };
}
