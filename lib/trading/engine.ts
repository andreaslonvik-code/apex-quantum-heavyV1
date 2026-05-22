import {
  type AlpacaAccount,
  type AlpacaBar,
  type AlpacaClock,
  type AlpacaCreds,
  type AlpacaOrder,
  type AlpacaPosition,
  cancelOrder as alpacaCancelOrder,
  getAccount,
  getClock,
  getCryptoBars,
  getLatestCryptoPrice,
  getLatestPrice,
  getOrders,
  getPortfolioHistory,
  getPositions,
  getStockBars,
  placeOrder,
} from '@/lib/alpaca';
import { BLUEPRINT_LIST, type AssetClass, type Blueprint } from '@/lib/blueprints';
import { sectorOf } from '@/lib/blueprints/sectors';
import { isPriorityCore } from '@/lib/blueprints/stocks';
import { decide, type GrokDecision, type GrokDecisionPayload } from '@/lib/grok';
import {
  getLatestDecision,
  getRecentStopOutTickers,
  saveDecision,
} from '@/lib/grok-decisions';
import { getUserAllocation } from '@/lib/user-allocation';
import {
  atr,
  bullishDivergence,
  higherHighs,
  higherLows,
  macd,
  realizedVolatility,
  risingChannel,
  rsi,
  rsiRising,
  sma,
  volumeAccumulation,
} from './indicators';
import {
  daysToEarnings,
  newsCount24h,
  newsHeadlines24h,
  prefetchNews,
} from './calendar';
import {
  computeMirrorPlan,
  type LeaderSnapshot,
  type MirrorOrder,
} from './portfolio-mirror';

// Portfolio Mirror Mode — followers rebalance toward leader's per-ticker %
// composition instead of mirroring the decision stream. Default ON; set
// PORTFOLIO_MIRROR_MODE=off in env to fall back to decision-stream mirror
// for emergency rollback without a redeploy.
const MIRROR_MODE_ENABLED = process.env.PORTFOLIO_MIRROR_MODE !== 'off';
/** Minimum gap between mirror executions per (user, blueprint). Prevents
 *  micro-trades from intra-minute price drift firing every cron tick. */
const MIRROR_CADENCE_MS = 10 * 60 * 1000;

/**
 * Apex Quantum trading engine — Grok-driven.
 *
 * Cadence:
 *   - Cron tick fires every minute.
 *   - Grok is called at most once every GROK_CADENCE_MS (default 15 min) per
 *     user per blueprint. Between calls only mechanical safety runs.
 *   - Mechanical safety = ATR-stop + profit-take checks on held positions.
 *     These are bounded protection in case price moves between Grok calls.
 *
 * Decision execution:
 *   - Grok returns `{ thesis, decisions: [{ ticker, action, notional_usd, reason }] }`.
 *   - BUY → notional market order on Alpaca, position_intent: buy_to_open.
 *   - SELL → close full Alpaca position for that ticker.
 *   - HOLD → no order.
 */

export type TradeAction = 'BUY' | 'SELL';
export type TradeStatus = 'OK' | 'ERR' | 'SKIP';

export interface TradeResult {
  blueprintId: AssetClass;
  ticker: string;
  action: TradeAction;
  qty: number;
  notional: number;
  status: TradeStatus;
  reason: string;
  error?: string;
}

export interface BlueprintRunResult {
  blueprintId: AssetClass;
  bucketCapital: number;
  positionsHeld: number;
  trades: TradeResult[];
  killSwitchTriggered: boolean;
  grokCalled: boolean;
  thesis?: string;
  reason?: string;
}

export interface UserScanResult {
  clerkUserId: string;
  ranAt: string;
  equity: number;
  buyingPower: number;
  blueprints: BlueprintRunResult[];
  error?: string;
}

// 20 min cadence: for a daily-bar strategy, indicators move negligibly within
// 20 min, so doubling cadence costs almost nothing in signal quality but
// halves Grok API spend. Mechanical safety (ATR-stop, profit-take, trailing
// stop) still runs every minute independent of Grok, so risk management is
// unaffected by the longer cadence.
const GROK_CADENCE_MS = 20 * 60 * 1000;
// 250 bars to support SMA200 computation. With only 60 bars (the previous
// value), `sma(closes, 200)` always returned null → anticipatory filter
// rejected EVERY ticker with "not_in_uptrend (price < SMA200)" because the
// guard `snap.sma_200 == null` short-circuited to "rejected". Symptom: all
// Grok BUYs got HOPP regardless of actual price/MA relationship.
// 250 ≈ 1 trading year, comfortably enough for SMA200 + buffer for newer
// listings that don't have a full year of history yet.
const INDICATOR_BAR_COUNT = 250;
const MIN_NOTIONAL_USD = 1.0;

/**
 * Hard-disabled blueprints. These buckets will be ignored by the engine —
 * existing positions will be liquidated on the next tick (bucket capital
 * forced to 0 → deallocation logic fires) and no new orders placed.
 *
 * Currently disabled because the crypto + commodities trading was producing
 * stop-loss-driven losses in choppy markets. Re-enable by removing entries
 * here once we've validated each blueprint with backtests.
 */
const DISABLED_BLUEPRINTS: ReadonlySet<AssetClass> = new Set(['crypto', 'commodities']);

// Crash circuit breaker: when account equity is down this fraction or more
// from its trailing ~1-month peak, the engine halts ALL new BUYs and the
// always-invested mandate (same gate as the daily kill-switch) until equity
// recovers. The daily -3 % kill-switch resets every morning and so misses a
// sustained multi-day bleed — an AI-bubble-burst type decline. Set above
// normal strategy volatility (the book routinely sees -10 to -20 % drawdowns)
// so it fires on a real crash, not an ordinary dip. Tunable.
const CIRCUIT_BREAKER_DRAWDOWN = 0.2;
// Sanity cap on a single order's notional, regardless of bucket size.
// Originally $25 k from when the account was ~$100 k — way too restrictive
// at $1 M+ where the chat-mirror procedure wants 35–40 % of bucket = $350–
// 400 k on the #1 pick.
//
// $500 k is a safety ceiling: extended-hours uses whole-share + limit
// (not fractional notional), so Alpaca's notional-fractional limits don't
// apply. Regular-hours notional orders up to ~$200 k work in practice
// with PDT/DTBP relaxed to "exit". $500 k catches any single oversized
// outlier without bottlenecking realistic per-pick sizes.
//
// Per-bucket caps (50 % maxPctPerPosition, freeBucketCapital/N,
// safeRemainingBP/N) all still apply — they prevent total over-deployment.
const MAX_PER_ORDER_NOTIONAL = 500_000;

function tradingSymbol(symbol: string): string {
  return symbol.replace('/', '');
}

/**
 * Macro-regime detection. Fetches SPY daily bars and computes SMA200. When
 * spot < SMA200, we're in a bear regime — historically 80 % of large equity
 * drawdowns happen in this state (Faber 2007, Antonacci 2014). The engine
 * halves position sizes during bear, rather than going fully to cash, so we
 * still benefit from sharp dip-bounces.
 *
 * Returns null when SPY data isn't available — engine treats null as "neutral",
 * not bear (fail-open: we'd rather trade in unknown regime than freeze).
 */
async function detectBearRegime(creds: AlpacaCreds): Promise<{
  isBear: boolean;
  spotPrice: number;
  sma200: number;
  /** SPY 30-trading-day return (decimal) — benchmark for ticker-level relative
   *  strength scoring. Null when bar history is insufficient. */
  return30d: number | null;
} | null> {
  try {
    const r = await getStockBars(creds, 'SPY', { timeframe: '1Day', limit: 220 });
    if (!r.success || r.data.length < 200) return null;
    const closes = r.data.map((b) => b.c);
    const sma200 = sma(closes, 200);
    if (sma200 == null) return null;
    const live = await getLatestPrice(creds, 'SPY');
    const spot = live.success ? live.data : closes[closes.length - 1];
    let return30d: number | null = null;
    if (closes.length >= 31) {
      const past = closes[closes.length - 31];
      if (past > 0) return30d = (spot - past) / past;
    }
    return { isBear: spot < sma200, spotPrice: spot, sma200, return30d };
  } catch {
    return null;
  }
}

/**
 * Crash circuit breaker. The daily kill-switch (-3 %) handles a single bad
 * day but resets every morning, so a sustained multi-day bleed — an AI-
 * bubble-burst type decline — slips through it. This trips when account
 * equity is down >= CIRCUIT_BREAKER_DRAWDOWN from its peak over the trailing
 * ~1 month. While tripped, runBlueprint halts all new BUYs and the always-
 * invested mandate (same gate as the kill-switch) so the engine stops
 * catching the falling knife. Mechanical stops keep protecting positions.
 *
 * Fail-open: a portfolio-history fetch error returns false — a transient
 * Alpaca hiccup must not freeze the whole engine. The daily kill-switch and
 * mechanical stops still protect in that case.
 */
async function detectCrashCircuitBreaker(
  creds: AlpacaCreds,
  currentEquity: number,
): Promise<boolean> {
  if (!(currentEquity > 0)) return false;
  try {
    const r = await getPortfolioHistory(creds, { period: '1M', timeframe: '1D' });
    if (!r.success) return false;
    const equityPoints = r.data.equity.filter(
      (e): e is number => typeof e === 'number' && e > 0,
    );
    // Too little history to judge a peak — don't trip (e.g. new accounts).
    if (equityPoints.length < 5) return false;
    const peak = Math.max(...equityPoints, currentEquity);
    if (!(peak > 0)) return false;
    const drawdownFromPeak = (peak - currentEquity) / peak;
    return drawdownFromPeak >= CIRCUIT_BREAKER_DRAWDOWN;
  } catch {
    return false;
  }
}

/**
 * Are we within the trading-relevant window? Returns true when ET wall-clock
 * is on a weekday between [04:00, 20:00) — pre-market open through after-
 * hours close. Outside that window (overnight 20:00–04:00 ET, OR all day
 * Saturday/Sunday), Grok is not called: no fills can happen, indicator
 * drift is negligible, and price-fetch on Alpaca's IEX feed fails when the
 * full market is closed.
 *
 * Mechanical safety (ATR-stop, trailing-stop) still runs every minute
 * regardless — only the Grok decision call is gated. Crypto is unaffected
 * (24/7 markets) but the crypto bucket is currently disabled.
 *
 * NYSE holidays are not handled here — they're rare (~9/year) and Grok
 * calls on those days simply skip via no_price_for_extended_hours. The
 * weekend gate catches ~28 % of the calendar at near-zero engineering cost,
 * which is the bulk of the wasted-call window.
 */
function isTradingHoursWindow(now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const dow = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (dow === 'Sat' || dow === 'Sun') return false;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  // Intl.DateTimeFormat may report midnight as "24"; normalize to 0.
  const h = hour === 24 ? 0 : hour;
  return h >= 4 && h < 20;
}

/**
 * Inside US regular trading hours (RTH = 09:30–16:00 ET, weekdays). Cost-
 * saving lever: Grok cadence stretches 2× during extended hours (pre 04:00–
 * 09:30, after 16:00–20:00 ET) because indicators drift less, news flow
 * is thinner, and fills are limited. RTH stays at full cadence.
 */
function isRegularTradingHours(now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const dow = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (dow === 'Sat' || dow === 'Sun') return false;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const h = hour === 24 ? 0 : hour;
  const minutesIntoDay = h * 60 + minute;
  return minutesIntoDay >= 9 * 60 + 30 && minutesIntoDay < 16 * 60; // [09:30, 16:00)
}

/**
 * True when ET wall-clock is in the evening-rebalance window: 15:40–15:55 ET
 * on a weekday. This is the last 5-20 minutes before NYSE close (16:00 ET).
 *
 * Used to force one Grok call per day in this window with a special
 * "evening_mode" prompt that asks Grok to rebalance the portfolio toward
 * names with the best overnight/next-day setup — favouring robustness
 * (can survive a -5 % overnight gap) over aggressive entries.
 */
function isEveningRebalanceWindow(now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const dow = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (dow === 'Sat' || dow === 'Sun') return false;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const h = hour === 24 ? 0 : hour;
  const minutesIntoDay = h * 60 + minute;
  // [15:40, 15:55) — 15-min window. Stops at 15:55 to leave 5 min before
  // close for any resulting orders to fill.
  return minutesIntoDay >= 15 * 60 + 40 && minutesIntoDay < 15 * 60 + 55;
}

/**
 * Date string YYYY-MM-DD in ET. Used to detect "have we already done the
 * evening-rebalance call for this trading day".
 */
function etDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Hour-bucket string in ET, e.g. "2026-05-12-14". Used to gate live-search
 * tools to at most one call per clock-hour per user/blueprint: if the last
 * decision lands in a different bucket than now (or we have no prior call),
 * the next Grok call runs WITH tools (fresh news/X scan). If the buckets
 * match, the call is prompt-only — engine has already injected
 * `recent_headlines` + RS/sector signals into the user prompt, so the model
 * has the freshness it needs without paying for live search again.
 *
 * Net effect at 20-min RTH cadence: tools fire ~1× per hour (first call to
 * cross the boundary), the other 2 calls run prompt-only. Drops live-search
 * source spend ~60–70 % with negligible alpha impact on a daily-bar strategy.
 */
