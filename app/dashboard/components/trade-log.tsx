'use client';

import { CheckCircle, AlertCircle } from 'lucide-react';

interface Trade {
  ticker: string;
  symbol?: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  value: number;
  orderId?: string;
  status: 'OK' | 'FEIL';
  reason: string;
  timestamp?: string;
}

interface TradeLogProps {
  trades: Trade[];
  limit?: number;
  isLoading?: boolean;
}

export function TradeLog({ trades, limit = 10, isLoading }: TradeLogProps) {
  const displayTrades = trades.slice(0, limit);

  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-6 border border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          📋 Handelslogg
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Laster handler...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!displayTrades || displayTrades.length === 0) {
    return (
      <div className="glass-card rounded-lg p-6 border border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          📋 Handelslogg
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-muted-foreground">Ingen handler ennå</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-6 border border-border">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        📋 Handelslogg (Siste {displayTrades.length})
      </h2>
      
      <div className="space-y-3">
        {displayTrades.map((trade, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
              trade.status === 'OK'
                ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
                : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
            }`}
          >
            <div className="flex items-start gap-3 flex-1">
              <div className={`flex-shrink-0 mt-1 ${trade.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                {trade.status === 'OK' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{trade.ticker}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    trade.action === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.action === 'BUY' ? '🔼 KJØ P' : '🔽 SELG'}
                  </span>
                  <span className={`text-xs ${trade.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.status === 'OK' ? 'OK' : 'FEIL'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {trade.amount} × ${trade.price.toFixed(2)} = ${trade.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                {trade.reason && (
                  <p className="text-xs text-muted-foreground mt-1">{trade.reason}</p>
                )}
              </div>
            </div>

            <div className="text-right text-xs text-muted-foreground">
              {trade.timestamp && new Date(trade.timestamp).toLocaleTimeString('en-US')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
