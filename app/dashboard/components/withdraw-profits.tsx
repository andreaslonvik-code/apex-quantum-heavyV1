'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface WithdrawProfitsProps {
  pnl: number;
  totalValue: number;
  startBalance: number;
  currency: string;
  onWithdraw: () => Promise<void>;
  isLoading?: boolean;
}

export function WithdrawProfits({
  pnl,
  totalValue,
  startBalance,
  currency,
  onWithdraw,
  isLoading,
}: WithdrawProfitsProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canWithdraw = pnl > 100; // Minimum 100 kr to withdraw

  const handleWithdraw = async () => {
    setError(null);
    setSuccess(null);

    try {
      await onWithdraw();
      setSuccess(`Avkastning på ${pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} ${currency} ble tatt ut!`);
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feil ved uttak av avkastning');
    }
  };

  return (
    <div className="glass-card rounded-lg p-6 border border-border mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          💰 Ta ut avkastning
        </h2>
        {pnl > 0 && (
          <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-semibold">
            +{pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency} å hente
          </span>
        )}
      </div>

      <div className="bg-muted/20 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Start</div>
            <div className="font-semibold">{startBalance.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Nåværende</div>
            <div className="font-semibold">{totalValue.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Avkastning</div>
            <div className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}
            </div>
          </div>
        </div>

        {pnl > 0 && (
          <p className="text-xs text-muted-foreground">
            Når du henter ut avkastning, vil posisjoner selges for å få kontanter tilbake til startbeløpet ({startBalance.toLocaleString()} {currency}). 
            Trading vil fortsette automatisk.
          </p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400 mb-0.5">Feil</p>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-400 mb-0.5">Suksess</p>
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm ? (
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-400 mb-2">Bekreft uttak av avkastning</p>
                <p className="text-sm text-yellow-300 mb-3">
                  Du er i ferd med å hente ut <strong>{pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</strong> i avkastning.
                </p>
                <p className="text-xs text-yellow-300">
                  Nødvendige posisjoner vil bli solgt for å frigjøre kontanter. Din konto vil bli reset til {startBalance.toLocaleString()} {currency}.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-lg font-medium transition-colors text-sm"
            >
              Avbryt
            </button>
            <button
              onClick={handleWithdraw}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg font-medium transition-colors text-sm"
            >
              {isLoading ? 'Behandler...' : 'Bekreft uttak'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canWithdraw || isLoading}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all text-center ${
            canWithdraw
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Behandler...' : pnl <= 0 ? 'Ingen avkastning å hente' : `Ta ut ${pnl.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} ${currency}`}
        </button>
      )}
    </div>
  );
}
