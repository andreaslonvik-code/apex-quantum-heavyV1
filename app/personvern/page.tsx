'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Personvernerklæring',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    sections: [
      [
        'Behandlingsansvarlig',
        'Apex Quantum AS, org.nr 921 269 962, er behandlingsansvarlig for personopplysningene som samles inn gjennom apex-quantum.com og det tilhørende dashbordet. Du kan kontakte oss på post@apex-quantum.com.',
      ],
      [
        'Hvilke opplysninger vi samler inn',
        'Vi samler inn navn, e-postadresse og pålogging via Clerk. Vi lagrer dine Alpaca API-nøkler kryptert med AES-256-GCM. Vi logger tekniske data som IP, nettleser og tidspunkt for forespørsler for å forhindre misbruk og diagnostisere feil.',
      ],
      [
        'Behandlingsgrunnlag',
        'Behandlingen er basert på avtalen mellom deg og Apex Quantum AS (GDPR art. 6 nr. 1 b) og våre berettigede interesser i å sikre tjenesten (art. 6 nr. 1 f). Markedsføring sendes kun ved samtykke (art. 6 nr. 1 a).',
      ],
      [
        'Lagringstid',
        'Vi lagrer kontodata så lenge du har en aktiv konto, og inntil 12 måneder etter avslutning. Faktureringsdata oppbevares så lenge regnskapsloven krever (5 år). Logger slettes etter 90 dager med mindre de er knyttet til en sikkerhetshendelse.',
      ],
      [
        'Tredjeparter',
        'Vi bruker Clerk (autentisering), Supabase (database), Alpaca (megler-API), Vercel (hosting), og e-postleverandør for service-meldinger. Disse er databehandlere og er underlagt egne avtaler med oss.',
      ],
      [
        'Dine rettigheter',
        'Du har rett til innsyn, retting, sletting og dataportabilitet. Du kan klage til Datatilsynet. Send forespørsler til post@apex-quantum.com og vi svarer innen 30 dager.',
      ],
      [
        'Sikkerhet',
        'Sensitive data lagres kryptert i hvile (AES-256-GCM) og overføres kryptert (TLS 1.3). Vi mottar aldri kundens midler — handel skjer direkte på din egen Alpaca-konto.',
      ],
    ],
  },
  en: {
    title: 'Privacy policy',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    sections: [
      [
        'Data controller',
        'Apex Quantum AS, registration number 921 269 962, is the data controller for personal data collected through apex-quantum.com and its dashboard. You can reach us at post@apex-quantum.com.',
      ],
      [
        'Information we collect',
        'We collect your name, email address and authentication via Clerk. We store your Alpaca API keys encrypted with AES-256-GCM. We log technical data such as IP, browser and request time to prevent abuse and diagnose errors.',
      ],
      [
        'Legal basis',
        'Processing is based on the agreement between you and Apex Quantum AS (GDPR Art. 6(1)(b)) and our legitimate interest in securing the service (Art. 6(1)(f)). Marketing emails are sent only with consent (Art. 6(1)(a)).',
      ],
      [
        'Retention',
        'We retain account data while your account is active and for up to 12 months after termination. Billing records are kept for the 5 years required by Norwegian accounting law. Logs are deleted after 90 days unless tied to a security incident.',
      ],
      [
        'Third parties',
        'We use Clerk (authentication), Supabase (database), Alpaca (broker API), Vercel (hosting), and an email provider for service messages. They act as data processors under separate agreements with us.',
      ],
      [
        'Your rights',
        'You have the right to access, rectify, delete and port your data. You may also lodge a complaint with the Norwegian Data Protection Authority. Send requests to post@apex-quantum.com and we will respond within 30 days.',
      ],
      [
        'Security',
        'Sensitive data is encrypted at rest (AES-256-GCM) and in transit (TLS 1.3). We never receive customer funds — all trading happens directly on your own Alpaca account.',
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
