/**
 * Ticker → sector mapping for the stocks watchlist. Used by the engine to
 * enforce sector-concentration caps (max 1 position per sector across the
 * bucket), preventing all 3 picks landing in the same sector during sector
 * crashes (e.g. semis on a DeepSeek-style news day).
 *
 * Sector taxonomy is intentionally coarse (8 buckets, not GICS-level 11).
 * Goal is correlation-based diversification, not academic precision —
 * NVDA + SMCI + MU all crash together regardless of GICS sub-industry.
 */

export type Sector =
  | 'tech_ai'
  | 'consumer'
  | 'health'
  | 'energy'
  | 'financial'
  | 'industrial'
  | 'auto_ev'
  | 'telecom_media';

const TICKER_TO_SECTOR: Record<string, Sector> = {
  // Tech / AI / semis — most-correlated cluster
  AAPL: 'tech_ai',
  META: 'tech_ai',
  MSFT: 'tech_ai',
  NVDA: 'tech_ai',
  ORCL: 'tech_ai',
  PANW: 'tech_ai',
  PLTR: 'tech_ai',
  NOW: 'tech_ai',
  SNOW: 'tech_ai',
  NET: 'tech_ai',
  SMCI: 'tech_ai',
  TSM: 'tech_ai',
  MU: 'tech_ai',
  QCOM: 'tech_ai',
  ANET: 'tech_ai',  // AI-networking — moves with NVDA/AVGO cluster
  AVGO: 'tech_ai',  // priority-core — AI ASIC + networking semis
  LRCX: 'tech_ai',  // semi-cap-equip — same cycle as AMAT
  AMAT: 'tech_ai',
  CRDO: 'tech_ai',  // AI-interconnect SerDes — semis cluster
  COHR: 'tech_ai',  // photonics/lasers for AI infra
  LITE: 'tech_ai',  // priority-core — photonics/optics for AI data centers
  WDC: 'tech_ai',   // storage — moves with semis on AI capex cycles
  ASML: 'tech_ai',  // EUV-monopol — semi-cap-equip, traded as US ADR on Alpaca
  SAP: 'tech_ai',   // enterprise AI/cloud — traded as US ADR on Alpaca
  QBTS: 'tech_ai',  // quantum computing — clusters with AI-compute thesis
  IONQ: 'tech_ai',  // quantum computing — same cluster as QBTS
  QUBT: 'tech_ai',  // priority-core — Quantum Computing Inc., same cluster
  RGTI: 'tech_ai',  // quantum computing — clusters with QBTS/IONQ/QUBT
  // Batch 2026-05-24 — software / cyber / AI-apps cluster. All move with
  // the broader software tape on rate/AI-capex days, so sector-cap logic
  // correctly prevents stacking three of these at once.
  DELL: 'tech_ai',   // server/AI-infra hardware — moves with semis cycle
  ESTC: 'tech_ai',   // search/observability SaaS
  MDB: 'tech_ai',    // database SaaS
  CRWD: 'tech_ai',   // cybersecurity SaaS — pure software
  ZS: 'tech_ai',     // cybersecurity SaaS — same cluster as CRWD/PANW
  CLS: 'tech_ai',    // electronics manufacturing for AI hyperscalers
  FN: 'tech_ai',     // optical components — AI-infra photonics cluster
  SOUN: 'tech_ai',   // AI voice — high-beta retail-pump name, monitor
  PATH: 'tech_ai',   // RPA/AI automation SaaS
  HUBS: 'tech_ai',   // CRM/marketing SaaS
  BBAI: 'tech_ai',   // AI/government analytics — high-volatility small-cap
  AI: 'tech_ai',     // C3.ai — enterprise AI platform
  HUT: 'tech_ai',    // crypto-miner pivoted to AI hosting — trades on BTC
                     // + AI-infra-buildout narrative. Added 2026-06-01.

  // Consumer / staples / retail
  MCD: 'consumer',
  NKE: 'consumer',
  SBUX: 'consumer',
  WMT: 'consumer',
  PG: 'consumer',
  PEP: 'consumer',
  PM: 'consumer',

  // Health / pharma
  ABSI: 'health', // priority-core — AI-drug-discovery biotech (small-cap)
  MRK: 'health',
  PFE: 'health',
  TMO: 'health',
  UNH: 'health',
  VRTX: 'health',
  HELP: 'health',  // Cybin — biotech, phase-3 catalyst
  // Batch 2026-05-24 — gene-editing cohort. CRSP/EDIT/NTLA all move on
  // CRISPR-platform news together — sector-cap correctly prevents loading
  // three near-correlated names at once.
  CRSP: 'health',
  EDIT: 'health',
  NTLA: 'health',

  // Energy / utilities (oil + nuclear + grid)
  OET: 'energy',
  OKLO: 'energy',
  OXY: 'energy',
  SLB: 'energy',
  TLN: 'energy',
  XOM: 'energy',
  NEE: 'energy',
  CEG: 'energy',  // nuclear utility — moves with TLN/OKLO on AI-power thesis
  BWXT: 'energy', // small-modular-reactor — clusters with nuclear cohort
  NEM: 'energy', // gold miner — correlates more with commodities than equities,
                 // but on bad days trades like a small-cap, treat as own bucket
  FCX: 'energy', // copper miner — AI-data-center infra thesis + commodities
                 // cycle; bucketed here like NEM since we don't carry a
                 // dedicated materials sector. Added 2026-06-01.

  // Financial
  MS: 'financial',
  SCHW: 'financial',
  V: 'financial',
  WFC: 'financial',
  // AI-fintech — moves with rate-sensitive consumer-credit names, but
  // also has high software-beta. Lever vekselvis financial/tech_ai; we
  // park it under financial since drawdowns korrelert med kredittsyklusen.
  UPST: 'financial',

  // Industrial / aerospace / power
  RKLB: 'industrial',
  RTX: 'industrial',
  UNP: 'industrial',
  VRT: 'industrial',
  // Batch 2026-05-24 — defense / aerospace / space-infra cohort. KTOS +
  // AVAV move with the defense tape; ASTS moves with satellite-comms. SYM
  // is warehouse robotics — could argue tech_ai, but trades on industrial
  // capex cycle and is housed here for sector-cap consistency.
  KTOS: 'industrial',
  AVAV: 'industrial',
  ASTS: 'industrial',
  SYM: 'industrial',
  // Pending — SpaceX. Bucketed here so that sector-cap logic applies the
  // moment we promote it from pendingWatchlist to watchlist.
  SPCX: 'industrial',
  // Defense primes added 2026-05-24. Alle 7 trader på defense-tape —
  // sector-cap forhindrer korrekt at engine stabler tre defense-navn
  // samtidig på en geopolitikk-spike. NB: BWXT er allerede bucketed til
  // 'energy' (SMR-thesis) over — den krysser over til defense, men flytter
  // mer med nuclear-utility-cohort enn med klassiske primes. Beholder den
  // i 'energy' med vilje for å unngå dobbel-vekting.
  TXT: 'industrial',
  HII: 'industrial',
  LDOS: 'industrial',
  SAIC: 'industrial',
  PSN: 'industrial',
  BAH: 'industrial',
  GD: 'industrial',

  // Auto / EV
  TSLA: 'auto_ev',

  // Streaming / media / telco / gig
  NFLX: 'telecom_media',
  UBER: 'telecom_media',
  VZ: 'telecom_media',
};

/** Returns sector for a ticker, or null if unknown (engine treats unknown as
 *  "unique sector" — won't block a BUY but won't double-count either). */
export function sectorOf(ticker: string): Sector | null {
  return TICKER_TO_SECTOR[ticker] ?? null;
}
