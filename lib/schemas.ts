// APEX QUANTUM v6.2 - Zod Schemas for Trading Data Validation
import { z } from 'zod';

// ============ TRADING SIGNAL SCHEMAS ============
export const TradingSignalSchema = z.object({
  ticker: z.string().min(1).max(10),
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  amount: z.number().int().positive(),
  reason: z.string(),
  price: z.number().positive().optional(),
  confidence: z.number().min(0).max(100).optional(),
  source: z.enum(['TIMESFM', 'RSI', 'APEX', 'FORCE', 'SCALP', 'DCA', 'AUTO']).optional(),
});

export const TradingSignalsResponseSchema = z.object({
  signals: z.array(TradingSignalSchema),
  timestamp: z.string(),
  marketStatus: z.object({
    usOpen: z.boolean(),
    message: z.string(),
  }),
});

export type TradingSignal = z.infer<typeof TradingSignalSchema>;
export type TradingSignalsResponse = z.infer<typeof TradingSignalsResponseSchema>;

// ============ GROK AI RESPONSE SCHEMAS ============
export const GrokTradeRecommendationSchema = z.object({
  ticker: z.string(),
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  quantity: z.number().int().nonnegative(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
  targetPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  timeHorizon: z.enum(['SCALP', 'INTRADAY', 'SWING', 'POSITION']).optional(),
});

export const GrokAnalysisResponseSchema = z.object({
  recommendations: z.array(GrokTradeRecommendationSchema),
  marketSentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']),
  summary: z.string(),
  timestamp: z.string(),
});

export type GrokTradeRecommendation = z.infer<typeof GrokTradeRecommendationSchema>;
export type GrokAnalysisResponse = z.infer<typeof GrokAnalysisResponseSchema>;

// ============ ORDER STATUS SCHEMAS ============
export const OrderStatusSchema = z.enum([
  'Pending',
  'Placed',
  'Filled',
  'PartiallyFilled',
  'Cancelled',
  'Rejected',
  'Expired',
]);

export const OrderResultSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  orderStatus: OrderStatusSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  uic: z.number().optional(),
  executedPrice: z.number().optional(),
  executedAmount: z.number().optional(),
  timestamp: z.string(),
  retryCount: z.number().int().nonnegative(),
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;

// ============ POSITION SCHEMAS ============
export const PositionSchema = z.object({
  ticker: z.string(),
  uic: z.number(),
  amount: z.number(),
  avgPrice: z.number(),
  currentPrice: z.number(),
  marketValue: z.number(),
  pnl: z.number(),
  pnlPercent: z.number(),
});

export const PortfolioSchema = z.object({
  positions: z.array(PositionSchema),
  totalValue: z.number(),
  cash: z.number(),
  totalPnl: z.number(),
  totalPnlPercent: z.number(),
});

export type Position = z.infer<typeof PositionSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;

// ============ TRADE EXECUTION SCHEMAS ============
export const ExecutedTradeSchema = z.object({
  ticker: z.string(),
  saxoSymbol: z.string(),
  action: z.enum(['BUY', 'SELL']),
  amount: z.number().int().positive(),
  price: z.number().positive(),
  value: z.number(),
  orderId: z.string().optional(),
  status: z.enum(['OK', 'FAILED', 'PENDING']),
  reason: z.string(),
  market: z.enum(['US', 'OSLO']),
  timestamp: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type ExecutedTrade = z.infer<typeof ExecutedTradeSchema>;

// ============ SCAN RESULT SCHEMAS ============
export const ScanResultSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  mode: z.enum(['paper', 'live']),
  marketStatus: z.object({
    usOpen: z.boolean(),
    message: z.string(),
  }),
  balance: z.object({
    cash: z.number(),
    total: z.number(),
    profit: z.number(),
  }),
  signals: z.array(TradingSignalSchema),
  executedTrades: z.array(ExecutedTradeSchema),
  summary: z.object({
    totalBought: z.number(),
    totalSold: z.number(),
    tradesExecuted: z.number(),
    signalsGenerated: z.number(),
  }),
  report: z.string(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

// ============ DASHBOARD DATA SCHEMAS ============
export const DashboardDataSchema = z.object({
  isConnected: z.boolean(),
  isTrading: z.boolean(),
  mode: z.enum(['SIM', 'LIVE']),
  accountInfo: z.object({
    accountKey: z.string(),
    balance: z.number(),
    cash: z.number(),
  }).optional(),
  portfolio: PortfolioSchema.optional(),
  lastScan: z.object({
    timestamp: z.string(),
    signalsGenerated: z.number(),
    tradesExecuted: z.number(),
  }).optional(),
  lastOrder: z.object({
    ticker: z.string(),
    action: z.enum(['BUY', 'SELL']),
    amount: z.number(),
    status: OrderStatusSchema,
    errorMessage: z.string().optional(),
    timestamp: z.string(),
  }).optional(),
  performance: z.object({
    dailyPnl: z.number(),
    dailyPnlPercent: z.number(),
    weeklyPnl: z.number(),
    monthlyPnl: z.number(),
  }).optional(),
});

export type DashboardData = z.infer<typeof DashboardDataSchema>;

// ============ RISK METRICS SCHEMAS ============
export const RiskMetricsSchema = z.object({
  volatility: z.number(),
  sharpeRatio: z.number(),
  maxDrawdown: z.number(),
  valueAtRisk: z.number(),
  beta: z.number(),
  correlation: z.number(),
  concentrationRisk: z.number(),
  liquidityRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export type RiskMetrics = z.infer<typeof RiskMetricsSchema>;

// ============ VALIDATION HELPERS ============
export function validateTradingSignal(data: unknown): TradingSignal | null {
  const result = TradingSignalSchema.safeParse(data);
  if (!result.success) {
    console.log(`[VALIDATION] Invalid trading signal: ${result.error.message}`);
    return null;
  }
  return result.data;
}

export function validateGrokResponse(data: unknown): GrokAnalysisResponse | null {
  const result = GrokAnalysisResponseSchema.safeParse(data);
  if (!result.success) {
    console.log(`[VALIDATION] Invalid Grok response: ${result.error.message}`);
    return null;
  }
  return result.data;
}

export function validateOrderResult(data: unknown): OrderResult | null {
  const result = OrderResultSchema.safeParse(data);
  if (!result.success) {
    console.log(`[VALIDATION] Invalid order result: ${result.error.message}`);
    return null;
  }
  return result.data;
}
