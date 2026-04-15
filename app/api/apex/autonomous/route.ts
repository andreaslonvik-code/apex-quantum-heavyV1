// APEX QUANTUM v6.2 - TimesFM Hybrid AI + Extreme 10% Daily Mode
// Build fix: 2026-04-14 19:12 CET - Fixed getOrSearchUIC to findInstrument
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// ============ MARKET HOURS LOGIC (CET) ============
// Oslo Børs: 09:00 - 16:25 CET
// Nasdaq/US: 15:30 - 22:00 CET
interface MarketStatus {
  osloOpen: boolean;
  usOpen: boolean;
  activeMarkets: ('US' | 'OSLO')[];
  message: string;
}

// FORCE TRADING MODE - Always allow trading for testing
const FORCE_TRADING_ALWAYS = true;

function getMarketStatus(): MarketStatus {
  // Get current time in CET/CEST (Europe/Oslo timezone)
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  const hours = cetTime.getHours();
  const minutes = cetTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const dayOfWeek = cetTime.getDay(); // 0=Sunday, 6=Saturday
  
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Oslo Børs: 09:00 - 16:25 CET (540 - 985 minutes)
  const normalOsloOpen = !isWeekend && timeInMinutes >= 540 && timeInMinutes < 985;
  
  // Nasdaq/US: 15:30 - 22:00 CET (930 - 1320 minutes)
  const normalUsOpen = !isWeekend && timeInMinutes >= 930 && timeInMinutes < 1320;
  
  // FORCE MODE: Always open for testing
  const osloOpen = FORCE_TRADING_ALWAYS || normalOsloOpen;
  const usOpen = FORCE_TRADING_ALWAYS || normalUsOpen;
  
  // Build active markets list
  const activeMarkets: ('US' | 'OSLO')[] = [];
  if (osloOpen) activeMarkets.push('OSLO');
  if (usOpen) activeMarkets.push('US');
  
  let message = '';
  if (normalOsloOpen && normalUsOpen) {
    message = `OSLO + US MARKEDER APNE (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET)`;
  } else if (normalOsloOpen) {
    message = `OSLO BORS APEN (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - US apner 15:30`;
  } else if (normalUsOpen) {
    message = `US MARKET APEN (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET)`;
  } else if (FORCE_TRADING_ALWAYS) {
    message = `FORCE MODE (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - Trading aktiv utenfor apningstid`;
  } else {
    message = `MARKEDER STENGT (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET)`;
  }
  
  console.log(`[APEX] MarketStatus: osloOpen=${osloOpen}, usOpen=${usOpen}, FORCE=${FORCE_TRADING_ALWAYS}`);
  
  return { osloOpen, usOpen, activeMarkets, message };
}

// ============ APEX QUANTUM v6.2 - TIMESFM HYBRID AI ============
// AI-hybrid trading system combining:
// 1. TimesFM time-series forecasting (40% weight)
// 2. RSI momentum analysis (30% weight)  
// ============ APEX QUANTUM v6.2 – OSLO BØRS VOLATILITY HUNTER ============
// Target: Capture ALL market movements through high-frequency volatility trading
// Oslo Børs: Dynamic stock discovery + aggressive momentum trading
// US: Core holdings for stability

// ============ US CORE HOLDINGS (static, long-term) ============
const US_CORE_HOLDINGS: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  assetType: string;
  market: 'US';
  score: number;
}> = {
  MU:   { navn: 'Micron Technology',    targetVekt: 50, volatilitet: 3, saxoSymbol: 'MU:xnas',   assetType: 'Stock', market: 'US', score: 8.8 },
  CEG:  { navn: 'Constellation Energy', targetVekt: 25, volatilitet: 2, saxoSymbol: 'CEG:xnas',  assetType: 'Stock', market: 'US', score: 9.4 },
  VRT:  { navn: 'Vertiv Holdings',      targetVekt: 15, volatilitet: 2, saxoSymbol: 'VRT:xnys',  assetType: 'Stock', market: 'US', score: 8.5 },
  RKLB: { navn: 'Rocket Lab',           targetVekt: 10, volatilitet: 4, saxoSymbol: 'RKLB:xnas', assetType: 'Stock', market: 'US', score: 8.4 },
};

// ============ OSLO BØRS VOLATILITY SCANNER CONFIG ============
// These are SEED tickers for discovery - system will find more dynamically
const OSLO_VOLATILITY_SEEDS = [
  'NAS', 'NORSE', 'NEL', 'REC', 'AKER', 'PGS', 'SCHA', 'AKSO', 'BWO', 'SUBC',
  'KAHOT', 'OTELLO', 'ENDUR', 'PROT', 'AUSS', 'FLNG', 'COOL', 'BELCO', 'BORR', 'IDEX'
];

// Dynamic Oslo stocks discovered during runtime
interface OsloVolatilityStock {
  ticker: string;
  navn: string;
  uic: number;
  volatility: number;  // Calculated from price movements
  lastPrice: number;
  change24h: number;   // % change in 24h
  volume: number;
  score: number;       // Volatility score 1-10
  lastUpdated: number;
}

// In-memory cache for discovered Oslo stocks
const osloVolatilityCache: Map<string, OsloVolatilityStock> = new Map();

// Combined blueprint for signal generation
const APEX_BLUEPRINT: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  assetType: string;
  market: 'US' | 'OSLO';
  score: number;
}> = { ...US_CORE_HOLDINGS };

// Oslo allocation settings
const OSLO_ALLOCATION_PERCENT = 40; // 40% of capital for Oslo volatility trading
const US_ALLOCATION_PERCENT = 60;   // 60% for US core holdings
const MIN_VOLATILITY_SCORE = 6;     // Minimum score to trade Oslo stock
const MAX_OSLO_POSITIONS = 5;       // Max concurrent Oslo positions

// Momentum tracking for intra-day swings
interface PricePoint {
  price: number;
  timestamp: number;
}

interface MomentumData {
  prices: PricePoint[];
  localHigh: number;
  localLow: number;
  rsi: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
}

// Price history for momentum analysis (in-memory, resets on cold start)
const priceHistory: Map<string, PricePoint[]> = new Map();

// ============ TIMESFM PREDICTION ENGINE ============
// TimesFM-inspired prediction using exponential smoothing + trend detection
function runTimesFMPrediction(prices: number[], horizonSteps: number = 5): { 
  predictions: number[]; 
  predictedReturn: number; 
  confidence: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
} {
  const n = prices.length;
  if (n < 3) {
    return { predictions: [], predictedReturn: 0, confidence: 50, direction: 'NEUTRAL' };
  }
  
  // Calculate trend using linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate volatility
  const mean = sumY / n;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += Math.pow(prices[i] - mean, 2);
  }
  const volatility = Math.sqrt(variance / n) / mean;
  
  // Exponential smoothing
  const alpha = 0.4;
  let smoothed = prices[n - 1];
  for (let i = Math.max(0, n - 10); i < n; i++) {
    smoothed = alpha * prices[i] + (1 - alpha) * smoothed;
  }
  
  // Generate predictions
  const predictions: number[] = [];
  let lastPrice = prices[n - 1];
  
  for (let i = 0; i < horizonSteps; i++) {
    const trendComponent = slope * 0.7;
    const meanReversionComponent = (smoothed - lastPrice) * 0.15;
    const nextPrice = lastPrice + trendComponent + meanReversionComponent;
    predictions.push(Math.max(0.01, nextPrice));
    lastPrice = nextPrice;
  }
  
  const currentPrice = prices[n - 1];
  const finalPrediction = predictions[predictions.length - 1];
  const predictedReturn = (finalPrediction - currentPrice) / currentPrice;
  
  // Confidence based on trend consistency and volatility
  const trendStrength = Math.abs(slope) / mean;
  const confidence = Math.min(95, Math.max(40, 60 + trendStrength * 500 - volatility * 100));
  
  const direction: 'UP' | 'DOWN' | 'NEUTRAL' = 
    predictedReturn > 0.005 ? 'UP' : predictedReturn < -0.005 ? 'DOWN' : 'NEUTRAL';
  
  return { predictions, predictedReturn, confidence, direction };
}

