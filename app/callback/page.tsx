'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SaxoCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Kobler til Saxo...');
  const [accountInfo, setAccountInfo] = useState<{
    accountId: string;
    balance: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'Autentisering feilet');
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Ingen autorisasjonskode mottatt');
      return;
    }

    // Exchange code for token
    const exchangeCode = async () => {
      try {
        const response = await fetch('/api/apex/saxo-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Token exchange failed');
        }

        setAccountInfo({
          accountId: data.accountId,
          balance: data.balance,
          currency: data.currency,
        });
        setStatus('success');
        setMessage('Tilkobling vellykket!');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Noe gikk galt');
      }
    };

    exchangeCode();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/images/logo.jpg"
            alt="Apex Quantum"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground">Apex Quantum</h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'success' && accountInfo && (
            <>
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{message}</h2>
              <p className="text-muted-foreground mb-6">
                Apex Quantum er nå koblet til din Saxo Simulation-konto.
              </p>
              
              <div className="bg-background/50 rounded-xl p-4 mb-6 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground text-sm">Konto-ID</span>
                  <span className="text-foreground font-mono">{accountInfo.accountId}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground text-sm">Virtuell saldo</span>
                  <span className="text-accent font-semibold">
                    {accountInfo.balance.toLocaleString('no-NO')} {accountInfo.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Modus</span>
                  <span className="text-cyan-400 text-sm">Paper Trading</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-accent mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                <span className="text-sm">AI-en scanner markedet...</span>
              </div>

              <button
                onClick={() => router.push('/')}
                className="w-full py-3 px-6 bg-accent text-accent-foreground font-medium rounded-xl hover:bg-accent/90 transition-colors"
              >
                Gå til dashboard
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Tilkobling feilet</h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={() => router.push('/saxo-simulation')}
                className="w-full py-3 px-6 bg-accent text-accent-foreground font-medium rounded-xl hover:bg-accent/90 transition-colors"
              >
                Prøv igjen
              </button>
            </>
          )}
        </div>

        <p className="text-center text-muted-foreground/60 text-xs mt-6">
          Dette er kun simulert handel for testing.
        </p>
      </div>
    </div>
  );
}
