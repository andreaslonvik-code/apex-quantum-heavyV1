import { currentUser } from '@clerk/nextjs/server';

export const MAX_ALLOWLIST_EMAILS: readonly string[] = [
  'post@apex-quantum.com',
  'andreas.lonvik@gmail.com',
  'andreas.lonvik@icloud.com',
  'p.lonvik@gmail.com',
  // Beta users added 2026-06-29 — granted both Plus + Max (regular users,
  // not admins; see ADMIN_EMAILS below).
  'hakkebo@icloud.com', // Jan Hakkebo
  'eivindrodal@gmail.com', // Eivind Rodal
];

/**
 * Singleton leader email. The cron tick resolves this to a clerkUserId via
 * Clerk, and that user's Grok decisions are mirrored to every other connected
 * user this tick (see `app/api/cron/tick/route.ts`). Pinning the leader by
 * email instead of by env var means the wiring can't silently break when an
 * env var goes missing on a redeploy.
 *
 * Operational requirement: this user must keep their Alpaca account connected
 * (live or paper — either works). If they disconnect, the cron logs
 * `leaderConnected: false` and the system falls back to per-user signaling
 * (each connected user calls Grok independently — costlier but functional).
 */
export const LEADER_EMAIL = 'andreas.lonvik@gmail.com';

/**
 * Admin emails — accounts that can fire manual operations that spend Grok
 * credits (e.g. the "Kjør nå" Grok-thesis button on /max). Deliberately
 * narrower than MAX_ALLOWLIST_EMAILS: regular Max-beta users see the trade
 * results but cannot trigger ad-hoc Grok ticks, which would otherwise blow
 * through credits in seconds if a curious customer keeps clicking.
 */
export const ADMIN_EMAILS: readonly string[] = [
  'post@apex-quantum.com',
  'andreas.lonvik@gmail.com',
  'p.lonvik@gmail.com',
];

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const allow = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));
  for (const e of user.emailAddresses) {
    if (allow.has(e.emailAddress.toLowerCase())) return true;
  }
  return false;
}

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
