'use client';

import Image from 'next/image';
import Link from 'next/link';
import { SignedIn, SignedOut, SignOutButton } from '@clerk/nextjs';
import type { Lang } from '../marketing/types';
import { writeLangCookie } from '@/lib/i18n/lang-cookie';
import { ArrowRight } from './icons';

export function HeaderV2({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const choose = (next: Lang) => {
    setLang(next);
    writeLangCookie(next);
  };
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <div className="brand-mk">
            <Image src="/aq-logo.png" alt="Apex Quantum" width={38} height={38} />
          </div>
          <span className="brand-wm">
            <span className="quiet">Apex</span> <span className="gold">Quantum</span>
          </span>
        </Link>
        <nav className="nav">
          <Link href="/plus">Apex Quantum +</Link>
          <Link href="/#products">{lang === 'no' ? 'Produkter' : 'Products'}</Link>
          <Link href="/#principles">{lang === 'no' ? 'Funksjoner' : 'Features'}</Link>
          <Link href="/pris">{lang === 'no' ? 'Pris' : 'Pricing'}</Link>
        </nav>
        <div className="hdr-right">
          <div className="lang">
            <button type="button" className={lang === 'no' ? 'on' : ''} onClick={() => choose('no')}>NO</button>
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => choose('en')}>EN</button>
          </div>
          <SignedOut>
            <Link href="/sign-in" className="btn btn-ghost btn-sm">{lang === 'no' ? 'Logg inn' : 'Sign in'}</Link>
            <Link href="/sign-up" className="btn btn-gold btn-sm">
              {lang === 'no' ? 'Start nå' : 'Get started'} <ArrowRight />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
            <SignOutButton redirectUrl="/">
              <button type="button" className="btn btn-gold btn-sm">
                {lang === 'no' ? 'Logg ut' : 'Sign out'}
              </button>
            </SignOutButton>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
