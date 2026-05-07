import { hasMaxAccess } from '@/lib/access';
import { MaxComingSoon } from '@/app/components/max-coming-soon';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!(await hasMaxAccess())) return <MaxComingSoon />;
  return <DashboardClient />;
}