function etHourBucket(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}`;
}

/**
 * Friday-afternoon BUY blackout. Stop opening NEW positions in the last
 * 90 min before close on Friday — gap risk over the weekend is empirically
 * negative-skewed (weekend-effect literature: French 1980, Bessembinder/Hertzel).
 * We don't trim existing positions yet (more complex; deferred).
 *
 * Markets close 16:00 ET. Blackout starts 14:30 ET. Day-of-week is checked
 * in America/New_York time so daylight-saving transitions don't shift it.
 */
function isFridayBlackout(now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const dow = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (dow !== 'Fri') return false;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const minutesPastNoon = hour * 60 + minute;
  // 14:30 ET = 870 min past midnight
  return minutesPastNoon >= 14 * 60 + 30;
}

/**
 * Build a stock/ETF order that works in BOTH regular hours and pre-/after-
 * market. Alpaca rules:
 *   - Regular hours (09:30–16:00 ET): market orders + notional fractional ok.
 *   - Extended hours (04:00–09:30 ET pre, 16:00–20:00 ET after): ONLY
 *     limit + day + extended_hours: true + WHOLE shares. Market orders and
 *     notional/fractional are rejected.
 *
 * `currentPrice` required so we can size whole-share qty + a tight limit
 * price when we drop into extended-hours mode.
 */
function buildStockOrder(args: {
  symbol: string;
  side: 'buy' | 'sell';
  qty?: number;
  notional?: number;
  currentPrice: number;
  marketIsOpen: boolean;
}): import('@/lib/alpaca').AlpacaOrderRequest | null {
  const { symbol, side, qty, notional, currentPrice, marketIsOpen } = args;
  const positionIntent = side === 'buy' ? 'buy_to_open' : 'sell_to_close';

  if (marketIsOpen) {
    if (notional !== undefined && notional > 0) {
      return {
        symbol,
        notional,
        side,
        type: 'market',
        time_in_force: 'day',
        position_intent: positionIntent,
      };
    }
    if (qty !== undefined && qty > 0) {
      return {
        symbol,
        qty,
        side,
        type: 'market',
        time_in_force: 'day',
        position_intent: positionIntent,
      };
    }
    return null;
  }

  // Extended hours: limit + whole shares + extended_hours flag.
  if (currentPrice <= 0) return null;
  const limitPrice =
    side === 'buy'
      ? Math.round(currentPrice * 1.005 * 100) / 100
      : Math.round(currentPrice * 0.995 * 100) / 100;
  let wholeQty = 0;
  if (qty !== undefined && qty > 0) {
    wholeQty = Math.floor(qty);
  } else if (notional !== undefined && notional > 0) {
    wholeQty = Math.floor(notional / currentPrice);
  }
  if (wholeQty <= 0) return null;
  return {
    symbol,
    qty: wholeQty,
    side,
    type: 'limit',
    limit_price: limitPrice,
    time_in_force: 'day',
    extended_hours: true,
    position_intent: positionIntent,
  };
}

function normalizePositionSymbol(symbol: string): string {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]+USD$/.test(symbol) && symbol.length >= 6) {
    return `${symbol.slice(0, -3)}/USD`;
  }
  return symbol;
}

async function fetchBars(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  ticker: string,
) {
  if (blueprint.id === 'crypto') {
    return getCryptoBars(creds, ticker, {
      timeframe: blueprint.params.timeframe,
      limit: INDICATOR_BAR_COUNT,
    });
  }
  return getStockBars(creds, ticker, {
    timeframe: blueprint.params.timeframe,
    limit: INDICATOR_BAR_COUNT,
  });
}

async function fetchLatest(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  ticker: string,
  fallback: number,
): Promise<number> {
  if (blueprint.id === 'crypto') {
    const r = await getLatestCryptoPrice(creds, ticker);
    if (r.success) return r.data;
  } else {
    const r = await getLatestPrice(creds, ticker);
    if (r.success) return r.data;
  }
  return fallback;
}

interface IndicatorSnapshot {
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

async function buildIndicatorSnapshots(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  spyReturn30d: number | null = null,
): Promise<IndicatorSnapshot[]> {
  const snaps: IndicatorSnapshot[] = [];

  // Pre-fetch news in parallel for all tickers — single batch is cheaper
  // than 46 sequential awaits inside the loop. Fail-soft: if Finnhub key
  // is missing, prefetchNews returns immediately and per-ticker calls
  // return 0 (no news signal).
  await prefetchNews(blueprint.watchlist);

  for (const ticker of blueprint.watchlist) {
    try {
      const r = await fetchBars(creds, blueprint, ticker);
      if (!r.success || r.data.length < 5) continue;
      const bars: AlpacaBar[] = r.data;
      const closes = bars.map((b) => b.c);
      const last = closes[closes.length - 1];
      const live = await fetchLatest(creds, blueprint, ticker, last);
      const p = live || last;
      const ago1 = closes[closes.length - 2] ?? p;
      const ago5 = closes[Math.max(0, closes.length - 6)] ?? p;
      const rsiVal = rsi(closes, 14);
      const hh = higherHighs(bars, 10);
      const hl = higherLows(bars, 10);

      // Multi-timeframe: 1-hour bars for short-term-trend alignment. Only
      // for non-crypto blueprints (crypto pipeline doesn't use this path).
      // Fetch 240 h ≈ 10 trading days of hourly bars.
      let rsi1h: number | null = null;
      let uptrend1h = false;
      if (blueprint.id !== 'crypto') {
        try {
          const hourly = await getStockBars(creds, ticker, {
            timeframe: '1Hour',
            limit: 240,
          });
          if (hourly.success && hourly.data.length >= 50) {
            const hourCloses = hourly.data.map((b) => b.c);
            rsi1h = rsi(hourCloses, 14);
            const sma50_1h = sma(hourCloses, 50);
            uptrend1h =
              sma50_1h != null && hourCloses[hourCloses.length - 1] > sma50_1h;
          }
        } catch {
          // multi-tf is additive — fall back to 1D-only signal on failure
        }
      }

      // 30-trading-day return for relative-strength scoring
      let return30d: number | null = null;
      if (closes.length >= 31) {
        const past = closes[closes.length - 31];
        if (past > 0) return30d = (p - past) / past;
      }
      const rs30d =
        return30d != null && spyReturn30d != null
          ? (return30d - spyReturn30d) * 100 // pp difference, e.g. +5 = leader
          : null;

      // Catalyst layer (failure-soft: null/0/[] when no API key is set)
      const earnings = await daysToEarnings(ticker).catch(() => null);
      const news24h = await newsCount24h(ticker).catch(() => 0);
      const headlines = await newsHeadlines24h(ticker).catch(() => []);

      const sma50Val = sma(closes, 50);
      const sma200Val = sma(closes, 200);
      const change24hPct = ago1 ? ((p - ago1) / ago1) * 100 : null;
      const change5dPct = ago5 ? ((p - ago5) / ago5) * 100 : null;

      // Pullback from 20-bar high. Catches multi-day dips even when
      // today's bar is flat/green. Positive value = below peak.
      const recentBars = bars.slice(-20);
      let max20 = 0;
      for (const b of recentBars) if (b.h > max20) max20 = b.h;
      const pctBelow20BarHigh =
        max20 > 0 ? ((max20 - p) / max20) * 100 : null;

      // PATH E pre-compute: priority-core dip-buy signal. See the field's
      // doc comment on IndicatorSnapshot for the full criteria list.
      const priorityCoreDip =
        isPriorityCore(ticker) &&
        sma200Val != null && p > sma200Val &&
        sma50Val != null && sma50Val > 0 && p / sma50Val >= 0.97 &&
        rs30d != null && rs30d >= 5 &&
        rsiVal != null && rsiVal >= 25 && rsiVal <= 65 &&
        change5dPct != null && change5dPct >= -15 && change5dPct <= 25 &&
        (
          (change24hPct != null && change24hPct <= -2) ||
          (change5dPct != null && change5dPct <= -3) ||
          (pctBelow20BarHigh != null && pctBelow20BarHigh >= 5)
        );

      snaps.push({
        ticker,
        price: round(p, 6),
        change_24h_pct: change24hPct != null ? round(change24hPct, 2) : null,
        change_5d_pct: change5dPct != null ? round(change5dPct, 2) : null,
        rsi_14: nullableRound(rsiVal, 1),
        sma_50: nullableRound(sma50Val, 4),
        sma_200: nullableRound(sma200Val, 4),
        macd_hist: nullableRound(macd(closes)?.hist ?? null, 4),
        atr_14: nullableRound(atr(bars, blueprint.params.atrPeriod), 4),
        bullish_divergence: bullishDivergence(closes, rsiVal),
        volume_accumulation: volumeAccumulation(bars),
        rsi_rising: rsiRising(closes, 5, 14, 0.5),
        higher_highs: hh,
        higher_lows: hl,
        rising_channel: hh && hl,
        realized_vol_20d: nullableRound(realizedVolatility(closes, 20), 5),
        rsi_14_1h: nullableRound(rsi1h, 1),
        uptrend_1h: uptrend1h,
        days_to_earnings: earnings,
        news_count_24h: news24h,
        return_30d: nullableRound(return30d, 4),
        relative_strength_30d: nullableRound(rs30d, 2),
        sector_avg_rs_30d: null, // populated in post-processing
        sector_rank: null, // populated in post-processing
        recent_headlines: headlines,
        pct_below_20bar_high: pctBelow20BarHigh != null
          ? round(pctBelow20BarHigh, 2)
          : null,
        priority_core_dip_signal: priorityCoreDip,
      });
    } catch {
      // skip ticker on fetch error
    }
  }

  // ── Post-processing: sector aggregates + per-ticker sector_rank ──────
  // Group by sector, compute average RS, then rank within sector.
  const bySector = new Map<string, IndicatorSnapshot[]>();
  for (const s of snaps) {
    const sec = sectorOf(s.ticker);
    if (!sec) continue;
    if (!bySector.has(sec)) bySector.set(sec, []);
    bySector.get(sec)!.push(s);
  }
  for (const [, arr] of bySector) {
    // Average RS across sector peers (skip nulls)
    const rsValues = arr
      .map((s) => s.relative_strength_30d)
      .filter((v): v is number => v != null);
    const avg =
      rsValues.length > 0
        ? rsValues.reduce((a, b) => a + b, 0) / rsValues.length
        : null;
    // Sort sector by RS desc, assign rank
    const ranked = [...arr].sort((a, b) => {
      const ra = a.relative_strength_30d ?? -Infinity;
      const rb = b.relative_strength_30d ?? -Infinity;
      return rb - ra;
    });
    ranked.forEach((s, idx) => {
      s.sector_avg_rs_30d = avg != null ? round(avg, 2) : null;
      s.sector_rank = s.relative_strength_30d != null ? idx + 1 : null;
    });
  }

  return snaps;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function nullableRound(n: number | null, decimals: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return round(n, decimals);
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
interface AnticipatorySignal {
  ok: boolean;
  reasons: string[];
}

function isAnticipatorySignal(snap: IndicatorSnapshot): AnticipatorySignal {
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

  const isDeepOversold = snap.rsi_14 != null && snap.rsi_14 < 35;
  const isModerateOversold = snap.rsi_14 != null && snap.rsi_14 < 45;
  const nearSupport =
    snap.sma_50 != null && snap.sma_50 > 0 && snap.price / snap.sma_50 < 1.03;

  const intradayAligned =
    snap.rsi_14_1h == null || snap.uptrend_1h; // null = pass; available = require uptrend

  // ── PATH E: PRIORITY-CORE DIP-BUY (highest priority) ────────────────
  // User-curated leaders (MU/QBTS/IONQ/QUBT/RKLB/VRT) get a dedicated
  // entry path for healthy pullbacks inside a structural uptrend. Without
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
  //
  // This replaces the `structural_laggard` (RS < -5) and `no_dip_no_trend`
  // rejections for priority-core. Non-priority-core tickers still hit the
  // strict gates below; they don't get this trust.
  if (
    isPriorityCore(snap.ticker) &&
    (snap.rsi_14 == null || snap.rsi_14 < 80) &&
    (snap.change_5d_pct == null || snap.change_5d_pct > -10)
  ) {
    reasons.push(
      'priority_core_grok_trust_pathG',
      `rsi_${snap.rsi_14?.toFixed(1) ?? '?'}`,
      `5d_${snap.change_5d_pct?.toFixed(1) ?? '?'}%`,
    );
    if (snap.relative_strength_30d != null) {
      reasons.push(`rs30d_${snap.relative_strength_30d.toFixed(1)}pp`);
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

interface PositionSummary {
  ticker: string;
  qty: number;
  avg_entry: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

function summarizePositions(
  positions: AlpacaPosition[],
  watchlist: ReadonlySet<string>,
): PositionSummary[] {
  const out: PositionSummary[] = [];
  for (const p of positions) {
    const norm = normalizePositionSymbol(p.symbol);
    if (!watchlist.has(norm)) continue;
    out.push(positionToSummary(p, norm));
  }
  return out;
}

function summarizeAllPositions(positions: AlpacaPosition[]): PositionSummary[] {
  return positions.map((p) => positionToSummary(p, normalizePositionSymbol(p.symbol)));
}

function positionToSummary(p: AlpacaPosition, ticker: string): PositionSummary {
  return {
    ticker,
    qty: parseFloat(p.qty) || 0,
    avg_entry: parseFloat(p.avg_entry_price) || 0,
    current_price: parseFloat(p.current_price) || 0,
    market_value: parseFloat(p.market_value) || 0,
    unrealized_pnl: parseFloat(p.unrealized_pl) || 0,
    unrealized_pnl_pct: round((parseFloat(p.unrealized_plpc) || 0) * 100, 2),
  };
}

function accountToSnapshot(acct: AlpacaAccount, env: 'paper' | 'live'): AccountSnapshot {
  return {
    environment: env,
    status: acct.status,
    currency: acct.currency,
    cash: parseFloat(acct.cash) || 0,
    equity: parseFloat(acct.equity) || 0,
    buying_power: parseFloat(acct.buying_power) || 0,
    portfolio_value: parseFloat(acct.portfolio_value) || 0,
    pattern_day_trader: !!acct.pattern_day_trader,
    trading_blocked: !!acct.trading_blocked,
    account_blocked: !!acct.account_blocked,
  };
}

function clockToSummary(c: AlpacaClock): MarketClockSummary {
  return {
    is_open: !!c.is_open,
    next_open: c.next_open,
    next_close: c.next_close,
  };
}

function ordersToSummary(orders: AlpacaOrder[]): OrderSummary[] {
  return orders.slice(0, 20).map((o) => ({
    ticker: o.symbol,
    side: o.side,
    qty: parseFloat(o.qty) || 0,
    notional: 0,
    status: o.status,
    filled_avg_price: parseFloat(o.filled_avg_price ?? '0') || 0,
    submitted_at: o.submitted_at,
    filled_at: o.filled_at ?? null,
  }));
}

interface AccountSnapshot {
  environment: 'paper' | 'live';
  status: string;
  currency: string;
  cash: number;
  equity: number;
  buying_power: number;
  portfolio_value: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
}

interface OrderSummary {
  ticker: string;
  side: string;
  qty: number;
  notional: number;
  status: string;
  filled_avg_price: number;
  submitted_at: string;
  filled_at: string | null;
}

interface MarketClockSummary {
  is_open: boolean;
  next_open: string;
  next_close: string;
}

/**
 * Rank candidates and return the top N most-Grok-relevant ones. Used to
 * shrink the user prompt from all 46 watchlist tickers down to ~10–12.
 *
 * Scoring (higher = more relevant for Grok to consider):
 *   +500  passes anticipatory filter (any path)
 *   +RS   relative_strength_30d (positive amplifies leaders, hurts laggards)
 *   +30   rising_channel
 *   +20   rsi_rising
 *   +10   uptrend_1h
 *   −1000 structural laggard (RS < -5 pp) — sends them to the bottom
 *
 * Tickers we already hold are pinned to the top (engine needs context on
 * them regardless of fresh-pick eligibility).
 *
 * Cost impact: 46 → 12 candidates ≈ −55 % input tokens, ≈ −40 % per-call cost.
 * Quality impact: minimal — Grok was always going to pick from the top of
 * the score list anyway. Engine still has all 46 in scope for its own
 * filter, only the LLM input is sliced.
 */
function rankAndTakeTop(
  candidates: IndicatorSnapshot[],
  heldTickers: Set<string>,
  n: number,
): IndicatorSnapshot[] {
  const scored = candidates.map((s) => {
    let score = 0;
    if (heldTickers.has(s.ticker)) score += 10_000; // always include held
    const sig = isAnticipatorySignal(s);
    if (sig.ok) score += 500;
    // Priority-core dip is the user's most-wanted signal — boost so it
    // always lands in Grok's top-12 view even when a dozen other tickers
    // also pass the filter on a strong day.
    if (s.priority_core_dip_signal) score += 2_000;
    if (s.relative_strength_30d != null) {
      if (s.relative_strength_30d < -5) score -= 1000;
      else score += s.relative_strength_30d;
    }
    if (s.rising_channel) score += 30;
    if (s.rsi_rising) score += 20;
    if (s.uptrend_1h) score += 10;
    return { snap: s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.snap);
}

function buildUserPrompt(args: {
  blueprint: Blueprint;
  bucketCapital: number;
  totalEquity: number;
  buyingPower: number;
  positions: PositionSummary[];
  candidates: IndicatorSnapshot[];
  inFlightTickers: string[];
  allocationPct: number;
  account: AccountSnapshot;
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
  /** True when this is the daily 15:40–15:55 ET evening-rebalance call. */
  eveningMode?: boolean;
}): string {
  const {
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    positions,
    candidates,
    inFlightTickers,
    allocationPct,
    account,
    recentOrders,
    marketClock,
    eveningMode = false,
  } = args;

  const isBucketEmpty = positions.length === 0 && inFlightTickers.length === 0;
  const targetSlots = Math.min(
    blueprint.params.maxPositions,
    Math.max(1, candidates.length),
  );
  const minNotionalPerSlot = bucketCapital > 0 ? Math.floor((bucketCapital / targetSlots) * 0.95) : 0;

  return [
    `# ALLOKER — KVALITET OVER KVANTITET`,
    ``,
    eveningMode
      ? `### ★★★ EVENING REBALANCE — ${blueprint.params.maxPositions}-SLOT OVERNIGHT PORTFOLIO\nDette er den daglige 15:40–15:55 ET-rebalansen. Ikke et normalt tick.\nDu velger porteføljen vi går inn i morgendagen MED.\n\nFor hver held position:\n- HOLD: strong-trend leader, robust mot -5 % overnight gap.\n- SELL: mistet momentum / negative news / RS faller.\n\nFyll ledige slot med priority-core (MU/QBTS/IONQ/QUBT/RKLB/VRT) som ser sterkest ut for morgendagen — basert på Asia overnight-futures, breaking news, sektor-rotasjon, og catalysts (earnings, FDA, makro).\n\nIKKE åpne aggressive dip-buys i evening-mode — vi vil ha posisjoner som kan overleve natten, ikke kortsiktig swing-handel før close.`
      : '',
    `Mål: stretch mot full deployment av bøtte-kapital — men ALDRI bryt blueprint-disiplinen.`,
    `ALLTID-INVESTERT MANDAT: bucket SKAL ha minst 1 åpen posisjon i en rising-channel-ticker under markedstid. 0 % deployment er IKKE akseptabelt utenom strukturell bear (SPY < SMA200) eller kill-switch.`,
    ``,
    `Kjør prosedyren fra system-prompten din for porteføljevalg, og bruk Live Search aktivt for:`,
    `- Trump-poster på X / Truth Social (relevante for sektorer i watchlisten)`,
    `- Oljepris og geopolitiske nyheter (Hormuz, OPEC, Midtøsten)`,
    `- Top 13F-flytninger og earnings-sentiment for tickerne`,
    `- Markedsregime-signaler (S&P, NASDAQ, VIX, krypto-momentum)`,
    ``,
    `## Disiplinregler (HARDE — bryt aldri)`,
    `- ALDRI BUY på ticker med RSI > ${blueprint.params.rsiOverbought} (overkjøpt — vil reversere).`,
    `- ALDRI BUY ved klar negativ katalysator (Trump-tariff på sektoren, dårlig earnings, geopol-eskalering mot tickeren).`,
    ``,
    `## Antall picks å returnere`,
    `- ${blueprint.params.maxPositions} picks: når ${blueprint.params.maxPositions}+ tickere møter PATH C/D/E/B-kriteriene.`,
    `- 1–${blueprint.params.maxPositions - 1} picks: når kun noen møter standarden — fyll med beste rising-channel-leader for å unngå 0% deployment.`,
    `- 0 picks: KUN i bear-regime (SPY < SMA200) eller kill-switch. Ellers: se ALLTID-INVESTERT-mandatet i system-prompten — engine har en fallback som tvinger en BUY hvis du returnerer 0, så velg heller selv.`,
    ``,
    `Engine sizer hver pick automatisk som bøtte-kapital / ${blueprint.params.maxPositions} (consistent sizing).`,
    `notional_usd-feltet ignoreres — bare gi placeholder.`,
    ``,
    `Hvis bøtta allerede har posisjoner og ny ticker har > 10 poeng høyere asymmetric score enn laveste hold,`,
    `selg laveste og kjøp nye (REALLOKERING-regel).`,
    ``,
    `# Live trading-kontekst`,
    ``,
    `Asset class: ${blueprint.id}`,
    `Tidsstempel: ${new Date().toISOString()}`,
    `Bruker-allokering: ${allocationPct} % av total equity til denne bøtta`,
    `Total equity (USD): ${round(totalEquity, 2)}`,
    `Bøtte-kapital (USD): ${round(bucketCapital, 2)}`,
    `Buying power (USD): ${round(buyingPower, 2)}`,
    `Maks samtidige posisjoner i denne bøtta: ${blueprint.params.maxPositions}`,
    `Status: ${isBucketEmpty ? 'BØTTA ER TOM — MÅ DEPLOYE FULL KAPITAL NÅ' : `${positions.length} posisjon(er) holdes`}`,
    ``,
    `## Brukerens Alpaca-konto`,
    JSON.stringify(account, null, 2),
    ``,
    `## Markedstid (NYSE)`,
    marketClock
      ? JSON.stringify(marketClock, null, 2)
      : '(ukjent)',
    `Aksjer/ETF-er handles kun når NYSE er åpen.`,
    ``,
    `## Eksisterende aksje-posisjoner`,
    positions.length === 0 ? '(ingen)' : JSON.stringify(positions, null, 2),
    ``,
    `## Tickere med åpne (uutløste) ordre — IKKE legg inn nye ordre på disse`,
    inFlightTickers.length === 0 ? '(ingen)' : inFlightTickers.join(', '),
    ``,
    `## Siste aksje-ordre (filtered til watchlist)`,
    (() => {
      const watchSet = new Set<string>(blueprint.watchlist);
      const bucketOrders = recentOrders.filter((o) => {
        const sym = o.ticker;
        if (watchSet.has(sym)) return true;
        // Match Alpaca's no-slash crypto form even though we filter against
        // a stocks watchlist — defensive in case Grok needs to see history.
        const slashed = !sym.includes('/') && /^[A-Z]+USD$/.test(sym) && sym.length >= 6
          ? `${sym.slice(0, -3)}/USD`
          : sym;
        return watchSet.has(slashed);
      });
      return bucketOrders.length === 0 ? '(ingen)' : JSON.stringify(bucketOrders, null, 2);
    })(),
    ``,
    `## Top-${candidates.length} watchlist-kandidater (rangert av engine)`,
    `Engine har pre-filtrert til de mest relevante tickerne. Eksisterende posisjoner er alltid inkludert.`,
    `Disse er ranket etter: filter-eligibility + relative_strength_30d + rising-channel-bonus.`,
    `(Watchlisten har totalt ${blueprint.watchlist.length} tickere — de uten relevant signal er utelatt for å spare tokens.)`,
    JSON.stringify(candidates, null, 2),
    ``,
    `# Oppgave`,
    ``,
    `Følg blueprint-strategien fra system-prompten der den IKKE konflikter med kapital-deploy-mandatet.`,
    `Hvis bøtta er tom: rangér watchlisten etter beste tilgjengelige kombinasjon av momentum, regime-fit,`,
    `og blueprint-prioritering, og lever ${targetSlots} BUY-decisions som tilsammen bruker hele bøtte-kapitalen.`,
    `Hvis bøtta er delvis full: fyll resterende slots OG vurder om eksisterende posisjoner bør holdes/selges.`,
    ``,
    `Returner et JSON-objekt med formatet:`,
    `{`,
    `  "thesis": "kort sammendrag av valgene dine og hvorfor (maks 400 tegn)",`,
    `  "decisions": [`,
    `    { "ticker": "<symbol fra watchlisten>", "action": "BUY"|"SELL"|"HOLD", "notional_usd": 0, "reason": "kort begrunnelse (maks 200 tegn)" }`,
    `  ]`,
    `}`,
    ``,
    `Regler for output (HARDE KRAV):`,
    `- Kun watchlist-tickere er tillatt.`,
    `- Hvis bøtta er tom (ingen posisjoner): returner NØYAKTIG ${blueprint.params.maxPositions} BUY-decisions.`,
    `- Hvis bøtta har N posisjoner og N < ${blueprint.params.maxPositions}: returner ${blueprint.params.maxPositions} − N nye BUYs OG vurder om hver eksisterende posisjon bør HOLD eller SELL.`,
    `- Hvis bøtta er full (${blueprint.params.maxPositions} posisjoner): returner kun HOLD/SELL-decisions for eksisterende posisjoner.`,
    `- TOP-UP-REGEL: hvis en eksisterende posisjon er < 20 % av bøtte-kapital og fortsatt møter PATH A/B-kriteriene, returner BUY på ticker-en for å øke posisjonen mot target-størrelse (engine vil kalkulere riktig top-up-mengde gjennom konsentrasjons-cap-en).`,
    `- notional_usd: sett bare en placeholder (f.eks. 0 eller bucket_capital/maxPositions). Engine overstyrer den uansett.`,
    `- IGNORER blueprint-tekstens "1.5 % risk per trade"-regler — engine sizer ordrene.`,
    `- HOLD = posisjonen beholdes.`,
    `- SELL = lukk hele posisjonen.`,
    `- Ikke putt SELL på tickere som ikke er i posisjons-listen.`,
    `- Ikke putt BUY på tickere som er i in-flight-listen.`,
    `- Returner KUN gyldig JSON, ingen ekstra tekst.`,
  ].join('\n');
}

