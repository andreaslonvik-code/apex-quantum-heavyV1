/**
 * Per-user scan lock (H3 fix).
 *
 * Prevents two concurrent runScanForUser invocations for the same user from
 * both seeing an empty inFlightTickers and both deploying capital. The risk
 * is small in practice (Vercel cron is singleton) but real on:
 *   - Vercel cron retries after a lambda warm-start hiccup
 *   - A manual /api/apex/blueprint-tick fired while the cron is in-flight
 *   - Multi-instance horizontal scaling (e.g. burst traffic spinning up
 *     multiple lambdas, two of which run scan logic at near-zero offset)
 *
 * Implementation: a Postgres row (`scan_locks`) keyed by clerk_user_id with
 * an `expires_at` TTL. Acquire atomically with `INSERT … ON CONFLICT …
 * WHERE expires_at < NOW()` so a crashed-lambda stale lock auto-clears.
 *
 * In-memory fallback (Map at module scope) catches same-instance races
 * within a warm function — cheaper than the DB round-trip and protective
 * against the most common case (one Vercel lambda, two cron-triggered
 * invocations milliseconds apart). DB lock covers the cross-instance case.
 */
import { createAdminClient } from '@/utils/supabase/admin';

const SCAN_LOCK_TTL_MS = 5 * 60 * 1000; // 5 min — matches Vercel maxDuration

/** In-memory record of locks held by THIS lambda instance. Map<userId, expiresMs>. */
const localLocks = new Map<string, number>();

export interface ScanLockResult {
  acquired: boolean;
  reason?: 'in_progress_local' | 'in_progress_remote' | 'lock_error';
}

export async function tryAcquireScanLock(clerkUserId: string): Promise<ScanLockResult> {
  const nowMs = Date.now();

  // Local fast-path: this lambda instance is already running a scan for
  // this user. No DB round trip needed.
  const localExp = localLocks.get(clerkUserId);
  if (localExp != null && localExp > nowMs) {
    return { acquired: false, reason: 'in_progress_local' };
  }

  const acquiredAt = new Date(nowMs);
  const expiresAt = new Date(nowMs + SCAN_LOCK_TTL_MS);

  try {
    const sb = createAdminClient();
    // First, opportunistically clear any expired row for this user — it's
    // cheap and means a crashed lambda's stale lock doesn't block forever.
    await sb
      .from('scan_locks')
      .delete()
      .eq('clerk_user_id', clerkUserId)
      .lt('expires_at', acquiredAt.toISOString());

    // Now try to INSERT. Unique primary-key constraint on clerk_user_id
    // means at most one concurrent INSERT wins; the other gets 23505.
    const { error } = await sb.from('scan_locks').insert({
      clerk_user_id: clerkUserId,
      acquired_at: acquiredAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (!error) {
      localLocks.set(clerkUserId, expiresAt.getTime());
      return { acquired: true };
    }

    // 23505 = unique_violation → someone else holds the lock.
    if (error.code === '23505') {
      return { acquired: false, reason: 'in_progress_remote' };
    }

    // 42P01 (relation not exists) — migration not applied yet. Don't
    // block trading on a missing lock table; fall through unlocked.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn(
        '[scan-lock] scan_locks table missing — run prisma/supabase-setup.sql to enable concurrent-scan protection. Falling through unlocked.',
      );
      return { acquired: true };
    }

    console.error('[scan-lock] insert error, falling through unlocked:', error.message);
    return { acquired: true };
  } catch (e) {
    // Connection error / transient — fall through unlocked rather than
    // block trading entirely. Better to risk a rare double-scan than to
    // freeze the engine on a DB hiccup.
    console.error('[scan-lock] acquire exception, falling through unlocked:', e);
    return { acquired: true };
  }
}

export async function releaseScanLock(clerkUserId: string): Promise<void> {
  localLocks.delete(clerkUserId);
  try {
    const sb = createAdminClient();
    await sb.from('scan_locks').delete().eq('clerk_user_id', clerkUserId);
  } catch (e) {
    console.error('[scan-lock] release exception:', e);
  }
}
