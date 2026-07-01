'use client';

import { SignUp } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import '@/app/styles/pages.css';
import type { Lang } from '@/app/components/marketing/types';
import { readLangCookie } from '@/lib/i18n/lang-cookie';

/**
 * /sign-up — Clerk-kortet i «Hovedboken»-drakt (§9): appearance-API
 * mot tokenverdiene (gull primær, ink-deep flate, 4px radius, Satoshi),
 * rammet i hero-panel med Gullsnitt-topp og Fraunces-ordmerke over.
 * Clerk-flyten (redirectUrl) er urørt.
 */

const COPY = {
  no: { pre: 'Opprett ', em: 'konto', post: '.', foot: 'Apex Quantum · NO/EN' },
  en: { pre: 'Create an ', em: 'account', post: '.', foot: 'Apex Quantum · NO/EN' },
} as const;

const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#C9A961',
    colorBackground: '#060D1A',
    colorText: '#F0E6D2',
    colorTextSecondary: 'rgba(240,230,210,0.72)',
    colorInputBackground: '#0A1424',
    colorInputText: '#F0E6D2',
    colorDanger: '#C24355',
    colorSuccess: '#2DC986',
    borderRadius: '4px',
    fontFamily: '"Satoshi", system-ui, sans-serif',
  },
} as const;

export default function SignUpPage() {
  const [lang, setLang] = useState<Lang>('no');
  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang && cookieLang !== lang) setLang(cookieLang);
    // Kjøres én gang etter hydrering — samme mønster som PageShell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const t = COPY[lang];
  return (
    <div className="pg-auth">
      <h1 className="pg-auth-title">
        {t.pre}<em>{t.em}</em>{t.post}
      </h1>
      <div className="pg-auth-panel">
        <SignUp appearance={CLERK_APPEARANCE} redirectUrl="/dashboard" />
      </div>
      <span className="pg-auth-foot">{t.foot}</span>
    </div>
  );
}
