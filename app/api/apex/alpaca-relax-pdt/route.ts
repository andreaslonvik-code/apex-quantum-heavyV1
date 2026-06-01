import { type NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  getAccountConfigurations,
  updateAccountConfigurations,
  type AlpacaCreds,
} from '@/lib/alpaca';
import { checkSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * Relax Alpaca's PDT and Day-Trading-Buying-Power entry checks.
 *
 * Alpaca's defaults check PDT/DTBP rules at order ENTRY, which causes legit
 * notional buys to be rejected with "insufficient buying power" once the
 * account has accumulated day trades intraday — even when cash is plenty.
 *
 * Setting both checks to "exit" moves the gate to fill time so the engine
 * can submit fresh orders after a kill-switch SELL on the same day. PDT
 * flag itself stays — that auto-clears after 5 trade-free days.
 *
 * H1 fix — POST-only (was GET+POST). Accepting GET turned this into a
 * one-click CSRF target via <img src=…/alpaca-relax-pdt> on any page a
 * logged-in victim visited. POST + same-origin check now required.
 */
export async function POST(req: NextRequest) {
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
  }
  const c = await getRequestCreds();
  if (!c) {
    return NextResponse.json({ error: 'Not connected to Alpaca' }, { status: 401 });
  }
  const creds: AlpacaCreds = {
    apiKey: c.apiKey,
    apiSecret: c.apiSecret,
    env: c.environment,
  };

  const before = await getAccountConfigurations(creds);
  const r = await updateAccountConfigurations(creds, {
    pdt_check: 'exit',
    dtbp_check: 'exit',
  });

  return NextResponse.json({
    ok: r.success,
    before: before.success ? before.data : null,
    after: r.success ? r.data : null,
    error: r.success ? null : r.error,
  });
}
