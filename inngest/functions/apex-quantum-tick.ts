// inngest/functions/apex-quantum-tick.ts
// APEX QUANTUM v8 — multi-user Alpaca trading tick.
// Runs every minute, fans out to every connected user, executes 2 ticks ~30s apart.
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

const APEX_BLUEPRINT: Record<string, { name: string; targetWeight: number; volatility: number }> = {
  MU:   { name: 'Micron Technology',    targetWeight: 25, volatility: 3 },
  CEG:  { name: 'Constellation Energy', targetWeight: 10, volatility: 2 },
  VRT:  { name: 'Vertiv Holdings',      targetWeight: 10, volatility: 2 },
  RKLB: { name: 'Rocket Lab',           targetWeight: 8,  volatility: 4 },
  LMND: { name: 'Lemonade Inc',         targetWeight: 7,  volatility: 4 },
  ABSI: { name: 'Absci Corporation',    targetWeight: 5,  volatility: 5 },
};

const CONFIG = {
  DIP_THRESHOLD: 0.0005,
  PEAK_THRESHOLD: 0.0008,
  RSI_OVERSOLD: 45,
  RSI_OVERBOUGHT: 55,
  PROFIT_TAKE_THRESHOLD: 0.005,
  STOP_LOSS_THRESHOLD: -0.02,
  POSITION_SIZE_PERCENT: 0.15,
  MAX_TRADES_PER_TICK: 12,
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
    return { rsi: 50, localHigh: currentPrice, localLow: currentPrice };
  }
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMin = recent.filter((p) => p.timestamp > fiveMinAgo);
  const localHigh = Math.max(...fiveMin.map((p) => p.price));
  const localLow = Math.min(...fiveMin.map((p) => p.price));
  return { rsi: calculateRSI(recent), localHigh, localLow };
}

interface TradingSignal {
  ticker: string;
  action: 'buy' | 'sell';
  amount: number;
  reason: string;
  priority: number;
}

