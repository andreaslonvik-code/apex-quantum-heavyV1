'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Vilkår',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    sections: [
      [
        '1. Avtaleparter',
        'Disse vilkårene gjelder mellom Apex Quantum AS, org.nr 921 269 962 ("vi", "oss") og deg som registrert bruker av tjenesten på apex-quantum.com.',
      ],
      [
        '2. Tjenesten',
        'Apex Quantum er en programvaretjeneste som analyserer markedsdata og kan utføre handler på din vegne via din egen Alpaca Trading-konto. Vi er en programvareleverandør, ikke en megler. Vi mottar, lagrer eller flytter aldri kundens midler.',
      ],
      [
        '3. Pris og betaling',
        'Abonnementet koster 4 990 kr/måned inkludert relevant moms, eller tilsvarende i USD ($499/måned) for utenlandske kunder. Betaling skjer på forskudd månedlig. Du kan avslutte abonnementet når som helst, og det vil løpe ut perioden du allerede har betalt for.',
      ],
      [
        '4. Prøveperiode',
        'Nye kunder får en risikofri prøveperiode på 30 dager fra første betaling. Avslutter du innenfor prøveperioden får du refundert 100 % av første månedsavgift.',
      ],
      [
        '5. Ditt ansvar',
        'Du er ansvarlig for å holde påloggingen din og dine Alpaca API-nøkler sikre. Du er ansvarlig for handlene som gjøres på din konto, inkludert eventuelle tap. Du må selv overholde skatte- og rapporteringsplikter for handelsaktiviteten.',
      ],
      [
        '6. Risiko og ansvarsbegrensning',
        'Handel med verdipapirer innebærer betydelig risiko. Tidligere resultater er ikke en garanti for fremtidig avkastning. Vi gir ingen garantier for spesifikk avkastning, og vårt ansvar er begrenset til beløpet du har betalt for tjenesten de siste 12 månedene, så langt loven tillater.',
      ],
      [
        '7. Endringer',
        'Vi kan endre vilkårene med 30 dagers skriftlig varsel. Vesentlige endringer som påvirker pris eller funksjonalitet gir deg rett til å avslutte abonnementet umiddelbart med refusjon for ubrukt periode.',
      ],
      [
        '8. Lovvalg og verneting',
        'Avtalen reguleres av norsk rett. Tvister søkes løst i minnelighet. Hvis det ikke lykkes, er Oslo tingrett verneting.',
      ],
    ],
  },
  en: {
    title: 'Terms of service',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    sections: [
      [
        '1. The parties',
        'These terms apply between Apex Quantum AS, registration number 921 269 962 ("we", "us") and you as a registered user of the service at apex-quantum.com.',
      ],
      [
        '2. The service',
        'Apex Quantum is a software service that analyses market data and can execute trades on your behalf via your own Alpaca Trading account. We are a software vendor, not a broker. We never receive, hold or move customer funds.',
      ],
      [
        '3. Price and payment',
        'The subscription costs 4 990 NOK / month including applicable VAT, or the USD equivalent ($499 / month) for international customers. Payment is monthly in advance. You may cancel at any time and your access continues until the end of the billing period you have already paid for.',
      ],
      [
        '4. Trial period',
        'New customers receive a 30-day risk-free trial from the first payment. If you cancel within the trial, your first month is refunded in full.',
      ],
      [
        '5. Your responsibilities',
        'You are responsible for keeping your login and Alpaca API keys secure. You are responsible for the trades executed on your account, including any losses. You are responsible for tax and reporting obligations arising from trading activity.',
      ],
      [
        '6. Risk and limitation of liability',
        'Trading securities involves significant risk. Past performance is not a guarantee of future returns. We make no guarantee of specific returns, and our liability is limited, to the extent permitted by law, to the amount you have paid for the service in the preceding 12 months.',
      ],
      [
        '7. Changes',
        'We may amend these terms with 30 days written notice. Material changes affecting price or functionality give you the right to cancel immediately with a refund for any unused period.',
      ],
      [
        '8. Governing law and venue',
        'This agreement is governed by Norwegian law. Disputes are first sought resolved amicably. If unresolved, the venue is Oslo District Court.',
      ],
    ],
  },
} as const;

export default function VilkarPage() {
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
