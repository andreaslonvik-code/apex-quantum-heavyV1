// Apex Quantum trading engine — single source of truth for the scan +
// signal-generation + execution loop. Called from three places:
//
//   • app/api/cron/autonomous/route.ts (Vercel cron, production driver)
//   • app/api/apex/autonomous/route.ts (on-demand from dashboard)
//   • inngest/functions/apex-quantum-tick.ts (currently dormant)
//
// Strategy:
//   1. Detect market session — skip if closed.
//   2. Pull preferred-elite ticker set from optimizer (1-hour cached, 30-day
//      risk-adjusted momentum across the 102 universe).
//   3. In regular session, pull overnight gaps from Alpaca daily bars (cached
//      30 min) for GAP_UP / GAP_DOWN signals.
//   4. Scan ALL 102 tickers for BUY signals — DIP / RSI_LOW / GAP_UP. Score
//      each candidate and apply a 1.2× bonus when the ticker is in the
//      optimizer's preferred-elite set.
//   5. Scan held positions for SELL signals — PROFIT / STOPLOSS / RSI_HIGH /
//      PEAK. Risk-management runs at full strength (no learned multipliers).
//   6. Hard caps: max 8 concurrent holdings; max 15 % of equity per ticker.
//      New-ticker BUYs blocked when at the holding cap; tactical adds to
//      existing positions still allowed (subject to per-ticker cap).
//   7. Extended hours (premarket / afterhours): switch to LIMIT orders with
//      extended_hours flag, ±10 bps inside last trade, 0.5× size.
//   8. Each successful BUY records a FIFO lot. Each successful SELL FIFO-
//      closes oldest open lots and attributes realised P&L back to the
//      entry signal — feeds the daily learning loop in /api/cron/learn.

import {
  placeOrder,
  getAccount,
  getClock,
  getPositions,
  getLatestPrice,
  getStockBars,
  type AlpacaBar,
  type AlpacaCreds,
  type AlpacaPosition,
} from './alpaca';
import { WATCHLIST, RISK, SIGNAL, SYMBOL_TO_SECTOR, EXTREME_CONVICTION_TICKERS, EXTREME_CONVICTION_BOOST, trailingDistanceForProfit } from './blueprint';
import { computeEliteTickers } from './portfolio-optimizer';
import { computeTargetWeights, targetDollars } from './elite-allocation';
import {
  closeEntryLots,
  getSignalMultipliers,
  multiplierFor,
  recordEntryLot,
} from './learning';
import { getMarketSession, isExtendedHours, type MarketSession } from './market-session';
import { getOvernightGaps } from './gap-detector';
import {
  buyFactorFromIntel,
  getLatestNewsIntel,
  sectorMultiplierFromIntel,
  tickerEventMultiplierFromIntel,
} from './news-intelligence';
import {
  getVixLevel,
  hasImminentEarnings,
  vixBuyFactor,
} from './market-context';

export const HOLDINGS_CAP = RISK.MAX_POSITIONS;
export const MAX_PER_TICKER_PCT = RISK.MAX_PER_TICKER_PCT;
const EXTENDED_HOURS_SIZE_FACTOR = 0.5;
const ELITE_SCORE_BONUS = 1.2;
const GAP_UP_THRESHOLD = 0.02;
const GAP_DOWN_THRESHOLD = -0.03;

interface PricePoint { price: number; timestamp: number }
const priceHistory: Map<string, PricePoint[]> = new Map();

// 14-day daily-bars cache for ATR computation. Refreshed at most hourly so
// each held ticker triggers at most one bars request per hour. Survives
// across cron invocations on a warm lambda; cold starts repopulate.
const atrBarsCache: Map<string, { ts: number; atr: number }> = new Map();
const ATR_CACHE_TTL_MS = 60 * 60 * 1000;

function computeATR(bars: AlpacaBar[], period: number): number {
  if (bars.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c),
    );
    trs.push(tr);
  }
  const window = trs.slice(-period);
  return window.reduce((s, v) => s + v, 0) / window.length;
}

async function getCachedATR(creds: AlpacaCreds, ticker: string, period: number): Promise<number> {
  const key = ticker.toUpperCase();
  const cached = atrBarsCache.get(key);
  if (cached && Date.now() - cached.ts < ATR_CACHE_TTL_MS) return cached.atr;
  const r = await getStockBars(creds, ticker, { timeframe: '1Day', limit: period + 5 });
  if (!r.success) return 0;
  const atr = computeATR(r.data, period);
  atrBarsCache.set(key, { ts: Date.now(), atr });
  return atr;
}

// Per-position high-water-mark tracker for the trailing stop. Keyed by
// `${clerkUserId}:${ticker}` so multi-user accounts don't bleed into each
// other. Module-level Map — survives across cron invocations on warm
// lambdas, resets on cold start. Cold-start risk is "stop is too loose
// briefly" not "stop fires too eagerly", so it fails safe.
interface HwmEntry { hwm: number; updatedAt: number }
const highWaterMarks: Map<string, HwmEntry> = new Map();
const HWM_TTL_MS = 24 * 60 * 60 * 1000;

// Per-(user, ticker) first-seen timestamp. Used to gate NON_ELITE_EXIT
// so newly opened positions get a fair window to move before being
// forcibly rotated out at a small loss. Module-level so warm lambdas
// reuse it; cold-start failure mode is "exit window resets, position
// might exit a few minutes earlier than ideal" — safe.
const positionFirstSeen: Map<string, number> = new Map();
const NON_ELITE_MIN_HOLD_MS = 30 * 60 * 1000;
const NON_ELITE_PROTECT_PLPC = -0.003; // skip exit if loss > 0.3 %

