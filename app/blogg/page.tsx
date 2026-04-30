'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Blogg',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    intro:
      'Snart kommer artikler fra Apex Quantum-teamet — om hvordan systemet vurderer markedet, hvilke signaler som driver porteføljen, og hvordan vi tester nye strategier mot historiske data.',
    soonTitle: 'Det blir spennende',
    soonBody:
      'Vi publiserer dybdeartikler om kvantitativ handel, AI-drevne signaler, risikostyring og maskinlæring. Følg oss på e-post — send "blogg" til post@apex-quantum.com og du får beskjed når den første artikkelen er ute.',
  },
  en: {
    title: 'Blog',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    intro:
      'Posts from the Apex Quantum team are coming soon — on how the system reads the market, which signals drive the portfolio, and how we test new strategies against historical data.',
    soonTitle: 'It is going to be good',
    soonBody:
      'We publish deep dives on quantitative trading, AI-driven signals, risk management and machine learning. Subscribe by email — send "blog" to post@apex-quantum.com and we will let you know when the first piece ships.',
  },
} as const;

export default function BloggPage() {
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
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.soonTitle}</h2>
                <p>{t.soonBody}</p>
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}
