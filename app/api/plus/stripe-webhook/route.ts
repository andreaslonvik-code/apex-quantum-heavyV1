import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

interface PlusMetadata {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plusStatus?: string;
  plusActivatedAt?: string;
  plusCurrentPeriodEnd?: string;
  plusCancelAtPeriodEnd?: boolean;
  plusCanceledAt?: string;
}

function asString(v: string | { id: string } | null | undefined): string | undefined {
  if (!v) return undefined;
  return typeof v === 'string' ? v : v.id;
}

async function patchUserMetadata(userId: string, patch: PlusMetadata): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as PlusMetadata;
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { ...existing, ...patch },
  });
}

export async function POST(req: NextRequest) {
  if (!stripe) return new NextResponse('stripe_not_configured', { status: 500 });

  const sig = req.headers.get('stripe-signature');
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) return new NextResponse('signature_missing', { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whsec);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new NextResponse(`signature_invalid: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.client_reference_id || session.metadata?.clerkUserId || null;
        if (userId) {
          await patchUserMetadata(userId, {
            stripeCustomerId: asString(session.customer),
            stripeSubscriptionId: asString(session.subscription),
            plusStatus: 'active',
            plusActivatedAt: new Date().toISOString(),
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.clerkUserId || null;
        if (userId) {
          // current_period_end moved from Subscription to SubscriptionItem in
          // recent API versions. Plus is single-item, so the first item's
          // period drives access.
          const periodEnd = sub.items.data[0]?.current_period_end;
          await patchUserMetadata(userId, {
            stripeCustomerId: asString(sub.customer),
            stripeSubscriptionId: sub.id,
            plusStatus: sub.status,
            plusCurrentPeriodEnd: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : undefined,
            plusCancelAtPeriodEnd: sub.cancel_at_period_end,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.clerkUserId || null;
        if (userId) {
          await patchUserMetadata(userId, {
            plusStatus: 'canceled',
            plusCanceledAt: new Date().toISOString(),
            plusCancelAtPeriodEnd: false,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Logged for now; future: notify user via email and update metadata
        // so the dashboard can surface a "betaling feilet"-banner.
        console.warn('[stripe-webhook] payment_failed', event.id);
        break;
      }

      default:
        // Unhandled events are acknowledged so Stripe doesn't retry.
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[stripe-webhook] handler error', event.type, msg);
    // Return 500 so Stripe retries — handler bug, not a signature issue.
    return new NextResponse(`handler_error: ${msg}`, { status: 500 });
  }

  return new NextResponse('ok', { status: 200 });
}
