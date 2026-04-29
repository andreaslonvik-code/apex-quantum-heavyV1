// APEX QUANTUM — Autonomous Trading Engine (Alpaca, on-demand variant)
//
// Strategy: drive the account toward the v6.1 ELITE_PORTFOLIO target weights
// autonomously. Every scan:
//   1. EXIT any position held outside ELITE_PORTFOLIO (legacy cleanup).
//   2. For each ELITE ticker, compare current weight vs target weight:
//      - OVERWEIGHT (> target × 1.30) → trim half the excess.
//      - UNDERWEIGHT (< target × 0.85) → buy half the gap.
//   3. Layer tactical signals on top: PROFIT/STOPLOSS/RSI on held positions,
//      DIP accumulation on ELITE tickers when oversold.
//
// SELLs run first (they free cash); BUYs use the running cash including
// freed funds from this scan's SELLs. The same logic runs every minute as
// a cron in inngest/functions/apex-quantum-tick.ts.
import { NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  getAccount,
  getClock,
  getPositions,
  getLatestPrice,
  placeOrder,
  getDebugLog,
  type AlpacaCreds,
  type AlpacaPosition,
} from '@/lib/alpaca';
import {
  ELITE_PORTFOLIO,
  REBALANCE,
  RISK,
  SIGNAL,
  TICKER_NAME,
} from '@/lib/blueprint';

interface PricePoint { price: number; timestamp: number }
const priceHistory: Map<string, PricePoint[]> = new Map();

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
  const rsi = calculateRSI(recent);
  const avgRecent = fiveMin.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMin.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMin.length);
  const trend: 'UP' | 'DOWN' | 'NEUTRAL' =
    avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  return { rsi, localHigh, localLow, trend };
}

