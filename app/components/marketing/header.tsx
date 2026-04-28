'use client';

import Link from 'next/link';
import type { Lang } from './types';

export function MHeader({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="m-hdr">
      <div className="m-hdr-inner">
        <Link href="/" className="m-brand">
          <div className="m-brand-mk">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aq-logo.png" alt="" />
          </div>
          <span className="m-brand-wm">
            APEX <span className="grad">QUANTUM</span>
          </span>
        </Link>
        <nav className="m-nav">
          <a href="#features">{lang === 'no' ? 'Funksjoner' : 'Features'}</a>
          <a href="#live">Live</a>
          <a href="#sikkerhet">{lang === 'no' ? 'Sikkerhet' : 'Security'}</a>
          <a href="#pris">{lang === 'no' ? 'Pris' : 'Pricing'}</a>
        </nav>
        <div className="m-hdr-right">
          <div className="lang-tog">
            <button className={lang === 'no' ? 'is-on' : ''} onClick={() => setLang('no')}>NO</button>
            <button className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <Link href="/connect-alpaca" className="btn-primary-v8 btn-sm">
            {lang === 'no' ? 'Start nå' : 'Get Started'}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
