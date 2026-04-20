'use client';

import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface PortfolioOverviewProps {
  totalValue: number;
  startBalance: number;
  pnl: number;
  pnlPercent: number;
  currency: string;
  lastUpdate: string;
}

export function PortfolioOverview({
  totalValue,
  startBalance,
  pnl,
  pnlPercent,
  currency,
  lastUpdate,
}: PortfolioOverviewProps) {
  const isPositive = pnl >= 0;

  return (
    <div className="glass-card rounded-lg p-6 border border-border neon-cyan-glow mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
            📊 Porteføljeoversikt
          </h2>
          <h3 className="text-3xl font-bold">
            {totalValue.toLocaleString('nb-NO', {
              maximumFractionDigits: 0,
            })} <span className="text-lg font-normal text-muted-foreground">{currency}</span>
          </h3>
        </div>
        
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
          isPositive
            ? 'bg-emerald-500/20 border border-emerald-500/30'
            : 'bg-red-500/20 border border-red-500/30'
        }`}>
          <div className={`flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? (
              <ArrowUpRight className="w-5 h-5" />
            ) : (
              <ArrowDownLeft className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}
            </div>
            <div className={`text-xs ${isPositive ? 'text-emerald-300' : 'text-red-300'}`}>
              {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-border/50">
        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Startbeløp</div>
          <div className="text-xl font-semibold">{startBalance.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Porteføljeverdi</div>
          <div className="text-xl font-semibold">{totalValue.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Avkastning (NOK)</div>
          <div className={`text-xl font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Avkastning (%)</div>
          <div className={`text-xl font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Last update */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Sist oppdatert: <span className="text-neon-cyan font-mono">{lastUpdate}</span>
        </p>
      </div>
    </div>
  );
}
