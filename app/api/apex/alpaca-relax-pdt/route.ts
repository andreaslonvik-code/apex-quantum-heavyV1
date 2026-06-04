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
 * Relax Alpaca's account-configuration entry checks.
 *
 * Historical context: Alpaca's old defaults checked PDT/DTBP rules at order
 * ENTRY, which rejected legit notional buys with "insufficient buying power"
 * once the account had accumulated day trades intraday — even with plenty of
 * cash. Moving the gate to fill time ("exit") let the engine re-buy after a
 * same-day kill-switch SELL.
 *
 * 2026 intraday-margin framework: FINRA retired the PDT rule, so `pdt_check`
 * is now effectively a no-op (the same-day re-buy friction it caused is gone).
 * `dtbp_check: 'exit'` is still a valid, meaningful setting — it defers the
 * buying-power gate to fill time, which keeps the post-SELL re-buy path clean
 * under the new running intraday-BP model. We keep PATCHing both: pdt_check is
 * harmless going forward, dtbp_check still earns its keep. The new mandatory
 * pre-trade margin-deficit check is separate and is a guardrail we *want*.
 *
 * Note: we intentionally do NOT raise the margin multiplier here — Apex
 * Quantum Max runs 1x/RegT by design; its risk model (ATR-stop, -3 % daily
 * kill-switch, sector caps) is not calibrated for 4x intraday leverage.
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
