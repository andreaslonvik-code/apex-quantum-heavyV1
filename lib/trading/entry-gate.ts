import { isPriorityCore } from '@/lib/blueprints/stocks';
import type { MirrorOrder } from './portfolio-mirror';

/**
 * Per-ticker technical snapshot consumed by the entry filter. Built (with
 * live market data) by `buildIndicatorSnapshots` in engine.ts. Kept here,
 * next to `isAnticipatorySignal`, so the entry-gate logic is a self-contained,
 * dependency-light unit that can be unit-tested without loading the trading
 * engine (which pulls in Alpaca / Supabase / Grok clients).
 */
export interface IndicatorSnapshot {
  ticker: string;
  price: number;
  change_24h_pct: number | null;
  change_5d_pct: number | null;
  rsi_14: number | null;
  sma_50: number | null;
  sma_200: number | null;
  macd_hist: number | null;
  atr_14: number | null;
  /** Bullish RSI divergence vs ~4 bars ago — early reversal signal. */
  bullish_divergence: boolean;
  /** Recent 3-bar volume vs prior 20-bar baseline (smart-money accumulation). */
  volume_accumulation: boolean;
  /** RSI slope > 0.5 units/bar over last 5 bars — momentum confirmation. */
  rsi_rising: boolean;
  /** Recent 10-bar max(high) > prior 10-bar max(high) — uptrend confirmed. */
  higher_highs: boolean;
  /** Recent 10-bar min(low) > prior 10-bar min(low) — buyers absorbing dips. */
  higher_lows: boolean;
  /** higher_highs && higher_lows — full rising-channel confirmation. */
  rising_channel: boolean;
  /** 20-day realized daily-return sigma (e.g. 0.025 = 2.5 %/day). Used for
   *  volatility-targeted position sizing. Null if insufficient bars. */
  realized_vol_20d: number | null;
  /** 1-hour timeframe RSI for multi-timeframe alignment. Null if 1h bars
   *  weren't fetchable. */
  rsi_14_1h: number | null;
  /** 1h timeframe price > 1h SMA50 — short-term-trend confirmation. */
  uptrend_1h: boolean;
  /** Days to next earnings (null = unknown / outside 14-day horizon). */
  days_to_earnings: number | null;
  /** News articles in the last 24 h — proxy for catalyst sensitivity. */
  news_count_24h: number;
  /** 30-trading-day return of this ticker (decimal). Used for relative
   *  strength vs SPY benchmark. Null if insufficient bar history. */
  return_30d: number | null;
  /** Ticker's 30d return MINUS SPY's 30d return, in percentage points.
   *  Positive = leader (outperforming market); negative = laggard. The
   *  primary "are we picking winners?" signal. Null if either side missing. */
  relative_strength_30d: number | null;
  /** Average relative_strength_30d of all watchlist tickers in the same
   *  sector. Used by Grok to identify which sectors are rotating in/out.
   *  Null if sector unknown or no peers with RS data. */
  sector_avg_rs_30d: number | null;
  /** Rank of this ticker by relative_strength_30d within its sector
   *  (1 = leader, 2 = co-leader, 3+ = secondary). Used by engine to
   *  reject non-leader picks when better names exist in same sector. */
  sector_rank: number | null;
  /** Top 5 most-recent headlines for this ticker (last 24 h, ≤100 chars
   *  each). Empty if Finnhub key not set or no recent news. Used by Grok
   *  for sentiment assessment. */
  recent_headlines: string[];
  /**
   * Distance below the highest close in the last 20 bars, as a positive
   * percent. e.g. 8.5 means current price is 8.5 % below the recent peak.
   * 0 means we're AT the high. Captures multi-day pullbacks even when
   * today's change is small (post-bounce mid-pullback).
   */
  pct_below_20bar_high: number | null;
  /**
   * True when this priority-core ticker is in a healthy pullback inside a
   * structural uptrend — exactly the "buy the dip on a winner" setup the
   * user asked the engine to lean into hard. Conditions (all must hold):
   *   - ticker ∈ PRIORITY_CORE_TICKERS
   *   - price > SMA200 (structural uptrend intact)
   *   - price/SMA50 ≥ 0.97 (not below short-term support)
   *   - relative_strength_30d ≥ +5 pp (still a leader, not turning laggard)
   *   - RSI 14 in [25, 65] (not panic, not parabolic)
   *   - change_5d_pct in [-15 %, +25 %] (no falling-knife crashes)
   *   - dip signal: change_24h_pct ≤ -2 OR change_5d_pct ≤ -3
   *                  OR pct_below_20bar_high ≥ 5 ★
   * The 20-bar-high trigger catches names that pulled back days ago and
   * are sitting in the discount window even if today's intraday move is
   * flat or slightly green. Without it, MU at $747 (after $815 peak)
   * would fail PATH E once intraday stabilizes — exactly the case the
   * user flagged as "perfect dip we missed".
   * Always false for non-priority-core tickers.
   */
  priority_core_dip_signal: boolean;
}

