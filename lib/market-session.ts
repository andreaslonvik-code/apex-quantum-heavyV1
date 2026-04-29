// US equity market session classifier.
//
// Alpaca's clock endpoint reports `is_open` for regular hours only
// (09:30-16:00 ET, weekdays, ex holidays). For extended-hours trading we
// need to also detect premarket (04:00-09:30 ET) and afterhours
// (16:00-20:00 ET). This helper classifies the current ET wall time into
// one of four sessions.
//
// Holiday detection: we trust Alpaca's `next_open` / `next_close` on the
// clock — if `is_open === false` and the next_open is many hours/days
// away, we're either in extended hours OR a holiday/weekend. We
// cross-check with the local ET hour to disambiguate.

import type { AlpacaClock } from './alpaca';

export type MarketSession = 'closed' | 'premarket' | 'regular' | 'afterhours';

const PREMARKET_OPEN_MIN  = 4 * 60;          // 04:00 ET
const REGULAR_OPEN_MIN    = 9 * 60 + 30;     // 09:30 ET
const REGULAR_CLOSE_MIN   = 16 * 60;         // 16:00 ET
const AFTERHOURS_CLOSE_MIN = 20 * 60;        // 20:00 ET

/** Current minute-of-day in America/New_York (0..1439). */
function nowMinuteET(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return (h % 24) * 60 + m;
}

function isWeekendET(now: Date): boolean {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).format(now);
  return wd === 'Sat' || wd === 'Sun';
}

/**
 * Classify the current market session. If `clock.is_open === true` we
 * trust Alpaca and return 'regular' (Alpaca handles holidays). Otherwise
 * we use ET wall-time to decide between premarket / afterhours / closed.
 *
 * Holidays during a weekday: Alpaca returns is_open=false and we'd see
 * an ET time inside extended-hours windows. The session classifier would
 * still return 'premarket'/'afterhours' — but Alpaca will reject orders
 * with code 422. Trading code should treat those rejections as a
 * "session closed" condition and skip rather than alert.
 */
export function getMarketSession(clock: AlpacaClock | null, now: Date = new Date()): MarketSession {
  if (clock?.is_open) return 'regular';
  if (isWeekendET(now)) return 'closed';
  const minute = nowMinuteET(now);
  if (minute < 0) return 'closed';
  if (minute >= PREMARKET_OPEN_MIN && minute < REGULAR_OPEN_MIN) return 'premarket';
  if (minute >= REGULAR_CLOSE_MIN && minute < AFTERHOURS_CLOSE_MIN) return 'afterhours';
  return 'closed';
}

/** True iff the session allows order placement (premarket | regular | afterhours). */
export function isSessionTradable(session: MarketSession): boolean {
  return session !== 'closed';
}

/** True iff the session is one of the extended-hours windows. */
export function isExtendedHours(session: MarketSession): boolean {
  return session === 'premarket' || session === 'afterhours';
}
