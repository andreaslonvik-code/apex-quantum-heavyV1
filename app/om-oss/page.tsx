'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COPY = {
  no: {
    title: 'Om Apex Quantum',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    intro:
      'Apex Quantum AS er et norsk teknologiselskap som bygger autonome handelssystemer for det amerikanske aksjemarkedet. Vi tror at maskiner som lærer raskere og handler disiplinert kan levere bedre risikojustert avkastning enn de fleste menneskelige forvaltere.',
    storyTitle: 'Bakgrunn',
    story:
      'Apex Quantum ble startet for å gi privatkunder tilgang til den samme typen kvantitative strategier som tidligere bare var tilgjengelig for hedgefond og proprietære handelsbord. Plattformen kobler seg til kundens egen Alpaca-konto via krypterte API-nøkler — vi tar aldri i mot, oppbevarer eller flytter kundens midler.',
    teamTitle: 'Teamet',
    team:
      'Selskapet drives av et lite team med bakgrunn fra programvareutvikling, AI-forskning og kvantitativ trading. Vi sitter i Norge, og har valgt åpne broker-API-er fremfor eksklusive avtaler, slik at kunden alltid kan koble fra og trekke ut midler uten innblanding fra oss.',
    contactTitle: 'Kontakt',
    contactBody:
      'Apex Quantum AS · Org.nr 921 269 962 · post@apex-quantum.com',
  },
  en: {
    title: 'About Apex Quantum',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    intro:
      'Apex Quantum AS is a Norwegian technology company building autonomous trading systems for the US equity market. We believe machines that learn faster and trade with discipline can deliver better risk-adjusted returns than most human portfolio managers.',
    storyTitle: 'Background',
    story:
      'Apex Quantum was founded to give retail customers access to the kinds of quantitative strategies historically reserved for hedge funds and proprietary trading desks. The platform connects to the customer\'s own Alpaca account via encrypted API keys — we never receive, hold or move customer funds.',
    teamTitle: 'The team',
    team:
      'The company is run by a small team with backgrounds in software engineering, AI research and quantitative trading. We are based in Norway and chose open broker APIs over exclusive deals so that the customer can always disconnect and withdraw funds without our involvement.',
    contactTitle: 'Contact',
    contactBody:
      'Apex Quantum AS · Org. no 921 269 962 · post@apex-quantum.com',
  },
} as const;

export default function OmOssPage() {
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
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.storyTitle}</h2>
                <p>{t.story}</p>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.teamTitle}</h2>
                <p>{t.team}</p>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.contactTitle}</h2>
                <p>{t.contactBody}</p>
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}
