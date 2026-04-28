'use client';

import type { Lang } from './types';

export function MFooter({ lang }: { lang: Lang }) {
  const t =
    lang === 'no'
      ? {
          disc: 'Apex Quantum er en AI-drevet analyseplattform. Handel innebærer risiko. Tidligere resultater er ingen garanti for fremtidige resultater.',
          rights: 'Alle rettigheter forbeholdt.',
          cols: [
            ['Produkt', ['Funksjoner', 'Live cockpit', 'Sikkerhet', 'Pris']],
            ['Selskap', ['Om oss', 'Blogg', 'Kontakt', 'Status']],
            ['Juridisk', ['Personvern', 'Vilkår', 'Risikofaktorer', 'Cookies']],
          ] as const,
        }
      : {
          disc: 'Apex Quantum is an AI-powered analysis platform. Trading involves risk. Past performance is not a guarantee of future results.',
          rights: 'All rights reserved.',
          cols: [
            ['Product', ['Features', 'Live cockpit', 'Security', 'Pricing']],
            ['Company', ['About', 'Blog', 'Contact', 'Status']],
            ['Legal', ['Privacy', 'Terms', 'Risk factors', 'Cookies']],
          ] as const,
        };
  return (
    <footer className="m-footer">
      <div className="m-footer-inner">
        <div className="m-footer-brand">
          <div className="m-brand">
            <div className="m-brand-mk">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aq-logo.png" alt="" />
            </div>
            <span className="m-brand-wm">
              APEX <span className="grad">QUANTUM</span>
            </span>
          </div>
          <p className="m-disc">{t.disc}</p>
          <div className="m-pills-row">
            <span className="tag tag-live">
              <span className="dot" />
              SYSTEM OK
            </span>
            <span className="tag">v8.0.4</span>
          </div>
        </div>
        <div className="m-footer-cols">
          {t.cols.map(([h, items]) => (
            <div key={h}>
              <div className="cap-sm">{h}</div>
              <ul>
                {items.map((x) => (
                  <li key={x}>
                    <a href="#">{x}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="m-footer-base">
        <span>© {new Date().getFullYear()} Apex Quantum AS. {t.rights}</span>
        <span className="aq-mono">apex-quantum.com</span>
      </div>
    </footer>
  );
}
