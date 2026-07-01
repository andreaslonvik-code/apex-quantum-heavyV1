/**
 * Delte typer for Forvalterens bord (/quantum). Speiler payloadene fra
 * de eksisterende API-rutene — ingen nye datakilder, kun ny form.
 */

export interface CockpitPosition {
  ticker: string;
  symbol: string;
  antall: number;
  /** Andel av total porteføljeverdi i prosent (fra /api/apex/positions). */
  vekt: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface CockpitOrder {
  submittedAt: string; // ISO
  filledAt: string | null;
  ticker: string;
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
  status: 'OK' | 'PENDING' | 'ERR' | 'CANCELED';
  reason: string;
}

export type CockpitTf = '1H' | '24H' | '7D' | '30D' | 'YTD' | 'ALL';

export interface CockpitPerformance {
  current: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    initialValue: number;
  };
  session?: { peak: number; maxDrawdown: number };
  chartData: Array<{ timestamp?: number; value: number }>;
  xTicks?: string[];
}

/** Offentlig beslutningsrad fra /api/transparency/timeline. */
export interface CockpitDecision {
  id: number;
  blueprintId: 'stocks' | 'crypto' | 'commodities';
  decidedAt: string;
  thesis: string | null;
  failed: boolean;
}

export interface CockpitAccount {
  accountId: string;
  equity: number;
  environment: 'paper' | 'live';
}
