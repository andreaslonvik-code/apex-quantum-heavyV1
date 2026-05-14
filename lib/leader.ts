import { clerkClient } from '@clerk/nextjs/server';
import { LEADER_EMAIL } from './access';

// Cache the leader's clerkUserId per warm instance. The email-to-id mapping
// never changes for a given account, so a 10-minute TTL keeps Clerk lookups
// off the hot path while still letting a fresh deploy learn the mapping fast.
const LEADER_CACHE_TTL_MS = 10 * 60 * 1000;
let leaderCache: { id: string | null; expiresAt: number } | null = null;

/**
 * Resolve the singleton leader's clerkUserId. All other signals across the
 * app (Max followers + Plus signal mirror) descend from this user's Grok
 * decisions. `LEADER_CLERK_USER_ID` env var overrides the email lookup for
 * tests and emergency repointing.
 *
 * Returns null if Clerk lookup fails AND no cached value is available.
 * Callers should fall back to per-user signaling in that case (functional
 * but costlier — see `cron/tick`).
 */
export async function resolveLeaderClerkId(): Promise<string | null> {
  const envOverride = process.env.LEADER_CLERK_USER_ID;
  if (envOverride) return envOverride;

  if (leaderCache && leaderCache.expiresAt > Date.now()) {
    return leaderCache.id;
  }
  try {
    const client = await clerkClient();
    const list = await client.users.getUserList({ emailAddress: [LEADER_EMAIL] });
    const id = list.data[0]?.id ?? null;
    leaderCache = { id, expiresAt: Date.now() + LEADER_CACHE_TTL_MS };
    return id;
  } catch {
    return leaderCache?.id ?? null;
  }
}