/**
 * Anticipatory signal filter — only let through BUYs where statistics
 * favor a bounce, pullback, or trend-confirmed continuation. Three paths.
 *
 * HARD requirement for ALL paths:
 *   - Price > SMA200 — never catch falling knives in established downtrends.
 *
 * Path 1 — Deep dip (RSI < 35):
 *   Pass without confirmation. Statistical bounce probability is already
 *   high enough on its own.
 *
 * Path 2 — Moderate dip (RSI 35–45 OR price within 3 % of SMA50):
 *   Pass only with AT LEAST ONE of {bullish_divergence, volume_accumulation,
 *   MACD positive}. Without confirmation, dips can keep dipping for weeks.
 *
 * Path 3 — Trend-confirmed momentum (RSI 50–65 + rising channel) ★ NEW:
 *   Pass when price action shows a clean rising structure: RSI rising over
 *   5 bars, higher highs AND higher lows, RSI in healthy 50–65 band (not
 *   overbought). This catches stocks like SMCI/MU/TSM in established uptrends
 *   that don't dip but keep grinding higher. No dip required.
 */
export interface AnticipatorySignal {
  ok: boolean;
  reasons: string[];
}

export function isAnticipatorySignal(snap: IndicatorSnapshot): AnticipatorySignal {
  const reasons: string[] = [];

  // ── Earnings blackout ─────────────────────────────────────────────────
  // Earnings releases are binary 60–70 % gambling — skip BUYs in the 3-day
  // window before earnings. Also skip the day after (immediate-aftermath
  // volatility). Null = no earnings data → don't block (Finnhub may be
  // down or ticker has no upcoming earnings within the look-ahead window).
  if (snap.days_to_earnings != null && snap.days_to_earnings >= -1 && snap.days_to_earnings <= 3) {
    return {
      ok: false,
      reasons: [`earnings_blackout (${snap.days_to_earnings}d)`],
    };
  }

  // Two distinct guards so dashboard can tell "engine bug / missing data"
  // apart from "ticker is genuinely in a downtrend". The 250-bar fetch
  // should make the first guard rare; if it ever fires we know something
  // upstream broke.
  if (snap.sma_200 == null) {
    return { ok: false, reasons: ['sma200_unavailable (insufficient_bar_history)'] };
  }
  if (snap.price < snap.sma_200) {
    return {
      ok: false,
      reasons: [`not_in_uptrend (price ${snap.price} < SMA200 ${snap.sma_200})`],
    };
  }

  // ── Sector-uptrend mandate (1-month-momentum pivot 2026-06-05) ─────────
  // Hard gate for ALL buys, priority-core included: only enter a name whose
  // SECTOR is in an uptrend (top-5-leader sector_avg_rs_30d > 0, i.e. the
  // sector's leaders are beating SPY over 30d). This replaces the old "only
  // block when sector_avg_rs < -10" tolerance — we now refuse to add risk in
  // any sector that isn't outright leading. Null = missing data → fail-open
  // (don't freeze trading on a data gap; the price>SMA200 guard still binds).
  if (snap.sector_avg_rs_30d != null && snap.sector_avg_rs_30d <= 0) {
    return {
      ok: false,
      reasons: [`sector_not_uptrend (sector_rs ${snap.sector_avg_rs_30d.toFixed(1)}pp ≤ 0)`],
    };
  }

  const isDeepOversold = snap.rsi_14 != null && snap.rsi_14 < 35;
  const isModerateOversold = snap.rsi_14 != null && snap.rsi_14 < 45;
  const nearSupport =
    snap.sma_50 != null && snap.sma_50 > 0 && snap.price / snap.sma_50 < 1.03;

  const intradayAligned =
    snap.rsi_14_1h == null || snap.uptrend_1h; // null = pass; available = require uptrend

  // ── PATH E: PRIORITY-CORE DIP-BUY (highest priority) ────────────────
  // User-curated leaders (PRIORITY_CORE_TICKERS — 29 names across 8 sectors;
  // see PRIORITY_CORE_BY_SECTOR in stocks.ts) get a dedicated entry path
  // for healthy pullbacks inside a structural uptrend. Without
  // this, a -6 % intraday dip on a leader breaks PATH C (rsi_rising=false,
  // rising_channel=false) and slips through to PATH A which is too weak
  // a signal to allocate the top slot to. PATH E exists so the engine
  // doesn't miss the discount window on names we already love.
  //
  // Criteria are pre-computed in `buildIndicatorSnapshots` — see the
  // `priority_core_dip_signal` field doc on IndicatorSnapshot for the
  // full guard list (price > SMA200, RS ≥ +5 pp, RSI ∈ [25, 65], 5d
  // change ∈ [-15 %, +25 %], dip detected as either -3 % intraday or
  // -5 %+ over 5 days).
  if (snap.priority_core_dip_signal) {
    reasons.push(
      'priority_core_dip_pathE',
      `rs30d_+${snap.relative_strength_30d?.toFixed(1)}pp`,
      `rsi_${snap.rsi_14?.toFixed(1)}`,
      `1d_${snap.change_24h_pct?.toFixed(1)}%`,
      `5d_${snap.change_5d_pct?.toFixed(1)}%`,
      'structural_uptrend_intact',
    );
    if (snap.bullish_divergence) reasons.push('bullish_rsi_divergence');
    if (snap.volume_accumulation) reasons.push('volume_accumulation');
    return { ok: true, reasons };
  }

  // ── PATH F: PRIORITY-CORE PASSTHROUGH (12-month-portfolio leaders) ──
  // For priority-core that ISN'T in a dip (PATH E didn't fire), still let
  // them through as long as structural uptrend holds. User has designated
  // these names as the 12-month portfolio core — the strict PATH A-D gates
  // exist to discipline random-ticker BUYs, but for the priority list the
  // conviction work is already done. RSI ≤ 75 (no blow-off-top) and RS30d
  // ≥ 0 (still outperforming) are the only guards beyond the SMA200 +
  // earnings-blackout checks already applied above.
  if (
    isPriorityCore(snap.ticker) &&
    snap.relative_strength_30d != null && snap.relative_strength_30d >= 0 &&
    snap.rsi_14 != null && snap.rsi_14 <= 75
  ) {
    reasons.push(
      'priority_core_passthrough_pathF',
      `rs30d_${snap.relative_strength_30d.toFixed(1)}pp`,
      `rsi_${snap.rsi_14.toFixed(1)}`,
      'structural_uptrend_intact',
    );
    if (snap.rising_channel) reasons.push('rising_channel');
    return { ok: true, reasons };
  }

  // ── PATH G: GROK-TRUST PERMISSIVE PASSTHROUGH (priority-core) ────────
  // User mandate (2026-05-14): priority-core picks should rarely be
  // skipped — let Grok have more authority over these 12-month-portfolio
  // names. PATH E demands a perfect dip; PATH F demands RS ≥ 0 and
  // RSI ≤ 75; both reject otherwise-fine priority-core setups (e.g.
  // shallow laggards, RSI 76-79 in healthy uptrends).
  //
  // PATH G defers to Grok with only hard-safety guards remaining:
  //   - Structural uptrend (price > SMA200) — already enforced above.
  //   - No earnings blackout — already enforced above.
  //   - RSI < 80 — block blow-off-top extremes only.
  //   - 5d > -10 % — block obvious decay/crash patterns.
  //   - sector_avg_rs_30d > -10 pp — sector-bear circuit breaker. Even if
  //     a single priority-core name is still above SMA200, a deep sector-
  //     wide drawdown (whole sector trailing SPY by >10 pp over 30d) is
  //     the canary for narrative break. PATH G is the only path without a
  //     per-ticker RS guard — without this sector check it would let Grok
  //     keep BUYing into a collapsing sector before individual SMA200s
  //     have broken. Null sector_avg_rs falls through (allow) so missing
  //     data doesn't block trades; the upstream RS guards still bind.
  //
  // This replaces the `structural_laggard` (RS < -5) and `no_dip_no_trend`
  // rejections for priority-core. Non-priority-core tickers still hit the
  // strict gates below; they don't get this trust.
  if (
    isPriorityCore(snap.ticker) &&
    (snap.rsi_14 == null || snap.rsi_14 < 80) &&
    (snap.change_5d_pct == null || snap.change_5d_pct > -10) &&
    (snap.sector_avg_rs_30d == null || snap.sector_avg_rs_30d > -10)
  ) {
    reasons.push(
      'priority_core_grok_trust_pathG',
      `rsi_${snap.rsi_14?.toFixed(1) ?? '?'}`,
      `5d_${snap.change_5d_pct?.toFixed(1) ?? '?'}%`,
    );
    if (snap.relative_strength_30d != null) {
      reasons.push(`rs30d_${snap.relative_strength_30d.toFixed(1)}pp`);
    }
    if (snap.sector_avg_rs_30d != null) {
      reasons.push(`sector_rs_${snap.sector_avg_rs_30d.toFixed(1)}pp`);
    }
    if (snap.rising_channel) reasons.push('rising_channel');
    if (snap.volume_accumulation) reasons.push('volume_accumulation');
    return { ok: true, reasons };
  }

  // ── Path 4: MOMENTUM LEADER (PATH C — for picking winners) ───────────
  // Highest-priority path. Multiple confirmations required:
  //   - relative_strength_30d ≥ +3 pp (outperforming SPY structurally)
  //   - RSI 55-72 (healthy-to-strong, not extreme overbought)
  //   - 5d return ≥ +2 % (positive recent drift)
  //   - Above SMA50 (short-term uptrend)
  //   - Rising RSI + rising channel + intraday aligned
  //   - volume_accumulation = true (smart-money confirmation)
  //   - sector_rank ≤ 2 (top-2 in sector — reject secondary names like
  //     SMCI when NVDA/MSFT are also available)
  const isLeader =
    snap.relative_strength_30d != null && snap.relative_strength_30d >= 3 &&
    snap.rsi_14 != null && snap.rsi_14 >= 55 && snap.rsi_14 <= 72 &&
    snap.change_5d_pct != null && snap.change_5d_pct >= 2 &&
    snap.sma_50 != null && snap.price > snap.sma_50 &&
    snap.rsi_rising &&
    snap.rising_channel &&
    intradayAligned &&
    snap.volume_accumulation &&
    (snap.sector_rank == null || snap.sector_rank <= 2);
  if (isLeader) {
    reasons.push(
      'momentum_leader',
      `rs30d_+${snap.relative_strength_30d?.toFixed(1)}pp`,
      `rsi_${snap.rsi_14?.toFixed(1)}_rising`,
      `5d_+${snap.change_5d_pct?.toFixed(1)}%`,
      'above_sma50',
      'rising_channel',
      'volume_accumulation',
      `sector_rank_${snap.sector_rank ?? '?'}`,
    );
    if (snap.uptrend_1h) reasons.push('uptrend_1h_aligned');
    return { ok: true, reasons };
  }

  // ── Path 5: EXTREME MOMENTUM LEADER (PATH D) ─────────────────────────
  // Parabolic-breakout leaders that fail PATH C's rising_channel because
  // price violated the upper channel resistance during a strong run. By
  // PATH C standards they "broke the chart pattern", but by relative-
  // strength standards they ARE the leaders the strategy text wants us
  // to ride (NVDA-2023 type, MU/RKLB right now).
  //
  // Guards picked to catch shallow-pullback entries inside the bigger run,
  // not blow-off-tops:
  //   - RS30d ≥ +15 pp (proven structural leader — far above PATH C's +3)
  //   - RSI 45-72 (includes shallow pullbacks like MU at 47, blocks
  //     fully-parabolic > 72)
  //   - 5d return in [-5 %, +15 %] (not crashing, not blow-off-topping)
  //   - Price > SMA50 (still in uptrend even if channel pattern broke)
  //   - Volume accumulation = true (smart money still buying)
  //   - Sector rank ≤ 3 (relax PATH C's ≤ 2 to allow co-leaders)
  //
  // Post-fill risk-management still applies: 1.5× ATR stop-loss, 15 %
  // profit-take threshold, trailing-stop, daily kill-switch (-3 %). These
  // are bucket-level guards that don't care which entry path opened the
  // position.
  const isExtremeLeader =
    snap.relative_strength_30d != null && snap.relative_strength_30d >= 15 &&
    snap.rsi_14 != null && snap.rsi_14 >= 45 && snap.rsi_14 <= 72 &&
    snap.change_5d_pct != null && snap.change_5d_pct >= -5 && snap.change_5d_pct <= 15 &&
    snap.sma_50 != null && snap.price > snap.sma_50 &&
    snap.volume_accumulation &&
    (snap.sector_rank == null || snap.sector_rank <= 3);
  if (isExtremeLeader) {
    reasons.push(
      'extreme_momentum_leader_pathD',
      `rs30d_+${snap.relative_strength_30d?.toFixed(1)}pp`,
      `rsi_${snap.rsi_14?.toFixed(1)}`,
      `5d_${snap.change_5d_pct?.toFixed(1)}%`,
      'above_sma50',
      'volume_accumulation',
      `sector_rank_${snap.sector_rank ?? '?'}`,
    );
    if (snap.uptrend_1h) reasons.push('uptrend_1h_aligned');
    return { ok: true, reasons };
  }

  // ── Path 3: Trend-confirmed momentum (expanded RSI band 50-68) ───────
  // Picks up healthy uptrends that aren't quite leaders (RS < 3 pp) but
  // still have clean structure. Slightly looser RSI than before so we
  // don't reject tickers in healthy 65-68 range.
  const rsiInHealthyBand =
    snap.rsi_14 != null && snap.rsi_14 >= 50 && snap.rsi_14 <= 68;
  if (
    rsiInHealthyBand &&
    snap.rsi_rising &&
    snap.rising_channel &&
    intradayAligned
  ) {
    reasons.push(
      'trend_confirmed_momentum',
      `rsi_${snap.rsi_14?.toFixed(1)}_rising`,
      'rising_channel_hh_hl',
    );
    if (snap.uptrend_1h) reasons.push('uptrend_1h_aligned');
    if (snap.volume_accumulation) reasons.push('volume_accumulation');
    if (snap.relative_strength_30d != null && snap.relative_strength_30d > 0) {
      reasons.push(`rs30d_+${snap.relative_strength_30d.toFixed(1)}pp`);
    }
    return { ok: true, reasons };
  }

  // ── Paths 1 & 2: Dip-buy (with laggard guard) ────────────────────────
  // Reject dip-buys on structural laggards (underperforming SPY by ≥ -5 pp
  // on 30 days). These are not pullbacks in uptrend — they're broken
  // stocks that keep dripping lower. Buying them is the systematic-loser
  // bias we needed to fix.
  if (
    snap.relative_strength_30d != null &&
    snap.relative_strength_30d < -5
  ) {
    return {
      ok: false,
      reasons: [
        `structural_laggard (RS30d ${snap.relative_strength_30d.toFixed(1)}pp)`,
      ],
    };
  }

  // ── PATH H: RUNNING BREAKOUT (sustained-uptrend extension entry) ─────
  // Catches names that are past PATH C/D's "RSI ≤ 72" cap but still in
  // legitimate uptrends — and crucially, names trading well above SMA50
  // (price/SMA50 > 1.1) that the dip-buy filter ("no_dip_no_trend") would
  // otherwise reject. This is the TSM/PANW/ABSI scenario from the
  // 2026-05-20 dashboard: Grok proposed BUY, engine rejected as "no dip
  // and no rising_channel pattern at low RSI" even though the chart was
  // a clean rising channel ~50–80 % over SMA50.
  //
  // Guards picked to allow extension entries without buying tops:
  //   - RS30d ≥ +5 pp (real leader, not a one-day pop)
  //   - rising_channel = true (structural HH/HL still intact)
  //   - volume_accumulation = true (smart-money confirming the run)
  //   - sector_rank ≤ 3 (top-3 in sector — co-leaders OK, secondaries not)
  //   - price/SMA50 in [1.05, 2.00]  (extended but not parabolic)
  //   - RSI ≤ 78 (block blow-off tops; PATH D maxes at 72, here we relax
  //     because the channel + accumulation gates compensate)
  //   - 5d in [-5 %, +20 %] (not crashing, not just gapped up violently)
  //
  // Mechanical stops + trailing stop still bind post-fill, so an entry
  // that immediately reverses is contained the same as any other path.
  const priceOverSma50 =
    snap.sma_50 != null && snap.sma_50 > 0 ? snap.price / snap.sma_50 : null;
  const isRunningBreakout =
    snap.relative_strength_30d != null && snap.relative_strength_30d >= 5 &&
    snap.rising_channel &&
    snap.volume_accumulation &&
    (snap.sector_rank == null || snap.sector_rank <= 3) &&
    priceOverSma50 != null && priceOverSma50 >= 1.05 && priceOverSma50 <= 2.0 &&
    snap.rsi_14 != null && snap.rsi_14 <= 78 &&
    snap.change_5d_pct != null && snap.change_5d_pct >= -5 && snap.change_5d_pct <= 20;
  if (isRunningBreakout) {
    reasons.push(
      'running_breakout_pathH',
      `rs30d_+${snap.relative_strength_30d?.toFixed(1)}pp`,
      `rsi_${snap.rsi_14?.toFixed(1)}`,
      `price/sma50_${priceOverSma50?.toFixed(2)}`,
      'rising_channel',
      'volume_accumulation',
      `sector_rank_${snap.sector_rank ?? '?'}`,
    );
    if (snap.uptrend_1h) reasons.push('uptrend_1h_aligned');
    return { ok: true, reasons };
  }

  if (!isModerateOversold && !nearSupport) {
    return {
      ok: false,
      reasons: [
        `no_dip_no_trend (RSI ${snap.rsi_14 ?? '?'}, price/SMA50 ${
          snap.sma_50 ? (snap.price / snap.sma_50).toFixed(3) : '?'
        }, rising_channel=${snap.rising_channel}, rsi_rising=${snap.rsi_rising})`,
      ],
    };
  }
  if (isDeepOversold) reasons.push(`deep_oversold_rsi_${snap.rsi_14?.toFixed(1)}`);
  else if (isModerateOversold) reasons.push(`oversold_rsi_${snap.rsi_14?.toFixed(1)}`);
  if (nearSupport) reasons.push('near_sma50_support');

  if (snap.bullish_divergence) reasons.push('bullish_rsi_divergence');
  if (snap.volume_accumulation) reasons.push('volume_accumulation');

  if (isDeepOversold) {
    return { ok: true, reasons };
  }
  const macdPositive = snap.macd_hist != null && snap.macd_hist > 0;
  if (snap.bullish_divergence || snap.volume_accumulation || macdPositive) {
    if (macdPositive && !reasons.includes('bullish_rsi_divergence')) {
      reasons.push('macd_positive');
    }
    return { ok: true, reasons };
  }

  return {
    ok: false,
    reasons: ['no_bullish_confirmation', ...reasons],
  };
}

