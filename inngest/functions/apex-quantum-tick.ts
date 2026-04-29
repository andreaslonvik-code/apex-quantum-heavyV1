// inngest/functions/apex-quantum-tick.ts
// APEX QUANTUM — multi-user Alpaca trading tick. Runs every minute, fans out
// to every connected user, executes 2 ticks ~30 s apart per user.
//
// Strategy mirrors /api/apex/autonomous: scan the full 100-ticker universe,
// generate SELL signals for held positions and BUY candidates for unheld
// names, rank candidates, then place orders within the per-ticker /
// per-sector / max-positions caps from lib/blueprint.ts.
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
  WATCHLIST,
  SYMBOL_TO_SECTOR,
  SECTOR_VOLATILITY,
  RISK,
  SIGNAL,
  type SectorKey,
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

interface BuyCandidate {
  ticker: string;
  amount: number;
  price: number;
  score: number;
  reason: string;
  sector: SectorKey | undefined;
  value: number;
}

interface SellSignal {
  ticker: string;
  amount: number;
  price: number;
  reason: string;
}

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

function generateBuyCandidate(args: {
  ticker: string;
  price: number;
  rsi: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
  dropFromHigh: number;
  cash: number;
  equity: number;
  posValue: number;
  sectorValue: number;
}): BuyCandidate | null {
  const { ticker, price, rsi, trend, dropFromHigh, cash, equity, posValue, sectorValue } = args;
  if (cash < price * 1.5) return null;
  if (trend === 'DOWN') return null;

  const sector = SYMBOL_TO_SECTOR[ticker];
  const vol = sector ? SECTOR_VOLATILITY[sector] : 3;
  const volMul = 1 + (vol - 2) * 0.20;
  const trendMul = trend === 'UP' ? 1.25 : 1.0;

  let score = 0;
  let reason = '';
  if (dropFromHigh >= SIGNAL.DIP_THRESHOLD) {
    const dipStrength = Math.min(5, dropFromHigh / SIGNAL.DIP_THRESHOLD);
    score += dipStrength * 10;
    reason = `DIP -${(dropFromHigh * 100).toFixed(2)}%`;
  }
  if (rsi < SIGNAL.RSI_OVERSOLD) {
    score += (SIGNAL.RSI_OVERSOLD - rsi) * 1.5;
    reason = reason ? `${reason} | RSI ${rsi.toFixed(0)}` : `RSI LOW (${rsi.toFixed(0)})`;
  }
  if (score <= 0) return null;
  score *= trendMul;

  const baseValue = cash * RISK.POSITION_SIZE_PCT * volMul * trendMul;
  const tickerCap = Math.max(0, equity * (RISK.MAX_PER_TICKER_PCT / 100) - posValue);
  const sectorCap = Math.max(0, equity * (RISK.MAX_PER_SECTOR_PCT / 100) - sectorValue);
  const cashCap = cash * 0.95;
  const targetValue = Math.min(baseValue, tickerCap, sectorCap, cashCap);
  const amount = Math.floor(targetValue / price);
  if (amount < 1) return null;

  return { ticker, amount, price, score, reason, sector, value: amount * price };
}

