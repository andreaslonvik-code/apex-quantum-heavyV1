/**
 * USD ⇄ NOK FX rate fetcher with in-memory cache.
 *
 * Why this exists: Alpaca is USD-only. The UI lets users view their
 * portfolio in NOK as a display preference, but the underlying ledger,
 * orders, withdrawals, and engine math are **always USD**. Conversion
 * happens purely at render time. We never store NOK figures in state
 * or the database — that's how three-different-versions-of-the-same-
 * number bugs are born when FX moves.
 *
 * Source: Frankfurter (api.frankfurter.app). Free, no API key, no rate
 * limit for reasonable use. Backed by ECB reference rates published
 * each business day around 16:00 CET — the same rates a Norwegian bank
 * uses to price retail conversion. ECB-published is more honest than
 * Yahoo's unofficial intraday for showing customers what they'd
 * actually receive.
 *
 * Cache: 15 min in-memory. FX doesn't move 0.5% in 15 min outside of
 * crisis events, and we'd rather show a slightly-stale rate than hammer
 * an external service on every cockpit refresh (every 3s). Falls back
 * to a hardcoded last-known rate if Frankfurter is unreachable, so the
 * UI never breaks — but flags `stale: true` so the badge can warn.
 */

export interface FxRate {
  /** NOK per 1 USD (e.g. 11.07). */
  rate: number;
  /** Unix ms the rate was fetched. */
  ts: number;
  /** ISO date string from ECB (e.g. "2026-05-22"). */
  source_date: string;
  /** True if we returned a hardcoded fallback because the upstream failed. */
  stale: boolean;
}

const CACHE_MS = 15 * 60 * 1000;
// Last sane fallback. Updated occasionally — only used when Frankfurter
// is unreachable, so being a few % off is acceptable for one render.
const FALLBACK_RATE = 11.0;

let cached: FxRate | null = null;
let inflight: Promise<FxRate> | null = null;

async function fetchFromFrankfurter(): Promise<FxRate> {
  const url = 'https://api.frankfurter.app/latest?from=USD&to=NOK';
  const res = await fetch(url, {
    // Server-side fetch — Next will try to cache the response. Force
    // revalidation so a deploy can't get stuck with a months-old rate.
    next: { revalidate: 60 * 15 },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
  const data = (await res.json()) as { date: string; rates: { NOK: number } };
  const rate = data?.rates?.NOK;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Bad rate');
  return {
    rate,
    ts: Date.now(),
    source_date: data.date,
    stale: false,
  };
}

/**
 * Returns the current USD→NOK rate. Always resolves — falls back to a
 * cached or hardcoded value if the upstream is down. Concurrent callers
 * during a fetch share the same promise (no thundering herd).
 */
export async function getUsdNok(): Promise<FxRate> {
  // Fresh enough — serve from cache.
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return cached;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const fresh = await fetchFromFrankfurter();
      cached = fresh;
      return fresh;
    } catch {
      // Upstream failed — keep last good value if we have one, else
      // hardcoded fallback. Either way mark `stale` so the UI can show
      // a warning instead of pretending it's live.
      if (cached) {
        return { ...cached, stale: true };
      }
      return {
        rate: FALLBACK_RATE,
        ts: Date.now(),
        source_date: new Date().toISOString().slice(0, 10),
        stale: true,
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
