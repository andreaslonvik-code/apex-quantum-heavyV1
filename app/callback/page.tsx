'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast, ToastContainer } from '@/app/components/toast';

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <img
            src="/images/logo.jpg"
            alt="Apex Quantum"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground mb-8">Apex Quantum</h1>
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Kobler til Saxo Bank...</p>
          </div>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}

interface SaxoPosition {
  ticker: string;
  amount: number;
  marketValue: number;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toasts, add: addToast, remove: removeToast } = useToast();
  const [status, setStatus] = useState<'loading' | 'fetching_portfolio' | 'building_portfolio' | 'starting_trading' | 'error'>('loading');
  const [message, setMessage] = useState('Kobler til Saxo...');
  const [subMessage, setSubMessage] = useState('');
  const [existingPortfolio, setExistingPortfolio] = useState<SaxoPosition[]>([]);
  const [accountInfo, setAccountInfo] = useState<{
    accountId: string;
    balance: number;
    currency: string;
    accessToken?: string;
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

    // Full flow: Exchange code -> Fetch portfolio -> Build if needed -> Start active trading
    const runFullFlow = async () => {
      try {
        // STEP 1: Exchange code for token
        setMessage('Autentiserer med Saxo...');
        const response = await fetch('/api/apex/saxo-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Token exchange failed');
        }

        if (!data.accessToken) {
          throw new Error('Access token mangler i responsen fra Saxo');
        }

        // STEP 2: Store credentials
        setMessage('Lagrer tilkobling...');
        const connectResponse = await fetch('/api/apex/connect-saxo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ accessToken: data.accessToken }),
        });

        if (!connectResponse.ok) {
          const connectError = await connectResponse.json();
          throw new Error(connectError.error || 'Failed to store credentials');
        }

        const connectData = await connectResponse.json();

        const account = {
          accountId: connectData.accountInfo.accountId,
          balance: connectData.accountInfo.balance,
          currency: connectData.accountInfo.currency,
          accessToken: data.accessToken,
        };
        setAccountInfo(account);
        
        // Store connection info
        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_saxo_connected', 'true');
          localStorage.setItem('apex_saxo_account', JSON.stringify({
            accountId: account.accountId,
            balance: account.balance,
            currency: account.currency,
          }));
        }

        // STEP 3: Fetch existing portfolio from Saxo
        setStatus('fetching_portfolio');
        setMessage('Henter eksisterende portefølje fra Saxo...');
        setSubMessage('Analyserer din nåværende posisjon');

        const portfolioResponse = await fetch('/api/apex/get-positions', {
          method: 'GET',
          credentials: 'include',
        });

        let hasExistingPortfolio = false;
        if (portfolioResponse.ok) {
          const portfolioData = await portfolioResponse.json();
          if (portfolioData.positions && portfolioData.positions.length > 0) {
            setExistingPortfolio(portfolioData.positions);
            hasExistingPortfolio = true;
            setSubMessage(`Fant ${portfolioData.positions.length} eksisterende posisjoner`);
          }
        }

        // STEP 4: Build portfolio if none exists
        if (!hasExistingPortfolio) {
          setStatus('building_portfolio');
          setMessage('Bygger Apex Quantum-portefølje...');
          setSubMessage('Ingen eksisterende portefølje - bygger fra v6.1 blueprint');

          const buildResponse = await fetch('/api/apex/autonomous', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              mode: 'paper',
              language: 'no',
              buildPortfolio: true, // Flag to indicate initial build
            }),
          });

          if (!buildResponse.ok) {
            const buildError = await buildResponse.json();
            throw new Error(buildError.error || 'Failed to build portfolio');
          }

          const buildData = await buildResponse.json();
          setSubMessage(`Portefølje bygget: ${buildData.executedTrades?.length || 0} posisjoner opprettet`);

          // Store initial portfolio
          if (typeof window !== 'undefined' && buildData.portfolio) {
            localStorage.setItem('apex_portfolio', JSON.stringify(buildData.portfolio));
          }
        }

        // STEP 5: Start active trading
        setStatus('starting_trading');
        setMessage('Starter aktiv handel...');
        setSubMessage('Apex Quantum aktiverer 24/7 autonom modus');

        const tradingResponse = await fetch('/api/apex/autonomous', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            mode: 'paper',
            language: 'no',
          }),
        });

        const tradingData = await tradingResponse.json();
        
        // Store results
        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_first_report', tradingData.message || '');
          localStorage.setItem('apex_trading_active', 'true');
          if (tradingData.portfolio && tradingData.portfolio.length > 0) {
            localStorage.setItem('apex_portfolio', JSON.stringify(tradingData.portfolio));
          }
        }

        // Redirect to dashboard
        setSubMessage('Omdirigerer til dashboard...');
        addToast('✅ Saxo Bank tilkobling vellykket! Apex Quantum er aktiv.', 'success', 3000);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);

      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Noe gikk galt');
        setSubMessage('');
      }
    };

    runFullFlow();
  }, [searchParams, router]);

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
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{message}</h2>
              <p className="text-muted-foreground text-sm">{subMessage}</p>
            </>
          )}

          {status === 'fetching_portfolio' && (
            <>
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{message}</h2>
              <p className="text-cyan-400 text-sm font-medium">{subMessage}</p>
              
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tilkoblet Saxo Simulation
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                  </span>
                  Henter posisjoner...
                </div>
              </div>
            </>
          )}

          {status === 'building_portfolio' && (
            <>
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{message}</h2>
              <p className="text-amber-400 text-sm font-medium">{subMessage}</p>
              
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tilkoblet Saxo Simulation
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Ingen eksisterende portefølje
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                  </span>
                  Bygger v6.1 blueprint-portefølje...
                </div>
              </div>

              <div className="mt-6 bg-background/50 rounded-xl p-4 text-left">
                <p className="text-xs text-muted-foreground mb-2">Apex Quantum v6.1 Blueprint:</p>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between"><span>MU (Micron)</span><span className="text-accent">68%</span></div>
                  <div className="flex justify-between"><span>CEG (Constellation)</span><span className="text-cyan-400">15%</span></div>
                  <div className="flex justify-between"><span>VRT (Vertiv)</span><span className="text-cyan-400">9%</span></div>
                  <div className="flex justify-between"><span>Satellitter</span><span className="text-muted-foreground">8%</span></div>
                </div>
              </div>
            </>
          )}

          {status === 'starting_trading' && (
            <>
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{message}</h2>
              <p className="text-accent text-sm font-medium">{subMessage}</p>
              
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tilkoblet Saxo Simulation
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Portefølje klar
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  Aktiverer 24/7 autonom handel...
                </div>
              </div>

              {existingPortfolio.length > 0 && (
                <div className="mt-6 bg-background/50 rounded-xl p-4 text-left">
                  <p className="text-xs text-muted-foreground mb-2">Eksisterende posisjoner funnet:</p>
                  <div className="space-y-1 text-xs font-mono">
                    {existingPortfolio.slice(0, 5).map(pos => (
                      <div key={pos.ticker} className="flex justify-between">
                        <span>{pos.ticker}</span>
                        <span className="text-accent">{pos.amount} aksjer</span>
                      </div>
                    ))}
                    {existingPortfolio.length > 5 && (
                      <div className="text-muted-foreground">...og {existingPortfolio.length - 5} flere</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Feil oppstod</h2>
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
          {status !== 'error' && accountInfo && (
            <>Konto: {accountInfo.accountId} - {accountInfo.balance.toLocaleString()} {accountInfo.currency}</>
          )}
          {status === 'error' && 'Paper Trading - Kun simulert handel'}
        </p>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
