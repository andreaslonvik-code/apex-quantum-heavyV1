'use client';

import type { Lang } from '../marketing/types';

const PRINCIPLES_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  sub: string;
  items: Array<{ eye: string; n: string; t: string; d: string }>;
}> = {
  no: {
    eye: '02 · Plattformen',
    titlePre: 'Tre ting som ',
    titleEm:  'aldri',
    titlePost: ' fravikes.',
    sub: 'Alle Apex Quantum-produkter er bygget over de samme prinsippene — disse styrer hvordan koden er skrevet og hvordan kunden behandles.',
    items: [
      {
        eye: 'PRINSIPP 01 · KONTROLL',
        n: 'I',
        t: 'Du beholder kontrollen.',
        d: 'Motoren handler mot din egen Alpaca-konto via API-nøkler du selv kan trekke tilbake. Vi tar aldri imot, oppbevarer eller flytter dine midler. Du kan koble fra når som helst.',
      },
      {
        eye: 'PRINSIPP 02 · SIKKERHET',
        n: 'II',
        t: 'Sikkerhet er ikke en fotnote.',
        d: 'API-nøkler lagres kryptert med AES-256-GCM, per bruker. Hver handling skrives til strukturert revisjonslogg, og hver ordre logges med begrunnelse før den sendes.',
      },
      {
        eye: 'PRINSIPP 03 · INNSYN',
        n: 'III',
        t: 'Du ser hva motoren gjør.',
        d: 'Hvert signal publiseres med fullstendig begrunnelse og tidsstempel. Porteføljen, handelsloggen og beslutningene kan etterprøves på innsynssiden — ingen svart boks.',
      },
    ],
  },
  en: {
    eye: '02 · The Platform',
    titlePre: 'Three things we ',
    titleEm:  'never',
    titlePost: ' bend.',
    sub: 'Every Apex Quantum product is built on the same principles — they govern how the code is written and how the customer is treated.',
    items: [
      {
        eye: 'PRINCIPLE 01 · CONTROL',
        n: 'I',
        t: 'You keep control.',
        d: 'The engine trades against your own Alpaca account via API keys you can revoke yourself. We never receive, hold or move your funds. You can disconnect at any time.',
      },
      {
        eye: 'PRINCIPLE 02 · SECURITY',
        n: 'II',
        t: 'Security is not a footnote.',
        d: 'API keys are stored encrypted with AES-256-GCM, per user. Every action is written to a structured audit log, and every order is logged with its reasoning before it is sent.',
      },
      {
        eye: 'PRINCIPLE 03 · TRANSPARENCY',
        n: 'III',
        t: 'You see what the engine does.',
        d: 'Every signal is published with full reasoning and a timestamp. The portfolio, trade log and decisions can be verified on the transparency page — no black box.',
      },
    ],
  },
};

export function PrinciplesV2({ lang }: { lang: Lang }) {
  const t = PRINCIPLES_COPY[lang];
  return (
    <section id="principles" className="principles" data-reveal>
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
              <span className="principle-eye">{it.eye}</span>
              <span className="principle-num" aria-hidden>{it.n}.</span>
              <h3>{it.t}</h3>
              <p>{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
