// APEX QUANTUM — Autonomous Trading Engine (Alpaca, on-demand variant)
//
// Strategy: scan the full 100-ticker universe in parallel, score each ticker
// by its short-term momentum + reversal signals, then place orders only on
// the strongest opportunities — bounded by per-ticker, per-sector and
// concurrent-position caps from lib/blueprint.ts.
//
// SELL signals (PEAK / RSI HIGH / PROFIT / STOPLOSS) always run first against
// existing positions. BUY signals (DIP / RSI LOW) compete for the remaining
// slots, ranked by score and trimmed to fit the risk caps. The same logic
// runs every minute as a cron in inngest/functions/apex-quantum-tick.ts.
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
  WATCHLIST,
  SYMBOL_TO_SECTOR,
  SECTOR_VOLATILITY,
  TICKER_NAME,
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
  const rsi = calculateRSI(recent);
  const avgRecent = fiveMin.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMin.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMin.length);
  const trend: 'UP' | 'DOWN' | 'NEUTRAL' =
    avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  return { rsi, localHigh, localLow, trend };
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

  const sector = SYMBOL_TO_SECTOR[ticker];
  const vol = sector ? SECTOR_VOLATILITY[sector] : 3;
  const volMul = 1 + (vol - 2) * 0.20;

  // Trend bias — lean into UP, throttle DOWN. We never enter a fresh BUY on
  // a clear DOWN trend; reactive selling handles that side.
  if (trend === 'DOWN') return null;
  const trendMul = trend === 'UP' ? 1.25 : 1.0;

  // Score components — strongest signal wins. Weighted so that a mild DIP
  // doesn't outscore a deep RSI capitulation, and vice versa.
  let score = 0;
  let reason = '';
  if (dropFromHigh >= SIGNAL.DIP_THRESHOLD) {
    const dipStrength = Math.min(5, dropFromHigh / SIGNAL.DIP_THRESHOLD);
    score += dipStrength * 10;
    reason = `DIP -${(dropFromHigh * 100).toFixed(2)}%`;
  }
  if (rsi < SIGNAL.RSI_OVERSOLD) {
    score += (SIGNAL.RSI_OVERSOLD - rsi) * 1.5;
    reason = reason
      ? `${reason} | RSI ${rsi.toFixed(0)}`
      : `RSI LOW (${rsi.toFixed(0)})`;
  }
  if (score <= 0) return null;
  score *= trendMul;

  // Cap candidate size by cash, per-ticker pct of equity, and any sector room.
  const baseValue = cash * RISK.POSITION_SIZE_PCT * volMul * trendMul;
  const tickerCap = Math.max(0, equity * (RISK.MAX_PER_TICKER_PCT / 100) - posValue);
  const sectorCap = Math.max(0, equity * (RISK.MAX_PER_SECTOR_PCT / 100) - sectorValue);
  const cashCap = cash * 0.95;
  const targetValue = Math.min(baseValue, tickerCap, sectorCap, cashCap);
  const amount = Math.floor(targetValue / price);
  if (amount < 1) return null;

  return {
    ticker,
    amount,
    price,
    score,
    reason,
    sector,
    value: amount * price,
  };
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

  // REBALANCE — trim positions that exceed the per-ticker cap by more than
  // 20 % of the cap. This frees cash so the engine can diversify across the
  // wider universe instead of staying stuck in oversized legacy holdings.
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
    // ── Account snapshot ────────────────────────────────────────────────
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

    // ── Daily loss kill switch ─────────────────────────────────────────
    const dailyPnl = initialValue > 0 ? equity / initialValue - 1 : 0;
    if (dailyPnl <= RISK.DAILY_LOSS_LIMIT) {
      return NextResponse.json({
        success: true,
        haltedReason: `Daglig tapsgrense nådd (${(dailyPnl * 100).toFixed(2)}%)`,
        signals: [],
        executedTrades: [],
        stats: zeroStats(equity, initialValue, cash),
      });
    }

    // ── Market clock ───────────────────────────────────────────────────
    const clockResult = await getClock(creds);
    const marketOpen = clockResult.success ? clockResult.data.is_open : false;

    // ── Positions ──────────────────────────────────────────────────────
    const positionsResult = await getPositions(creds);
    const positionsByTicker = new Map<string, AlpacaPosition>();
    if (positionsResult.success) {
      for (const p of positionsResult.data) positionsByTicker.set(p.symbol.toUpperCase(), p);
    }

    // Sector exposure tally — used for the per-sector cap on new entries.
    const sectorValue = new Map<SectorKey, number>();
    for (const pos of positionsByTicker.values()) {
      const sym = pos.symbol.toUpperCase();
      const sector = SYMBOL_TO_SECTOR[sym];
      if (!sector) continue;
      const v = Math.abs(parseFloat(pos.market_value) || 0);
      sectorValue.set(sector, (sectorValue.get(sector) || 0) + v);
    }

    // ── Pass 1: fetch every price in parallel chunks ──────────────────
    const priceByTicker = new Map<string, number>();
    await runInChunks(WATCHLIST, RISK.PRICE_FETCH_CONCURRENCY, async (ticker) => {
      const r = await getLatestPrice(creds, ticker);
      if (r.success && r.data > 0) priceByTicker.set(ticker, r.data);
    });

    // ── Pass 2: score every ticker, collect SELL + BUY candidates ─────
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

    // ── EXIT — close out legacy positions held outside the universe.
    // The WATCHLIST loop above only iterates known tickers, so anything we
    // hold that isn't on the list (e.g. legacy ABSI/LMND from the old
    // 6-ticker engine) would be invisible to the engine. Here we explicitly
    // tell it to liquidate them so cash can flow back to in-universe names.
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

    // ── Rank BUYs and trim to caps ─────────────────────────────────────
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
      // Re-check sector cap with running tally so successive buys honour it.
      if (c.sector) {
        const sv = runningSectorValue.get(c.sector) || 0;
        if (sv + c.value > equity * (RISK.MAX_PER_SECTOR_PCT / 100)) continue;
      }
      if (c.value > runningCash * 0.95) continue;
      acceptedBuys.push(c);
      runningCash -= c.value;
      if (c.sector) runningSectorValue.set(c.sector, (runningSectorValue.get(c.sector) || 0) + c.value);
    }

    // ── Execute ─────────────────────────────────────────────────────────
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

    // SELLs first (only when market is open — Alpaca rejects sells when closed).
    if (marketOpen) {
      for (const sig of sellSignals.slice(0, sellsAllowedToHit)) {
        const pos = positionsByTicker.get(sig.ticker.toUpperCase());
        const have = pos ? Math.abs(parseFloat(pos.qty)) : 0;
        if (!pos || have < sig.amount) continue;
        const tradeValue = sig.amount * sig.price;

        const r = await placeOrder(creds, {
          symbol: sig.ticker,
          qty: sig.amount,
          side: 'sell',
          type: 'market',
          time_in_force: 'day',
        });
        if (r.success) {
          totalSold += tradeValue;
          executedTrades.push({
            ticker: sig.ticker, symbol: sig.ticker, action: 'SELL',
            amount: sig.amount, price: sig.price, value: tradeValue,
            orderId: r.data.id, status: 'OK', reason: sig.reason,
          });
        } else {
          executedTrades.push({
            ticker: sig.ticker, symbol: sig.ticker, action: 'SELL',
            amount: sig.amount, price: sig.price, value: tradeValue,
            status: 'FEIL', reason: r.error,
          });
        }
      }
    }

    // BUYs.
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
        executedTrades.push({
          ticker: c.ticker, symbol: c.ticker, action: 'BUY',
          amount: c.amount, price: c.price, value: c.value,
          orderId: r.data.id, status: 'OK', reason: c.reason,
        });
      } else {
        executedTrades.push({
          ticker: c.ticker, symbol: c.ticker, action: 'BUY',
          amount: c.amount, price: c.price, value: c.value,
          status: 'FEIL', reason: r.error,
        });
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: userCreds.environment,
      marketOpen,
      universeSize: WATCHLIST.length,
      scored: buyCandidates.length,
      signals: [
        ...sellSignals.slice(0, sellsAllowedToHit).map((s) => ({
          ticker: s.ticker, symbol: s.ticker, action: 'SELL', amount: s.amount, reason: s.reason,
        })),
        ...acceptedBuys.map((c) => ({
          ticker: c.ticker, symbol: c.ticker, action: 'BUY', amount: c.amount, reason: c.reason,
        })),
      ],
      executedTrades,
      portfolio: Array.from(positionsByTicker.values()).map((pos) => {
        const sym = pos.symbol.toUpperCase();
        return {
          ticker: sym,
          symbol: sym,
          navn: TICKER_NAME[sym] || sym,
          vekt: equity > 0 ? (Math.abs(parseFloat(pos.market_value) || 0) / equity) * 100 : 0,
          aksjon: 'HOLD',
          antall: Math.abs(parseFloat(pos.qty) || 0),
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
        candidates: buyCandidates.length,
        accepted: acceptedBuys.length,
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
