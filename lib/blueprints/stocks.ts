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
  strategy: `APEX QUANTUM PRODUKSJONS-BLUEPRINT v1.9 — KOMPLETT TRADINGLOGIKK FOR AKSJER

1. OVERORDNET ARKITEKTUR
- Frontend: Apex Quantum dashboard (watchlist, P&L, live orders, status).
- Backend: Next.js / Vercel cron for 30 s loop + hourly self-revisjon.
- AI Brain: Grok-4-Heavy for regime-detection, RL, meta-cognition, self-evolution.
- Broker: Alpaca Markets (paper/live mode).
- Mål: Stigende trendkanal intraday + over tid ved dip-buy i uptrend, trailing stops, Kelly-compounding.

2. WATCHLIST
MCD, META, MRK, MS, MSFT, MU, NEE, NEM, NET, NFLX, NKE, NOW, NVDA, OET, OKLO, ORCL, OXY, PANW, PEP, PFE, PG, PLTR, PM, QCOM, RKLB, RTX, SBUX, SCHW, SLB, SMCI, SNOW, TLN, TMO, TSLA, TSM, UBER, UNH, UNP, V, VRT, VRTX, VZ, WFC, WMT, XOM, AAPL.

3. HOVEDLOGIKK
- Scan hele watchlisten: TA (RSI, MA50/200, VWAP, volum), nyheter, X/Trump, olje, geopolitikk.
- Regime-detection: Trending / Ranging / Volatile.
- Beslutning:
  - BUY (dip i uptrend): RSI < 30 + MA200-support + positiv katalysator.
  - SELL (top): RSI > 70 + overbought + negativ katalysator.
- Utfør via Alpaca (market/limit, trailing stop, amount via Kelly 0.25–0.5).

4. HIGH-CONVICTION & ALLOKERING
- Kun 2–3 posisjoner maks.
- Dynamisk allokering: 40 % AI/tech, 30 % energy/power, 30 % defensiv basert på regime.
- Reallokering hver time eller ved regime-skifte.

5. RISK MANAGEMENT
- Volatility-scaled sizing via ATR (1–1.5 % risiko per trade).
- Max drawdown 25 % → Crisis Relocation Engine (flytt til cash/olje-hedge).
- Trailing stops + kill-switch.

6. SELF-LEARNING & SELF-EVOLUTION
- Hver trade → RL-oppdatering av reward function.
- Hourly self-revisjon: Purge cache, meta-cognition, feilsjekk.
- 24 mnd backlearning på polygon-data for å optimalisere thresholds.

7. PRODUKSJONSMODUS
- Paper mode først.
- Live mode etter bruker-bekreftelse.
- 24/7 drift med hourly self-revisjon.

8. MÅL & EFFEKTER
- Stigende trendkanal intraday + over tid.
- Årlig ROI 28–52 % (base) / 45–80 %+ (optimistisk).
- Max drawdown -22–32 %.`,
};
