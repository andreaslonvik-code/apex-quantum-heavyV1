import { hasMaxAccess } from '@/lib/access';
import { MaxComingSoon } from '@/app/components/max-coming-soon';
import ConnectAlpacaClient from './connect-alpaca-client';

export default async function ConnectAlpacaPage() {
  if (!(await hasMaxAccess())) return <MaxComingSoon />;
  return <ConnectAlpacaClient />;
}
