'use client';

import { AlertCircle, CheckCircle, Battery } from 'lucide-react';

interface SystemStatusProps {
  isTrading: boolean;
  isBotEnabled: boolean;
  lastSignal?: string;
  nextExecution?: string;
  mode: 'sim' | 'live';
  scanCount: number;
  lastUpdate: string;
  isDarkMode?: boolean;
}

export function SystemStatus({
  isTrading,
  isBotEnabled,
  lastSignal,
  nextExecution,
  mode,
  scanCount,
  lastUpdate,
}: SystemStatusProps) {
  const statusColor = isTrading ? 'text-emerald-400' : 'text-yellow-400';
  const statusBgColor = isTrading ? 'bg-emerald-500/20' : 'bg-yellow-500/20';
  const statusBorderColor = isTrading ? 'border-emerald-500/30' : 'border-yellow-500/30';

  return (
    <div className={`glass-card rounded-lg p-6 border mb-6 ${statusBorderColor} ${statusBgColor}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            ⚙️ Systemstatus
          </h2>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isTrading ? 'bg-emerald-400' : 'bg-yellow-400'} animate-pulse`} />
            <span className={`text-lg font-semibold ${statusColor}`}>
              {isTrading ? 'BOT KJØRER' : 'BOT STOPPET'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium  ${
              mode === 'live'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {mode === 'live' ? 'LIVE' : 'SIM'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {isTrading && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 rounded-full text-xs font-medium text-emerald-400">
              <Battery className="w-4 h-4" />
              Aktiv
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-border/50">
        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Scan Nummer</div>
          <div className="text-2xl font-bold text-neon-cyan">{scanCount}</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Modus</div>
          <div className={`text-2xl font-bold ${mode === 'live' ? 'text-red-400' : 'text-blue-400'}`}>
            {mode === 'live' ? 'LIVE' : 'SIM'}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Siste Signal</div>
          <div className="text-2xl font-bold text-muted-foreground">-</div>
          {lastSignal && (
            <div className="text-xs text-muted-foreground mt-1">{lastSignal}</div>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Sist Oppdatert</div>
          <div className="text-xs font-mono text-neon-cyan">{lastUpdate}</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-muted-foreground">
            System er {isTrading ? 'operasjonelt' : 'på standby'}. {isBotEnabled ? 'Auto-trading aktivert.' : 'Manual-modus.'}
          </span>
        </div>
      </div>
    </div>
  );
}
