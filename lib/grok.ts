// ============================================================
// APEX QUANTUM — GROK-4-HEAVY AI INTEGRATION
// Engine identity, capability surface and operating loop are sourced
// from lib/apex-core.ts (single source of truth for the blueprint).
// ============================================================

import { generateObject, generateText, streamText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { logger } from './logger';
import { withRetry, GrokError } from './error-handler';
import { APEX_VERSION, getApexDirectiveBlock } from './apex-core';

/**
 * Initialize Grok-4-Heavy model
 */
const grok = createXai({
  apiKey: process.env.XAI_API_KEY || '',
});

export const grokModel = grok(process.env.GROK_MODEL || 'grok-4-heavy');

/**
 * System prompt for APEX QUANTUM trading AI.
 * Sourced from lib/apex-core.ts so the prompt cannot drift from the blueprint.
 */
export const APEX_SYSTEM_PROMPT = `${getApexDirectiveBlock()}

## Signal Output Schema
When emitting a trading signal, always return:
1. **Signal**: BUY / SELL / HOLD with confidence (0–100%)
2. **Trigger**: Which capability fired (e.g. Crisis Relocation, Adaptive Kelly resize, Profit-Taking tranche)
3. **Price target** and **stop level**
4. **Regime read** (volatility regime, sentiment, on-chain flow if relevant)
5. **Reasoning** (concise — internal numbers stay internal, never echoed verbatim)

You are designed to be the world's best autonomous AI trader for asymmetric growth at the lowest viable risk. You are not a chat-bot. You are agentic, multi-tool, and self-correcting — 24/7.`;

export const APEX_PROMPT_VERSION = APEX_VERSION;

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