async function callGrokForBlueprint(
  blueprint: Blueprint,
  userPrompt: string,
): Promise<GrokDecisionPayload | null> {
  const r = await decide({
    systemPrompt: blueprint.strategy,
    userPrompt,
  });
  if (!r.success) {
    return null;
  }
  return r.payload;
}

interface ExecuteArgs {
  creds: AlpacaCreds;
  blueprint: Blueprint;
  bucketCapital: number;
  /** Account-wide cap. perPickNotional × num_buys cannot exceed this. */
  remainingBuyingPower: number;
  /** Whether NYSE regular hours are active. False during pre/after-market. */
  marketIsOpen: boolean;
  /** Indicator snapshots used to gate Grok BUYs through the anticipatory
   *  filter. If a ticker isn't in the snapshot map (e.g. failed to fetch
   *  bars) the BUY is rejected for safety. */
  snapshots: Map<string, IndicatorSnapshot>;
  payload: GrokDecisionPayload;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
  /** SPY < SMA200 → halve all position sizes (macro bear-filter). */
  isBearRegime: boolean;
  /** Tickers stopped out via mechanical stop in the last 5 days. BUYs on
   *  these are rejected (whipsaw protection). Stocks-bucket only. */
  cooldownTickers: Set<string>;
  /** Friday after 14:30 ET — block new equity BUYs to avoid weekend gap risk. */
  fridayBlackout: boolean;
  /** Open-order records (mutable). After a SELL succeeds we cancel any
   *  matching server-side stop and remove it from this list so subsequent
   *  in-scan logic sees current state. */
  openOrdersData: AlpacaOrder[];
}

interface ExecuteResult {
  trades: TradeResult[];
  /** Total successful BUY notional + SELL notional credit (negative). */
  netDeployed: number;
}

