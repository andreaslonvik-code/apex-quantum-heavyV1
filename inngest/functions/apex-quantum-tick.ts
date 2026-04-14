// inngest/functions/apex-quantum-tick.ts
// APEX QUANTUM v7 - 30-second Autonomous Trading Loop with Day-Trading Logic
// Runs 24/7 even when browser is closed

import { inngest } from '@/lib/inngest';
import {
  safeSaxoFetch,
  findInstrument,
  getPrice,
  placeOrder,
  getBalance,
  getPositions,
  startAutoPurge,
  clearDebugLog,
  addDebugEntry,
  isLiveMode,
  type SaxoPosition,
} from '@/lib/saxo';

// ============ APEX QUANTUM v7 BLUEPRINT ============
// Multi-exchange support: US, Oslo, Germany, China/HK
const APEX_BLUEPRINT: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  assetType: string;
  exchange: 'XNAS' | 'XNYS' | 'XOSL' | 'XETR' | 'XHKG' | 'XSHG';
  market: 'US' | 'OSLO' | 'GERMANY' | 'CHINA';
}> = {
  // US Markets (40% allocation)
  MU:   { navn: 'Micron Technology',    targetVekt: 25, volatilitet: 3, saxoSymbol: 'MU:xnas',   assetType: 'Stock', exchange: 'XNAS', market: 'US' },
  CEG:  { navn: 'Constellation Energy', targetVekt: 10, volatilitet: 2, saxoSymbol: 'CEG:xnas',  assetType: 'Stock', exchange: 'XNAS', market: 'US' },
  VRT:  { navn: 'Vertiv Holdings',      targetVekt: 10, volatilitet: 2, saxoSymbol: 'VRT:xnys',  assetType: 'Stock', exchange: 'XNYS', market: 'US' },
  RKLB: { navn: 'Rocket Lab',           targetVekt: 8,  volatilitet: 4, saxoSymbol: 'RKLB:xnas', assetType: 'Stock', exchange: 'XNAS', market: 'US' },
  LMND: { navn: 'Lemonade Inc',         targetVekt: 7,  volatilitet: 4, saxoSymbol: 'LMND:xnys', assetType: 'Stock', exchange: 'XNYS', market: 'US' },

  // Oslo Bors (20% allocation)
  // Note: These require specific UICs from Saxo - using placeholders
  // NEL:  { navn: 'NEL ASA',              targetVekt: 10, volatilitet: 4, saxoSymbol: 'NEL:xosl',  assetType: 'Stock', exchange: 'XOSL', market: 'OSLO' },
  // EQNR: { navn: 'Equinor',              targetVekt: 10, volatilitet: 2, saxoSymbol: 'EQNR:xosl', assetType: 'Stock', exchange: 'XOSL', market: 'OSLO' },

  // Germany/XETRA (20% allocation)
  // SAP:  { navn: 'SAP SE',               targetVekt: 10, volatilitet: 2, saxoSymbol: 'SAP:xetr',  assetType: 'Stock', exchange: 'XETR', market: 'GERMANY' },
  // SIE:  { navn: 'Siemens AG',           targetVekt: 10, volatilitet: 2, saxoSymbol: 'SIE:xetr',  assetType: 'Stock', exchange: 'XETR', market: 'GERMANY' },

  // China/HK (20% allocation)
  // BABA: { navn: 'Alibaba Group',        targetVekt: 10, volatilitet: 4, saxoSymbol: 'BABA:xhkg', assetType: 'Stock', exchange: 'XHKG', market: 'CHINA' },
  // BIDU: { navn: 'Baidu Inc',            targetVekt: 10, volatilitet: 4, saxoSymbol: 'BIDU:xnas', assetType: 'Stock', exchange: 'XNAS', market: 'CHINA' },

  // Additional high-volatility US stocks
  ABSI: { navn: 'Absci Corporation',    targetVekt: 5,  volatilitet: 5, saxoSymbol: 'ABSI:xnas', assetType: 'Stock', exchange: 'XNAS', market: 'US' },
};

