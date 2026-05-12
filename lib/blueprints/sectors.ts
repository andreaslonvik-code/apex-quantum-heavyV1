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

  // Financial
  MS: 'financial',
  SCHW: 'financial',
  V: 'financial',
  WFC: 'financial',

  // Industrial / aerospace / power
  RKLB: 'industrial',
  RTX: 'industrial',
  UNP: 'industrial',
  VRT: 'industrial',

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
