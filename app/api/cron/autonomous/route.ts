/**
 * Vercel Cron — runs every minute via vercel.json. Iterates over every
 * connected Alpaca user and drives their account toward the v6.1
 * ELITE_PORTFOLIO target weights. This is the cron that actually trades in
 * production (the Inngest cron has been broken since 2026-04-28 — sync
 * failures because Inngest still points at an old Vercel preview URL).
 *
 * Same rebalance logic as /api/apex/autonomous (the on-demand variant) and
 * inngest/functions/apex-quantum-tick.ts:
 *   1. EXIT any held position outside ELITE_PORTFOLIO.
 *   2. OVERWEIGHT trim / UNDERWEIGHT buy on each ELITE ticker.
 *   3. Tactical PROFIT/STOPLOSS/RSI/DIP layered on top.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel sends this
 * automatically when the cron is configured in vercel.json).
 */
import { NextResponse } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import {
  placeOrder,
  getAccount,
  getClock,
  getPositions,
  getLatestPrice,
  type AlpacaCreds,
  type AlpacaEnv,
  type AlpacaPosition,
} from '@/lib/alpaca';
import {
  ELITE_PORTFOLIO,
  REBALANCE,
  RISK,
  SIGNAL,
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
  const avgRecent = fiveMin.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMin.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMin.length);
  const trend: 'UP' | 'DOWN' | 'NEUTRAL' =
    avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  return { rsi: calculateRSI(recent), localHigh, localLow, trend };
}

interface TradeSignal {
  ticker: string;
  amount: number;
  price: number;
  reason: string;
  priority: number;
}

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

interface UserScanResult {
  clerkUserId: string;
  environment: AlpacaEnv;
  marketOpen: boolean;
  sells: number;
  buys: number;
  executed: number;
  totalBought: number;
  totalSold: number;
  errors?: string[];
}

