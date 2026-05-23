'use client';

import Image from 'next/image';
import type { Lang } from '../marketing/types';
import { ArrowRight } from './icons';

const CTA_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  sub: string;
  cta1: string;
  cta2: string;
}> = {
  no: {
    eye: 'Kom i gang',
    titlePre: 'Plus i dag. ',
    titleEm:  'Max',
    titlePost: ' når den ankommer.',
    sub: 'Ingen binding. Ingen oppstartskostnad. Du beholder full kontroll over megleren din.',
    cta1: 'Få Plus · 199 kr/mnd',
    cta2: 'Sett meg på Max-venteliste',
  },
  en: {
    eye: 'Get started',
    titlePre: 'Plus today. ',
    titleEm:  'Max',
    titlePost: ' when it ships.',
    sub: 'No commitment. No setup fee. You keep full control of your broker.',
    cta1: 'Get Plus · $19/mo',
    cta2: 'Notify me about Max',
  },
};

const FOOTER_COPY: Record<Lang, {
  disc: string;
  cols: Array<[string, Array<[string, string]>]>;
  base: [string, string, string];
  systemOk: string;
}> = {
  no: {
    disc: 'Apex Quantum er en AI-drevet analyseplattform. Handel innebærer risiko. Tidligere resultater er ingen garanti for fremtidige resultater. Apex Quantum AS · Org.nr 921 269 962 · Oslo, Norge.',
    cols: [
      ['Produkter', [['Plus','#products'],['Max','#products'],['Pris','#products'],['Resultater','#record']]],
      ['Selskap',   [['Filosofi','#thesis'],['Innsiden','#inside'],['Blogg','/blogg'],['Kontakt','mailto:post@apex-quantum.com']]],
      ['Juridisk',  [['Personvern','/personvern'],['Vilkår','/vilkar'],['Risikofaktorer','#'],['Cookies','#']]],
    ],
    base: ['© 2026 Apex Quantum AS', 'Alle rettigheter forbeholdt', 'apex-quantum.com'],
    systemOk: 'System OK',
  },
  en: {
    disc: 'Apex Quantum is an AI-powered analysis platform. Trading involves risk. Past performance is not a guarantee of future results. Apex Quantum AS · Org. no 921 269 962 · Oslo, Norway.',
    cols: [
      ['Products', [['Plus','#products'],['Max','#products'],['Pricing','#products'],['Track record','#record']]],
      ['Company',  [['Thesis','#thesis'],['The engine','#inside'],['Blog','/blogg'],['Contact','mailto:post@apex-quantum.com']]],
      ['Legal',    [['Privacy','/personvern'],['Terms','/vilkar'],['Risk factors','#'],['Cookies','#']]],
    ],
    base: ['© 2026 Apex Quantum AS', 'All rights reserved', 'apex-quantum.com'],
    systemOk: 'System OK',
  },
};

export function CTAV2({ lang }: { lang: Lang }) {
  const t = CTA_COPY[lang];
  return (
    <section className="cta">
      <div className="container">
        <div className="cta-inner">
          <span className="eyebrow"><span className="rule" />{t.eye}</span>
          <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
          <p>{t.sub}</p>
          <div className="cta-row">
            <a href="#products" className="btn btn-gold btn-lg">{t.cta1} <ArrowRight size={16} /></a>
            <a href="#products" className="btn btn-ghost btn-lg">{t.cta2}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FooterV2({ lang }: { lang: Lang }) {
  const t = FOOTER_COPY[lang];
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <a href="#" className="brand">
              <div className="brand-mk">
                <Image src="/aq-logo.png" alt="Apex Quantum" width={38} height={38} />
              </div>
              <span className="brand-wm"><span className="quiet">Apex</span> <span className="gold">Quantum</span></span>
            </a>
            <p>{t.disc}</p>
            <span className="aqv2-tag gold"><span className="aqv2-dot" />{t.systemOk}</span>
          </div>
          <div className="footer-cols">
            {t.cols.map(([h, items]) => (
              <div key={h}>
                <h4>{h}</h4>
                <ul>{items.map(([lab, href]) => (<li key={lab}><a href={href}>{lab}</a></li>))}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="footer-base">
          <span>{t.base[0]} · {t.base[1]}</span>
          <span>{t.base[2]}</span>
        </div>
      </div>
    </footer>
  );
}
