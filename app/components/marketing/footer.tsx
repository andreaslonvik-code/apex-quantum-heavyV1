'use client';

import Link from 'next/link';
import type { Lang } from './types';

type Item = readonly [label: string, href: string];
type Col = readonly [heading: string, items: readonly Item[]];

export function MFooter({ lang }: { lang: Lang }) {
  const t =
    lang === 'no'
      ? {
          disc: 'Apex Quantum er en AI-drevet analyseplattform. Handel innebærer risiko. Tidligere resultater er ingen garanti for fremtidige resultater.',
          rights: 'Alle rettigheter forbeholdt.',
          orgLabel: 'Org.nr',
          cols: [
            ['Produkt', [
              ['Funksjoner', '/#features'],
              ['Live cockpit', '/#live'],
              ['Sikkerhet', '/#sikkerhet'],
              ['Pris', '/pris'],
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
          ] as readonly Col[],
        }
      : {
          disc: 'Apex Quantum is an AI-powered analysis platform. Trading involves risk. Past performance is not a guarantee of future results.',
          rights: 'All rights reserved.',
          orgLabel: 'Org. no',
          cols: [
            ['Product', [
              ['Features', '/#features'],
              ['Live cockpit', '/#live'],
              ['Security', '/#sikkerhet'],
              ['Pricing', '/pris'],
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
          ] as readonly Col[],
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
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>APEX</span>{' '}
              <span style={{ color: 'var(--aq-cyan)' }}>QUANTUM</span>
            </span>
          </div>
          <p className="m-disc">{t.disc}</p>
          <div className="m-pills-row">
            <span className="tag tag-live">
              <span className="dot" />
              SYSTEM OK
            </span>
          </div>
        </div>
        <div className="m-footer-cols">
          {t.cols.map(([h, items]) => (
            <div key={h}>
              <div className="cap-sm">{h}</div>
              <ul>
                {items.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="m-footer-base">
        <span>
          © {new Date().getFullYear()} Apex Quantum AS · {t.orgLabel} 921 269 962 · {t.rights}
        </span>
        <span className="aq-mono">apex-quantum.com</span>
      </div>
    </footer>
  );
}
