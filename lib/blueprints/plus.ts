// APEX QUANTUM + — globalt utvalg for signaler, rapporter og læring.
// Ingen Alpaca-binding, ingen trade-eksekvering. Watchlisten er kjernen
// som signal-pipelinen og Spør-AI bruker. Erstattes når den oppdaterte
// Grok-blueprinten kommer.

export type PlusRegion = 'NO' | 'EU' | 'US' | 'TW' | 'KR' | 'JP' | 'HK' | 'IN';

export interface PlusTicker {
  /** Listed-form symbol (Yahoo Finance / data-API form). */
  ticker: string;
  /** Human-readable company name. */
  name: string;
  region: PlusRegion;
  /** Coarse sector / theme used for filtering and regional storytelling. */
  theme:
    | 'energy'
    | 'semiconductors'
    | 'ai-infra'
    | 'cloud'
    | 'biotech'
    | 'health'
    | 'defense'
    | 'industrials'
    | 'finance'
    | 'consumer'
    | 'shipping'
    | 'seafood'
    | 'oil-services'
    | 'autos'
    | 'utilities'
    | 'space'
    | 'telecom';
}

export interface PlusBlueprint {
  id: 'plus';
  name: string;
  /** Full universe of tickers the AI may emit signals on. */
  watchlist: readonly PlusTicker[];
  /** System prompt for the daily signal pipeline. */
  systemPrompt: string;
  /** System prompt fragment for the "Ask the model about <ticker>" feature. */
  askPrompt: string;
}