async function scanForUser(
  user: Awaited<ReturnType<typeof getAllConnectedUsers>>[number]
): Promise<UserScanResult> {
  const result: UserScanResult = {
    clerkUserId: user.clerkUserId,
    environment: user.environment,
    marketOpen: false,
    sells: 0,
    buys: 0,
    executed: 0,
    totalBought: 0,
    totalSold: 0,
  };

  const creds: AlpacaCreds = {
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
    env: user.environment,
  };

  const accountResult = await getAccount(creds);
  if (!accountResult.success) {
    result.errors = [`Account fetch failed: ${accountResult.error}`];
    return result;
  }
  const account = accountResult.data;
  const cash = parseFloat(account.cash) || 0;
  const equity = parseFloat(account.equity) || parseFloat(account.portfolio_value) || user.startBalance;

  const clockResult = await getClock(creds);
  result.marketOpen = clockResult.success ? clockResult.data.is_open : false;
  if (!result.marketOpen) {
    result.errors = ['Market closed'];
    return result;
  }

  const positionsResult = await getPositions(creds);
  const positionsByTicker = new Map<string, AlpacaPosition>();
  if (positionsResult.success) {
    for (const p of positionsResult.data) positionsByTicker.set(p.symbol.toUpperCase(), p);
  }

  // Fetch prices for every ELITE ticker + every held ticker (so EXIT can fire
  // on legacy positions that aren't on the target list).
  const priceTargets = new Set<string>([
    ...Object.keys(ELITE_PORTFOLIO),
    ...positionsByTicker.keys(),
  ]);
  const priceByTicker = new Map<string, number>();
  await runInChunks(Array.from(priceTargets), RISK.PRICE_FETCH_CONCURRENCY, async (ticker) => {
    const r = await getLatestPrice(creds, ticker);
    if (r.success && r.data > 0) priceByTicker.set(ticker, r.data);
  });

  const sellSignals: TradeSignal[] = [];
  const buyCandidates: TradeSignal[] = [];

  // EXIT — close out anything held outside the target portfolio. Highest
  // priority because legacy holdings drag the portfolio away from blueprint.
  const eliteSet = new Set(Object.keys(ELITE_PORTFOLIO));
  for (const [sym, pos] of positionsByTicker) {
    if (eliteSet.has(sym)) continue;
    const exitPrice = priceByTicker.get(sym) || parseFloat(pos.current_price) || 0;
    const qty = Math.abs(parseFloat(pos.qty) || 0);
    if (exitPrice <= 0 || qty < 1) continue;
    sellSignals.push({
      ticker: sym, amount: qty, price: exitPrice,
      reason: 'EXIT — utenfor blueprint', priority: 100,
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

    // OVERWEIGHT — structural rebalance toward target.
    if (posValue > targetValue * REBALANCE.OVERWEIGHT_TRIGGER && posQty > 0) {
      const excess = posValue - targetValue;
      const sellAmount = Math.min(posQty, Math.floor((excess * REBALANCE.CONVERGENCE_RATE) / price));
      if (sellAmount >= 1) {
        sellSignals.push({
          ticker, amount: sellAmount, price,
          reason: `OVERWEIGHT ${currentWeight.toFixed(0)}% > ${info.targetWeight}%`,
          priority: 80,
        });
      }
    }
    // STOPLOSS / PROFIT.
    if (posQty > 0 && posAvg > 0) {
      const profitPct = (price - posAvg) / posAvg;
      if (profitPct <= SIGNAL.STOP_LOSS_THRESHOLD) {
        sellSignals.push({
          ticker, amount: Math.max(1, Math.floor(posQty * 0.5)), price,
          reason: `STOPLOSS ${(profitPct * 100).toFixed(2)}%`, priority: 95,
        });
      } else if (profitPct >= SIGNAL.PROFIT_TAKE_THRESHOLD && posValue > targetValue) {
        sellSignals.push({
          ticker, amount: Math.max(1, Math.floor(posQty * 0.25)), price,
          reason: `PROFIT +${(profitPct * 100).toFixed(2)}%`, priority: 60,
        });
      }
    }
    // RSI HIGH — only when at/over weight.
    if (m.rsi > SIGNAL.RSI_OVERBOUGHT && posQty > 3 && posValue >= targetValue * 0.9) {
      sellSignals.push({
        ticker, amount: Math.floor(posQty * 0.15 * sellTrendMul), price,
        reason: `RSI HIGH (${m.rsi.toFixed(0)})`, priority: 40,
      });
    }
    // PEAK — only when at/over weight.
    if (riseFromLow >= SIGNAL.PEAK_THRESHOLD && posQty > 2 && posValue >= targetValue * 0.9) {
      const peakStrength = Math.min(5, riseFromLow / SIGNAL.PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(posQty * 0.3, posQty * 0.05 * peakStrength * sellTrendMul));
      if (sellSize > 0) {
        sellSignals.push({
          ticker, amount: sellSize, price,
          reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%`, priority: 50,
        });
      }
    }

    // UNDERWEIGHT — structural rebalance, highest BUY priority.
    if (posValue < targetValue * REBALANCE.UNDERWEIGHT_TRIGGER) {
      const gap = targetValue - posValue;
      const buyValue = gap * REBALANCE.CONVERGENCE_RATE;
      const amount = Math.floor(buyValue / price);
      if (amount >= 1) {
        buyCandidates.push({
          ticker, amount, price,
          reason: `UNDERWEIGHT ${currentWeight.toFixed(0)}% < ${info.targetWeight}%`,
          priority: 90,
        });
      }
    }
    // DIP / RSI LOW — tactical adds when below 110 % of target.
    if (dropFromHigh >= SIGNAL.DIP_THRESHOLD && m.trend !== 'DOWN' && posValue < targetValue * 1.1) {
      const dipStrength = Math.min(5, dropFromHigh / SIGNAL.DIP_THRESHOLD);
      const buyValue = (equity * 0.005) * dipStrength * buyTrendMul;
      const amount = Math.floor(buyValue / price);
      if (amount >= 1) {
        buyCandidates.push({
          ticker, amount, price,
          reason: `DIP -${(dropFromHigh * 100).toFixed(2)}%`, priority: 55,
        });
      }
    }
    if (m.rsi < SIGNAL.RSI_OVERSOLD && m.trend !== 'DOWN' && posValue < targetValue * 1.1) {
      const buyValue = equity * 0.01 * buyTrendMul;
      const amount = Math.floor(buyValue / price);
      if (amount >= 1) {
        buyCandidates.push({
          ticker, amount, price,
          reason: `RSI LOW (${m.rsi.toFixed(0)})`, priority: 50,
        });
      }
    }
  }

  sellSignals.sort((a, b) => b.priority - a.priority);
  buyCandidates.sort((a, b) => b.priority - a.priority);
  result.sells = sellSignals.length;
  result.buys = buyCandidates.length;

  let runningCash = cash;
  let tradesThisScan = 0;
  const maxTrades = RISK.MAX_TRADES_PER_SCAN;

  // SELLs first — they free cash for BUYs.
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
      result.totalSold += tradeValue;
      runningCash += tradeValue;
      tradesThisScan++;
    } else {
      result.errors = result.errors || [];
      result.errors.push(`SELL ${sig.ticker}: ${r.error}`);
    }
  }

  // BUYs.
  for (const sig of buyCandidates) {
    if (tradesThisScan >= maxTrades) break;
    const tradeValue = sig.amount * sig.price;
    if (tradeValue > runningCash * 0.95) continue;

    const r = await placeOrder(creds, {
      symbol: sig.ticker, qty: sig.amount, side: 'buy',
      type: 'market', time_in_force: 'day',
    });
    if (r.success) {
      result.totalBought += tradeValue;
      runningCash -= tradeValue;
      tradesThisScan++;
    } else {
      result.errors = result.errors || [];
      result.errors.push(`BUY ${sig.ticker}: ${r.error}`);
    }
  }

  result.executed = tradesThisScan;
  return result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const users = await getAllConnectedUsers();

  console.log(`[CRON] APEX QUANTUM rebalance tick — ${users.length} connected user(s)`);

  if (users.length === 0) {
    return NextResponse.json({ success: true, users: 0, message: 'No connected users' });
  }

  const CONCURRENCY = 5;
  const results: UserScanResult[] = [];
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((u) =>
        scanForUser(u).catch(
          (e): UserScanResult => ({
            clerkUserId: u.clerkUserId,
            environment: u.environment,
            marketOpen: false,
            sells: 0,
            buys: 0,
            executed: 0,
            totalBought: 0,
            totalSold: 0,
            errors: [String(e)],
          })
        )
      )
    );
    results.push(...batchResults);
    if (i + CONCURRENCY < users.length) await sleep(500);
  }

  const elapsed = Date.now() - startTime;
  const totals = results.reduce(
    (acc, r) => ({
      executed: acc.executed + r.executed,
      bought: acc.bought + r.totalBought,
      sold: acc.sold + r.totalSold,
    }),
    { executed: 0, bought: 0, sold: 0 }
  );

  console.log(
    `[CRON] Done in ${elapsed}ms — ${totals.executed} orders, $${totals.bought.toFixed(0)} bought, $${totals.sold.toFixed(0)} sold across ${users.length} users`
  );

  return NextResponse.json({
    success: true,
    blueprint: 'v6.1 elite portfolio',
    users: users.length,
    totalExecuted: totals.executed,
    totalBought: totals.bought,
    totalSold: totals.sold,
    elapsedMs: elapsed,
    perUser: results,
  });
}
