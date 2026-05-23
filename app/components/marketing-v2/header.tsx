'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '../marketing/types';
import { ArrowRight } from './icons';

export function HeaderV2({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="header">
      <div className="header-inner">
        <a href="#" className="brand">
          <div className="brand-mk">
            <Image src="/aq-logo.png" alt="Apex Quantum" width={38} height={38} />
          </div>
          <span className="brand-wm">
            <span className="quiet">Apex</span> <span className="gold">Quantum</span>
          </span>
        </a>
        <nav className="nav">
          <a href="#thesis">{lang === 'no' ? 'Filosofi' : 'Philosophy'}</a>
          <a href="#products">{lang === 'no' ? 'Produkter' : 'Products'}</a>
          <a href="#record">{lang === 'no' ? 'Resultater' : 'Track record'}</a>
          <a href="#inside">{lang === 'no' ? 'Innsiden' : 'The engine'}</a>
        </nav>
        <div className="hdr-right">
          <div className="lang">
            <button type="button" className={lang === 'no' ? 'on' : ''} onClick={() => setLang('no')}>NO</button>
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <Link href="/sign-in" className="btn btn-ghost btn-sm">{lang === 'no' ? 'Logg inn' : 'Sign in'}</Link>
          <a href="#products" className="btn btn-gold btn-sm">
            {lang === 'no' ? 'Få tilgang' : 'Get access'} <ArrowRight />
          </a>
        </div>
      </div>
    </header>
  );
}
