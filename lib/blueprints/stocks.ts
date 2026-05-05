// APEX QUANTUM PRODUKSJONS-BLUEPRINT v1.9 — Aksjer.
// Dip-buy in uptrend, RSI<30 entries, RSI>70 exits, ATR trailing.
import type { Blueprint } from './types';

export const STOCKS_BLUEPRINT: Blueprint = {
  id: 'stocks',
  name: 'Apex Quantum v1.9 — Aksjer',
  watchlist: [
    'AAPL', 'MCD', 'META', 'MRK', 'MS', 'MSFT', 'MU', 'NEE', 'NEM', 'NET',
    'NFLX', 'NKE', 'NOW', 'NVDA', 'OET', 'OKLO', 'ORCL', 'OXY', 'PANW',
    'PEP', 'PFE', 'PG', 'PLTR', 'PM', 'QCOM', 'RKLB', 'RTX', 'SBUX', 'SCHW',
    'SLB', 'SMCI', 'SNOW', 'TLN', 'TMO', 'TSLA', 'TSM', 'UBER', 'UNH', 'UNP',
    'V', 'VRT', 'VRTX', 'VZ', 'WFC', 'WMT', 'XOM',
  ],
  params: {
    rsiOversold: 30,
    rsiOverbought: 70,
    riskPctPerTrade: 0.015,
    maxPositions: 3,
    maxPctPerPosition: 50,
    dailyKillSwitchPct: -0.25,
    atrPeriod: 14,
    atrStopMult: 1.5,
    profitTakeThreshold: 0.15,
    timeframe: '1Day',
    barLimit: 250,
  },
};
