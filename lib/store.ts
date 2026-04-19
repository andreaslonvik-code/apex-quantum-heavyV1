// ============================================================
// APEX QUANTUM v6.1 - SELF-LEARNING STATE MANAGEMENT
// Zustand store for AI learning and trading state
// ============================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * AI Learning Model
 */
export interface LearningMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastUpdated: Date;
}

export interface TradeHistory {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  profit: number;
  profitPercent: number;
  duration: number; // milliseconds
  timestamp: Date;
  strategy: string;
  confidence: number;
}

export interface StrategyParameter {
  name: string;
  value: number;
  minValue: number;
  maxValue: number;
  optimizedValue?: number;
  lastOptimized?: Date;
}

export interface ApexQuantumStore {
  // Learning Metrics
  metrics: LearningMetrics;
  updateMetrics: (metrics: Partial<LearningMetrics>) => void;

  // Trade History
  trades: TradeHistory[];
  addTrade: (trade: TradeHistory) => void;
  removeTrade: (id: string) => void;
  getTrades: (symbol?: string) => TradeHistory[];

  // Strategy Parameters
  strategyParams: Record<string, StrategyParameter>;
  updateStrategyParam: (name: string, value: number) => void;
  optimizeParameters: () => void;

  // Learning State
  isLearning: boolean;
  setIsLearning: (learning: boolean) => void;
  learningProgress: number;
  setLearningProgress: (progress: number) => void;

  // Pattern Recognition
  identifiedPatterns: Array<{
    name: string;
    confidence: number;
    occurrences: number;
    profitability: number;
  }>;
  addPattern: (pattern: any) => void;

  // AI Insights
  insights: Array<{
    type: 'opportunity' | 'risk' | 'adjustment' | 'pattern';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: Date;
    actionable: boolean;
  }>;
  addInsight: (insight: any) => void;
  dismissInsight: (index: number) => void;

  // Trading State
  dailyProfit: number;
  setDailyProfit: (profit: number) => void;
  currentCapital: number;
  setCurrentCapital: (capital: number) => void;
  totalCapitalDeployed: number;
  setTotalCapitalDeployed: (deployed: number) => void;

  // Reset
  reset: () => void;
}

const initialMetrics: LearningMetrics = {
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  averageWin: 0,
  averageLoss: 0,
  profitFactor: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
  lastUpdated: new Date(),
};

const initialStrategyParams: Record<string, StrategyParameter> = {
  DIP_THRESHOLD: {
    name: 'DIP_THRESHOLD',
    value: 0.0003,
    minValue: 0.0001,
    maxValue: 0.001,
  },
  PEAK_THRESHOLD: {
    name: 'PEAK_THRESHOLD',
    value: 0.0005,
    minValue: 0.0002,
    maxValue: 0.002,
  },
  RSI_OVERSOLD: {
    name: 'RSI_OVERSOLD',
    value: 48,
    minValue: 30,
    maxValue: 50,
  },
  RSI_OVERBOUGHT: {
    name: 'RSI_OVERBOUGHT',
    value: 52,
    minValue: 50,
    maxValue: 70,
  },
  PROFIT_TAKE_THRESHOLD: {
    name: 'PROFIT_TAKE_THRESHOLD',
    value: 0.003,
    minValue: 0.001,
    maxValue: 0.01,
  },
  STOP_LOSS_THRESHOLD: {
    name: 'STOP_LOSS_THRESHOLD',
    value: -0.02,
    minValue: -0.05,
    maxValue: -0.005,
  },
  POSITION_SIZE_PERCENT: {
    name: 'POSITION_SIZE_PERCENT',
    value: 0.2,
    minValue: 0.05,
    maxValue: 0.5,
  },
};

/**
 * Self-Learning Zustand Store
 * Persists to localStorage for continuity across sessions
 */
