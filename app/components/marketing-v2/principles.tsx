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
    eye: '02 · Plattformen',
    titlePre: 'Tre ting som ',
    titleEm:  'aldri',
    titlePost: ' fravikes.',
    sub: 'Alle Apex Quantum-produkter er bygget over de samme prinsippene — disse styrer hvordan koden er skrevet og hvordan kunden behandles.',
    items: [
      { n: 'I',   t: 'Du beholder kontrollen.',  d: 'Du velger megler. Du velger paper eller live. Du kan koble fra når som helst. Apex Quantum kobler seg til din egen Alpaca-konto — vi tar aldri imot dine midler, og vi flytter dem aldri.' },
      { n: 'II',  t: 'Sikkerhet er ikke en fotnote.', d: 'Alpaca API-nøkler lagres kryptert med AES-256-GCM, per bruker. Rate-limiting og DDoS-beskyttelse i kanten. Strukturert revisjons-logging på hver handling. Juridiske ansvarsfraskrivelser er inkludert, ikke gjemt.' },
      { n: 'III', t: 'Du ser hva motoren gjør.',  d: 'Live dashboard med porteføljeoversikt, handelslogg og performance-metrikker. Hver AI-anbefaling kommer med fullstendig begrunnelse. Ingen svart boks — du forstår, eller du forkaster.' },
    ],
  },
  en: {
    eye: '02 · The Platform',
    titlePre: 'Three things we ',
    titleEm:  'never',
    titlePost: ' bend.',
    sub: 'Every Apex Quantum product is built on the same principles — they govern how the code is written and how the customer is treated.',
    items: [
      { n: 'I',   t: 'You keep control.',             d: 'You pick the broker. You pick paper or live. You can disconnect at any time. Apex Quantum connects to your own Alpaca account — we never receive your funds, and we never move them.' },
      { n: 'II',  t: 'Security is not a footnote.',   d: 'Alpaca API keys are stored AES-256-GCM encrypted, per user. Rate-limiting and DDoS protection at the edge. Structured audit logging on every action. Legal disclaimers are included, not hidden.' },
      { n: 'III', t: 'You see what the engine does.', d: 'A live dashboard with portfolio overview, trade log and performance metrics. Every AI recommendation arrives with full reasoning. No black box — you understand it, or you reject it.' },
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
