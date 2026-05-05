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

export interface Blueprint {
  id: AssetClass;
  name: string;
  /** Tradable symbols. Crypto uses Alpaca data-API form (e.g. "BTC/USD"). */
  watchlist: readonly string[];
  /** Optional human-readable name override per ticker (used by UI). */
  tickerNames?: Readonly<Record<string, string>>;
  params: BlueprintParams;
}
