'use client';

import Link from 'next/link';
import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';
import type { Post } from '../posts';
import { PostBody, formatPostDate } from '../render';

const COPY = {
  no: { publishedOn: 'Publisert', back: '← Alle artikler' },
  en: { publishedOn: 'Published', back: '← All articles' },
} as const;

export function BloggArticleClient({ post }: { post: Post }) {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <ArticleBody
            title={post.title[lang]}
            updatedLabel={t.publishedOn}
            updatedDate={formatPostDate(post.publishedOn, lang)}
            body={
              <>
                <PostBody post={post} lang={lang} />
                <p style={{ marginTop: 48 }}>
                  <Link href="/blogg" className="pg-mononote" style={{ color: 'var(--aq-cyan-hi)' }}>
                    {t.back}
                  </Link>
                </p>
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}
