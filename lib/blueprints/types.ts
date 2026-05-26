export type AssetClass = 'stocks' | 'crypto' | 'commodities';

export interface BlueprintParams {
  /** RSI threshold below which the blueprint considers a long entry. */
  rsiOversold: number;
  /** RSI threshold above which the blueprint exits longs. */
  rsiOverbought: number;
  /** Risk fraction of bucket capital per trade. 0.015 = 1.5 %. */
  riskPctPerTrade: number;
  /** Hard cap on simultaneous positions inside this blueprint's bucket. */
  maxPositions: number;
  /** Cap on a single ticker as % of bucket capital. */
  maxPctPerPosition: number;
  /**
   * Optional combined cap on the TOP-TWO positions as % of bucket capital.
   * Prevents the "89 % in two names" pattern where both `maxPctPerPosition`
   * checks pass individually (e.g. AAPL 45 % + VRT 45 % = 90 %), leaving
   * nothing for runners-up to grow into. When set, the engine refuses any
   * top-up or BUY that would push top-2 combined above this threshold —
   * the larger of the two gets capped first, then the smaller gets the
   * remainder. Omit (undefined) to disable; recommended ~70 % for the
   * stocks bucket where 6 max positions × 47.5 % target would otherwise
   * collide.
   */
  maxCombinedTopTwoPct?: number;
  /** Halt-for-the-day threshold on bucket-equity drawdown. -0.03 = -3 %. */
  dailyKillSwitchPct: number;
  atrPeriod: number;
  /** Stop distance = ATR × this. */
  atrStopMult: number;
  /** Take-profit at this unrealised P/L fraction. 0.15 = +15 %. */
  profitTakeThreshold: number;
  /** Bar timeframe used for indicator math + entry/exit decisions. */
  timeframe: '15Min' | '1Hour' | '1Day';
  /** Number of bars to request for indicator history. */
  barLimit: number;
}

/**
 * A ticker the blueprint is *watching* but cannot trade yet — typically
 * because it has not IPO'd or is otherwise not yet on Alpaca. The engine
 * MUST ignore this list entirely; it is for UI display + manual promotion
 * to the live `watchlist` once the symbol becomes tradable on Alpaca.
 *
 * Why we keep this separate: putting a non-listed ticker in `watchlist`
 * causes Alpaca's `/v2/assets/{symbol}` and `/v2/stocks/{symbol}/bars` to
 * 404, which spams logs and may trigger failed-order alerts in the UI.
 * Promotion is intentionally manual — IPOs slip, get pulled, or list
 * under a different ticker. We don't want an auto-promote race condition.
 */
export interface PendingTicker {
  ticker: string;
  /** Full company name for UI subline. */
  name: string;
  /** Sector taxonomy bucket — same set as lib/blueprints/sectors.ts. */
  sector: 'tech_ai' | 'consumer' | 'health' | 'energy' | 'financial' | 'industrial' | 'auto_ev' | 'telecom_media' | 'other';
  /** Expected listing date as ISO YYYY-MM-DD. Best estimate; verify externally. */
  expectedListing: string;
  /** One-line context — why we're watching, source of the listing claim. */
  notes?: string;
}

export interface Blueprint {
  id: AssetClass;
  name: string;
  /** Tradable symbols. Crypto uses Alpaca data-API form (e.g. "BTC/USD"). */
  watchlist: readonly string[];
  /**
   * Symbols we're tracking but that the engine MUST NOT touch — typically
   * pre-IPO names. Listed here so the UI can show a "Kommer snart"-strip
   * and the user can promote to `watchlist` with a one-line edit once the
   * symbol is actually live on Alpaca.
   */
  pendingWatchlist?: readonly PendingTicker[];
  /** Optional human-readable name override per ticker (used by UI). */
  tickerNames?: Readonly<Record<string, string>>;
  params: BlueprintParams;
  /**
   * Verbatim trading-logic text fed to Grok as system prompt. Grok must
   * follow these rules strictly when emitting BUY / SELL / HOLD decisions.
   */
  strategy: string;
}
