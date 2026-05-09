import { currentUser } from '@clerk/nextjs/server';

export const MAX_ALLOWLIST_EMAILS: readonly string[] = [
  'post@apex-quantum.com',
  'andreas.lonvik@gmail.com',
  'andreas.lonvik@icloud.com',
  'p.lonvik@gmail.com',
];

/**
 * Allowed Stripe subscription statuses that grant Plus access. `trialing`
 * is included so promo periods work; `past_due` is excluded so failed
 * payments revoke access until resolved.
 */
const ACTIVE_PLUS_STATUSES = new Set(['active', 'trialing']);

interface PlusMetadata {
  plusStatus?: string;
  plusCurrentPeriodEnd?: string;
}

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
 * Plus access = beta allowlist OR an active Stripe subscription. The Stripe
 * webhook keeps the user's Clerk privateMetadata in sync; here we just read
 * the cached state so the check stays fast.
 */
export async function hasPlusAccess(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  const allow = new Set(MAX_ALLOWLIST_EMAILS.map((e) => e.toLowerCase()));
  for (const e of user.emailAddresses) {
    if (allow.has(e.emailAddress.toLowerCase())) return true;
  }

  const meta = (user.privateMetadata ?? {}) as PlusMetadata;
  if (!meta.plusStatus || !ACTIVE_PLUS_STATUSES.has(meta.plusStatus)) return false;

  if (meta.plusCurrentPeriodEnd) {
    const end = Date.parse(meta.plusCurrentPeriodEnd);
    if (Number.isFinite(end) && end < Date.now()) return false;
  }
  return true;
}
