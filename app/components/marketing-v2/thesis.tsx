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
    body: 'Blueprinten bak motoren ble utviklet over ett år — regler for hva som kjøpes, hvorfor, og når det selges — før første ordre ble sendt i mai 2026. Plus lærer deg modellen og leverer signaler. Max — den autonome motoren — kobler seg til din egen Alpaca-konto via krypterte API-nøkler. Vi tar aldri imot, oppbevarer eller flytter dine midler.',
    byline: 'Grunnleggeren, mai 2026',
  },
  en: {
    eye: '01 · What we build',
    titlePre: 'Machines that learn faster, ',
    titleEm:  'and trade with discipline',
    titlePost: '.',
    lede: 'Apex Quantum AS is a Norwegian technology company building autonomous trading systems for the US equity market. We believe machines that learn faster and trade with discipline can deliver better risk-adjusted returns than most human portfolio managers.',
    body: 'The blueprint behind the engine was developed over a year — rules for what is bought, why, and when it is sold — before the first order was placed in May 2026. Plus teaches you the model and delivers signals. Max — the autonomous engine — connects to your own Alpaca account via encrypted API keys. We never receive, hold or move your funds.',
    byline: 'The founder, May 2026',
  },
};

export function ThesisV2({ lang }: { lang: Lang }) {
  const t = THESIS_COPY[lang];
  return (
    <section id="thesis" className="band-parch" data-reveal>
      <div className="container">
        <div className="thesis">
          <div className="thesis-left">
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <h2>
              {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
            </h2>
          </div>
          <div className="thesis-right">
            {/* «Anfangen» — Fraunces drop cap i --aq-imperial (§8-02) */}
            <p className="lede">{t.lede}</p>
            <p>{t.body}</p>
            <span className="thesis-byline">{t.byline}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
