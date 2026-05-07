import { hasMaxAccess } from '@/lib/access';
import PlusDashboardClient from './plus-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const allowlisted = await hasMaxAccess();
  return <PlusDashboardClient allowlisted={allowlisted} />;
}