export interface GateMirrorBuysResult {
  /** BUYs that pass the entry filter and may be placed. */
  allowed: MirrorOrder[];
  /** BUYs held back, with the gating reason for audit/dashboard. */
  gated: Array<{ ticker: string; reason: string }>;
}

/**
 * Gate follower mirror BUYs through the SAME entry filter the leader / self
 * path uses (`isAnticipatorySignal`). A follower may only OPEN or ADD to a
 * name when that ticker shows a valid entry signal *right now* — this is what
 * stops a late joiner from chasing the leader's already-extended positions at
 * the top (the "feil entry" the user reported). De-risking is never routed
 * here: only the BUY side of a mirror plan is gated; SELL/trim orders bypass
 * this entirely.
 *
 * A BUY whose ticker has no indicator snapshot (e.g. insufficient bar history
 * this tick) is gated out fail-safe — we never place an entry we can't
 * justify with a fresh signal.
 *
 * Pure function: no Alpaca / Supabase / Grok. Unit-tested in isolation.
 */
export function gateMirrorBuys(
  buys: MirrorOrder[],
  snapshots: Map<string, IndicatorSnapshot>,
): GateMirrorBuysResult {
  const allowed: MirrorOrder[] = [];
  const gated: Array<{ ticker: string; reason: string }> = [];
  for (const o of buys) {
    if (o.action !== 'BUY') continue; // defensive: only BUYs belong here
    const snap = snapshots.get(o.ticker);
    if (!snap) {
      gated.push({ ticker: o.ticker, reason: 'no_snapshot' });
      continue;
    }
    const sig = isAnticipatorySignal(snap);
    if (!sig.ok) {
      gated.push({ ticker: o.ticker, reason: sig.reasons[0] ?? 'no_signal' });
      continue;
    }
    allowed.push(o);
  }
  return { allowed, gated };
}
