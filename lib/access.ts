import { currentUser } from '@clerk/nextjs/server';

export const MAX_ALLOWLIST_EMAILS: readonly string[] = [
  'post@apex-quantum.com',
  'andreas.lonvik@gmail.com',
  'p.lonvik@gmail.com',
];

export async function hasMaxAccess(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const allow = new Set(MAX_ALLOWLIST_EMAILS.map((e) => e.toLowerCase()));
  for (const e of user.emailAddresses) {
    if (allow.has(e.emailAddress.toLowerCase())) return true;
  }
  return false;
}
