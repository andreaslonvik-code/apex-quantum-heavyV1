import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  getAccount,
  getAccountConfigurations,
  getClock,
  getOrders,
  getPositions,
  type AlpacaCreds,
  type AlpacaOrder,
} from '@/lib/alpaca';
import { isAdmin } from '@/lib/access';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Comprehensive Alpaca account diagnostic. Hit while logged in to surface:
 *   - Full account state (cash, all buying-power variants, margin, restrictions)
 *   - Account configurations (fractional flag, PDT, etc.)
 *   - Open orders with notional amounts (locked BP)
 *   - Recent rejected/canceled orders with rejection reasons
 *   - Computed BP analysis (theoretical vs actual)
 *   - Market clock state
 *
 * Use this when orders are getting rejected to understand WHY.
 */
export async function GET() {
  // H7 fix — admin-gate. The diagnostic returns raw Alpaca error bodies
  // (account numbers, internal IDs, rate-limit headers) that aid attackers
  // even when the user owns the Alpaca account. Customers don't need this.
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 });
  }
  const c = await getRequestCreds();
  if (!c) {
    return NextResponse.json({ error: 'Not connected to Alpaca' }, { status: 401 });
  }
  const creds: AlpacaCreds = {
    apiKey: c.apiKey,
    apiSecret: c.apiSecret,
    env: c.environment,
  };

  const [accountRes, configRes, clockRes, openOrdersRes, allOrdersRes, positionsRes] =
    await Promise.all([
      getAccount(creds),
      getAccountConfigurations(creds),
      getClock(creds),
      getOrders(creds, { status: 'open', limit: 200 }),
      getOrders(creds, { status: 'all', limit: 100 }),
      getPositions(creds),
    ]);

  const account = accountRes.success ? accountRes.data : null;
  const config = configRes.success ? configRes.data : null;
  const clock = clockRes.success ? clockRes.data : null;
  const openOrders = openOrdersRes.success ? openOrdersRes.data : [];
  const allOrders = allOrdersRes.success ? allOrdersRes.data : [];
  const positions = positionsRes.success ? positionsRes.data : [];

  // Open BUY orders lock buying power. Sum their notional.
  const openBuyOrders = openOrders.filter((o) => o.side === 'buy');
  const lockedNotional = openBuyOrders.reduce((sum, o) => {
    const n = parseFloat(o.notional ?? '0');
    if (n > 0) return sum + n;
    // Estimate from qty × limit/last (no real-time price here, so use limit)
    const q = parseFloat(o.qty ?? '0');
    const lp = parseFloat(o.limit_price ?? '0');
    if (q > 0 && lp > 0) return sum + q * lp;
    return sum;
  }, 0);

  // Recent rejected/canceled/expired orders — these are the rejected attempts.
  const rejected = allOrders
    .filter(
      (o) =>
        o.status === 'rejected' ||
        o.status === 'canceled' ||
        o.status === 'expired' ||
        o.status === 'failed',
    )
    .slice(0, 30)
    .map((o: AlpacaOrder) => ({
      submitted_at: o.submitted_at,
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
      notional: o.notional,
      status: o.status,
      type: o.type,
      reject_reason: o.reject_reason ?? null,
      failure_reason: o.failure_reason ?? null,
      canceled_at: o.canceled_at ?? null,
      failed_at: o.failed_at ?? null,
    }));

  // Recent fills — what actually went through.
  const filled = allOrders
    .filter((o) => o.status === 'filled')
    .slice(0, 30)
    .map((o: AlpacaOrder) => ({
      filled_at: o.filled_at,
      symbol: o.symbol,
      side: o.side,
      filled_qty: o.filled_qty,
      filled_avg_price: o.filled_avg_price,
      notional: o.notional,
      type: o.type,
    }));

  // Buying-power math.
  const cash = account ? parseFloat(account.cash) || 0 : 0;
  const equity = account ? parseFloat(account.equity) || 0 : 0;
  const buyingPower = account ? parseFloat(account.buying_power) || 0 : 0;
  const nonMarginable = account
    ? parseFloat(account.non_marginable_buying_power ?? '0') || cash
    : 0;
  const positionsValue = positions.reduce(
    (sum, p) => sum + (parseFloat(p.market_value) || 0),
    0,
  );

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    account_summary: {
      environment: c.environment,
      account_id: account?.id ?? null,
      account_number: account?.account_number ?? null,
      status: account?.status ?? null,
      currency: account?.currency ?? null,
      trading_blocked: account?.trading_blocked ?? null,
      account_blocked: account?.account_blocked ?? null,
      shorting_enabled: account?.shorting_enabled ?? null,
      multiplier: account?.multiplier ?? null,
      cash: cash,
      equity: equity,
      portfolio_value: account ? parseFloat(account.portfolio_value) || 0 : 0,
      // Field of record for sizing — the running intraday buying-power calc
      // under Alpaca's 2026 intraday-margin framework.
      buying_power: buyingPower,
      non_marginable_buying_power: nonMarginable,
      regt_buying_power: account?.regt_buying_power ?? null,
      effective_buying_power: account?.effective_buying_power ?? null,
      initial_margin: account?.initial_margin ?? null,
      maintenance_margin: account?.maintenance_margin ?? null,
      // Deprecated by Alpaca's PDT-retirement (removed 2026-07-06). Echoed
      // for continuity while the fields linger; not used for any decision.
      // After removal these resolve to null/false and can be dropped.
      deprecated_pdt_fields: {
        pattern_day_trader: account?.pattern_day_trader ?? null,
        daytrading_buying_power: account?.daytrading_buying_power ?? null,
      },
    },
    bp_analysis: {
      theoretical_cash_available: cash - positionsValue,
      locked_by_open_buys: lockedNotional,
      effective_for_new_orders: Math.max(0, nonMarginable - lockedNotional),
      open_buy_count: openBuyOrders.length,
    },
    account_config: {
      fractional_trading: config?.fractional_trading ?? null,
      no_shorting: config?.no_shorting ?? null,
      suspend_trade: config?.suspend_trade ?? null,
      max_margin_multiplier: config?.max_margin_multiplier ?? null,
      pdt_check: config?.pdt_check ?? null,
      dtbp_check: config?.dtbp_check ?? null,
    },
    market: {
      is_open: clock?.is_open ?? null,
      next_open: clock?.next_open ?? null,
      next_close: clock?.next_close ?? null,
    },
    positions_held: positions.map((p) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty) || 0,
      avg_entry: parseFloat(p.avg_entry_price) || 0,
      current_price: parseFloat(p.current_price) || 0,
      market_value: parseFloat(p.market_value) || 0,
      unrealized_pnl: parseFloat(p.unrealized_pl) || 0,
    })),
    open_orders: openOrders.map((o) => ({
      submitted_at: o.submitted_at,
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
      notional: o.notional,
      status: o.status,
      type: o.type,
    })),
    recent_rejections: rejected,
    recent_fills: filled,
    fetch_errors: {
      account: accountRes.success ? null : accountRes.error,
      config: configRes.success ? null : configRes.error,
      open_orders: openOrdersRes.success ? null : openOrdersRes.error,
      all_orders: allOrdersRes.success ? null : allOrdersRes.error,
      positions: positionsRes.success ? null : positionsRes.error,
    },
  });
}
