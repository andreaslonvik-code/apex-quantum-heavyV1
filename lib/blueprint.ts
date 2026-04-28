// Apex Quantum v8 blueprint — single source of truth for the trading universe,
// sector classification, and risk constants. Ported from apex_quantum_v8.py
// (the strategy spec the user signed off on). The autonomous trade route and
// the dashboard both consume this file so they cannot drift out of sync.

// ────────────────────────────────────────────────────────────────────────────
// Sectors → tickers. Order matters only for human readability.
// ────────────────────────────────────────────────────────────────────────────
export const SECTORS = {
  semis:          ['MU', 'AVGO', 'TSM', 'ASML', 'NVDA', 'AMD', 'ARM', 'SMCI', 'INTC', 'QCOM', 'AMAT'],
  ai_apps:        ['PLTR', 'IONQ'],
  datacenter:     ['VRT', 'ETN', 'FIX'],
  megacap_tech:   ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'NFLX'],
  software:       ['ORCL', 'CRM', 'ADBE', 'NOW', 'PANW', 'CRWD', 'SNOW', 'DDOG', 'NET'],
  power:          ['CEG', 'NEE', 'GEV', 'OKLO'],
  energy_oil:     ['XOM', 'CVX', 'EQNR', 'COP', 'OXY', 'SLB', 'EOG'],
  space:          ['RKLB', 'KTOS'],
  staffing:       ['HELP'],
  finance:        ['JPM', 'BAC', 'GS', 'V', 'MA', 'WFC', 'MS', 'BLK', 'AXP', 'SCHW', 'COIN'],
  healthcare:     ['UNH', 'LLY', 'ABBV', 'JNJ', 'PFE', 'MRK', 'TMO', 'ISRG', 'VRTX', 'AMGN'],
  consumer_disc:  ['NKE', 'HD', 'LOW', 'MCD', 'SBUX', 'LULU', 'BKNG', 'UBER', 'ABNB'],
  consumer_stap:  ['COST', 'WMT', 'PG', 'KO', 'PEP', 'PM'],
  industrial:     ['CAT', 'DE', 'UNP', 'BA', 'LMT', 'RTX', 'GE', 'HON', 'FDX'],
  communications: ['DIS', 'T', 'VZ', 'TMUS'],
  materials:      ['FCX', 'NEM', 'LIN'],
  auto:           ['F', 'GM'],
} as const;

export type SectorKey = keyof typeof SECTORS;

// Flat ticker universe (100 tickers across 17 sectors).
export const WATCHLIST: readonly string[] = Object.values(SECTORS).flat();

// Reverse lookup: ticker → sector key. Built once at module load.
export const SYMBOL_TO_SECTOR: Readonly<Record<string, SectorKey>> = (() => {
  const out: Record<string, SectorKey> = {};
  for (const [sector, syms] of Object.entries(SECTORS) as [SectorKey, readonly string[]][]) {
    for (const s of syms) out[s] = sector;
  }
  return out;
})();

if (WATCHLIST.length !== 100) {
  // Fail loud at import time — prevents drift from the spec.
  throw new Error(`Apex blueprint expected 100 tickers, got ${WATCHLIST.length}`);
}

// Display-friendly ticker names — used by the dashboard watchlist. Keep this
// list in sync with the universe; missing entries fall back to the ticker.
export const TICKER_NAME: Readonly<Record<string, string>> = {
  MU: 'Micron Technology',     AVGO: 'Broadcom',         TSM: 'Taiwan Semi',
  ASML: 'ASML Holding',        NVDA: 'NVIDIA Corp',       AMD: 'Advanced Micro',
  ARM: 'Arm Holdings',         SMCI: 'Super Micro',       INTC: 'Intel',
  QCOM: 'Qualcomm',            AMAT: 'Applied Materials',
  PLTR: 'Palantir',            IONQ: 'IonQ',
  VRT: 'Vertiv',               ETN: 'Eaton',              FIX: 'Comfort Systems',
  AAPL: 'Apple',               MSFT: 'Microsoft',         GOOGL: 'Alphabet',
  META: 'Meta Platforms',      AMZN: 'Amazon',            TSLA: 'Tesla',
  NFLX: 'Netflix',
  ORCL: 'Oracle',              CRM: 'Salesforce',         ADBE: 'Adobe',
  NOW: 'ServiceNow',           PANW: 'Palo Alto Networks', CRWD: 'CrowdStrike',
  SNOW: 'Snowflake',           DDOG: 'Datadog',           NET: 'Cloudflare',
  CEG: 'Constellation Energy', NEE: 'NextEra Energy',     GEV: 'GE Vernova',
  OKLO: 'Oklo Inc',
  XOM: 'ExxonMobil',           CVX: 'Chevron',            EQNR: 'Equinor',
  COP: 'ConocoPhillips',       OXY: 'Occidental',         SLB: 'Schlumberger',
  EOG: 'EOG Resources',
  RKLB: 'Rocket Lab',          KTOS: 'Kratos Defense',
  HELP: 'Heritage Global',
  JPM: 'JPMorgan Chase',       BAC: 'Bank of America',    GS: 'Goldman Sachs',
  V: 'Visa',                   MA: 'Mastercard',          WFC: 'Wells Fargo',
  MS: 'Morgan Stanley',        BLK: 'BlackRock',          AXP: 'American Express',
  SCHW: 'Charles Schwab',      COIN: 'Coinbase',
  UNH: 'UnitedHealth',         LLY: 'Eli Lilly',          ABBV: 'AbbVie',
  JNJ: 'Johnson & Johnson',    PFE: 'Pfizer',             MRK: 'Merck',
  TMO: 'Thermo Fisher',        ISRG: 'Intuitive Surgical', VRTX: 'Vertex Pharma',
  AMGN: 'Amgen',
  NKE: 'Nike',                 HD: 'Home Depot',          LOW: "Lowe's",
  MCD: "McDonald's",           SBUX: 'Starbucks',         LULU: 'Lululemon',
  BKNG: 'Booking Holdings',    UBER: 'Uber',              ABNB: 'Airbnb',
  COST: 'Costco',              WMT: 'Walmart',            PG: 'Procter & Gamble',
  KO: 'Coca-Cola',             PEP: 'PepsiCo',            PM: 'Philip Morris',
  CAT: 'Caterpillar',          DE: 'John Deere',          UNP: 'Union Pacific',
  BA: 'Boeing',                LMT: 'Lockheed Martin',    RTX: 'RTX',
  GE: 'GE Aerospace',          HON: 'Honeywell',          FDX: 'FedEx',
  DIS: 'Disney',               T: 'AT&T',                 VZ: 'Verizon',
  TMUS: 'T-Mobile',
  FCX: 'Freeport-McMoRan',     NEM: 'Newmont',            LIN: 'Linde',
  F: 'Ford',                   GM: 'General Motors',
};

