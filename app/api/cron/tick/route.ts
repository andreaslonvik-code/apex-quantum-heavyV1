import { NextResponse, type NextRequest } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import { runScanForUser } from '@/lib/trading/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel cron entrypoint. Runs every minute, fanning out a scan-and-trade
 * pass for every connected user. Each user's scan iterates all three
 * blueprints (stocks / crypto / commodities) scaled by their stored
 * allocation. Per-user errors are isolated.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const users = await getAllConnectedUsers();
  const results = await Promise.allSettled(
    users.map((u) =>
      runScanForUser(
        { apiKey: u.apiKey, apiSecret: u.apiSecret, env: u.environment },
        u.clerkUserId,
      ),
    ),
  );

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    userCount: users.length,
    results: results.map((r, i) => ({
      clerkUserId: users[i].clerkUserId,
      ...(r.status === 'fulfilled'
        ? { status: 'ok', result: r.value }
        : { status: 'err', reason: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
    })),
  });
}
