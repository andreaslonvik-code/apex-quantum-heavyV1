/**
 * Vercel Cron — runs every minute via vercel.json. The production trader.
 * Per connected user, calls the shared trading engine in lib/trading-engine.ts
 * which scans the full 102-ticker universe, generates BUY/SELL signals,
 * caps holdings at 8, and executes orders (with extended-hours adaptation
 * outside regular session hours).
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import { type AlpacaCreds, type AlpacaEnv } from '@/lib/alpaca';
import { runScanForUser } from '@/lib/trading-engine';
import type { MarketSession } from '@/lib/market-session';

interface UserScanResult {
  clerkUserId: string;
  environment: AlpacaEnv;
  session: MarketSession;
  buys: number;
  sells: number;
  executed: number;
  totalBought: number;
  totalSold: number;
  errors?: string[];
}

async function scanForUser(
  user: Awaited<ReturnType<typeof getAllConnectedUsers>>[number],
): Promise<UserScanResult> {
  const creds: AlpacaCreds = {
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
    env: user.environment,
  };
  const r = await runScanForUser({
    creds,
    clerkUserId: user.clerkUserId,
    startBalance: user.startBalance,
  });
  return {
    clerkUserId: user.clerkUserId,
    environment: user.environment,
    session: r.session,
    buys: r.acceptedBuys.length,
    sells: r.acceptedSells.length,
    executed: r.executedTrades.filter((t) => t.status === 'OK').length,
    totalBought: r.totalBought,
    totalSold: r.totalSold,
    errors: r.errors.length ? r.errors : undefined,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const users = await getAllConnectedUsers();

  console.log(`[CRON] APEX QUANTUM scan-and-trade tick — ${users.length} connected user(s)`);

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
            session: 'closed',
            buys: 0, sells: 0, executed: 0, totalBought: 0, totalSold: 0,
            errors: [String(e)],
          }),
        ),
      ),
    );
    results.push(...batchResults);
    if (i + CONCURRENCY < users.length) await sleep(500);
  }

  const elapsed = Date.now() - startTime;
  const totals = results.reduce(
    (acc, r) => ({
      executed: acc.executed + r.executed,
      bought: acc.bought + r.totalBought,
      sold: acc.sold + r.totalSold,
    }),
    { executed: 0, bought: 0, sold: 0 },
  );

  console.log(
    `[CRON] Done in ${elapsed}ms — ${totals.executed} orders, $${totals.bought.toFixed(0)} bought, $${totals.sold.toFixed(0)} sold across ${users.length} users`
  );

  return NextResponse.json({
    success: true,
    blueprint: 'scan-all-trade-best, max 8 holdings',
    users: users.length,
    totalExecuted: totals.executed,
    totalBought: totals.bought,
    totalSold: totals.sold,
    elapsedMs: elapsed,
    perUser: results,
  });
}