async function executeDecisions(args: ExecuteArgs): Promise<ExecuteResult> {
  const {
    creds,
    blueprint,
    bucketCapital,
    remainingBuyingPower,
    marketIsOpen,
    snapshots,
    payload,
    positionsByTicker,
    inFlightTickers,
    isBearRegime,
    cooldownTickers,
    fridayBlackout,
    openOrdersData,
  } = args;
  const isCrypto = blueprint.id === 'crypto';
  const watchlistSet = new Set<string>(blueprint.watchlist);
  const trades: TradeResult[] = [];
  let netDeployed = 0;
  // Bear regime → halve allocation per position. Halve, don't zero, so we
  // still capture sharp dip-bounces but with reduced exposure if SPY rolls.
  const bearMultiplier = isBearRegime ? 0.5 : 1.0;
  const maxNotionalPerTicker =
    bucketCapital * (blueprint.params.maxPctPerPosition / 100) * bearMultiplier;

  // Sector concentration: per-sector cap. tech_ai gets 4 slots because user
  // mandate is explicit AI/semis bias (priority-core leans tech/quantum) —
  // capping at 2 forces the engine to reject thesis-recommended tech leaders
  // even when the strategy text wants concentration there. Other sectors
  // stay at 2 (default).
  //
  // Earlier values: 1 → 2 → 2/4 (split, 2026-05-21).
  // Priority-core tickers (MU/QBTS/IONQ/QUBT/RKLB/VRT) bypass the cap entirely
  // (see corePass below), so this cap binds only on non-priority-core picks
  // — typically secondary tech names like TSM/PANW/AVGO.
  const SECTOR_CAP_DEFAULT = 2;
  const SECTOR_CAP_OVERRIDES: Record<string, number> = { tech_ai: 4 };
  const sectorCapFor = (sec: string | null): number =>
    sec ? SECTOR_CAP_OVERRIDES[sec] ?? SECTOR_CAP_DEFAULT : SECTOR_CAP_DEFAULT;
  const sectorCounts = new Map<string, number>();
  const sellTickerEarly = new Set(
    payload.decisions.filter((d) => d.action === 'SELL').map((d) => d.ticker),
  );
  for (const [ticker] of positionsByTicker) {
    if (sellTickerEarly.has(ticker)) continue;
    const sec = sectorOf(ticker);
    if (sec) sectorCounts.set(sec, (sectorCounts.get(sec) ?? 0) + 1);
  }

  // Two-phase execution: SELLs first to free buying power, then BUYs.
  // Without this, a BUY queued right after a SELL hits Alpaca before the
  // freed cash is released → "insufficient buying power" rejection.
  const sellDecs: typeof payload.decisions = [];
  const buyDecs: typeof payload.decisions = [];
  for (const dec of payload.decisions) {
    const ticker = dec.ticker;
    if (!watchlistSet.has(ticker)) {
      trades.push(skipTrade(blueprint.id, ticker, dec.action, 'not_in_watchlist'));
      continue;
    }
    if (inFlightTickers.has(ticker)) {
      trades.push(skipTrade(blueprint.id, ticker, dec.action, 'in_flight'));
      continue;
    }
    if (dec.action === 'HOLD') continue;
    if (dec.action === 'SELL') sellDecs.push(dec);
    else if (dec.action === 'BUY') buyDecs.push(dec);
  }

  // ── Upgrade-rotation detection (feeds the SELL-veto exception below) ───
  // Highest relative-strength among NEW (not-yet-held) BUY candidates that
  // pass the anticipatory filter. Used to let Grok rotate a weak name out
  // of a FULL bucket for a clearly stronger pick without the SELL-veto
  // freezing the swap. Skipped when BUYs can't execute this scan (Friday
  // blackout) — a rotation only makes sense if the replacement can be bought.
  const bucketIsFull = positionsByTicker.size >= blueprint.params.maxPositions;
  let bestIncomingBuyRs: number | null = null;
  if (!(fridayBlackout && !isCrypto)) {
    for (const dec of buyDecs) {
      if (positionsByTicker.has(dec.ticker)) continue; // top-up, not a new slot
      if (cooldownTickers.has(dec.ticker)) continue;   // won't execute (cool-down)
      const snap = snapshots.get(dec.ticker);
      if (!snap || !isAnticipatorySignal(snap).ok) continue;
      const rs = snap.relative_strength_30d;
      if (rs == null) continue;
      if (bestIncomingBuyRs == null || rs > bestIncomingBuyRs) bestIncomingBuyRs = rs;
    }
  }
  // An incoming pick must out-rank the name it replaces by at least this
  // many RS percentage-points to justify overriding the veto — mirrors the
  // strategy's ">10 score-point" rotation rule. Wide enough that only a
  // genuine leader-vs-laggard swap qualifies, never marginal churn.
  const UPGRADE_ROTATION_RS_MARGIN = 10;
  // Earned-momentum-tier: a held position that has proven itself — a genuine
  // winner that still leads and holds its trend — is protected from the
  // upgrade-rotation ("ride the winner, don't churn it out"). It does NOT
  // get priority-core's PATH E dip-buying or sector-cap bypass — only this
  // churn protection. Thresholds tunable.
  const EARNED_TIER_MIN_PNL = 0.08; // +8 % unrealised — a real winner
  const EARNED_TIER_MIN_RS = 5;     // +5 pp relative strength — still a leader

  // ── Grok-SELL sanity check ────────────────────────────────────────────
  // Grok's SELL recommendations previously bypassed the engine entirely
  // (only BUYs went through the anticipatory filter). That's correct when
  // Grok has real information the engine can't see — news, sentiment —
  // but creates one-shot exposure to LLM hallucination ("RKLB momentum
  // failing" when it's actually +13 % on the day).
  //
  // Veto rule: require at least ONE piece of mechanical evidence that the
  // position is deteriorating before executing Grok's SELL. Evidence is
  // any of:
  //   - relative_strength_30d < 0 (underperforming benchmark)
  //   - price < SMA50 (short-term trend broken)
  //   - intraday change_24h_pct ≤ -3 % (loss building today)
  //   - position pnl ≤ -5 % (already underwater)
  //   - RSI > 80 (blow-off top — exit before reversal is sensible)
  // Missing snapshot → bypass veto (fail-open: we'd rather honor Grok's
  // call when we lack data than freeze the position).
  //
  // Mechanical safety still runs every minute regardless of this veto, so
  // the ATR-stop / trailing-stop / fast-deterioration paths catch genuine
  // breakdowns that Grok also flagged. Vetoed SELL ⇒ position held until
  // next Grok tick or mechanical trigger.
  //
  // Upgrade-rotation exception: a no-evidence SELL is still allowed when it
  // frees a slot in a FULL bucket for a clearly stronger incoming pick (see
  // `isUpgradeRotation` below). The veto exists to block panic-dumps of
  // healthy positions — not to freeze the bucket against a real upgrade.
  // Priority-core names are never sold via this exception.
  const sellEvidenceMissing: typeof payload.decisions = [];
  const sellDecsAfterVeto: typeof payload.decisions = [];
  for (const dec of sellDecs) {
    const snap = snapshots.get(dec.ticker);
    if (!snap) {
      sellDecsAfterVeto.push(dec); // no data → defer to Grok
      continue;
    }
    const held = positionsByTicker.get(dec.ticker);
    const entry = held ? parseFloat(held.avg_entry_price) || 0 : 0;
    const pnlPct = entry > 0 ? (snap.price - entry) / entry : 0;
    const rsFalling =
      snap.relative_strength_30d != null && snap.relative_strength_30d < 0;
    const belowSma50 =
      snap.sma_50 != null && snap.sma_50 > 0 && snap.price < snap.sma_50;
    const intradayLoss =
      snap.change_24h_pct != null && snap.change_24h_pct <= -3;
    const underwater = pnlPct <= -0.05;
    const blowoffTop = snap.rsi_14 != null && snap.rsi_14 > 80;
    const hasEvidence =
      rsFalling || belowSma50 || intradayLoss || underwater || blowoffTop;
    // Earned-momentum-tier: a held winner (P&L ≥ +8 %) that still leads
    // (RS ≥ +5 pp) and holds its short-term trend (price > SMA50). These
    // get "ride the winner" protection — the upgrade-rotation may NOT sell
    // them to free a slot. A genuine breakdown still exits them via the
    // mechanical stops / an evidence-backed Grok SELL.
    const isEarnedMomentumTier =
      held != null &&
      pnlPct >= EARNED_TIER_MIN_PNL &&
      snap.relative_strength_30d != null &&
      snap.relative_strength_30d >= EARNED_TIER_MIN_RS &&
      snap.sma_50 != null &&
      snap.sma_50 > 0 &&
      snap.price > snap.sma_50;
    // Upgrade-rotation exception: a healthy name may be sold without
    // deterioration evidence ONLY to free a slot in a full bucket for a
    // clearly stronger incoming pick. Priority-core and earned-momentum-tier
    // winners are never sold this way — only genuinely weak/middling names.
    const sellRs = snap.relative_strength_30d ?? 0;
    const isUpgradeRotation =
      !isPriorityCore(dec.ticker) &&
      !isEarnedMomentumTier &&
      bucketIsFull &&
      bestIncomingBuyRs != null &&
      bestIncomingBuyRs >= sellRs + UPGRADE_ROTATION_RS_MARGIN;
    if (hasEvidence || isUpgradeRotation) {
      sellDecsAfterVeto.push(dec);
    } else {
      sellEvidenceMissing.push(dec);
    }
  }
  for (const dec of sellEvidenceMissing) {
    trades.push(
      skipTrade(
        blueprint.id,
        dec.ticker,
        'SELL',
        'GROK_SELL_VETOED (no_deterioration_evidence)',
      ),
    );
  }
  // Replace sellDecs with the post-veto list for the rest of the function.
  sellDecs.length = 0;
  sellDecs.push(...sellDecsAfterVeto);

  // ── FULL-DEPLOYMENT OVERRIDE ─────────────────────────────────────────
  // Ignore the per-pick notional Grok suggested. Engine sizes every BUY
  // so that the bucket reaches 100 % deployment after this scan.
  //
  // free_capital = bucket_capital − value of positions we're keeping
  // per_pick_target = free_capital / num_buys, capped at max-per-position
  const sellTickerSet = new Set(sellDecs.map((d) => d.ticker));
  let keptPositionValue = 0;
  for (const [ticker, pos] of positionsByTicker) {
    if (sellTickerSet.has(ticker)) continue; // closing this — capital frees up
    keptPositionValue += parseFloat(pos.market_value) || 0;
  }
  const freeBucketCapital = Math.max(0, bucketCapital - keptPositionValue);

  // Hard cap per-pick × N at the account-wide remaining buying power.
  // Without this, even a correctly-sized bucket can exceed Alpaca's
  // non-marginable buying power for fractional notional orders.
  const safeRemainingBP = Math.max(0, remainingBuyingPower) * 0.95;

  // ── Pre-flight filter pass ───────────────────────────────────────────
  // Engine used to size each BUY at freeBucketCapital / buyDecs.length.
  // Problem: if Grok proposes 3 BUYs but the anticipatory filter rejects
  // 2, the surviving pick still gets only 1/3 of free capital — 2/3 sits
  // in cash forever (until next scan). Run a pre-flight to count BUYs
  // that will ACTUALLY pass all filters, and size based on that count.
  // Logic mirrors the main BUY-loop's filter checks; if they diverge in
  // the future we'll over- or under-size, so keep them in sync.
  let preApproved = 0;
  const preflightSectorCounts = new Map(sectorCounts);
  for (const dec of buyDecs) {
    if (fridayBlackout && !isCrypto) continue;
    if (cooldownTickers.has(dec.ticker)) continue;
    const snap = snapshots.get(dec.ticker);
    if (!snap) continue;
    const sig = isAnticipatorySignal(snap);
    if (!sig.ok) continue;
    // Priority-core leaders bypass the sector cap entirely (user's 12-
    // month portfolio is meant to concentrate in AI/quantum core, not
    // diversify away from it). maxPositions and per-ticker concentration
    // caps still bind.
    const sec = sectorOf(dec.ticker);
    const corePass = isPriorityCore(dec.ticker);
    if (
      !corePass &&
      sec &&
      (preflightSectorCounts.get(sec) ?? 0) >= sectorCapFor(sec)
    ) continue;
    // Per-ticker concentration cap: a held position already at the cap
    // will be rejected by the main loop with `concentration_cap_reached`.
    // Skipping it here too keeps `preApproved` aligned with reality, so
    // perPickNotional sizes the deployment correctly and we don't leave
    // free capital sitting in cash because the divisor was inflated.
    const existing = positionsByTicker.get(dec.ticker);
    const existingValue = existing ? parseFloat(existing.market_value) || 0 : 0;
    if (Math.max(0, maxNotionalPerTicker - existingValue) < MIN_NOTIONAL_USD) {
      continue;
    }
    preApproved += 1;
    if (sec) preflightSectorCounts.set(sec, (preflightSectorCounts.get(sec) ?? 0) + 1);
  }

  let perPickNotional = 0;
  if (preApproved > 0 && freeBucketCapital >= MIN_NOTIONAL_USD) {
    perPickNotional = Math.min(
      freeBucketCapital / preApproved,
      maxNotionalPerTicker,
      safeRemainingBP / preApproved,
      MAX_PER_ORDER_NOTIONAL,
    );
  }

  // ── Phase 1: SELLs (parallel) ────────────────────────────────────────
  const sellResults = await Promise.all(
    sellDecs.map(async (dec) => {
      const ticker = dec.ticker;
      const held = positionsByTicker.get(ticker);
      if (!held) return skipTrade(blueprint.id, ticker, 'SELL', 'no_position');
      const qty = parseFloat(held.qty) || 0;
      if (qty <= 0) return skipTrade(blueprint.id, ticker, 'SELL', 'zero_qty');
      let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
      if (isCrypto) {
        orderReq = {
          symbol: tradingSymbol(ticker),
          qty,
          side: 'sell',
          type: 'market',
          time_in_force: 'gtc',
          position_intent: 'sell_to_close',
        };
      } else {
        // Fractional positions can't be sold via extended-hours limit
        // orders (Alpaca rejects whole-share-only requirement when the
        // remainder doesn't cleanly close the position). Skip the SELL
        // until market opens — the next tick at/after 09:30 ET will
        // submit a regular market order that properly closes any
        // fractional position.
        const isFractional = qty !== Math.floor(qty);
        if (!marketIsOpen && isFractional) {
          return skipTrade(
            blueprint.id,
            ticker,
            'SELL',
            'extended_hours_fractional_skip',
          );
        }
        const priceRes = await getLatestPrice(creds, tradingSymbol(ticker));
        // Two-step fallback: live price → Alpaca-position's stored
        // current_price. The position object always has a recent price
        // even when IEX pre-market fetch fails.
        const livePrice =
          priceRes.success && priceRes.data > 0 ? priceRes.data : 0;
        const positionPrice = parseFloat(held.current_price) || 0;
        const currentPrice = livePrice > 0 ? livePrice : positionPrice;
        orderReq = buildStockOrder({
          symbol: tradingSymbol(ticker),
          side: 'sell',
          qty,
          currentPrice,
          marketIsOpen,
        });
      }
      if (!orderReq) {
        return skipTrade(blueprint.id, ticker, 'SELL', 'no_price_for_extended_hours');
      }
      const r = await placeOrder(creds, orderReq);
      // Cancel any server-side stop order tied to this ticker. Without
      // this, after the SELL fills the orphan stop would either fail
      // (no position to close) or — worse, in a partial-fill scenario —
      // sell shares we still want to hold.
      if (r.success) {
        await cancelOpenStopsForTicker(creds, ticker, openOrdersData);
      }
      return {
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL' as const,
        qty,
        notional: 0,
        status: r.success ? ('OK' as TradeStatus) : ('ERR' as TradeStatus),
        reason: dec.reason || 'GROK_SELL',
        error: r.success ? undefined : r.error,
      };
    }),
  );
  trades.push(...sellResults);

  // Wait for SELLs to settle and free buying power, but ONLY if at least one
  // SELL was accepted by Alpaca. Failed SELLs leave positions open and BP
  // locked — waiting in that case is wasted time, AND the BUYs that follow
  // will fail anyway since BP wasn't actually freed.
  // 2.5s is empirical: Alpaca paper releases cash from market sells in ~1s,
  // but we add slack so the BUY phase doesn't see stale BP snapshots.
  const anySellAccepted = sellResults.some((r) => r.status === 'OK');
  if (anySellAccepted && buyDecs.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  // ── Phase 1.5: Autonomous top-up of undersized positions ─────────────
  // If a kept position is below 75 % of its target size (= bucket /
  // maxPositions), engine automatically tops it up — regardless of whether
  // Grok proposed BUY on it. Grok often HOLDs positions that are technically
  // undersized because PATH C demands strict signals (RSI 55-72 etc.) that
  // a recently-bought ticker may have outgrown. This bridges the gap so
  // bucket reaches target deployment within 1-2 ticks.
  //
  // Safety: top-up only fires when ticker still passes anticipatory filter
  // (no buying broken stocks) AND not in cool-down AND not blacklisted.
  // Top-up target = max-per-position cap × 0.95 (instead of equal-split
  // 1/maxPositions). On a $1M bucket with maxPctPerPosition=50, target is
  // 47.5 % per pick. With maxPositions=6, this means top-up will push the
  // first un-undersized position toward 47.5 %, then walk down the list
  // sizing each subsequent position from the remaining freeBucketCapital.
  // Net result: top pick at ~30-45 %, lower picks at ~10-15 % each — a
  // natural concentration-weighted distribution.
  const TARGET_PCT_PER_POSITION = (blueprint.params.maxPctPerPosition / 100) * 0.95;
  const targetPositionValue = bucketCapital * TARGET_PCT_PER_POSITION;
  const TOP_UP_THRESHOLD = 0.75; // top up if below 75 % of target
  const sellTickerSetForTopup = new Set(sellDecs.map((d) => d.ticker));
  const buyTickerSetForTopup = new Set(buyDecs.map((d) => d.ticker));
  for (const [ticker, pos] of positionsByTicker) {
    if (sellTickerSetForTopup.has(ticker)) continue; // closing this — skip
    if (buyTickerSetForTopup.has(ticker)) continue; // Grok already BUY — main loop handles
    if (inFlightTickers.has(ticker)) continue;
    if (cooldownTickers.has(ticker)) continue;
    if (fridayBlackout && !isCrypto) continue;
    const existingValue = parseFloat(pos.market_value) || 0;
    if (existingValue >= targetPositionValue * TOP_UP_THRESHOLD) continue;
    const snap = snapshots.get(ticker);
    if (!snap) continue;
    const sig = isAnticipatorySignal(snap);
    if (!sig.ok) continue; // never top up unhealthy positions

    const topUpAmount = Math.min(
      targetPositionValue - existingValue,
      maxNotionalPerTicker - existingValue,
      Math.max(0, remainingBuyingPower) * 0.95 - netDeployed,
    );
    const topUpRound = round(topUpAmount, 2);
    if (topUpRound < MIN_NOTIONAL_USD) continue;

    let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
    if (isCrypto) {
      orderReq = {
        symbol: tradingSymbol(ticker),
        notional: topUpRound,
        side: 'buy',
        type: 'market',
        time_in_force: 'gtc',
        position_intent: 'buy_to_open',
      };
    } else {
      const priceRes = await getLatestPrice(creds, tradingSymbol(ticker));
      const currentPrice =
        priceRes.success && priceRes.data > 0 ? priceRes.data : snap.price;
      orderReq = buildStockOrder({
        symbol: tradingSymbol(ticker),
        side: 'buy',
        notional: topUpRound,
        currentPrice,
        marketIsOpen,
      });
    }
    if (!orderReq) continue;
    const r = await placeOrder(creds, orderReq);
    trades.push({
      blueprintId: blueprint.id,
      ticker,
      action: 'BUY',
      qty: 0,
      notional: topUpRound,
      status: r.success ? 'OK' : 'ERR',
      reason: 'AUTONOMOUS_TOPUP',
      error: r.success ? undefined : r.error,
    });
    if (r.success) netDeployed += topUpRound;
  }

  // ── Phase 2: BUYs (sequential, all at engine-forced size) ────────────
  // Engine ignores Grok's notional. Each BUY uses perPickNotional, but is
  // additionally capped per-ticker so cumulative position size never exceeds
  // maxPctPerPosition × bucket capital. This prevents the "ADA at 34 %" bug
  // where Grok recommends BUY on the same ticker across consecutive scans
  // and engine kept stacking on top of an already-full position.
  // (The previous early-exit "no_free_capital" loop was removed: it tagged
  // every BUY as no_free_capital even when the real reason was filter-fail.
  // Now each pick gets its precise rejection reason in the main loop below.)
  for (const dec of buyDecs) {
    const ticker = dec.ticker;

    // ── Friday-afternoon blackout ────────────────────────────────────────
    // No new equity BUYs after 14:30 ET on Friday — eliminates exposure to
    // weekend gap risk on freshly-opened positions. Existing positions are
    // not affected (intentional — they've already absorbed entry slippage).
    if (fridayBlackout && !isCrypto) {
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', 'friday_blackout'));
      continue;
    }

    // ── Cool-down filter (whipsaw protection) ────────────────────────────
    // If this ticker stopped out via mechanical safety in the last 5 days,
    // skip. Re-entering a stopped name on the same week is the classic
    // bleed pattern (buy-stop-buy-stop on identical chart shape).
    if (cooldownTickers.has(ticker)) {
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', 'cooldown_recent_stopout'));
      continue;
    }

    // ── Anticipatory signal filter ───────────────────────────────────────
    // Hard reject any Grok BUY where the indicator state doesn't match the
    // dip-buy thesis (uptrend + oversold/near-support + bullish confirmation).
    // This is what stops the engine from buying momentum tops just because
    // Grok ranked them by 5-day return.
    //
    // Filter is run BEFORE the sector-cap check so we can read
    // `priority_core_dip_signal` and exempt PATH E from the cap.
    const snap = snapshots.get(ticker);
    if (!snap) {
      trades.push(
        skipTrade(blueprint.id, ticker, 'BUY', 'no_snapshot_for_filter'),
      );
      continue;
    }
    const signal = isAnticipatorySignal(snap);
    if (!signal.ok) {
      trades.push(
        skipTrade(
          blueprint.id,
          ticker,
          'BUY',
          `no_anticipatory: ${signal.reasons.join(',')}`,
        ),
      );
      continue;
    }

    // ── Sector concentration cap ─────────────────────────────────────────
    // Max 2 positions per sector per scan, applied across kept positions +
    // BUYs queued in this loop. Prevents "3 picks all in semis" on a bad
    // sector day. Unknown-sector tickers don't trigger or take a slot.
    //
    // Priority-core exemption: user-curated 12-month portfolio leaders
    // bypass the cap. Concentration in AI/quantum core is the explicit
    // point of priority-core. maxPositions + per-ticker cap still bind.
    const sec = sectorOf(ticker);
    const corePass = isPriorityCore(ticker);
    if (
      !corePass &&
      sec &&
      (sectorCounts.get(sec) ?? 0) >= sectorCapFor(sec)
    ) {
      trades.push(
        skipTrade(blueprint.id, ticker, 'BUY', `sector_full_${sec}`),
      );
      continue;
    }

    // Per-ticker concentration cap: don't let cumulative position exceed
    // maxPctPerPosition. Existing position value counts toward the cap.
    const existing = positionsByTicker.get(ticker);
    const existingValue = existing ? parseFloat(existing.market_value) || 0 : 0;
    const remainingTickerCap = Math.max(0, maxNotionalPerTicker - existingValue);

    // ── Volatility-targeted sizing ───────────────────────────────────────
    // Scale this pick's notional so its EXPECTED daily-PnL contribution is
    // roughly constant across all picks (≈ 1 % of bucket). High-vol stocks
    // get smaller size, low-vol stocks get bigger size, equal "heat" across
    // the bucket. Reference vol is 2 % daily (≈ S&P-typical) — a stock with
    // 4 % daily vol gets multiplier 0.5; a stock with 1 % daily vol gets 2.0.
    // Bounds [0.5, 1.5] prevent extreme sizes from one bar of bad data.
    const TARGET_DAILY_VOL = 0.02;
    let volMultiplier = 1.0;
    if (snap.realized_vol_20d != null && snap.realized_vol_20d > 0) {
      const raw = TARGET_DAILY_VOL / snap.realized_vol_20d;
      // Tighter bounds [0.75, 1.25] (was 0.5-1.5). Less aggressive shrinking
      // means high-vol stocks like MU/SMCI still get a meaningful position
      // size — the previous floor of 0.5 was cutting deployment in half on
      // any vol > 4 % which dominated total bucket utilization.
      volMultiplier = Math.max(0.75, Math.min(1.25, raw));
    }

    // ── News-density adjust ──────────────────────────────────────────────
    // High news count = ticker in spotlight, vol elevated, gap risk high.
    // Halve size when news_count_24h > 10 (empirically catches earnings
    // leaks, M&A rumors, regulatory news days). Doesn't reject — just
    // reduces exposure. 0 news_count (no API key set) is treated as
    // "normal", no adjustment.
    const newsHot = snap.news_count_24h > 10;
    const newsMultiplier = newsHot ? 0.5 : 1.0;

    const cappedByTicker = Math.min(
      perPickNotional * volMultiplier * newsMultiplier,
      remainingTickerCap,
    );
    const notional = round(cappedByTicker, 2);
    if (notional < MIN_NOTIONAL_USD) {
      let reason: string;
      if (remainingTickerCap < MIN_NOTIONAL_USD) {
        reason = 'concentration_cap_reached';
      } else if (perPickNotional < MIN_NOTIONAL_USD) {
        reason = 'no_free_capital';
      } else {
        reason = 'below_min_notional';
      }
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', reason));
      continue;
    }
    let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
    if (isCrypto) {
      orderReq = {
        symbol: tradingSymbol(ticker),
        notional,
        side: 'buy',
        type: 'market',
        time_in_force: 'gtc',
        position_intent: 'buy_to_open',
      };
    } else {
      // Stocks/commodities: try fresh price first (best for limit-pricing).
      // Pre-market on Alpaca's free-tier IEX feed is flaky — getLatestPrice
      // commonly fails for less-liquid names at 04:00–09:30 ET. Fall back to
      // snap.price (live or last close from indicator-snapshot pipeline) so
      // we don't lose the entire pre-market window over a thin orderbook.
      const priceRes = await getLatestPrice(creds, tradingSymbol(ticker));
      const currentPrice =
        priceRes.success && priceRes.data > 0 ? priceRes.data : snap.price;
      orderReq = buildStockOrder({
        symbol: tradingSymbol(ticker),
        side: 'buy',
        notional,
        currentPrice,
        marketIsOpen,
      });
    }
    if (!orderReq) {
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', 'no_price_for_extended_hours'));
      continue;
    }
    const r = await placeOrder(creds, orderReq);
    trades.push({
      blueprintId: blueprint.id,
      ticker,
      action: 'BUY',
      qty: 0,
      notional,
      status: r.success ? 'OK' : 'ERR',
      reason: dec.reason || 'GROK_BUY',
      error: r.success ? undefined : r.error,
    });
    if (r.success) {
      netDeployed += notional;
      // Increment sector count so subsequent BUYs in the same scan respect
      // the per-sector cap (currently 2).
      if (sec) sectorCounts.set(sec, (sectorCounts.get(sec) ?? 0) + 1);
    }
  }

  // ── Phase 3: ALWAYS-INVESTED FALLBACK ──────────────────────────────────
  // User mandate: bucket should always hold at least 1 position in a
  // rising-channel leader during market hours. If this scan ends with 0
  // positions AND 0 net deployment AND we're in a tradeable regime (market
  // open, not bear, not friday-blackout), force a single BUY on the best
  // available rising-channel candidate. Defensive cash is reserved for
  // structural bear; sitting at 100 % cash in a bull/ranging market is a
  // bug, not a feature.
  const sellTickersThisScan = new Set(
    trades.filter((t) => t.action === 'SELL' && t.status === 'OK').map((t) => t.ticker),
  );
  const buyTickersThisScan = new Set(
    trades.filter((t) => t.action === 'BUY' && t.status === 'OK').map((t) => t.ticker),
  );
  const attemptedThisScan = new Set(trades.map((t) => t.ticker));
  const heldAfterScan = new Set<string>();
  for (const tk of positionsByTicker.keys()) heldAfterScan.add(tk);
  for (const tk of sellTickersThisScan) heldAfterScan.delete(tk);
  for (const tk of buyTickersThisScan) heldAfterScan.add(tk);

  const fallbackEligible =
    !isCrypto &&
    heldAfterScan.size === 0 &&
    marketIsOpen &&
    !isBearRegime &&
    !fridayBlackout &&
    bucketCapital >= 1000;
  if (fallbackEligible) {
    let best: IndicatorSnapshot | null = null;
    let bestScore = -Infinity;
    for (const snap of snapshots.values()) {
      if (attemptedThisScan.has(snap.ticker)) continue;
      if (cooldownTickers.has(snap.ticker)) continue;
      if (inFlightTickers.has(snap.ticker)) continue;
      if (!snap.rising_channel) continue;
      if (snap.sma_200 == null || snap.price < snap.sma_200) continue;
      if (snap.sma_50 == null || snap.price < snap.sma_50) continue;
      if (snap.relative_strength_30d == null || snap.relative_strength_30d < 0) continue;
      if (snap.rsi_14 == null || snap.rsi_14 > 72) continue;
      // Avoid blow-off-top entries (just ran 20 %+ in 5 days) and falling-
      // knife entries (down 8 %+ today). Both are statistical mean-revert
      // traps regardless of how nice the channel looks.
      if (snap.change_5d_pct != null && snap.change_5d_pct > 20) continue;
      if (snap.change_24h_pct != null && snap.change_24h_pct < -8) continue;
      if (
        snap.days_to_earnings != null &&
        snap.days_to_earnings >= -1 &&
        snap.days_to_earnings <= 3
      ) continue;
      let score = snap.relative_strength_30d;
      if (isPriorityCore(snap.ticker)) score += 50; // priority-core wins ties
      if (score > bestScore) {
        bestScore = score;
        best = snap;
      }
    }
    if (best) {
      const fallbackTicker = best.ticker;
      const fallbackMaxPerTicker =
        bucketCapital * (blueprint.params.maxPctPerPosition / 100);
      const fallbackTarget = bucketCapital * 0.35;
      const fallbackSafeBP = Math.max(0, remainingBuyingPower) * 0.95;
      const fallbackNotional = round(
        Math.min(
          fallbackTarget,
          fallbackMaxPerTicker,
          fallbackSafeBP,
          MAX_PER_ORDER_NOTIONAL,
        ),
        2,
      );
      if (fallbackNotional >= MIN_NOTIONAL_USD) {
        const priceRes = await getLatestPrice(creds, tradingSymbol(fallbackTicker));
        const currentPrice =
          priceRes.success && priceRes.data > 0 ? priceRes.data : best.price;
        const orderReq = buildStockOrder({
          symbol: tradingSymbol(fallbackTicker),
          side: 'buy',
          notional: fallbackNotional,
          currentPrice,
          marketIsOpen,
        });
        if (orderReq) {
          const r = await placeOrder(creds, orderReq);
          trades.push({
            blueprintId: blueprint.id,
            ticker: fallbackTicker,
            action: 'BUY',
            qty: 0,
            notional: fallbackNotional,
            status: r.success ? 'OK' : 'ERR',
            reason: isPriorityCore(fallbackTicker)
              ? 'ALWAYS_INVESTED_FALLBACK_PRIORITY_CORE'
              : 'ALWAYS_INVESTED_FALLBACK_RISING_CHANNEL',
            error: r.success ? undefined : r.error,
          });
          if (r.success) netDeployed += fallbackNotional;
        }
      }
    }
  }

  return { trades, netDeployed };
}

interface ExecuteMirrorArgs {
  creds: AlpacaCreds;
  clerkUserId: string;
  blueprint: Blueprint;
  leaderSnapshot: LeaderSnapshot;
  totalEquity: number;
  allocationPct: number;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
  remainingBuyingPower: number;
  cooldownTickers: Set<string>;
  fridayBlackout: boolean;
  isBearRegime: boolean;
  marketIsOpen: boolean;
  /** Mutable open-order list — see ExecuteArgs for rationale. */
  openOrdersData: AlpacaOrder[];
}

interface ExecuteMirrorResult {
  trades: TradeResult[];
  netDeployed: number;
  reason?: string;
}

/**
 * Portfolio-mirror executor for followers. Computes delta orders from the
 * leader's portfolio composition and dispatches them as Alpaca trades.
 * Replaces the decision-stream executor when Portfolio Mirror Mode is on.
 *
 * Cadence-gated by the follower's own last decision row — won't fire more
 * often than MIRROR_CADENCE_MS per (user, blueprint). Saves a synthetic
 * decision row after every run so the gate works on the next tick.
 */
async function executeMirrorPlan(args: ExecuteMirrorArgs): Promise<ExecuteMirrorResult> {
  const {
    creds,
    clerkUserId,
    blueprint,
    leaderSnapshot,
    totalEquity,
    allocationPct,
    positionsByTicker,
    inFlightTickers,
    remainingBuyingPower,
    cooldownTickers,
    fridayBlackout,
    isBearRegime,
    marketIsOpen,
    openOrdersData,
  } = args;

  // Cadence gate per (follower, blueprint). Without it, the cron's
  // 1-minute tick would re-fire mirror every minute and intra-minute
  // price drift would create order churn on already-converged positions.
  const myLast = await getLatestDecision(clerkUserId, blueprint.id);
  const myAgeMs =
    myLast && !myLast.failed ? Date.now() - new Date(myLast.decidedAt).getTime() : Infinity;
  if (Number.isFinite(myAgeMs) && myAgeMs < MIRROR_CADENCE_MS) {
    return { trades: [], netDeployed: 0, reason: 'mirror_within_cadence' };
  }

  const plan: MirrorOrder[] = computeMirrorPlan({
    leaderSnapshot,
    blueprint,
    followerEquity: totalEquity,
    followerAllocationPct: allocationPct,
    followerPositions: positionsByTicker,
    followerInFlight: inFlightTickers,
    followerBuyingPower: remainingBuyingPower,
    cooldownTickers,
    fridayBlackout,
    isBearRegime,
  });

  const trades: TradeResult[] = [];
  let netDeployed = 0;
  const isCrypto = blueprint.id === 'crypto';

  if (plan.length === 0) {
    // No delta this tick. Still save a synthetic decision so the cadence
    // gate resets — otherwise a converged portfolio would re-evaluate every
    // single tick (which is what computeMirrorPlan is supposed to prevent).
    await saveDecision({
      clerkUserId,
      blueprintId: blueprint.id,
      thesis: '[portfolio-mirror] no rebalance needed',
      decisions: [],
      rawResponse: null,
      failed: false,
    });
    return { trades, netDeployed: 0, reason: 'mirror_no_delta' };
  }

  const sells = plan.filter((o) => o.action === 'SELL');
  const buys = plan.filter((o) => o.action === 'BUY');

  // ── Phase 1: SELLs in parallel ──────────────────────────────────────
  const sellResults = await Promise.all(
    sells.map(async (o): Promise<TradeResult> => {
      const held = positionsByTicker.get(o.ticker);
      if (!held) return skipTrade(blueprint.id, o.ticker, 'SELL', 'no_position');
      // Defense-in-depth: never extend a short. The 2026-04-30 incident's
      // bug class was sending SELLs on already-short positions; engine
      // should refuse the order at the source.
      if (held.side !== 'long') return skipTrade(blueprint.id, o.ticker, 'SELL', 'not_long');
      const qty = o.qty ?? parseFloat(held.qty) ?? 0;
      if (qty <= 0) return skipTrade(blueprint.id, o.ticker, 'SELL', 'zero_qty');
      const currentPrice = parseFloat(held.current_price) || 0;
      let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
      if (isCrypto) {
        orderReq = {
          symbol: tradingSymbol(o.ticker),
          qty,
          side: 'sell',
          type: 'market',
          time_in_force: 'gtc',
          position_intent: 'sell_to_close',
        };
      } else {
        orderReq = buildStockOrder({
          symbol: tradingSymbol(o.ticker),
          side: 'sell',
          qty,
          currentPrice,
          marketIsOpen,
        });
      }
      if (!orderReq) return skipTrade(blueprint.id, o.ticker, 'SELL', 'no_price_for_extended_hours');
      const r = await placeOrder(creds, orderReq);
      if (r.success) {
        await cancelOpenStopsForTicker(creds, o.ticker, openOrdersData);
      }
      const notional = qty * currentPrice;
      return {
        blueprintId: blueprint.id,
        ticker: o.ticker,
        action: 'SELL',
        qty,
        notional,
        status: r.success ? 'OK' : 'ERR',
        reason: o.reason,
        error: r.success ? undefined : r.error,
      };
    }),
  );
  trades.push(...sellResults);
  for (const t of sellResults) {
    if (t.status === 'OK' && t.action === 'SELL') {
      positionsByTicker.delete(t.ticker);
      netDeployed -= t.notional;
    }
  }

  // ── Phase 2: BUYs sequentially (preserve buying-power accounting) ───
  for (const o of buys) {
    const notional = o.notional ?? 0;
    if (notional < 1) {
      trades.push(skipTrade(blueprint.id, o.ticker, 'BUY', 'mirror_below_min'));
      continue;
    }
    let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
    if (isCrypto) {
      orderReq = {
        symbol: tradingSymbol(o.ticker),
        notional,
        side: 'buy',
        type: 'market',
        time_in_force: 'gtc',
        position_intent: 'buy_to_open',
      };
    } else {
      const priceRes = await getLatestPrice(creds, tradingSymbol(o.ticker));
      const currentPrice = priceRes.success && priceRes.data > 0 ? priceRes.data : 0;
      orderReq = buildStockOrder({
        symbol: tradingSymbol(o.ticker),
        side: 'buy',
        notional,
        currentPrice,
        marketIsOpen,
      });
    }
    if (!orderReq) {
      trades.push(skipTrade(blueprint.id, o.ticker, 'BUY', 'no_price_for_extended_hours'));
      continue;
    }
    const r = await placeOrder(creds, orderReq);
    trades.push({
      blueprintId: blueprint.id,
      ticker: o.ticker,
      action: 'BUY',
      qty: 0,
      notional,
      status: r.success ? 'OK' : 'ERR',
      reason: o.reason,
      error: r.success ? undefined : r.error,
    });
    if (r.success) netDeployed += notional;
  }

  // Persist this tick's mirror action — drives the next tick's cadence gate
  // and gives the UI's "decided X min ago" timestamp something to show.
  await saveDecision({
    clerkUserId,
    blueprintId: blueprint.id,
    thesis: `[portfolio-mirror ← ${leaderSnapshot.clerkUserId.slice(0, 12)}…]`,
    decisions: plan.map((o) => ({
      ticker: o.ticker,
      action: o.action,
      reason: o.reason,
    })),
    tradeOutcomes: trades.map((t) => ({
      ticker: t.ticker,
      action: t.action,
      status: t.status,
      notional: t.notional,
      qty: t.qty,
      reason: t.reason,
      ...(t.error ? { error: t.error } : {}),
    })),
    rawResponse: null,
    failed: false,
  });

  return { trades, netDeployed };
}

function skipTrade(
  blueprintId: AssetClass,
  ticker: string,
  action: TradeAction | 'HOLD',
  reason: string,
): TradeResult {
  return {
    blueprintId,
    ticker,
    action: action === 'HOLD' ? 'BUY' : action,
    qty: 0,
    notional: 0,
    status: 'SKIP',
    reason,
  };
}

/**
 * Trailing-stop ratchet. Drives off the *peak* gain since entry, not current
 * gain — otherwise a position that spiked to +12 % and pulled back to +6 %
 * would not trigger because the ratchet would descend with the price.
 *
 * Peak-pnl input should be (highest_high_since_entry − entry) / entry.
 *
 * The floor locks in a fixed fraction (TRAIL_KEEP) of the peak gain and
 * sells once the position gives back the rest. At TRAIL_KEEP = 0.85 the
 * engine keeps 85 % of the run-up and tolerates a 15 % giveback before
 * cutting — e.g. a +20 % winner is sold if it falls back to +17 %, a
 * +80 % winner if it falls back to +68 %.
 *
 * Earlier values: 0.5 → 0.7 → 0.85. Raised to 0.85 (2026-05-21) after
 * the RKLB-from-peak discussion: user wants tighter give-back tolerance,
 * matching the "concentration > diversification, capture more of the top"
 * mandate. The trade-off is more whipsaw on positions that merely wobble
 * before continuing higher. Acceptable per user preference. Lower if back-
 * tests show too many premature exits on healthy consolidations.
 *
 * Floor is monotonically increasing in peak gain (no ratchet reversal) and
 * always locks a profit — below-entry protection is the ATR stop's job.
 *
 * Returns null when peak gain < 5 % (no ratchet yet — ATR-stop still protects).
 */
const TRAIL_KEEP = 0.85;
function trailingStopFloor(entry: number, peakPnlPct: number): number | null {
  if (peakPnlPct < 0.05) return null;
  return entry * (1 + TRAIL_KEEP * peakPnlPct);
}

/**
 * Mechanical safety pass — runs every cron tick regardless of Grok cadence.
 * Triggers SELL when a held position hits its ATR-stop, profit-take
 * threshold, or trailing-stop floor, so a flash move between Grok calls
 * doesn't blow through the blueprint's risk floor.
 */
async function mechanicalSafetyPass(args: {
  creds: AlpacaCreds;
  blueprint: Blueprint;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
  marketIsOpen: boolean;
}): Promise<TradeResult[]> {
  const { creds, blueprint, positionsByTicker, inFlightTickers, marketIsOpen } = args;
  const isCrypto = blueprint.id === 'crypto';
  const trades: TradeResult[] = [];

  for (const [ticker, held] of positionsByTicker) {
    if (inFlightTickers.has(ticker)) continue;
    const qty = parseFloat(held.qty) || 0;
    const entry = parseFloat(held.avg_entry_price) || 0;
    if (qty <= 0 || entry <= 0) continue;

    try {
      const barsRes = await fetchBars(creds, blueprint, ticker);
      if (!barsRes.success || barsRes.data.length < blueprint.params.atrPeriod + 5) continue;
      const bars = barsRes.data;
      const lastClose = bars[bars.length - 1]?.c ?? entry;
      const price = await fetchLatest(creds, blueprint, ticker, lastClose);
      const atrVal = atr(bars, blueprint.params.atrPeriod);
      if (atrVal == null) continue;

      // Leader setups (high RSI, above SMA50) get TIGHTER ATR-stop because
      // momentum unwinds violently — the same characteristic that gives them
      // upside also gives them faster reversals. Standard 1.5× ATR for dip-
      // buys, 1.2× ATR for momentum positions. Inferred from current state
      // since we don't store entry-path metadata.
      const closes = bars.map((b) => b.c);
      const sma50 = sma(closes, 50);
      const rsiNow = rsi(closes, 14);
      const isLeaderSetup =
        rsiNow != null && rsiNow >= 55 && sma50 != null && price > sma50;
      const stopMult = isLeaderSetup
        ? blueprint.params.atrStopMult * 0.8 // 1.5 → 1.2
        : blueprint.params.atrStopMult;
      const stopPrice = entry - stopMult * atrVal;
      const pnlPct = (price - entry) / entry;

      // Peak-pnl since entry. We don't store entry timestamp, so we use the
      // bars whose high is >= entry × 1.001 as a proxy for "bars after we
      // opened the position" — the position was opened near or below entry,
      // so its first day's high is at least a hair above. Take max(high) over
      // those bars + the live price. Falls back to current price when no bar
      // shows a peak (e.g. position opened today, no daily-bar print yet).
      let peakPrice = price;
      for (const b of bars) {
        if (b.h >= entry && b.h > peakPrice) peakPrice = b.h;
      }
      const peakPnlPct = (peakPrice - entry) / entry;
      const trailFloor = trailingStopFloor(entry, peakPnlPct);

      // Intraday "fast deterioration" detection. Cuts the position when a
      // big intraday drop coincides with a break of short-term trend —
      // catches earnings-disaster gaps, regulatory shocks, FDA rejects,
      // etc. before they bleed further. The SMA50 condition keeps this from
      // firing on a normal pullback inside an intact uptrend — a healthy
      // pullback holds above SMA50. Conditions:
      //   - intraday change ≤ -5 % (tightened from -7 % on 2026-05-22 for
      //     earlier downside protection)
      //   - price has crossed below SMA50 (short-term trend broken)
      //   - position is currently underwater OR peak gain < +20 %
      //     (don't dump winners that gave back; trailing stop handles those)
      const prevClose = bars[bars.length - 1]?.c ?? entry;
      const intradayPct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
      const belowSma50 = sma50 != null && sma50 > 0 && price < sma50;
      const isFastDeterioration =
        intradayPct <= -5 &&
        belowSma50 &&
        (pnlPct < 0 || peakPnlPct < 0.20);

      let reason: string | null = null;
      if (price <= stopPrice) reason = 'MECHANICAL_ATR_STOP';
      else if (isFastDeterioration) reason = 'MECHANICAL_FAST_DETERIORATION';
      else if (pnlPct >= blueprint.params.profitTakeThreshold) reason = 'MECHANICAL_PROFIT_TAKE';
      else if (trailFloor != null && price < trailFloor) reason = 'MECHANICAL_TRAILING_STOP';

      if (!reason) continue;

      // Fractional positions can't sell via extended-hours (Alpaca only
      // accepts whole-share limit orders out-of-hours). Skip and let the
      // next tick at/after market open fire a regular market sell.
      const isFractional = !isCrypto && qty !== Math.floor(qty);
      if (!isCrypto && !marketIsOpen && isFractional) {
        trades.push({
          blueprintId: blueprint.id,
          ticker,
          action: 'SELL',
          qty,
          notional: 0,
          status: 'SKIP',
          reason: `${reason}_deferred_fractional`,
        });
        continue;
      }

      const orderReq = isCrypto
        ? ({
            symbol: tradingSymbol(ticker),
            qty,
            side: 'sell' as const,
            type: 'market' as const,
            time_in_force: 'gtc' as const,
            position_intent: 'sell_to_close' as const,
          })
        : buildStockOrder({
            symbol: tradingSymbol(ticker),
            side: 'sell',
            qty,
            currentPrice: price,
            marketIsOpen,
          });
      if (!orderReq) continue;
      const r = await placeOrder(creds, orderReq);
      trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL',
        qty,
        notional: 0,
        status: r.success ? 'OK' : 'ERR',
        reason,
        error: r.success ? undefined : r.error,
      });
    } catch {
      // skip on transient error
    }
  }

  return trades;
}

