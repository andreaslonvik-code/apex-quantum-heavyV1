/**
 * Same-origin CSRF guard for state-changing API routes.
 *
 * Clerk session cookies authenticate the user but provide no CSRF defence
 * on their own — a logged-in victim visiting evil.com that submits a form
 * (or just sets an <img src=...> on a GET-accepting endpoint) would have
 * the cookie attached automatically. We block that by requiring the
 * request to originate from our own site.
 *
 * Two header signals are checked, both populated by browsers and resistant
 * to forgery from another origin:
 *   - `sec-fetch-site` — Fetch Metadata spec. `same-origin` and
 *     `same-site` are safe; `cross-site` and `none` (direct nav / no
 *     referrer) are blocked. Supported in every modern browser.
 *   - `origin` (fallback for older browsers / unusual clients) — must
 *     match one of the allowed origins exactly.
 *
 * Routes that NEED to be triggerable cross-origin (Stripe webhook, public
 * read endpoints) must not call this guard.
 */

const ALLOWED_ORIGINS_ENV = process.env.CSRF_ALLOWED_ORIGINS;
const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://apex-quantum.com';

function allowedOrigins(): Set<string> {
  const fromEnv = (ALLOWED_ORIGINS_ENV ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([PUBLIC_ORIGIN, ...fromEnv]);
}

export interface CsrfCheckResult {
  ok: boolean;
  reason?: 'cross-site' | 'unknown-origin' | 'missing-headers';
}

export function checkSameOrigin(req: Request): CsrfCheckResult {
  const fetchSite = req.headers.get('sec-fetch-site');
  // Fetch Metadata is the authoritative signal when present. `same-origin`
  // and `same-site` (subdomain) are allowed. `cross-site` is blocked.
  // `none` means the user typed the URL / followed a bookmark — should
  // not happen for a state-changing API route from JS, so block too.
  if (fetchSite) {
    if (fetchSite === 'same-origin' || fetchSite === 'same-site') return { ok: true };
    return { ok: false, reason: 'cross-site' };
  }
  // Origin fallback for clients without Fetch Metadata. POST requests
  // from a browser ALWAYS include Origin. Same-origin GET may not, but
  // GET should not mutate state — callers should restrict this helper to
  // POST/PUT/PATCH/DELETE methods only.
  const origin = req.headers.get('origin');
  if (!origin) return { ok: false, reason: 'missing-headers' };
  return allowedOrigins().has(origin)
    ? { ok: true }
    : { ok: false, reason: 'unknown-origin' };
}
