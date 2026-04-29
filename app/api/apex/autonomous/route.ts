// APEX QUANTUM — Autonomous Trading Engine (Alpaca, on-demand variant)
// Reverts the short-lived v8 mean-reversion route back to the v6.2 ("Grok")
// engine: dip/peak detection + RSI + target-weight rebalance + accumulation
// signals over a 32-ticker universe.
//
// The same logic also runs every minute as a cron in
// inngest/functions/apex-quantum-tick.ts — both consumers import APEX_BLUEPRINT
// from lib/blueprint.ts so the universe and weights cannot drift.
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
import { APEX_BLUEPRINT } from '@/lib/blueprint';

const CONFIG = {
  DIP_THRESHOLD: 0.0003,
  PEAK_THRESHOLD: 0.0005,
  RSI_OVERSOLD: 48,
  RSI_OVERBOUGHT: 52,
  PROFIT_TAKE_THRESHOLD: 0.003,
  STOP_LOSS_THRESHOLD: -0.02,
  POSITION_SIZE_PERCENT: 0.20,
  MAX_TRADES_PER_SCAN: 15,
  FORCE_TRADING_ALWAYS: true,
  // Quote prefetch concurrency. Alpaca paper rate ≈ 200/min so 12 in parallel
  // across a 32-ticker universe finishes in 2-3 round trips.
  PRICE_FETCH_CONCURRENCY: 12,
};

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

interface TradingSignal {
  ticker: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
  price: number;
}