// ============ AGGRESSIVE DAY-TRADING CONFIG ============
// Target: 10-12% DAILY return through ultra-aggressive scalping
const CONFIG = {
  // Thresholds
  DIP_THRESHOLD: 0.0005,        // Buy on 0.05% dip
  PEAK_THRESHOLD: 0.0008,       // Sell on 0.08% rise
  RSI_OVERSOLD: 45,             // Buy when RSI below
  RSI_OVERBOUGHT: 55,           // Sell when RSI above
  PROFIT_TAKE_THRESHOLD: 0.005, // Take profit at 0.5% gain
  STOP_LOSS_THRESHOLD: -0.02,   // Stop loss at -2%
  
  // Position sizing
  POSITION_SIZE_PERCENT: 0.15,  // 15% of capital per trade
  MAX_TRADES_PER_TICK: 12,      // Max trades per 30s tick
  
  // Timing
  TICK_INTERVAL_SECONDS: 30,    // Trading tick every 30s
  META_COGNITION_INTERVAL: 30,  // Meta-cognition every 30s
  PURGE_INTERVAL_SECONDS: 10,   // Auto-purge every 10s
  
  // Capital
  BASE_TRADING_CAPITAL: 1000000, // 1M NOK base
};

// ============ MARKET HOURS (CET) ============
interface MarketStatus {
  usOpen: boolean;
  osloOpen: boolean;
  germanyOpen: boolean;
  chinaOpen: boolean;
  activeMarkets: string[];
  cetTime: string;
}

