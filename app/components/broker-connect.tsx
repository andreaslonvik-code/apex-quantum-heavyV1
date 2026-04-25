'use client';

import { useRouter } from 'next/navigation';

interface BrokerConnectProps {
  language: 'no' | 'en';
}

export function BrokerConnect({ language }: BrokerConnectProps) {
  const router = useRouter();
  const content = {
    no: {
      title: 'Koble til Saxo Bank',
      subtitle: 'Koble din Saxo-konto til Apex Quantum for autonom handel',
      description: 'Apex Quantum bruker Saxo Banks offisielle OAuth-pålogging — du logger inn direkte hos Saxo og gir Apex Quantum tilgang til å handle på din konto. Vi ser aldri passordet ditt, og du kan trekke tilbake tilgangen når som helst fra Saxo-kontoen din.',
      stepsTitle: 'Slik gjør du det',
      steps: [
        {
          number: '1',
          title: 'Trykk "Koble til Saxo Bank" nedenfor',
          description: 'Du blir sendt til Saxos sikre påloggingsside.',
        },
        {
          number: '2',
          title: 'Logg inn med din Saxo-bruker',
          description: 'Bruk samme brukernavn og passord som du bruker på SaxoTraderGO.',
        },
        {
          number: '3',
          title: 'Godkjenn tilgang for Apex Quantum',
          description: 'Saxo viser deg nøyaktig hvilke rettigheter Apex Quantum får (lese portefølje, sende ordrer).',
        },
        {
          number: '4',
          title: 'Apex Quantum begynner autonom handel',
          description: 'Du sendes tilbake til dashbordet og 24/7-handleren starter umiddelbart.',
        },
      ],
      benefitsTitle: 'Når koblingen er ferdig, vil Apex Quantum kunne:',
      benefits: [
        'Se din portefølje i sanntid',
        'Sende kjøps- og salgsordrer autonomt',
        'Følge din risikoprofil og drawdown-grenser',
      ],
      connect: 'Koble til Saxo Bank',
    },
    en: {
      title: 'Connect to Saxo Bank',
      subtitle: 'Connect your Saxo account to Apex Quantum for autonomous trading',
      description: 'Apex Quantum uses Saxo Bank\'s official OAuth login — you sign in directly at Saxo and grant Apex Quantum permission to trade on your account. We never see your password, and you can revoke access at any time from your Saxo account.',
      stepsTitle: 'How it works',
      steps: [
        {
          number: '1',
          title: 'Click "Connect to Saxo Bank" below',
          description: 'You\'ll be redirected to Saxo\'s secure login page.',
        },
        {
          number: '2',
          title: 'Sign in with your Saxo credentials',
          description: 'Use the same username and password you use for SaxoTraderGO.',
        },
        {
          number: '3',
          title: 'Approve access for Apex Quantum',
          description: 'Saxo shows you exactly which permissions Apex Quantum receives (read portfolio, place orders).',
        },
        {
          number: '4',
          title: 'Apex Quantum starts autonomous trading',
          description: 'You\'re returned to the dashboard and the 24/7 trader begins immediately.',
        },
      ],
      benefitsTitle: 'Once connected, Apex Quantum will be able to:',
      benefits: [
        'View your portfolio in real-time',
        'Send buy and sell orders autonomously',
        'Follow your risk profile and drawdown limits',
      ],
      connect: 'Connect to Saxo Bank',
    },
  };

  const t = content[language];

  return (
    <section id="setup" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.title}</h2>
          <p className="text-muted-foreground text-lg">{t.subtitle}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 mb-8">
          <p className="text-muted-foreground mb-8">{t.description}</p>

          <h3 className="text-xl font-semibold mb-6">{t.stepsTitle}</h3>
          <div className="space-y-6 mb-8">
            {t.steps.map((step) => (
              <div key={step.number} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-semibold text-sm">
                  {step.number}
                </div>
                <div>
                  <h4 className="font-medium mb-1">{step.title}</h4>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-accent/10 border border-accent/20 rounded-xl p-6 mb-8">
            <h4 className="font-medium mb-3 text-accent">{t.benefitsTitle}</h4>
            <ul className="space-y-2">
              {t.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-accent flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <button
            type="button"
            onClick={() => router.push('/saxo-simulation')}
            className="w-full py-4 px-6 bg-accent text-accent-foreground font-semibold rounded-lg hover:bg-accent/90 transition-colors text-lg"
          >
            {t.connect}
          </button>
        </div>
      </div>
    </section>
  );
}
