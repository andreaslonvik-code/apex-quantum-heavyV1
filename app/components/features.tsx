'use client';

import React from 'react';

interface FeaturesProps {
  language: 'no' | 'en';
}

export function Features({ language }: FeaturesProps) {
  const content = {
    no: {
      features: [
        {
          icon: 'globe',
          title: 'Global Analyse',
          description: 'AI-en scanner aksjer og markeder over hele verden i sanntid.',
        },
        {
          icon: 'clock',
          title: 'Daglige Anbefalinger',
          description: 'Motta oppdaterte porteføljeanbefalinger hver dag du kan handle på.',
        },
        {
          icon: 'brain',
          title: 'Dokumentert Avkastning',
          description: 'Følg porteføljen slavisk og oppnå eksepsjonelle resultater.',
        },
        {
          icon: 'shield',
          title: 'Enkelt å Følge',
          description: 'Tydelige kjøps- og salgssignaler du selv utfører hos din megler.',
        },
      ],
    },
    en: {
      features: [
        {
          icon: 'globe',
          title: 'Global Analysis',
          description: 'The AI scans stocks and markets worldwide in real-time.',
        },
        {
          icon: 'clock',
          title: 'Daily Recommendations',
          description: 'Receive updated portfolio recommendations every day you can act on.',
        },
        {
          icon: 'brain',
          title: 'Proven Returns',
          description: 'Follow the portfolio precisely and achieve exceptional results.',
        },
        {
          icon: 'shield',
          title: 'Easy to Follow',
          description: 'Clear buy and sell signals you execute yourself with your broker.',
        },
      ],
    },
  };

  const t = content[language];
  const icons: Record<string, React.JSX.Element> = {
    globe: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    clock: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    brain: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4v1a4 4 0 0 0 8 0v-1a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4V6a4 4 0 0 0-4-4z" />
        <path d="M8 10h.01M16 10h.01M9 14a3 3 0 0 0 6 0" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l8 4v6c0 5.5-3.84 10.74-8 12-4.16-1.26-8-6.5-8-12V6l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  };

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.features.map((feature, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl p-6 hover:border-accent/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                {icons[feature.icon]}
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