// ============ OSLO BØRS VOLATILITY SCANNER ============
// Scans Oslo Børs for high-volatility stocks and ranks them for trading
async function scanOsloVolatility(
  accessToken: string
): Promise<OsloVolatilityStock[]> {
  console.log(`[APEX OSLO] Scanning Oslo Børs for high-volatility opportunities...`);
  
  const discoveredStocks: OsloVolatilityStock[] = [];
  
  for (const ticker of OSLO_VOLATILITY_SEEDS) {
    try {
      // Search for the stock on Oslo Børs
      const searchResult = await safeFetchJson<{ Data?: Array<{ Identifier: number; Symbol: string; Description: string; AssetType: string }> }>(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}:xosl&AssetTypes=Stock&$top=5`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (!searchResult.ok || !searchResult.data?.Data?.length) continue;
      
      // Filter to only stocks (no CFD)
      const stockMatch = searchResult.data.Data.find(i => i.AssetType === 'Stock');
      if (!stockMatch) continue;
      
      const uic = stockMatch.Identifier;
      
      // Get current price and intraday data
      const priceResult = await safeFetchJson<{ Quote?: { Ask?: number; Bid?: number; Mid?: number; PriceChangePercent?: number } }>(
        `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${uic}&AssetType=Stock&FieldGroups=Quote`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (!priceResult.ok || !priceResult.data?.Quote) continue;
      
      const quote = priceResult.data.Quote;
      const price = quote.Mid || quote.Ask || quote.Bid || 0;
      const change24h = quote.PriceChangePercent || 0;
      
      // Calculate volatility score based on % change
      // Higher absolute change = higher volatility = more opportunity
      const absChange = Math.abs(change24h);
      const volatilityScore = Math.min(10, Math.max(1, absChange * 2 + 3));
      
      // Only add stocks with meaningful volatility
      if (volatilityScore >= MIN_VOLATILITY_SCORE || absChange >= 2) {
        const stock: OsloVolatilityStock = {
          ticker,
          navn: stockMatch.Description || ticker,
          uic,
          volatility: absChange,
          lastPrice: price,
          change24h,
          volume: 0, // Would need separate API call
          score: volatilityScore,
          lastUpdated: Date.now(),
        };
        
        discoveredStocks.push(stock);
        osloVolatilityCache.set(ticker, stock);
        console.log(`[APEX OSLO] Found: ${ticker} @ ${price.toFixed(2)} NOK, change: ${change24h.toFixed(2)}%, score: ${volatilityScore.toFixed(1)}`);
      }
    } catch (err) {
      console.log(`[APEX OSLO] Error scanning ${ticker}:`, err);
    }
  }
  
  // Sort by volatility score (highest first)
  discoveredStocks.sort((a, b) => b.score - a.score);
  
  // Return top performers
  const topStocks = discoveredStocks.slice(0, MAX_OSLO_POSITIONS);
  console.log(`[APEX OSLO] Top ${topStocks.length} volatile stocks: ${topStocks.map(s => `${s.ticker}(${s.score.toFixed(1)})`).join(', ')}`);
  
  return topStocks;
}

// ============ OSLO VOLATILITY TRADING SIGNALS ============
async function generateOsloVolatilitySignals(
  accessToken: string,
  accountKey: string,
  balance: number,
  marketStatus: MarketStatus
): Promise<Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; uic: number; market: 'OSLO' }>> {
  if (!marketStatus.osloOpen) {
    console.log(`[APEX OSLO] Market closed - skipping volatility scan`);
    return [];
  }
  
  const signals: Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; uic: number; market: 'OSLO' }> = [];
  
  // Scan for volatile stocks
  const volatileStocks = await scanOsloVolatility(accessToken);
  
  if (volatileStocks.length === 0) {
    console.log(`[APEX OSLO] No high-volatility stocks found`);
    return signals;
  }
  
  // Calculate Oslo allocation
  const osloCapital = balance * (OSLO_ALLOCATION_PERCENT / 100);
  const perStockAllocation = osloCapital / Math.max(1, volatileStocks.length);
  
  console.log(`[APEX OSLO] Capital for Oslo: ${osloCapital.toFixed(0)} EUR, per stock: ${perStockAllocation.toFixed(0)} EUR`);
  
  for (const stock of volatileStocks) {
    const orderValue = Math.min(perStockAllocation, MAX_ORDER_VALUE);
    let shares = Math.floor(orderValue / stock.lastPrice);
    shares = Math.min(shares, MAX_SHARES_PER_ORDER);
    shares = Math.max(shares, 10); // Minimum 10 shares
    
    if (shares * stock.lastPrice > balance * 0.1) {
      // Cap at 10% of total balance per trade
      shares = Math.floor((balance * 0.1) / stock.lastPrice);
    }
    
    if (shares < 10) continue;
    
    // Determine action based on momentum
    let action: 'BUY' | 'SELL' = 'BUY';
    let reason = '';
    
    if (stock.change24h < -3) {
      // Big dip - aggressive buy
      action = 'BUY';
      reason = `[OSLO] DIP KJOP ${stock.change24h.toFixed(1)}% - Volatility score ${stock.score.toFixed(1)}`;
      shares = Math.min(MAX_SHARES_PER_ORDER, Math.floor(shares * 1.5)); // Larger on dips
    } else if (stock.change24h > 5) {
      // Big pump - take profits if we have position
      action = 'SELL';
      reason = `[OSLO] TA GEVINST ${stock.change24h.toFixed(1)}% - Score ${stock.score.toFixed(1)}`;
    } else if (stock.score >= 7) {
      // High volatility = opportunity
      action = 'BUY';
      reason = `[OSLO] HØY VOLATILITET ${stock.volatility.toFixed(1)}% - Score ${stock.score.toFixed(1)}`;
    } else {
      // Moderate volatility - smaller position
      action = 'BUY';
      reason = `[OSLO] MOMENTUM ${stock.change24h > 0 ? '+' : ''}${stock.change24h.toFixed(1)}%`;
      shares = Math.floor(shares * 0.7);
    }
    
    if (shares >= 10) {
      signals.push({
        ticker: stock.ticker,
        action,
        amount: shares,
        reason,
        price: stock.lastPrice,
        uic: stock.uic,
        market: 'OSLO',
      });
      
      console.log(`[APEX OSLO] SIGNAL: ${action} ${shares}x ${stock.ticker} @ ${stock.lastPrice.toFixed(2)} NOK - ${reason}`);
    }
  }
  
  return signals;
}

// Calculate TimesFM-enhanced score
function calculateTimesFMScore(
  priceHistory: number[],
  rsi: number,
  targetWeight: number
): { score: number; action: 'BUY' | 'SELL' | 'HOLD'; reason: string } {
  const tfm = runTimesFMPrediction(priceHistory);
  
  // TimesFM Score (40% weight)
  const timesfmScore = Math.min(100, Math.max(0, 50 + tfm.predictedReturn * 1000));
  
  // Momentum Score (30% weight) - RSI-based
  const momentumScore = Math.min(100, Math.max(0, 100 - rsi));
  
  // Apex Score (30% weight) - portfolio weight
  const apexScore = targetWeight * 2;
  
  // Combined Score
  const combinedScore = timesfmScore * 0.4 + momentumScore * 0.3 + apexScore * 0.3;
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let reason = '';
  
  if (combinedScore >= 55 && tfm.direction === 'UP') {
    action = 'BUY';
    reason = `TimesFM: ${tfm.direction} +${(tfm.predictedReturn * 100).toFixed(2)}% (${tfm.confidence.toFixed(0)}% conf)`;
  } else if (combinedScore >= 50 && rsi < 40) {
    action = 'BUY';
    reason = `RSI oversold (${rsi.toFixed(0)}) + TimesFM: ${(tfm.predictedReturn * 100).toFixed(2)}%`;
  } else if (combinedScore <= 45 && tfm.direction === 'DOWN') {
    action = 'SELL';
    reason = `TimesFM: ${tfm.direction} ${(tfm.predictedReturn * 100).toFixed(2)}%`;
  } else if (rsi > 65) {
    action = 'SELL';
    reason = `RSI overbought (${rsi.toFixed(0)}) - ta profitt`;
  }
  
  return { score: combinedScore, action, reason };
}

// Cache for resolved UICs
const uicCache: Map<string, { uic: number; assetType: string }> = new Map();

// ============ PROFIT LOCK SYSTEM ============
const BASE_TRADING_CAPITAL = 1000000; // 1 million NOK
const lockedProfits: Map<string, number> = new Map();
const purchasePrices: Map<string, Map<string, number>> = new Map();

// ============ BULLETPROOF FETCH HELPER ============
// ALWAYS get text first, then try to parse JSON
// Prevents "Unexpected token '<'" when API returns HTML
async function safeFetchJson<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string; rawBody: string; status: number }> {
  try {
    const res = await fetch(url, options);
    const rawBody = await res.text();
    
    // Check if HTML response
    const isHtml = rawBody.trim().startsWith('<') || rawBody.includes('<!DOCTYPE');
    
    if (!res.ok) {
      const errorMsg = isHtml 
        ? `Saxo returned HTML (${res.status}): ${rawBody.substring(0, 200)}`
        : `Saxo error (${res.status}): ${rawBody.substring(0, 300)}`;
      console.error(`[APEX FETCH] FAILED ${url}: ${errorMsg}`);
      return { ok: false, error: errorMsg, rawBody, status: res.status };
    }
    
    if (isHtml) {
      console.error(`[APEX FETCH] Received HTML instead of JSON for ${url}`);
      return { ok: false, error: `Received HTML: ${rawBody.substring(0, 200)}`, rawBody, status: res.status };
    }
    
    // Try to parse JSON
    try {
      const data = JSON.parse(rawBody) as T;
      return { ok: true, data, rawBody, status: res.status };
    } catch {
      console.error(`[APEX FETCH] JSON parse failed for ${url}: ${rawBody.substring(0, 200)}`);
      return { ok: false, error: `JSON parse failed: ${rawBody.substring(0, 200)}`, rawBody, status: res.status };
    }
  } catch (e) {
    console.error(`[APEX FETCH] Network error for ${url}: ${e}`);
    return { ok: false, error: `Network error: ${e}`, rawBody: '', status: 0 };
  }
}

// Search for instrument UIC dynamically
async function findInstrument(accessToken: string, ticker: string, saxoSymbol: string, preferredAssetType: string = 'Stock'): Promise<{ uic: number; assetType: string } | null> {
  const cacheKey = `${ticker}_${preferredAssetType}`;
  if (uicCache.has(cacheKey)) {
    return uicCache.get(cacheKey)!;
  }
  
  try {
    // Try multiple search patterns including Oslo Børs and Copenhagen
    const searches = [
      saxoSymbol, 
      `${ticker}:xnas`, 
      `${ticker}:xnys`, 
      `${ticker}:xosl`,
      `${ticker}:xcse`,
      ticker
    ];
    
    // ONLY search for Stock - NO CFDs!
    const assetType = 'Stock';
    
    for (const keyword of searches) {
      const result = await safeFetchJson<{ Data?: Array<{ Identifier: number; AssetType?: string; Symbol?: string }> }>(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(keyword)}&AssetTypes=${assetType}&$top=10`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (result.ok && result.data?.Data && result.data.Data.length > 0) {
        // Filter to ONLY Stock, never CFD
        const stocksOnly = result.data.Data.filter((i) => i.AssetType === 'Stock');
        if (stocksOnly.length === 0) continue;
        
        // Try to find exact match
        const match = stocksOnly.find((i) => 
          i.Symbol?.toUpperCase() === ticker ||
          i.Symbol?.toUpperCase().startsWith(ticker + ':')
        ) || stocksOnly[0];
        
        const found = { uic: match.Identifier, assetType: 'Stock' };
        uicCache.set(cacheKey, found);
        console.log(`[APEX] Found STOCK ${ticker}: UIC=${found.uic}, Symbol=${match.Symbol}`);
        return found;
      }
    }
    
    console.log(`[APEX] Could not find STOCK instrument: ${ticker}`);
    return null;
  } catch (e) {
    console.log(`[APEX] Search error for ${ticker}: ${e}`);
    return null;
  }
}

