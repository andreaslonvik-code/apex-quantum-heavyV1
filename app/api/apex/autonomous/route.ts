// APEX QUANTUM v8 — Autonomous Trading Engine (Alpaca)
// Mean-reversion across 100 tickers / 17 sectors. Strategy = trend-confirmed
// RSI + Bollinger-band capitulation buy with bracket-limit entry. v8 layers:
//   - time-of-day filter (skip first/last 30 min)
//   - per-symbol spread filter (≤ 15 bps)
//   - overnight gap filter (≤ 5 %)
//   - market-regime sizing (halve in SPY-high-vol)
//   - sector exposure cap (≤ 30 %)
//   - global concurrent-position cap + daily loss kill switch
// Ratchet trailing-stop adjustment lives in /api/apex/manage-positions
// (a separate read-mostly route also called by the dashboard tick).
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  getAccount,
  getClock,
  getPositions,
  getLatestQuote,
  getOrders,
  getStockBars,
  placeOrder,
  replaceOrder,
  type AlpacaCreds,
  type AlpacaBar,
  type AlpacaOrder,
  type AlpacaPosition,
} from '@/lib/alpaca';
import {
  WATCHLIST,
  SYMBOL_TO_SECTOR,
  TICKER_NAME,
  RISK,
  V8_FILTERS,
  inVolatileWindow,
} from '@/lib/blueprint';
import {
  generateEntrySignal,
  detectMarketRegime,
  spreadBps,
  calcPositionSize,
  type EntrySignal,
} from '@/lib/strategy';

