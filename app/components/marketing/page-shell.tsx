'use client';

import { useEffect, useState, type ReactNode } from 'react';
import '../marketing-v2/styles.css';
import { HeaderV2 } from '../marketing-v2/header';
import { FooterV2 } from '../marketing-v2/cta-footer';
import type { Lang } from './types';
import { readLangCookie } from '@/lib/i18n/lang-cookie';

/**
 * Shared chrome for info / legal sub-pages (Personvern, Vilkår, Om oss,
 * Risikofaktorer, Cookies, Kontakt, etc.). Wraps every sub-page in the
 * v2 editorial design — same atmosphere, header and footer as the landing
 * — so every public surface reads as one site.
 *
 * Initial render uses 'no' to match SSR; after hydration we read the
 * `aq-lang` cookie set by the homepage's geo detection or the user's
 * explicit toggle. Direct sub-page landings from foreign IPs without a
 * cookie show NO for one paint then flip — acceptable, since marketing
 * entry flows through `/`.
 */
export function PageShell({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLang] = useState<Lang>('no');

  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang && cookieLang !== lang) setLang(cookieLang);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="aqv2">
      <div className="atmosphere" aria-hidden="true" />
      <div className="aqv2-grain" aria-hidden="true" />
      <HeaderV2 lang={lang} setLang={setLang} />
      <main>
        {children(lang)}
        <FooterV2 lang={lang} />
      </main>
    </div>
  );
}

/**
 * Editorial article body used by every legal / informational sub-page.
 * Renders a tall serif title, a discreet "last updated" caption, and a
 * body slot styled by `.article-body` rules in `marketing-v2/styles.css`.
 */
export function ArticleBody({
  title,
  updatedLabel,
  updatedDate,
  body,
}: {
  title: string;
  updatedLabel: string;
  updatedDate: string;
  body: ReactNode;
}) {
  return (
    <section className="article">
      <div className="article-inner">
        <h1>{title}</h1>
        <p className="article-updated">{updatedLabel}: {updatedDate}</p>
        <div className="article-body">{body}</div>
      </div>
    </section>
  );
}
