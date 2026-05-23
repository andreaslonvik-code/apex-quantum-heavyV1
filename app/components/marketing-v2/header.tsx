'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SignedIn, SignedOut, SignOutButton } from '@clerk/nextjs';
import type { Lang } from '../marketing/types';
import { writeLangCookie } from '@/lib/i18n/lang-cookie';
import { ArrowRight } from './icons';

export function HeaderV2({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const choose = (next: Lang) => {
    setLang(next);
    writeLangCookie(next);
  };

  // Lock body scroll while the mobile sheet is open so background doesn't
  // jiggle and the user can scroll the menu itself if it overflows.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? 'hidden' : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand" onClick={closeMenu}>
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
          <Link href="/om-oss">{lang === 'no' ? 'Om oss' : 'About'}</Link>
        </nav>
        <div className="hdr-right">
          <div className="lang">
            <button type="button" className={lang === 'no' ? 'on' : ''} onClick={() => choose('no')}>NO</button>
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => choose('en')}>EN</button>
          </div>
          <SignedOut>
            <Link href="/sign-in" className="btn btn-ghost btn-sm hide-on-mobile">
              {lang === 'no' ? 'Logg inn' : 'Sign in'}
            </Link>
            <Link href="/sign-up" className="btn btn-gold btn-sm hide-on-mobile">
              {lang === 'no' ? 'Start nå' : 'Get started'} <ArrowRight />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn btn-ghost btn-sm hide-on-mobile">Dashboard</Link>
            <SignOutButton redirectUrl="/">
              <button type="button" className="btn btn-gold btn-sm hide-on-mobile">
                {lang === 'no' ? 'Logg ut' : 'Sign out'}
              </button>
            </SignOutButton>
          </SignedIn>
          <button
            type="button"
            className="hdr-burger"
            aria-label={menuOpen ? 'Lukk meny' : 'Åpne meny'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={`burger-bar ${menuOpen ? 'is-x1' : ''}`} />
            <span className={`burger-bar ${menuOpen ? 'is-x2' : ''}`} />
            <span className={`burger-bar ${menuOpen ? 'is-x3' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer — slide-down sheet under the header. Hidden by CSS
          on ≥ 880px; visible only when menuOpen on mobile. Links share the
          same routes as the desktop nav so search engines see one source. */}
      <div className={`mobile-sheet ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <nav className="mobile-nav" onClick={closeMenu}>
          <Link href="/plus">Apex Quantum +</Link>
          <Link href="/#products">{lang === 'no' ? 'Produkter' : 'Products'}</Link>
          <Link href="/#principles">{lang === 'no' ? 'Funksjoner' : 'Features'}</Link>
          <Link href="/pris">{lang === 'no' ? 'Pris' : 'Pricing'}</Link>
          <Link href="/om-oss">{lang === 'no' ? 'Om oss' : 'About'}</Link>
        </nav>
        <div className="mobile-cta" onClick={closeMenu}>
          <SignedOut>
            <Link href="/sign-in" className="btn btn-ghost btn-lg">
              {lang === 'no' ? 'Logg inn' : 'Sign in'}
            </Link>
            <Link href="/sign-up" className="btn btn-gold btn-lg">
              {lang === 'no' ? 'Start nå' : 'Get started'} <ArrowRight />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn btn-ghost btn-lg">Dashboard</Link>
            <SignOutButton redirectUrl="/">
              <button type="button" className="btn btn-gold btn-lg">
                {lang === 'no' ? 'Logg ut' : 'Sign out'}
              </button>
            </SignOutButton>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