interface ExecutedTrade {
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

interface SignalRow {
  ticker: string;
  symbol: string;
  action: 'BUY';
  amount: number;
  reason: string;
  score: number;
}

export async function POST() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json({ error: 'Ikke tilkoblet Alpaca.' }, { status: 401 });
  }
  const creds: AlpacaCreds = {
    apiKey: userCreds.apiKey,
    apiSecret: userCreds.apiSecret,
    env: userCreds.environment,
  };

  const startedAt = Date.now();
  try {
    // ── Account snapshot ─────────────────────────────────────────────────
    const accountRes = await getAccount(creds);
    if (!accountRes.success) {
      return NextResponse.json(
        { error: accountRes.error, code: accountRes.errorCode },
        { status: accountRes.status || 500 }
      );
    }
    const account = accountRes.data;
    if (account.account_blocked || account.trading_blocked) {
      return NextResponse.json(
        { error: 'Alpaca har blokkert kontoen for handel.', code: 'ACCOUNT_BLOCKED' },
        { status: 403 }
      );
    }
    const equity = parseFloat(account.equity) || parseFloat(account.portfolio_value) || 0;
    const buyingPower = parseFloat(account.buying_power) || 0;
    const cash = parseFloat(account.cash) || 0;
    const initialValue = userCreds.startBalance || equity;

    // ── Daily loss kill switch ──────────────────────────────────────────
    const dailyPnl = initialValue > 0 ? equity / initialValue - 1 : 0;
    if (dailyPnl <= RISK.DAILY_LOSS_LIMIT) {
      return NextResponse.json({
        success: true,
        haltedReason: `Daglig tapsgrense nådd (${(dailyPnl * 100).toFixed(2)}%)`,
        signals: [], executedTrades: [], stats: zeroStats(equity, initialValue, cash),
      });
    }

    // ── Market clock + time-of-day filter ───────────────────────────────
    const clockRes = await getClock(creds);
    const marketOpen = clockRes.success ? clockRes.data.is_open : false;
    if (!marketOpen) {
      return NextResponse.json({
        success: true, marketOpen: false,
        haltedReason: 'Markedet er stengt.',
        signals: [], executedTrades: [], stats: zeroStats(equity, initialValue, cash),
      });
    }
    if (inVolatileWindow()) {
      return NextResponse.json({
        success: true, marketOpen: true,
        haltedReason: 'Første/siste 30 min — for vid spread for v8.',
        signals: [], executedTrades: [], stats: zeroStats(equity, initialValue, cash),
      });
    }

    // ── Positions + concurrent cap ──────────────────────────────────────
    const posRes = await getPositions(creds);
    const positions = posRes.success ? posRes.data : [];
    const heldByTicker = new Map(positions.map((p) => [p.symbol.toUpperCase(), p]));

    // ── Ratchet trailing stop (run BEFORE entry scan) ────────────────────
    // Mirrors manage_active_positions() in apex_quantum_v8.py.
    const ratchetActions = await ratchetStops(creds, positions);


    if (heldByTicker.size >= RISK.MAX_CONCURRENT_POS) {
      return NextResponse.json({
        success: true, marketOpen,
        haltedReason: `Maks ${RISK.MAX_CONCURRENT_POS} posisjoner — ingen nye entries.`,
        signals: [], executedTrades: [], stats: zeroStats(equity, initialValue, cash),
      });
    }

    // ── Sector exposure (in % of equity) ────────────────────────────────
    const sectorValue = new Map<string, number>();
    for (const p of positions) {
      const sector = SYMBOL_TO_SECTOR[p.symbol.toUpperCase()];
      if (!sector) continue;
      const v = Math.abs(parseFloat(p.market_value) || 0);
      sectorValue.set(sector, (sectorValue.get(sector) || 0) + v);
    }

    // ── Market regime from SPY daily bars ───────────────────────────────
    const spyBarsRes = await getStockBars(creds, 'SPY', { timeframe: '1Day', limit: 60 });
    const regime = spyBarsRes.success ? detectMarketRegime(spyBarsRes.data) : 'normal';

    // ── Candidate generation ────────────────────────────────────────────
    // Only consider tickers we DON'T already hold (the v8 strategy sizes
    // entries via risk budget — adding to a winner is handled by the ratchet).
    const candidates: Array<{ ticker: string; sig: EntrySignal; ask: number; bid: number }> = [];

    // Throttle: cap how many tickers we touch per scan to stay under the
    // serverless time budget (Alpaca data API rate ≈ 200/min with paper).
    // Quotes are cheap; bars are heavier. We split into a quote-prefilter
    // pass first, then full bars only on the survivors.
    const targets = WATCHLIST.filter((t) => !heldByTicker.has(t));

    // Pass 1: quote prefilter (one quote per symbol, parallel in chunks).
    type Prefiltered = { ticker: string; bid: number; ask: number };
    const quoted: Prefiltered[] = [];
    await runInChunks(targets, 12, async (ticker) => {
      const q = await getLatestQuote(creds, ticker);
      if (!q.success) return;
      const bid = q.data.bid;
      const ask = q.data.ask;
      if (bid <= 0 || ask <= 0) return;
      if (spreadBps(bid, ask) > V8_FILTERS.MAX_SPREAD_BPS) return;
      // Sector cap: if sector already at/above limit, skip.
      const sector = SYMBOL_TO_SECTOR[ticker];
      const sv = sector ? sectorValue.get(sector) || 0 : 0;
      if (sector && equity > 0 && sv / equity >= RISK.MAX_SECTOR_EXPOSURE) return;
      quoted.push({ ticker, bid, ask });
    });

    // Cap how many we evaluate further. Bars are the expensive call.
    const MAX_FULL_EVAL = 25;
    const shortlist = quoted.slice(0, MAX_FULL_EVAL);

    // Pass 2: bars + signal.
    await runInChunks(shortlist, 6, async ({ ticker, bid, ask }) => {
      const [intraRes, dailyRes] = await Promise.all([
        getStockBars(creds, ticker, { timeframe: '5Min', limit: 100 }),
        getStockBars(creds, ticker, { timeframe: '1Day', limit: 250 }),
      ]);
      if (!intraRes.success || !dailyRes.success) return;
      const sig = generateEntrySignal(intraRes.data, dailyRes.data);
      if (!sig) return;
      candidates.push({ ticker, sig, bid, ask });
    });

    candidates.sort((a, b) => b.sig.score - a.sig.score);

    // ── Place bracket-limit orders for highest-score candidates ────────
    const slotsLeft = RISK.MAX_CONCURRENT_POS - heldByTicker.size;
    const executedTrades: ExecutedTrade[] = [];
    const signals: SignalRow[] = [];
    let runningBuyingPower = buyingPower;

    for (const { ticker, sig, ask } of candidates) {
      if (executedTrades.filter((t) => t.status === 'OK').length >= slotsLeft) break;

      const qty = calcPositionSize({
        equity,
        buyingPower: runningBuyingPower,
        price: sig.price,
        atr: sig.atr,
        currentPositionValue: 0,
        regime,
      });
      if (qty < 1) continue;

      const limitPrice = +(ask * (1 + V8_FILTERS.LIMIT_BUFFER_BPS / 10_000)).toFixed(2);

      const reason =
        `RSI ${sig.rsi.toFixed(1)} | BBlo ${sig.bbLower.toFixed(2)} | ` +
        `Vol ${sig.volRatio.toFixed(2)}x | Trend ${sig.trendRatio.toFixed(2)} | ` +
        `Gap ${sig.gap >= 0 ? '+' : ''}${sig.gap.toFixed(2)}% | Regime ${regime}`;

      signals.push({ ticker, symbol: ticker, action: 'BUY', amount: qty, reason, score: sig.score });

      const orderRes = await placeOrder(creds, {
        symbol: ticker,
        qty,
        side: 'buy',
        type: 'limit',
        time_in_force: 'day',
        limit_price: limitPrice,
        order_class: 'bracket',
        take_profit: { limit_price: sig.targetPrice },
        stop_loss: { stop_price: sig.stopPrice },
      });

      const value = qty * limitPrice;
      if (orderRes.success) {
        runningBuyingPower -= value;
        executedTrades.push({
          ticker, symbol: ticker, action: 'BUY', amount: qty, price: limitPrice, value,
          orderId: orderRes.data.id, status: 'OK', reason,
        });
        // Update sector exposure tally so subsequent candidates honour the cap.
        const sector = SYMBOL_TO_SECTOR[ticker];
        if (sector) sectorValue.set(sector, (sectorValue.get(sector) || 0) + value);
      } else {
        executedTrades.push({
          ticker, symbol: ticker, action: 'BUY', amount: qty, price: limitPrice, value,
          status: 'FEIL', reason: orderRes.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode: userCreds.environment,
      marketOpen,
      regime,
      signals,
      executedTrades,
      ratchet: ratchetActions,
      portfolio: positions.map((p) => ({
        ticker: p.symbol,
        symbol: p.symbol,
        navn: TICKER_NAME[p.symbol] || p.symbol,
        vekt: equity > 0 ? (Math.abs(parseFloat(p.market_value) || 0) / equity) * 100 : 0,
        aksjon: 'HOLD',
        antall: Math.abs(parseFloat(p.qty) || 0),
      })),
      stats: {
        baseCapital: initialValue,
        actualTotalValue: equity,
        currentProfit: equity - initialValue,
        tradingCapital: cash,
        marketsOpen: marketOpen ? ['US'] : [],
        totalBought: executedTrades
          .filter((t) => t.action === 'BUY' && t.status === 'OK')
          .reduce((s, t) => s + t.value, 0),
        totalSold: 0,
        successful: executedTrades.filter((t) => t.status === 'OK').length,
        failed: executedTrades.filter((t) => t.status === 'FEIL').length,
        candidates: candidates.length,
        prefiltered: quoted.length,
        evaluated: shortlist.length,
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[autonomous v8] error:', err);
    return NextResponse.json(
      { error: 'Autonomous scan failed', details: String(err) },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function runInChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/**
 * Walk the user's currently-held positions; for each one with unrealised P/L
 * ≥ RATCHET_TRIGGER_PCT, find its bracket child stop-loss order (status=held)
 * and bump the stop_price up to entry × (1 + RATCHET_LOCK_PCT). Returns a
 * per-symbol action log for telemetry.
 */
async function ratchetStops(creds: AlpacaCreds, positions: AlpacaPosition[]) {
  const actions: Array<{ ticker: string; from: number; to: number; reason: string }> = [];
  if (positions.length === 0) return actions;

  const ordersRes = await getOrders(creds, { status: 'open', limit: 200 });
  if (!ordersRes.success) return actions;

  // Index held child stop-loss orders by symbol.
  const stopsBySymbol = new Map<string, AlpacaOrder & { stop_price?: string }>();
  for (const o of ordersRes.data as Array<AlpacaOrder & { status?: string; stop_price?: string }>) {
    if (o.status !== 'held') continue;
    if (!o.stop_price) continue;
    stopsBySymbol.set(o.symbol.toUpperCase(), o);
  }

  for (const p of positions) {
    const entry = parseFloat(p.avg_entry_price) || 0;
    const cur = parseFloat(p.current_price) || 0;
    if (entry <= 0 || cur <= entry) continue;
    const unrealisedPct = cur / entry - 1;
    if (unrealisedPct < V8_FILTERS.RATCHET_TRIGGER_PCT) continue;

    const sl = stopsBySymbol.get(p.symbol.toUpperCase());
    if (!sl || !sl.stop_price) continue;
    const newStop = +(entry * (1 + V8_FILTERS.RATCHET_LOCK_PCT)).toFixed(2);
    const oldStop = parseFloat(sl.stop_price) || 0;
    if (oldStop >= newStop) continue;

    const r = await replaceOrder(creds, sl.id, { stop_price: newStop });
    if (r.success) {
      actions.push({
        ticker: p.symbol,
        from: oldStop,
        to: newStop,
        reason: `+${(unrealisedPct * 100).toFixed(2)}% — locking ~1R`,
      });
    }
  }

  return actions;
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

// Unused export retained so v6 callers expecting an `AlpacaBar`-typed import
// chain don't need to refactor.
export type { AlpacaBar };
