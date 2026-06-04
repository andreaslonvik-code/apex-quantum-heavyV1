import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { checkSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';

/**
 * Stripe Customer Portal — lets the user manage their subscription
 * (cancel, update payment method, view invoices). Required by Norwegian
 * consumer law: the cancellation path must be at least as easy as signup.
 */
export async function POST(req: NextRequest) {
  // CSRF: same-origin guard before creating a billing-portal session.
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
  }
  if (!stripe) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const user = await currentUser();
  const meta = (user?.privateMetadata ?? {}) as Record<string, unknown>;
  const customerId = typeof meta.stripeCustomerId === 'string' ? meta.stripeCustomerId : null;
  if (!customerId) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 404 });
  }

  const origin = req.nextUrl.origin;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'stripe_error', detail: msg }, { status: 502 });
  }
}
