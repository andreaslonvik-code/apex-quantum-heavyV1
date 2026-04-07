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
      subtitle: 'Slik kobler du Apex Quantum til din Saxo Bank-konto for autonom handel',
      description: 'Apex Quantum kan handle autonomt for deg gjennom Saxo Bank når du gir tillatelse. Dette krever at du kobler kontoen din én gang.',
      stepsTitle: 'Steg-for-steg veiledning',
      steps: [
        {
          number: '1',
          title: 'Logg inn på din Saxo Bank-konto',
          description: 'Gå til Saxo Developer Portal på developers.saxobank.com',
        },
        {
          number: '2',
          title: 'Opprett en ny App',
          description: 'Trykk "Create New App", gi den navnet Apex Quantum, og velg Trading API og Portfolio API',
        },
        {
          number: '3',
          title: 'Kopier dine API-nøkler',
          description: 'Du får en Client ID og Client Secret',
        },
        {
          number: '4',
          title: 'Koble kontoen i Apex Quantum',
          description: 'Gå til "Koble Broker" nedenfor, lim inn Client ID og Client Secret, og godkjenn tilgangen',
        },
      ],
      benefitsTitle: 'Når koblingen er ferdig, vil Apex Quantum kunne:',
      benefits: [
        'Se din portefølje i sanntid',
        'Sende kjøps- og salgsordrer autonomt',
        'Følge din risikoprofil og drawdown-grenser',
      ],
      formTitle: 'Koble Broker',
      clientId: 'Client ID',
      clientSecret: 'Client Secret',
      connect: 'Koble til Saxo Bank',
      placeholder: {
        clientId: 'Lim inn din Client ID',
        clientSecret: 'Lim inn din Client Secret',
      },
    },
    en: {
      title: 'Connect to Saxo Bank',
      subtitle: 'How to connect Apex Quantum to your Saxo Bank account for autonomous trading',
      description: 'Apex Quantum can trade autonomously for you through Saxo Bank when you grant permission. This requires connecting your account once.',
      stepsTitle: 'Step-by-step guide',
      steps: [
        {
          number: '1',
          title: 'Log in to your Saxo Bank account',
          description: 'Go to Saxo Developer Portal at developers.saxobank.com',
        },
        {
          number: '2',
          title: 'Create a new App',
          description: 'Click "Create New App", name it Apex Quantum, and select Trading API and Portfolio API',
        },
        {
          number: '3',
          title: 'Copy your API keys',
          description: 'You will receive a Client ID and Client Secret',
        },
        {
          number: '4',
          title: 'Connect the account in Apex Quantum',
          description: 'Go to "Connect Broker" below, paste your Client ID and Client Secret, and approve access',
        },
      ],
      benefitsTitle: 'Once connected, Apex Quantum will be able to:',
      benefits: [
        'View your portfolio in real-time',
        'Send buy and sell orders autonomously',
        'Follow your risk profile and drawdown limits',
      ],
      formTitle: 'Connect Broker',
      clientId: 'Client ID',
      clientSecret: 'Client Secret',
      connect: 'Connect to Saxo Bank',
      placeholder: {
        clientId: 'Paste your Client ID',
        clientSecret: 'Paste your Client Secret',
      },
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

        <div className="bg-card border border-border rounded-2xl p-8">
          <h3 className="text-xl font-semibold mb-6">{t.formTitle}</h3>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-sm font-medium mb-2">{t.clientId}</label>
              <input
                type="text"
                placeholder={t.placeholder.clientId}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t.clientSecret}</label>
              <input
                type="password"
                placeholder={t.placeholder.clientSecret}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => router.push('/saxo-simulation')}
              className="w-full py-3 px-6 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              {t.connect}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
