import { NextResponse, type NextRequest } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import { runScanForUser } from '@/lib/trading/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Vercel cron entrypoint. Runs every minute, fanning out a scan-and-trade
 * pass for every connected user. Each user's scan iterates all three
 * blueprints (stocks / crypto / commodities) scaled by their stored
 * allocation. Per-user errors are isolated.
 *
 * Leader-follower signal model
 * ────────────────────────────
 * When `LEADER_CLERK_USER_ID` env var is set AND that user is connected,
 * only the LEADER calls Grok this tick. Every other connected user is a
 * FOLLOWER — they mirror the leader's latest decision (BUY/SELL/HOLD
 * ticker list) against their own Alpaca account.
 *
 * Cost impact: 1 Grok call per cadence period instead of N (one per
 * connected user). With N=10 connected users, this is ~90% reduction in
 * Grok/Live-Search spend.
 *
 * Per-follower sizing/safety preserved: engine sizes BUYs from each
 * follower's own bucketCapital, and per-follower filters (kill-switch,
 * PDT, friday-blackout, anticipatory, cool-down) still apply.
 *
 * If LEADER_CLERK_USER_ID is unset or the leader isn't connected, every
 * user falls back to self-signaling (original behaviour).
 *
 * Execution order is leader-first (awaited) so followers always see a
 * fresh leader decision when they run.
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
  const leaderId = process.env.LEADER_CLERK_USER_ID || null;
  const leader = leaderId ? users.find((u) => u.clerkUserId === leaderId) ?? null : null;
  const followers = leader ? users.filter((u) => u.clerkUserId !== leader.clerkUserId) : [];

  const runOne = (u: (typeof users)[number], signalSource?: string) =>
    runScanForUser(
      { apiKey: u.apiKey, apiSecret: u.apiSecret, env: u.environment },
      u.clerkUserId,
      signalSource,
    );

  let leaderResult: PromiseSettledResult<Awaited<ReturnType<typeof runScanForUser>>> | null = null;
  if (leader) {
    // Leader runs FIRST (awaited) so followers see a fresh decision.
    leaderResult = await Promise.allSettled([runOne(leader)]).then((r) => r[0]);
  }

  // Followers run in parallel, mirroring leader's signal stream. If no
  // leader is configured/connected, every user runs as a self-signaler.
  const followerOrFallbackList = leader ? followers : users;
  const followerResults = await Promise.allSettled(
    followerOrFallbackList.map((u) => runOne(u, leader?.clerkUserId)),
  );

  const allResults: Array<{ clerkUserId: string; role: 'leader' | 'follower' | 'self' } & (
    | { status: 'ok'; result: Awaited<ReturnType<typeof runScanForUser>> }
    | { status: 'err'; reason: string }
  )> = [];
  if (leader && leaderResult) {
    allResults.push({
      clerkUserId: leader.clerkUserId,
      role: 'leader',
      ...(leaderResult.status === 'fulfilled'
        ? { status: 'ok' as const, result: leaderResult.value }
        : { status: 'err' as const, reason: leaderResult.reason instanceof Error ? leaderResult.reason.message : String(leaderResult.reason) }),
    });
  }
  followerResults.forEach((r, i) => {
    const u = followerOrFallbackList[i];
    allResults.push({
      clerkUserId: u.clerkUserId,
      role: leader ? 'follower' : 'self',
      ...(r.status === 'fulfilled'
        ? { status: 'ok' as const, result: r.value }
        : { status: 'err' as const, reason: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
    });
  });

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    userCount: users.length,
    signalMode: leader ? 'leader-follower' : 'self-signaled',
    leaderConfigured: !!leaderId,
    leaderConnected: !!leader,
    results: allResults,
  });
}
