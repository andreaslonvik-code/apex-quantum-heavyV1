'use client';

interface HeaderProps {
  language: 'no' | 'en';
  onLanguageChange: (lang: 'no' | 'en') => void;
}

export function Header({ language, onLanguageChange }: HeaderProps) {
  const content = {
    no: {
      cta: 'Start nå',
    },
    en: {
      cta: 'Get Started',
    },
  };

  const t = content[language];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/images/logo.jpg" 
            alt="Apex Quantum" 
            className="h-10 w-auto"
          />
          <span className="font-semibold text-lg tracking-tight">Apex Quantum</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => onLanguageChange('no')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                language === 'no'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              NO
            </button>
            <button
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                language === 'en'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              EN
            </button>
          </div>

          <button
            onClick={() => (window.location.href = '/api/stripe/checkout')}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium px-5 py-2 rounded-lg transition-all flex items-center gap-2"
          >
            {t.cta}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-4 h-4"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
