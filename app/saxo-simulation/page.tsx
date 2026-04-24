'use client';

import { useState } from 'react';

// Saxo OAuth2 configuration
const SAXO_AUTH_URL = 'https://sim.logonvalidation.net/authorize';
const CLIENT_ID = process.env.NEXT_PUBLIC_SAXO_CLIENT_ID || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_SAXO_REDIRECT_URI || 'https://apex-quantum.com/callback';

export default function SaxoSimulationPage() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    
    // Build OAuth2 authorization URL
    const authUrl = new URL(SAXO_AUTH_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', crypto.randomUUID());
    
    // Redirect to Saxo login
    window.location.href = authUrl.toString();
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
          <div className="bg-card border border-border rounded-2xl p-8 sm:p-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-balance">
              Koble din Saxo Simulation-konto til Apex Quantum
            </h1>
            
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Apex Quantum vil nå handle autonomt i Paper Trading-modus med dine 100 000 kr virtuelle penger. Ingen ekte penger brukes.
            </p>

            <div className="space-y-6">
              {/* Info cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted/50 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-accent" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <span className="font-medium text-foreground text-sm">Sikker tilkobling</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Du logger inn direkte hos Saxo Bank. Vi lagrer aldri ditt passord.
                  </p>
                </div>

                <div className="bg-muted/50 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-cyan-400" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <span className="font-medium text-foreground text-sm">Paper Trading</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kun virtuelle penger. Perfekt for testing av AI-strategien.
                  </p>
                </div>
              </div>

              {/* Simulation Mode indicator */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                    <div>
                      <p className="font-medium text-foreground">Simulation Mode</p>
                      <p className="text-sm text-cyan-400">Paper Trading – virtuelle penger</p>
                    </div>
                  </div>
                  <div className="w-12 h-6 bg-cyan-500 rounded-full flex items-center px-1">
                    <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                  </div>
                </div>
              </div>

              {/* What happens section */}
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium text-foreground mb-4">Hva skjer etter tilkobling?</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-accent">1</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      AI-en scanner markedet og identifiserer muligheter
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-accent">2</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Apex Quantum bygger en konsentrert portefølje basert på din risikoappetitt
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-accent">3</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Handler utføres automatisk i din Saxo-konto
                    </span>
                  </li>
                </ul>
              </div>

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
                    Omdirigerer til Saxo Bank...
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

          {/* Back link */}
          <div className="mt-6 text-center">
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
              Tilbake til forsiden
            </a>
          </div>
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