function generateSellSignals(args: {
  ticker: string;
  price: number;
  pos: AlpacaPosition;
  rsi: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
  riseFromLow: number;
  equity: number;
}): SellSignal[] {
  const { ticker, price, pos, rsi, trend, riseFromLow, equity } = args;
  const out: SellSignal[] = [];
  const qty = Math.abs(parseFloat(pos.qty) || 0);
  const avg = parseFloat(pos.avg_entry_price) || 0;
  const posValue = Math.abs(parseFloat(pos.market_value) || 0);
  if (qty < 1) return out;

  const sellTrendMul = trend === 'DOWN' ? 1.3 : trend === 'UP' ? 0.85 : 1.0;

  // REBALANCE — trim oversized positions to free cash for diversification.
  if (equity > 0 && posValue > equity * (RISK.MAX_PER_TICKER_PCT / 100) * 1.2) {
    const overPct = (posValue / equity) * 100 - RISK.MAX_PER_TICKER_PCT;
    out.push({
      ticker,
      amount: Math.max(1, Math.floor(qty * 0.25)),
      price,
      reason: `REBALANCE +${overPct.toFixed(0)}% over cap`,
    });
  }

  if (riseFromLow >= SIGNAL.PEAK_THRESHOLD && qty > 2) {
    const peakStrength = Math.min(5, riseFromLow / SIGNAL.PEAK_THRESHOLD);
    const sellSize = Math.floor(Math.min(qty * 0.4, qty * 0.1 * peakStrength * sellTrendMul));
    if (sellSize > 0) {
      out.push({ ticker, amount: sellSize, price, reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%` });
    }
  }
  if (rsi > SIGNAL.RSI_OVERBOUGHT && qty > 3) {
    out.push({
      ticker,
      amount: Math.floor(qty * 0.25 * sellTrendMul),
      price,
      reason: `RSI HIGH (${rsi.toFixed(0)})`,
    });
  }
  if (avg > 0) {
    const profitPct = (price - avg) / avg;
    if (profitPct >= SIGNAL.PROFIT_TAKE_THRESHOLD) {
      out.push({
        ticker,
        amount: Math.max(1, Math.floor(qty * 0.5)),
        price,
        reason: `PROFIT +${(profitPct * 100).toFixed(2)}%`,
      });
    }
    if (profitPct <= SIGNAL.STOP_LOSS_THRESHOLD) {
      out.push({
        ticker,
        amount: Math.floor(qty * 0.5),
        price,
        reason: `STOPLOSS ${(profitPct * 100).toFixed(2)}%`,
      });
    }
  }
  return out.filter((s) => s.amount > 0);
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

  const positionsResult = await getPositions(creds);
  const positionsByTicker = new Map<string, AlpacaPosition>();
  if (positionsResult.success) {
    for (const p of positionsResult.data) positionsByTicker.set(p.symbol.toUpperCase(), p);
  }

  const sectorValue = new Map<SectorKey, number>();
  for (const pos of positionsByTicker.values()) {
    const sector = SYMBOL_TO_SECTOR[pos.symbol.toUpperCase()];
    if (!sector) continue;
    const v = Math.abs(parseFloat(pos.market_value) || 0);
    sectorValue.set(sector, (sectorValue.get(sector) || 0) + v);
  }

  console.log(
    `[APEX-INNGEST] user=${user.clerkUserId} env=${user.environment} cash=${cash.toFixed(0)} equity=${equity.toFixed(0)}`
  );

  // Pass 1: prices in parallel.
  const priceByTicker = new Map<string, number>();
  await runInChunks(WATCHLIST, RISK.PRICE_FETCH_CONCURRENCY, async (ticker) => {
    const r = await getLatestPrice(creds, ticker);
    if (r.success && r.data > 0) priceByTicker.set(ticker, r.data);
  });

  // Pass 2: score everything.
  const sellSignals: SellSignal[] = [];
  const buyCandidates: BuyCandidate[] = [];
  for (const ticker of WATCHLIST) {
    const price = priceByTicker.get(ticker);
    if (!price) continue;
    const m = analyzeMomentum(ticker, price);
    const dropFromHigh = m.localHigh > 0 ? (m.localHigh - price) / m.localHigh : 0;
    const riseFromLow  = m.localLow  > 0 ? (price - m.localLow) / m.localLow  : 0;
    const pos = positionsByTicker.get(ticker.toUpperCase());

    if (pos) {
      sellSignals.push(...generateSellSignals({ ticker, price, pos, rsi: m.rsi, trend: m.trend, riseFromLow, equity }));
    } else {
      const sector = SYMBOL_TO_SECTOR[ticker];
      const candidate = generateBuyCandidate({
        ticker,
        price,
        rsi: m.rsi,
        trend: m.trend,
        dropFromHigh,
        cash,
        equity,
        posValue: 0,
        sectorValue: sector ? sectorValue.get(sector) || 0 : 0,
      });
      if (candidate) buyCandidates.push(candidate);
    }
  }

  // EXIT — close out legacy positions held outside the universe so cash
  // can flow back to in-universe names. The WATCHLIST loop only iterates
  // known tickers, so anything we hold that isn't on the list (e.g. legacy
  // ABSI/LMND from the old 6-ticker engine) would otherwise be invisible.
  const universeSet = new Set(WATCHLIST);
  for (const [sym, pos] of positionsByTicker) {
    if (universeSet.has(sym)) continue;
    const exitPrice = parseFloat(pos.current_price) || 0;
    const qty = Math.abs(parseFloat(pos.qty) || 0);
    if (exitPrice <= 0 || qty < 1) continue;
    sellSignals.push({
      ticker: sym,
      amount: qty,
      price: exitPrice,
      reason: 'EXIT — utenfor universet',
    });
  }

  buyCandidates.sort((a, b) => b.score - a.score);
  const heldCount = positionsByTicker.size;
  const slotsLeft = Math.max(0, RISK.MAX_POSITIONS - heldCount);
  const sellsAllowedToHit = !marketOpen ? 0 : Math.min(sellSignals.length, RISK.MAX_TRADES_PER_SCAN);
  const buysBudget = Math.max(0, Math.min(slotsLeft, RISK.MAX_TRADES_PER_SCAN - sellsAllowedToHit));

  const acceptedBuys: BuyCandidate[] = [];
  let runningCash = cash;
  const runningSectorValue = new Map<SectorKey, number>(sectorValue);
  for (const c of buyCandidates) {
    if (acceptedBuys.length >= buysBudget) break;
    if (c.sector) {
      const sv = runningSectorValue.get(c.sector) || 0;
      if (sv + c.value > equity * (RISK.MAX_PER_SECTOR_PCT / 100)) continue;
    }
    if (c.value > runningCash * 0.95) continue;
    acceptedBuys.push(c);
    runningCash -= c.value;
    if (c.sector) runningSectorValue.set(c.sector, (runningSectorValue.get(c.sector) || 0) + c.value);
  }

  let totalBought = 0;
  let totalSold = 0;
  const executed: Array<{ ticker: string; action: string; amount: number; orderId?: string; reason: string }> = [];

  if (marketOpen) {
    for (const sig of sellSignals.slice(0, sellsAllowedToHit)) {
      const pos = positionsByTicker.get(sig.ticker.toUpperCase());
      const have = pos ? Math.abs(parseFloat(pos.qty)) : 0;
      if (!pos || have < sig.amount) continue;
      const r = await placeOrder(creds, {
        symbol: sig.ticker,
        qty: sig.amount,
        side: 'sell',
        type: 'market',
        time_in_force: 'day',
      });
      if (r.success) {
        totalSold += sig.amount * sig.price;
        executed.push({ ticker: sig.ticker, action: 'sell', amount: sig.amount, orderId: r.data.id, reason: sig.reason });
      }
    }
  }

  for (const c of acceptedBuys) {
    const r = await placeOrder(creds, {
      symbol: c.ticker,
      qty: c.amount,
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
    });
    if (r.success) {
      totalBought += c.value;
      executed.push({ ticker: c.ticker, action: 'buy', amount: c.amount, orderId: r.data.id, reason: c.reason });
    }
  }

  return {
    clerkUserId: user.clerkUserId,
    env: user.environment,
    marketOpen,
    candidates: buyCandidates.length,
    sellSignals: sellSignals.length,
    executed: executed.length,
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
    // RSI/DIP signals, and each cron invocation only contributes 2 prices
    // (per the 30 s tick cadence). Letting the in-memory Map accumulate
    // across invocations on warm lambdas means signals can actually fire.
    // The 15-minute window inside analyzeMomentum trims old entries so the
    // Map can't grow unbounded.
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
