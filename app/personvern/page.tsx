'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Personvernerklæring',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '8. mai 2026',
    sections: [
      [
        'Behandlingsansvarlig',
        'Apex Quantum AS, org.nr 921 269 962, Norge, er behandlingsansvarlig for personopplysningene som samles inn gjennom apex-quantum.com og det tilhørende dashbordet. Du kan kontakte oss på post@apex-quantum.com.',
      ],
      [
        'Hvilke opplysninger vi samler inn',
        'Konto: navn, e-postadresse og pålogging via Clerk. Plus-abonnement: abonnementsstatus, kunde-ID hos Stripe og periodens utløp lagres som metadata på brukeren din. Max: dine Alpaca API-nøkler lagres kryptert med AES-256-GCM. Bruksdata: spørsmål du sender til AI-en, hvilke aksjer du markerer som eid (lokalt i nettleseren), og tekniske logger (IP, nettleser, tidspunkt) for å forhindre misbruk og diagnostisere feil.',
      ],
      [
        'Behandlingsgrunnlag',
        'Behandlingen er basert på avtalen mellom deg og Apex Quantum AS (GDPR art. 6 nr. 1 b) og våre berettigede interesser i å sikre tjenesten (art. 6 nr. 1 f). Markedsføring sendes kun ved samtykke (art. 6 nr. 1 a). Bokføringsdata oppbevares som rettslig forpliktelse etter regnskapsloven (art. 6 nr. 1 c).',
      ],
      [
        'Lagringstid',
        'Kontodata lagres så lenge du har en aktiv konto, og inntil 12 måneder etter avslutning. Faktureringsdata oppbevares i 5 år som påkrevd av bokføringsloven. Logger slettes etter 90 dager med mindre de er knyttet til en sikkerhetshendelse. AI-spørringer lagres ikke permanent hos oss; xAI kan oppbevare dem i tråd med deres eget personvern.',
      ],
      [
        'Databehandlere',
        'Vi bruker følgende databehandlere — alle er underlagt egne databehandleravtaler med oss og overholder GDPR: Clerk (autentisering, USA — EU-US Data Privacy Framework), Supabase (database, EU-region), Vercel (hosting, EU-region for europeiske brukere), Stripe (betaling, EU/Irland som behandlingsansvarlig for kortdata), xAI (AI-modell Grok for signaler og analyser, USA), Alpaca (megler-API for Max, USA), og e-postleverandør for service-meldinger. Vi mottar aldri kortinformasjon — Stripe håndterer alle betalinger direkte.',
      ],
      [
        'Overføring til tredjeland',
        'Enkelte databehandlere er lokalisert utenfor EØS (Clerk, Stripe-mor, xAI, Alpaca). Overføringen skjer på grunnlag av EU-US Data Privacy Framework og/eller EUs standardkontraktklausuler (SCC) der relevant.',
      ],
      [
        'Dine rettigheter',
        'Du har rett til innsyn, retting, sletting, dataportabilitet og begrensning av behandling. Du kan trekke samtykker tilbake når som helst. Du kan klage til Datatilsynet (www.datatilsynet.no). Send forespørsler til post@apex-quantum.com og vi svarer innen 30 dager.',
      ],
      [
        'Sikkerhet',
        'Sensitive data lagres kryptert i hvile (AES-256-GCM for Alpaca-nøkler) og overføres kryptert (TLS 1.3). Vi mottar aldri kundens midler — handel skjer direkte på din egen meglerkonto, og betaling håndteres av Stripe. Webhook-signaturer fra Stripe verifiseres kryptografisk.',
      ],
      [
        'Bruk av AI',
        'Apex Quantum + bruker xAI Grok for å generere signaler og svare på spørsmål om aksjer. Spørsmålene du stiller sendes til xAI for prosessering. Vi sender ingen identifiserende kundedata til xAI utover selve spørsmålet og en ticker-kode. Du blir alltid informert om at du interagerer med AI.',
      ],
    ],
  },
  en: {
    title: 'Privacy policy',
    updatedLabel: 'Last updated',
    updatedDate: 'May 8, 2026',
    sections: [
      [
        'Data controller',
        'Apex Quantum AS, registration number 921 269 962, Norway, is the data controller for personal data collected through apex-quantum.com and its dashboard. Reach us at post@apex-quantum.com.',
      ],
      [
        'Information we collect',
        'Account: name, email and authentication via Clerk. Plus subscription: subscription status, Stripe customer ID and period end stored as user metadata. Max: Alpaca API keys stored encrypted (AES-256-GCM). Usage: AI prompts you send, tickers you mark as owned (local to your browser), and technical logs (IP, browser, timestamp) to prevent abuse and diagnose errors.',
      ],
      [
        'Legal basis',
        'Processing is based on the agreement between you and Apex Quantum AS (GDPR Art. 6(1)(b)) and our legitimate interest in securing the service (Art. 6(1)(f)). Marketing is sent only on consent (Art. 6(1)(a)). Accounting records are kept under legal obligation (Art. 6(1)(c)).',
      ],
      [
        'Retention',
        'Account data is retained while your account is active and for up to 12 months after termination. Billing records are kept for the 5 years required by Norwegian accounting law. Logs are deleted after 90 days unless tied to a security incident. We do not permanently store AI prompts; xAI may retain them per their own privacy policy.',
      ],
      [
        'Data processors',
        'We use the following processors — each under a separate data processing agreement and GDPR-compliant: Clerk (authentication, US — EU-US Data Privacy Framework), Supabase (database, EU region), Vercel (hosting, EU region for European users), Stripe (payments, EU/Ireland as controller for card data), xAI (AI model Grok for signals and analysis, US), Alpaca (broker API for Max, US), and an email provider for service messages. We never receive card information — Stripe processes all payments directly.',
      ],
      [
        'Transfers outside the EEA',
        'Some processors are located outside the EEA (Clerk, Stripe parent, xAI, Alpaca). Transfers rely on the EU-US Data Privacy Framework and/or EU Standard Contractual Clauses (SCCs) as applicable.',
      ],
      [
        'Your rights',
        'You have the right to access, rectify, delete, port and restrict processing of your data. You may withdraw consent at any time. You may also lodge a complaint with the Norwegian Data Protection Authority (datatilsynet.no). Send requests to post@apex-quantum.com — we respond within 30 days.',
      ],
      [
        'Security',
        'Sensitive data is encrypted at rest (AES-256-GCM for Alpaca keys) and in transit (TLS 1.3). We never receive customer funds — trading happens directly on your own broker account, and payments are processed by Stripe. Stripe webhook signatures are cryptographically verified.',
      ],
      [
        'Use of AI',
        'Apex Quantum + uses xAI Grok to generate signals and answer questions about stocks. Your prompts are sent to xAI for processing. We do not send identifying customer data to xAI beyond the prompt itself and a ticker symbol. You are always informed when you are interacting with AI.',
      ],
    ],
  },
} as const;

export default function PersonvernPage() {
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