/**
 * Server-side stop-loss management.
 *
 * Until now, all stop logic ran in-memory inside `mechanicalSafetyPass`,
 * triggered by the per-minute cron. That meant:
 *   - Overnight gap-downs were not caught until the next morning's cron
 *     after market open.
 *   - A Vercel cron outage or Alpaca API hiccup removed all protection.
 *   - Flash-crashes within a single minute could fill the in-memory
 *     market sell well below the intended stop level.
 *
 * This function places a GTC stop order at Alpaca for every held equity
 * position that doesn't already have one. The stop level mirrors the
 * `mechanicalSafetyPass` ATR-stop (1.5× ATR, or 1.2× for leader setups),
 * so the in-memory pass and the server-side stop trigger at the same
 * price band. The minute-cron path remains as defense-in-depth — if for
 * any reason the server-side stop doesn't trigger (extended-hours gap,
 * partial fill weirdness, Alpaca-side cancellation) the cron still
 * catches the position on its next pass.
 *
 * Constraints / known limits:
 *   - Alpaca stop orders for equities are whole-share only, so a
 *     fractional position (e.g. 1395.89 shares) has the fractional
 *     remainder unprotected by the server-side stop. Mechanical pass
 *     still covers the remainder.
 *   - Stop orders for equities trigger only during regular trading hours
 *     on most venues. Overnight gap-downs that don't recover into RTH
 *     remain exposed; this is an unavoidable equity-market property.
 *   - Crypto is skipped — bucket is disabled anyway, and Alpaca's
 *     crypto-stop semantics differ enough that we shouldn't pretend
 *     parity here without explicit testing.
 *   - The ATR/SMA/RSI inputs come from a fresh `fetchBars` call. As ATR
 *     drifts day-to-day the existing stop will be slightly stale; that's
 *     fine — the in-memory pass uses live ATR each tick and would close
 *     a position before a stale server-side stop misfires by more than
 *     a few percent.
 */
