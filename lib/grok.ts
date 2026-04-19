// ============================================================
// APEX QUANTUM v6.1 - GROK-4-HEAVY AI INTEGRATION
// ============================================================

import { generateObject, generateText, streamText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { logger } from './logger';
import { withRetry, GrokError } from './error-handler';

/**
 * Initialize Grok-4-Heavy model
 */
const grok = createXai({
  apiKey: process.env.XAI_API_KEY || '',
});

export const grokModel = grok(process.env.GROK_MODEL || 'grok-4-heavy');

/**
 * System prompt for APEX QUANTUM trading AI
 */
export const APEX_SYSTEM_PROMPT = `You are APEX QUANTUM v6.1, an advanced autonomous AI trading engine specializing in aggressive day-trading and scalping.

## Core Directives
1. **Aggressive Day-Trading**: Target 10-12% daily profits through scalping and momentum trading
2. **Multi-Exchange Expertise**: US (NASDAQ/NYSE), Oslo, Germany (XETRA), and Hong Kong markets
3. **Risk Management**: Maximum daily loss: 5%, Stop loss: -2%, Take profit: +0.3-0.5%
4. **Real-Time Decision Making**: Process market data and make split-second trading decisions
5. **Self-Learning**: Continuously improve strategies based on historical performance

## Trading Strategies
- **Dip Buying**: Buy on 0.03% price dips, sell on 0.05% rises
- **Momentum Trading**: Follow volume and price momentum on 15-min/5-min candles
- **Scalping**: Ultra-quick trades (30 seconds to 5 minutes) for micro-profits
- **Arbitrage**: Exploit multi-exchange price differences
- **Technical Analysis**: RSI, MACD, Bollinger Bands, Moving Averages

## Risk Framework
- Position size: 20% of capital per trade
- Maximum open positions: 15 per scan
- Auto-purge old trades every 10 seconds
- Force-stop on 5% daily loss threshold
- Market-aware (only trade during market hours)

## Market Hours (CET)
- US: 15:30 - 22:00 CET
- Oslo: 09:00 - 17:30 CET
- Germany (XETRA): 09:00 - 17:30 CET
- Hong Kong: 09:30 - 16:00 HKT (02:30 - 09:00 CET)

## Compliance
- All trades logged and documented
- Risk disclaimers prominently displayed
- Performance tracking and reporting
- Full audit trail for regulatory compliance

## Response Format
When providing analytics or trading signals:
1. **Signal**: BUY/SELL/HOLD with confidence (0-100%)
2. **RSI**: Current RSI value
3. **MACD**: Signal line status
4. **Price Target**: Expected profit target
5. **Stop Loss**: Risk mitigation level
6. **Reasoning**: Detailed analysis
7. **Confidence**: 0-100% confidence score

You are designed to be 110% top-tier: cutting-edge technology, institutional-grade performance, and retail-friendly interface.`;

/**
 * Generate trading signal using Grok-4-Heavy
 */
export async function generateTradingSignal(
  symbol: string,
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number,
  macd: { value: number; signal: number; histogram: number },
  additionalContext?: Record<string, unknown>
) {
  try {
    const result = await withRetry(
      () =>
        generateText({
          model: grokModel,
          system: APEX_SYSTEM_PROMPT,
          prompt: `
Analyze ${symbol} for trading opportunity:

Current Price: $${currentPrice}
RSI: ${rsi}
MACD Value: ${macd.value}, Signal: ${macd.signal}, Histogram: ${macd.histogram}
Volume: ${volume}
24h Change: ${((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0] * 100).toFixed(2)}%

${additionalContext ? `Additional Context: ${JSON.stringify(additionalContext)}` : ''}

Provide a precise trading signal with confidence score.`,
          temperature: 0.7,
        }),
      3
    );

    logger.info('Trading signal generated', {
      symbol,
      signal: result.text.substring(0, 100),
    });

    return {
      success: true,
      signal: result.text,
      symbol,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to generate trading signal', error as Error, {
      symbol,
    });

    throw new GrokError(
      'Failed to generate trading signal from Grok-4-Heavy',
      500,
      { symbol, error: String(error) }
    );
  }
}

