import { currentUser } from '@clerk/nextjs/server';
import { hasMaxAccess, hasPlusAccess } from '@/lib/access';
import { verifyCheckoutAndGrantPlus } from '@/lib/plus-grant';
import { PlusComingSoon } from '@/app/components/plus-coming-soon';
import PlusDashboardClient from './plus-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();

  // Self-heal: when the user returns from Stripe checkout with session_id in
  // the URL, verify the session and patch Clerk metadata directly. This makes
  // first-time access work even if the Stripe webhook is misconfigured or
  // delayed. The webhook continues to be the source of truth for renewals
  // and cancellations.
  //
  // `currentUser()` is request-cached, so the subsequent hasPlusAccess() call
  // would see stale metadata. If we just granted access, bypass the gate.
  let justGranted = false;
  if (user && sp.checkout === 'success' && sp.session_id) {
    justGranted = await verifyCheckoutAndGrantPlus(sp.session_id, user.id);
  }

  const [plusAllowed, maxAllowed] = await Promise.all([
    justGranted ? Promise.resolve(true) : hasPlusAccess(),
    hasMaxAccess(),
  ]);
  if (!plusAllowed) return <PlusComingSoon />;
  // hasSubscription gates the manage-subscription link; if we just granted
  // it's definitely true. Otherwise read from cached user metadata.
  const meta = (user?.privateMetadata ?? {}) as { stripeCustomerId?: string };
  const hasSubscription =
    justGranted ||
    (typeof meta.stripeCustomerId === 'string' && meta.stripeCustomerId.length > 0);
  return <PlusDashboardClient allowlisted={maxAllowed} hasSubscription={hasSubscription} />;
}
