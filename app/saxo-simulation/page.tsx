'use client';

import { useState } from 'react';

export default function SaxoSimulationPage() {
  const [clientId, setClientId] = useState('036e1c50316b4589b899db41f61563a7');
  const [clientSecret, setClientSecret] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [accountInfo, setAccountInfo] = useState<{ balance: string; currency: string } | null>(null);

  const handleConnect = async () => {
    if (!clientId || !clientSecret) {
      setError('Vennligst fyll ut både Client ID og Client Secret');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      const response = await fetch('/api/apex/connect-saxo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          clientSecret,
          simulationMode: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kunne ikke koble til Saxo');
      }

      setAccountInfo(data.accountInfo);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'En feil oppstod');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with logo */}
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-border/50">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img 
            src="/images/logo.jpg" 
            alt="Apex Quantum" 
            className="h-10 w-auto"
          />
          <span className="font-semibold text-lg tracking-tight text-foreground">Apex Quantum</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {!isConnected ? (
            <div className="bg-card border border-border rounded-2xl p-8 sm:p-10">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-balance">
                Koble din Saxo Simulation-konto til Apex Quantum
              </h1>
              
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Apex Quantum vil nå handle autonomt i Paper Trading-modus med dine 100 000 kr virtuelle penger. Ingen ekte penger brukes.
              </p>

              <div className="space-y-6">
                {/* Client ID field */}
                <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-foreground mb-2">
                    Client ID (App Key)
                  </label>
                  <input
                    type="text"
                    id="clientId"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-mono text-sm"
                    placeholder="Din Client ID"
                  />
                </div>

                {/* Client Secret field */}
                <div>
                  <label htmlFor="clientSecret" className="block text-sm font-medium text-foreground mb-2">
                    Client Secret (App Secret)
                  </label>
                  <input
                    type="password"
                    id="clientSecret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-mono text-sm"
                    placeholder="Din Client Secret"
                  />
                </div>

                {/* Simulation Mode Toggle (locked) */}
                <div className="bg-muted/50 border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Simulation Mode</p>
                      <p className="text-sm text-muted-foreground">Paper Trading – virtuelle penger</p>
                    </div>
                    <div className="relative">
                      <div className="w-12 h-6 bg-accent rounded-full flex items-center px-1">
                        <div className="w-4 h-4 bg-accent-foreground rounded-full ml-auto" />
                      </div>
                      <div className="absolute inset-0 cursor-not-allowed" title="Simulation mode er alltid på" />
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Connect button */}
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-accent hover:bg-accent/90 disabled:bg-accent/50 disabled:cursor-not-allowed text-accent-foreground font-semibold px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-lg"
                >
                  {isConnecting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Kobler til...
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-5 h-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      Koble til Saxo og start autonom handel
                    </>
                  )}
                </button>

                {/* Note */}
                <p className="text-center text-xs text-muted-foreground">
                  Dette er kun simulert handel for testing.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-accent/30 rounded-2xl p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-6 h-6 text-accent"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Tilkobling vellykket!</h2>
              </div>

              <p className="text-muted-foreground mb-6 leading-relaxed">
                Apex Quantum er nå koblet til din Saxo Simulation-konto. AI-en vil starte å scanne markedet og bygge porteføljen din umiddelbart.
              </p>

              {accountInfo && (
                <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Virtuell saldo</p>
                  <p className="text-2xl font-bold text-foreground">
                    {accountInfo.balance} {accountInfo.currency}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-accent">
                <div className="w-2 h-2 rounded-full bg-accent pulse-live" />
                <span className="text-sm font-medium">AI-en scanner markedet...</span>
              </div>

              <div className="mt-8">
                <a
                  href="/"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-4 h-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Tilbake til dashbordet
                </a>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-8">
                Dette er kun simulert handel for testing.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-border/50">
        <div className="max-w-2xl mx-auto text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Apex Quantum. Alle rettigheter reservert.
        </div>
      </footer>
    </div>
  );
}