/**
 * Stream trading analysis in real-time
 */
export async function streamTradingAnalysis(
  symbol: string,
  marketData: Record<string, unknown>
) {
  try {
    const stream = await streamText({
      model: grokModel,
      system: APEX_SYSTEM_PROMPT,
      prompt: `Provide real-time trading analysis for ${symbol}:

Market Data:
${JSON.stringify(marketData, null, 2)}

Analyze this real-time data and provide instant trading recommendations, risk assessment, and next actions.`,
      temperature: 0.7,
    });

    logger.info('Streaming trading analysis', { symbol });

    return stream;
  } catch (error) {
    logger.error('Failed to stream trading analysis', error as Error, {
      symbol,
    });

    throw new GrokError(
      'Failed to stream trading analysis',
      500,
      { symbol }
    );
  }
}

/**
 * Generate portfolio optimization suggestions
 */
export async function optimizePortfolio(
  currentPositions: Array<{ symbol: string; amount: number; price: number }>,
  marketConditions: Record<string, unknown>
) {
  try {
    const result = await withRetry(
      () =>
        generateText({
          model: grokModel,
          system: APEX_SYSTEM_PROMPT,
          prompt: `Optimize this portfolio for maximum risk-adjusted returns:

Current Positions:
${currentPositions.map(p => `${p.symbol}: ${p.amount} units @ $${p.price}`).join('\n')}

Market Conditions:
${JSON.stringify(marketConditions, null, 2)}

Provide specific reallocation recommendations with target weights and rationale.`,
          temperature: 0.8,
        }),
      3
    );

    logger.info('Portfolio optimization generated', {
      positionCount: currentPositions.length,
    });

    return {
      success: true,
      recommendation: result.text,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to optimize portfolio', error as Error);

    throw new GrokError(
      'Failed to optimize portfolio',
      500,
      { positions: currentPositions.length }
    );
  }
}

/**
 * Analyze risks and drawdowns
 */
export async function analyzeRisks(
  performanceHistory: Array<{ date: string; value: number }>,
  currentCapital: number
) {
  try {
    const result = await withRetry(
      () =>
        generateText({
          model: grokModel,
          system: APEX_SYSTEM_PROMPT,
          prompt: `Analyze and report risks for this portfolio:

Performance History (last 30 days):
${performanceHistory.map(p => `${p.date}: $${p.value}`).slice(-10).join('\n')}

Current Capital: $${currentCapital}

Identify:
1. Maximum drawdown
2. Volatility assessment
3. Risk factors
4. Recommended risk mitigations`,
          temperature: 0.6,
        }),
      3
    );

    logger.info('Risk analysis completed');

    return {
      success: true,
      analysis: result.text,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to analyze risks', error as Error);

    throw new GrokError('Failed to analyze risks', 500);
  }
}

/**
 * Generate self-learning insights
 */
export async function generateLearningInsights(
  strategyMetrics: Record<string, number>,
  recentTrades: Array<{ symbol: string; action: string; profit: number }>,
  winRate: number
) {
  try {
    const result = await withRetry(
      () =>
        generateText({
          model: grokModel,
          system: APEX_SYSTEM_PROMPT,
          prompt: `Generate self-learning insights for strategy improvement:

Strategy Metrics:
${Object.entries(strategyMetrics).map(([k, v]) => `${k}: ${v}`).join('\n')}

Recent Trades (Win Rate: ${(winRate * 100).toFixed(1)}%):
${recentTrades.slice(-5).map(t => `${t.symbol} ${t.action}: ${t.profit > 0 ? '+' : ''}${t.profit.toFixed(2)}%`).join('\n')}

Provide insights for:
1. Winning pattern analysis
2. Losing trade patterns
3. Strategy adjustments
4. Parameter optimization`,
          temperature: 0.8,
        }),
      3
    );

    logger.info('Learning insights generated', { winRate });

    return {
      success: true,
      insights: result.text,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to generate learning insights', error as Error);

    throw new GrokError(
      'Failed to generate learning insights',
      500,
      { winRate }
    );
  }
}