async function generateSignals(
  creds: AlpacaCreds,
  positions: Map<string, AlpacaPosition>,
  cash: number,
  totalValue: number,
  marketOpen: boolean
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];
  const isPaper = creds.env === 'paper';

  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    if (!marketOpen && !isPaper) continue;

    const priceResult = await getLatestPrice(creds, ticker);
    if (!priceResult.success || priceResult.data <= 0) continue;
    const currentPrice = priceResult.data;
    const momentum = analyzeMomentum(ticker, currentPrice);

    const pos = positions.get(ticker.toUpperCase());
    const qty = pos ? Math.abs(parseFloat(pos.qty) || 0) : 0;
    const avg = pos ? parseFloat(pos.avg_entry_price) || 0 : 0;
    const value = pos ? Math.abs(parseFloat(pos.market_value) || 0) : 0;

    const baseSize = Math.max(1, Math.floor((cash * CONFIG.POSITION_SIZE_PERCENT) / currentPrice));
    const volMul = 1 + (info.volatility - 2) * 0.2;
    const targetValue = (totalValue * info.targetWeight) / 100;
    const deviation = targetValue > 0 ? ((value - targetValue) / targetValue) * 100 : -100;

    const dropFromHigh = momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow = momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;

    if (dropFromHigh >= CONFIG.DIP_THRESHOLD && cash > baseSize * currentPrice) {
      const dipStrength = Math.min(4, dropFromHigh / CONFIG.DIP_THRESHOLD);
      signals.push({
        ticker,
        action: 'buy',
        amount: Math.floor(baseSize * dipStrength * volMul),
        reason: `DIP -${(dropFromHigh * 100).toFixed(2)}%`,
        priority: 5,
      });
    }
    if (momentum.rsi < CONFIG.RSI_OVERSOLD && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'buy',
        amount: Math.floor(baseSize * 1.5),
        reason: `RSI OVERSOLD (${momentum.rsi.toFixed(0)})`,
        priority: 4,
      });
    }
    if (deviation < -15 && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'buy',
        amount: Math.floor(baseSize * 2),
        reason: `UNDERWEIGHT ${deviation.toFixed(0)}%`,
        priority: 3,
      });
    }
    if (qty === 0 && cash > baseSize * currentPrice * 2) {
      signals.push({
        ticker,
        action: 'buy',
        amount: Math.floor(baseSize * 3),
        reason: `BUILD ${info.targetWeight}%`,
        priority: 2,
      });
    }

    if (riseFromLow >= CONFIG.PEAK_THRESHOLD && qty > 2) {
      const peakStrength = Math.min(4, riseFromLow / CONFIG.PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(qty * 0.3, baseSize * peakStrength));
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'sell',
          amount: sellSize,
          reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          priority: 5,
        });
      }
    }
    if (qty > 0 && avg > 0) {
      const profitPct = (currentPrice - avg) / avg;
      if (profitPct >= CONFIG.PROFIT_TAKE_THRESHOLD) {
        signals.push({
          ticker,
          action: 'sell',
          amount: Math.max(1, Math.floor(qty * 0.4)),
          reason: `PROFIT +${(profitPct * 100).toFixed(2)}%`,
          priority: 5,
        });
      }
      if (profitPct <= CONFIG.STOP_LOSS_THRESHOLD) {
        signals.push({
          ticker,
          action: 'sell',
          amount: Math.floor(qty * 0.5),
          reason: `STOPLOSS ${(profitPct * 100).toFixed(2)}%`,
          priority: 6,
        });
      }
    }
    if (momentum.rsi > CONFIG.RSI_OVERBOUGHT && qty > 3) {
      signals.push({
        ticker,
        action: 'sell',
        amount: Math.floor(qty * 0.2),
        reason: `RSI OVERBOUGHT (${momentum.rsi.toFixed(0)})`,
        priority: 3,
      });
    }
    if (deviation > 25 && qty > 5) {
      signals.push({
        ticker,
        action: 'sell',
        amount: Math.floor(qty * 0.15),
        reason: `OVERWEIGHT +${deviation.toFixed(0)}%`,
        priority: 2,
      });
    }
  }

  signals.sort((a, b) => b.priority - a.priority);
  return signals.slice(0, CONFIG.MAX_TRADES_PER_TICK);
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
  const totalValue = parseFloat(account.equity) || parseFloat(account.portfolio_value) || user.startBalance;

  const clockResult = await getClock(creds);
  const marketOpen = clockResult.success ? clockResult.data.is_open : false;

  const positionsResult = await getPositions(creds);
  const positionsMap = new Map<string, AlpacaPosition>();
  if (positionsResult.success) {
    for (const p of positionsResult.data) positionsMap.set(p.symbol.toUpperCase(), p);
  }

  console.log(
    `[APEX-INNGEST] user=${user.clerkUserId} env=${user.environment} cash=${cash.toFixed(0)} total=${totalValue.toFixed(0)}`
  );

  const signals = await generateSignals(creds, positionsMap, cash, totalValue, marketOpen);

  let totalBought = 0;
  let totalSold = 0;
  const executed: Array<{ ticker: string; action: string; amount: number; orderId?: string; reason: string }> = [];
  let runningCash = cash;

  for (const signal of signals) {
    const priceResult = await getLatestPrice(creds, signal.ticker);
    if (!priceResult.success || priceResult.data <= 0) continue;
    const tradeValue = signal.amount * priceResult.data;

    if (signal.action === 'buy' && tradeValue > runningCash * 0.95) continue;
    if (signal.action === 'sell') {
      const pos = positionsMap.get(signal.ticker.toUpperCase());
      const have = pos ? Math.abs(parseFloat(pos.qty)) : 0;
      if (!pos || have < signal.amount) continue;
    }

    const orderRes = await placeOrder(creds, {
      symbol: signal.ticker,
      qty: signal.amount,
      side: signal.action,
      type: 'market',
      time_in_force: 'day',
    });

    if (orderRes.success) {
      if (signal.action === 'buy') {
        totalBought += tradeValue;
        runningCash -= tradeValue;
      } else {
        totalSold += tradeValue;
        runningCash += tradeValue;
      }
      executed.push({
        ticker: signal.ticker,
        action: signal.action,
        amount: signal.amount,
        orderId: orderRes.data.id,
        reason: signal.reason,
      });
    }
  }

  return {
    clerkUserId: user.clerkUserId,
    env: user.environment,
    marketOpen,
    signals: signals.length,
    executed: executed.length,
    totalBought,
    totalSold,
  };
}

export const apexQuantumTick = inngest.createFunction(
  {
    id: 'apex-quantum-tick',
    name: 'APEX QUANTUM v8 Per-User Trading Tick (Alpaca)',
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
      return { version: 'APEX QUANTUM v8', mode: 'multi-user', users: 0 };
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

    await step.run('purge', async () => {
      clearDebugLog();
      priceHistory.clear();
      return { purged: true };
    });

    return { version: 'APEX QUANTUM v8', mode: 'multi-user', users: users.length, results };
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
        portfolioValue,
        pnl,
        pnlPercent,
        openPositions,
        strategyAdjustment,
        message,
        timestamp: new Date().toISOString(),
      };
    });

    console.log(`[APEX-META] Strategy: ${analysis.strategyAdjustment} | P/L: ${analysis.pnlPercent.toFixed(2)}%`);
    return analysis;
  }
);

export const functions = [apexQuantumTick, apexMetaCognition];