function getMarketStatus(): MarketStatus {
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  const hours = cetTime.getHours();
  const minutes = cetTime.getMinutes();
  const dayOfWeek = cetTime.getDay();
  const timeInMinutes = hours * 60 + minutes;
  
  // Weekend check
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Market hours (CET)
  // US: 15:30 - 22:00 CET (NASDAQ/NYSE)
  // Oslo: 09:00 - 16:25 CET
  // Germany: 09:00 - 17:30 CET (XETRA)
  // China/HK: 02:30 - 09:00 CET (HK market)
  
  const usOpen = !isWeekend && timeInMinutes >= 930 && timeInMinutes < 1320;
  const osloOpen = !isWeekend && timeInMinutes >= 540 && timeInMinutes < 985;
  const germanyOpen = !isWeekend && timeInMinutes >= 540 && timeInMinutes < 1050;
  const chinaOpen = !isWeekend && timeInMinutes >= 150 && timeInMinutes < 540;
  
  const activeMarkets: string[] = [];
  if (usOpen) activeMarkets.push('US');
  if (osloOpen) activeMarkets.push('OSLO');
  if (germanyOpen) activeMarkets.push('GERMANY');
  if (chinaOpen) activeMarkets.push('CHINA');
  
  return {
    usOpen,
    osloOpen,
    germanyOpen,
    chinaOpen,
    activeMarkets,
    cetTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET`,
  };
}

// ============ MOMENTUM TRACKING ============
interface PricePoint {
  price: number;
  timestamp: number;
}

const priceHistory: Map<string, PricePoint[]> = new Map();

function calculateRSI(prices: PricePoint[]): number {
  if (prices.length < 5) return 50;
  
  const recent = prices.slice(-15);
  let gains = 0, losses = 0, count = 0;
  
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].price - recent[i - 1].price;
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

function analyzeMomentum(ticker: string, currentPrice: number): {
  rsi: number;
  localHigh: number;
  localLow: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
} {
  const history = priceHistory.get(ticker) || [];
  const now = Date.now();
  
  history.push({ price: currentPrice, timestamp: now });
  
  // Keep only last 15 minutes of data
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const recentHistory = history.filter(p => p.timestamp > fifteenMinAgo);
  priceHistory.set(ticker, recentHistory);
  
  if (recentHistory.length < 3) {
    return { rsi: 50, localHigh: currentPrice, localLow: currentPrice, trend: 'NEUTRAL' };
  }
  
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMinPrices = recentHistory.filter(p => p.timestamp > fiveMinAgo);
  
  const localHigh = Math.max(...fiveMinPrices.map(p => p.price));
  const localLow = Math.min(...fiveMinPrices.map(p => p.price));
  const rsi = calculateRSI(recentHistory);
  
  const avgRecent = fiveMinPrices.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMinPrices.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMinPrices.length);
  const trend = avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  
  return { rsi, localHigh, localLow, trend };
}

// ============ SIGNAL GENERATION ============
interface TradingSignal {
  ticker: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  reason: string;
  market: string;
  priority: number;
}

async function generateSignals(
  accessToken: string,
  positions: Map<string, SaxoPosition>,
  cash: number,
  totalValue: number,
  marketStatus: MarketStatus
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    // Skip if market is closed
    const marketOpen = 
      (info.market === 'US' && marketStatus.usOpen) ||
      (info.market === 'OSLO' && marketStatus.osloOpen) ||
      (info.market === 'GERMANY' && marketStatus.germanyOpen) ||
      (info.market === 'CHINA' && marketStatus.chinaOpen);
    
    // In SIM mode, always allow US stocks
    const isSimMode = !isLiveMode();
    if (!marketOpen && !isSimMode) continue;
    
    // Find instrument
    const instrumentResult = await findInstrument(accessToken, ticker, info.exchange.toLowerCase());
    if (!instrumentResult.success || !instrumentResult.data) continue;
    
    const instrument = instrumentResult.data;
    
    // Get current price
    const priceResult = await getPrice(accessToken, instrument.uic, info.assetType);
    if (!priceResult.success || !priceResult.data) continue;
    
    const currentPrice = priceResult.data.last;
    const momentum = analyzeMomentum(ticker, currentPrice);
    
    const pos = positions.get(ticker);
    const positionAmount = pos?.amount || 0;
    const positionAvgPrice = pos?.avgPrice || 0;
    
    // Position sizing
    const baseSize = Math.max(5, Math.floor((cash * CONFIG.POSITION_SIZE_PERCENT) / currentPrice));
    const volatilityMultiplier = 1 + (info.volatilitet - 2) * 0.2;
    
    // Calculate deviation from target
    const currentValue = pos?.marketValue || 0;
    const targetValue = (totalValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((currentValue - targetValue) / targetValue) * 100 : -100;
    
    // Price movement analysis
    const dropFromHigh = momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow = momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;
    
    // ============ BUY SIGNALS ============
    
    // 1. DIP buying
    if (dropFromHigh >= CONFIG.DIP_THRESHOLD && cash > baseSize * currentPrice) {
      const dipStrength = Math.min(4, dropFromHigh / CONFIG.DIP_THRESHOLD);
      const orderSize = Math.floor(baseSize * dipStrength * volatilityMultiplier);
      
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        price: currentPrice,
        reason: `DIP -${(dropFromHigh * 100).toFixed(2)}%`,
        market: info.market,
        priority: 5,
      });
    }
    
    // 2. RSI oversold
    if (momentum.rsi < CONFIG.RSI_OVERSOLD && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 1.5),
        price: currentPrice,
        reason: `RSI OVERSOLD (${momentum.rsi.toFixed(0)})`,
        market: info.market,
        priority: 4,
      });
    }
    
    // 3. Build position if underweight
    if (deviation < -15 && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 2),
        price: currentPrice,
        reason: `UNDERWEIGHT ${deviation.toFixed(0)}%`,
        market: info.market,
        priority: 3,
      });
    }
    
    // 4. No position - initial build
    if (positionAmount === 0 && cash > baseSize * currentPrice * 2) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 3),
        price: currentPrice,
        reason: `BUILD ${info.targetVekt}%`,
        market: info.market,
        priority: 2,
      });
    }
    
    // ============ SELL SIGNALS ============
    
    // 1. Peak selling / profit taking
    if (riseFromLow >= CONFIG.PEAK_THRESHOLD && positionAmount > 2) {
      const peakStrength = Math.min(4, riseFromLow / CONFIG.PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(positionAmount * 0.3, baseSize * peakStrength));
      
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          price: currentPrice,
          reason: `PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          market: info.market,
          priority: 5,
        });
      }
    }
    
    // 2. Profit taking
    if (positionAmount > 0 && positionAvgPrice > 0) {
      const profitPercent = (currentPrice - positionAvgPrice) / positionAvgPrice;
      
      if (profitPercent >= CONFIG.PROFIT_TAKE_THRESHOLD) {
        const sellSize = Math.max(1, Math.floor(positionAmount * 0.4));
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          price: currentPrice,
          reason: `PROFIT +${(profitPercent * 100).toFixed(2)}%`,
          market: info.market,
          priority: 5,
        });
      }
      
      // Stop loss
      if (profitPercent <= CONFIG.STOP_LOSS_THRESHOLD) {
        const sellSize = Math.floor(positionAmount * 0.5);
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          price: currentPrice,
          reason: `STOPLOSS ${(profitPercent * 100).toFixed(2)}%`,
          market: info.market,
          priority: 6,
        });
      }
    }
    
    // 3. RSI overbought
    if (momentum.rsi > CONFIG.RSI_OVERBOUGHT && positionAmount > 3) {
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.floor(positionAmount * 0.2),
        price: currentPrice,
        reason: `RSI OVERBOUGHT (${momentum.rsi.toFixed(0)})`,
        market: info.market,
        priority: 3,
      });
    }
    
    // 4. Overweight reduction
    if (deviation > 25 && positionAmount > 5) {
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.floor(positionAmount * 0.15),
        price: currentPrice,
        reason: `OVERWEIGHT +${deviation.toFixed(0)}%`,
        market: info.market,
        priority: 2,
      });
    }
  }
  
  // Sort by priority and limit
  signals.sort((a, b) => b.priority - a.priority);
  return signals.slice(0, CONFIG.MAX_TRADES_PER_TICK);
}

