'use client';

import { useRouter } from 'next/navigation';

interface BrokerConnectProps {
  language: 'no' | 'en';
}

export function BrokerConnect({ language }: BrokerConnectProps) {
  const router = useRouter();
  const content = {
    no: {
      title: 'Koble til Alpaca',
      subtitle: 'Lim inn dine Alpaca API-nøkler og start autonom handel',
      description:
        'Apex Quantum bruker Alpacas offisielle Trading API. Du kobler til ved å lime inn dine egne API-nøkler — Apex Quantum lagrer dem kryptert (AES-256-GCM) og bruker dem kun til handel på din konto. Du kan trekke tilbake tilgangen når som helst ved å slette nøkkelen i Alpaca-dashbordet.',
      stepsTitle: 'Slik gjør du det',
      steps: [
        {
          number: '1',
          title: 'Opprett en Alpaca-konto',
          description:
            'Registrer deg på app.alpaca.markets. Du kan velge Paper Trading (virtuelle penger) eller Live (ekte penger).',
        },
        {
          number: '2',
          title: 'Generer API-nøkler',
          description:
            'Gå til "Your API Keys" i Alpaca-dashbordet og opprett et nytt nøkkelpar (Key ID + Secret).',
        },
        {
          number: '3',
          title: 'Lim inn nøklene i Apex Quantum',
          description:
            'Velg Paper eller Live, lim inn nøklene, og trykk "Koble til". Vi validerer mot Alpaca og lagrer kryptert.',
        },
        {
          number: '4',
          title: 'Apex Quantum begynner autonom handel',
          description: 'Du sendes tilbake til dashbordet og 24/7-handleren starter umiddelbart.',
        },
      ],
      benefitsTitle: 'Når koblingen er ferdig, vil Apex Quantum kunne:',
      benefits: [
        'Se din portefølje og kontantbalanse i sanntid',
        'Sende kjøps- og salgsordrer autonomt mot Alpaca',
        'Følge din risikoprofil og drawdown-grenser',
      ],
      connect: 'Koble til Alpaca',
    },
    en: {
      title: 'Connect to Alpaca',
      subtitle: 'Paste your Alpaca API keys and start autonomous trading',
      description:
        'Apex Quantum uses the official Alpaca Trading API. You connect by pasting your own API keys — Apex Quantum stores them encrypted (AES-256-GCM) and only uses them to trade on your account. You can revoke access at any time by deleting the key inside the Alpaca dashboard.',
      stepsTitle: 'How it works',
      steps: [
        {
          number: '1',
          title: 'Create an Alpaca account',
          description:
            'Sign up at app.alpaca.markets. You can choose Paper Trading (virtual funds) or Live (real money).',
        },
        {
          number: '2',
          title: 'Generate API keys',
          description:
            'Go to "Your API Keys" inside the Alpaca dashboard and create a new key pair (Key ID + Secret).',
        },
        {
          number: '3',
          title: 'Paste the keys into Apex Quantum',
          description:
            'Choose Paper or Live, paste the keys, and click "Connect". We validate against Alpaca and store them encrypted.',
        },
        {
          number: '4',
          title: 'Apex Quantum starts autonomous trading',
          description: "You're returned to the dashboard and the 24/7 trader begins immediately.",
        },
      ],
      benefitsTitle: 'Once connected, Apex Quantum will be able to:',
      benefits: [
        'View your portfolio and cash balance in real-time',
        'Send buy and sell orders autonomously via Alpaca',
        'Follow your risk profile and drawdown limits',
      ],
      connect: 'Connect to Alpaca',
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
            onClick={() => router.push('/connect-alpaca')}
            className="w-full py-4 px-6 bg-accent text-accent-foreground font-semibold rounded-lg hover:bg-accent/90 transition-colors text-lg"
          >
            {t.connect}
          </button>
        </div>
      </div>
    </section>
  );
}
