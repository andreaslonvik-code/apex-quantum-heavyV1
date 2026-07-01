'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '../marketing/types';
import { LEGAL_LINES, FOOTER_BASELINE } from '@/lib/legal-copy';
import { ArrowRight } from './icons';

const CTA_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  sub: string;
  cta1: string;
  cta2: string;
  riskLink: string;
  maxLink: string;
}> = {
  no: {
    eye: 'KOM I GANG',
    titlePre: 'Tallene taler. ',
    titleEm:  'Dag for dag',
    titlePost: '.',
    sub: 'Fra 199 kr/mnd. Ingen binding. Alle resultater dokumentert.',
    cta1: 'Kom i gang',
    cta2: 'Se resultatene →',
    riskLink: 'Les risikofaktorene først →',
    maxLink: 'Apex Quantum Max — til ventelisten →',
  },
  en: {
    eye: 'GET STARTED',
    titlePre: 'The numbers speak. ',
    titleEm:  'Day by day',
    titlePost: '.',
    sub: 'From $19/month. No commitment. Every result documented.',
    cta1: 'Get started',
    cta2: 'See the results →',
    riskLink: 'Read the risk factors first →',
    maxLink: 'Apex Quantum Max — join the waitlist →',
  },
};

type FooterCol = readonly [heading: string, items: ReadonlyArray<readonly [label: string, href: string]>];

const FOOTER_COPY: Record<Lang, {
  cols: ReadonlyArray<FooterCol>;
  statusLink: string;
  orgLabel: string;
}> = {
  no: {
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
        ['Innsyn', '/innsyn'],
        ['Status', '/status'],
      ]],
      ['Juridisk', [
        ['Personvern', '/personvern'],
        ['Vilkår', '/vilkar'],
        ['Risikofaktorer', '/risikofaktorer'],
        ['Cookies', '/cookies'],
      ]],
    ],
    statusLink: 'Systemstatus →',
    orgLabel: 'Org.nr',
  },
  en: {
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
        ['Transparency', '/innsyn'],
        ['Status', '/status'],
      ]],
      ['Legal', [
        ['Privacy', '/personvern'],
        ['Terms', '/vilkar'],
        ['Risk factors', '/risikofaktorer'],
        ['Cookies', '/cookies'],
      ]],
    ],
    statusLink: 'System status →',
    orgLabel: 'Org. no',
  },
};

export function CTAV2({ lang }: { lang: Lang }) {
  const t = CTA_COPY[lang];
  return (
    <section id="cta" className="cta" data-reveal>
      <div className="container">
        <div className="cta-inner">
          <span className="eyebrow"><span className="rule" />{t.eye}</span>
          <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
          <p>{t.sub}</p>
          <div className="cta-row">
            <Link href="/sign-up" className="btn btn-gold btn-lg">{t.cta1} <ArrowRight size={16} /></Link>
            <a href="#record" className="btn btn-ghost btn-lg">{t.cta2}</a>
          </div>
          {/* Mikrolenker: risikofaktorer først — et tillitsgrep (§8-07) */}
          <div className="cta-micro">
            <Link href="/risikofaktorer">{t.riskLink}</Link>
            <a href="#venteliste">{t.maxLink}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FooterV2({ lang }: { lang: Lang }) {
  const t = FOOTER_COPY[lang];
  const lines = LEGAL_LINES[lang];
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
            {/* L4 + L5 fra lib/legal-copy — footer og hero-tall peker på samme kilde */}
            <p>{lines.l4} {lines.l5}</p>
            {/* Ingen umålte påstander: «System OK» erstattet av lenke til /status */}
            <Link href="/status" className="footer-status">{t.statusLink}</Link>
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
          <span>© {new Date().getFullYear()} Apex Quantum AS · {t.orgLabel} 921 269 962 · {FOOTER_BASELINE[lang]}</span>
          <span>apex-quantum.com</span>
        </div>
      </div>
    </footer>
  );
}
