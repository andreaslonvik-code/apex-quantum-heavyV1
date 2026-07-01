'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SignedIn, SignedOut, SignOutButton } from '@clerk/nextjs';
import type { Lang } from '../marketing/types';
import { writeLangCookie } from '@/lib/i18n/lang-cookie';
import { SOURCE_NOTE } from '@/lib/legal-copy';
import { ArrowRight } from './icons';

/**
 * PAPER-badge (§7) — diskret mono-badge ytterst i headeren som åpner
 * Kildenotens innhold ved hover/tap. Ærligheten sitter i selve kromen.
 * Gjenbruker Kildenotens popover-vokabular (.aq-srcnote-pop) og copy
 * fra lib/legal-copy — HENTET-linjen utelates siden headeren ikke
 * bærer et eget tidsstempel (kun sanne, målte verdier vises).
 */
function PaperBadge({ lang }: { lang: Lang }) {
  const t = SOURCE_NOTE[lang];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popId = useId();

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className="hdr-paper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className="hdr-paper-badge"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={t.ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        PAPER
      </button>
      <span
        id={popId}
        role="note"
        className="aq-srcnote-pop"
        data-open={open || undefined}
        hidden={!open}
      >
        <span className="aq-srcnote-line">{t.source}</span>
        <span className="aq-srcnote-line">{t.mode}</span>
        <span className="aq-srcnote-caveat">{t.caveat}</span>
        <span className="aq-srcnote-links">
          <Link href="/risikofaktorer">{t.riskLink}</Link>
          <Link href="/innsyn">{t.methodLink}</Link>
        </span>
      </span>
    </div>
  );
}

const NAV_ITEMS: Array<{ href: string; label: Record<Lang, string> }> = [
  { href: '/#products', label: { no: 'Produkter', en: 'Products' } },
  { href: '/#record', label: { no: 'Resultater', en: 'Results' } },
  { href: '/pris', label: { no: 'Priser', en: 'Pricing' } },
  { href: '/om-oss', label: { no: 'Om oss', en: 'About' } },
  { href: '/blogg', label: { no: 'Blogg', en: 'Blog' } },
  { href: '/innsyn', label: { no: 'Innsyn', en: 'Transparency' } },
];

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
          {NAV_ITEMS.map((it) => (
            <Link key={it.href} href={it.href}>{it.label[lang]}</Link>
          ))}
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
              {lang === 'no' ? 'Kom i gang' : 'Get started'} <ArrowRight />
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
          <PaperBadge lang={lang} />
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
          {NAV_ITEMS.map((it) => (
            <Link key={it.href} href={it.href}>{it.label[lang]}</Link>
          ))}
        </nav>
        <div className="mobile-cta" onClick={closeMenu}>
          <SignedOut>
            <Link href="/sign-in" className="btn btn-ghost btn-lg">
              {lang === 'no' ? 'Logg inn' : 'Sign in'}
            </Link>
            <Link href="/sign-up" className="btn btn-gold btn-lg">
              {lang === 'no' ? 'Kom i gang' : 'Get started'} <ArrowRight />
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
