import { type NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkSameOrigin } from '@/lib/csrf';
import { RISK_VERSION } from '@/lib/legal-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Risikoattestasjon (§6 lag 4a/4b) — RAIEAS-reglene krever skriftlig
 * bekreftelse FØR tjenesten leveres. Lagres i Clerk publicMetadata slik
 * at attestasjonen vises nøyaktig én gang per bruker per versjon —
 * aldri per sesjon eller per nettleser.
 *
 * Body: { scope: 'plus' | 'max' }
 *  - scope 'plus' (lag 4a, dashboard-onboarding):
 *      { riskAttestedAt: ISO, riskVersion: RISK_VERSION }
 *  - scope 'max' (lag 4b, /connect-alpaca — ATTESTATION + MAX_EXTRA):
 *      { maxRiskAttestedAt: ISO, maxRiskVersion: RISK_VERSION }
 *      + plus-feltene skrives også (Max-attestasjonen er et supersett,
 *      så Plus-sjekken består).
 */
export async function POST(req: NextRequest) {
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const scope: unknown = (body as { scope?: unknown })?.scope;
  if (scope !== 'plus' && scope !== 'max') {
    return NextResponse.json({ error: 'invalid_scope' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const attested =
      scope === 'max'
        ? {
            riskAttestedAt: (existing.riskAttestedAt as string | undefined) ?? now,
            riskVersion: RISK_VERSION,
            maxRiskAttestedAt: now,
            maxRiskVersion: RISK_VERSION,
          }
        : {
            riskAttestedAt: now,
            riskVersion: RISK_VERSION,
          };
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        ...attested,
      },
    });
    return NextResponse.json({ ok: true, scope, riskVersion: RISK_VERSION });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'attest_failed', detail: msg }, { status: 500 });
  }
}
