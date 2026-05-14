import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe, PLUS_PRICE_ID } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  }
  if (!PLUS_PRICE_ID) {
    return NextResponse.json({ error: 'price_not_configured' }, { status: 500 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const origin = req.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PLUS_PRICE_ID, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      metadata: { clerkUserId: userId },
      subscription_data: { metadata: { clerkUserId: userId } },
      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?checkout=canceled`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      consent_collection: { terms_of_service: 'required' },
      locale: 'auto',
    });

    if (!session.url) {
      return NextResponse.json({ error: 'session_no_url' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'stripe_error', detail: msg }, { status: 502 });
  }
}
