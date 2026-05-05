import {
  type AlpacaBar,
  type AlpacaCreds,
  type AlpacaPosition,
  getAccount,
  getCryptoBars,
  getLatestCryptoPrice,
  getLatestPrice,
  getPositions,
  getStockBars,
  placeOrder,
} from '@/lib/alpaca';
import { BLUEPRINT_LIST, type Blueprint } from '@/lib/blueprints';
import { getUserAllocation } from '@/lib/user-allocation';
import { atr, macd, rsi, sma } from './indicators';

export type TradeAction = 'BUY' | 'SELL';
export type TradeStatus = 'OK' | 'ERR' | 'SKIP';

export interface TradeResult {
  blueprintId: string;
  ticker: string;
  action: TradeAction;
  qty: number;
  price: number;
  status: TradeStatus;
  reason: string;
  error?: string;
}

export interface BlueprintRunResult {
  blueprintId: string;
  bucketCapital: number;
  positionsHeld: number;
  evaluated: number;
  trades: TradeResult[];
  killSwitchTriggered: boolean;
  reason?: string;
}

export interface UserScanResult {
  clerkUserId: string;
  ranAt: string;
  equity: number;
  buyingPower: number;
  blueprints: BlueprintRunResult[];
  error?: string;
}

/** Convert Alpaca crypto-data symbol ("BTC/USD") → trading symbol ("BTCUSD"). */
function tradingSymbol(symbol: string): string {
  return symbol.replace('/', '');
}

/** Convert Alpaca position symbol ("BTCUSD") to a blueprint-watchlist match. */
function normalizePositionSymbol(symbol: string): string {
  // Alpaca returns crypto positions without slash. Try inserting a slash before
  // a 3-letter quote currency so it lines up with the blueprint watchlist.
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]+USD$/.test(symbol) && symbol.length >= 6) {
    return `${symbol.slice(0, -3)}/USD`;
  }
  return symbol;
}

async function fetchBars(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  ticker: string,
) {
  const isCrypto = blueprint.id === 'crypto';
  if (isCrypto) {
    return getCryptoBars(creds, ticker, {
      timeframe: blueprint.params.timeframe,
      limit: blueprint.params.barLimit,
    });
  }
  return getStockBars(creds, ticker, {
    timeframe: blueprint.params.timeframe,
    limit: blueprint.params.barLimit,
  });
}

async function fetchSpot(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  ticker: string,
  bars: AlpacaBar[],
): Promise<number> {
  if (blueprint.id === 'crypto') {
    const r = await getLatestCryptoPrice(creds, ticker);
    if (r.success) return r.data;
  } else {
    const r = await getLatestPrice(creds, ticker);
    if (r.success) return r.data;
  }
  return bars[bars.length - 1]?.c ?? 0;
}

function decideEntryQty(
  bucketCapital: number,
  spotPrice: number,
  atrValue: number,
  params: Blueprint['params'],
  isCrypto: boolean,
): number {
  if (spotPrice <= 0 || atrValue <= 0) return 0;
  const dollarRisk = bucketCapital * params.riskPctPerTrade;
  const stopDistance = params.atrStopMult * atrValue;
  let qty = stopDistance > 0 ? dollarRisk / stopDistance : 0;
  const maxDollar = bucketCapital * (params.maxPctPerPosition / 100);
  qty = Math.min(qty, maxDollar / spotPrice);
  if (qty <= 0) return 0;
  if (isCrypto) {
    return Math.floor(qty * 1_000_000) / 1_000_000;
  }
  return Math.floor(qty);
}