function firstSeenKey(clerkUserId: string, ticker: string): string {
  return `${clerkUserId}:${ticker.toUpperCase()}`;
}

// Per-(user, ticker) re-entry cooldown after a STOPLOSS fires. Prevents
// the whipsaw loop where a stop-out is followed by a fresh BUY a few
// minutes later, which gets stopped out again. 60 min gives the price
// time to settle into either a continuation or reversal pattern.
const stoplossCooldown: Map<string, number> = new Map();
const STOPLOSS_COOLDOWN_MS = 60 * 60 * 1000;

function inStoplossCooldown(clerkUserId: string, ticker: string): boolean {
  const ts = stoplossCooldown.get(firstSeenKey(clerkUserId, ticker));
  if (!ts) return false;
  return Date.now() - ts < STOPLOSS_COOLDOWN_MS;
}

function recordStoploss(clerkUserId: string, ticker: string): void {
  stoplossCooldown.set(firstSeenKey(clerkUserId, ticker), Date.now());
}

// Sector-bias hard veto threshold. When the news scanner reports a
// sectorBias more bearish than this, no new BUYs in that sector regardless
// of what the AI elite selector picked. Catches the case where Sharpe
// momentum is high but a sector-wide shock is breaking.
const SECTOR_VETO_BIAS = -0.4;

function hwmKey(clerkUserId: string, ticker: string): string {
  return `${clerkUserId}:${ticker.toUpperCase()}`;
}

function trackHighWaterMark(clerkUserId: string, ticker: string, currentPrice: number): number {
  const key = hwmKey(clerkUserId, ticker);
  const now = Date.now();
  const cached = highWaterMarks.get(key);
  if (cached && now - cached.updatedAt < HWM_TTL_MS) {
    if (currentPrice > cached.hwm) cached.hwm = currentPrice;
    cached.updatedAt = now;
    return cached.hwm;
  }
  highWaterMarks.set(key, { hwm: currentPrice, updatedAt: now });
  return currentPrice;
}

function clearHighWaterMark(clerkUserId: string, ticker: string): void {
  highWaterMarks.delete(hwmKey(clerkUserId, ticker));
}

function calculateRSI(prices: PricePoint[]): number {
  if (prices.length < 5) return 50;
  const recent = prices.slice(-15);
  let gains = 0, losses = 0, count = 0;
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].price - recent[i - 1].price;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
    count++;
  }
  if (count === 0) return 50;
  const avgGain = gains / count;
  const avgLoss = losses / count;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function analyzeMomentum(ticker: string, currentPrice: number) {
  const history = priceHistory.get(ticker) || [];
  const now = Date.now();
  history.push({ price: currentPrice, timestamp: now });
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const recent = history.filter((p) => p.timestamp > fifteenMinAgo);
  priceHistory.set(ticker, recent);
  if (recent.length < 3) {
    return { rsi: 50, localHigh: currentPrice, localLow: currentPrice, trend: 'NEUTRAL' as const };
  }
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMin = recent.filter((p) => p.timestamp > fiveMinAgo);
  const localHigh = Math.max(...fiveMin.map((p) => p.price));
  const localLow = Math.min(...fiveMin.map((p) => p.price));
  const avgRecent = fiveMin.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMin.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMin.length);
  const trend: 'UP' | 'DOWN' | 'NEUTRAL' =
    avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  return { rsi: calculateRSI(recent), localHigh, localLow, trend };
}

interface BuyCandidate {
  ticker: string;
  amount: number;
  price: number;
  reason: string;
  score: number;
  signalType: string;
}

interface SellSignal {
  ticker: string;
  amount: number;
  price: number;
  reason: string;
  priority: number;
  signalType: string;
}

export interface ExecutedTrade {
  ticker: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  value: number;
  orderId?: string;
  status: 'OK' | 'FEIL';
  reason: string;
}

export interface ScanResult {
  session: MarketSession;
  marketOpen: boolean;
  elite: { tickers: string[]; source: 'ai' | 'sharpe-fallback' };
  cash: number;
  equity: number;
  positions: AlpacaPosition[];
  buyCandidates: BuyCandidate[];
  sellSignals: SellSignal[];
  acceptedBuys: BuyCandidate[];
  acceptedSells: SellSignal[];
  executedTrades: ExecutedTrade[];
  totalBought: number;
  totalSold: number;
  errors: string[];
}

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

interface RunScanInput {
  creds: AlpacaCreds;
  clerkUserId: string;
  startBalance: number;
}

