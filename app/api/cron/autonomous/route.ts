/**
 * Vercel Cron — runs every minute.
 * Iterates over EVERY connected customer, refreshes their token if needed,
 * and triggers an autonomous trading scan against THEIR Saxo account.
 *
 * Authentication: requires Authorization: Bearer ${CRON_SECRET}.
 * Vercel automatically sends this when the route is configured in vercel.json.
 */
import { NextResponse } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-saxo';
import { ensureFreshToken } from '@/lib/saxo-refresh';
import { getSaxoBase, type SaxoEnv } from '@/lib/saxo';

// APEX QUANTUM v6.1 Blueprint - Stocks only, multi-exchange
const APEX_BLUEPRINT: Record<string, {
  uic: number;
  assetType: string;
  saxoSymbol: string;
  vekt: number;
}> = {
  'MU':   { uic: 42315,    assetType: 'Stock', saxoSymbol: 'MU:xnas',   vekt: 40 },
  'CEG':  { uic: 4928320,  assetType: 'Stock', saxoSymbol: 'CEG:xnas',  vekt: 20 },
  'VRT':  { uic: 21608197, assetType: 'Stock', saxoSymbol: 'VRT:xnys',  vekt: 15 },
  'RKLB': { uic: 24083767, assetType: 'Stock', saxoSymbol: 'RKLB:xnas', vekt: 10 },
  'LMND': { uic: 21177364, assetType: 'Stock', saxoSymbol: 'LMND:xnys', vekt: 10 },
  'ABSI': { uic: 24347426, assetType: 'Stock', saxoSymbol: 'ABSI:xnas', vekt: 5 },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function placeOrder(
  base: string,
  token: string,
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  saxoSymbol: string
): Promise<string | null> {
  try {
    const res = await fetch(`${base}/trade/v2/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AccountKey: accountKey,
        Amount: Math.floor(amount),
        AssetType: assetType,
        BuySell: buySell,
        OrderType: 'Market',
        OrderDuration: { DurationType: 'DayOrder' },
        Uic: uic,
        ManualOrder: false,
      }),
    });

    if (!res.ok) {
      console.log(`[CRON] Order FAILED ${saxoSymbol}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    console.log(`[CRON] ${buySell.toUpperCase()} ${amount}x ${saxoSymbol} [${data.OrderId}]`);
    return data.OrderId;
  } catch (e) {
    console.log(`[CRON] Order ERROR ${saxoSymbol}: ${e}`);
    return null;
  }
}

interface UserScanResult {
  clerkUserId: string;
  environment: SaxoEnv;
  ordersAttempted: number;
  ordersExecuted: number;
  errors?: string[];
}

async function scanForUser(user: Awaited<ReturnType<typeof getAllConnectedUsers>>[number]): Promise<UserScanResult> {
  const result: UserScanResult = {
    clerkUserId: user.clerkUserId,
    environment: user.environment,
    ordersAttempted: 0,
    ordersExecuted: 0,
  };

  // Refresh token if needed
  const fresh = await ensureFreshToken(user.clerkUserId, user);
  if (!fresh) {
    result.errors = ['Token expired and refresh failed — user must reconnect'];
    return result;
  }

  const base = getSaxoBase(user.environment);
  const tickers = Object.keys(APEX_BLUEPRINT);

  // Pick 2-4 tickers per minute (per user)
  const shuffled = [...tickers].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));

  for (const ticker of selected) {
    const info = APEX_BLUEPRINT[ticker];
    const action = Math.random() > 0.35 ? 'Buy' : 'Sell';
    const amount = 5 + Math.floor(Math.random() * 15);

    result.ordersAttempted++;
    const orderId = await placeOrder(
      base,
      fresh.accessToken,
      user.accountKey,
      info.uic,
      info.assetType,
      amount,
      action,
      info.saxoSymbol
    );
    if (orderId) result.ordersExecuted++;
  }

  return result;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const users = await getAllConnectedUsers();

  console.log(`[CRON] ====== APEX QUANTUM cron tick — ${users.length} connected user(s) ======`);

  if (users.length === 0) {
    return NextResponse.json({ success: true, users: 0, message: 'No connected users' });
  }

  // Scan each user in parallel — every customer gets their own autonomous tick.
  // Limit concurrency so we don't overwhelm Saxo's per-app rate limits.
  const CONCURRENCY = 5;
  const results: UserScanResult[] = [];
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((u) => scanForUser(u).catch((e) => ({
      clerkUserId: u.clerkUserId,
      environment: u.environment,
      ordersAttempted: 0,
      ordersExecuted: 0,
      errors: [String(e)],
    } as UserScanResult))));
    results.push(...batchResults);
    if (i + CONCURRENCY < users.length) await sleep(500);
  }

  const elapsed = Date.now() - startTime;
  const totals = results.reduce(
    (acc, r) => ({
      attempted: acc.attempted + r.ordersAttempted,
      executed: acc.executed + r.ordersExecuted,
    }),
    { attempted: 0, executed: 0 }
  );

  console.log(`[CRON] Done in ${elapsed}ms — ${totals.executed}/${totals.attempted} orders across ${users.length} users`);

  return NextResponse.json({
    success: true,
    users: users.length,
    totalAttempted: totals.attempted,
    totalExecuted: totals.executed,
    elapsedMs: elapsed,
    perUser: results,
  });
}
