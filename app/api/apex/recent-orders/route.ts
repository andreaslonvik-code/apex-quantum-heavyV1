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
const FAILED_STATUSES = new Set(['rejected', 'canceled', 'expired', 'suspended']);

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

    let status: 'OK' | 'PENDING' | 'ERR';
    if (o.status === 'filled') status = 'OK';
    else if (FAILED_STATUSES.has(o.status)) status = 'ERR';
    else if (FILLED_OK_STATUSES.has(o.status)) status = 'PENDING';
    else status = 'PENDING';

    return {
      // Raw ISO timestamps — client formats in browser locale.
      submittedAt: o.submitted_at,
      filledAt: o.filled_at ?? null,
      ticker: o.symbol,
      action: (o.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
      qty,
      price,
      status,
      reason: o.type,
      orderStatus: o.status,
    };
  });
  return NextResponse.json({ orders });
}
