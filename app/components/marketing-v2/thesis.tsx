'use client';

import type { Lang } from '../marketing/types';

const THESIS_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  lede: string;
  body: string;
  byline: string;
}> = {
  no: {
    eye: '01 · Hva vi bygger',
    titlePre: 'Maskiner som lærer raskere, ',
    titleEm:  'og handler disiplinert',
    titlePost: '.',
    lede: 'Apex Quantum AS er et norsk teknologiselskap som bygger autonome handelssystemer for det amerikanske aksjemarkedet. Vi tror at maskiner som lærer raskere og handler disiplinert kan levere bedre risikojustert avkastning enn de fleste menneskelige forvaltere.',
    body: 'Plattformen ble bygget for å gi privatkunder tilgang til de samme kvantitative strategiene som tidligere bare var tilgjengelige for hedgefond og proprietære handelsbord. Plus lærer deg modellen og leverer signaler. Max — den autonome motoren — kobler seg til din egen Alpaca-konto via krypterte API-nøkler. Vi tar aldri i mot, oppbevarer eller flytter dine midler.',
    byline: 'Apex Quantum AS · Oslo',
  },
  en: {
    eye: '01 · What we build',
    titlePre: 'Machines that learn faster, ',
    titleEm:  'and trade with discipline',
    titlePost: '.',
    lede: 'Apex Quantum AS is a Norwegian technology company building autonomous trading systems for the US equity market. We believe machines that learn faster and trade with discipline can deliver better risk-adjusted returns than most human portfolio managers.',
    body: 'The platform was built to give retail customers access to the kinds of quantitative strategies historically reserved for hedge funds and proprietary trading desks. Plus teaches you the model and delivers signals. Max — the autonomous engine — connects to your own Alpaca account via encrypted API keys. We never receive, hold or move your funds.',
    byline: 'Apex Quantum AS · Oslo',
  },
};

export function ThesisV2({ lang }: { lang: Lang }) {
  const t = THESIS_COPY[lang];
  return (
    <section id="thesis" className="band-parch">
      <div className="container">
        <div className="thesis">
          <div className="thesis-left">
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <h2>
              {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
            </h2>
          </div>
          <div className="thesis-right">
            <p className="lede">{t.lede}</p>
            <p>{t.body}</p>
            <span className="thesis-byline">{t.byline}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
