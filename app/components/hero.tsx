'use client';

interface HeroProps {
  language: 'no' | 'en';
}

export function Hero({ language }: HeroProps) {
  const content = {
    no: {
      badge: 'AI-drevet aksjehandel',
      title: 'Markedet sover aldri.',
      titleAccent: 'Vi heller ikke.',
      description:
        'Autonom AI-aksjerobot som scanner globale markeder 24/7. Ingen menneskelig inngripen. Kun datadrevne beslutninger.',
      cta: 'Kom i gang',
      price: '499 kr/mnd',
    },
    en: {
      badge: 'AI-Powered Trading',
      title: 'Markets never sleep.',
      titleAccent: 'Neither do we.',
      description:
        'Autonomous AI stock robot scanning global markets 24/7. No human intervention. Only data-driven decisions.',
      cta: 'Get Started',
      price: '499 NOK/mo',
    },
  };

  const t = content[language];

  return (
    <section className="pt-32 pb-16 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-accent pulse-live" />
          <span className="text-sm font-medium text-accent">{t.badge}</span>
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-balance">
          {t.title}
          <br />
          <span className="text-accent">{t.titleAccent}</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
          {t.description}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => (window.location.href = '/api/stripe/checkout')}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-3.5 rounded-xl transition-all flex items-center gap-3 text-lg"
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
          <span className="text-muted-foreground">{t.price}</span>
        </div>
      </div>
    </section>
  );
}