async function runInChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function generateSignals(
  creds: AlpacaCreds,
  positionsByTicker: Map<string, AlpacaPosition>,
  cash: number,
  totalValue: number,
  marketOpen: boolean
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];
  if (!marketOpen && !CONFIG.FORCE_TRADING_ALWAYS) return signals;

  // Fetch prices for all tickers in parallel chunks. With 32 tickers and a
  // concurrency of 12, this is 3 round trips instead of 32 sequential calls.
  const tickers = Object.keys(APEX_BLUEPRINT);
  const priceByTicker = new Map<string, number>();
  await runInChunks(tickers, CONFIG.PRICE_FETCH_CONCURRENCY, async (ticker) => {
    const r = await getLatestPrice(creds, ticker);
    if (r.success && r.data > 0) priceByTicker.set(ticker, r.data);
  });

  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    const currentPrice = priceByTicker.get(ticker);
    if (!currentPrice) continue;
    const momentum = analyzeMomentum(ticker, currentPrice);

    const pos = positionsByTicker.get(ticker.toUpperCase());
    const posQty = pos ? Math.abs(parseFloat(pos.qty) || 0) : 0;
    const posAvg = pos ? parseFloat(pos.avg_entry_price) || 0 : 0;
    const posValue = pos ? Math.abs(parseFloat(pos.market_value) || 0) : 0;

    const baseSize = Math.max(1, Math.floor((cash * CONFIG.POSITION_SIZE_PERCENT) / currentPrice));
    const volMul = 1 + (info.volatility - 2) * 0.25;

    const targetValue = (totalValue * info.targetWeight) / 100;
    const deviation = targetValue > 0 ? ((posValue - targetValue) / targetValue) * 100 : -100;

    const dropFromHigh =
      momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow =
      momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;

    // BUY signals
    if (dropFromHigh >= CONFIG.DIP_THRESHOLD && cash > baseSize * currentPrice) {
      const dipStrength = Math.min(5, dropFromHigh / CONFIG.DIP_THRESHOLD);
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * dipStrength * volMul),
        reason: `DIP -${(dropFromHigh * 100).toFixed(2)}%`,
        price: currentPrice,
      });
    }
    if (momentum.rsi < CONFIG.RSI_OVERSOLD && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 2 * volMul),
        reason: `RSI LOW (${momentum.rsi.toFixed(0)})`,
        price: currentPrice,
      });
    }
    if (posQty === 0 && cash > baseSize * currentPrice * 2) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 3),
        reason: `BUILD ${info.targetWeight}%`,
        price: currentPrice,
      });
    }
    if (deviation < -10 && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 1.5),
        reason: `UNDERWEIGHT (${deviation.toFixed(0)}%)`,
        price: currentPrice,
      });
    }
    if (CONFIG.FORCE_TRADING_ALWAYS && cash > baseSize * currentPrice * 0.5) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.max(1, Math.floor(baseSize * 1.2)),
        reason: '[FORCE] AKKUMULERING',
        price: currentPrice,
      });
    }

    // SELL signals
    if (riseFromLow >= CONFIG.PEAK_THRESHOLD && posQty > 2) {
      const peakStrength = Math.min(5, riseFromLow / CONFIG.PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(posQty * 0.4, baseSize * peakStrength));
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          price: currentPrice,
        });
      }
    }
    if (momentum.rsi > CONFIG.RSI_OVERBOUGHT && posQty > 3) {
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.floor(posQty * 0.25),
        reason: `RSI HIGH (${momentum.rsi.toFixed(0)})`,
        price: currentPrice,
      });
    }
    if (posQty > 0 && posAvg > 0) {
      const profitPct = (currentPrice - posAvg) / posAvg;
      if (profitPct >= CONFIG.PROFIT_TAKE_THRESHOLD) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: Math.max(1, Math.floor(posQty * 0.5)),
          reason: `PROFIT +${(profitPct * 100).toFixed(2)}%`,
          price: currentPrice,
        });
      }
      if (profitPct <= CONFIG.STOP_LOSS_THRESHOLD) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: Math.floor(posQty * 0.5),
          reason: `STOPLOSS ${(profitPct * 100).toFixed(2)}%`,
          price: currentPrice,
        });
      }
    }
    if (deviation > 20 && posQty > 5) {
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.floor(posQty * 0.15),
        reason: `OVERWEIGHT (+${deviation.toFixed(0)}%)`,
        price: currentPrice,
      });
    }
  }

  signals.sort((a, b) => {
    const priority = (r: string) =>
      r.includes('STOPLOSS') ? 6 :
      r.includes('DIP') ? 5 :
      r.includes('PEAK') || r.includes('PROFIT') ? 4 :
      r.includes('RSI') ? 3 :
      r.includes('FORCE') ? 2 : 1;
    return priority(b.reason) - priority(a.reason);
  });
  return signals.slice(0, CONFIG.MAX_TRADES_PER_SCAN);
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
    const accountResult = await getAccount(creds);
    if (!accountResult.success) {
      return NextResponse.json(
        { error: accountResult.error, code: accountResult.errorCode },
        { status: 500 }
      );
    }
    const account = accountResult.data;
    const cash = parseFloat(account.cash) || 0;
    const totalValue =
      parseFloat(account.equity) || parseFloat(account.portfolio_value) || userCreds.startBalance;
    const initialValue = userCreds.startBalance || totalValue;
    const currentProfit = totalValue - initialValue;

    const clockResult = await getClock(creds);
    const marketOpen = clockResult.success ? clockResult.data.is_open : false;

    const positionsResult = await getPositions(creds);
    const positionsMap = new Map<string, AlpacaPosition>();
    if (positionsResult.success) {
      for (const p of positionsResult.data) positionsMap.set(p.symbol.toUpperCase(), p);
    }

    const signals = await generateSignals(creds, positionsMap, cash, totalValue, marketOpen);

    const executedTrades: Array<{
      ticker: string;
      symbol: string;
      action: 'BUY' | 'SELL';
      amount: number;
      price: number;
      value: number;
      orderId?: string;
      status: 'OK' | 'FEIL';
      reason: string;
    }> = [];
    let totalBought = 0;
    let totalSold = 0;
    let runningCash = cash;

    for (const signal of signals) {
      const tradeValue = signal.amount * signal.price;
      if (signal.action === 'BUY' && tradeValue > runningCash * 0.95) continue;
      if (signal.action === 'SELL') {
        const pos = positionsMap.get(signal.ticker.toUpperCase());
        const have = pos ? Math.abs(parseFloat(pos.qty)) : 0;
        if (!pos || have < signal.amount) continue;
      }

      const orderResult = await placeOrder(creds, {
        symbol: signal.ticker,
        qty: signal.amount,
        side: signal.action.toLowerCase() as 'buy' | 'sell',
        type: 'market',
        time_in_force: 'day',
      });

      if (orderResult.success) {
        if (signal.action === 'BUY') {
          totalBought += tradeValue;
          runningCash -= tradeValue;
        } else {
          totalSold += tradeValue;
          runningCash += tradeValue;
        }
        executedTrades.push({
          ticker: signal.ticker,
          symbol: signal.ticker,
          action: signal.action,
          amount: signal.amount,
          price: signal.price,
          value: tradeValue,
          orderId: orderResult.data.id,
          status: 'OK',
          reason: signal.reason,
        });
      } else {
        executedTrades.push({
          ticker: signal.ticker,
          symbol: signal.ticker,
          action: signal.action,
          amount: signal.amount,
          price: signal.price,
          value: tradeValue,
          status: 'FEIL',
          reason: orderResult.error,
        });
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: userCreds.environment,
      marketOpen,
      signals: signals.map((s) => ({
        ticker: s.ticker,
        symbol: s.ticker,
        action: s.action,
        amount: s.amount,
        reason: s.reason,
      })),
      executedTrades,
      portfolio: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
        const pos = positionsMap.get(ticker.toUpperCase());
        const qty = pos ? Math.abs(parseFloat(pos.qty)) : 0;
        return {
          ticker,
          symbol: ticker,
          navn: info.name,
          vekt: info.targetWeight,
          aksjon: signals.find((s) => s.ticker === ticker)?.action || 'HOLD',
          antall: qty,
        };
      }),
      stats: {
        baseCapital: initialValue,
        actualTotalValue: totalValue,
        currentProfit,
        tradingCapital: cash,
        marketsOpen: marketOpen ? ['US'] : [],
        totalBought,
        totalSold,
        successful: executedTrades.filter((t) => t.status === 'OK').length,
        failed: executedTrades.filter((t) => t.status === 'FEIL').length,
      },
      debug: {
        log: getDebugLog().slice(0, 20),
        duration,
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
