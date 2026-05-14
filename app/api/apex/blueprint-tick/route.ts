import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { runScanForUser } from '@/lib/trading/engine';
import { isAdmin } from '@/lib/access';
import { resolveLeaderClerkId } from '@/lib/leader';

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
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 });
  }
  const c = await getRequestCreds();
  if (!c) {
    return NextResponse.json({ error: 'Not connected to Alpaca' }, { status: 401 });
  }
  const leaderId = await resolveLeaderClerkId();
  const signalSource =
    leaderId && leaderId !== c.clerkUserId ? leaderId : undefined;
  const result = await runScanForUser(
    { apiKey: c.apiKey, apiSecret: c.apiSecret, env: c.environment },
    c.clerkUserId,
    signalSource,
  );
  return NextResponse.json(result);
}