async function ensureServerSideStops(args: {
  creds: AlpacaCreds;
  blueprint: Blueprint;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
  openOrdersData: AlpacaOrder[];
}): Promise<void> {
  const { creds, blueprint, positionsByTicker, inFlightTickers, openOrdersData } = args;
  if (blueprint.id === 'crypto') return; // skipped per docstring
  if (blueprint.id === 'commodities') return; // disabled bucket, defensive

  // Build a set of (symbol) that already has an open SELL stop order so
  // we don't double-place. We deliberately accept type 'stop' OR
  // 'stop_limit' so a hand-placed stop_limit by ops also counts.
  const protectedSymbols = new Set<string>();
  for (const o of openOrdersData) {
    if (o.side !== 'sell') continue;
    if (o.type !== 'stop' && o.type !== 'stop_limit') continue;
    protectedSymbols.add(o.symbol);
  }

  for (const [ticker, held] of positionsByTicker) {
    const sym = tradingSymbol(ticker);
    if (protectedSymbols.has(sym)) continue;
    if (inFlightTickers.has(ticker)) continue;
    const qty = parseFloat(held.qty) || 0;
    const entry = parseFloat(held.avg_entry_price) || 0;
    if (qty <= 0 || entry <= 0) continue;
    const wholeQty = Math.floor(qty);
    if (wholeQty <= 0) continue; // pure-fractional position; mechanical pass handles

    try {
      const barsRes = await fetchBars(creds, blueprint, ticker);
      if (!barsRes.success || barsRes.data.length < blueprint.params.atrPeriod + 5) continue;
      const bars = barsRes.data;
      const atrVal = atr(bars, blueprint.params.atrPeriod);
      if (atrVal == null || atrVal <= 0) continue;
      const closes = bars.map((b) => b.c);
      const sma50 = sma(closes, 50);
      const rsiNow = rsi(closes, 14);
      const price = parseFloat(held.current_price) || entry;
      const isLeaderSetup =
        rsiNow != null && rsiNow >= 55 && sma50 != null && price > sma50;
      const stopMult = isLeaderSetup
        ? blueprint.params.atrStopMult * 0.8
        : blueprint.params.atrStopMult;
      // Round DOWN to 2 dp so the stop sits inside Alpaca's tick grid and
      // doesn't get rejected for sub-penny pricing on small-cap names.
      const rawStop = entry - stopMult * atrVal;
      const stopPrice = Math.floor(rawStop * 100) / 100;
      if (stopPrice <= 0) continue;
      // If the stop is already above the current price the mechanical pass
      // will trigger this tick — don't place a redundant server-side order
      // that would immediately fire.
      if (price <= stopPrice) continue;

      await placeOrder(creds, {
        symbol: sym,
        qty: wholeQty,
        side: 'sell',
        type: 'stop',
        stop_price: stopPrice,
        time_in_force: 'gtc',
        position_intent: 'sell_to_close',
      });
      // Failure here is non-fatal: mechanical-pass coverage remains, and
      // the next tick will retry. placeOrder() already logs the error.
    } catch {
      // Transient errors — leave position to mechanical-pass coverage.
    }
  }
}

