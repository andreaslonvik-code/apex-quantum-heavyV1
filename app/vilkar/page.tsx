'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Vilkår',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '8. mai 2026',
    sections: [
      [
        '1. Avtaleparter',
        'Disse vilkårene gjelder mellom Apex Quantum AS, org.nr 921 269 962, Norge ("vi", "oss") og deg som registrert bruker av tjenesten på apex-quantum.com. Tjenesten er tilgjengelig globalt; norsk rett gjelder.',
      ],
      [
        '2. Tjenestene',
        'Apex Quantum tilbyr to produkter. Apex Quantum + er en lærings- og analyseplattform som genererer AI-drevne signaler, ukentlige rapporter og lar deg spørre AI om aksjer. Du tar selv alle investeringsbeslutninger og bruker din egen meglerkonto. Apex Quantum Max er en autonom trading-tjeneste som handler på din vegne via din egen Alpaca Trading-konto. Vi er en programvareleverandør, ikke en megler. Vi mottar, lagrer eller flytter aldri kundens midler.',
      ],
      [
        '3. Aldersgrense',
        'Du må være minst 18 år gammel og ha rettslig handleevne for å bruke tjenesten. Ved å registrere deg bekrefter du dette.',
      ],
      [
        '4. Pris og betaling — Apex Quantum +',
        'Plus koster 199 kr/måned inkludert merverdiavgift (eller tilsvarende i andre valutaer for utenlandske kunder). Betaling skjer på forskudd månedlig via Stripe. Det er ingen bindingstid — du kan avslutte når som helst, og tilgangen løper ut den måneden du allerede har betalt for. Avbestilling skjer via "Administrer abonnement"-knappen i dashbordet, som åpner Stripes kundeportal.',
      ],
      [
        '5. Pris og betaling — Apex Quantum Max',
        'Max koster 4 990 kr/måned inkludert merverdiavgift (≈ $499/måned for utenlandske kunder). Nye kunder får 30 dagers risikofri prøveperiode fra første betaling — avslutter du innenfor prøveperioden refunderes 100 % av første månedsavgift. Max er for tiden i lukket beta og krever særskilt invitasjon.',
      ],
      [
        '6. Angrerett',
        'For digitale tjenester gjelder normalt 14 dagers angrerett etter angrerettloven. Ved å starte abonnement og få umiddelbar tilgang til tjenesten samtykker du uttrykkelig til at leveringen påbegynnes innenfor angrefristen, og du erkjenner at angreretten dermed bortfaller når tjenesten er fullt levert. Du kan likevel avslutte abonnementet når som helst som beskrevet i punkt 4 og 5.',
      ],
      [
        '7. Innholdet er ikke individuell investeringsrådgivning',
        'Apex Quantum + leverer generell markedsanalyse, signaler og læringsinnhold. Innholdet er ikke individuell investeringsrådgivning eller investeringsanbefaling i regulatorisk forstand, og er ikke tilpasset din spesifikke økonomiske situasjon, mål eller risikotoleranse. Du tar alle investeringsbeslutninger selv. Apex Quantum AS er ikke en regulert verdipapirforetak under verdipapirhandelloven og driver ikke konsesjonspliktig virksomhet.',
      ],
      [
        '8. Ditt ansvar',
        'Du er ansvarlig for å holde påloggingen din sikker. For Max er du i tillegg ansvarlig for sikkerheten til dine Alpaca API-nøkler og for handlene som gjøres på din konto, inkludert eventuelle tap. Du må selv overholde skatte- og rapporteringsplikter for handelsaktiviteten din.',
      ],
      [
        '9. Risiko og ansvarsbegrensning',
        'Handel med verdipapirer innebærer betydelig risiko og kan medføre tap av kapital. Tidligere resultater er ikke en garanti for fremtidig avkastning. Vi gir ingen garantier for spesifikk avkastning, og vårt ansvar er begrenset til beløpet du har betalt for tjenesten de siste 12 månedene, så langt loven tillater. Vi er ikke ansvarlige for tap som følge av tredjepart (Stripe, Alpaca, Clerk, Vercel, xAI) sin nedetid eller feil.',
      ],
      [
        '10. Personvern',
        'Behandlingen av personopplysninger er beskrevet i personvernerklæringen, som utgjør en del av denne avtalen.',
      ],
      [
        '11. Endringer',
        'Vi kan endre vilkårene med 30 dagers skriftlig varsel via e-post. Vesentlige endringer som påvirker pris eller funksjonalitet gir deg rett til å avslutte abonnementet umiddelbart med refusjon for ubrukt periode.',
      ],
      [
        '12. Lovvalg og verneting',
        'Avtalen reguleres av norsk rett. Forbrukere kan henvende seg til Forbrukertilsynet og Forbrukerklageutvalget. Tvister søkes løst i minnelighet. Hvis det ikke lykkes, er Oslo tingrett verneting, dog slik at forbrukere alltid kan saksøke i sitt eget hjemverneting i tråd med ufravikelige forbrukerrettigheter.',
      ],
    ],
  },
  en: {
    title: 'Terms of service',
    updatedLabel: 'Last updated',
    updatedDate: 'May 8, 2026',
    sections: [
      [
        '1. The parties',
        'These terms apply between Apex Quantum AS, registration number 921 269 962, Norway ("we", "us") and you as a registered user at apex-quantum.com. The service is available globally; Norwegian law governs.',
      ],
      [
        '2. The services',
        'Apex Quantum offers two products. Apex Quantum + is a learning and analysis platform that generates AI-powered signals, weekly reports and lets you ask AI about stocks. You make all investment decisions yourself and use your own broker account. Apex Quantum Max is an autonomous trading service that executes trades on your behalf via your own Alpaca Trading account. We are a software vendor, not a broker. We never receive, hold or move customer funds.',
      ],
      [
        '3. Age',
        'You must be at least 18 years old and have legal capacity to use the service. By registering you confirm this.',
      ],
      [
        '4. Price and payment — Apex Quantum +',
        'Plus costs 199 NOK / month including VAT (or the equivalent in other currencies for international customers). Payment is monthly in advance via Stripe. There is no commitment period — cancel any time and access continues to the end of the month already paid for. Cancellation is done via the "Manage subscription" button in the dashboard, which opens the Stripe Customer Portal.',
      ],
      [
        '5. Price and payment — Apex Quantum Max',
        'Max costs 4,990 NOK / month including VAT (≈ $499/month for international customers). New customers receive a 30-day risk-free trial from first payment — cancel within the trial and the first month is fully refunded. Max is currently in closed beta and requires invitation.',
      ],
      [
        '6. Right of withdrawal',
        'Digital services normally carry a 14-day right of withdrawal under Norwegian consumer law. By starting a subscription and gaining immediate access, you expressly consent to performance beginning within the withdrawal period and acknowledge that the right of withdrawal lapses once the service has been fully delivered. You may still cancel the subscription at any time as described in sections 4 and 5.',
      ],
      [
        '7. Content is not individual investment advice',
        'Apex Quantum + provides general market analysis, signals and educational content. The content is not individual investment advice or an investment recommendation in the regulatory sense, and is not tailored to your specific financial situation, goals or risk tolerance. You make all investment decisions yourself. Apex Quantum AS is not a regulated investment firm under the Norwegian Securities Trading Act and does not conduct licensed activities.',
      ],
      [
        '8. Your responsibilities',
        'You are responsible for keeping your login secure. For Max, you are additionally responsible for the security of your Alpaca API keys and for the trades executed on your account, including any losses. You are responsible for tax and reporting obligations arising from trading activity.',
      ],
      [
        '9. Risk and limitation of liability',
        'Trading securities involves significant risk and can lead to loss of capital. Past performance is not a guarantee of future returns. We make no guarantee of specific returns, and our liability is limited, to the extent permitted by law, to the amount you have paid for the service in the preceding 12 months. We are not liable for losses arising from third-party (Stripe, Alpaca, Clerk, Vercel, xAI) downtime or errors.',
      ],
      [
        '10. Privacy',
        'Personal data processing is described in the privacy policy, which forms part of this agreement.',
      ],
      [
        '11. Changes',
        'We may amend these terms with 30 days written notice by email. Material changes affecting price or functionality give you the right to cancel immediately with a refund for any unused period.',
      ],
      [
        '12. Governing law and venue',
        'This agreement is governed by Norwegian law. Consumers may contact the Norwegian Consumer Authority and the Consumer Complaints Tribunal. Disputes are first sought resolved amicably. If unresolved, the venue is Oslo District Court, provided that consumers may always sue in their own home venue under mandatory consumer rights.',
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
