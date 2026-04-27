'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

type Env = 'paper' | 'live';

export default function ConnectAlpacaPage() {
  const router = useRouter();
  const [environment, setEnvironment] = useState<Env>('paper');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLive = environment === 'live';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('Begge feltene er påkrevd.');
      return;
    }

    if (isLive) {
      const confirmed = window.confirm(
        'ADVARSEL: Du er i ferd med å koble til en LIVE Alpaca-konto.\n\n' +
          'Alle trades vil bli utført med ekte penger. Tap er reelle.\n\n' +
          'Bekreft for å fortsette.'
      );
      if (!confirmed) return;
    }

    setError(null);
    setIsSubmitting(true);
    const toastId = toast.loading('Validerer Alpaca-nøkler...');

    try {
      const res = await fetch('/api/apex/alpaca/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          environment,
        }),
      });

      const data = await res.json();
      toast.dismiss(toastId);

      if (!res.ok) {
        setError(data.error || 'Tilkobling feilet.');
        toast.error(data.error || 'Tilkobling feilet.');
        return;
      }

      toast.success(
        `Tilkoblet ${isLive ? 'LIVE' : 'PAPER'}-konto ${data.accountInfo?.accountId || ''}`
      );
      router.push('/dashboard');
    } catch (err) {
      toast.dismiss(toastId);
      const msg = err instanceof Error ? err.message : 'Nettverksfeil';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-border/50">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="font-semibold text-lg tracking-tight text-foreground">
            Apex Quantum
          </Link>
        </div>
      </header>

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-2xl p-8 sm:p-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Koble til Alpaca
            </h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Lim inn API Key ID og Secret Key fra din Alpaca-konto. Nøklene krypteres
              (AES-256-GCM) før lagring og brukes kun til autonom handel på din konto.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Environment selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Miljø
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnvironment('paper')}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      environment === 'paper'
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          environment === 'paper' ? 'bg-cyan-400' : 'bg-muted-foreground/40'
                        }`}
                      />
                      <span className="font-medium text-foreground">Paper</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Simulert handel — virtuelle penger fra Alpaca Paper Trading.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironment('live')}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      environment === 'live'
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          environment === 'live' ? 'bg-red-400' : 'bg-muted-foreground/40'
                        }`}
                      />
                      <span className="font-medium text-foreground">Live</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Reell handel — ekte penger på din Alpaca Live-konto.
                    </p>
                  </button>
                </div>
              </div>

              {/* API Key ID */}
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-foreground mb-2">
                  API Key ID
                </label>
                <input
                  id="apiKey"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="PKXXXXXXXXXXXXXXXXXX"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Secret Key */}
              <div>
                <label htmlFor="apiSecret" className="block text-sm font-medium text-foreground mb-2">
                  Secret Key
                </label>
                <div className="relative">
                  <input
                    id="apiSecret"
                    type={showSecret ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full px-4 py-3 pr-24 bg-background border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:border-accent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? 'Skjul' : 'Vis'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Apex Quantum lagrer aldri nøkler i klartekst. De krypteres med AES-256-GCM
                  før de skrives til databasen.
                </p>
              </div>

              {/* Where do I get keys */}
              <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm">
                <p className="font-medium text-foreground mb-2">Hvor finner jeg nøklene?</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>
                    Logg inn på{' '}
                    <a
                      href={
                        isLive
                          ? 'https://app.alpaca.markets/'
                          : 'https://app.alpaca.markets/paper/dashboard/overview'
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      app.alpaca.markets
                    </a>{' '}
                    ({isLive ? 'Live' : 'Paper'} dashboard).
                  </li>
                  <li>Gå til &quot;Your API Keys&quot; / &quot;Generate New Key&quot;.</li>
                  <li>Kopier Key ID og Secret. Secret vises kun én gang!</li>
                </ol>
              </div>

              {/* Live warning */}
              {isLive && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-400 mb-1">⚠ LIVE TRADING</p>
                  <p className="text-xs text-red-300/80 leading-relaxed">
                    Apex Quantum vil utføre kjøps- og salgsordrer på din ekte Alpaca-konto.
                    Tap er reelle og ugjenkallelige. Apex Quantum gir ingen garantier.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-colors ${
                  isLive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-accent hover:bg-accent/90 text-accent-foreground'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting
                  ? 'Validerer...'
                  : isLive
                  ? 'Koble til LIVE Alpaca-konto'
                  : 'Koble til Paper Alpaca-konto'}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← Tilbake til forsiden
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 px-4 border-t border-border/50">
        <div className="max-w-2xl mx-auto text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Apex Quantum. Alpaca-handel er underlagt Alpacas vilkår.
        </div>
      </footer>
    </div>
  );
}
