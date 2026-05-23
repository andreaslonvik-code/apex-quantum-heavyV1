'use client';

import { Fragment } from 'react';
import type { Lang } from '../marketing/types';

type Part = string | { em: string } | { sym: string } | { up: string } | { dn: string };

const INSIDE_COPY: Record<Lang, {
  eye: string;
  quote: Part[];
  cite: string;
  steps: Array<{ tag: [string, string]; parts: Part[] }>;
}> = {
  no: {
    eye: '05 · Innsiden av motoren',
    quote: ['Vi sier ikke ', { em: 'kjøp NVDA' }, '. Vi sier ', { em: 'her er hvorfor' }, ', og du bestemmer.'],
    cite: 'Apex Quantum-blåkopien · § 2.4 transparens',
    steps: [
      { tag: ['SIGNAL',       '09:31 EDT'], parts: ['Posisjon foreslått: ', { sym: 'NVDA' }, ' — 1,2 % av portefølje, stop −1,8 %.'] },
      { tag: ['RESONNEMENT',  '09:31 EDT'], parts: ['Akkumulasjon over 4 dager, RSI 58, momentum reagerer på sektorrotasjon mot halvledere.'] },
      { tag: ['UTFØRELSE',    '09:32 EDT'], parts: ['Plassert hos Alpaca · fill ', { up: '+2.84 %' }, ' over 6 t.'] },
      { tag: ['REVURDERING',  '15:48 EDT'], parts: ['VIX-justert risiko fortsatt OK. Holder posisjonen til neste signal.'] },
    ],
  },
  en: {
    eye: '05 · Inside the engine',
    quote: ['We don’t say ', { em: 'buy NVDA' }, '. We say ', { em: 'here is why' }, ', and you decide.'],
    cite: 'Apex Quantum blueprint · § 2.4 transparency',
    steps: [
      { tag: ['SIGNAL',    '09:31 EDT'], parts: ['Position proposed: ', { sym: 'NVDA' }, ' — 1.2 % of portfolio, stop −1.8 %.'] },
      { tag: ['RATIONALE', '09:31 EDT'], parts: ['Four-day accumulation, RSI 58, momentum responds to sector rotation into semis.'] },
      { tag: ['EXECUTION', '09:32 EDT'], parts: ['Filled at Alpaca · ', { up: '+2.84 %' }, ' over 6 h.'] },
      { tag: ['RE-EVAL',   '15:48 EDT'], parts: ['VIX-adjusted risk still OK. Holding through next signal.'] },
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
    <section id="inside" className="inside">
      <div className="container">
        <div className="inside-grid">
          <div className="quote-block">
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            <span className="quote-mark">&ldquo;</span>
            <p className="quote">{renderParts(t.quote)}</p>
            <span className="quote-cite">{t.cite}</span>
          </div>
          <div className="reasoning">
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