export async function runScanForUser(input: RunScanInput): Promise<ScanResult> {
  const { creds, clerkUserId, startBalance } = input;
  const result: ScanResult = {
    session: 'closed',
    marketOpen: false,
    elite: { tickers: [], source: 'sharpe-fallback' },
    cash: 0,
    equity: 0,
    positions: [],
    buyCandidates: [],
    sellSignals: [],
    acceptedBuys: [],
    acceptedSells: [],
    executedTrades: [],
    totalBought: 0,
    totalSold: 0,
    errors: [],
  };

  const accountResult = await getAccount(creds);
  if (!accountResult.success) {
    result.errors.push(`Account fetch failed: ${accountResult.error}`);
    return result;
  }
  const account = accountResult.data;
  const cash = parseFloat(account.cash) || 0;
  const equity = parseFloat(account.equity) || parseFloat(account.portfolio_value) || startBalance;
  result.cash = cash;
  result.equity = equity;

  // Daily kill switch — halt for the day at -3 % vs starting capital.
  const initialValue = startBalance || equity;
  const dailyPnl = initialValue > 0 ? equity / initialValue - 1 : 0;
  if (dailyPnl <= RISK.DAILY_LOSS_LIMIT) {
    result.errors.push(`Daglig tapsgrense nådd (${(dailyPnl * 100).toFixed(2)}%)`);
    return result;
  }

  const clockResult = await getClock(creds);
  const clock = clockResult.success ? clockResult.data : null;
  const session = getMarketSession(clock);
  result.session = session;
  result.marketOpen = clock?.is_open ?? false;
  if (session === 'closed') return result;

  const positionsResult = await getPositions(creds);
  const positionsByTicker = new Map<string, AlpacaPosition>();
  if (positionsResult.success) {
    for (const p of positionsResult.data) positionsByTicker.set(p.symbol.toUpperCase(), p);
  }
  result.positions = Array.from(positionsByTicker.values());
  const heldCount = positionsByTicker.size;
  const heldTickers = new Set(positionsByTicker.keys());

  const eliteResult = await computeEliteTickers(creds);
  result.elite = { tickers: Array.from(eliteResult.tickers), source: eliteResult.source };
  const eliteSet = eliteResult.tickers;

  const gapsByTicker =
    session === 'regular' ? await getOvernightGaps(creds) : new Map();

  const multipliers = await getSignalMultipliers();
  const newsIntel = await getLatestNewsIntel();
  const newsBuyFactor = buyFactorFromIntel(newsIntel);

  // Market-context layer: VIX-aware sizing + earnings veto.
  // VIX scales every BUY uniformly. Earnings is per-ticker — pre-fetched
  // in parallel for elite tickers + held tickers (the only ones with
  // realistic BUY paths) so the per-ticker loop below stays synchronous.
  const vixLevel = await getVixLevel();
  const vixFactor = vixBuyFactor(vixLevel);
  const earningsBlockSet = new Set<string>();
  await runInChunks(
    Array.from(new Set([...eliteSet, ...positionsByTicker.keys()])),
    8,
    async (ticker) => {
      if (await hasImminentEarnings(ticker)) earningsBlockSet.add(ticker);
    },
  );

  const priceTargets = new Set<string>([
    ...WATCHLIST,
    ...positionsByTicker.keys(),
  ]);
  const priceByTicker = new Map<string, number>();
  await runInChunks(Array.from(priceTargets), RISK.PRICE_FETCH_CONCURRENCY, async (ticker) => {
    const r = await getLatestPrice(creds, ticker);
    if (r.success && r.data > 0) priceByTicker.set(ticker, r.data);
  });

  // Pre-fetch ATR for every held position in parallel — used by the
  // adaptive stop loss below. Cached 1 hour, so usually 0 API calls per
  // scan once warm.
  const atrByTicker = new Map<string, number>();
  await runInChunks(Array.from(positionsByTicker.keys()), 8, async (ticker) => {
    const atr = await getCachedATR(creds, ticker, SIGNAL.ATR_PERIOD);
    if (atr > 0) atrByTicker.set(ticker.toUpperCase(), atr);
  });

  const buyTrendBoost = (trend: 'UP' | 'DOWN' | 'NEUTRAL') => trend === 'UP' ? 1.25 : trend === 'DOWN' ? 0.7 : 1.0;
  const sellTrendBoost = (trend: 'UP' | 'DOWN' | 'NEUTRAL') => trend === 'DOWN' ? 1.3 : trend === 'UP' ? 0.85 : 1.0;
  const sessionSizeFactor = isExtendedHours(session) ? EXTENDED_HOURS_SIZE_FACTOR : 1.0;

  // ── News-aware exit ───────────────────────────────────────────────────
  // When the news scanner flags a strong-conviction bearish event on a
  // held ticker, exit the full position immediately rather than waiting
  // for ATR / trailing to react after the price has moved. Catalysts
  // (earnings miss, regulator action, contract loss) gap the stock 5-20 %
  // before our reactive stops would catch them.
  if (newsIntel) {
    for (const ev of newsIntel.tickerEvents) {
      if (ev.direction !== 'bearish') continue;
      if (ev.weight < 0.5) continue;
      const ticker = ev.ticker.toUpperCase();
      const pos = positionsByTicker.get(ticker);
      if (!pos) continue;
      const qty = Math.abs(parseFloat(pos.qty) || 0);
      if (qty < 1) continue;
      const price = priceByTicker.get(ticker);
      if (!price) continue;
      result.sellSignals.push({
        ticker, amount: Math.floor(qty), price,
        reason: `NEWS_EXIT bearish ${ev.source}/${(ev.weight * 100).toFixed(0)}% — ${ev.reason.slice(0, 60)}`,
        priority: 85, signalType: 'NEWS_EXIT',
      });
    }
  }

  // ── SELL signals on held positions ────────────────────────────────────
  for (const [sym, pos] of positionsByTicker) {
    const price = priceByTicker.get(sym);
    if (!price) continue;
    const m = analyzeMomentum(sym, price);
    const qty = Math.abs(parseFloat(pos.qty) || 0);
    const avg = parseFloat(pos.avg_entry_price) || 0;
    if (qty < 1) continue;

    const sellMul = sellTrendBoost(m.trend);

    if (avg > 0) {
      const profitPct = (price - avg) / avg;
      const atr = atrByTicker.get(sym) ?? 0;
      const hwm = trackHighWaterMark(clerkUserId, sym, price);

      // Adaptive base stop. ATR-derived stop adapts to per-ticker
      // volatility (TSLA gets a wider stop than XOM at the same equity).
      // Falls back to the static -2 % floor when ATR data unavailable.
      const staticStopLevel = avg * (1 + SIGNAL.STOP_LOSS_THRESHOLD);
      const atrStopLevel = atr > 0 ? avg - SIGNAL.ATR_STOP_MULT * atr : staticStopLevel;
      // Take the LESS punishing of the two (further from current price)
      // so an extreme-vol name doesn't get squeezed by the static floor.
      const baseStopLevel = Math.min(staticStopLevel, atrStopLevel);

      // Trailing stop activates after the position has run > trigger.
      // The distance tightens as profit grows (profit-ratchet) so more of
      // each additional % gets locked in. See trailingDistanceForProfit.
      const trailingActive = profitPct >= SIGNAL.TRAILING_PROFIT_TRIGGER;
      const trailingDistance = trailingDistanceForProfit(profitPct);
      const trailingStopLevel = trailingActive
        ? hwm * (1 - trailingDistance)
        : 0;

      // Breakeven floor: once HWM has been ≥ 5 % above entry, we won't
      // let the position go negative again. Closes the "give back all
      // gains in choppy market" weakness — small wins still won't fall
      // back to losses. Tiny offset (entry × 1.001) keeps us above
      // entry after spread on exit.
      const breakevenReached = hwm >= avg * 1.05;
      const breakevenStopLevel = breakevenReached ? avg * 1.001 : 0;

      // Effective stop = whichever is HIGHER (closer to current price for a
      // long). Trailing dominates once profits are locked in; breakeven
      // floor activates after the position has been at +5 % to prevent
      // a winner from giving back to a loser.
      const effectiveStop = Math.max(baseStopLevel, trailingStopLevel, breakevenStopLevel);

      if (price <= effectiveStop) {
        let reason: string;
        let signalType: string;
        if (trailingActive && trailingStopLevel >= Math.max(baseStopLevel, breakevenStopLevel)) {
          const drawdownFromHwm = ((hwm - price) / hwm) * 100;
          reason = `TRAILING −${drawdownFromHwm.toFixed(2)}% from $${hwm.toFixed(2)} ` +
            `(ratchet ${(trailingDistance * 100).toFixed(0)}% trail at +${(profitPct * 100).toFixed(1)}%, locked)`;
          signalType = 'TRAILING';
        } else if (breakevenReached && breakevenStopLevel >= baseStopLevel) {
          reason = `BREAKEVEN_FLOOR — protecting prior +${((hwm / avg - 1) * 100).toFixed(1)}% peak`;
          signalType = 'BREAKEVEN';
        } else if (atr > 0 && atrStopLevel < staticStopLevel) {
          const stopPct = ((avg - price) / avg) * 100;
          reason = `ATR_STOP −${stopPct.toFixed(2)}% (ATR ${atr.toFixed(2)}, ${SIGNAL.ATR_STOP_MULT}×)`;
          signalType = 'STOPLOSS';
        } else {
          reason = `STOPLOSS ${(profitPct * 100).toFixed(2)}%`;
          signalType = 'STOPLOSS';
        }
        result.sellSignals.push({
          ticker: sym, amount: Math.max(1, Math.floor(qty * 0.5)), price,
          reason, priority: 95, signalType,
        });
      } else if (profitPct >= SIGNAL.PROFIT_TAKE_THRESHOLD) {
        // PROFIT-trim at +3 % — small slice off the top to bank some gain.
        // Trailing handles the give-back protection on the rest.
        result.sellSignals.push({
          ticker: sym, amount: Math.max(1, Math.floor(qty * 0.25)), price,
          reason: `PROFIT +${(profitPct * 100).toFixed(2)}%`,
          priority: 60, signalType: 'PROFIT',
        });
      }
    }

    if (m.rsi > SIGNAL.RSI_OVERBOUGHT && qty > 3) {
      result.sellSignals.push({
        ticker: sym, amount: Math.floor(qty * 0.15 * sellMul), price,
        reason: `RSI HIGH (${m.rsi.toFixed(0)})`,
        priority: 40, signalType: 'RSI_HIGH',
      });
    }
    const riseFromLow = m.localLow > 0 ? (price - m.localLow) / m.localLow : 0;
    if (riseFromLow >= SIGNAL.PEAK_THRESHOLD && qty > 2) {
      const peakStrength = Math.min(5, riseFromLow / SIGNAL.PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(qty * 0.3, qty * 0.05 * peakStrength * sellMul));
      if (sellSize > 0) {
        result.sellSignals.push({
          ticker: sym, amount: sellSize, price,
          reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          priority: 50, signalType: 'PEAK',
        });
      }
    }
  }

  // ── Target-allocation rebalance pass ─────────────────────────────────
  // Drives positions toward the elite slate's tier-cap weights. Emits
  // BUYs to close underweight gaps and TRIM-SELLs when a winner runs
  // past its overweight threshold. These signals get score 1000+ so they
  // outrank any signal-based candidate in the BUY ordering below.
  const targets = computeTargetWeights(eliteResult.picks);
  const targetByTicker = targetDollars(targets, equity);
  const eliteTargetSet = new Set(targets.map((t) => t.ticker));

  console.log(
    `[REBALANCE] ${clerkUserId} session=${session} equity=$${equity.toFixed(0)} cash=$${cash.toFixed(0)} ` +
    `picks=${eliteResult.picks.length} targets=${targets.length} ` +
    `[${targets.map((t) => `${t.ticker}:${(t.weight * 100).toFixed(1)}%(${t.score.toFixed(1)})`).join(', ')}]`
  );

  // Stamp first-seen for any position we haven't tracked yet. Lets the
  // hold-time gate below give every new entry a fair window.
  const tickNow = Date.now();
  for (const sym of positionsByTicker.keys()) {
    const k = firstSeenKey(clerkUserId, sym);
    if (!positionFirstSeen.has(k)) positionFirstSeen.set(k, tickNow);
  }
  // Clean up stamps for tickers we no longer hold.
  for (const k of positionFirstSeen.keys()) {
    if (!k.startsWith(`${clerkUserId}:`)) continue;
    const sym = k.slice(clerkUserId.length + 1);
    if (!positionsByTicker.has(sym)) positionFirstSeen.delete(k);
  }

  // Force-exit positions that aren't in the elite slate. Frees both the
  // HOLDINGS_CAP slot and the cash for elite picks to fill. Priority 70
  // sits below STOPLOSS (100) and TRAILING (90) — those should still win
  // when they fire — but above regular profit-take (~20-50).
  //
  // Two gates protect against the "buy-DIP-then-exit-at-loss" churn:
  //   1. Hold-time: skip exit unless held for at least 30 min — gives
  //      a fair window to move before rotating out.
  //   2. P/L: skip exit if currently down > 0.3 % — let the position
  //      come back rather than crystallising the loss.
  // Either-or: BOTH must clear (held ≥ 30 min AND P/L ≥ -0.3 %) for the
  // exit to fire. STOPLOSS / TRAILING / RSI_HIGH still rotate out
  // independently when their own thresholds are hit.
  let forceExitCount = 0;
  let nonEliteSkipped = { tooNew: 0, tooNegative: 0 };
  for (const [sym, pos] of positionsByTicker) {
    if (eliteTargetSet.has(sym)) continue;
    const qty = Math.abs(parseFloat(pos.qty) || 0);
    if (qty < 1) continue;
    const price = priceByTicker.get(sym);
    if (!price) continue;

    const ageMs = tickNow - (positionFirstSeen.get(firstSeenKey(clerkUserId, sym)) ?? tickNow);
    if (ageMs < NON_ELITE_MIN_HOLD_MS) {
      nonEliteSkipped.tooNew++;
      continue;
    }
    const plpc = parseFloat(pos.unrealized_plpc) || 0;
    if (plpc < NON_ELITE_PROTECT_PLPC) {
      nonEliteSkipped.tooNegative++;
      continue;
    }

    result.sellSignals.push({
      ticker: sym, amount: Math.floor(qty), price,
      reason: `EXIT non-elite (held ${Math.round(ageMs / 60000)}min, P/L ${(plpc * 100).toFixed(2)}%)`,
      priority: 70, signalType: 'NON_ELITE_EXIT',
    });
    forceExitCount++;
  }
  if (forceExitCount > 0 || nonEliteSkipped.tooNew > 0 || nonEliteSkipped.tooNegative > 0) {
    console.log(
      `[REBALANCE] ${clerkUserId} force-exit ${forceExitCount} ` +
      `(skipped tooNew=${nonEliteSkipped.tooNew} tooNegative=${nonEliteSkipped.tooNegative})`
    );
  }
  let rebalanceBuyCount = 0;
  let rebalanceTrimCount = 0;
  let rebalanceSkipReason = { noPrice: 0, earningsVeto: 0, newsVeto: 0, atTarget: 0, amountTooSmall: 0 };
  for (const t of targets) {
    const ticker = t.ticker;
    const price = priceByTicker.get(ticker);
    if (!price) { rebalanceSkipReason.noPrice++; continue; }
    const pos = positionsByTicker.get(ticker);
    const posValue = pos ? Math.abs(parseFloat(pos.market_value) || 0) : 0;
    const targetValue = targetByTicker.get(ticker) ?? 0;
    if (targetValue <= 0) continue;

    // Trim if running well past target (lock in gains, free cash for
    // names that drifted underweight).
    if (
      posValue > targetValue * RISK.REBALANCE_OVERWEIGHT &&
      pos &&
      parseFloat(pos.qty) >= 1
    ) {
      const trimDollars = (posValue - targetValue) * RISK.REBALANCE_CONVERGENCE;
      const trimQty = Math.floor(trimDollars / price);
      if (trimQty >= 1) {
        result.sellSignals.push({
          ticker, amount: trimQty, price,
          reason: `TRIM toward ${(t.weight * 100).toFixed(1)}% target (rank ${t.rank}, score ${t.score.toFixed(1)})`,
          priority: 60, signalType: 'REBALANCE_TRIM',
        });
        rebalanceTrimCount++;
      }
      continue;
    }

    // Skip BUYs when an event vetoes this ticker.
    if (earningsBlockSet.has(ticker)) { rebalanceSkipReason.earningsVeto++; continue; }
    if (inStoplossCooldown(clerkUserId, ticker)) {
      rebalanceSkipReason.newsVeto++; // reuse counter; logging only
      continue;
    }
    const sectorKey = SYMBOL_TO_SECTOR[ticker];
    const newsSectorMul = sectorMultiplierFromIntel(newsIntel, sectorKey);
    const newsTickerMul = tickerEventMultiplierFromIntel(newsIntel, ticker);
    if (newsTickerMul <= 0.05) { rebalanceSkipReason.newsVeto++; continue; }
    // Hard sector veto: if the news scanner flags a sector-wide bearish
    // signal, refuse to add to that sector regardless of per-ticker
    // momentum. Closes the "AI picks AMD on Sharpe but semis is breaking"
    // case.
    if (sectorKey && newsIntel) {
      const sectorBias = newsIntel.sectorBias[sectorKey] ?? 0;
      if (sectorBias <= SECTOR_VETO_BIAS) {
        rebalanceSkipReason.newsVeto++;
        continue;
      }
    }

    if (posValue < targetValue * RISK.REBALANCE_UNDERWEIGHT) {
      const gap = targetValue - posValue;
      // Apply the same risk multipliers the signal-based pass uses, so
      // the rebalance respects VIX regime, news bias, and extended-hours
      // sizing. We DO NOT scale by news/VIX < 1 below 0.5 — rebalance is
      // strategic; we still want to deploy in moderate risk-off, just
      // smaller bites per tick.
      const composite = Math.max(
        0.5,
        sessionSizeFactor * vixFactor * newsBuyFactor * newsSectorMul * newsTickerMul,
      );
      const buyDollars = gap * RISK.REBALANCE_CONVERGENCE * composite;
      const tickerCapValue = equity * (MAX_PER_TICKER_PCT / 100);
      const headroom = tickerCapValue - posValue;
      const cappedDollars = Math.min(buyDollars, headroom);
      const amount = Math.floor(cappedDollars / price);
      if (amount >= 1) {
        result.buyCandidates.push({
          ticker, amount, price,
          reason: `REBALANCE → ${(t.weight * 100).toFixed(1)}% target (rank ${t.rank}, score ${t.score.toFixed(1)})`,
          score: 1000 + (t.score * 10) + (10 - t.rank), // dominates signal-based scores
          signalType: 'REBALANCE_BUY',
        });
        rebalanceBuyCount++;
      } else {
        rebalanceSkipReason.amountTooSmall++;
      }
    } else {
      rebalanceSkipReason.atTarget++;
    }
  }
  console.log(
    `[REBALANCE] ${clerkUserId} buy=${rebalanceBuyCount} trim=${rebalanceTrimCount} ` +
    `skip noPrice=${rebalanceSkipReason.noPrice} earningsVeto=${rebalanceSkipReason.earningsVeto} ` +
    `newsVeto=${rebalanceSkipReason.newsVeto} atTarget=${rebalanceSkipReason.atTarget} ` +
    `amountTooSmall=${rebalanceSkipReason.amountTooSmall}`
  );

  // ── BUY signals across the full 102 universe ─────────────────────────
  for (const ticker of WATCHLIST) {
    const price = priceByTicker.get(ticker);
    if (!price) continue;
    const m = analyzeMomentum(ticker, price);

    const pos = positionsByTicker.get(ticker.toUpperCase());
    const posValue = pos ? Math.abs(parseFloat(pos.market_value) || 0) : 0;

    const tickerCapValue = equity * (MAX_PER_TICKER_PCT / 100);
    if (posValue >= tickerCapValue) continue;

    const dropFromHigh = m.localHigh > 0 ? (m.localHigh - price) / m.localHigh : 0;
    const buyMul = buyTrendBoost(m.trend);
    const eliteBonus = eliteSet.has(ticker) ? ELITE_SCORE_BONUS : 1.0;
    // Asymmetric-upside conviction names get a size boost on every signal.
    const convictionBoost = EXTREME_CONVICTION_TICKERS.has(ticker)
      ? EXTREME_CONVICTION_BOOST : 1.0;

    // Earnings veto: never enter a new BUY on a ticker reporting earnings
    // in the next 24 h. Pre-market gap on bad print bypasses our STOPLOSS
    // entirely — this is binary risk we don't want to take.
    if (earningsBlockSet.has(ticker)) continue;

    // Re-entry cooldown after a stop-out — prevents whipsaw.
    if (inStoplossCooldown(clerkUserId, ticker)) continue;

    // News-driven multipliers (1.0 when no intel / low confidence).
    const sectorKey = SYMBOL_TO_SECTOR[ticker];
    const newsSectorMul = sectorMultiplierFromIntel(newsIntel, sectorKey);
    const newsTickerMul = tickerEventMultiplierFromIntel(newsIntel, ticker);
    // tickerEventMultiplier returns 0 when bearish events are strong enough
    // to neutralise the buy — treat as a hard veto on this ticker.
    if (newsTickerMul <= 0.05) continue;
    // Hard sector veto on strongly bearish sector bias.
    if (sectorKey && newsIntel) {
      const sectorBias = newsIntel.sectorBias[sectorKey] ?? 0;
      if (sectorBias <= SECTOR_VETO_BIAS) continue;
    }

    // Combined buy multiplier: news regime × sector tilt × per-ticker event
    // × VIX regime. VIX is global so it scales every BUY uniformly.
    const newsBuyMul = newsBuyFactor * newsSectorMul * newsTickerMul * vixFactor;

    const gap = gapsByTicker.get(ticker)?.gap;
    if (gap !== undefined && gap < GAP_DOWN_THRESHOLD) continue;

    if (
      session === 'regular' &&
      gap !== undefined &&
      gap > GAP_UP_THRESHOLD &&
      m.trend !== 'DOWN'
    ) {
      const gapStrength = Math.min(5, gap / GAP_UP_THRESHOLD);
      const buyValue =
        equity * 0.01 * gapStrength * buyMul * eliteBonus * convictionBoost *
        sessionSizeFactor * newsBuyMul *
        multiplierFor('GAP_UP', multipliers);
      const cappedValue = Math.min(buyValue, tickerCapValue - posValue);
      const amount = Math.floor(cappedValue / price);
      if (amount >= 1) {
        result.buyCandidates.push({
          ticker, amount, price,
          reason: `GAP_UP +${(gap * 100).toFixed(2)}%`,
          score: 30 * gapStrength * buyMul * eliteBonus * newsTickerMul,
          signalType: 'GAP_UP',
        });
      }
    }

    if (dropFromHigh >= SIGNAL.DIP_THRESHOLD && m.trend !== 'DOWN') {
      const dipStrength = Math.min(5, dropFromHigh / SIGNAL.DIP_THRESHOLD);
      const buyValue =
        equity * 0.005 * dipStrength * buyMul * eliteBonus * convictionBoost *
        sessionSizeFactor * newsBuyMul *
        multiplierFor('DIP', multipliers);
      const cappedValue = Math.min(buyValue, tickerCapValue - posValue);
      const amount = Math.floor(cappedValue / price);
      if (amount >= 1) {
        result.buyCandidates.push({
          ticker, amount, price,
          reason: `DIP -${(dropFromHigh * 100).toFixed(2)}%`,
          score: 20 * dipStrength * buyMul * eliteBonus * newsTickerMul,
          signalType: 'DIP',
        });
      }
    }

    if (m.rsi < SIGNAL.RSI_OVERSOLD && m.trend !== 'DOWN') {
      const oversoldDepth = SIGNAL.RSI_OVERSOLD - m.rsi;
      const buyValue =
        equity * 0.01 * buyMul * eliteBonus * convictionBoost *
        sessionSizeFactor * newsBuyMul *
        multiplierFor('RSI_LOW', multipliers);
      const cappedValue = Math.min(buyValue, tickerCapValue - posValue);
      const amount = Math.floor(cappedValue / price);
      if (amount >= 1) {
        result.buyCandidates.push({
          ticker, amount, price,
          reason: `RSI LOW (${m.rsi.toFixed(0)})`,
          score: 15 * oversoldDepth * buyMul * eliteBonus * newsTickerMul,
          signalType: 'RSI_LOW',
        });
      }
    }
  }

  // ── CATALYST signal — Grok-flagged bullish events on conviction names ─
  // Fires when news intel surfaces a strong-conviction bullish event
  // (weight ≥ 0.6) on one of the asymmetric-upside tickers — e.g. HELP
  // phase-3 readout, IONQ quantum announcement, RKLB DARPA contract.
  // Sized at 4 % of equity per event before multipliers, on top of any
  // DIP/RSI signal that may also fire for the same name (dedup keeps
  // highest-scoring candidate).
  if (newsIntel) {
    for (const ev of newsIntel.tickerEvents) {
      const ticker = ev.ticker.toUpperCase();
      if (!EXTREME_CONVICTION_TICKERS.has(ticker)) continue;
      if (ev.direction !== 'bullish') continue;
      if (ev.weight < 0.6) continue;
      const price = priceByTicker.get(ticker);
      if (!price) continue;
      if (earningsBlockSet.has(ticker)) continue;

      const pos = positionsByTicker.get(ticker);
      const posValue = pos ? Math.abs(parseFloat(pos.market_value) || 0) : 0;
      const tickerCapValue = equity * (MAX_PER_TICKER_PCT / 100);
      const headroom = tickerCapValue - posValue;
      if (headroom <= 0) continue;

      const buyValue = equity * 0.04 * ev.weight * sessionSizeFactor * vixFactor;
      const cappedValue = Math.min(buyValue, headroom);
      const amount = Math.floor(cappedValue / price);
      if (amount >= 1) {
        result.buyCandidates.push({
          ticker, amount, price,
          reason: `CATALYST ${ev.source}/${(ev.weight * 100).toFixed(0)}% — ${ev.reason.slice(0, 80)}`,
          score: 80 * ev.weight, // higher than typical signal scores
          signalType: 'CATALYST',
        });
      }
    }
  }

  // ── Dedupe by ticker (rebalance + signal can both fire on same name) ─
  // Sort by score desc, then keep only the first candidate per ticker.
  result.buyCandidates.sort((a, b) => b.score - a.score);
  const seenTickers = new Set<string>();
  const dedupedBuys: BuyCandidate[] = [];
  for (const c of result.buyCandidates) {
    const key = c.ticker.toUpperCase();
    if (seenTickers.has(key)) continue;
    seenTickers.add(key);
    dedupedBuys.push(c);
  }
  result.buyCandidates = dedupedBuys;

  // ── Apply HOLDINGS_CAP ────────────────────────────────────────────────
  let freshSlots = Math.max(0, HOLDINGS_CAP - heldCount);
  for (const c of result.buyCandidates) {
    if (heldTickers.has(c.ticker)) {
      result.acceptedBuys.push(c);
    } else if (freshSlots > 0) {
      result.acceptedBuys.push(c);
      freshSlots--;
    }
  }

  result.sellSignals.sort((a, b) => b.priority - a.priority);
  result.acceptedSells = result.sellSignals.slice(0, RISK.MAX_TRADES_PER_SCAN);

  // ── Execute ───────────────────────────────────────────────────────────
  let runningCash = cash;
  let tradesThisScan = 0;
  const maxTrades = RISK.MAX_TRADES_PER_SCAN;
  const useExtendedHours = isExtendedHours(session);

  // CRITICAL: track remaining sellable qty per ticker. Without this,
  // multiple SELL signals (TRIM + STOPLOSS + NON_ELITE_EXIT + REBALANCE_TRIM
  // + NEWS_EXIT) on the same ticker each see the original qty, each
  // submits a full SELL, and Alpaca margin-paper accepts the excess by
  // SHORTING the stock. That's the bug that opened the $300k short book.
  // Decrement after every fill; refuse to sell beyond what we hold.
  const remainingSellable = new Map<string, number>();
  for (const [sym, pos] of positionsByTicker) {
    const qty = parseFloat(pos.qty) || 0;
    // Only LONG positions are sellable. Short positions need BUY-to-cover,
    // not SELL — never let the engine extend an existing short.
    if (pos.side === 'long' && qty > 0) {
      remainingSellable.set(sym.toUpperCase(), qty);
    } else {
      remainingSellable.set(sym.toUpperCase(), 0);
    }
  }

  for (const sig of result.acceptedSells) {
    if (tradesThisScan >= maxTrades) break;
    const tickerKey = sig.ticker.toUpperCase();
    const pos = positionsByTicker.get(tickerKey);
    const have = remainingSellable.get(tickerKey) ?? 0;

    // Three guards. Any one of these prevents accidental shorting.
    if (!pos) continue;
    if (pos.side !== 'long') {
      result.errors.push(`SELL ${sig.ticker} blocked: position side=${pos.side}`);
      continue;
    }
    if (have < 1) {
      // Already fully sold by an earlier signal in this same scan.
      continue;
    }

    const amount = Math.min(sig.amount, Math.floor(have));
    if (amount < 1) continue;
    const tradeValue = amount * sig.price;

    const orderReq = useExtendedHours
      ? {
          symbol: sig.ticker, qty: amount, side: 'sell' as const,
          type: 'limit' as const, time_in_force: 'day' as const,
          limit_price: +(sig.price * 0.999).toFixed(2),
          extended_hours: true,
          position_intent: 'sell_to_close' as const,
        }
      : {
          symbol: sig.ticker, qty: amount, side: 'sell' as const,
          type: 'market' as const, time_in_force: 'day' as const,
          position_intent: 'sell_to_close' as const,
        };
    const r = await placeOrder(creds, orderReq);
    if (r.success) {
      result.totalSold += tradeValue;
      runningCash += tradeValue;
      tradesThisScan++;
      // Decrement remaining sellable so the next SELL signal for this
      // same ticker sees the reduced qty and can't oversell.
      remainingSellable.set(tickerKey, have - amount);
      // Stamp re-entry cooldown when the exit was a stop — protects
      // against whipsaw in the BUY pass below and on subsequent ticks.
      if (sig.signalType === 'STOPLOSS' || sig.signalType === 'TRAILING' || sig.signalType === 'BREAKEVEN') {
        recordStoploss(clerkUserId, sig.ticker);
      }
      result.executedTrades.push({
        ticker: sig.ticker, symbol: sig.ticker, action: 'SELL',
        amount, price: sig.price, value: tradeValue,
        orderId: r.data.id, status: 'OK', reason: sig.reason,
      });
      await closeEntryLots({
        clerkUserId,
        ticker: sig.ticker,
        qty: amount,
        exitPrice: sig.price,
        exitSignalType: sig.signalType,
      });
    } else {
      result.errors.push(`SELL ${sig.ticker}: ${r.error}`);
      result.executedTrades.push({
        ticker: sig.ticker, symbol: sig.ticker, action: 'SELL',
        amount, price: sig.price, value: tradeValue,
        status: 'FEIL', reason: r.error,
      });
    }
  }

  for (const sig of result.acceptedBuys) {
    if (tradesThisScan >= maxTrades) break;
    const tradeValue = sig.amount * sig.price;
    if (tradeValue > runningCash * 0.95) continue;

    const orderReq = useExtendedHours
      ? {
          symbol: sig.ticker, qty: sig.amount, side: 'buy' as const,
          type: 'limit' as const, time_in_force: 'day' as const,
          limit_price: +(sig.price * 1.001).toFixed(2),
          extended_hours: true,
          position_intent: 'buy_to_open' as const,
        }
      : {
          symbol: sig.ticker, qty: sig.amount, side: 'buy' as const,
          type: 'market' as const, time_in_force: 'day' as const,
          position_intent: 'buy_to_open' as const,
        };
    const r = await placeOrder(creds, orderReq);
    if (r.success) {
      result.totalBought += tradeValue;
      runningCash -= tradeValue;
      tradesThisScan++;
      result.executedTrades.push({
        ticker: sig.ticker, symbol: sig.ticker, action: 'BUY',
        amount: sig.amount, price: sig.price, value: tradeValue,
        orderId: r.data.id, status: 'OK', reason: sig.reason,
      });
      await recordEntryLot({
        clerkUserId,
        ticker: sig.ticker,
        qty: sig.amount,
        entryPrice: sig.price,
        signalType: sig.signalType,
        signalReason: sig.reason,
      });
    } else {
      result.errors.push(`BUY ${sig.ticker}: ${r.error}`);
      result.executedTrades.push({
        ticker: sig.ticker, symbol: sig.ticker, action: 'BUY',
        amount: sig.amount, price: sig.price, value: tradeValue,
        status: 'FEIL', reason: r.error,
      });
    }
  }

  // ── Post-execution safety invariants ──────────────────────────────────
  // Re-fetch the account state and verify no short positions opened on
  // this scan. The engine + Alpaca position_intent layers should make
  // this impossible — but a CRITICAL log here means a future regression
  // would be visible in the cron output instead of silently bleeding
  // into a $300k short book like before. Failure mode is logging only;
  // we don't try to auto-cover, that's a manual action.
  if (result.executedTrades.length > 0) {
    const postScanPositions = await getPositions(creds);
    if (postScanPositions.success) {
      const shorts = postScanPositions.data.filter(
        (p) => p.side === 'short' || (parseFloat(p.qty) || 0) < 0,
      );
      if (shorts.length > 0) {
        const summary = shorts
          .map((p) => `${p.symbol}:${p.qty}@$${p.market_value}`)
          .join(', ');
        const msg = `CRITICAL invariant violation: short positions detected after scan — ${summary}`;
        console.error(`[SAFETY] ${clerkUserId} ${msg}`);
        result.errors.push(msg);
      }
    }
  }

  return result;
}