// ============ INNGEST FUNCTIONS ============

// Main trading tick - runs every 30 seconds
export const apexQuantumTick = inngest.createFunction(
  {
    id: 'apex-quantum-tick',
    name: 'APEX QUANTUM v7 Trading Tick',
    retries: 3,
  },
  { cron: '*/1 * * * *' }, // Every minute, but internal logic handles 30s
  async ({ step }) => {
    console.log('[APEX-INNGEST] ========== TICK START ==========');
    
    // Get credentials from environment
    const accessToken = process.env.APEX_SAXO_TOKEN;
    const accountKey = process.env.APEX_SAXO_ACCOUNT_KEY;
    const clientKey = process.env.APEX_SAXO_CLIENT_KEY || accountKey;
    
    if (!accessToken || !accountKey) {
      console.log('[APEX-INNGEST] Missing credentials');
      return { error: 'Missing APEX_SAXO_TOKEN or APEX_SAXO_ACCOUNT_KEY' };
    }
    
    // Start auto-purge
    startAutoPurge(CONFIG.PURGE_INTERVAL_SECONDS * 1000);
    
    // Run two ticks per minute (30s each)
    const results = [];
    
    for (let tick = 0; tick < 2; tick++) {
      const tickResult = await step.run(`tick-${tick}`, async () => {
        const startTime = Date.now();
        const marketStatus = getMarketStatus();
        
        console.log(`[APEX-INNGEST] Tick ${tick + 1}/2 at ${marketStatus.cetTime}`);
        console.log(`[APEX-INNGEST] Active markets: ${marketStatus.activeMarkets.join(', ') || 'NONE'}`);
        console.log(`[APEX-INNGEST] Mode: ${isLiveMode() ? 'LIVE' : 'SIM'}`);
        
        // Get balance and positions
        const balanceResult = await getBalance(accessToken, accountKey);
        if (!balanceResult.success || !balanceResult.data) {
          return { error: 'Failed to get balance', details: balanceResult.error };
        }
        
        const positionsResult = await getPositions(accessToken, clientKey);
        const positionsMap = new Map<string, SaxoPosition>();
        
        if (positionsResult.success && positionsResult.data) {
          for (const pos of positionsResult.data) {
            if (pos.ticker) {
              positionsMap.set(pos.ticker, pos);
            }
          }
        }
        
        const cash = balanceResult.data.cash;
        const totalValue = balanceResult.data.total || CONFIG.BASE_TRADING_CAPITAL;
        const currentProfit = totalValue - CONFIG.BASE_TRADING_CAPITAL;
        
        console.log(`[APEX-INNGEST] Balance: ${cash.toFixed(0)} kr | Total: ${totalValue.toFixed(0)} kr | P/L: ${currentProfit.toFixed(0)} kr`);
        
        // Generate signals
        const signals = await generateSignals(
          accessToken,
          positionsMap,
          cash,
          totalValue,
          marketStatus
        );
        
        console.log(`[APEX-INNGEST] Generated ${signals.length} signals`);
        
        // Execute trades
        const executedTrades = [];
        let totalBought = 0;
        let totalSold = 0;
        
        for (const signal of signals) {
          const tradeValue = signal.amount * signal.price;
          
          // Check cash for buys
          if (signal.action === 'BUY' && tradeValue > cash * 0.95) {
            console.log(`[APEX-INNGEST] Skip ${signal.ticker}: insufficient cash`);
            continue;
          }
          
          // Check position for sells
          if (signal.action === 'SELL') {
            const pos = positionsMap.get(signal.ticker);
            if (!pos || pos.amount < signal.amount) {
              console.log(`[APEX-INNGEST] Skip ${signal.ticker}: insufficient shares`);
              continue;
            }
          }
          
          const orderResult = await placeOrder(accessToken, {
            ticker: signal.ticker,
            action: signal.action,
            quantity: signal.amount,
            accountKey,
          });
          
          if (orderResult.success) {
            console.log(`[APEX-INNGEST] ${signal.action} ${signal.amount}x ${signal.ticker} @ ${signal.price.toFixed(2)} [${orderResult.orderId}]`);
            
            if (signal.action === 'BUY') totalBought += tradeValue;
            else totalSold += tradeValue;
            
            executedTrades.push({
              ticker: signal.ticker,
              action: signal.action,
              amount: signal.amount,
              price: signal.price,
              value: tradeValue,
              orderId: orderResult.orderId,
              reason: signal.reason,
            });
          } else {
            console.log(`[APEX-INNGEST] FAILED ${signal.ticker}: ${orderResult.error}`);
          }
        }
        
        const duration = Date.now() - startTime;
        
        return {
          tick: tick + 1,
          marketStatus,
          signals: signals.length,
          executed: executedTrades.length,
          totalBought,
          totalSold,
          duration,
          trades: executedTrades.slice(0, 10),
        };
      });
      
      results.push(tickResult);
      
      // Wait 30 seconds before next tick (except last)
      if (tick < 1) {
        await step.sleep('wait-30s', '30s');
      }
    }
    
    // Auto-purge after ticks
    await step.run('purge', async () => {
      clearDebugLog();
      priceHistory.clear();
      console.log('[APEX-INNGEST] Purged cache and logs');
      return { purged: true };
    });
    
    console.log('[APEX-INNGEST] ========== TICK COMPLETE ==========');
    
    return {
      version: 'APEX QUANTUM v7',
      mode: isLiveMode() ? 'LIVE' : 'SIM',
      ticks: results,
    };
  }
);

