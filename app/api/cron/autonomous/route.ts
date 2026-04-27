/**
 * Vercel Cron — runs every minute.
 * Iterates over EVERY connected Alpaca user and places a small randomised
 * trade batch against THEIR Alpaca account.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel sends this
 * automatically when the cron is configured in vercel.json).
 */
import { NextResponse } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import { placeOrder, getClock, type AlpacaCreds, type AlpacaEnv } from '@/lib/alpaca';

const APEX_BLUEPRINT = ['MU', 'CEG', 'VRT', 'RKLB', 'LMND', 'ABSI'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface UserScanResult {
  clerkUserId: string;
  environment: AlpacaEnv;
  ordersAttempted: number;
  ordersExecuted: number;
  errors?: string[];
}

async function scanForUser(
  user: Awaited<ReturnType<typeof getAllConnectedUsers>>[number]
): Promise<UserScanResult> {
  const result: UserScanResult = {
    clerkUserId: user.clerkUserId,
    environment: user.environment,
    ordersAttempted: 0,
    ordersExecuted: 0,
  };

  const creds: AlpacaCreds = {
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
    env: user.environment,
  };

  // Skip when market closed (Alpaca rejects most non-extended orders outside hours)
  const clock = await getClock(creds);
  if (!clock.success || !clock.data.is_open) {
    result.errors = ['Market closed'];
    return result;
  }

  // Pick 2-4 tickers per user per tick
  const shuffled = [...APEX_BLUEPRINT].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));

  for (const symbol of selected) {
    const side: 'buy' | 'sell' = Math.random() > 0.35 ? 'buy' : 'sell';
    const qty = 1 + Math.floor(Math.random() * 5);
    result.ordersAttempted++;

    const orderRes = await placeOrder(creds, {
      symbol,
      qty,
      side,
      type: 'market',
      time_in_force: 'day',
    });

    if (orderRes.success) result.ordersExecuted++;
    else {
      result.errors = result.errors || [];
      result.errors.push(`${symbol} ${side}: ${orderRes.error}`);
    }
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

  console.log(`[CRON] APEX QUANTUM cron tick — ${users.length} connected user(s)`);

  if (users.length === 0) {
    return NextResponse.json({ success: true, users: 0, message: 'No connected users' });
  }

  const CONCURRENCY = 5;
  const results: UserScanResult[] = [];
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((u) =>
        scanForUser(u).catch(
          (e): UserScanResult => ({
            clerkUserId: u.clerkUserId,
            environment: u.environment,
            ordersAttempted: 0,
            ordersExecuted: 0,
            errors: [String(e)],
          })
        )
      )
    );
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

  console.log(
    `[CRON] Done in ${elapsed}ms — ${totals.executed}/${totals.attempted} orders across ${users.length} users`
  );

  return NextResponse.json({
    success: true,
    users: users.length,
    totalAttempted: totals.attempted,
    totalExecuted: totals.executed,
    elapsedMs: elapsed,
    perUser: results,
  });
}