// ────────────────────────────────────────────────────────────────────────────
// Risk parameters — ported verbatim from apex_quantum_v8.py.
// Dollar amounts elsewhere; these are pure ratios / counts.
// ────────────────────────────────────────────────────────────────────────────
export const RISK = {
  RISK_PER_TRADE:        0.01,   // 1% of equity per trade
  MAX_SINGLE_POSITION:   0.15,   // 15% per ticker cap
  MAX_SECTOR_EXPOSURE:   0.30,   // 30% per sector cap
  MAX_CONCURRENT_POS:    12,     // hard cap on simultaneous holdings
  DAILY_LOSS_LIMIT:      -0.03,  // halt for the day at -3 %
  PDT_MIN_EQUITY:        25_000, // pattern-day-trader minimum
} as const;

// Mean-reversion strategy thresholds.
export const STRATEGY = {
  DAILY_TREND_LOOKBACK:  200,
  MIN_TREND_STRENGTH:    1.0,    // price/SMA200 ≥ 1.0 → uptrend confirmed
  RSI_PERIOD:            14,
  RSI_OVERSOLD:          30,
  BB_PERIOD:             20,
  BB_STDDEV:             2.0,
  ATR_PERIOD:            14,
  ATR_STOP_MULT:         2.0,
  ATR_TARGET_MULT:       3.0,
  VOL_CAPITULATION_MULT: 1.5,    // current bar volume vs 20-bar avg
} as const;

// v8 filters layered on top of strategy.
export const V8_FILTERS = {
  SKIP_FIRST_MIN:        30,    // first 30 min of session → spreads too wide
  SKIP_LAST_MIN:         30,    // last 30 min → too jumpy
  MAX_SPREAD_BPS:        15,    // reject if (ask-bid)/mid > 0.15 %
  GAP_FILTER_PCT:        5.0,   // reject if today's open gapped > 5 % from prev close
  LIMIT_BUFFER_BPS:      5,     // limit_price = ask + 5 bps
  RATCHET_TRIGGER_PCT:   0.03,  // unrealised ≥ +3 % triggers stop ratchet
  RATCHET_LOCK_PCT:      0.01,  // new SL = entry × 1.01 (lock in ~1R)
  HIGH_VOL_REGIME_PCT:   1.5,   // SPY 14-day ATR / price × 100 > 1.5 → high vol
  HIGH_VOL_SIZE_FACTOR:  0.5,   // halve sizing in high-vol regime
} as const;

export const COOLDOWN_MIN = 30; // per-ticker cooldown after any action

// ────────────────────────────────────────────────────────────────────────────
// Time-of-day helpers (US Eastern Time).
// ────────────────────────────────────────────────────────────────────────────

/** Current minute-of-day in America/New_York (0..1439). null if Date is invalid. */
export function nowMinuteET(now: Date = new Date()): number | null {
  // Intl gives us hh:mm:ss in the target zone without pulling in a tz library.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  // Note: Intl returns "24" instead of "00" for midnight in some locales.
  return ((h % 24) * 60 + m);
}

const MARKET_OPEN_MIN  = 9 * 60 + 30;  // 09:30 ET
const MARKET_CLOSE_MIN = 16 * 60;      // 16:00 ET

/** True iff we're inside the SKIP_FIRST_MIN or SKIP_LAST_MIN windows. */
export function inVolatileWindow(now: Date = new Date()): boolean {
  const m = nowMinuteET(now);
  if (m == null) return false;
  if (m < MARKET_OPEN_MIN || m >= MARKET_CLOSE_MIN) return false; // outside RTH — caller decides
  if (m < MARKET_OPEN_MIN + V8_FILTERS.SKIP_FIRST_MIN) return true;
  if (m >= MARKET_CLOSE_MIN - V8_FILTERS.SKIP_LAST_MIN) return true;
  return false;
}
