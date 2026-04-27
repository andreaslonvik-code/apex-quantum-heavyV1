'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface Position {
  ticker: string;
  symbol?: string;
  navn: string;
  vekt: number;
  aksjon: string;
  antall: number;
  avgPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercent?: number;
}

interface OpenPositionsProps {
  positions: Position[];
  isLoading?: boolean;
}

export function OpenPositions({ positions, isLoading }: OpenPositionsProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-6 border border-border mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          🔄 Åpne Posisjoner
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Laster posisjoner...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="glass-card rounded-lg p-6 border border-border mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          🔄 Åpne Posisjoner
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-muted-foreground">Ingen åpne posisjoner</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-6 border border-border mb-6 overflow-x-auto">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        🔄 Åpne Posisjoner ({positions.length})
      </h2>
      
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-3 px-3 font-semibold text-muted-foreground">Ticker</th>
            <th className="text-right py-3 px-3 font-semibold text-muted-foreground">Antall</th>
            <th className="text-right py-3 px-3 font-semibold text-muted-foreground">Inn-kurs</th>
            <th className="text-right py-3 px-3 font-semibold text-muted-foreground">Nå-verdi</th>
            <th className="text-right py-3 px-3 font-semibold text-muted-foreground">P&L</th>
            <th className="text-right py-3 px-3 font-semibold text-muted-foreground">% Return</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            const pnl = pos.pnl || 0;
            const pnlPercent = pos.pnlPercent || 0;
            const isPositive = pnl >= 0;

            return (
              <tr key={idx} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                <td className="py-3 px-3">
                  <div className="font-semibold">{pos.ticker}</div>
                  <div className="text-xs text-muted-foreground">{pos.navn}</div>
                </td>
                <td className="text-right py-3 px-3 font-medium">{pos.antall.toLocaleString()}</td>
                <td className="text-right py-3 px-3">${(pos.avgPrice || 0).toFixed(2)}</td>
                <td className="text-right py-3 px-3 font-medium">
                  ${((pos.currentPrice || pos.avgPrice || 0) * pos.antall).toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className={`text-right py-3 px-3 font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {isPositive ? '+' : ''}${pnl.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </div>
                </td>
                <td className={`text-right py-3 px-3 font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
