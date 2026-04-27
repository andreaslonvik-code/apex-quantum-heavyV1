'use client';

interface HeroProps {
  language: 'no' | 'en';
}

export function Hero({ language }: HeroProps) {
  const content = {
    no: {
      badge: '🤖 Autonom AI-trading på Alpaca',
      title: 'Apex Quantum v8',
      titleAccent: 'Din AI-trader på US-aksjemarkedet',
      description:
        'Apex Quantum analyserer markedsdynamikk og utfører aksjehandel fullt automatisk på dine vegne via Alpaca. Handler US equities (NASDAQ, NYSE, ARCA, AMEX) med Grok-4-Heavy AI. Lim inn dine egne Alpaca API-nøkler — vi lagrer dem kryptert (AES-256-GCM) og handler kun på din konto.',
      features: [
        '📊 Analyserer US equities (NASDAQ, NYSE, ARCA, AMEX)',
        '🔐 Krypterte API-nøkler (AES-256-GCM)',
        '⚡ Handler hvert 2. sekund automatisk',
        '🛡️ Per-bruker isolasjon — Clerk auth',
        '📈 Porteføljegraf & live P&L',
        '💰 Ta ut avkastning på ett klikk',
      ],
      cta: 'Koble til Alpaca',
      ctaSecondary: 'Les mer',
      price: 'Fra 499 kr/mnd',
    },
    en: {
      badge: '🤖 Autonomous AI Trading on Alpaca',
      title: 'Apex Quantum v8',
      titleAccent: 'Your AI Trader on US Equities',
      description:
        'Apex Quantum analyzes market dynamics and executes equity trading fully automatically via Alpaca. Trades US equities (NASDAQ, NYSE, ARCA, AMEX) with Grok-4-Heavy AI. Paste your own Alpaca API keys — we store them encrypted (AES-256-GCM) and trade only on your account.',
      features: [
        '📊 Analyzes US equities (NASDAQ, NYSE, ARCA, AMEX)',
        '🔐 Encrypted API keys (AES-256-GCM)',
        '⚡ Trades every 2 seconds automatically',
        '🛡️ Per-user isolation — Clerk auth',
        '📈 Portfolio chart & live P&L',
        '💰 Withdraw profits with one click',
      ],
      cta: 'Connect Alpaca',
      ctaSecondary: 'Learn More',
      price: 'From $49/month',
    },
  };

  const t = content[language];

  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/30 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
            <span className="text-sm font-medium text-neon-cyan">{t.badge}</span>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-balance mb-4">
            {t.title}
          </h1>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-balance text-neon-cyan">
            {t.titleAccent}
          </h2>
        </div>

        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed text-center mb-12">
          {t.description}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 max-w-3xl mx-auto">
          {t.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-xl flex-shrink-0">{feature.split(' ')[0]}</div>
              <div className="text-sm font-medium text-foreground">{feature.split(' ').slice(1).join(' ')}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <button
            onClick={() => {
              document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-neon-cyan hover:bg-neon-cyan/90 text-black font-bold px-10 py-4 rounded-xl transition-all flex items-center gap-3 text-lg w-full sm:w-auto justify-center neon-cyan-glow"
          >
            {t.cta}
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="border border-border hover:bg-muted/50 text-foreground font-semibold px-10 py-4 rounded-xl transition-all w-full sm:w-auto"
          >
            {t.ctaSecondary}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>{t.price}</span>
          <span className="hidden sm:inline">•</span>
          <span>30 dagers risikofri prøveperiode</span>
          <span className="hidden sm:inline">•</span>
          <span>🔐 Krypterte Alpaca-nøkler</span>
        </div>
      </div>
    </section>
  );
}
