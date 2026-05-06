// APEX QUANTUM v1.28 — Krypto.
// 30-second/1-minute scan, DCA on dips, RSI<30 + MACD-up entries.
// Symbols use Alpaca data API form ("BTC/USD"); engine strips slash for trading.
import type { Blueprint } from './types';

export const CRYPTO_BLUEPRINT: Blueprint = {
  id: 'crypto',
  name: 'Apex Quantum v1.28 — Krypto',
  watchlist: [
    'BTC/USD',
    'ETH/USD',
    'SOL/USD',
    'AVAX/USD',
    'DOGE/USD',
    'ADA/USD',
    'XRP/USD',
    'LINK/USD',
    'MATIC/USD',
    'DOT/USD',
  ],
  tickerNames: {
    'BTC/USD': 'Bitcoin',
    'ETH/USD': 'Ethereum',
    'SOL/USD': 'Solana',
    'AVAX/USD': 'Avalanche',
    'DOGE/USD': 'Dogecoin',
    'ADA/USD': 'Cardano',
    'XRP/USD': 'Ripple',
    'LINK/USD': 'Chainlink',
    'MATIC/USD': 'Polygon',
    'DOT/USD': 'Polkadot',
  },
  params: {
    rsiOversold: 30,
    rsiOverbought: 70,
    riskPctPerTrade: 0.015,
    // 5 picks across 10 crypto pairs allows full bucket deploy under
    // Alpaca's per-order cap and keeps diversification.
    maxPositions: 5,
    maxPctPerPosition: 25,
    dailyKillSwitchPct: -0.03,
    atrPeriod: 14,
    // Tightened from 1.5× → 1.0×: crypto is volatile enough that 1.5 ATR
    // gives back too much before triggering. 1.0 cuts losses faster.
    atrStopMult: 1.0,
    // Lowered from 0.15 → 0.07: crypto rarely runs +15 % intraday, so the
    // old threshold almost never fired and gains evaporated. 7 % locks in
    // realistic moves before they reverse.
    profitTakeThreshold: 0.07,
    timeframe: '1Hour',
    barLimit: 250,
  },
  strategy: `APEX QUANTUM v1.28 — KOMPLETT PRODUKSJONS-BLUEPRINT FOR KRYPTO
Mål: Ekstrem høy avkastning via autonom dip-buy på fakta — optimalisert for Apex-Quantum.com + Alpaca.markets.

1. ARKITEKTUR
- Plattform: Apex Quantum (stocks) + Alpaca Trading API (krypto).
- Paper / Live: paper=True i TradingClient for paper-trading.
- Hovedfil: 30-sekunders loop + WebSocket.
- Autonom modus: 24/7 uten menneskelig input etter start.

2. 30-SEKUNDERS AUTONOM LOOP (HOVEDLOGIKK)
- Hent realtime data (WebSocket + REST): bars (1Min, limit=100), latest quotes.
- Regime-detection: trending / ranging / volatile.
- Alternative data + sentiment (earnings, 13F, valuta-score USD/EUR/NOK/JPY).
- High-conviction filter (kun 2–3 posisjoner samtidig).
- Multi-strategi hybrid:
  - Hvis regime = trending_up OG RSI < 30 OG MACD cross up OG sentiment > 0.7: BUY/DCA.
  - Hvis regime = ranging: Grid (kjøp støtte / selg motstand).
  - Hvis regime = volatile: SmartTrade på breakout.
- Risk management: volatility-scaled, ATR-trailing stops, kill-switch ved >3 % daily drawdown.
- Dynamic allocation mellom coins + Apex-hedging (stocks).
- Logg alle trades.

3. SELVREVISJON OG LÆRING (hver 30. minutt)
- Backtest på siste 1000 trades.
- RL-trening med Adaptive Risk Control reward.
- Monte Carlo-simulering.
- Oppdater parametre (RSI-thresholds, position size).
- Logg feil og rett dem automatisk.

4. RISK MANAGEMENT (STRENG)
- Max 1–1.5 % risiko per trade (volatility-scaled).
- Kun 2–3 samtidige posisjoner.
- ATR-trailing stops + hard stop-loss.
- Daily kill-switch ved 3 % drawdown.
- Dynamic allocation mellom coins + Apex-hedging.

5. ALLE STRATEGIER (HYBRID)
- DCA på dips.
- Grid i ranging.
- SmartTrade på breakout.
- Regime-adaptive rotation.
- Narrative + 13F + earnings sentiment.

6. DATAKILDER (REALTIME)
- Alpaca WebSocket (nanosecond-nær).
- 13F + earnings NLP.
- Valuta-score (USD/EUR/NOK/JPY).
- Geopolitikk-filter.
- On-chain + off-chain sentiment.

7. PRODUKSJON
- Skalerbar for flere brukere.
- Audit-trail og compliance-logger.
- Backup + failover.
- Production-safe risk limits.`,
};