interface TradeSignal {
  ticker: string;
  amount: number;
  price: number;
  reason: string;
  /** Higher score → executed first when the per-scan budget is tight. */
  priority: number;
}

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export async function POST(_req: NextRequest) {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json(
      { error: 'Ikke tilkoblet Alpaca. Vennligst koble til først.' },
      { status: 401 }
    );
  }

  const creds: AlpacaCreds = {
    apiKey: userCreds.apiKey,
    apiSecret: userCreds.apiSecret,
    env: userCreds.environment,
  };

  const startTime = Date.now();

  try {
    // ── Account ──────────────────────────────────────────────────────────
    const accountResult = await getAccount(creds);
    if (!accountResult.success) {
      return NextResponse.json(
        { error: accountResult.error, code: accountResult.errorCode },
        { status: 500 }
      );
    }
    const account = accountResult.data;
    const cash = parseFloat(account.cash) || 0;
    const equity = parseFloat(account.equity) || parseFloat(account.portfolio_value) || userCreds.startBalance;
    const initialValue = userCreds.startBalance || equity;

    // ── Daily kill switch ───────────────────────────────────────────────
    const dailyPnl = initialValue > 0 ? equity / initialValue - 1 : 0;
    if (dailyPnl <= RISK.DAILY_LOSS_LIMIT) {
      return NextResponse.json({
        success: true,
        haltedReason: `Daglig tapsgrense nådd (${(dailyPnl * 100).toFixed(2)}%)`,
        signals: [], executedTrades: [], stats: zeroStats(equity, initialValue, cash),
      });
    }

    // ── Market clock ────────────────────────────────────────────────────
    const clockResult = await getClock(creds);
    const marketOpen = clockResult.success ? clockResult.data.is_open : false;

    // ── Positions ───────────────────────────────────────────────────────
    const positionsResult = await getPositions(creds);
    const positionsByTicker = new Map<string, AlpacaPosition>();
    if (positionsResult.success) {
      for (const p of positionsResult.data) positionsByTicker.set(p.symbol.toUpperCase(), p);
    }

    // ── Pass 1: fetch prices for every ELITE ticker + every held ticker ─
    const priceTargets = new Set<string>([
      ...Object.keys(ELITE_PORTFOLIO),
      ...positionsByTicker.keys(),
    ]);
    const priceByTicker = new Map<string, number>();
    await runInChunks(Array.from(priceTargets), RISK.PRICE_FETCH_CONCURRENCY, async (ticker) => {
      const r = await getLatestPrice(creds, ticker);
      if (r.success && r.data > 0) priceByTicker.set(ticker, r.data);
    });

    // ── Pass 2: build SELL + BUY queues ─────────────────────────────────
    const sellSignals: TradeSignal[] = [];
    const buyCandidates: TradeSignal[] = [];

    // EXIT — close out anything held that isn't on the target portfolio.
    // Highest priority: legacy holdings drag the account away from the
    // blueprint and the cash is needed to fund target buys.
    const eliteSet = new Set(Object.keys(ELITE_PORTFOLIO));
    for (const [sym, pos] of positionsByTicker) {
      if (eliteSet.has(sym)) continue;
      const exitPrice = priceByTicker.get(sym) || parseFloat(pos.current_price) || 0;
      const qty = Math.abs(parseFloat(pos.qty) || 0);
      if (exitPrice <= 0 || qty < 1) continue;
      sellSignals.push({
        ticker: sym,
        amount: qty,
        price: exitPrice,
        reason: 'EXIT — utenfor blueprint',
        priority: 100,
      });
    }

    // ELITE rebalance + tactical signals.
    for (const [ticker, info] of Object.entries(ELITE_PORTFOLIO)) {
      const price = priceByTicker.get(ticker);
      if (!price) continue;
      const m = analyzeMomentum(ticker, price);

      const pos = positionsByTicker.get(ticker.toUpperCase());
      const posQty = pos ? Math.abs(parseFloat(pos.qty) || 0) : 0;
      const posAvg = pos ? parseFloat(pos.avg_entry_price) || 0 : 0;
      const posValue = pos ? Math.abs(parseFloat(pos.market_value) || 0) : 0;

      const targetValue = (equity * info.targetWeight) / 100;
      const currentWeight = equity > 0 ? (posValue / equity) * 100 : 0;

      const dropFromHigh = m.localHigh > 0 ? (m.localHigh - price) / m.localHigh : 0;
      const riseFromLow  = m.localLow  > 0 ? (price - m.localLow) / m.localLow  : 0;
      const buyTrendMul  = m.trend === 'UP' ? 1.25 : m.trend === 'DOWN' ? 0.7 : 1.0;
      const sellTrendMul = m.trend === 'DOWN' ? 1.3 : m.trend === 'UP' ? 0.85 : 1.0;

      // ── SELL signals ──────────────────────────────────────────────────
      // OVERWEIGHT — structural rebalance toward target weight.
      if (posValue > targetValue * REBALANCE.OVERWEIGHT_TRIGGER && posQty > 0) {
        const excess = posValue - targetValue;
        const sellAmount = Math.min(posQty, Math.floor((excess * REBALANCE.CONVERGENCE_RATE) / price));
        if (sellAmount >= 1) {
          sellSignals.push({
            ticker,
            amount: sellAmount,
            price,
            reason: `OVERWEIGHT ${currentWeight.toFixed(0)}% > ${info.targetWeight}%`,
            priority: 80,
          });
        }
      }
      // STOPLOSS — fast hard exit on losers.
      if (posQty > 0 && posAvg > 0) {
        const profitPct = (price - posAvg) / posAvg;
        if (profitPct <= SIGNAL.STOP_LOSS_THRESHOLD) {
          sellSignals.push({
            ticker,
            amount: Math.max(1, Math.floor(posQty * 0.5)),
            price,
            reason: `STOPLOSS ${(profitPct * 100).toFixed(2)}%`,
            priority: 95,
          });
        } else if (profitPct >= SIGNAL.PROFIT_TAKE_THRESHOLD && posValue > targetValue) {
          // Take partial profit only when we're already at/over weight.
          sellSignals.push({
            ticker,
            amount: Math.max(1, Math.floor(posQty * 0.25)),
            price,
            reason: `PROFIT +${(profitPct * 100).toFixed(2)}%`,
            priority: 60,
          });
        }
      }
      // RSI HIGH — trim into strength.
      if (m.rsi > SIGNAL.RSI_OVERBOUGHT && posQty > 3 && posValue >= targetValue * 0.9) {
        sellSignals.push({
          ticker,
          amount: Math.floor(posQty * 0.15 * sellTrendMul),
          price,
          reason: `RSI HIGH (${m.rsi.toFixed(0)})`,
          priority: 40,
        });
      }
      // PEAK — short-term spike from intra-scan low.
      if (riseFromLow >= SIGNAL.PEAK_THRESHOLD && posQty > 2 && posValue >= targetValue * 0.9) {
        const peakStrength = Math.min(5, riseFromLow / SIGNAL.PEAK_THRESHOLD);
        const sellSize = Math.floor(Math.min(posQty * 0.3, posQty * 0.05 * peakStrength * sellTrendMul));
        if (sellSize > 0) {
          sellSignals.push({
            ticker,
            amount: sellSize,
            price,
            reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%`,
            priority: 50,
          });
        }
      }

      // ── BUY signals ───────────────────────────────────────────────────
      // UNDERWEIGHT — structural rebalance toward target weight. Highest
      // BUY priority because this is what makes the portfolio match the
      // blueprint.
      if (posValue < targetValue * REBALANCE.UNDERWEIGHT_TRIGGER) {
        const gap = targetValue - posValue;
        const buyValue = gap * REBALANCE.CONVERGENCE_RATE;
        const amount = Math.floor(buyValue / price);
        if (amount >= 1) {
          buyCandidates.push({
            ticker,
            amount,
            price,
            reason: `UNDERWEIGHT ${currentWeight.toFixed(0)}% < ${info.targetWeight}%`,
            priority: 90,
          });
        }
      }
      // DIP — tactical: accumulate ELITE on short-term weakness, even when
      // close to target (small adds only).
      if (dropFromHigh >= SIGNAL.DIP_THRESHOLD && m.trend !== 'DOWN' && posValue < targetValue * 1.1) {
        const dipStrength = Math.min(5, dropFromHigh / SIGNAL.DIP_THRESHOLD);
        const buyValue = (equity * 0.005) * dipStrength * buyTrendMul; // 0.5 % of equity per unit dip
        const amount = Math.floor(buyValue / price);
        if (amount >= 1) {
          buyCandidates.push({
            ticker,
            amount,
            price,
            reason: `DIP -${(dropFromHigh * 100).toFixed(2)}%`,
            priority: 55,
          });
        }
      }
      // RSI LOW — tactical accumulation on oversold ELITE names.
      if (m.rsi < SIGNAL.RSI_OVERSOLD && m.trend !== 'DOWN' && posValue < targetValue * 1.1) {
        const buyValue = equity * 0.01 * buyTrendMul; // 1 % of equity
        const amount = Math.floor(buyValue / price);
        if (amount >= 1) {
          buyCandidates.push({
            ticker,
            amount,
            price,
            reason: `RSI LOW (${m.rsi.toFixed(0)})`,
            priority: 50,
          });
        }
      }
    }

    // ── Execute ──────────────────────────────────────────────────────────
    sellSignals.sort((a, b) => b.priority - a.priority);
    buyCandidates.sort((a, b) => b.priority - a.priority);

    const executedTrades: Array<{
      ticker: string; symbol: string; action: 'BUY' | 'SELL';
      amount: number; price: number; value: number;
      orderId?: string; status: 'OK' | 'FEIL'; reason: string;
    }> = [];
    let totalBought = 0;
    let totalSold = 0;
    let runningCash = cash;
    let tradesThisScan = 0;
    const maxTrades = RISK.MAX_TRADES_PER_SCAN;

    // SELLs first — they free cash for the BUY queue.
    if (marketOpen) {
      for (const sig of sellSignals) {
        if (tradesThisScan >= maxTrades) break;
        const pos = positionsByTicker.get(sig.ticker.toUpperCase());
        const have = pos ? Math.abs(parseFloat(pos.qty)) : 0;
        if (!pos || have < 1) continue;
        const amount = Math.min(sig.amount, have);
        const tradeValue = amount * sig.price;

        const r = await placeOrder(creds, {
          symbol: sig.ticker, qty: amount, side: 'sell',
          type: 'market', time_in_force: 'day',
        });
        if (r.success) {
          totalSold += tradeValue;
          runningCash += tradeValue; // Alpaca paper settles immediately for the next BUY's purposes.
          tradesThisScan++;
          executedTrades.push({
            ticker: sig.ticker, symbol: sig.ticker, action: 'SELL',
            amount, price: sig.price, value: tradeValue,
            orderId: r.data.id, status: 'OK', reason: sig.reason,
          });
        } else {
          executedTrades.push({
            ticker: sig.ticker, symbol: sig.ticker, action: 'SELL',
            amount, price: sig.price, value: tradeValue,
            status: 'FEIL', reason: r.error,
          });
        }
      }
    }

    // BUYs second.
    if (marketOpen) {
      for (const sig of buyCandidates) {
        if (tradesThisScan >= maxTrades) break;
        const tradeValue = sig.amount * sig.price;
        if (tradeValue > runningCash * 0.95) continue;

        const r = await placeOrder(creds, {
          symbol: sig.ticker, qty: sig.amount, side: 'buy',
          type: 'market', time_in_force: 'day',
        });
        if (r.success) {
          totalBought += tradeValue;
          runningCash -= tradeValue;
          tradesThisScan++;
          executedTrades.push({
            ticker: sig.ticker, symbol: sig.ticker, action: 'BUY',
            amount: sig.amount, price: sig.price, value: tradeValue,
            orderId: r.data.id, status: 'OK', reason: sig.reason,
          });
        } else {
          executedTrades.push({
            ticker: sig.ticker, symbol: sig.ticker, action: 'BUY',
            amount: sig.amount, price: sig.price, value: tradeValue,
            status: 'FEIL', reason: r.error,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: userCreds.environment,
      marketOpen,
      blueprint: 'v6.1 elite portfolio',
      signals: [
        ...sellSignals.map((s) => ({
          ticker: s.ticker, symbol: s.ticker, action: 'SELL',
          amount: s.amount, reason: s.reason, priority: s.priority,
        })),
        ...buyCandidates.map((s) => ({
          ticker: s.ticker, symbol: s.ticker, action: 'BUY',
          amount: s.amount, reason: s.reason, priority: s.priority,
        })),
      ],
      executedTrades,
      portfolio: Object.entries(ELITE_PORTFOLIO).map(([ticker, info]) => {
        const pos = positionsByTicker.get(ticker);
        const qty = pos ? Math.abs(parseFloat(pos.qty)) : 0;
        const posValue = pos ? Math.abs(parseFloat(pos.market_value)) : 0;
        return {
          ticker,
          symbol: ticker,
          navn: info.name,
          vekt: equity > 0 ? (posValue / equity) * 100 : 0,
          targetVekt: info.targetWeight,
          aksjon: 'HOLD',
          antall: qty,
        };
      }),
      stats: {
        baseCapital: initialValue,
        actualTotalValue: equity,
        currentProfit: equity - initialValue,
        tradingCapital: cash,
        marketsOpen: marketOpen ? ['US'] : [],
        totalBought,
        totalSold,
        successful: executedTrades.filter((t) => t.status === 'OK').length,
        failed: executedTrades.filter((t) => t.status === 'FEIL').length,
        sellSignals: sellSignals.length,
        buySignals: buyCandidates.length,
      },
      debug: {
        log: getDebugLog().slice(0, 20),
        duration: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error('[APEX] Error:', err);
    return NextResponse.json(
      { error: 'Autonomous scan failed', details: String(err) },
      { status: 500 }
    );
  }
}

function zeroStats(equity: number, initialValue: number, cash: number) {
  return {
    baseCapital: initialValue,
    actualTotalValue: equity,
    currentProfit: equity - initialValue,
    tradingCapital: cash,
    marketsOpen: [] as string[],
    totalBought: 0,
    totalSold: 0,
    successful: 0,
    failed: 0,
  };
}

// Re-export so other modules don't have to import from blueprint directly.
export { TICKER_NAME };
