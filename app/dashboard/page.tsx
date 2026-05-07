import { hasMaxAccess, hasPlusAccess } from '@/lib/access';
import { PlusComingSoon } from '@/app/components/plus-coming-soon';
import PlusDashboardClient from './plus-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [plusAllowed, maxAllowed] = await Promise.all([hasPlusAccess(), hasMaxAccess()]);
  if (!plusAllowed) return <PlusComingSoon />;
  return <PlusDashboardClient allowlisted={maxAllowed} />;
}
