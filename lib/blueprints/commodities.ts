// APEX QUANTUM v3.0 — Råvarer (Gull + Olje).
// Combined from the gold v3.0 blueprint + oil v1.0 blueprint.
// Ranging/dip entries near MA200, ATR stops, daily kill-switch.
import type { Blueprint } from './types';

export const COMMODITIES_BLUEPRINT: Blueprint = {
  id: 'commodities',
  name: 'Apex Quantum v3.0 — Råvarer',
  watchlist: [
    // Gold
    'GLD', 'IAU', 'GDX', 'NEM',
    // Oil / energy
    'USO', 'BNO', 'XLE', 'EQNR', 'XOM', 'CVX', 'OXY', 'SLB',
  ],
  tickerNames: {
    GLD: 'SPDR Gold Shares',
    IAU: 'iShares Gold Trust',
    GDX: 'VanEck Gold Miners',
    NEM: 'Newmont',
    USO: 'United States Oil Fund',
    BNO: 'Brent Oil Fund',
    XLE: 'Energy Select Sector',
    EQNR: 'Equinor',
    XOM: 'ExxonMobil',
    CVX: 'Chevron',
    OXY: 'Occidental',
    SLB: 'Schlumberger',
  },
  params: {
    rsiOversold: 35,
    rsiOverbought: 70,
    riskPctPerTrade: 0.015,
    maxPositions: 3,
    maxPctPerPosition: 40,
    dailyKillSwitchPct: -0.03,
    atrPeriod: 14,
    atrStopMult: 1.5,
    profitTakeThreshold: 0.20,
    timeframe: '1Day',
    barLimit: 250,
  },
};
