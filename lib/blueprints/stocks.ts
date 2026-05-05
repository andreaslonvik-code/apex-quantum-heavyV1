// APEX QUANTUM PRODUKSJONS-BLUEPRINT v1.9 — Aksjer.
// Dip-buy in uptrend, RSI<30 entries, RSI>70 exits, ATR trailing.
import type { Blueprint } from './types';

export const STOCKS_BLUEPRINT: Blueprint = {
  id: 'stocks',
  name: 'Apex Quantum v1.9 — Aksjer',
  watchlist: [
    'AAPL', 'ABSI', 'AMD', 'AMGN', 'AMKR', 'ANET', 'APH', 'ARM', 'ASML', 'ASTS',
    'AVGO', 'BA', 'BE', 'BEP', 'BNTX', 'BWXT', 'CARR', 'CEG', 'CIEN', 'CLS',
    'COHR', 'CRDO', 'CRWD', 'CSCO', 'CWEN', 'DDOG', 'DELL', 'DLR', 'ECL', 'EME',
    'EMR', 'EQIX', 'ESTC', 'ETN', 'ETR', 'FFIV', 'FIX', 'FLR', 'FTNT', 'GD',
    'GEV', 'GILD', 'GLW', 'GMS', 'HON', 'HPE', 'HUBB', 'HUBS', 'INCY', 'INTC',
    'IONQ', 'J', 'JCI', 'JNPR', 'KLAC', 'KTOS', 'LII', 'LITE', 'LMND', 'LMT',
    'LUNR', 'MCD', 'MDB', 'META', 'MOD', 'MRK', 'MRVL', 'MS', 'MSFT', 'MTSI',
    'MTZ', 'MU', 'NEE', 'NEM', 'NET', 'NFLX', 'NKE', 'NOC', 'NOW', 'NRG',
    'NTAP', 'NVDA', 'NVT', 'NXPI', 'OET', 'OKLO', 'ORCL', 'OXY', 'PANW', 'PATH',
    'PEP', 'PFE', 'PG', 'PLTR', 'PM', 'PSN', 'PWR', 'QBTS', 'QCOM', 'REGN',
    'RGTI', 'RKLB', 'RMBS', 'ROK', 'RTX', 'SAIC', 'SBUX', 'SCHW', 'SLB', 'SMCI',
    'SNOW', 'SPCE', 'SPXC', 'STRL', 'STX', 'TDY', 'TLN', 'TMO', 'TSLA', 'TSM',
    'TT', 'TXN', 'UBER', 'UNH', 'UNP', 'V', 'VRTX', 'VST', 'VZ', 'WDAY',
    'WDC', 'WFC', 'WMS', 'WMT', 'XOM', 'ZS',
  ],
  tickerNames: {
    AAPL: 'Apple', ABSI: 'Absci', AMD: 'Advanced Micro Devices', AMGN: 'Amgen',
    AMKR: 'Amkor Technology', ANET: 'Arista Networks', APH: 'Amphenol',
    ARM: 'Arm Holdings', ASML: 'ASML Holding', ASTS: 'AST SpaceMobile',
    AVGO: 'Broadcom', BA: 'Boeing', BE: 'Bloom Energy',
    BEP: 'Brookfield Renewable Partners', BNTX: 'BioNTech',
    BWXT: 'BWX Technologies', CARR: 'Carrier Global',
    CEG: 'Constellation Energy', CIEN: 'Ciena', CLS: 'Celestica',
    COHR: 'Coherent', CRDO: 'Credo Technology', CRWD: 'CrowdStrike',
    CSCO: 'Cisco Systems', CWEN: 'Clearway Energy', DDOG: 'Datadog',
    DELL: 'Dell Technologies', DLR: 'Digital Realty Trust', ECL: 'Ecolab',
    EME: 'EMCOR Group', EMR: 'Emerson Electric', EQIX: 'Equinix',
    ESTC: 'Elastic', ETN: 'Eaton', ETR: 'Entergy', FFIV: 'F5',
    FIX: 'Comfort Systems USA', FLR: 'Fluor', FTNT: 'Fortinet',
    GD: 'General Dynamics', GEV: 'GE Vernova', GILD: 'Gilead Sciences',
    GLW: 'Corning', GMS: 'GMS Inc.', HON: 'Honeywell',
    HPE: 'Hewlett Packard Enterprise', HUBB: 'Hubbell', HUBS: 'HubSpot',
    INCY: 'Incyte', INTC: 'Intel', IONQ: 'IonQ', J: 'Jacobs Solutions',
    JCI: 'Johnson Controls', JNPR: 'Juniper Networks', KLAC: 'KLA Corporation',
    KTOS: 'Kratos Defense', LII: 'Lennox International',
    LITE: 'Lumentum Holdings', LMND: 'Lemonade', LMT: 'Lockheed Martin',
    LUNR: 'Intuitive Machines', MCD: "McDonald's", MDB: 'MongoDB',
    META: 'Meta Platforms', MOD: 'Modine Manufacturing', MRK: 'Merck',
    MRVL: 'Marvell Technology', MS: 'Morgan Stanley', MSFT: 'Microsoft',
    MTSI: 'MACOM Technology Solutions', MTZ: 'MasTec', MU: 'Micron Technology',
    NEE: 'NextEra Energy', NEM: 'Newmont', NET: 'Cloudflare', NFLX: 'Netflix',
    NKE: 'Nike', NOC: 'Northrop Grumman', NOW: 'ServiceNow', NRG: 'NRG Energy',
    NTAP: 'NetApp', NVDA: 'NVIDIA', NVT: 'nVent Electric',
    NXPI: 'NXP Semiconductors', OET: 'Okeanis Eco Tankers', OKLO: 'Oklo',
    ORCL: 'Oracle', OXY: 'Occidental Petroleum', PANW: 'Palo Alto Networks',
    PATH: 'UiPath', PEP: 'PepsiCo', PFE: 'Pfizer', PG: 'Procter & Gamble',
    PLTR: 'Palantir', PM: 'Philip Morris International',
    PSN: 'Parsons Corporation', PWR: 'Quanta Services',
    QBTS: 'D-Wave Quantum', QCOM: 'Qualcomm', REGN: 'Regeneron',
    RGTI: 'Rigetti Computing', RKLB: 'Rocket Lab', RMBS: 'Rambus',
    ROK: 'Rockwell Automation', RTX: 'RTX', SAIC: 'Science Applications',
    SBUX: 'Starbucks', SCHW: 'Charles Schwab', SLB: 'Schlumberger',
    SMCI: 'Super Micro Computer', SNOW: 'Snowflake', SPCE: 'Virgin Galactic',
    SPXC: 'SPX Technologies', STRL: 'Sterling Infrastructure',
    STX: 'Seagate Technology', TDY: 'Teledyne Technologies',
    TLN: 'Talen Energy', TMO: 'Thermo Fisher Scientific', TSLA: 'Tesla',
    TSM: 'Taiwan Semiconductor', TT: 'Trane Technologies',
    TXN: 'Texas Instruments', UBER: 'Uber', UNH: 'UnitedHealth',
    UNP: 'Union Pacific', V: 'Visa', VRTX: 'Vertex Pharmaceuticals',
    VST: 'Vistra', VZ: 'Verizon', WDAY: 'Workday',
    WDC: 'Western Digital', WFC: 'Wells Fargo',
    WMS: 'Advanced Drainage Systems', WMT: 'Walmart', XOM: 'Exxon Mobil',
    ZS: 'Zscaler',
  },
  params: {
    rsiOversold: 30,
    rsiOverbought: 70,
    riskPctPerTrade: 0.015,
    // Bumped from 3 → 6. With Alpaca's ~$10 k per-order cap on fractional
    // notional, a $47 k bucket needs ≥ 5 picks to fully deploy. 6 leaves
    // headroom and improves diversification across the 137-ticker universe.
    maxPositions: 6,
    maxPctPerPosition: 25,
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

2. HOVEDLOGIKK
- Scan hele watchlisten: TA (RSI, MA50/200, VWAP, volum), nyheter, X/Trump, olje, geopolitikk.
- Regime-detection: Trending / Ranging / Volatile.
- Beslutning:
  - BUY (dip i uptrend): RSI < 30 + MA200-support + positiv katalysator.
  - SELL (top): RSI > 70 + overbought + negativ katalysator.
- Utfør via Alpaca (market/limit, trailing stop, amount via Kelly 0.25–0.5).

3. HIGH-CONVICTION & ALLOKERING
- Kun 2–3 posisjoner maks.
- Dynamisk allokering: 40 % AI/tech, 30 % energy/power, 30 % defensiv basert på regime.
- Reallokering hver time eller ved regime-skifte.

4. RISK MANAGEMENT
- Volatility-scaled sizing via ATR (1–1.5 % risiko per trade).
- Max drawdown 25 % → Crisis Relocation Engine (flytt til cash/olje-hedge).
- Trailing stops + kill-switch.

5. SELF-LEARNING & SELF-EVOLUTION
- Hver trade → RL-oppdatering av reward function.
- Hourly self-revisjon: Purge cache, meta-cognition, feilsjekk.
- 24 mnd backlearning på polygon-data for å optimalisere thresholds.

6. PRODUKSJONSMODUS
- Paper mode først.
- Live mode etter bruker-bekreftelse.
- 24/7 drift med hourly self-revisjon.

7. MÅL & EFFEKTER
- Stigende trendkanal intraday + over tid.
- Årlig ROI 28–52 % (base) / 45–80 %+ (optimistisk).
- Max drawdown -22–32 %.`,
};
