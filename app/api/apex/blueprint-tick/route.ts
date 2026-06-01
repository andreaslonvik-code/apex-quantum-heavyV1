import { type NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { runScanForUser } from '@/lib/trading/engine';
import { fetchLeaderSnapshot, type LeaderSnapshot } from '@/lib/trading/portfolio-mirror';
import { getUserAlpacaCreds } from '@/lib/user-alpaca';
import { isAdmin } from '@/lib/access';
import { resolveLeaderClerkId } from '@/lib/leader';
import { checkSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Manual trigger for the user's own tick. Used from the dashboard for testing.
 *  Honours the leader-follower model: if this user is not the leader, the
 *  manual tick mirrors the leader's latest decision (same as cron) rather
 *  than spending a Grok call on a follower.
 *
 *  Admin-gated: only emails in `ADMIN_EMAILS` can fire this. Regular beta
 *  customers see decisions roll in on the cron cadence but cannot trigger
 *  ad-hoc Grok ticks — protects against curious customers burning credits
 *  by repeatedly clicking. */
export async function POST(req: NextRequest) {
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 });
  }
  const c = await getRequestCreds();
  if (!c) {
    return NextResponse.json({ error: 'Not connected to Alpaca' }, { status: 401 });
  }
  const leaderId = await resolveLeaderClerkId();
  const isFollower = !!leaderId && leaderId !== c.clerkUserId;
  const signalSource = isFollower ? leaderId : undefined;

  // Followers run in Portfolio Mirror Mode → need leader's snapshot. Fetch
  // leader's creds + Alpaca state on demand so the manual tick gives the
  // same result as the cron tick would.
  let leaderSnapshot: LeaderSnapshot | undefined;
  if (isFollower && leaderId) {
    const leaderCreds = await getUserAlpacaCreds(leaderId);
    if (leaderCreds) {
      const snap = await fetchLeaderSnapshot(
        {
          apiKey: leaderCreds.apiKey,
          apiSecret: leaderCreds.apiSecret,
          env: leaderCreds.environment,
        },
        leaderId,
      );
      leaderSnapshot = snap ?? undefined;
    }
  }

  const result = await runScanForUser(
    { apiKey: c.apiKey, apiSecret: c.apiSecret, env: c.environment },
    c.clerkUserId,
    signalSource,
    leaderSnapshot,
  );
  return NextResponse.json(result);
}
