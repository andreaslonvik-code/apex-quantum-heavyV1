/**
 * Per-user Saxo OAuth refresh helper.
 *
 * Saxo access tokens expire (typically ~24h SIM, ~20 min LIVE depending on app).
 * For autonomous trading to keep running per customer, we must refresh
 * proactively before each cron tick.
 *
 * Token endpoints differ between SIM and LIVE — use the user's stored env.
 */
import { updateUserTokens, type SaxoCreds } from './user-saxo';

const TOKEN_URLS = {
  sim: 'https://sim.logonvalidation.net/token',
  live: 'https://live.logonvalidation.net/token',
} as const;

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh if <5 min remaining

/**
 * Returns valid (refreshed if needed) access token for a user.
 * Returns null if refresh failed and current token is also expired.
 *
 * Side effect: writes new tokens back to DB on successful refresh.
 */
export async function ensureFreshToken(
  clerkUserId: string,
  creds: SaxoCreds
): Promise<{ accessToken: string; refreshed: boolean } | null> {
  const expiresAt = creds.expiresAt?.getTime() ?? 0;
  const msUntilExpiry = expiresAt - Date.now();
  const needsRefresh = !expiresAt || msUntilExpiry < REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    return { accessToken: creds.accessToken, refreshed: false };
  }

  if (!creds.refreshToken) {
    // No refresh token stored — token will expire and the user must reconnect.
    // Return current token so cron doesn't crash; let the trade call fail with 401.
    if (msUntilExpiry > 0) {
      return { accessToken: creds.accessToken, refreshed: false };
    }
    console.warn(`[saxo-refresh] No refresh_token for user ${clerkUserId} and access_token expired`);
    return null;
  }

  const clientId = process.env.SAXO_CLIENT_ID;
  const clientSecret = process.env.SAXO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('[saxo-refresh] Missing SAXO_CLIENT_ID / SAXO_CLIENT_SECRET');
    return null;
  }

  const env = creds.environment === 'live' ? 'live' : 'sim';
  const tokenUrl = TOKEN_URLS[env];

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[saxo-refresh] Refresh failed for user ${clerkUserId} (${env}): ${res.status} ${errText.slice(0, 200)}`);
      return null;
    }

    const data: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    } = await res.json();

    const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

    await updateUserTokens(clerkUserId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? creds.refreshToken,
      expiresAt: newExpiresAt,
    });

    console.log(`[saxo-refresh] Refreshed token for user ${clerkUserId} (${env}), expires ${newExpiresAt.toISOString()}`);
    return { accessToken: data.access_token, refreshed: true };
  } catch (err) {
    console.error(`[saxo-refresh] Network error refreshing user ${clerkUserId}:`, err);
    return null;
  }
}
