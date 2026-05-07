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
  getPositions,
  getStockBars,
  placeOrder,
} from '@/lib/alpaca';
import { BLUEPRINT_LIST, type AssetClass, type Blueprint } from '@/lib/blueprints';
import { sectorOf } from '@/lib/blueprints/sectors';
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
import { daysToEarnings, newsCount24h, prefetchNews } from './calendar';

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
} | null> {
  try {
    const r = await getStockBars(creds, 'SPY', { timeframe: '1Day', limit: 220 });
    if (!r.success || r.data.length < 200) return null;
    const closes = r.data.map((b) => b.c);
    const sma200 = sma(closes, 200);
    if (sma200 == null) return null;
    const live = await getLatestPrice(creds, 'SPY');
    const spot = live.success ? live.data : closes[closes.length - 1];
    return { isBear: spot < sma200, spotPrice: spot, sma200 };
  } catch {
    return null;
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
}

async function buildIndicatorSnapshots(
  creds: AlpacaCreds,
  blueprint: Blueprint,
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

      // Catalyst layer (failure-soft: null/0 when no API key is set)
      const earnings = await daysToEarnings(ticker).catch(() => null);
      const news24h = await newsCount24h(ticker).catch(() => 0);

      snaps.push({
        ticker,
        price: round(p, 6),
        change_24h_pct: ago1 ? round(((p - ago1) / ago1) * 100, 2) : null,
        change_5d_pct: ago5 ? round(((p - ago5) / ago5) * 100, 2) : null,
        rsi_14: nullableRound(rsiVal, 1),
        sma_50: nullableRound(sma(closes, 50), 4),
        sma_200: nullableRound(sma(closes, 200), 4),
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
      });
    } catch {
      // skip ticker on fetch error
    }
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

  // ── Path 3: Trend-confirmed momentum (multi-timeframe aligned) ───────
  // Checked first so a stock in a clean uptrend doesn't get rejected just
  // because RSI > 45. Requires the FULL stack PLUS 1h-timeframe alignment
  // (price above 1h SMA50). 1h-data unavailable falls back to 1D-only —
  // we don't punish missing data.
  const rsiInHealthyBand =
    snap.rsi_14 != null && snap.rsi_14 >= 50 && snap.rsi_14 <= 65;
  const intradayAligned =
    snap.rsi_14_1h == null || snap.uptrend_1h; // null = pass; available = require uptrend
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
    return { ok: true, reasons };
  }

  // ── Paths 1 & 2: Dip-buy (existing behaviour) ────────────────────────
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
    `Mål: stretch mot full deployment av bøtte-kapital — men ALDRI bryt blueprint-disiplinen.`,
    `Bedre å sitte 50 % i cash enn å gjøre dårlige kjøp på toppen av en momentum-bevegelse.`,
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
    `- ALDRI BUY for å "fylle bøtta" hvis ingen tickere møter blueprint-kvaliteten.`,
    ``,
    `## Antall picks å returnere`,
    `- ${blueprint.params.maxPositions} picks: når ${blueprint.params.maxPositions}+ tickere møter blueprint-kriteriene (perfekt eller nærmest).`,
    `- 1–${blueprint.params.maxPositions - 1} picks: når kun noen møter standarden.`,
    `- 0 picks: når ingen tickere passer akkurat nå. Cash er beste posisjon i regimet.`,
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
    `## Watchlist-kandidater med live indikatorer`,
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

  // Sector concentration: track sectors already represented (existing kept
  // positions, plus new BUYs as we accept them). Max 1 BUY per sector this
  // scan. Existing kept positions count as "sector taken".
  const sectorTaken = new Set<string>();
  const sellTickerEarly = new Set(
    payload.decisions.filter((d) => d.action === 'SELL').map((d) => d.ticker),
  );
  for (const [ticker] of positionsByTicker) {
    if (sellTickerEarly.has(ticker)) continue;
    const sec = sectorOf(ticker);
    if (sec) sectorTaken.add(sec);
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
  const preflightSectorTaken = new Set(sectorTaken);
  for (const dec of buyDecs) {
    if (fridayBlackout && !isCrypto) continue;
    if (cooldownTickers.has(dec.ticker)) continue;
    const sec = sectorOf(dec.ticker);
    if (sec && preflightSectorTaken.has(sec)) continue;
    const snap = snapshots.get(dec.ticker);
    if (!snap) continue;
    const sig = isAnticipatorySignal(snap);
    if (!sig.ok) continue;
    preApproved += 1;
    if (sec) preflightSectorTaken.add(sec);
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

    // ── Sector concentration cap ─────────────────────────────────────────
    // Max 1 NEW position per sector per scan. If a sector is already taken
    // by a kept position OR an earlier BUY in this loop, skip. Prevents the
    // "3 picks all in semis" scenario where one bad sector day takes the
    // whole bucket. Unknown-sector tickers don't trigger or take a slot.
    const sec = sectorOf(ticker);
    if (sec && sectorTaken.has(sec)) {
      trades.push(
        skipTrade(blueprint.id, ticker, 'BUY', `sector_taken_${sec}`),
      );
      continue;
    }

    // ── Anticipatory signal filter ───────────────────────────────────────
    // Hard reject any Grok BUY where the indicator state doesn't match the
    // dip-buy thesis (uptrend + oversold/near-support + bullish confirmation).
    // This is what stops the engine from buying momentum tops just because
    // Grok ranked them by 5-day return.
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
      volMultiplier = Math.max(0.5, Math.min(1.5, raw));
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
      // Lock the sector so subsequent BUYs in the same scan can't pile in.
      if (sec) sectorTaken.add(sec);
    }
  }

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
 *   peak  5–10 %  → floor at entry × 1.02 (protect break-even + small profit)
 *   peak 10–15 %  → floor at entry × 1.05
 *   peak 15–20 %  → floor at entry × 1.08
 *   peak ≥ 20 %   → floor at entry × 1.12
 *
 * Returns null when peak gain < 5 % (no ratchet yet — ATR-stop still protects).
 */
