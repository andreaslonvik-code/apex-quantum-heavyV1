// Read-only: returns the user's most recent Alpaca orders for the dashboard.
//
// Returns ISO timestamps so the client can format in the browser's local
// timezone — Vercel functions run in UTC, so server-side formatting would
// always show times offset from the user's wall clock.
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getOrders } from '@/lib/alpaca';

const FILLED_OK_STATUSES = new Set([
  'filled',
  'partially_filled',
  'new',
  'accepted',
  'pending_new',
  'pending_replace',
  'replaced',
  'done_for_day',
]);
// A broker rejection — Alpaca actively refused the order. This is the only
// bucket that should raise the red "Ordre feilet" banner.
const FAILED_STATUSES = new Set(['rejected', 'suspended']);
// Terminal-but-not-a-failure: the engine routinely cancels its own GTC
// stop-loss orders as housekeeping (after a SELL fills, or when re-sizing a
// position). Surfacing those as "failed" is a false alarm.
const CANCELED_STATUSES = new Set(['canceled', 'expired']);

export async function GET() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json({ orders: [] }, { status: 401 });
  }
  const res = await getOrders(
    { apiKey: userCreds.apiKey, apiSecret: userCreds.apiSecret, env: userCreds.environment },
    { status: 'all', limit: 12 }
  );
  if (!res.success) {
    return NextResponse.json({ orders: [], error: res.error }, { status: res.status || 500 });
  }
  const orders = res.data.map((o) => {
    // Prefer fill data when the order has actually executed; fall back to
    // submitted qty + limit price for pending or partially-filled orders so
    // the dashboard never shows "0 × $0.00".
    const filledQty = Number(o.filled_qty ?? '0') || 0;
    const submittedQty = Number(o.qty ?? '0') || 0;
    const qty = filledQty > 0 ? filledQty : submittedQty;

    const filledPrice = Number(o.filled_avg_price ?? '0') || 0;
    const limitPrice = Number(o.limit_price ?? '0') || 0;
    const price = filledPrice > 0 ? filledPrice : limitPrice;

    let status: 'OK' | 'PENDING' | 'ERR' | 'CANCELED';
    if (o.status === 'filled') status = 'OK';
    else if (FAILED_STATUSES.has(o.status)) status = 'ERR';
    else if (CANCELED_STATUSES.has(o.status)) status = 'CANCELED';
    else if (FILLED_OK_STATUSES.has(o.status)) status = 'PENDING';
    else status = 'PENDING';

    // For a genuine rejection, surface Alpaca's actual explanation
    // (reject_reason / failure_reason) instead of the order TYPE. The old
    // `reason: o.type` showed "stop"/"market" — the order type, never the
    // cause — so the dashboard could not say WHY an order was refused.
    const reason =
      status === 'ERR'
        ? o.reject_reason || o.failure_reason || `Avvist av Alpaca (${o.status})`
        : o.type;

    return {
      // Raw ISO timestamps — client formats in browser locale.
      submittedAt: o.submitted_at,
      filledAt: o.filled_at ?? null,
      ticker: o.symbol,
      action: (o.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
      qty,
      price,
      status,
      reason,
      orderStatus: o.status,
    };
  });
  return NextResponse.json({ orders });
}
