import { currentUser } from '@clerk/nextjs/server';
import { hasMaxAccess, hasPlusAccess } from '@/lib/access';
import { PlusComingSoon } from '@/app/components/plus-coming-soon';
import PlusDashboardClient from './plus-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [plusAllowed, maxAllowed, user] = await Promise.all([
    hasPlusAccess(),
    hasMaxAccess(),
    currentUser(),
  ]);
  if (!plusAllowed) return <PlusComingSoon />;
  const meta = (user?.privateMetadata ?? {}) as { stripeCustomerId?: string };
  const hasSubscription = typeof meta.stripeCustomerId === 'string' && meta.stripeCustomerId.length > 0;
  return <PlusDashboardClient allowlisted={maxAllowed} hasSubscription={hasSubscription} />;
}