/**
 * Cancel any open SELL stop orders for `ticker`. Call this after a SELL
 * succeeds (mechanical, Grok, or bucket-dealloc) so an orphan stop doesn't
 * sit at Alpaca trying to sell shares we no longer hold. Mutates the
 * provided `openOrdersData` array in place so subsequent in-scan logic
 * sees the canceled order removed.
 */
async function cancelOpenStopsForTicker(
  creds: AlpacaCreds,
  ticker: string,
  openOrdersData: AlpacaOrder[],
): Promise<void> {
  const sym = tradingSymbol(ticker);
  const toCancel: AlpacaOrder[] = [];
  for (const o of openOrdersData) {
    if (o.symbol !== sym) continue;
    if (o.side !== 'sell') continue;
    if (o.type !== 'stop' && o.type !== 'stop_limit') continue;
    toCancel.push(o);
  }
  if (toCancel.length === 0) return;
  await Promise.all(
    toCancel.map(async (o) => {
      try {
        await alpacaCancelOrder(creds, o.id);
      } catch {
        // Best-effort cancel — if Alpaca rejects, the stop will eventually
        // fail to fill (no position) and self-clear.
      }
    }),
  );
  // Remove canceled orders from the local list so subsequent in-scan
  // checks (e.g. ensureServerSideStops on the next blueprint iteration)
  // don't see them as still-active.
  for (const o of toCancel) {
    const idx = openOrdersData.indexOf(o);
    if (idx >= 0) openOrdersData.splice(idx, 1);
  }
}

async function runBlueprint(args: {
  creds: AlpacaCreds;
  clerkUserId: string;
  blueprint: Blueprint;
  bucketCapital: number;
  totalEquity: number;
  buyingPower: number;
  /** Account-wide buying power remaining for this scan, ticking down as
   *  earlier blueprints in the loop deploy capital. Used as a ceiling so
   *  later blueprints can't request more than Alpaca will actually fund. */
  remainingBuyingPower: number;
  allocationPct: number;
  allPositions: AlpacaPosition[];
  openOrderSymbols: Set<string>;
  /** Full open-order records for the account. Needed for the server-side
   *  stop-loss management (`ensureServerSideStops`) and the
   *  cancel-stop-on-SELL helper — both inspect order type and stop_price,
   *  which the symbol-only set above doesn't carry. */
  openOrdersData: AlpacaOrder[];
  killSwitchOn: boolean;
  /** Account down ≥ CIRCUIT_BREAKER_DRAWDOWN from its trailing ~1-month
   *  peak — halts new BUYs + the always-invested mandate (crash protection). */
  circuitBreakerActive: boolean;
  account: AccountSnapshot;
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
  /** SPY < SMA200 — engine halves position sizes. */
  isBearRegime: boolean;
  /** Friday after 14:30 ET — block new equity BUYs. */
  fridayBlackout: boolean;
  /** SPY 30-trading-day return — benchmark for ticker relative strength. */
  spyReturn30d: number | null;
  /** Leader-follower mode. When this differs from `clerkUserId`, we treat
   *  the user as a FOLLOWER: skip the Grok call entirely. With Portfolio
   *  Mirror Mode (default), follower rebalances to match leader's per-ticker
   *  % composition. With mirror disabled, falls back to decision-stream
   *  mirror (BUY/SELL/HOLD ticker list against own account).
   *  Per-user safety filters (kill-switch, friday-blackout, cool-down) still
   *  apply in both modes. */
  signalSourceClerkUserId: string;
  /** Leader's Alpaca state, fetched once per cron tick. Required for
   *  Portfolio Mirror Mode; ignored otherwise. */
  leaderSnapshot?: LeaderSnapshot;
}): Promise<BlueprintRunResult & { deployedNotional: number }> {
  const {
    creds,
    clerkUserId,
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    remainingBuyingPower,
    allocationPct,
    allPositions,
    openOrderSymbols,
    openOrdersData,
    killSwitchOn,
    circuitBreakerActive,
    account,
    recentOrders,
    marketClock,
    isBearRegime,
    fridayBlackout,
    spyReturn30d,
    signalSourceClerkUserId,
    leaderSnapshot,
  } = args;
  const isFollower = signalSourceClerkUserId !== clerkUserId;

  const watchlistSet = new Set<string>(blueprint.watchlist);
  const positionsByTicker = new Map<string, AlpacaPosition>();
  for (const p of allPositions) {
    const norm = normalizePositionSymbol(p.symbol);
    if (watchlistSet.has(norm)) positionsByTicker.set(norm, p);
  }
  const inFlightTickers = new Set<string>();
  for (const sym of openOrderSymbols) {
    const norm = normalizePositionSymbol(sym);
    if (watchlistSet.has(norm)) inFlightTickers.add(norm);
  }

  const result: BlueprintRunResult = {
    blueprintId: blueprint.id,
    bucketCapital,
    positionsHeld: positionsByTicker.size,
    trades: [],
    killSwitchTriggered: killSwitchOn,
    grokCalled: false,
    reason: killSwitchOn
      ? 'daily_kill_switch'
      : circuitBreakerActive
        ? 'crash_circuit_breaker'
        : undefined,
  };

  // If user has zero allocation to this bucket but positions still exist
  // (e.g. they reallocated 100 % to stocks after holding commodities),
  // liquidate all in-bucket holdings so capital flows to other buckets.
  if (bucketCapital <= 0) {
    for (const [ticker, held] of positionsByTicker) {
      if (inFlightTickers.has(ticker)) continue;
      const qty = parseFloat(held.qty) || 0;
      if (qty <= 0) continue;
      const isCrypto = blueprint.id === 'crypto';
      const marketIsOpen = marketClock?.is_open ?? false;
      const orderReq = isCrypto
        ? ({
            symbol: tradingSymbol(ticker),
            qty,
            side: 'sell' as const,
            type: 'market' as const,
            time_in_force: 'gtc' as const,
            position_intent: 'sell_to_close' as const,
          })
        : buildStockOrder({
            symbol: tradingSymbol(ticker),
            side: 'sell',
            qty,
            currentPrice: parseFloat(held.current_price) || 0,
            marketIsOpen,
          });
      if (!orderReq) continue;
      const r = await placeOrder(creds, orderReq);
      if (r.success) {
        await cancelOpenStopsForTicker(creds, ticker, openOrdersData);
      }
      result.trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL',
        qty,
        notional: 0,
        status: r.success ? 'OK' : 'ERR',
        reason: 'BUCKET_DEALLOCATED',
        error: r.success ? undefined : r.error,
      });
    }
    result.reason = 'bucket_deallocated';
    return { ...result, deployedNotional: 0 };
  }

  // 1. Mechanical safety always runs first — and crucially BEFORE the daily
  //    kill-switch gate below. ATR-stop, trailing-stop, profit-take and
  //    fast-deterioration must keep protecting open positions even on a
  //    kill-switch day: the kill-switch freezes *new* risk, it must never
  //    freeze the stop-losses guarding existing positions.
  const safetyTrades = await mechanicalSafetyPass({
    creds,
    blueprint,
    positionsByTicker,
    inFlightTickers,
    marketIsOpen: marketClock?.is_open ?? false,
  });
  result.trades.push(...safetyTrades);
  // Drop closed positions from local cache so subsequent Grok decisions see fresh state.
  // Also cancel any server-side stop orders left behind for the closed ticker.
  for (const t of safetyTrades) {
    if (t.action === 'SELL' && t.status === 'OK') {
      positionsByTicker.delete(t.ticker);
      await cancelOpenStopsForTicker(creds, t.ticker, openOrdersData);
    }
  }

  // 1a. Ensure each remaining held position has a server-side stop order at
  //     Alpaca. See `ensureServerSideStops` docstring for the rationale —
  //     this is the protection layer that survives Vercel cron outages and
  //     overnight gaps better than the in-memory pass alone.
  await ensureServerSideStops({
    creds,
    blueprint,
    positionsByTicker,
    inFlightTickers,
    openOrdersData,
  });

  // Risk gates — stop opening NEW risk while either fires. The mechanical
  // safety pass above has already run, so existing positions keep their
  // stop-losses; from here we skip the Grok call, all BUYs, rotation and
  // the always-invested mandate.
  //  - Daily kill-switch: account down ≥ dailyKillSwitchPct on the day.
  //  - Crash circuit breaker: account down ≥ CIRCUIT_BREAKER_DRAWDOWN from
  //    its trailing ~1-month peak — a sustained bleed the daily switch
  //    resets out of every morning.
  if (killSwitchOn || circuitBreakerActive) return { ...result, deployedNotional: 0 };

  // 1b. Portfolio Mirror Mode — followers rebalance their portfolio %s to
  // match the leader's per-ticker composition. Replaces the decision-stream
  // mirror for followers when MIRROR_MODE_ENABLED and a fresh leader snapshot
  // is available. Leader path falls through to Grok logic below.
  if (isFollower && MIRROR_MODE_ENABLED && leaderSnapshot) {
    const cooldownTickersForMirror = await getRecentStopOutTickers(clerkUserId, blueprint.id, 5);
    const mirrorRes = await executeMirrorPlan({
      creds,
      clerkUserId,
      blueprint,
      leaderSnapshot,
      totalEquity,
      allocationPct,
      positionsByTicker,
      inFlightTickers,
      remainingBuyingPower,
      cooldownTickers: cooldownTickersForMirror,
      fridayBlackout,
      isBearRegime,
      marketIsOpen: marketClock?.is_open ?? false,
      openOrdersData,
    });
    if (mirrorRes.reason) {
      result.reason = mirrorRes.reason;
    }
    result.trades.push(...mirrorRes.trades);
    result.grokCalled = false;
    result.thesis = `[portfolio-mirror ← ${signalSourceClerkUserId.slice(0, 12)}…]`;
    result.positionsHeld =
      positionsByTicker.size + mirrorRes.trades.filter(
        (t) => t.action === 'BUY' && t.status === 'OK',
      ).length;
    return { ...result, deployedNotional: mirrorRes.netDeployed };
  }

  // 2. Decide whether to call Grok this tick. Defensive parse of decidedAt:
  // a corrupt DB row with null/invalid timestamp would yield NaN here, and
  // `Date.now() - NaN >= GROK_CADENCE_MS` is false → we'd fall through to
  // shouldCallGrok=true on every single tick, blasting the API quota.
  // Treat unparseable timestamps as "very old" (force one Grok call, then
  // the new row will have a valid timestamp and cadence kicks back in).
  // For followers, we read the LEADER's latest decision instead (so all
  // followers mirror the same signal stream that leader's last Grok call
  // produced).
  const decisionOwnerForLookup = isFollower ? signalSourceClerkUserId : clerkUserId;
  const last = await getLatestDecision(decisionOwnerForLookup, blueprint.id);
  let lastMs = 0;
  if (last && !last.failed) {
    const t = new Date(last.decidedAt).getTime();
    lastMs = Number.isFinite(t) ? t : 0;
  }
  const ageMs = Date.now() - lastMs;

  // Outside US extended-hours window (20:00–04:00 ET), no fills can happen
  // and indicators drift negligibly. Skip Grok to save API spend; mechanical
  // safety still ran above. Crypto bucket would override this if active
  // (24/7 markets), but crypto is currently disabled — guard for the future.
  const inTradingWindow = blueprint.id === 'crypto' || isTradingHoursWindow();
  // Stretch cadence 2× during extended hours (pre-04:00–09:30, post-16:00–
  // 20:00 ET). Pre/post have thinner news flow and limited fills, so each
  // Grok call delivers less marginal signal. RTH keeps full cadence so we
  // react fast during the high-signal window.
  const baseCadenceMs =
    blueprint.id === 'crypto' || isRegularTradingHours()
      ? GROK_CADENCE_MS
      : GROK_CADENCE_MS * 2;
  // Empty-bucket override: when there's no exposure AND market is open AND
  // we're not in a bear regime, shrink cadence to 5 min. The mandate is
  // that the bucket should always hold at least 1 position in a rising-
  // channel leader — sitting at 0 % deployed for a full 20-min cadence is
  // a violation, not a saving. Bear regime keeps the full cadence (cash
  // is the right answer in a structural downtrend). In-flight orders are
  // treated as "about to fill" so we don't double-decide before the fill.
  const EMPTY_BUCKET_CADENCE_MS = 5 * 60 * 1000;
  const bucketIsEmpty =
    positionsByTicker.size === 0 && inFlightTickers.size === 0;
  const effectiveCadenceMs =
    bucketIsEmpty && marketClock?.is_open && !isBearRegime
      ? Math.min(baseCadenceMs, EMPTY_BUCKET_CADENCE_MS)
      : baseCadenceMs;
  // Evening-rebalance override: force one Grok call in the 15:40–15:55 ET
  // window per trading day. Last-hour rebalance toward names with the
  // best overnight/next-day setup. We detect "already done today" by
  // checking if the last decision was in today's evening window — if so,
  // honour normal cadence (don't keep calling every minute in the window).
  const nowEt = new Date();
  const isEvening = isEveningRebalanceWindow(nowEt);
  const lastWasEveningToday =
    last != null && !last.failed
      ? isEveningRebalanceWindow(new Date(last.decidedAt)) &&
        etDateString(new Date(last.decidedAt)) === etDateString(nowEt)
      : false;
  const forceEveningCall = isEvening && !lastWasEveningToday;
  // Followers never call Grok. They execute when the leader has a FRESH
  // decision (within 2× cadence). If leader has no fresh decision, follower
  // skips this tick — leader will produce one shortly, and the follower
  // will mirror it on the next cron tick.
  const FOLLOWER_FRESHNESS_MS = effectiveCadenceMs * 2;
  const followerHasFreshLeaderDecision =
    !!last && !last.failed && ageMs <= FOLLOWER_FRESHNESS_MS;
  const shouldCallGrok =
    !isFollower &&
    inTradingWindow &&
    (forceEveningCall || !last || last.failed || ageMs >= effectiveCadenceMs);
  const shouldExecuteFollowerMirror =
    isFollower && inTradingWindow && followerHasFreshLeaderDecision;

  if (!shouldCallGrok && !shouldExecuteFollowerMirror) {
    result.thesis = last?.thesis ?? undefined;
    if (!inTradingWindow) {
      result.reason = 'outside_trading_hours';
    } else if (isFollower && !followerHasFreshLeaderDecision) {
      result.reason = 'follower_awaiting_fresh_leader_decision';
    } else if (last && !last.failed && ageMs < effectiveCadenceMs) {
      result.reason = 'within_cadence';
    }
    return { ...result, deployedNotional: 0 };
  }

  // 3. Build context + call Grok.
  const candidates = await buildIndicatorSnapshots(creds, blueprint, spyReturn30d);
  if (candidates.length === 0) {
    await saveDecision({
      clerkUserId,
      blueprintId: blueprint.id,
      thesis: '',
      decisions: [],
      rawResponse: null,
      failed: true,
      errorMessage: 'no_candidate_data',
    });
    result.reason = 'no_candidate_data';
    return { ...result, deployedNotional: 0 };
  }

  // Cost-saver: shrink Grok's candidate input from 46 → 12 by ranking on
  // signal relevance + held-position pinning. Engine still has all 46 in
  // memory for its own filter; this only trims what the LLM sees.
  // Held tickers are always included (Grok needs context on existing
  // positions for HOLD/SELL decisions).
  const heldTickerSet = new Set(positionsByTicker.keys());
  const TOP_N_FOR_GROK = 12;
  const candidatesForGrok = rankAndTakeTop(candidates, heldTickerSet, TOP_N_FOR_GROK);

  const userPrompt = buildUserPrompt({
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    positions: summarizePositions(allPositions, watchlistSet),
    candidates: candidatesForGrok,
    inFlightTickers: [...inFlightTickers],
    allocationPct,
    account,
    recentOrders,
    marketClock,
    eveningMode: isEvening,
  });

  // Decision source: leader calls Grok; follower reuses leader's latest.
  let payload: GrokDecisionPayload;
  let grokUsage: import('@/lib/grok').GrokUsage | undefined;
  let grokRaw: unknown = null;
  if (isFollower) {
    if (!last || last.failed || !last.decisions) {
      result.reason = 'follower_no_leader_decision';
      return { ...result, deployedNotional: 0 };
    }
    payload = { thesis: last.thesis ?? '', decisions: last.decisions };
    result.grokCalled = false;
    result.thesis = payload.thesis;
  } else {
    // Cost gate: enable live-search tools at most once per ET clock-hour per
    // user/blueprint. First call after deploy or first call to cross an
    // hour boundary gets fresh web_search + x_search; same-hour follow-ups
    // run prompt-only on the engine-injected `recent_headlines` + RS data.
    // See `etHourBucket` doc for the cost/alpha tradeoff rationale.
    const nowBucket = etHourBucket(new Date());
    const lastBucket = lastMs > 0 ? etHourBucket(new Date(lastMs)) : '';
    const enableTools = !lastBucket || lastBucket !== nowBucket;
    const grokRes = await decide(
      {
        systemPrompt: blueprint.strategy,
        userPrompt,
      },
      { disableTools: !enableTools },
    );
    result.grokCalled = true;
    if (!grokRes.success) {
      await saveDecision({
        clerkUserId,
        blueprintId: blueprint.id,
        thesis: '',
        decisions: [],
        rawResponse: grokRes.raw ?? null,
        failed: true,
        errorMessage: grokRes.error,
      });
      result.reason = `grok_error: ${grokRes.error}`;
      return { ...result, deployedNotional: 0 };
    }
    payload = grokRes.payload;
    grokUsage = grokRes.usage;
    grokRaw = grokRes.raw ?? null;
    result.thesis = payload.thesis;
  }

  // 4. Execute Grok's decisions.
  const snapshotMap = new Map<string, IndicatorSnapshot>(
    candidates.map((s) => [s.ticker, s]),
  );
  // Pull tickers stopped out in the last 5 days — those get a cool-down so
  // we don't whipsaw back into the same losing setup.
  const cooldownTickers = await getRecentStopOutTickers(clerkUserId, blueprint.id, 5);
  const exec = await executeDecisions({
    creds,
    blueprint,
    bucketCapital,
    remainingBuyingPower,
    marketIsOpen: marketClock?.is_open ?? false,
    snapshots: snapshotMap,
    payload,
    positionsByTicker,
    inFlightTickers,
    isBearRegime,
    cooldownTickers,
    fridayBlackout,
    openOrdersData,
  });
  result.trades.push(...exec.trades);
  result.positionsHeld = positionsByTicker.size + exec.trades.filter(
    (t) => t.action === 'BUY' && t.status === 'OK',
  ).length;

  await saveDecision({
    clerkUserId,
    blueprintId: blueprint.id,
    thesis: payload.thesis,
    decisions: payload.decisions,
    tradeOutcomes: exec.trades.map((t) => ({
      ticker: t.ticker,
      action: t.action,
      status: t.status,
      notional: t.notional,
      qty: t.qty,
      reason: t.reason,
      ...(t.error ? { error: t.error } : {}),
    })),
    usage: grokUsage,
    rawResponse: grokRaw,
  });

  return { ...result, deployedNotional: exec.netDeployed };
}

