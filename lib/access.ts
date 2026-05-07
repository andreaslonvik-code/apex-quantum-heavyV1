import { currentUser } from '@clerk/nextjs/server';

export const MAX_ALLOWLIST_EMAILS: readonly string[] = [
  'post@apex-quantum.com',
  'andreas.lonvik@gmail.com',
  'p.lonvik@gmail.com',
];

async function isAllowlisted(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const allow = new Set(MAX_ALLOWLIST_EMAILS.map((e) => e.toLowerCase()));
  for (const e of user.emailAddresses) {
    if (allow.has(e.emailAddress.toLowerCase())) return true;
  }
  return false;
}

export async function hasMaxAccess(): Promise<boolean> {
  return isAllowlisted();
}

/**
 * Plus access during the closed beta is the same allowlist as Max. Once Stripe
 * payments are live, this check should also accept users with an active Plus
 * subscription. Keep the function separate from `hasMaxAccess` so the two can
 * diverge without touching call sites.
 */
export async function hasPlusAccess(): Promise<boolean> {
  return isAllowlisted();
}