// Meta-cognition function - self-analysis every 30 seconds
export const apexMetaCognition = inngest.createFunction(
  {
    id: 'apex-meta-cognition',
    name: 'APEX QUANTUM Meta-Cognition',
    retries: 2,
  },
  { event: 'apex/meta-cognition' },
  async ({ event, step }) => {
    const { portfolioValue, pnl, openPositions } = event.data;
    
    console.log('[APEX-META] Running meta-cognition analysis...');
    
    const analysis = await step.run('analyze', async () => {
      const pnlPercent = (pnl / CONFIG.BASE_TRADING_CAPITAL) * 100;
      
      // Determine strategy adjustments
      let strategyAdjustment = 'MAINTAIN';
      let message = '';
      
      if (pnlPercent > 5) {
        strategyAdjustment = 'REDUCE_RISK';
        message = 'Strong gains - consider taking profits and reducing position sizes';
      } else if (pnlPercent < -3) {
        strategyAdjustment = 'DEFENSIVE';
        message = 'Losses detected - switching to defensive mode with tighter stops';
      } else if (pnlPercent > 2) {
        strategyAdjustment = 'AGGRESSIVE';
        message = 'Good performance - can increase position sizes slightly';
      }
      
      return {
        portfolioValue,
        pnl,
        pnlPercent,
        openPositions,
        strategyAdjustment,
        message,
        timestamp: new Date().toISOString(),
      };
    });
    
    console.log(`[APEX-META] Strategy: ${analysis.strategyAdjustment} | P/L: ${analysis.pnlPercent.toFixed(2)}%`);
    
    return analysis;
  }
);

// Export all functions
export const functions = [apexQuantumTick, apexMetaCognition];
