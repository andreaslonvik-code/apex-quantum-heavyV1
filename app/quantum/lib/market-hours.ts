/**
 * Enkel, ærlig NASDAQ-åpningstidslogikk: man–fre 09:30–16:00 ET.
 * DST håndteres av Intl (America/New_York). Amerikanske helligdager
 * dekkes IKKE — statusen er derfor merket som ordinære åpningstider,
 * ikke en garanti for handel. Ingen fabrikkerte «LIVE»-påstander.
 */

const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const OPEN_MIN = 9 * 60 + 30; // 09:30 ET
const CLOSE_MIN = 16 * 60; // 16:00 ET
const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

/** true når NASDAQ er innenfor ordinære åpningstider (man–fre 09:30–16:00 ET). */
export function isNasdaqOpen(now: Date = new Date()): boolean {
  const parts = ET_FMT.formatToParts(now);
  let weekday = '';
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    // Intl kan gi «24» for midnatt med hour12:false i enkelte motorer.
    else if (p.type === 'hour') hour = Number(p.value) % 24;
    else if (p.type === 'minute') minute = Number(p.value);
  }
  if (!WEEKDAYS.has(weekday)) return false;
  const m = hour * 60 + minute;
  return m >= OPEN_MIN && m < CLOSE_MIN;
}
