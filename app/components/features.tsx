'use client';

interface FeaturesProps {
  language: 'no' | 'en';
}

export function Features({ language }: FeaturesProps) {
  const content = {
    no: {
      features: [
        {
          icon: 'globe',
          title: 'Global Dekning',
          description: 'Scanner aksjer og markeder over hele verden i sanntid.',
        },
        {
          icon: 'clock',
          title: '24/7 Drift',
          description: 'Alltid aktiv, aldri pause. Fanger muligheter mens du sover.',
        },
        {
          icon: 'brain',
          title: 'Autonom AI',
          description: 'Ingen menneskelig inngripen. Kun datadrevne beslutninger.',
        },
        {
          icon: 'shield',
          title: 'Risikostyring',
          description: 'Innebygde sikkerhetsprotokoller for å beskytte kapitalen din.',
        },
      ],
    },
    en: {
      features: [
        {
          icon: 'globe',
          title: 'Global Coverage',
          description: 'Scans stocks and markets worldwide in real-time.',
        },
        {
          icon: 'clock',
          title: '24/7 Operation',
          description: 'Always active, never paused. Captures opportunities while you sleep.',
        },
        {
          icon: 'brain',
          title: 'Autonomous AI',
          description: 'No human intervention. Only data-driven decisions.',
        },
        {
          icon: 'shield',
          title: 'Risk Management',
          description: 'Built-in safety protocols to protect your capital.',
        },
      ],
    },
  };

  const t = content[language];

  const icons: Record<string, JSX.Element> = {
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