export const useApexQuantumStore = create<ApexQuantumStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Learning Metrics
        metrics: initialMetrics,
        updateMetrics: (partial) =>
          set((state) => ({
            metrics: {
              ...state.metrics,
              ...partial,
              lastUpdated: new Date(),
            },
          })),

        // Trade History
        trades: [],
        addTrade: (trade) =>
          set((state) => {
            const newTrades = [...state.trades, trade];
            const winningTrades = newTrades.filter((t) => t.profit > 0).length;
            const losingTrades = newTrades.filter((t) => t.profit < 0).length;
            const totalTrades = newTrades.length;
            const wins = newTrades.filter((t) => t.profit > 0);
            const losses = newTrades.filter((t) => t.profit < 0);
            const averageWin = wins.length ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length : 0;
            const averageLoss = losses.length ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length : 0;

            return {
              trades: newTrades,
              metrics: {
                ...state.metrics,
                totalTrades,
                winningTrades,
                losingTrades,
                winRate: totalTrades ? (winningTrades / totalTrades) * 100 : 0,
                averageWin,
                averageLoss,
                profitFactor: averageLoss !== 0 ? Math.abs(averageWin / averageLoss) : 0,
                lastUpdated: new Date(),
              },
            };
          }),

        removeTrade: (id) =>
          set((state) => ({
            trades: state.trades.filter((t) => t.id !== id),
          })),

        getTrades: (symbol) => {
          const state = get();
          return symbol
            ? state.trades.filter((t) => t.symbol === symbol)
            : state.trades;
        },

        // Strategy Parameters
        strategyParams: initialStrategyParams,
        updateStrategyParam: (name, value) =>
          set((state) => ({
            strategyParams: {
              ...state.strategyParams,
              [name]: {
                ...state.strategyParams[name],
                value,
              },
            },
          })),

        optimizeParameters: () => {
          // AI-driven optimization based on trade history
          set((state) => {
            const optimizedParams = { ...state.strategyParams };

            // Simple optimization: adjust RSI thresholds based on win rate
            if (state.metrics.winRate > 60) {
              optimizedParams.RSI_OVERSOLD.optimizedValue = Math.max(
                20,
                optimizedParams.RSI_OVERSOLD.value - 1
              );
              optimizedParams.RSI_OVERBOUGHT.optimizedValue = Math.min(
                80,
                optimizedParams.RSI_OVERBOUGHT.value + 1
              );
            }

            // Adjust profit taking if win rate is low
            if (state.metrics.winRate < 45 && state.metrics.totalTrades > 50) {
              optimizedParams.PROFIT_TAKE_THRESHOLD.optimizedValue =
                optimizedParams.PROFIT_TAKE_THRESHOLD.value * 1.2;
            }

            return {
              strategyParams: optimizedParams,
            };
          });
        },

        // Learning State
        isLearning: false,
        setIsLearning: (learning) => set({ isLearning: learning }),
        learningProgress: 0,
        setLearningProgress: (progress) => set({ learningProgress: progress }),

        // Pattern Recognition
        identifiedPatterns: [],
        addPattern: (pattern) =>
          set((state) => ({
            identifiedPatterns: [...state.identifiedPatterns, pattern],
          })),

        // AI Insights
        insights: [],
        addInsight: (insight) =>
          set((state) => ({
            insights: [...state.insights, { ...insight, timestamp: new Date() }],
          })),
        dismissInsight: (index) =>
          set((state) => ({
            insights: state.insights.filter((_, i) => i !== index),
          })),

        // Trading State
        dailyProfit: 0,
        setDailyProfit: (profit) => set({ dailyProfit: profit }),
        currentCapital: 1000000,
        setCurrentCapital: (capital) => set({ currentCapital: capital }),
        totalCapitalDeployed: 0,
        setTotalCapitalDeployed: (deployed) => set({ totalCapitalDeployed: deployed }),

        // Reset
        reset: () =>
          set({
            metrics: initialMetrics,
            trades: [],
            strategyParams: initialStrategyParams,
            isLearning: false,
            learningProgress: 0,
            identifiedPatterns: [],
            insights: [],
            dailyProfit: 0,
            currentCapital: 1000000,
            totalCapitalDeployed: 0,
          }),
      }),
      {
        name: 'apex-quantum-memory',
      }
    )
  )
);
