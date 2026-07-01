'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Cookies',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '8. mai 2026',
    intro:
      'Apex Quantum bruker informasjonskapsler ("cookies") for å holde deg pålogget, sikre tjenesten og forstå bruken av nettstedet. Denne siden forklarer hvilke kapsler vi bruker og hvorfor.',
    sections: [
      [
        'Strengt nødvendige',
        'Disse er nødvendige for at tjenesten skal fungere. De håndterer pålogging via Clerk, sesjonshåndtering og beskytter mot CSRF-angrep. Stripe setter også egne cookies under betalingsflyten (kun på checkout.stripe.com og billing.stripe.com) for svindelforebygging. Du kan ikke skru disse av uten å miste tilgangen til kontoen din eller fullføre betaling.',
      ],
      [
        'Funksjonelle',
        'Brukes til å huske preferanser som språk (NO/EN). Disse settes når du aktivt endrer en innstilling.',
      ],
      [
        'Statistikk',
        'Vi bruker enkel, anonym statistikk for å forstå hvilke deler av nettstedet folk faktisk bruker. Dataene knyttes ikke til deg som person og deles ikke med tredjeparter for markedsføring.',
      ],
      [
        'Slik kontrollerer du dem',
        'Du kan slette eller blokkere informasjonskapsler i nettleseren din. Hvis du blokkerer strengt nødvendige cookies, kan du ikke logge inn. Vi setter aldri sporings-cookies fra annonsenettverk.',
      ],
    ],
  },
  en: {
    title: 'Cookies',
    updatedLabel: 'Last updated',
    updatedDate: 'May 8, 2026',
    intro:
      'Apex Quantum uses cookies to keep you signed in, secure the service, and understand how the site is used. This page explains which cookies we set and why.',
    sections: [
      [
        'Strictly necessary',
        'Required for the service to function. They handle Clerk authentication, session management and protect against CSRF. Stripe also sets its own cookies during the payment flow (only on checkout.stripe.com and billing.stripe.com) for fraud prevention. You cannot disable these without losing access to your account or being unable to complete payment.',
      ],
      [
        'Functional',
        'Used to remember preferences such as language (NO/EN). These are set when you actively change a setting.',
      ],
      [
        'Statistics',
        'We use simple, anonymous statistics to understand which parts of the site are actually used. The data is not tied to you personally and is not shared with third parties for marketing.',
      ],
      [
        'How to control them',
        'You can delete or block cookies in your browser. If you block strictly necessary cookies, you cannot sign in. We never set tracking cookies from advertising networks.',
      ],
    ],
  },
} as const;

export default function CookiesPage() {
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
                    <h2>{h}</h2>
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
