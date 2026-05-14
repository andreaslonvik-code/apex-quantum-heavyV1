import { clerkClient } from '@clerk/nextjs/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export interface PlusMetadata {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plusStatus?: string;
  plusActivatedAt?: string;
  plusCurrentPeriodEnd?: string;
  plusCancelAtPeriodEnd?: boolean;
  plusCanceledAt?: string;
  plusGrantedManually?: boolean;
}

function asString(v: string | { id: string } | null | undefined): string | undefined {
  if (!v) return undefined;
  return typeof v === 'string' ? v : v.id;
}

export async function patchPlusMetadata(userId: string, patch: PlusMetadata): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as PlusMetadata;
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { ...existing, ...patch },
  });
}

/**
 * Server-side fallback when Stripe webhook hasn't fired yet (e.g. user just
 * returned from checkout). Looks up the session by id, confirms it belongs
 * to the current user and is paid, then patches Clerk metadata directly.
 *
 * Idempotent: safe to call repeatedly. Returns true if metadata was patched
 * (either now or previously), false if the session is invalid or not paid.
 */
export async function verifyCheckoutAndGrantPlus(
  sessionId: string,
  expectedUserId: string,
): Promise<boolean> {
  if (!stripe) return false;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
  } catch {
    return false;
  }

  // Ownership: prevents a logged-in user from claiming Plus by pasting
  // someone else's session_id into the URL.
  const sessionUserId =
    session.client_reference_id || session.metadata?.clerkUserId || null;
  if (sessionUserId !== expectedUserId) return false;

  // Subscription mode + paid status are both required. Other statuses (e.g.
  // `payment_status: 'unpaid'` for invoice-based flows) shouldn't unlock Plus.
  if (session.mode !== 'subscription') return false;
  if (session.payment_status !== 'paid') return false;

  const sub = typeof session.subscription === 'string' ? null : session.subscription;
  const periodEnd = sub?.items.data[0]?.current_period_end;

  await patchPlusMetadata(expectedUserId, {
    stripeCustomerId: asString(session.customer),
    stripeSubscriptionId: asString(session.subscription),
    plusStatus: sub?.status ?? 'active',
    plusActivatedAt: new Date().toISOString(),
    plusCurrentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : undefined,
    plusCancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
  });

  return true;
}
