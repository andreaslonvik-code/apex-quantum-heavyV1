'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '@/app/styles/pages.css';
import type { Lang } from '@/app/components/marketing/types';
import { readLangCookie } from '@/lib/i18n/lang-cookie';

/**
 * 404 — «finnes ikke i hovedboken» (§9). Ink-deep flate, Fraunces-404
 * med gull-kursiv null og btn-ghost tilbake til forsiden. Språk leses
 * fra aq-lang-cookien etter hydrering (samme mønster som PageShell).
 */

const COPY = {
  no: {
    msg: 'Denne siden finnes ikke i hovedboken.',
    sub: 'Lenken er sannsynligvis utdatert, eller siden er flyttet.',
    cta: 'Til forsiden',
  },
  en: {
    msg: 'This page is not in the ledger.',
    sub: 'The link is probably outdated, or the page has moved.',
    cta: 'To the front page',
  },
} as const;

export default function NotFound() {
  const [lang, setLang] = useState<Lang>('no');

  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang && cookieLang !== lang) setLang(cookieLang);
    // Kjøres én gang etter hydrering — samme mønster som PageShell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = COPY[lang];
  return (
    <main className="pg-404">
      <div className="pg-404-inner">
        <h1 className="pg-404-code">
          4<em>0</em>4
        </h1>
        <p className="pg-404-msg">{t.msg}</p>
        <p className="pg-404-sub">{t.sub}</p>
        <Link href="/" className="pg-404-cta">
          {t.cta}
        </Link>
      </div>
    </main>
  );
}
