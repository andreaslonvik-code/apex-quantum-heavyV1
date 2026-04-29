// Apex Quantum trading blueprint — single source of truth for the universe,
// per-ticker target weights, and per-ticker volatility tier. Consumed by both
// the on-demand /api/apex/autonomous route and the Inngest tick worker so
// they cannot drift out of sync.
//
// Volatility is a 1..5 tier that drives the sizing multiplier in the trading
// loop (higher tier → larger response to dip/peak signals). targetWeight is
// the % of portfolio the engine tries to hold in that ticker; weights sum to
// 100 across the blueprint and gate the BUILD/UNDERWEIGHT/OVERWEIGHT signals.

export interface BlueprintEntry {
  name: string;
  /** % of portfolio targeted at this ticker. Sums to 100 across the blueprint. */
  targetWeight: number;
  /** 1..5 vol tier. */
  volatility: number;
}

export const APEX_BLUEPRINT: Readonly<Record<string, BlueprintEntry>> = {
  // Semis
  MU:   { name: 'Micron Technology',     targetWeight: 8, volatility: 4 },
  NVDA: { name: 'NVIDIA Corp',           targetWeight: 8, volatility: 4 },
  AVGO: { name: 'Broadcom',              targetWeight: 6, volatility: 3 },
  TSM:  { name: 'Taiwan Semi',           targetWeight: 4, volatility: 3 },
  AMD:  { name: 'Advanced Micro',        targetWeight: 3, volatility: 4 },

  // AI apps
  PLTR: { name: 'Palantir',              targetWeight: 3, volatility: 5 },

  // Datacenter
  VRT:  { name: 'Vertiv',                targetWeight: 3, volatility: 3 },
  ETN:  { name: 'Eaton',                 targetWeight: 2, volatility: 2 },

  // Megacap tech
  AAPL: { name: 'Apple',                 targetWeight: 4, volatility: 2 },
  MSFT: { name: 'Microsoft',             targetWeight: 4, volatility: 2 },
  GOOGL:{ name: 'Alphabet',              targetWeight: 3, volatility: 3 },
  META: { name: 'Meta Platforms',        targetWeight: 3, volatility: 3 },
  AMZN: { name: 'Amazon',                targetWeight: 3, volatility: 3 },
  TSLA: { name: 'Tesla',                 targetWeight: 3, volatility: 5 },
  NFLX: { name: 'Netflix',               targetWeight: 2, volatility: 3 },

  // Software
  ORCL: { name: 'Oracle',                targetWeight: 2, volatility: 2 },
  CRM:  { name: 'Salesforce',            targetWeight: 2, volatility: 3 },
  CRWD: { name: 'CrowdStrike',           targetWeight: 2, volatility: 4 },
  NOW:  { name: 'ServiceNow',            targetWeight: 2, volatility: 3 },

  // Power
  CEG:  { name: 'Constellation Energy',  targetWeight: 4, volatility: 3 },
  NEE:  { name: 'NextEra Energy',        targetWeight: 2, volatility: 2 },

  // Energy
  XOM:  { name: 'ExxonMobil',            targetWeight: 3, volatility: 2 },
  CVX:  { name: 'Chevron',               targetWeight: 2, volatility: 2 },

  // Space
  RKLB: { name: 'Rocket Lab',            targetWeight: 3, volatility: 5 },

  // Finance
  JPM:  { name: 'JPMorgan Chase',        targetWeight: 3, volatility: 2 },
  V:    { name: 'Visa',                  targetWeight: 2, volatility: 2 },

  // Healthcare
  UNH:  { name: 'UnitedHealth',          targetWeight: 3, volatility: 2 },
  LLY:  { name: 'Eli Lilly',             targetWeight: 3, volatility: 3 },

  // Consumer
  COST: { name: 'Costco',                targetWeight: 3, volatility: 2 },
  NKE:  { name: 'Nike',                  targetWeight: 2, volatility: 2 },

  // Industrial
  CAT:  { name: 'Caterpillar',           targetWeight: 2, volatility: 2 },

  // Communications
  DIS:  { name: 'Disney',                targetWeight: 1, volatility: 2 },
};

export const WATCHLIST: readonly string[] = Object.keys(APEX_BLUEPRINT);

export const TICKER_NAME: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const [t, info] of Object.entries(APEX_BLUEPRINT)) out[t] = info.name;
  return out;
})();

// Sanity check at module load — weights must sum to 100. Fail loud if a future
// edit lands a typo, since the BUILD/UNDERWEIGHT signals depend on this.
{
  const total = Object.values(APEX_BLUEPRINT).reduce((s, e) => s + e.targetWeight, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Apex blueprint weights sum to ${total}, expected 100`);
  }
}