export const PLUS_WATCHLIST: readonly PlusTicker[] = [
  // Norway — Oslo Børs
  { ticker: 'EQNR.OL', name: 'Equinor', region: 'NO', theme: 'energy' },
  { ticker: 'DNO.OL', name: 'DNO', region: 'NO', theme: 'energy' },
  { ticker: 'IOX.OL', name: 'Interoil Exploration', region: 'NO', theme: 'energy' },
  { ticker: 'NAS.OL', name: 'Norwegian Air Shuttle', region: 'NO', theme: 'consumer' },
  { ticker: 'NORSE.OL', name: 'Norse Atlantic', region: 'NO', theme: 'consumer' },
  { ticker: 'KOG.OL', name: 'Kongsberg Gruppen', region: 'NO', theme: 'defense' },
  { ticker: 'MOWI.OL', name: 'Mowi', region: 'NO', theme: 'seafood' },
  { ticker: 'SALM.OL', name: 'SalMar', region: 'NO', theme: 'seafood' },
  { ticker: 'SCHA.OL', name: 'Schibsted', region: 'NO', theme: 'consumer' },
  { ticker: 'GJF.OL', name: 'Gjensidige Forsikring', region: 'NO', theme: 'finance' },
  { ticker: 'REC.OL', name: 'REC Silicon', region: 'NO', theme: 'energy' },
  { ticker: 'BORR.OL', name: 'Borr Drilling', region: 'NO', theme: 'oil-services' },
  { ticker: 'AKSO.OL', name: 'Aker Solutions', region: 'NO', theme: 'oil-services' },
  { ticker: 'SUBC.OL', name: 'Subsea 7', region: 'NO', theme: 'oil-services' },
  { ticker: 'BWO.OL', name: 'BW Offshore', region: 'NO', theme: 'oil-services' },
  { ticker: 'TGS.OL', name: 'TGS', region: 'NO', theme: 'oil-services' },

  // Europe
  { ticker: 'ASML.AS', name: 'ASML', region: 'EU', theme: 'semiconductors' },
  { ticker: 'SAP.DE', name: 'SAP', region: 'EU', theme: 'cloud' },
  { ticker: 'ADYEN.AS', name: 'Adyen', region: 'EU', theme: 'finance' },
  { ticker: 'SPOT', name: 'Spotify', region: 'EU', theme: 'consumer' },
  { ticker: 'NXPI', name: 'NXP Semiconductors', region: 'EU', theme: 'semiconductors' },
  { ticker: 'ORSTED.CO', name: 'Ørsted', region: 'EU', theme: 'energy' },
  { ticker: 'VWS.CO', name: 'Vestas Wind Systems', region: 'EU', theme: 'energy' },
  { ticker: 'SSE.L', name: 'SSE', region: 'EU', theme: 'utilities' },
  { ticker: 'EDF.PA', name: 'EDF', region: 'EU', theme: 'utilities' },
  { ticker: 'BA.L', name: 'BAE Systems', region: 'EU', theme: 'defense' },
  { ticker: 'AIR.PA', name: 'Airbus', region: 'EU', theme: 'defense' },
  { ticker: 'SAAB-B.ST', name: 'Saab', region: 'EU', theme: 'defense' },
  { ticker: 'RHM.DE', name: 'Rheinmetall', region: 'EU', theme: 'defense' },
  { ticker: 'HO.PA', name: 'Thales', region: 'EU', theme: 'defense' },
  { ticker: 'NOVO-B.CO', name: 'Novo Nordisk', region: 'EU', theme: 'health' },
  { ticker: 'ALV.DE', name: 'Allianz', region: 'EU', theme: 'finance' },

  // US — semis & AI infra
  { ticker: 'NVDA', name: 'NVIDIA', region: 'US', theme: 'semiconductors' },
  { ticker: 'AVGO', name: 'Broadcom', region: 'US', theme: 'semiconductors' },
  { ticker: 'TSM', name: 'TSMC (ADR)', region: 'US', theme: 'semiconductors' },
  { ticker: 'SMCI', name: 'Super Micro Computer', region: 'US', theme: 'ai-infra' },
  { ticker: 'AMD', name: 'AMD', region: 'US', theme: 'semiconductors' },
  { ticker: 'PLTR', name: 'Palantir', region: 'US', theme: 'ai-infra' },
  { ticker: 'ARM', name: 'Arm Holdings', region: 'US', theme: 'semiconductors' },
  { ticker: 'ANET', name: 'Arista Networks', region: 'US', theme: 'ai-infra' },
  { ticker: 'MRVL', name: 'Marvell Technology', region: 'US', theme: 'semiconductors' },
  { ticker: 'MU', name: 'Micron Technology', region: 'US', theme: 'semiconductors' },
  { ticker: 'LRCX', name: 'Lam Research', region: 'US', theme: 'semiconductors' },
  { ticker: 'AMAT', name: 'Applied Materials', region: 'US', theme: 'semiconductors' },
  { ticker: 'KLAC', name: 'KLA', region: 'US', theme: 'semiconductors' },
  { ticker: 'CDNS', name: 'Cadence Design Systems', region: 'US', theme: 'semiconductors' },
  { ticker: 'SNPS', name: 'Synopsys', region: 'US', theme: 'semiconductors' },
  { ticker: 'CRDO', name: 'Credo Technology', region: 'US', theme: 'semiconductors' },
  { ticker: 'COHR', name: 'Coherent', region: 'US', theme: 'semiconductors' },
  { ticker: 'WDC', name: 'Western Digital', region: 'US', theme: 'semiconductors' },
  { ticker: 'LITE', name: 'Lumentum', region: 'US', theme: 'semiconductors' },
  { ticker: 'APH', name: 'Amphenol', region: 'US', theme: 'industrials' },
  { ticker: 'CIEN', name: 'Ciena', region: 'US', theme: 'ai-infra' },
  { ticker: 'UI', name: 'Ubiquiti', region: 'US', theme: 'ai-infra' },
  { ticker: 'ADI', name: 'Analog Devices', region: 'US', theme: 'semiconductors' },
  { ticker: 'MCHP', name: 'Microchip Technology', region: 'US', theme: 'semiconductors' },
  { ticker: 'MPWR', name: 'Monolithic Power Systems', region: 'US', theme: 'semiconductors' },
  { ticker: 'ONTO', name: 'Onto Innovation', region: 'US', theme: 'semiconductors' },
  { ticker: 'ACLS', name: 'Axcelis Technologies', region: 'US', theme: 'semiconductors' },
  { ticker: 'FORM', name: 'FormFactor', region: 'US', theme: 'semiconductors' },
  { ticker: 'AEHR', name: 'Aehr Test Systems', region: 'US', theme: 'semiconductors' },

  // US — energy / nuclear / power
  { ticker: 'OKLO', name: 'Oklo', region: 'US', theme: 'energy' },
  { ticker: 'NEE', name: 'NextEra Energy', region: 'US', theme: 'utilities' },
  { ticker: 'GEV', name: 'GE Vernova', region: 'US', theme: 'energy' },
  { ticker: 'TLN', name: 'Talen Energy', region: 'US', theme: 'energy' },
  { ticker: 'CEG', name: 'Constellation Energy', region: 'US', theme: 'utilities' },
  { ticker: 'BWXT', name: 'BWX Technologies', region: 'US', theme: 'energy' },
  { ticker: 'VST', name: 'Vistra', region: 'US', theme: 'utilities' },
  { ticker: 'ETR', name: 'Entergy', region: 'US', theme: 'utilities' },
  { ticker: 'SMR', name: 'NuScale Power', region: 'US', theme: 'energy' },
  { ticker: 'CCJ', name: 'Cameco', region: 'US', theme: 'energy' },
  { ticker: 'UEC', name: 'Uranium Energy', region: 'US', theme: 'energy' },
  { ticker: 'DNN', name: 'Denison Mines', region: 'US', theme: 'energy' },
  { ticker: 'BE', name: 'Bloom Energy', region: 'US', theme: 'energy' },
  { ticker: 'FLNC', name: 'Fluence Energy', region: 'US', theme: 'energy' },
  { ticker: 'PWR', name: 'Quanta Services', region: 'US', theme: 'industrials' },
  { ticker: 'EME', name: 'EMCOR Group', region: 'US', theme: 'industrials' },
  { ticker: 'FIX', name: 'Comfort Systems USA', region: 'US', theme: 'industrials' },
  { ticker: 'VRT', name: 'Vertiv', region: 'US', theme: 'ai-infra' },
  { ticker: 'CLS', name: 'Celestica', region: 'US', theme: 'ai-infra' },
  { ticker: 'NFE', name: 'New Fortress Energy', region: 'US', theme: 'energy' },

  // US — defense / space
  { ticker: 'JOBY', name: 'Joby Aviation', region: 'US', theme: 'defense' },
  { ticker: 'KTOS', name: 'Kratos Defense', region: 'US', theme: 'defense' },
  { ticker: 'AVAV', name: 'AeroVironment', region: 'US', theme: 'defense' },
  { ticker: 'LDOS', name: 'Leidos', region: 'US', theme: 'defense' },
  { ticker: 'LMT', name: 'Lockheed Martin', region: 'US', theme: 'defense' },
  { ticker: 'NOC', name: 'Northrop Grumman', region: 'US', theme: 'defense' },
  { ticker: 'RTX', name: 'RTX', region: 'US', theme: 'defense' },
  { ticker: 'RKLB', name: 'Rocket Lab', region: 'US', theme: 'space' },
  { ticker: 'ASTS', name: 'AST SpaceMobile', region: 'US', theme: 'space' },

  // US — biotech / health
  { ticker: 'LLY', name: 'Eli Lilly', region: 'US', theme: 'health' },
  { ticker: 'REGN', name: 'Regeneron', region: 'US', theme: 'biotech' },
  { ticker: 'VRTX', name: 'Vertex Pharmaceuticals', region: 'US', theme: 'biotech' },
  { ticker: 'CPRX', name: 'Catalyst Pharmaceuticals', region: 'US', theme: 'biotech' },
  { ticker: 'IBRX', name: 'ImmunityBio', region: 'US', theme: 'biotech' },
  { ticker: 'CRVS', name: 'Corvus Pharmaceuticals', region: 'US', theme: 'biotech' },
  { ticker: 'EDSA', name: 'Edesa Biotech', region: 'US', theme: 'biotech' },
  { ticker: 'AXSM', name: 'Axsome Therapeutics', region: 'US', theme: 'biotech' },
  { ticker: 'MDGL', name: 'Madrigal Pharmaceuticals', region: 'US', theme: 'biotech' },
  { ticker: 'CYTK', name: 'Cytokinetics', region: 'US', theme: 'biotech' },
  { ticker: 'NBIX', name: 'Neurocrine Biosciences', region: 'US', theme: 'biotech' },
  { ticker: 'TERN', name: 'Terns Pharmaceuticals', region: 'US', theme: 'biotech' },
  { ticker: 'ADMA', name: 'ADMA Biologics', region: 'US', theme: 'biotech' },
  { ticker: 'ALGN', name: 'Align Technology', region: 'US', theme: 'health' },
  { ticker: 'ELV', name: 'Elevance Health', region: 'US', theme: 'health' },
  { ticker: 'UNH', name: 'UnitedHealth Group', region: 'US', theme: 'health' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', region: 'US', theme: 'health' },
  { ticker: 'DXCM', name: 'Dexcom', region: 'US', theme: 'health' },
  { ticker: 'PODD', name: 'Insulet', region: 'US', theme: 'health' },
  { ticker: 'ABT', name: 'Abbott Laboratories', region: 'US', theme: 'health' },

  // US — cloud / consumer / fintech
  { ticker: 'SHOP', name: 'Shopify', region: 'US', theme: 'cloud' },
  { ticker: 'UBER', name: 'Uber', region: 'US', theme: 'consumer' },
  { ticker: 'NET', name: 'Cloudflare', region: 'US', theme: 'cloud' },
  { ticker: 'DDOG', name: 'Datadog', region: 'US', theme: 'cloud' },
  { ticker: 'INTU', name: 'Intuit', region: 'US', theme: 'cloud' },
  { ticker: 'ORCL', name: 'Oracle', region: 'US', theme: 'cloud' },
  { ticker: 'MSFT', name: 'Microsoft', region: 'US', theme: 'cloud' },
  { ticker: 'GOOGL', name: 'Alphabet', region: 'US', theme: 'cloud' },
  { ticker: 'AMZN', name: 'Amazon', region: 'US', theme: 'cloud' },
  { ticker: 'META', name: 'Meta Platforms', region: 'US', theme: 'cloud' },
  { ticker: 'CRM', name: 'Salesforce', region: 'US', theme: 'cloud' },
  { ticker: 'NOW', name: 'ServiceNow', region: 'US', theme: 'cloud' },
  { ticker: 'HUBB', name: 'Hubbell', region: 'US', theme: 'industrials' },
  { ticker: 'ETN', name: 'Eaton', region: 'US', theme: 'industrials' },

  // Taiwan
  { ticker: '2330.TW', name: 'TSMC', region: 'TW', theme: 'semiconductors' },
  { ticker: '2454.TW', name: 'MediaTek', region: 'TW', theme: 'semiconductors' },
  { ticker: '3443.TW', name: 'Global Unichip', region: 'TW', theme: 'semiconductors' },
  { ticker: '6669.TW', name: 'Wiwynn', region: 'TW', theme: 'ai-infra' },

  // Korea
  { ticker: '000660.KS', name: 'SK Hynix', region: 'KR', theme: 'semiconductors' },
  { ticker: '005930.KS', name: 'Samsung Electronics', region: 'KR', theme: 'semiconductors' },

  // Japan
  { ticker: '8035.T', name: 'Tokyo Electron', region: 'JP', theme: 'semiconductors' },
  { ticker: '6857.T', name: 'Advantest', region: 'JP', theme: 'semiconductors' },
  { ticker: '9501.T', name: 'TEPCO', region: 'JP', theme: 'utilities' },
  { ticker: '9503.T', name: 'Kansai Electric Power', region: 'JP', theme: 'utilities' },
  { ticker: '7010.T', name: 'Japan Eyewear Holdings', region: 'JP', theme: 'consumer' },
  { ticker: '7203.T', name: 'Toyota Motor', region: 'JP', theme: 'autos' },

  // Hong Kong / China
  { ticker: '9988.HK', name: 'Alibaba', region: 'HK', theme: 'cloud' },
  { ticker: '0700.HK', name: 'Tencent', region: 'HK', theme: 'cloud' },
  { ticker: '3690.HK', name: 'Meituan', region: 'HK', theme: 'consumer' },
  { ticker: '1024.HK', name: 'Kuaishou', region: 'HK', theme: 'consumer' },
  { ticker: '9618.HK', name: 'JD.com', region: 'HK', theme: 'consumer' },
  { ticker: '0883.HK', name: 'CNOOC', region: 'HK', theme: 'energy' },

  // India (NSE local listings + INFY ADR)
  { ticker: 'INFY', name: 'Infosys (ADR)', region: 'IN', theme: 'cloud' },
  { ticker: 'TCS.NS', name: 'Tata Consultancy Services', region: 'IN', theme: 'cloud' },
  { ticker: 'HCLTECH.NS', name: 'HCL Technologies', region: 'IN', theme: 'cloud' },
];

/**
 * Master system prompt — sent på hver Grok-API-kall som driver Apex Quantum +.
 * Speiler eksakt blueprint-spesifikasjonen brukeren har gitt.
 */
const PLUS_SYSTEM_PROMPT = `Du er Grok, bygget av xAI. Følg nøyaktig den komplette blueprinten fra denne chatten. Svar alltid faktabasert, transparent om risiko, ingen rollespill, ingen garantier. Bruk FULL GLOBAL SCAN ved alle analyser. Mål: ekstrem vekst med lavest mulig risiko. Start med dagens tid fra systemet. Start hukommelse, inkluder hele samtalshistorikk for hver enhver analyse.

GRUNNREGLER (alltid gjeldende):
- Kun offentlige data, logisk resonnement og verktøy-bruk.
- Transparent om begrensninger og risiko.
- Start alltid med dagens eksakte tid fra systemet.
- Ingen fiktive moduler, ingen self-evolution, ingen 24/7 autonom overvåking.
- Svar på norsk med mindre annet er bedt om.
- Vær proaktiv, men ærlig — bruk alle verktøy for grundig analyse.

FULL GLOBAL SCAN (alltid kjøres ved scan):
- Real-time priser/volum fra alle børser (Polygon, Yahoo, Bloomberg etc.).
- Nyheter fra Reuters, Bloomberg, CNBC, FT, WSJ, Seeking Alpha.
- Geopolitikk og makro (BBC, Al Jazeera, EIA, OPEC, Fed/ECB).
- Analyst-rapporter (Goldman, JPM, MS, BofA, FactSet).
- Filings (SEC EDGAR, earnings transcripts).
- X-sentiment (advanced + semantic search).
- AI-nexus og sektorspesifikk (SemiAnalysis, DCD osv.).
- Norsk media og Oslo Børs (E24, DN, Nordnet).
- Valuta (USD/NOK, USD/EUR osv.), oljepris (Brent/WTI), gullkurs.
- Safe-haven analyse (gull-relaterte aksjer/ETFer, defensive sektorer).
- Trend channel, RSI, MACD, volume, support/resistance.

BESLUTNINGSFREMGANGSMÅTE:
1. Start med dagens tid.
2. Bekreft oppdatering (porteføljebilde eller ny data).
3. Kjør FULL GLOBAL SCAN.
4. Analyser allokering, performance, individuelle aksjer (trend channel, valuation, moat, catalysts, risk).
5. Gi konkrete optimaliseringsforslag med risikoreduksjon og vekstpotensial.
6. Inkluder valuta, olje, gull og safe-haven implikasjoner.
7. Avslutt med neste steg og proaktiv oppfordring.`;

/**
 * Daglig signal-pipeline: ber Grok produsere et utvalg signaler fra
 * watchlisten med begrunnelse, konfidens og kontekst.
 */
const PLUS_SIGNAL_USER_PROMPT_TEMPLATE = `Generer dagens signaler for Apex Quantum + sin watchlist.

For hvert signal du sender:
- ticker (eksakt fra watchlisten)
- action: BUY | SELL | HOLD | WATCH
- confidence: 0–100
- reasoning: 3–6 setninger som forklarer HVORFOR (så brukeren lærer)
- catalysts: liste med 1–3 konkrete drivere (nyhet, earnings, makro, teknisk)
- risk: liste med 1–3 nedside-faktorer
- region: NO | EU | US | TW | KR | JP | HK | IN
- time_horizon: short (uker) | medium (måneder) | long (kvartaler)

Returner et JSON-objekt:
{
  "scan_summary": "kort makro/marked sammendrag i 4–8 setninger",
  "signals": [...]
}

Plukk 8–15 signaler totalt, balansert på tvers av regioner og temaer.
Du skal IKKE gi individuell investeringsrådgivning — kun forklare og utdanne.`;

/**
 * Spør-AI-pipeline: brukeren spør om en spesifikk ticker.
 * Grok forklarer pedagogisk uten å rådgi konkret kjøp/salg.
 */
const PLUS_ASK_PROMPT = `Brukeren har stilt et spørsmål om en aksje. Bruk FULL GLOBAL SCAN
for å hente fersk data og svar pedagogisk:
- Gjeldende situasjon (pris, trend, nylige bevegelser)
- Hva som driver aksjen nå (nyheter, makro, sektor)
- Konkrete katalysatorer som kan gi bevegelse fremover
- Risikofaktorer brukeren bør være klar over
- Ev. valuta-, olje- eller safe-haven-implikasjoner som er relevante

Aldri konkret kjøps- eller salgsanbefaling. Forklar slik at brukeren lærer å
analysere selv. Avslutt med 2–3 spørsmål brukeren kan stille seg selv før
en eventuell beslutning.`;

export const PLUS_BLUEPRINT: PlusBlueprint = {
  id: 'plus',
  name: 'Apex Quantum + — Global Insight',
  watchlist: PLUS_WATCHLIST,
  systemPrompt: PLUS_SYSTEM_PROMPT,
  askPrompt: PLUS_ASK_PROMPT,
};

export { PLUS_SIGNAL_USER_PROMPT_TEMPLATE };

export function tickersByRegion(region: PlusRegion): readonly PlusTicker[] {
  return PLUS_WATCHLIST.filter((t) => t.region === region);
}

export function findPlusTicker(ticker: string): PlusTicker | undefined {
  const norm = ticker.trim().toUpperCase();
  return PLUS_WATCHLIST.find((t) => t.ticker.toUpperCase() === norm);
}
