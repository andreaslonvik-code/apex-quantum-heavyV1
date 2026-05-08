import { type NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-click unsubscribe from the morning-brief email. Token is an HMAC
 * of the Clerk user-id so the link is unforgeable but does not require
 * a logged-in session (legal requirement: unsubscribe must work even if
 * the user has lost their password).
 *
 * Both GET (RFC 8058 List-Unsubscribe link clicks) and POST
 * (List-Unsubscribe-Post one-click) are supported.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const u = req.nextUrl.searchParams.get('u');
  const t = req.nextUrl.searchParams.get('t');
  if (!u || !t) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  const SECRET = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? 'apex-quantum-default';
  const expected = crypto.createHmac('sha256', SECRET).update(u).digest('hex').slice(0, 32);
  // Constant-time compare to dodge timing attacks (paranoid but cheap).
  const a = Buffer.from(t);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(u);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await client.users.updateUserMetadata(u, {
      publicMetadata: { ...existing, plus_email_opt_out: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'unsubscribe_failed', detail: msg }, { status: 500 });
  }

  // Friendly confirmation page rather than raw JSON for human visitors.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Unsubscribed</title>
<style>body{margin:0;background:#05050A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{padding:36px 40px;background:#0a1218;border:1px solid rgba(0,245,255,0.20);border-radius:14px;max-width:440px;text-align:center}
h1{font-size:22px;margin:0 0 12px}p{margin:0;color:rgba(255,255,255,0.7);line-height:1.6}</style></head>
<body><div class="box"><h1>Unsubscribed</h1><p>You will no longer receive the Apex Quantum morning brief by email. You can re-enable it from your Plus dashboard at any time.</p></div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
