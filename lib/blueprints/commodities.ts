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
  strategy: `APEX QUANTUM RÅVARER — KOMBINERT BLUEPRINT (Gull v3.0 + Olje v1.0)
Mål: Ekstrem høy avkastning via Apex Quantum + Alpaca.

═══ DEL 1: GULL (v3.0) ═══

1. PRIMÆRE INSTRUMENTER
- Primær: GLD (SPDR Gold Shares ETF) — 1:1 fysisk gullproxy.
- Sekundære: IAU, GDX (gold miners ETF), NEM, GOLD for diversifisering og leverage.
- Trading-tid: 24/5 (GLD/IAU støttes fullt).

2. AUTONOM DATA- & ANALYSE-ENGINE (30-sek + hourly self-revision)
- Live priser: XAU/USD, GLD close, volum, ATR.
- Teknisk: MA50/MA200, RSI(14), MACD, Fibonacci, SMC/ICT (Order Blocks, FVG), London Breakout (08:00–11:00 London).
- Regime-detection: trending / ranging / volatile.
- Valuta-score: DXY, EUR, NOK, JPY (korrelasjon med gull).
- Geopolitikk-score (0–100): Hormuz, Midtøsten, oljepris, aksje/crypto-nedgang, VIX > 25.
- Alternative data: 13F-filings, ETF-flow divergence, Central Bank gold buying, COT-report.
- News & sentiment: real-time scan av nyheter + Trump-utspill (X / Truth Social).
- Earnings sentiment for GDX-komponenter.
- Intermarket AI: VIX + DXY + olje + aksje/crypto-korrelasjon.

3. TRADINGLOGIKK — HYBRID v3.0
- Kun 2–3 high-conviction-posisjoner samtidig (max 20 % per posisjon, konfidens > 85 %).
- Kjøpsregler (Dip-kjøp / DCA / Grid):
  - Regime = ranging eller volatile dip.
  - Pris nær/under 200-dagers MA.
  - RSI(14) < 35.
  - Geopolitikk-score > 75 (Hormuz, olje-spike >5 %, Trump-tariff).
  - COT Commercial Net Long ekstrem.
  - Central Bank buying + ETF outflow divergence.
  - SMC/ICT Order Block + London Breakout.
  - Volatility-scaled sizing.
- Salgsregler (Topp-salg / Take Profit / Exit):
  - Regime = trending top.
  - RSI(14) > 75.
  - Klar de-eskalering (Hormuz åpner, olje-fall, Trump-peace-signaler).
  - +15–25 % profitt på posisjon (trinnvis take-profit).
  - ATR-trailing stop aktivert.
- Multi-strategi hybrid:
  - 70 % trend-hold i bull-regime.
  - 20 % DCA på dips.
  - 10 % grid i ranging + SmartTrade breakout på geopolitikk.
- Risikostyring & Zero-Drawdown Protection:
  - Max 2 % risikokapital per trade.
  - Daily portfolio stop-loss –5 %.
  - Volatility-scaled position sizing.
  - ATR-trailing stops.
  - Automatisk pause ved >2 % intra-day drawdown.
  - Ingen overnattingsrisiko ved høy geopolitisk usikkerhet (flat posisjon).

═══ DEL 2: OLJE (v1.0) ═══

1. INSTRUMENTER
- USO, BNO, XLE, EQNR, XOM, CVX og lignende energy stocks via Alpaca.

2. DATA PIPELINE (30-SEK SCAN)
- Oljepriser: USO, BNO, XLE + ekstern Brent.
- Valuta: USD (DXY), EUR/USD, USD/NOK, USD/JPY.
- Geo-nyheter & sentiment: X/Truth Social (Trump), Reuters, OPEC.org, TankerTrackers.
- Earnings & 13F for EQNR og energy stocks.
- TA: SMA50/200, RSI, MACD, ATR, volum.

3. REGIME-DETECTION & SIGNAL-GENERERING
- Regime: Trending / Ranging / Volatile (basert på ATR + geopolitikk-score).
- Signal-logikk (kun high-conviction, maks 2–3 posisjoner):
  - BUY: SMA-crossover bullish + RSI < 40 + geopolitikk-score > 70 + valuta-score bullish for olje.
  - SELL: SMA-crossover bearish + RSI > 70 + geopolitikk-score < 30.
  - Grid (ranging): Kjøp på support, selg på resistance innenfor 70–90 USD-range.
  - DCA: Legg til på dips ved geopolitisk fear.
  - Breakout: SmartTrade ved sterk nyhet (OPEC-kutt, Trump-eskalering).

4. RISIKOSTYRING & BACKUP
- Risiko per trade: 1–1.5 % (volatility-scaled).
- Stops: ATR-trailing stops.
- Kill-switch: Flat alle posisjoner + hedge hvis daglig drawdown > 3 %.
- Black Swan: Auto-hedge med SCO eller OTM puts ved triggere (Hormuz-angrep, Trump «war»-post).
- Diversifisering: Maks 40 % ETFs, 40 % energy stocks, 20 % options.`,
};
