// ============================================================
// APEX QUANTUM v6.1 - GROK-4-HEAVY ANALYSIS ENDPOINT
// AI-powered trading signal generation and streaming analysis
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { withMiddleware, getClientIP } from '@/lib/middleware';
import {
  generateTradingSignal,
  streamTradingAnalysis,
  optimizePortfolio,
  generateLearningInsights,
} from '@/lib/grok';
import { useApexQuantumStore } from '@/lib/store';

/**
 * POST /api/apex/grok-analysis
 * Generate trading signals using Grok-4-Heavy AI
 */
async function handleAnalysis(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { symbol, currentPrice, priceHistory, volume, rsi, macd, context } = body;

    // Validate input
    if (!symbol || typeof currentPrice !== 'number') {
      throw new ValidationError(
        'Missing required fields: symbol and currentPrice',
        { received: { symbol, currentPrice } }
      );
    }

    logger.info('Grok analysis requested', { symbol, currentPrice });

    // Generate trading signal using Grok-4-Heavy
    const signal = await generateTradingSignal(
      symbol,
      currentPrice,
      priceHistory || [],
      volume || 0,
      rsi || 50,
      macd || { value: 0, signal: 0, histogram: 0 },
      context
    );

    return NextResponse.json(
      {
        success: true,
        data: signal,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Analysis request failed', error as Error);
    throw error;
  }
}

/**
 * GET /api/apex/grok-analysis?action=stream&symbol=MU
 * Stream real-time trading analysis with Grok-4-Heavy
 */
async function handleStream(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    throw new ValidationError('Missing symbol parameter', { searchParams });
  }

  logger.info('Streaming analysis started', { symbol });

  // Create custom readable stream
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    async start(controller) {
      try {
        // Get current market data (simplified)
        const marketData = {
          symbol,
          timestamp: new Date().toISOString(),
          price: Math.random() * 100 + 100,
          volume: Math.random() * 1000000,
          rsi: Math.random() * 14 + 43,
        };

        // Stream initial data
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'init',
              data: marketData,
            })}\n\n`
          )
        );

        // Get streaming analysis from Grok
        const stream = await streamTradingAnalysis(symbol, marketData);

        // Forward Grok stream to client
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'analysis',
                  chunk: chunk.text,
                })}\n\n`
              )
            );
          }
        }

        // Send completion signal
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'complete' })}\n\n`
          )
        );

        controller.close();
      } catch (error) {
        logger.error('Stream error', error as Error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: String(error),
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST /api/apex/grok-analysis?action=optimize
 * Optimize portfolio using Grok-4-Heavy
 */
async function handleOptimization(request: NextRequest) {
  try {
    const body = await request.json();
    const { positions, marketConditions } = body;

    if (!positions || !Array.isArray(positions)) {
      throw new ValidationError('Invalid positions format', { positions });
    }

    logger.info('Portfolio optimization requested', { positionCount: positions.length });

    const result = await optimizePortfolio(positions, marketConditions || {});

    return NextResponse.json(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Optimization failed', error as Error);
    throw error;
  }
}

/**
 * POST /api/apex/grok-analysis?action=learn
 * Generate self-learning insights from trading history
 */
async function handleLearning(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyMetrics, recentTrades, winRate } = body;

    if (typeof winRate !== 'number') {
      throw new ValidationError('Missing winRate parameter', { body });
    }

    logger.info('Learning insights requested', {
      tradeCount: recentTrades?.length || 0,
      winRate,
    });

    const result = await generateLearningInsights(
      strategyMetrics || {},
      recentTrades || [],
      winRate || 0
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Learning failed', error as Error);
    throw error;
  }
}

/**
 * GET /api/apex/grok-analysis?action=metrics
 * Get AI learning metrics
 */
async function handleMetrics(request: NextRequest) {
  try {
    // Note: In a real implementation, this would use a database
    // For now, we'll return placeholder data
    const store = useApexQuantumStore.getState();

    return NextResponse.json(
      {
        success: true,
        data: {
          metrics: store.metrics,
          insights: store.insights,
          patterns: store.identifiedPatterns,
          strategicParameters: store.strategyParams,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Metrics request failed', error as Error);
    throw error;
  }
}

/**
 * Main handler that routes based on action parameter
 */
async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'analyze';

  logger.info('Grok API request', {
    action,
    method: request.method,
    ip: getClientIP(request),
  });

  switch (action) {
    case 'stream':
      return handleStream(request);

    case 'optimize':
      if (request.method !== 'POST') {
        return new NextResponse(
          JSON.stringify({ error: 'POST required for optimization' }),
          { status: 405 }
        );
      }
      return handleOptimization(request);

    case 'learn':
      if (request.method !== 'POST') {
        return new NextResponse(
          JSON.stringify({ error: 'POST required for learning' }),
          { status: 405 }
        );
      }
      return handleLearning(request);

    case 'metrics':
      return handleMetrics(request);

    case 'analyze':
    default:
      if (request.method !== 'POST') {
        return new NextResponse(
          JSON.stringify({ error: 'POST required for analysis' }),
          { status: 405 }
        );
      }
      return handleAnalysis(request);
  }
}

// Export with error handling and middleware
export const POST = withErrorHandling(
  async (request: NextRequest) => {
    const wrappedHandler = await withMiddleware(handler);
    return wrappedHandler(request);
  }
);

export const GET = withErrorHandling(
  async (request: NextRequest) => {
    const wrappedHandler = await withMiddleware(handler);
    return wrappedHandler(request);
  }
);
