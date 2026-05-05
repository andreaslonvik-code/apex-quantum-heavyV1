// APEX QUANTUM v1.28 — Krypto.
// 30-second/1-minute scan, DCA on dips, RSI<30 + MACD-up entries.
// Symbols use Alpaca data API form ("BTC/USD"); engine strips slash for trading.
import type { Blueprint } from './types';

export const CRYPTO_BLUEPRINT: Blueprint = {
  id: 'crypto',
  name: 'Apex Quantum v1.28 — Krypto',
  watchlist: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'AVAX/USD', 'DOGE/USD'],
  tickerNames: {
    'BTC/USD': 'Bitcoin',
    'ETH/USD': 'Ethereum',
    'SOL/USD': 'Solana',
    'AVAX/USD': 'Avalanche',
    'DOGE/USD': 'Dogecoin',
  },
  params: {
    rsiOversold: 30,
    rsiOverbought: 70,
    riskPctPerTrade: 0.015,
    maxPositions: 3,
    maxPctPerPosition: 50,
    dailyKillSwitchPct: -0.03,
    atrPeriod: 14,
    atrStopMult: 1.5,
    profitTakeThreshold: 0.15,
    timeframe: '1Hour',
    barLimit: 250,
  },
};
