// Read-only: returns the user's most recent Alpaca orders for the dashboard.
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getOrders } from '@/lib/alpaca';

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
    const ts = o.submitted_at ? new Date(o.submitted_at) : null;
    const time = ts
      ? ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—';
    const price = Number(o.filled_avg_price ?? '0') || 0;
    const qty = Number(o.filled_qty ?? o.qty ?? '0') || 0;
    const status: 'OK' | 'ERR' = o.status === 'filled' ? 'OK' : o.status === 'rejected' || o.status === 'canceled' ? 'ERR' : 'OK';
    return {
      time,
      ticker: o.symbol,
      action: (o.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
      qty,
      price,
      status,
      reason: o.type,
    };
  });
  return NextResponse.json({ orders });
}