async function runBlueprint(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  bucketCapital: number,
  allPositions: AlpacaPosition[],
  killSwitchOn: boolean,
): Promise<BlueprintRunResult> {
  const isCrypto = blueprint.id === 'crypto';

  const watchlistSet = new Set<string>(blueprint.watchlist);
  const heldByTicker = new Map<string, AlpacaPosition>();
  for (const p of allPositions) {
    const norm = normalizePositionSymbol(p.symbol);
    if (watchlistSet.has(norm)) heldByTicker.set(norm, p);
  }

  const result: BlueprintRunResult = {
    blueprintId: blueprint.id,
    bucketCapital,
    positionsHeld: heldByTicker.size,
    evaluated: 0,
    trades: [],
    killSwitchTriggered: killSwitchOn,
    reason: killSwitchOn ? 'daily_kill_switch' : undefined,
  };

  if (killSwitchOn || bucketCapital <= 0) return result;

  for (const ticker of blueprint.watchlist) {
    result.evaluated += 1;
    try {
      const barsRes = await fetchBars(creds, blueprint, ticker);
      if (!barsRes.success || barsRes.data.length < blueprint.params.atrPeriod + 5) {
        continue;
      }
      const bars = barsRes.data;
      const closes = bars.map((b) => b.c);
      const lastBarClose = closes[closes.length - 1];
      const spot = await fetchSpot(creds, blueprint, ticker, bars);
      const price = spot || lastBarClose;
      if (price <= 0) continue;

      const rsiVal = rsi(closes, 14);
      const atrVal = atr(bars, blueprint.params.atrPeriod);
      if (rsiVal == null || atrVal == null) continue;

      const held = heldByTicker.get(ticker);

      if (held) {
        const qty = parseFloat(held.qty);
        const entry = parseFloat(held.avg_entry_price);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(entry) || entry <= 0) continue;
        const pnlPct = (price - entry) / entry;
        const stopPrice = entry - blueprint.params.atrStopMult * atrVal;

        let reason: string | null = null;
        if (rsiVal >= blueprint.params.rsiOverbought) reason = 'RSI_OVERBOUGHT';
        else if (pnlPct >= blueprint.params.profitTakeThreshold) reason = 'PROFIT_TAKE';
        else if (price <= stopPrice) reason = 'ATR_STOP';

        if (reason) {
          const orderRes = await placeOrder(creds, {
            symbol: tradingSymbol(ticker),
            qty,
            side: 'sell',
            type: 'market',
            time_in_force: isCrypto ? 'gtc' : 'day',
            position_intent: 'sell_to_close',
          });
          result.trades.push({
            blueprintId: blueprint.id,
            ticker,
            action: 'SELL',
            qty,
            price,
            status: orderRes.success ? 'OK' : 'ERR',
            reason,
            error: orderRes.success ? undefined : orderRes.error,
          });
          if (orderRes.success) heldByTicker.delete(ticker);
        }
        continue;
      }

      // ---------- Entry path ----------
      if (heldByTicker.size >= blueprint.params.maxPositions) continue;
      if (rsiVal >= blueprint.params.rsiOversold) continue;

      const sma200 = sma(closes, 200);
      const sma50 = sma(closes, 50);
      const macdRes = macd(closes);
      if (sma50 == null || sma200 == null || macdRes == null) continue;
      // Uptrend confirmation: price above the slower MA.
      if (price < sma200) continue;
      // Momentum confirmation: MACD histogram positive.
      if (macdRes.hist <= 0) continue;

      const qty = decideEntryQty(bucketCapital, price, atrVal, blueprint.params, isCrypto);
      if (qty <= 0) continue;

      const orderRes = await placeOrder(creds, {
        symbol: tradingSymbol(ticker),
        qty,
        side: 'buy',
        type: 'market',
        time_in_force: isCrypto ? 'gtc' : 'day',
        position_intent: 'buy_to_open',
      });
      result.trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'BUY',
        qty,
        price,
        status: orderRes.success ? 'OK' : 'ERR',
        reason: 'RSI_OVERSOLD_UPTREND',
        error: orderRes.success ? undefined : orderRes.error,
      });
      if (orderRes.success) {
        heldByTicker.set(ticker, {
          asset_id: '',
          symbol: ticker,
          exchange: '',
          asset_class: isCrypto ? 'crypto' : 'us_equity',
          qty: String(qty),
          avg_entry_price: String(price),
          side: 'long',
          market_value: String(qty * price),
          cost_basis: String(qty * price),
          unrealized_pl: '0',
          unrealized_plpc: '0',
          current_price: String(price),
        });
      }
    } catch (e) {
      result.trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'BUY',
        qty: 0,
        price: 0,
        status: 'ERR',
        reason: 'EXCEPTION',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  result.positionsHeld = heldByTicker.size;
  return result;
}

/**
 * Scan + trade for one user across all three blueprints. Each blueprint runs
 * with its own bucket capital (equity × allocation %). Returns a structured
 * result for logging / dashboard display.
 */
export async function runScanForUser(
  creds: AlpacaCreds,
  clerkUserId: string,
): Promise<UserScanResult> {
  const ranAt = new Date().toISOString();
  const out: UserScanResult = {
    clerkUserId,
    ranAt,
    equity: 0,
    buyingPower: 0,
    blueprints: [],
  };

  const acctRes = await getAccount(creds);
  if (!acctRes.success) {
    out.error = `account_fetch_failed: ${acctRes.error}`;
    return out;
  }
  const equity = parseFloat(acctRes.data.equity) || 0;
  const lastEquity = parseFloat(
    (acctRes.data as unknown as { last_equity?: string }).last_equity ?? acctRes.data.equity,
  ) || equity;
  const buyingPower = parseFloat(acctRes.data.buying_power) || 0;
  out.equity = equity;
  out.buyingPower = buyingPower;

  const dailyPnlPct = lastEquity > 0 ? (equity - lastEquity) / lastEquity : 0;

  const positionsRes = await getPositions(creds);
  if (!positionsRes.success) {
    out.error = `positions_fetch_failed: ${positionsRes.error}`;
    return out;
  }
  const positions = positionsRes.data;

  const allocation = await getUserAllocation(clerkUserId);

  for (const blueprint of BLUEPRINT_LIST) {
    const allocPct = allocation[blueprint.id] ?? 0;
    const bucketCapital = (equity * allocPct) / 100;
    const killSwitchOn = dailyPnlPct <= blueprint.params.dailyKillSwitchPct;
    const result = await runBlueprint(creds, blueprint, bucketCapital, positions, killSwitchOn);
    out.blueprints.push(result);
  }

  return out;
}