function trailingStopFloor(entry: number, peakPnlPct: number): number | null {
  if (peakPnlPct < 0.05) return null;
  if (peakPnlPct < 0.10) return entry * 1.02;
  if (peakPnlPct < 0.15) return entry * 1.05;
  if (peakPnlPct < 0.20) return entry * 1.08;
  return entry * 1.12;
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

      const stopPrice = entry - blueprint.params.atrStopMult * atrVal;
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

      let reason: string | null = null;
      if (price <= stopPrice) reason = 'MECHANICAL_ATR_STOP';
      else if (pnlPct >= blueprint.params.profitTakeThreshold) reason = 'MECHANICAL_PROFIT_TAKE';
      else if (trailFloor != null && price < trailFloor) reason = 'MECHANICAL_TRAILING_STOP';

      if (!reason) continue;

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
  killSwitchOn: boolean;
  account: AccountSnapshot;
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
  /** SPY < SMA200 — engine halves position sizes. */
  isBearRegime: boolean;
  /** Friday after 14:30 ET — block new equity BUYs. */
  fridayBlackout: boolean;
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
    killSwitchOn,
    account,
    recentOrders,
    marketClock,
    isBearRegime,
    fridayBlackout,
  } = args;

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
    reason: killSwitchOn ? 'daily_kill_switch' : undefined,
  };

  if (killSwitchOn) return { ...result, deployedNotional: 0 };

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

  // 1. Mechanical safety always runs first.
  const safetyTrades = await mechanicalSafetyPass({
    creds,
    blueprint,
    positionsByTicker,
    inFlightTickers,
    marketIsOpen: marketClock?.is_open ?? false,
  });
  result.trades.push(...safetyTrades);
  // Drop closed positions from local cache so subsequent Grok decisions see fresh state.
  for (const t of safetyTrades) {
    if (t.action === 'SELL' && t.status === 'OK') {
      positionsByTicker.delete(t.ticker);
    }
  }

  // 2. Decide whether to call Grok this tick. Defensive parse of decidedAt:
  // a corrupt DB row with null/invalid timestamp would yield NaN here, and
  // `Date.now() - NaN >= GROK_CADENCE_MS` is false → we'd fall through to
  // shouldCallGrok=true on every single tick, blasting the API quota.
  // Treat unparseable timestamps as "very old" (force one Grok call, then
  // the new row will have a valid timestamp and cadence kicks back in).
  const last = await getLatestDecision(clerkUserId, blueprint.id);
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
  const shouldCallGrok =
    inTradingWindow && (!last || last.failed || ageMs >= GROK_CADENCE_MS);

  if (!shouldCallGrok) {
    result.thesis = last?.thesis ?? undefined;
    if (!inTradingWindow) {
      result.reason = 'outside_trading_hours';
    } else if (last && !last.failed && ageMs < GROK_CADENCE_MS) {
      result.reason = 'within_cadence';
    }
    return { ...result, deployedNotional: 0 };
  }

  // 3. Build context + call Grok.
  const candidates = await buildIndicatorSnapshots(creds, blueprint);
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

  const userPrompt = buildUserPrompt({
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    positions: summarizePositions(allPositions, watchlistSet),
    candidates,
    inFlightTickers: [...inFlightTickers],
    allocationPct,
    account,
    recentOrders,
    marketClock,
  });

  const grokRes = await decide({
    systemPrompt: blueprint.strategy,
    userPrompt,
  });
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

  const payload = grokRes.payload;
  result.thesis = payload.thesis;

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
    usage: grokRes.usage,
    rawResponse: grokRes.raw ?? null,
  });

  return { ...result, deployedNotional: exec.netDeployed };
}

export async function runScanForUser(
  creds: AlpacaCreds,
  clerkUserId: string,
): Promise<UserScanResult> {
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

  // Friday-afternoon equity-BUY blackout (weekend gap risk).
  const fridayBlackout = isFridayBlackout();

  // Account-wide cap on new BUY notional this scan. Notional/fractional
  // orders on Alpaca draw from non-marginable buying power (≈ cash), not
  // margin × 2. Use cash so each blueprint's deployment stays within the
  // pool Alpaca will actually fund. 95 % leaves a small slack so rounding
  // doesn't push the last order over the edge.
  const cash = parseFloat(acctRes.data.cash) || 0;
  let remainingBuyingPower = cash;

  for (const blueprint of BLUEPRINT_LIST) {
    // Hard-disabled blueprints get 0 % bucket capital regardless of the
    // user's saved allocation. The deallocation logic in runBlueprint then
    // liquidates any positions in this bucket and skips Grok entirely.
    const isDisabled = DISABLED_BLUEPRINTS.has(blueprint.id);
    const allocPct = isDisabled ? 0 : allocation[blueprint.id] ?? 0;
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
      killSwitchOn,
      account,
      recentOrders,
      marketClock,
      isBearRegime,
      fridayBlackout,
    });
    remainingBuyingPower = Math.max(0, remainingBuyingPower - result.deployedNotional);
    out.blueprints.push(result);
  }

  return out;
}

export type { GrokDecision } from '@/lib/grok';