export async function runScanForUser(
  creds: AlpacaCreds,
  clerkUserId: string,
  /** Leader-follower mode. When set AND different from clerkUserId, this
   *  user is a FOLLOWER: skip Grok call, mirror leader's latest decision.
   *  When omitted or equal to clerkUserId, this user is self-signaled
   *  (calls Grok normally). */
  signalSourceClerkUserId?: string,
  /** Pre-fetched leader Alpaca state. Required for Portfolio Mirror Mode
   *  on followers. Caller (cron/tick) fetches once per cron tick after
   *  leader's own scan completes, then passes to every follower. */
  leaderSnapshot?: LeaderSnapshot,
): Promise<UserScanResult> {
  const effectiveSignalSource = signalSourceClerkUserId ?? clerkUserId;
  const ranAt = new Date().toISOString();
  const out: UserScanResult = {
    clerkUserId,
    ranAt,
    equity: 0,
    buyingPower: 0,
    blueprints: [],
  };

  // Only cancel STALE pending orders (>5 min old). Cancelling everything
  // every tick was killing pre-market limit fills before the order could
  // match thin orderbook liquidity (we saw orders canceled 23 sec after
  // submission). The engine's inFlightTickers logic prevents duplicate
  // submissions, so fresh limits don't need to be cleared.
  const STALE_ORDER_MS = 5 * 60 * 1000;
  const openOrdersForCleanupRes = await getOrders(creds, { status: 'open', limit: 200 });
  if (openOrdersForCleanupRes.success) {
    const now = Date.now();
    for (const o of openOrdersForCleanupRes.data) {
      // Defensive: Alpaca normally always returns submitted_at, but if it's
      // ever null/undefined or unparseable, NaN comparisons are false → the
      // stale order would never get cancelled and would lock BP forever.
      // Treat unparseable timestamps as stale (cancel them).
      const submittedMs = new Date(o.submitted_at).getTime();
      const isStale = !Number.isFinite(submittedMs) || now - submittedMs > STALE_ORDER_MS;
      if (isStale) {
        // Best-effort cancel of stale orders so they don't lock BP forever.
        await alpacaCancelOrder(creds, o.id);
      }
    }
  }

  const acctRes = await getAccount(creds);
  if (!acctRes.success) {
    out.error = `account_fetch_failed: ${acctRes.error}`;
    return out;
  }
  const equity = parseFloat(acctRes.data.equity) || 0;
  const lastEquity =
    parseFloat(
      (acctRes.data as unknown as { last_equity?: string }).last_equity ?? acctRes.data.equity,
    ) || equity;
  const buyingPower = parseFloat(acctRes.data.buying_power) || 0;
  out.equity = equity;
  out.buyingPower = buyingPower;

  const dailyPnlPct = lastEquity > 0 ? (equity - lastEquity) / lastEquity : 0;

  const positionsRes = await getPositions(creds);
  if (!positionsRes.success) {
    out.error = `positions_fetch_failed: ${positionsRes.error}`;
    return out;
  }
  const positions = positionsRes.data;

  const openOrdersRes = await getOrders(creds, { status: 'open', limit: 200 });
  const openOrderSymbols = new Set<string>(
    openOrdersRes.success ? openOrdersRes.data.map((o) => o.symbol) : [],
  );

  const recentOrdersRes = await getOrders(creds, { status: 'all', limit: 20 });
  const recentOrders = recentOrdersRes.success ? ordersToSummary(recentOrdersRes.data) : [];

  const clockRes = await getClock(creds);
  const marketClock = clockRes.success ? clockToSummary(clockRes.data) : null;

  const account = accountToSnapshot(acctRes.data, creds.env);

  const allocation = await getUserAllocation(clerkUserId);

  // Macro regime once per scan — SPY < SMA200 means halve position sizes.
  // Null result (SPY data unavailable) is treated as neutral, not bear.
  const bear = await detectBearRegime(creds);
  const isBearRegime = bear?.isBear ?? false;
  const spyReturn30d = bear?.return30d ?? null;

  // Multi-day crash circuit breaker — account-wide, computed once per scan.
  // See detectCrashCircuitBreaker. Passed to every blueprint run below.
  const circuitBreakerActive = await detectCrashCircuitBreaker(creds, equity);

  // Friday-afternoon equity-BUY blackout (weekend gap risk).
  const fridayBlackout = isFridayBlackout();

  // Account-wide cap on new BUY notional this scan. Notional/fractional
  // orders on Alpaca draw from non-marginable buying power (≈ cash), not
  // margin × 2. Use cash so each blueprint's deployment stays within the
  // pool Alpaca will actually fund. 95 % leaves a small slack so rounding
  // doesn't push the last order over the edge.
  const cash = parseFloat(acctRes.data.cash) || 0;
  let remainingBuyingPower = cash;

  // ── Disabled-bucket allocation redistribution ─────────────────────────
  // Default user allocation is 33 / 33 / 34 across stocks / crypto / commodities.
  // With crypto + commodities currently in DISABLED_BLUEPRINTS, the previous
  // code forced their allocPct to 0 WITHOUT redistributing — so the user
  // ended up with ~33 % stocks deployed and ~67 % idle cash regardless of
  // saved allocation. That dead-cash made strong days like the +9.4 % above
  // capture far less than the strategy intended.
  //
  // New behaviour: sum the disabled buckets' pct and redistribute proportionally
  // across active buckets (weights = each active bucket's pct / sum of active
  // pcts). All-disabled (degenerate) keeps everything at 0 % which is correct
  // — there's nowhere to put the capital.
  const activeSum = BLUEPRINT_LIST.reduce(
    (s, bp) => s + (DISABLED_BLUEPRINTS.has(bp.id) ? 0 : allocation[bp.id] ?? 0),
    0,
  );
  const totalSavedPct = BLUEPRINT_LIST.reduce(
    (s, bp) => s + (allocation[bp.id] ?? 0),
    0,
  );
  const disabledSum = Math.max(0, totalSavedPct - activeSum);
  const redistribute = activeSum > 0 && disabledSum > 0;

  for (const blueprint of BLUEPRINT_LIST) {
    // Hard-disabled blueprints get 0 % bucket capital regardless of the
    // user's saved allocation. The deallocation logic in runBlueprint then
    // liquidates any positions in this bucket and skips Grok entirely.
    const isDisabled = DISABLED_BLUEPRINTS.has(blueprint.id);
    const savedPct = allocation[blueprint.id] ?? 0;
    const effectivePct = isDisabled
      ? 0
      : redistribute
        ? savedPct + (savedPct / activeSum) * disabledSum
        : savedPct;
    const allocPct = effectivePct;
    const bucketCapital = (equity * allocPct) / 100;
    const killSwitchOn = dailyPnlPct <= blueprint.params.dailyKillSwitchPct;
    const result = await runBlueprint({
      creds,
      clerkUserId,
      blueprint,
      bucketCapital,
      totalEquity: equity,
      buyingPower,
      remainingBuyingPower,
      allocationPct: allocPct,
      allPositions: positions,
      openOrderSymbols,
      openOrdersData: openOrdersRes.success ? openOrdersRes.data : [],
      killSwitchOn,
      circuitBreakerActive,
      account,
      recentOrders,
      marketClock,
      isBearRegime,
      fridayBlackout,
      spyReturn30d,
      signalSourceClerkUserId: effectiveSignalSource,
      leaderSnapshot,
    });
    remainingBuyingPower = Math.max(0, remainingBuyingPower - result.deployedNotional);
    out.blueprints.push(result);
  }

  return out;
}

export type { GrokDecision } from '@/lib/grok';
