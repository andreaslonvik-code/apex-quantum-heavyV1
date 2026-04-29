// inngest/functions/apex-quantum-tick.ts
// APEX QUANTUM — multi-user Alpaca trading tick. Runs every minute, fans out
// to every connected user, executes 2 ticks ~30 s apart per user.
//
// Strategy mirrors /api/apex/autonomous: drive each account toward the v6.1
// ELITE_PORTFOLIO target weights autonomously.
//   1. EXIT any position outside ELITE_PORTFOLIO (legacy cleanup).
//   2. OVERWEIGHT trim / UNDERWEIGHT buy on each ELITE ticker.
//   3. Tactical PROFIT/STOPLOSS/RSI/DIP layered on top.
import { inngest } from '@/lib/inngest';
import {
  placeOrder,
  getAccount,
  getClock,
  getPositions,
  getLatestPrice,
  clearDebugLog,
  type AlpacaCreds,
  type AlpacaPosition,
} from '@/lib/alpaca';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import {
  REBALANCE,
  RISK,
  SIGNAL,
} from '@/lib/blueprint';
import { computeElitePortfolio } from '@/lib/portfolio-optimizer';

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

type SerializedUser = Awaited<ReturnType<typeof getAllConnectedUsers>>[number];

async function runUserTick(user: SerializedUser) {
  const creds: AlpacaCreds = {
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
    env: user.environment,
  };

  const accountResult = await getAccount(creds);
  if (!accountResult.success) {
    return { clerkUserId: user.clerkUserId, error: 'Account fetch failed', details: accountResult.error };
  }
  const account = accountResult.data;
  const cash = parseFloat(account.cash) || 0;
  const equity = parseFloat(account.equity) || parseFloat(account.portfolio_value) || user.startBalance;

  const clockResult = await getClock(creds);
  const marketOpen = clockResult.success ? clockResult.data.is_open : false;
  if (!marketOpen) {
    return { clerkUserId: user.clerkUserId, env: user.environment, marketOpen, executed: 0 };
  }

  const positionsResult = await getPositions(creds);
  const positionsByTicker = new Map<string, AlpacaPosition>();
  if (positionsResult.success) {
    for (const p of positionsResult.data) positionsByTicker.set(p.symbol.toUpperCase(), p);
  }

  // Optimizer picks the elite list dynamically. Cached for an hour.
  const eliteResult = await computeElitePortfolio(creds);
  const ELITE_PORTFOLIO = eliteResult.portfolio;

  // Fetch prices for every ELITE ticker + every held ticker (we need a
  // price for held positions even if they're outside ELITE so EXIT can fire).
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

  // EXIT — close out anything held outside the target portfolio.
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

    // OVERWEIGHT — structural rebalance.
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

  let totalBought = 0;
  let totalSold = 0;
  let runningCash = cash;
  let tradesThisScan = 0;
  const maxTrades = RISK.MAX_TRADES_PER_SCAN;

  console.log(
    `[APEX-INNGEST] user=${user.clerkUserId} env=${user.environment} cash=${cash.toFixed(0)} equity=${equity.toFixed(0)} sells=${sellSignals.length} buys=${buyCandidates.length}`
  );

  // SELLs first — free cash for BUYs.
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
      runningCash += tradeValue;
      tradesThisScan++;
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
      totalBought += tradeValue;
      runningCash -= tradeValue;
      tradesThisScan++;
    }
  }

  return {
    clerkUserId: user.clerkUserId,
    env: user.environment,
    marketOpen,
    sells: sellSignals.length,
    buys: buyCandidates.length,
    executed: tradesThisScan,
    totalBought,
    totalSold,
  };
}

export const apexQuantumTick = inngest.createFunction(
  {
    id: 'apex-quantum-tick',
    name: 'APEX QUANTUM Per-User Trading Tick (Alpaca)',
    retries: 3,
    triggers: [{ cron: '*/1 * * * *' }],
  },
  async ({ step }) => {
    console.log('[APEX-INNGEST] ========== TICK START (Alpaca) ==========');

    const users = await step.run('load-users', async () => {
      const list = await getAllConnectedUsers();
      console.log(`[APEX-INNGEST] ${list.length} connected user(s)`);
      return list;
    });

    if (!users.length) {
      return { version: 'APEX QUANTUM', mode: 'multi-user', users: 0 };
    }

    const results: unknown[] = [];
    for (let tick = 0; tick < 2; tick++) {
      const tickResults = await step.run(`tick-${tick}`, async () => {
        const CONCURRENCY = 5;
        const out: unknown[] = [];
        for (let i = 0; i < users.length; i += CONCURRENCY) {
          const batch = users.slice(i, i + CONCURRENCY);
          const r = await Promise.all(
            batch.map((u) =>
              runUserTick(u).catch((e) => ({ clerkUserId: u.clerkUserId, error: String(e) }))
            )
          );
          out.push(...r);
        }
        return out;
      });
      results.push(...tickResults);
      if (tick < 1) await step.sleep('wait-30s', '30s');
    }

    // Don't clear priceHistory — analyzeMomentum needs ≥3 prices to compute
    // signals, and each cron only contributes 2 prices. Letting the in-memory
    // Map persist across warm-lambda invocations means signals can fire.
    await step.run('purge', async () => {
      clearDebugLog();
      return { purged: true };
    });

    return { version: 'APEX QUANTUM', mode: 'multi-user', users: users.length, results };
  }
);

export const apexMetaCognition = inngest.createFunction(
  {
    id: 'apex-meta-cognition',
    name: 'APEX QUANTUM Meta-Cognition',
    retries: 2,
    triggers: [{ event: 'apex/meta-cognition' }],
  },
  async ({ event, step }) => {
    const { portfolioValue, pnl, openPositions } = event.data as {
      portfolioValue: number;
      pnl: number;
      openPositions: number;
    };

    const analysis = await step.run('analyze', async () => {
      const baseline = portfolioValue - pnl;
      const pnlPercent = baseline > 0 ? (pnl / baseline) * 100 : 0;

      let strategyAdjustment = 'MAINTAIN';
      let message = '';
      if (pnlPercent > 5) {
        strategyAdjustment = 'REDUCE_RISK';
        message = 'Strong gains — consider taking profits and reducing position sizes';
      } else if (pnlPercent < -3) {
        strategyAdjustment = 'DEFENSIVE';
        message = 'Losses detected — switching to defensive mode with tighter stops';
      } else if (pnlPercent > 2) {
        strategyAdjustment = 'AGGRESSIVE';
        message = 'Good performance — can increase position sizes slightly';
      }

      return {
        portfolioValue, pnl, pnlPercent, openPositions,
        strategyAdjustment, message,
        timestamp: new Date().toISOString(),
      };
    });

    console.log(`[APEX-META] Strategy: ${analysis.strategyAdjustment} | P/L: ${analysis.pnlPercent.toFixed(2)}%`);
    return analysis;
  }
);

export const functions = [apexQuantumTick, apexMetaCognition];
