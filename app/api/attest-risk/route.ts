import { type NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { checkSameOrigin } from '@/lib/csrf';
import { RISK_VERSION } from '@/lib/legal-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Risikoattestasjon (§6 lag 4a) — RAIEAS-reglene krever skriftlig
 * bekreftelse FØR tjenesten leveres. Lagres i Clerk publicMetadata
 * { riskAttestedAt: ISO-streng, riskVersion: RISK_VERSION } slik at
 * attestasjonen vises nøyaktig én gang per bruker per versjon —
 * aldri per sesjon eller per nettleser.
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

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        riskAttestedAt: new Date().toISOString(),
        riskVersion: RISK_VERSION,
      },
    });
    return NextResponse.json({ ok: true, riskVersion: RISK_VERSION });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'attest_failed', detail: msg }, { status: 500 });
  }
}
