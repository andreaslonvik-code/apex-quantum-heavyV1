'use client';

import type { Lang } from '../marketing/types';

const PRINCIPLES_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  sub: string;
  items: Array<{ n: string; t: string; d: string }>;
}> = {
  no: {
    eye: '02 · Prinsipper',
    titlePre: 'Tre ting vi ',
    titleEm:  'aldri',
    titlePost: ' fraviker.',
    sub: 'Disse styrer hver linje kode i blåkopien, hver feature på siden, og hver anbefaling motoren gir.',
    items: [
      { n: 'I',   t: 'Vis motoren.',           d: 'Modellens resonnement er aldri skjult. Hvert signal kommer med begrunnelse, sannsynlighet, og hvilke datapunkter som var avgjørende. Du forstår — eller du forkaster.' },
      { n: 'II',  t: 'Disiplin slår overbevisning.', d: 'Vi optimerer for risikojustert avkastning over en syklus, ikke for spektakulære måneder. Sharpe over storytelling. Maksimal drawdown er en hard grense, ikke en fotnote.' },
      { n: 'III', t: 'Renter, ikke spekulasjon.', d: 'Apex Quantum er bygget for å holdes i år, ikke i uker. Posisjoner skaleres. Avkastning realiseres. Konto-grunnlaget vokser — og motoren komponerer videre.' },
    ],
  },
  en: {
    eye: '02 · Principles',
    titlePre: 'Three things we ',
    titleEm:  'never',
    titlePost: ' bend.',
    sub: 'These govern every line of code in the blueprint, every feature on the page, and every recommendation the engine produces.',
    items: [
      { n: 'I',   t: 'Show the engine.',           d: 'The model’s reasoning is never hidden. Every signal arrives with a rationale, a probability, and the data points that mattered. You understand it — or you reject it.' },
      { n: 'II',  t: 'Discipline beats conviction.', d: 'We optimise for risk-adjusted return over a full cycle, not spectacular months. Sharpe over storytelling. Max drawdown is a hard limit, not a footnote.' },
      { n: 'III', t: 'Compounding, not speculation.', d: 'Apex Quantum is built to be held for years, not weeks. Positions scale. Returns are realised. The base grows — and the engine keeps compounding.' },
    ],
  },
};

export function PrinciplesV2({ lang }: { lang: Lang }) {
  const t = PRINCIPLES_COPY[lang];
  return (
    <section id="principles" className="principles">
      <div className="container">
        <div className="principles-head">
          <div>
            <span className="eyebrow cy"><span className="rule" />{t.eye}</span>
            <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
          </div>
          <p>{t.sub}</p>
        </div>
        <div className="principles-grid">
          {t.items.map((it) => (
            <div key={it.n} className="principle">
              <span className="principle-num">{it.n}.</span>
              <h3>{it.t}</h3>
              <p>{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
