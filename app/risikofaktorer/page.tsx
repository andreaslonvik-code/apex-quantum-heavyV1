'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Risikofaktorer',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    intro:
      'Apex Quantum er et avansert handelsverktøy. Tjenesten kan tape penger. Les denne siden nøye før du kobler en konto med ekte midler.',
    sections: [
      [
        'Markedsrisiko',
        'Verdipapirer som handles via Alpaca er underlagt vanlig markedsrisiko. Aksjekurser kan falle raskt og betydelig. Det finnes ingen garanti mot tap av kapital, heller ikke gjennom AI-drevet beslutningsstøtte.',
      ],
      [
        'Modellrisiko',
        'AI- og signalmodellene kan ta feil. Modellene er basert på historiske data og kan ha skjevheter eller blindsoner som først kommer til syne under nye markedsforhold. Tidligere resultater er ingen garanti for fremtidig avkastning.',
      ],
      [
        'Operasjonell risiko',
        'Tjenesten avhenger av tredjeparter (Alpaca, Clerk, Supabase, Vercel, Grok). Avbrudd hos disse kan føre til at handler ikke utføres som forventet. Vi varsler om kjente hendelser via e-post, men kan ikke garantere 100 % oppetid.',
      ],
      [
        'Likviditetsrisiko',
        'Enkelte aksjer har lav likviditet. I urolige markeder kan spread mellom kjøps- og salgskurs øke betydelig, og det kan være vanskelig å gå ut av en posisjon til ønsket pris.',
      ],
      [
        'Earnings og hendelsesrisiko',
        'Kvartalsrapporter, makro-utgivelser og selskapshendelser kan skape store kursutslag mellom børsdager. Vi forsøker å begrense eksponering før kjente hendelser, men kan ikke utelukke pre-market gap som omgår stop-loss.',
      ],
      [
        'Valutarisiko',
        'Plattformen handler i amerikanske dollar. Hvis du måler avkastningen i norske kroner, vil USD/NOK-svingninger påvirke verdien av porteføljen din.',
      ],
      [
        'Regulatorisk risiko',
        'Lovgivning rundt automatisert handel og verdipapirformidling kan endre seg. Endringer kan kreve at vi tilpasser tjenesten eller begrenser visse funksjoner i enkelte jurisdiksjoner.',
      ],
      [
        'Cyber- og kontosikkerhet',
        'Selv om vi krypterer API-nøkler og bruker TLS overalt, kan kompromitterte enheter på din side eksponere kontoen din. Bruk sterk autentisering og en oppdatert nettleser.',
      ],
    ],
  },
  en: {
    title: 'Risk factors',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    intro:
      'Apex Quantum is an advanced trading tool. The service can lose money. Please read this page carefully before connecting a real-money account.',
    sections: [
      [
        'Market risk',
        'Securities traded via Alpaca are subject to ordinary market risk. Equity prices can fall fast and meaningfully. There is no guarantee against capital loss, not even through AI-driven decision support.',
      ],
      [
        'Model risk',
        'The AI and signal models can be wrong. They are based on historical data and may have biases or blind spots that only surface under new market regimes. Past performance is not a guarantee of future returns.',
      ],
      [
        'Operational risk',
        'The service depends on third parties (Alpaca, Clerk, Supabase, Vercel, Grok). Outages can cause trades to not execute as expected. We notify customers of known incidents by email but cannot guarantee 100% uptime.',
      ],
      [
        'Liquidity risk',
        'Some stocks are thinly traded. In volatile markets, the bid/ask spread can widen significantly and exiting a position at the desired price can be difficult.',
      ],
      [
        'Earnings and event risk',
        'Quarterly reports, macro releases and corporate events can produce large overnight gaps. We try to limit exposure ahead of scheduled events, but pre-market gaps that bypass stop-losses cannot be ruled out.',
      ],
      [
        'Currency risk',
        'The platform trades in US dollars. If you measure returns in Norwegian kroner, USD/NOK movements will affect the value of your portfolio.',
      ],
      [
        'Regulatory risk',
        'Rules around automated trading and securities can change. Changes may require us to adjust the service or limit certain features in particular jurisdictions.',
      ],
      [
        'Cyber and account security',
        'Even though we encrypt API keys and use TLS everywhere, a compromised device on your side can expose your account. Use strong authentication and an up-to-date browser.',
      ],
    ],
  },
} as const;

export default function RisikofaktorerPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <ArticleBody
            title={t.title}
            updatedLabel={t.updatedLabel}
            updatedDate={t.updatedDate}
            body={
              <>
                <p>{t.intro}</p>
                {t.sections.map(([h, body]) => (
                  <div key={h}>
                    <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{h}</h2>
                    <p>{body}</p>
                  </div>
                ))}
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}
