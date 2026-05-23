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
    eye: '01 · Filosofien',
    titlePre: 'En blåkopi, ikke en ',
    titleEm:  'svart boks',
    titlePost: '.',
    lede: 'Apex Quantum er ikke en signalkanal eller en gambling-app. Det er en disiplinert handelsmotor — bygget på et år med forskning, kalibrert mot levende markedsdata, og gjennomsiktig der det betyr noe.',
    body: 'Vi tror på to ting som er upopulære i et marked som elsker hype. Først: at en seriøs investor fortjener å se hvordan modellen tenker — ikke bare hva den anbefaler. Dernest: at konsistent risikojustert avkastning, levert over tid, er mer verdt enn ett spektakulært kvartal. Plus gir deg motoren som læremester. Max lar den jobbe for deg.',
    byline: 'Apex Quantum AS · Oslo',
  },
  en: {
    eye: '01 · The Thesis',
    titlePre: 'A blueprint, not a ',
    titleEm:  'black box',
    titlePost: '.',
    lede: 'Apex Quantum is not a signal channel or a gambling app. It is a disciplined trading engine — built on a year of research, calibrated against live market data, and transparent where it matters.',
    body: 'We believe in two things that are unpopular in a market addicted to hype. First, that a serious investor deserves to see how the model thinks — not just what it recommends. Second, that consistent risk-adjusted returns, delivered over time, are worth more than one spectacular quarter. Plus gives you the engine as a tutor. Max lets it work for you.',
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