// Get current price with bid/ask spread
async function getPrice(accessToken: string, uic: number, assetType: string): Promise<{ bid: number; ask: number; mid: number; last: number }> {
  const result = await safeFetchJson<{ Quote?: { Bid?: number; Ask?: number; Last?: number }; PriceInfo?: { LastTraded?: number } }>(
    `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote,PriceInfo`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (result.ok && result.data) {
    const data = result.data;
    const bid = data.Quote?.Bid || data.Quote?.Last || 100;
    const ask = data.Quote?.Ask || data.Quote?.Last || 100;
    const mid = (bid + ask) / 2;
    const last = data.Quote?.Last || data.PriceInfo?.LastTraded || mid;
    return { bid, ask, mid, last };
  }
  
  console.log(`[APEX] getPrice failed for UIC ${uic}: ${result.error}`);
  return { bid: 100, ask: 100, mid: 100, last: 100 };
}

// Calculate RSI from price history
function calculateRSI(prices: PricePoint[]): number {
  if (prices.length < 5) return 50;
  
  const recent = prices.slice(-15);
  let gains = 0, losses = 0, count = 0;
  
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].price - recent[i-1].price;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
    count++;
  }
  
  if (count === 0) return 50;
  const avgGain = gains / count;
  const avgLoss = losses / count;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Analyze momentum for a ticker
