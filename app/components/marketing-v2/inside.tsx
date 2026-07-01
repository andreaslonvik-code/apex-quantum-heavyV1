'use client';

import { Fragment } from 'react';
import type { Lang } from '../marketing/types';

type Part = string | { em: string } | { sym: string } | { up: string } | { dn: string };

const INSIDE_COPY: Record<Lang, {
  eye: string;
  exampleTag: string;
  quote: Part[];
  cite: string;
  steps: Array<{ tag: [string, string]; parts: Part[] }>;
}> = {
  no: {
    eye: '05 · Inni motoren',
    exampleTag: 'EKSEMPEL FRA LOGGEN · PAPER',
    quote: ['Hver anbefaling kommer med ', { em: 'fullstendig begrunnelse' }, '. Ingen svart boks, ingen ', { em: 'stol på oss' }, '.'],
    cite: 'Apex Quantum + · daglige signaler med begrunnelse',
    steps: [
      { tag: ['SIGNAL',       'utløst'], parts: ['Modellen flagger ', { sym: 'NVDA' }, ' for posisjon. Forslått størrelse 1,2 % av portefølje, stop −1,8 %.'] },
      { tag: ['BEGRUNNELSE',  'fullt synlig'], parts: ['Akkumulasjon over fire dager, RSI 58, momentum reagerer på sektorrotasjon mot halvledere. Datapunktene som veide tyngst er listet med signalet.'] },
      { tag: ['UTFØRELSE',    'via Alpaca'], parts: ['Max plasserer ordren mot din Alpaca-konto. Du kan se hver handling i live cockpiten — eller skru av motoren med ', { sym: 'kill switch' }, '.'] },
      { tag: ['REVURDERING',  'kontinuerlig'], parts: ['Modellen revurderer hver posisjon. Når begrunnelsen ikke lenger holder, lukkes den — og du ser hvorfor.'] },
    ],
  },
  en: {
    eye: '05 · Inside the engine',
    exampleTag: 'EXAMPLE FROM THE LOG · PAPER',
    quote: ['Every recommendation arrives with ', { em: 'full reasoning' }, '. No black box, no ', { em: 'trust us' }, '.'],
    cite: 'Apex Quantum + · daily signals with reasoning',
    steps: [
      { tag: ['SIGNAL',    'triggered'], parts: ['The model flags ', { sym: 'NVDA' }, ' for a position. Suggested size 1.2 % of portfolio, stop −1.8 %.'] },
      { tag: ['RATIONALE', 'fully visible'], parts: ['Four-day accumulation, RSI 58, momentum responds to sector rotation into semis. The data points that mattered most are listed alongside the signal.'] },
      { tag: ['EXECUTION', 'via Alpaca'], parts: ['Max places the order against your Alpaca account. You see every action in the live cockpit — or shut the engine off with the ', { sym: 'kill switch' }, '.'] },
      { tag: ['RE-EVAL',   'continuous'], parts: ['The model reassesses every position. When the rationale no longer holds, it closes — and you see why.'] },
    ],
  },
};

function renderParts(parts: Part[]) {
  return parts.map((p, i) => {
    if (typeof p === 'string') return <Fragment key={i}>{p}</Fragment>;
    if ('em' in p)  return <em key={i}>{p.em}</em>;
    if ('sym' in p) return <span key={i} className="symbol">{p.sym}</span>;
    if ('up' in p)  return <span key={i} className="up">{p.up}</span>;
    if ('dn' in p)  return <span key={i} className="dn">{p.dn}</span>;
    return null;
  });
}

export function InsideV2({ lang }: { lang: Lang }) {
  const t = INSIDE_COPY[lang];
  return (
    <section id="inside" className="inside" data-reveal>
      <div className="container">
        <div className="inside-grid">
          <div className="quote-block">
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <span className="quote-mark">&ldquo;</span>
            <p className="quote">{renderParts(t.quote)}</p>
            <span className="quote-cite">{t.cite}</span>
          </div>
          <div className="reasoning">
            {/* Ingenting skal fremstå live uten å være det (§8-06) */}
            <span className="inside-example-tag">{t.exampleTag}</span>
            {t.steps.map((s, i) => (
              <div key={i} className="reasoning-step">
                <span className="step-tag">
                  {s.tag[0]}<span className="time">· {s.tag[1]}</span>
                </span>
                <span className="step-line">{renderParts(s.parts)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
