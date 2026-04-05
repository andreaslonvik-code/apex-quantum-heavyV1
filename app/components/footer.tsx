'use client';

interface FooterProps {
  language: 'no' | 'en';
}

export function Footer({ language }: FooterProps) {
  const t = {
    no: {
      disclaimer:
        'Apex Quantum er en AI-drevet analyseplattform. Handel innebærer risiko. Tidligere resultater er ingen garanti for fremtidige resultater.',
      rights: 'Alle rettigheter forbeholdt.',
    },
    en: {
      disclaimer:
        'Apex Quantum is an AI-powered analysis platform. Trading involves risk. Past performance is not a guarantee of future results.',
      rights: 'All rights reserved.',
    },
  }[language];

  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img 
              src="/images/logo.jpg" 
              alt="Apex Quantum" 
              className="h-8 w-auto"
            />
            <span className="font-semibold">Apex Quantum</span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-right max-w-md">
            {t.disclaimer}
          </p>
        </div>
        <div className="mt-8 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Apex Quantum. {t.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
