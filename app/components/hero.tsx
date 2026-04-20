'use client';

interface HeroProps {
  language: 'no' | 'en';
}

export function Hero({ language }: HeroProps) {
  const content = {
    no: {
      badge: '🤖 Autonom AI-trading på Oslo Børs',
      title: 'Apex Quantum v7',
      titleAccent: 'Din AI-trader på Oslo Børs',
      description:
        'Apex Quantum analyserer markedsdynamikk og utfører aksjehandel fullt automatisk. Handler kun på Oslo Børs (XOSL), NASDAQ og XETRA med strategier optimalisert for norske og internasjonale aksjer. Koble til Saxo-kontoen din og la Grok-4-Heavy AI bygge et lønnsomt portfolio.',
      features: [
        '📊 Analyserer norske og internasjonale aksjer',
        '🇳🇴 Fokus på Oslo Børs (XOSL)',
        '⚡ Handler hvert 2. sekund automatisk',
        '🛡️ Sikkerhet: Rate-limiting, AML & KYC',
        '📈 Porteføljegraf & live P&L',
        '💰 Ta ut avkastning på ett klikk',
      ],
      cta: 'Koble til Saxo',
      ctaSecondary: 'Les mer',
      price: 'Fra 499 kr/mnd',
    },
    en: {
      badge: '🤖 Autonomous AI Trading on Oslo Stock Exchange',
      title: 'Apex Quantum v7',
      titleAccent: 'Your AI Trader on Oslo Børs',
      description:
        'Apex Quantum analyzes market dynamics and executes equity trading fully automatically. Trades only Norwegian and international stocks on Oslo Børs (XOSL), NASDAQ, and XETRA with AI strategies optimized for Nordic and global markets. Connect your Saxo account and let Grok-4-Heavy AI build a profitable portfolio.',
      features: [
        '📊 Analyzes Norwegian and international stocks',
        '🇳🇴 Focus on Oslo Stock Exchange (XOSL)',
        '⚡ Trades every 2 seconds automatically',
        '🛡️ Security: Rate-limiting, AML & KYC',
        '📈 Portfolio chart &live P&L',
        '💰 Withdraw profits with one click',
      ],
      cta: 'Connect Saxo',
      ctaSecondary: 'Learn More',
      price: 'From 499 NOK/month',
    },
  };

  const t = content[language];

  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/30 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
            <span className="text-sm font-medium text-neon-cyan">{t.badge}</span>
          </div>
        </div>

        {/* Main Headline */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-balance mb-4">
            {t.title}
          </h1>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-balance text-neon-cyan">
            {t.titleAccent}
          </h2>
        </div>

        {/* Description */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed text-center mb-12">
          {t.description}
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 max-w-3xl mx-auto">
          {t.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-xl flex-shrink-0">{feature.split(' ')[0]}</div>
              <div className="text-sm font-medium text-foreground">{feature.split(' ').slice(1).join(' ')}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <button
            onClick={() => {
              document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-neon-cyan hover:bg-neon-cyan/90 text-black font-bold px-10 py-4 rounded-xl transition-all flex items-center gap-3 text-lg w-full sm:w-auto justify-center neon-cyan-glow"
          >
            {t.cta}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              stroke="currentColor"
              strokeWidth="2"
            >
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

        {/* Price and Trust */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>{t.price}</span>
          <span className="hidden sm:inline">•</span>
          <span>30 dagers risikofri prøveperiode</span>
          <span className="hidden sm:inline">•</span>
          <span>💳 Sikker Saxo-integrasjon</span>
        </div>
      </div>
    </section>
  );
}
