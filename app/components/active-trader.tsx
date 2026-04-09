'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Trade {
  ticker: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  value: number;
  orderId?: string;
  status: 'OK' | 'FEIL';
  reason: string;
}

interface Signal {
  ticker: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
}

interface TradingState {
  isActive: boolean;
  scanCount: number;
  totalBought: number;
  totalSold: number;
  executedTrades: Trade[];
  signals: Signal[];
  lastUpdate: string;
  error?: string;
}

interface ActiveTraderProps {
  onTradeExecuted?: (trades: Trade[]) => void;
  autoStart?: boolean;
  intervalMs?: number;
}

export function ActiveTrader({ onTradeExecuted, autoStart = false, intervalMs = 2000 }: ActiveTraderProps) {
  const [state, setState] = useState<TradingState>({
    isActive: false,
    scanCount: 0,
    totalBought: 0,
    totalSold: 0,
    executedTrades: [],
    signals: [],
    lastUpdate: '',
  });
  
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const runScan = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    
    try {
      const res = await fetch('/api/apex/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'paper' }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        setState(prev => ({ ...prev, error: err.error || 'Feil ved scan' }));
        return;
      }
      
      const data = await res.json();
      
      setState(prev => ({
        ...prev,
        scanCount: prev.scanCount + 1,
        totalBought: prev.totalBought + (data.stats?.kjopt || 0),
        totalSold: prev.totalSold + (data.stats?.solgt || 0),
        executedTrades: data.executedTrades || [],
        signals: data.signals || [],
        lastUpdate: new Date().toLocaleTimeString('no-NO'),
        error: undefined,
      }));
      
      // Track recent successful trades
      const newTrades = (data.executedTrades || []).filter((t: Trade) => t.status === 'OK');
      if (newTrades.length > 0) {
        setRecentTrades(prev => [...newTrades, ...prev].slice(0, 20));
        onTradeExecuted?.(newTrades);
      }
      
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Nettverksfeil' }));
    } finally {
      isRunningRef.current = false;
    }
  }, [onTradeExecuted]);

  const startTrading = useCallback(() => {
    if (intervalRef.current) return;
    
    setState(prev => ({ ...prev, isActive: true, error: undefined }));
    
    // Run immediately
    runScan();
    
    // Then run at interval
    intervalRef.current = setInterval(runScan, intervalMs);
  }, [runScan, intervalMs]);

  const stopTrading = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startTrading();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoStart, startTrading]);

  const successfulTrades = state.executedTrades.filter(t => t.status === 'OK');
  const failedTrades = state.executedTrades.filter(t => t.status === 'FEIL');

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Aktiv Trading Engine</h3>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
            state.isActive 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <span className={`w-2 h-2 rounded-full ${state.isActive ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
            {state.isActive ? 'AKTIV' : 'STOPPET'}
          </span>
        </div>
        
        <div className="flex gap-2">
          {!state.isActive ? (
            <button
              onClick={startTrading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Start Trading
            </button>
          ) : (
            <button
              onClick={stopTrading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Stopp
            </button>
          )}
        </div>
      </div>

      {state.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
          {state.error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-muted/30 rounded-md p-3">
          <div className="text-xs text-muted-foreground">Scans</div>
          <div className="text-xl font-bold">{state.scanCount}</div>
        </div>
        <div className="bg-muted/30 rounded-md p-3">
          <div className="text-xs text-muted-foreground">Kjopt</div>
          <div className="text-xl font-bold text-green-400">${state.totalBought.toLocaleString()}</div>
        </div>
        <div className="bg-muted/30 rounded-md p-3">
          <div className="text-xs text-muted-foreground">Solgt</div>
          <div className="text-xl font-bold text-red-400">${state.totalSold.toLocaleString()}</div>
        </div>
        <div className="bg-muted/30 rounded-md p-3">
          <div className="text-xs text-muted-foreground">Siste oppdatering</div>
          <div className="text-sm font-medium">{state.lastUpdate || '-'}</div>
        </div>
      </div>

      {/* Current signals */}
      {state.signals.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Aktive Signaler</h4>
          <div className="flex flex-wrap gap-2">
            {state.signals.map((signal, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  signal.action === 'BUY' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {signal.action === 'BUY' ? '+' : '-'}{signal.amount} {signal.ticker}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last scan results */}
      {successfulTrades.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Siste Handler</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {successfulTrades.map((trade, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className={trade.action === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                  {trade.action} {trade.amount}x {trade.ticker}
                </span>
                <span className="text-muted-foreground">${trade.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {failedTrades.length > 0 && (
        <div className="text-xs text-red-400">
          {failedTrades.length} ordre(r) feilet: {failedTrades.map(t => t.ticker).join(', ')}
        </div>
      )}

      {/* Trade history */}
      {recentTrades.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Handelshistorikk ({recentTrades.length})</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
            {recentTrades.map((trade, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className={trade.action === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                  {trade.action} {trade.amount}x {trade.ticker} @ ${trade.price.toFixed(2)}
                </span>
                <span className="text-muted-foreground font-mono">{trade.orderId?.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
