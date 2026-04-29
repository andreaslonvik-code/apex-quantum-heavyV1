// Apex Quantum trading universe — 100 tickers across 17 sectors. Single source
// of truth shared by the on-demand /api/apex/autonomous route, the Inngest
// per-minute tick worker, and the dashboard watchlist component.
//
// Strategy is "scan all, trade the best": every scan computes signals across
// the whole universe, ranks the candidates, and only places orders for the
// strongest ones — bounded by per-ticker, per-sector, and concurrent-position
// caps. There are no static target weights — allocation emerges from the
// signal strength + risk caps.

export const SECTORS = {
  semis:          ['MU', 'AVGO', 'TSM', 'ASML', 'NVDA', 'AMD', 'ARM', 'SMCI', 'INTC', 'QCOM', 'AMAT'],
  ai_apps:        ['PLTR', 'IONQ'],
  datacenter:     ['VRT', 'ETN', 'FIX'],
  megacap_tech:   ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'NFLX'],
  software:       ['ORCL', 'CRM', 'ADBE', 'NOW', 'PANW', 'CRWD', 'SNOW', 'DDOG', 'NET'],
  power:          ['CEG', 'NEE', 'GEV', 'OKLO', 'TLN'],
  energy_oil:     ['XOM', 'CVX', 'EQNR', 'COP', 'OXY', 'SLB', 'EOG', 'OET'],
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

export const WATCHLIST: readonly string[] = Object.values(SECTORS).flat();

export const SYMBOL_TO_SECTOR: Readonly<Record<string, SectorKey>> = (() => {
  const out: Record<string, SectorKey> = {};
  for (const [sector, syms] of Object.entries(SECTORS) as [SectorKey, readonly string[]][]) {
    for (const s of syms) out[s] = sector;
  }
  return out;
})();

// Per-sector volatility tier (1 = stable, 5 = high beta). Drives sizing in
// the trading loop — high-beta names get smaller default positions because the
// same signal strength implies more dollar risk.
export const SECTOR_VOLATILITY: Record<SectorKey, number> = {
  semis:          4,
  ai_apps:        5,
  datacenter:     3,
  megacap_tech:   3,
  software:       3,
  power:          3,
  energy_oil:     2,
  space:          5,
  staffing:       4,
  finance:        2,
  healthcare:     2,
  consumer_disc:  3,
  consumer_stap:  1,
  industrial:     2,
  communications: 2,
  materials:      3,
  auto:           3,
};

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
  OKLO: 'Oklo Inc',            TLN: 'Talen Energy',
  XOM: 'ExxonMobil',           CVX: 'Chevron',            EQNR: 'Equinor',
  COP: 'ConocoPhillips',       OXY: 'Occidental',         SLB: 'Schlumberger',
  EOG: 'EOG Resources',        OET: 'Okeanis Eco Tankers',
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

if (WATCHLIST.length !== 102) {
  throw new Error(`Apex universe expected 102 tickers, got ${WATCHLIST.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Elite portfolio — selected dynamically by lib/portfolio-optimizer.ts from
// the 102-ticker WATCHLIST. The optimizer ranks the universe by risk-adjusted
// momentum (30-day return / annualised volatility) and emits the top 14 with
// score-proportional weights, refreshed hourly. The trading engine drives
// each user's account toward whatever the optimizer returns — see
// computeElitePortfolio() for the algorithm and the seed fallback.
// ─────────────────────────────────────────────────────────────────────────────

export interface EliteEntry {
  name: string;
  /** % of equity targeted in this ticker. Sums to 100 across the portfolio. */
  targetWeight: number;
  /** 1..5 vol tier — drives tactical signal multipliers. */
  volatility: number;
}

// Rebalance bands — how far a position may drift before the engine acts.
// Tight bands → rebalance often, more turnover. Loose bands → less churn.
export const REBALANCE = {
  /** Trim when posValue > targetValue × OVERWEIGHT_TRIGGER. */
  OVERWEIGHT_TRIGGER: 1.30,
  /** Buy when posValue < targetValue × UNDERWEIGHT_TRIGGER. */
  UNDERWEIGHT_TRIGGER: 0.85,
  /** Each rebalance trade closes this fraction of the gap to target. */
  CONVERGENCE_RATE: 0.5,
} as const;

// Risk + sizing parameters. The trading loop reads these to bound exposure
// even when signals would otherwise want to keep buying.
export const RISK = {
  /** Hard cap on simultaneous holdings. */
  MAX_POSITIONS: 15,
  /** % of equity any single ticker may occupy. */
  MAX_PER_TICKER_PCT: 15,
  /** % of equity any single sector may occupy. */
  MAX_PER_SECTOR_PCT: 30,
  /** Base BUY size as a % of cash before signal/vol/trend multipliers. */
  POSITION_SIZE_PCT: 0.08,
  /** Halt for the day at -3 % unrealised. */
  DAILY_LOSS_LIMIT: -0.03,
  /** Max trades placed per scan (BUY + SELL combined). */
  MAX_TRADES_PER_SCAN: 12,
  /** Parallelism for /quotes calls — Alpaca paper rate ≈ 200/min. */
  PRICE_FETCH_CONCURRENCY: 12,
} as const;

export const SIGNAL = {
  DIP_THRESHOLD: 0.0003,
  PEAK_THRESHOLD: 0.0005,
  RSI_OVERSOLD: 48,
  RSI_OVERBOUGHT: 52,
  PROFIT_TAKE_THRESHOLD: 0.003,
  STOP_LOSS_THRESHOLD: -0.02,
} as const;
