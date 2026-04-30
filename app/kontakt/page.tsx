'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Kontakt',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    intro:
      'Vi svarer typisk innen 24 timer på hverdager. For tekniske spørsmål om Alpaca-integrasjon, kontosikkerhet eller fakturering, send en e-post med tydelig emnefelt så blir du kanalisert riktig.',
    emailTitle: 'E-post',
    emailBody: 'post@apex-quantum.com',
    addrTitle: 'Postadresse',
    addrBody: 'Apex Quantum AS · Org.nr 921 269 962 · Norge',
    pressTitle: 'Presse og partnerskap',
    pressBody:
      'Send forespørsel til post@apex-quantum.com med "Presse" eller "Partnerskap" i emnefeltet. Vi setter opp en samtale innen kort tid.',
  },
  en: {
    title: 'Contact',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    intro:
      'We typically respond within 24 hours on weekdays. For technical questions on the Alpaca integration, account security or billing, send an email with a clear subject line so we can route it.',
    emailTitle: 'Email',
    emailBody: 'post@apex-quantum.com',
    addrTitle: 'Postal address',
    addrBody: 'Apex Quantum AS · Org. no 921 269 962 · Norway',
    pressTitle: 'Press and partnerships',
    pressBody:
      'Send your request to post@apex-quantum.com with "Press" or "Partnership" in the subject. We will set up a call shortly.',
  },
} as const;

export default function KontaktPage() {
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
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.emailTitle}</h2>
                <p>
                  <a
                    href="mailto:post@apex-quantum.com"
                    style={{ color: 'var(--aq-cyan)', textDecoration: 'none' }}
                  >
                    {t.emailBody}
                  </a>
                </p>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.addrTitle}</h2>
                <p>{t.addrBody}</p>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.pressTitle}</h2>
                <p>{t.pressBody}</p>
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}
