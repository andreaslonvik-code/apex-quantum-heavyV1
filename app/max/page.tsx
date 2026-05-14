import { hasMaxAccess, isAdmin } from '@/lib/access';
import { MaxComingSoon } from '@/app/components/max-coming-soon';
import MaxClient from './max-client';

export const dynamic = 'force-dynamic';

export default async function MaxPage() {
  if (!(await hasMaxAccess())) return <MaxComingSoon />;
  const admin = await isAdmin();
  return <MaxClient isAdmin={admin} />;
}