function analyzeMomentum(ticker: string, currentPrice: number): MomentumData {
  const history = priceHistory.get(ticker) || [];
  
  const now = Date.now();
  history.push({ price: currentPrice, timestamp: now });
  
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const recentHistory = history.filter(p => p.timestamp > fifteenMinAgo);
  priceHistory.set(ticker, recentHistory);
  
  if (recentHistory.length < 3) {
    return { prices: recentHistory, localHigh: currentPrice, localLow: currentPrice, rsi: 50, trend: 'NEUTRAL' };
  }
  
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMinPrices = recentHistory.filter(p => p.timestamp > fiveMinAgo);
  
  const localHigh = Math.max(...fiveMinPrices.map(p => p.price));
  const localLow = Math.min(...fiveMinPrices.map(p => p.price));
  
  const rsi = calculateRSI(recentHistory);
  
  const avgRecent = fiveMinPrices.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMinPrices.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMinPrices.length);
  const trend = avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  
  return { prices: recentHistory, localHigh, localLow, rsi, trend };
}

// Place market order with market-aware logging
async function placeMarketOrder(
  accessToken: string,
  accountKey: string,
  ticker: string,
  saxoSymbol: string,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  reason: string,
  market: 'US' | 'OSLO'
): Promise<{ success: boolean; orderId?: string; error?: string; uic?: number }> {
  try {
    const instrument = await findInstrument(accessToken, ticker, saxoSymbol, assetType);
    if (!instrument) {
      console.log(`[APEX] FEIL: Fant ikke instrument ${ticker} (sokte: ${assetType})`);
      return { success: false, error: `Fant ikke instrument: ${ticker} (${assetType})` };
    }
    
    // Use the assetType found by the search, not the blueprint one
    const actualAssetType = instrument.assetType;
    
    const body = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: actualAssetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: instrument.uic,
      ManualOrder: false,
    };

    const marketName = 'US Market';
    const actionText = buySell === 'Buy' ? 'kjoper pa dip' : 'tar profitt pa peak';
    console.log(`[APEX] ${marketName} - ${actionText}: ${buySell === 'Buy' ? '+' : '-'}${amount} ${saxoSymbol} (UIC=${instrument.uic}, Type=${actualAssetType})`);

    console.log(`[APEX] Sender til Saxo: ${JSON.stringify(body)}`);
    
    const res = await fetch(`${SAXO_API_BASE}/trade/v2/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.log(`[APEX] <<< ORDRE FEILET (${res.status}): ${responseText}`);
      
      // Parse error for better messaging
      let errorMsg = responseText;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.ErrorInfo) {
          errorMsg = `${errorData.ErrorInfo.ErrorCode}: ${errorData.ErrorInfo.Message}`;
        } else if (errorData.Message) {
          errorMsg = errorData.Message;
        }
      } catch {}
      
      // If market is closed, log clearly
      if (responseText.includes('MarketClosed') || responseText.includes('market is closed')) {
        console.log(`[APEX] MARKET STENGT - ordre kan ikke utfores na`);
      }
      
      return { success: false, error: errorMsg, uic: instrument.uic };
    }

    const data = JSON.parse(responseText);
    console.log(`[APEX] <<< ORDRE SUKSESS! OrderId: ${data.OrderId}`);
    return { success: true, orderId: data.OrderId, uic: instrument.uic };
  } catch (e) {
    console.log(`[APEX] <<< ERROR: ${e}`);
    return { success: false, error: String(e) };
  }
}

// Get account balance and total value
async function getBalance(accessToken: string, accountKey: string): Promise<{ cash: number; total: number }> {
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        cash: data.CashAvailableForTrading || 0,
        total: data.TotalValue || BASE_TRADING_CAPITAL,
      };
    }
  } catch {}
  return { cash: BASE_TRADING_CAPITAL, total: BASE_TRADING_CAPITAL };
}

// Profit lock functions
function lockProfit(accountKey: string, ticker: string, sellPrice: number, sellAmount: number): number {
  if (!purchasePrices.has(accountKey)) {
    purchasePrices.set(accountKey, new Map());
  }
  const prices = purchasePrices.get(accountKey)!;
  const avgPurchasePrice = prices.get(ticker) || sellPrice;
  
  const profitPerShare = sellPrice - avgPurchasePrice;
  const totalProfit = profitPerShare * sellAmount;
  
  if (totalProfit > 0) {
    const currentLocked = lockedProfits.get(accountKey) || 0;
    lockedProfits.set(accountKey, currentLocked + totalProfit);
    console.log(`[APEX] PROFIT LOCK: +${totalProfit.toFixed(2)} kr fra ${ticker}`);
    return totalProfit;
  }
  
  return 0;
}

function recordPurchase(accountKey: string, ticker: string, price: number, amount: number): void {
  if (!purchasePrices.has(accountKey)) {
    purchasePrices.set(accountKey, new Map());
  }
  const prices = purchasePrices.get(accountKey)!;
  const existingPrice = prices.get(ticker) || price;
  prices.set(ticker, (existingPrice + price) / 2);
}

function getAvailableTradingCapital(actualCash: number, totalAccountValue: number, accountKey: string): number {
  const locked = lockedProfits.get(accountKey) || 0;
  const currentProfit = totalAccountValue - BASE_TRADING_CAPITAL;
  const tradingCapital = Math.min(actualCash, BASE_TRADING_CAPITAL);
  
  console.log(`[APEX] Kapital: Total=${totalAccountValue.toLocaleString()} kr, Profitt=${currentProfit.toLocaleString()} kr, Tilgjengelig=${tradingCapital.toLocaleString()} kr`);
  
  return tradingCapital;
}

// Get current positions
async function getPositions(accessToken: string, clientKey: string) {
  const positions: Map<string, { amount: number; avgPrice: number; marketValue: number }> = new Map();
  
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (res.ok) {
      const data = await res.json();
      
      for (const pos of data.Data || []) {
        const symbol = pos.DisplayAndFormat?.Symbol || '';
        const description = pos.DisplayAndFormat?.Description || '';
        let ticker = symbol.split(':')[0].toUpperCase();
        
        if (!ticker || !APEX_BLUEPRINT[ticker]) {
          for (const [t, info] of Object.entries(APEX_BLUEPRINT)) {
            if (description.toLowerCase().includes(info.navn.toLowerCase().split(' ')[0])) {
              ticker = t;
              break;
            }
          }
        }
        
        if (ticker && APEX_BLUEPRINT[ticker]) {
          positions.set(ticker, {
            amount: Math.abs(pos.PositionBase?.Amount || 0),
            avgPrice: pos.PositionBase?.AverageOpenPrice || 0,
            marketValue: Math.abs(pos.PositionView?.MarketValue || 0),
          });
        }
      }
    }
  } catch {}
  
  return positions;
}

// ============ APEX QUANTUM EXTREME 10% DAILY CONFIG ============
// Target: 10% DAILY return through ultra-aggressive trading
// Strategy: Maximum position churn, scalping, continuous accumulation
const DIP_THRESHOLD = 0.0003;      // Buy on ANY 0.03% dip - ULTRA SENSITIVE
const PEAK_THRESHOLD = 0.0005;     // Sell on 0.05% rise - RAPID profit-taking
const RSI_OVERSOLD = 48;           // Almost always buying
const RSI_OVERBOUGHT = 52;         // Almost always selling profits
const POSITION_SIZE_PERCENT = 0.02; // 2% of capital per trade - reasonable size
const MAX_SHARES_PER_ORDER = 1000; // Maximum shares per single order
const MAX_ORDER_VALUE = 50000; // Maximum order value in account currency (EUR)
const MAX_TRADES_PER_SCAN = 15;    // Execute up to 15 trades per scan
const ALWAYS_BUILD_POSITION = true; // ALWAYS build positions
const FORCE_TRADE_EVERY_SCAN = true; // GUARANTEE trades every scan
const PROFIT_TAKE_THRESHOLD = 0.003; // Take profit at 0.3% gain
const SCALP_MODE = true;           // Enable scalping for micro-profits

// Generate swing signals with market hours filtering
async function generateSwingSignals(
  accessToken: string,
  positions: Map<string, { amount: number; avgPrice: number; marketValue: number }>,
  balance: number,
  totalValue: number,
  marketStatus: MarketStatus
): Promise<Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; momentum: MomentumData; market: 'US' | 'OSLO' }>> {
  const signals: Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; momentum: MomentumData; market: 'US' | 'OSLO' }> = [];
  
  console.log(`[APEX] Genererer signaler for ${Object.keys(APEX_BLUEPRINT).length} aksjer...`);
  console.log(`[APEX] Aktive markeder: ${marketStatus.activeMarkets.join(', ') || 'INGEN'}`);
  console.log(`[APEX] Oslo open: ${marketStatus.osloOpen}, US open: ${marketStatus.usOpen}`);
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    // Check if this stock's market is open
    const isMarketOpen = info.market === 'OSLO' ? marketStatus.osloOpen : marketStatus.usOpen;
    if (!isMarketOpen) {
      console.log(`[APEX] Skip ${ticker} - ${info.market} market stengt`);
      continue;
    }
    
    const instrument = await findInstrument(accessToken, ticker, info.saxoSymbol, info.assetType);
    if (!instrument) {
      console.log(`[APEX] Skipping ${ticker} - could not find instrument`);
      continue;
    }
    
    const priceData = await getPrice(accessToken, instrument.uic, info.assetType);
    const currentPrice = priceData.last;
    
    const momentum = analyzeMomentum(ticker, currentPrice);
    const pos = positions.get(ticker);
    const currentValue = pos?.marketValue || 0;
    const targetValue = (totalValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((currentValue - targetValue) / targetValue) * 100 : -100;
    
    const dropFromHigh = momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow = momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;
    
    // Position sizing with MAX LIMITS to prevent order rejection
    let baseSize = Math.max(10, Math.floor((balance * POSITION_SIZE_PERCENT) / currentPrice));
    
    // Apply maximum limits
    baseSize = Math.min(baseSize, MAX_SHARES_PER_ORDER);
    baseSize = Math.min(baseSize, Math.floor(MAX_ORDER_VALUE / currentPrice));
    
    const volatilityMultiplier = Math.min(1.5, 1 + (info.volatilitet - 2) * 0.2); // Capped multiplier
    
    const marketLabel = 'US';
    
    // ============ TIMESFM HYBRID SIGNAL ============
    // Get price array from momentum history
    const priceArray = momentum.prices.map(p => p.price);
    const tfmSignal = calculateTimesFMScore(priceArray, momentum.rsi, info.targetVekt);
    
    console.log(`[APEX] ${ticker}: pris=${currentPrice.toFixed(2)}, RSI=${momentum.rsi.toFixed(0)}, TimesFM=${tfmSignal.score.toFixed(0)} (${tfmSignal.action})`);
    
    // ============ TIMESFM-DRIVEN SIGNALS (PRIMARY) ============
    
    // TimesFM BUY signal - highest priority
    if (tfmSignal.action === 'BUY' && balance > baseSize * currentPrice * 2) {
      const tfmSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * 1.5 * volatilityMultiplier));
      signals.push({
        ticker,
        action: 'BUY',
        amount: tfmSize,
        reason: `[TIMESFM] ${tfmSignal.reason}`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
      console.log(`[APEX] TIMESFM SIGNAL: KJOP ${tfmSize} ${ticker} - ${tfmSignal.reason}`);
    }
    
    // TimesFM SELL signal
    if (tfmSignal.action === 'SELL' && pos && pos.amount > 5) {
      const tfmSellSize = Math.floor(pos.amount * 0.3);
      if (tfmSellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: tfmSellSize,
          reason: `[TIMESFM] ${tfmSignal.reason}`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] TIMESFM SIGNAL: SELG ${tfmSellSize} ${ticker} - ${tfmSignal.reason}`);
      }
    }
    
    // ============ MOMENTUM-BASED SIGNALS (SECONDARY) ============
    
    // 1. DIP BUYING - very sensitive
    if (dropFromHigh >= DIP_THRESHOLD) {
      const dipStrength = Math.min(3, dropFromHigh / DIP_THRESHOLD);
      const orderSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * dipStrength * volatilityMultiplier));
      
      if (orderSize > 0 && balance > orderSize * currentPrice) {
        signals.push({
          ticker,
          action: 'BUY',
          amount: orderSize,
          reason: `[${marketLabel}] DIP -${(dropFromHigh * 100).toFixed(2)}%`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] SIGNAL: ${ticker} DIP -${(dropFromHigh * 100).toFixed(2)}% -> KJOP ${orderSize}`);
      }
    }
    
    // 2. RSI oversold - more sensitive
    if (momentum.rsi < RSI_OVERSOLD && balance > baseSize * currentPrice) {
      const orderSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * 1.5 * volatilityMultiplier));
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        reason: `[${marketLabel}] RSI LOW (${momentum.rsi.toFixed(0)})`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
      console.log(`[APEX] SIGNAL: ${ticker} RSI ${momentum.rsi.toFixed(0)} -> KJOP ${orderSize}`);
    }
    
    // 3. TREND DOWN = buy opportunity
    if (momentum.trend === 'DOWN' && balance > baseSize * currentPrice) {
      const orderSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * volatilityMultiplier));
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        reason: `[${marketLabel}] TREND DOWN - akkumulerer`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
    }
    
    // ============ AGGRESSIVE SELL SIGNALS ============
    
    // 4. PEAK SELLING - quick profit taking
    if (riseFromLow >= PEAK_THRESHOLD && pos && pos.amount > 2) {
      const peakStrength = Math.min(5, riseFromLow / PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(pos.amount * 0.4, baseSize * peakStrength));
      
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `[${marketLabel}] PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] SIGNAL: ${ticker} PEAK +${(riseFromLow * 100).toFixed(2)}% -> SELG ${sellSize}`);
      }
    }
    
    // 5. RSI overbought - take profits
    if (momentum.rsi > RSI_OVERBOUGHT && pos && pos.amount > 3) {
      const sellSize = Math.floor(pos.amount * 0.25);
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `[${marketLabel}] RSI HIGH (${momentum.rsi.toFixed(0)})`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
      }
    }
    
    // ============ ALWAYS BUILD POSITIONS ============
    // This ensures we're always active in the market
    
    if (ALWAYS_BUILD_POSITION) {
      if (!pos || pos.amount === 0) {
        // No position - MUST buy to build (with MAX limit)
        const buildSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * 2));
        if (balance > buildSize * currentPrice) {
          signals.push({
            ticker,
            action: 'BUY',
            amount: buildSize,
            reason: `[${marketLabel}] BYGG ${info.targetVekt}%`,
            price: currentPrice,
            momentum,
            market: info.market,
          });
          console.log(`[APEX] SIGNAL: ${ticker} BYGG POSISJON ${buildSize} aksjer`);
        }
      } else if (deviation < -10) {
        // Underweight - add more (with MAX limit)
        const addSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * 1.2));
        if (balance > addSize * currentPrice) {
          signals.push({
            ticker,
            action: 'BUY',
            amount: addSize,
            reason: `[${marketLabel}] UNDERVEKT (${deviation.toFixed(0)}%)`,
            price: currentPrice,
            momentum,
            market: info.market,
          });
        }
      } else if (deviation > 20 && pos.amount > 5) {
        // Overweight - reduce
        const reduceSize = Math.floor(pos.amount * 0.15);
        if (reduceSize > 0) {
          signals.push({
            ticker,
            action: 'SELL',
            amount: reduceSize,
            reason: `[${marketLabel}] OVERVEKT (${deviation.toFixed(0)}%)`,
            price: currentPrice,
            momentum,
            market: info.market,
          });
        }
      }
    }
    
    // ============ EXTREME GUARANTEED TRADE - 10% DAILY TARGET ============
    // ALWAYS force trades to reach 10% daily target
    // SCALP MODE: Lock in any profits immediately
    
    if (SCALP_MODE && pos && pos.amount > 0 && pos.avgPrice > 0) {
      const profitPercent = (currentPrice - pos.avgPrice) / pos.avgPrice;
      
      // Take ANY profit above threshold
      if (profitPercent >= PROFIT_TAKE_THRESHOLD) {
        const scalpSize = Math.max(1, Math.floor(pos.amount * 0.5)); // Sell 50% to lock profit
        signals.push({
          ticker,
          action: 'SELL',
          amount: scalpSize,
          reason: `[SCALP] PROFITT +${(profitPercent * 100).toFixed(2)}% - SELGER`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] SCALP: SELG ${scalpSize} ${ticker} @ +${(profitPercent * 100).toFixed(2)}% profitt`);
      }
      
      // DCA on dips (with MAX limit)
      if (profitPercent < -0.002 && balance > baseSize * currentPrice) {
        const dcaSize = Math.min(MAX_SHARES_PER_ORDER, Math.floor(baseSize * 1.2));
        signals.push({
          ticker,
          action: 'BUY',
          amount: dcaSize,
          reason: `[DCA] Ned ${(profitPercent * 100).toFixed(2)}% - akkumulerer`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] DCA: KJOP ${dcaSize} ${ticker} @ ${(profitPercent * 100).toFixed(2)}%`);
      }
    }
    
    // FORCE_TRADE: Always add position if we have cash (with MAX limit)
    if (FORCE_TRADE_EVERY_SCAN && balance > baseSize * currentPrice * 0.5) {
      const forceSize = Math.min(MAX_SHARES_PER_ORDER, Math.max(10, Math.floor(baseSize)));
      signals.push({
        ticker,
        action: 'BUY',
        amount: forceSize,
        reason: `[FORCE] EKSTREM AKKUMULERING`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
      console.log(`[APEX] FORCE: KJOP ${forceSize} ${ticker} @ ${currentPrice.toFixed(2)}`);
    }
  }
  
  // Sort: Prioritize by signal type and potential
  signals.sort((a, b) => {
    // Priority: DIP > PEAK > RSI > TREND > BUILD
    const getPriority = (reason: string) => {
      if (reason.includes('DIP')) return 5;
      if (reason.includes('PEAK')) return 4;
      if (reason.includes('RSI')) return 3;
      if (reason.includes('TREND')) return 2;
      return 1;
    };
    return getPriority(b.reason) - getPriority(a.reason);
  });
  
  // Limit to MAX_TRADES_PER_SCAN to avoid over-trading
  const limitedSignals = signals.slice(0, MAX_TRADES_PER_SCAN);
  
  console.log(`[APEX] Genererte ${signals.length} signaler, utforer ${limitedSignals.length}`);
  
  return limitedSignals;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || 'paper';
  
  console.log(`[APEX] ====================================================`);
  console.log(`[APEX] AUTONOMOUS SCAN TRIGGERED - mode: ${mode}`);
  console.log(`[APEX] Time: ${new Date().toISOString()}`);
  console.log(`[APEX] FORCE_TRADING_ALWAYS: ${FORCE_TRADING_ALWAYS}`);
  console.log(`[APEX] ====================================================`);
  
  // ============ TOKEN LOADING ============
  // Token: from Vercel ENV (SAXO_ACCESS_TOKEN)
  // AccountKey/ClientKey: from COOKIES (personal per customer after OAuth)
  const cookieStore = await cookies();
  
  // Token from Vercel env vars
  let accessToken = process.env.SAXO_ACCESS_TOKEN;
  let tokenSource = 'ENV';
  
  // Fallback to cookies if env not set
  if (!accessToken) {
    accessToken = cookieStore.get('apex_saxo_token')?.value;
    tokenSource = 'COOKIE';
  }
  
  // Log token status
  const tokenPreview = accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING';
  console.log(`[APEX TOKEN] Source: ${tokenSource} | Token: ${tokenPreview}`);
  
  // Validate token
  if (!accessToken) {
    console.log(`[APEX] ERROR: No token - add SAXO_ACCESS_TOKEN to Vercel env`);
    return NextResponse.json({
      error: 'Token not loaded - add SAXO_ACCESS_TOKEN to Vercel Environment Variables',
      tokenStatus: 'MISSING',
      source: tokenSource,
    }, { status: 401 });
  }
  
  // ============ AUTO-FETCH ACCOUNT KEY FROM SAXO API ============
  // When using 24-hour developer token, we fetch accountKey from API instead of cookies
  console.log(`[APEX] Fetching account info from Saxo API...`);
  
  const accountsResult = await safeFetchJson<{ Data?: Array<{ AccountKey: string; ClientKey: string; AccountId: string }> }>(
    `${SAXO_API_BASE}/port/v1/accounts/me`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (!accountsResult.ok) {
    console.log(`[APEX] TOKEN INVALID: ${accountsResult.error}`);
    console.log(`[APEX] Raw response: ${accountsResult.rawBody.substring(0, 300)}`);
    return NextResponse.json({
      error: accountsResult.status === 401 
        ? 'Token expired - refresh SAXO_ACCESS_TOKEN in Vercel Environment Variables' 
        : `Token validation failed: ${accountsResult.error}`,
      tokenStatus: 'INVALID',
      httpStatus: accountsResult.status,
      rawResponse: accountsResult.rawBody.substring(0, 500),
    }, { status: 401 });
  }
  
  // Extract accountKey and clientKey from API response
  const accounts = accountsResult.data?.Data || [];
  if (accounts.length === 0) {
    console.log(`[APEX] No accounts found in response:`, accountsResult.rawBody.substring(0, 300));
    return NextResponse.json({
      error: 'No trading accounts found for this token',
      tokenStatus: 'NO_ACCOUNTS',
    }, { status: 401 });
  }
  
  // Use first account (or find specific one)
  const primaryAccount = accounts[0];
  const accountKey = primaryAccount.AccountKey;
  const clientKey = primaryAccount.ClientKey;
  
  console.log(`[APEX] Token validated successfully!`);
  console.log(`[APEX] AccountKey: ${accountKey} | ClientKey: ${clientKey} | AccountId: ${primaryAccount.AccountId}`);
  console.log(`[APEX] Found ${accounts.length} account(s) - using primary account`);

  try {
    const startTime = Date.now();
    
    // Get market status
    const marketStatus = getMarketStatus();
    
    console.log(`[APEX] ========== INTRA-DAY SWING SCAN ==========`);
    console.log(`[APEX] ${marketStatus.message}`);

    // With FORCE_TRADING_ALWAYS, we never return early
    // Markets are always "open" for SIM trading
    console.log(`[APEX] Active markets: ${marketStatus.activeMarkets.join(', ')} | Force mode: ${FORCE_TRADING_ALWAYS}`);

    const [balanceData, positions] = await Promise.all([
      getBalance(accessToken, accountKey),
      getPositions(accessToken, clientKey || accountKey),
    ]);

  const actualTotalValue = balanceData.total;
  let actualCash = balanceData.cash; // Use let to allow updating after auto-sells
  const currentProfit = actualTotalValue - BASE_TRADING_CAPITAL;
    const locked = lockedProfits.get(accountKey) || 0;
    const tradingCapital = getAvailableTradingCapital(actualCash, actualTotalValue, accountKey);

    console.log(`[APEX] Kontoverdi: ${actualTotalValue.toLocaleString()} kr | Profitt: ${currentProfit.toLocaleString()} kr`);

    // Generate signals only for OPEN markets
    console.log(`[APEX] Kaller generateSwingSignals med balance=${tradingCapital}, total=${BASE_TRADING_CAPITAL}`);
    const usSignals = await generateSwingSignals(accessToken, positions, tradingCapital * (US_ALLOCATION_PERCENT / 100), BASE_TRADING_CAPITAL, marketStatus);
    
    // Generate Oslo volatility signals (dynamic discovery)
    console.log(`[APEX] ===== OSLO VOLATILITY SCAN =====`);
    const osloSignals = await generateOsloVolatilitySignals(accessToken, accountKey, tradingCapital, marketStatus);
    
    // Combine all signals
    const signals = [
      ...usSignals,
      ...osloSignals.map(s => ({
        ticker: s.ticker,
        action: s.action,
        amount: s.amount,
        reason: s.reason,
        price: s.price,
        momentum: { prices: [], localHigh: s.price, localLow: s.price, rsi: 50, trend: 'NEUTRAL' as const },
        market: s.market as 'US' | 'OSLO',
      })),
    ];
    
    console.log(`[APEX] ===== SIGNAL RESULTAT =====`);
    console.log(`[APEX] US signaler: ${usSignals.length}, Oslo signaler: ${osloSignals.length}, Totalt: ${signals.length}`);
    signals.forEach((s, i) => {
      console.log(`[APEX] Signal ${i+1}: ${s.action} ${s.amount} ${s.ticker} @ ${s.price.toFixed(2)} - ${s.reason}`);
    });
    console.log(`[APEX] ===== STARTER UTFORELSE =====`);

    // Execute trades
    const executedTrades: Array<{
      ticker: string;
      saxoSymbol: string;
      action: string;
      amount: number;
      price: number;
      value: number;
      orderId?: string;
      status: string;
      reason: string;
      market: string;
    }> = [];
    
    let totalBought = 0;
    let totalSold = 0;
    const failedTickers: string[] = [];

    console.log(`[APEX] Utforer ${signals.length} signaler...`);
    console.log(`[APEX] Tilgjengelig kontant: ${actualCash.toFixed(0)} kr`);
    
    // ALWAYS check for profitable positions to sell when cash is low
    console.log(`[APEX] ========== AUTO-SALG SJEKK ==========`);
    console.log(`[APEX] Cash: ${actualCash.toFixed(0)} kr, Terskel: 50000 kr`);
    console.log(`[APEX] Antall posisjoner: ${positions.size}`);
    
    // Log all positions
    for (const [ticker, pos] of positions) {
      console.log(`[APEX] Posisjon: ${ticker} = ${pos.amount} aksjer @ ${pos.avgPrice.toFixed(2)} avg`);
    }
    
    if (actualCash < 50000) { // Increased threshold from 10000 to 50000
      console.log(`[APEX] LAV KONTANT (${actualCash.toFixed(0)} kr) - Starter auto-salg`);
      
      // Find ANY position we can sell to free up capital
      for (const [ticker, pos] of positions) {
        console.log(`[APEX] Sjekker ${ticker}: amount=${pos.amount}, avgPrice=${pos.avgPrice.toFixed(2)}`);
        
        const info = APEX_BLUEPRINT[ticker];
        if (!info) {
          console.log(`[APEX] ${ticker} ikke i APEX_BLUEPRINT, hopper over`);
          continue;
        }
        
        if (pos.amount < 5) {
          console.log(`[APEX] ${ticker} for fa aksjer (${pos.amount}), hopper over`);
          continue;
        }
        
        // Find instrument to get UIC for price lookup
        const instrument = await findInstrument(accessToken, ticker, info.saxoSymbol, info.assetType);
        if (!instrument) {
          console.log(`[APEX] Fant ikke instrument for ${ticker}`);
          continue;
        }
        
        // Get current price for this ticker
        const priceData = await getPrice(accessToken, instrument.uic, instrument.assetType);
        const currentPrice = priceData.last;
        console.log(`[APEX] ${ticker}: currentPrice=${currentPrice.toFixed(2)}, avgPrice=${pos.avgPrice.toFixed(2)}`);
        
        // Sell if ANY profit at all, or even at small loss to free up capital
        const profitPercent = (currentPrice - pos.avgPrice) / pos.avgPrice;
        console.log(`[APEX] ${ticker} profitt: ${(profitPercent * 100).toFixed(2)}%`);
        
        // Sell 20% of position regardless of profit/loss to free up cash
        const sellAmount = Math.max(1, Math.floor(pos.amount * 0.2));
        console.log(`[APEX] Forsoker a selge ${sellAmount} ${ticker}`);
        
        const result = await placeMarketOrder(
          accessToken,
          accountKey,
          ticker,
          info.saxoSymbol,
          info.assetType,
          sellAmount,
          'Sell',
          `[AUTO] Frigjor kapital (${(profitPercent * 100).toFixed(1)}%)`,
          info.market
        );
        
        console.log(`[APEX] Salgsordre resultat for ${ticker}: ${result.success ? 'OK' : 'FEIL'} - ${result.orderId || result.error}`);
        
        if (result.success) {
          const saleValue = sellAmount * currentPrice;
          totalSold += saleValue;
          actualCash += saleValue;
          console.log(`[APEX] AUTO-SALG VELLYKKET: +${saleValue.toFixed(0)} kr frigjort fra ${ticker}`);
          
          executedTrades.push({
            ticker,
            saxoSymbol: info.saxoSymbol,
            action: 'SELL',
            amount: sellAmount,
            price: currentPrice,
            value: saleValue,
            orderId: result.orderId,
            status: 'OK',
            reason: '[AUTO] Frigjor kapital',
            market: info.market,
          });
          
          // Continue to sell more if still low on cash
          if (actualCash >= 50000) {
            console.log(`[APEX] Nok kontanter frigjort (${actualCash.toFixed(0)} kr), stopper auto-salg`);
            break;
          }
        }
      }
    }
    
    for (const signal of signals) {
      // Get info from blueprint OR from Oslo volatility cache
      const blueprintInfo = APEX_BLUEPRINT[signal.ticker];
      const osloInfo = osloVolatilityCache.get(signal.ticker);
      
      // Build info object - Oslo signals may not be in blueprint
      const info = blueprintInfo || (osloInfo ? {
        navn: osloInfo.navn,
        targetVekt: 10,
        volatilitet: osloInfo.volatility,
        saxoSymbol: `${signal.ticker}:xosl`,
        assetType: 'Stock',
        market: 'OSLO' as const,
        score: osloInfo.score,
      } : null);
      
      if (!info) {
        console.log(`[APEX] Skip ${signal.ticker} - ikke i blueprint eller Oslo cache`);
        continue;
      }

      const tradeValue = signal.amount * signal.price;
      console.log(`[APEX] Prosesserer: ${signal.action} ${signal.amount} ${signal.ticker} @ ${signal.price.toFixed(2)} = ${tradeValue.toFixed(0)} kr [${signal.market}]`);

      // Check if we have enough cash to buy
      if (signal.action === 'BUY') {
        const maxBuyable = actualCash * 0.95;
        if (tradeValue > maxBuyable) {
          console.log(`[APEX] SKIP KJOP ${signal.ticker}: Koster ${tradeValue.toFixed(0)} kr, men kun ${actualCash.toFixed(0)} kr tilgjengelig`);
          failedTickers.push(`${signal.ticker}: Ikke nok kontanter`);
          continue;
        }
      }
      
      if (signal.action === 'SELL') {
        const pos = positions.get(signal.ticker);
        if (!pos || pos.amount < signal.amount) {
          console.log(`[APEX] Skip ${signal.ticker} SELL - ikke nok aksjer (har: ${pos?.amount || 0}, trenger: ${signal.amount})`);
          continue;
        }
      }

      console.log(`[APEX] Sender ordre: ${signal.action} ${signal.amount} ${signal.ticker} [${signal.market}]`);
      
      const result = await placeMarketOrder(
        accessToken,
        accountKey,
        signal.ticker,
        info.saxoSymbol,
        info.assetType,
        signal.amount,
        signal.action === 'BUY' ? 'Buy' : 'Sell',
        signal.reason,
        signal.market
      );

      console.log(`[APEX] Ordre resultat: ${result.success ? 'OK' : 'FEIL'} - ${result.orderId || result.error}`);
      
      if (result.success) {
        if (signal.action === 'BUY') {
          totalBought += tradeValue;
          recordPurchase(accountKey, signal.ticker, signal.price, signal.amount);
          console.log(`[APEX] KJOPT: ${signal.amount} ${signal.ticker} @ ${signal.price.toFixed(2)} = ${tradeValue.toFixed(0)} kr [${signal.market}]`);
          // Update actual cash tracking
          actualCash -= tradeValue;
        } else {
          totalSold += tradeValue;
          lockProfit(accountKey, signal.ticker, signal.price, signal.amount);
          console.log(`[APEX] SOLGT: ${signal.amount} ${signal.ticker} @ ${signal.price.toFixed(2)} = ${tradeValue.toFixed(0)} kr [${signal.market}]`);
          actualCash += tradeValue;
        }
      } else {
        console.log(`[APEX] FEIL: ${signal.ticker} - ${result.error}`);
      }

      executedTrades.push({
        ticker: signal.ticker,
        saxoSymbol: info.saxoSymbol,
        action: signal.action,
        amount: signal.amount,
        price: signal.price,
        value: tradeValue,
        orderId: result.orderId,
        status: result.success ? 'OK' : 'FEIL',
        reason: result.success ? signal.reason : 'Ordre feilet',
        market: signal.market,
      });

      if (!result.success) {
        failedTickers.push(signal.ticker);
      }
    }

    const successful = executedTrades.filter(t => t.status === 'OK');
    const failed = executedTrades.filter(t => t.status === 'FEIL');
    
    const totalLockedProfits = lockedProfits.get(accountKey) || 0;
    
    let report = `APEX QUANTUM v6.2 - EKSTREM 10% DAGLIG MODUS
${'='.repeat(50)}
Tid: ${new Date().toLocaleString('no-NO')}
${marketStatus.message}
FORCE TRADING: AKTIV (24/7 SIM)

=== PROFIT STATUS ===
Startkapital: ${BASE_TRADING_CAPITAL.toLocaleString()} kr
Kontoverdi: ${actualTotalValue.toLocaleString()} kr
Aktuell profitt: ${currentProfit >= 0 ? '+' : ''}${currentProfit.toLocaleString()} kr
Last profitt: ${totalLockedProfits.toLocaleString()} kr
Trading-kapital: ${tradingCapital.toLocaleString()} kr

=== TRADING CONFIG ===
- SCALP MODE: AKTIV (profitt ved +0.3%)
- DCA MODE: AKTIV (kjop ved -0.2%)
- Max trades per scan: 15

=== SIGNALER (${signals.length}) ===
`;

    for (const s of signals) {
      report += `+ ${s.ticker} (${s.market}): ${s.action} ${s.amount} @ ${s.price.toFixed(2)} - ${s.reason}\n`;
    }

    report += `\n=== UTFORTE HANDLER (${successful.length}/${executedTrades.length}) ===\n`;
    for (const t of successful) {
      const marketLabel = 'US';
      report += `>>> ${marketLabel} - ${t.action === 'BUY' ? 'Kjop' : 'Salg'}: ${t.amount}x ${t.saxoSymbol} @ ${t.price.toFixed(2)} [${t.orderId}]\n`;
    }

    if (failed.length > 0) {
      report += `\n=== FEILEDE (${failed.length}) ===\n`;
      for (const t of failed) {
        report += `!!! ${t.ticker}: ${t.reason}\n`;
      }
    }

    const duration = Date.now() - startTime;
    report += `\nScan fullfort pa ${duration}ms`;

    return NextResponse.json({
      success: true,
      mode: mode || 'paper',
      marketStatus,
      signals: signals.map(s => ({
        ticker: s.ticker,
        saxoSymbol: APEX_BLUEPRINT[s.ticker]?.saxoSymbol,
        action: s.action,
        amount: s.amount,
        reason: s.reason,
        market: s.market,
      })),
      executedTrades,
      report,
      blueprint: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
        const pos = positions.get(ticker);
        return {
          ticker,
          saxoSymbol: info.saxoSymbol,
          navn: info.navn,
          targetVekt: info.targetVekt,
          market: info.market,
          marketOpen: marketStatus.activeMarkets.includes(info.market),
          antall: pos?.amount || 0,
          verdi: pos?.marketValue || 0,
        };
      }),
      stats: {
        baseCapital: BASE_TRADING_CAPITAL,
        actualTotalValue,
        currentProfit,
        lockedProfits: totalLockedProfits,
        tradingCapital,
        marketsOpen: marketStatus.activeMarkets,
        totalBought,
        totalSold,
        successful: successful.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    console.error('[APEX] Error:', error);
    return NextResponse.json({
      error: 'Autonomous scan failed',
      details: String(error),
    }, { status: 500 });
  }
}
