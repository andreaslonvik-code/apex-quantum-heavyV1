'use client';

import Image from 'next/image';
import Link from 'next/link';
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
  foot: [string, string, string];
}> = {
  no: {
    eye: 'KOM I GANG',
    titlePre: 'Begynn med ',
    titleEm:  'Apex Quantum +',
    titlePost: '.',
    sub: 'Daglige AI-signaler med begrunnelse, ukentlige rapporter og strukturert læring — for 199 kr/mnd. Den fullautomatiske Max-motoren kommer i 2026.',
    cta1: 'Start nå',
    cta2: 'Varsle meg om Max',
    foot: ['Fra 199 kr/mnd', 'Ingen binding', 'Apex Quantum Max — under utvikling'],
  },
  en: {
    eye: 'GET STARTED',
    titlePre: 'Begin with ',
    titleEm:  'Apex Quantum +',
    titlePost: '.',
    sub: 'Daily AI signals with reasoning, weekly reports and structured learning — for $19/month. The fully autonomous Max engine launches in 2026.',
    cta1: 'Start now',
    cta2: 'Notify me about Max',
    foot: ['From $19/month', 'No commitment', 'Apex Quantum Max — in development'],
  },
};

type FooterCol = readonly [heading: string, items: ReadonlyArray<readonly [label: string, href: string]>];

const FOOTER_COPY: Record<Lang, {
  disc: string;
  cols: ReadonlyArray<FooterCol>;
  systemOk: string;
  rights: string;
  orgLabel: string;
}> = {
  no: {
    disc: 'Apex Quantum er en AI-drevet analyseplattform. Handel innebærer risiko. Tidligere resultater er ingen garanti for fremtidige resultater.',
    cols: [
      ['Produkt', [
        ['Apex Quantum +', '/plus'],
        ['Apex Quantum Max', '/#products'],
        ['Pris', '/pris'],
        ['Funksjoner', '/#principles'],
      ]],
      ['Selskap', [
        ['Om oss', '/om-oss'],
        ['Blogg', '/blogg'],
        ['Kontakt', '/kontakt'],
        ['Status', '/status'],
      ]],
      ['Juridisk', [
        ['Personvern', '/personvern'],
        ['Vilkår', '/vilkar'],
        ['Risikofaktorer', '/risikofaktorer'],
        ['Cookies', '/cookies'],
      ]],
    ],
    systemOk: 'System OK',
    rights: 'Alle rettigheter forbeholdt',
    orgLabel: 'Org.nr',
  },
  en: {
    disc: 'Apex Quantum is an AI-powered analysis platform. Trading involves risk. Past performance is not a guarantee of future results.',
    cols: [
      ['Product', [
        ['Apex Quantum +', '/plus'],
        ['Apex Quantum Max', '/#products'],
        ['Pricing', '/pris'],
        ['Features', '/#principles'],
      ]],
      ['Company', [
        ['About', '/om-oss'],
        ['Blog', '/blogg'],
        ['Contact', '/kontakt'],
        ['Status', '/status'],
      ]],
      ['Legal', [
        ['Privacy', '/personvern'],
        ['Terms', '/vilkar'],
        ['Risk factors', '/risikofaktorer'],
        ['Cookies', '/cookies'],
      ]],
    ],
    systemOk: 'System OK',
    rights: 'All rights reserved',
    orgLabel: 'Org. no',
  },
};

export function CTAV2({ lang }: { lang: Lang }) {
  const t = CTA_COPY[lang];
  return (
    <section id="cta" className="cta">
      <div className="container">
        <div className="cta-inner">
          <span className="eyebrow"><span className="rule" />{t.eye}</span>
          <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
          <p>{t.sub}</p>
          <div className="cta-row">
            <Link href="/sign-up" className="btn btn-gold btn-lg">{t.cta1} <ArrowRight size={16} /></Link>
            <a href="mailto:post@apex-quantum.com?subject=Apex%20Quantum%20Max%20%E2%80%94%20notify%20me" className="btn btn-ghost btn-lg">{t.cta2}</a>
          </div>
          <div style={{ marginTop: 28, display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', fontFamily: 'var(--aq-font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--aq-muted)', textTransform: 'uppercase' }}>
            <span>{t.foot[0]}</span>
            <span>·</span>
            <span>{t.foot[1]}</span>
            <span>·</span>
            <span>{t.foot[2]}</span>
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
            <Link href="/" className="brand">
              <div className="brand-mk">
                <Image src="/aq-logo.png" alt="Apex Quantum" width={38} height={38} />
              </div>
              <span className="brand-wm"><span className="quiet">Apex</span> <span className="gold">Quantum</span></span>
            </Link>
            <p>{t.disc}</p>
            <span className="aqv2-tag gold"><span className="aqv2-dot" />{t.systemOk}</span>
          </div>
          <div className="footer-cols">
            {t.cols.map(([h, items]) => (
              <div key={h}>
                <h4>{h}</h4>
                <ul>
                  {items.map(([lab, href]) => (
                    <li key={href}>
                      <Link href={href}>{lab}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} Apex Quantum AS · {t.orgLabel} 921 269 962 · {t.rights}</span>
          <span>apex-quantum.com</span>
        </div>
      </div>
    </footer>
  );
}
