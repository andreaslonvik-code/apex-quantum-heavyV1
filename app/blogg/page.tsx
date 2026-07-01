'use client';

import Link from 'next/link';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';
import { POSTS } from './posts';
import { formatPostDate } from './render';

/**
 * /blogg — FT-indeks (§9): nyeste artikkel stor (Fraunces + lede) over
 * liste-rader med mono-dato i gull, Fraunces-tittel og pil som glir
 * 4px høyre på hover. Ingen bilder påkrevd i indeksen; artiklene bor
 * på /blogg/[slug] i den eksisterende .article-malen.
 */

const COPY = {
  no: {
    eye: 'Blogg',
    titlePre: 'Notater fra ',
    titleEm: 'maskinrommet',
    titlePost: '.',
    lede: 'Utviklings-oppdateringer fra Apex Quantum-teamet — om hvordan systemet vurderer markedet, hvilke signaler som driver porteføljen, og hvordan vi tester nye strategier.',
    featuredTag: 'Siste utgave',
    empty: 'FLERE ARTIKLER KOMMER — ARKIVET BYGGES UTGAVE FOR UTGAVE',
  },
  en: {
    eye: 'Blog',
    titlePre: 'Notes from the ',
    titleEm: 'engine room',
    titlePost: '.',
    lede: 'Development updates from the Apex Quantum team — on how the system reads the market, which signals drive the portfolio, and how we test new strategies.',
    featuredTag: 'Latest edition',
    empty: 'MORE ARTICLES COMING — THE ARCHIVE IS BUILT EDITION BY EDITION',
  },
} as const;

export default function BloggPage() {
  const [featured, ...rest] = POSTS;
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <>
            <section className="pg-hero">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.eye}</span>
                <h1>
                  {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-sub" style={{ fontSize: 16.5 }}>{t.lede}</p>
              </div>
            </section>

            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                {featured && (
                  <>
                    <div className="aq-gullsnitt" aria-hidden />
                    <Link
                      href={`/blogg/${featured.slug}`}
                      className="pg-blog-featured"
                    >
                      <span className="pg-blog-date">
                        {t.featuredTag} · {formatPostDate(featured.publishedOn, lang)}
                      </span>
                      <h2>{featured.title[lang]}</h2>
                      <p className="pg-blog-excerpt">{featured.excerpt[lang]}</p>
                    </Link>
                  </>
                )}

                {rest.length > 0 ? (
                  <div className="pg-blog-rows">
                    {rest.map((post) => (
                      <Link
                        key={post.slug}
                        href={`/blogg/${post.slug}`}
                        className="pg-blog-row"
                      >
                        <span className="pg-blog-date">
                          {formatPostDate(post.publishedOn, lang)}
                        </span>
                        <h3>{post.title[lang]}</h3>
                        <span className="pg-blog-arrow" aria-hidden>→</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="aq-hatch" style={{ marginTop: 64, minHeight: 96 }}>
                    {t.empty}
                  </div>
                )}
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
