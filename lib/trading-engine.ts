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
import { WATCHLIST, RISK, SIGNAL, SYMBOL_TO_SECTOR } from './blueprint';
import { computeEliteTickers } from './portfolio-optimizer';
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

export const HOLDINGS_CAP = 8;
export const MAX_PER_TICKER_PCT = 15;
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
  elite: { tickers: string[]; source: 'optimizer' | 'seed' };
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
    elite: { tickers: [], source: 'seed' },
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

      // Trailing stop activates only after the position has run > trigger.
      // Sells when price falls TRAILING_DRAWDOWN_PCT from session HWM.
      const trailingActive = profitPct >= SIGNAL.TRAILING_PROFIT_TRIGGER;
      const trailingStopLevel = trailingActive
        ? hwm * (1 - SIGNAL.TRAILING_DRAWDOWN_PCT)
        : 0;

      // Effective stop = whichever is HIGHER (closer to current price for a
      // long). Once trailing locks in profits, it dominates the base stop.
      const effectiveStop = Math.max(baseStopLevel, trailingStopLevel);

      if (price <= effectiveStop) {
        let reason: string;
        let signalType: string;
        if (trailingActive && trailingStopLevel >= baseStopLevel) {
          const drawdownFromHwm = ((hwm - price) / hwm) * 100;
          reason = `TRAILING −${drawdownFromHwm.toFixed(2)}% from $${hwm.toFixed(2)} (locked +${(profitPct * 100).toFixed(2)}%)`;
          signalType = 'TRAILING';
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

    // News-driven multipliers (1.0 when no intel / low confidence).
    const sectorKey = SYMBOL_TO_SECTOR[ticker];
    const newsSectorMul = sectorMultiplierFromIntel(newsIntel, sectorKey);
    const newsTickerMul = tickerEventMultiplierFromIntel(newsIntel, ticker);
    // tickerEventMultiplier returns 0 when bearish events are strong enough
    // to neutralise the buy — treat as a hard veto on this ticker.
    if (newsTickerMul <= 0.05) continue;

    const newsBuyMul = newsBuyFactor * newsSectorMul * newsTickerMul;

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
        equity * 0.01 * gapStrength * buyMul * eliteBonus *
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
        equity * 0.005 * dipStrength * buyMul * eliteBonus *
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
        equity * 0.01 * buyMul * eliteBonus *
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

  // ── Apply HOLDINGS_CAP ────────────────────────────────────────────────
  result.buyCandidates.sort((a, b) => b.score - a.score);
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

  for (const sig of result.acceptedSells) {
    if (tradesThisScan >= maxTrades) break;
    const pos = positionsByTicker.get(sig.ticker.toUpperCase());
    const have = pos ? Math.abs(parseFloat(pos.qty)) : 0;
    if (!pos || have < 1) continue;
    const amount = Math.min(sig.amount, have);
    const tradeValue = amount * sig.price;

    const orderReq = useExtendedHours
      ? {
          symbol: sig.ticker, qty: amount, side: 'sell' as const,
          type: 'limit' as const, time_in_force: 'day' as const,
          limit_price: +(sig.price * 0.999).toFixed(2),
          extended_hours: true,
        }
      : {
          symbol: sig.ticker, qty: amount, side: 'sell' as const,
          type: 'market' as const, time_in_force: 'day' as const,
        };
    const r = await placeOrder(creds, orderReq);
    if (r.success) {
      result.totalSold += tradeValue;
      runningCash += tradeValue;
      tradesThisScan++;
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
        }
      : {
          symbol: sig.ticker, qty: sig.amount, side: 'buy' as const,
          type: 'market' as const, time_in_force: 'day' as const,
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

  return result;
}
