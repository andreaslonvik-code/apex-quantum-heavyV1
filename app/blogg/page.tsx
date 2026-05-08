'use client';

import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';
import { POSTS, type Post, type PostImage } from './posts';

const COPY = {
  no: {
    title: 'Blogg',
    intro:
      'Utviklings-oppdateringer fra Apex Quantum-teamet — om hvordan systemet vurderer markedet, hvilke signaler som driver porteføljen, og hvordan vi tester nye strategier mot historiske data.',
    publishedOn: 'Publisert',
  },
  en: {
    title: 'Blog',
    intro:
      'Development updates from the Apex Quantum team — on how the system reads the market, which signals drive the portfolio, and how we test new strategies against historical data.',
    publishedOn: 'Published',
  },
} as const;

function renderMarkdown(body: string) {
  const blocks = body.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={i} style={{ marginTop: 36, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {trimmed.replace(/^##\s+/, '')}
        </h2>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={i} style={{ marginTop: 24, fontSize: 18, fontWeight: 600 }}>
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      );
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^\d+\.\s+/, ''));
      return (
        <ol key={i} style={{ margin: '0 0 16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    }
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
      return (
        <ul key={i} style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, j) => (
            <li key={j} style={{ paddingLeft: 16, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'rgba(255,255,255,0.35)' }}>→</span>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} style={{ margin: '0 0 16px', lineHeight: 1.7 }}>
        {renderInline(trimmed)}
      </p>
    );
  });
}

/** Tiny inline renderer — supports **bold** and *italic*. */
function renderInline(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const boldStart = text.indexOf('**', i);
    const italStart = text.indexOf('*', i);
    let next = -1;
    let kind: 'bold' | 'italic' | null = null;
    if (boldStart !== -1 && (italStart === -1 || boldStart <= italStart)) {
      next = boldStart;
      kind = 'bold';
    } else if (italStart !== -1) {
      next = italStart;
      kind = 'italic';
    }
    if (next === -1 || !kind) {
      out.push(text.slice(i));
      break;
    }
    if (next > i) out.push(text.slice(i, next));
    if (kind === 'bold') {
      const end = text.indexOf('**', next + 2);
      if (end === -1) {
        out.push(text.slice(next));
        break;
      }
      out.push(<strong key={key++}>{text.slice(next + 2, end)}</strong>);
      i = end + 2;
    } else {
      const end = text.indexOf('*', next + 1);
      if (end === -1) {
        out.push(text.slice(next));
        break;
      }
      out.push(<em key={key++}>{text.slice(next + 1, end)}</em>);
      i = end + 1;
    }
  }
  return out;
}

function Figure({ image, lang }: { image: PostImage; lang: 'no' | 'en' }) {
  const caption = image.caption?.[lang];
  return (
    <figure style={{ margin: '0 0 32px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt[lang]}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: 12,
          border: '1px solid var(--aq-border)',
          display: 'block',
        }}
      />
      {caption && (
        <figcaption
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function PostArticle({ post, lang, t }: { post: Post; lang: 'no' | 'en'; t: { publishedOn: string } }) {
  // Split the body on the optional <!-- image2 --> marker so we can drop the
  // second figure mid-article. Markdown renderer is reused for both halves.
  const body = post.body[lang];
  const marker = '<!-- image2 -->';
  const idx = body.indexOf(marker);
  const before = idx >= 0 ? body.slice(0, idx).trim() : body;
  const after = idx >= 0 ? body.slice(idx + marker.length).trim() : '';

  return (
    <article style={{ marginBottom: 96 }}>
      <header style={{ marginBottom: 24 }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            margin: 0,
          }}
        >
          {t.publishedOn}{' '}
          {new Date(post.publishedOn).toLocaleDateString(lang, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h2
          style={{
            marginTop: 8,
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {post.title[lang]}
        </h2>
      </header>

      {post.image && <Figure image={post.image} lang={lang} />}

      <div
        style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: 16,
          lineHeight: 1.7,
        }}
      >
        {renderMarkdown(before)}
      </div>

      {after && post.image2 && (
        <>
          <div style={{ marginTop: 32 }}>
            <Figure image={post.image2} lang={lang} />
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            {renderMarkdown(after)}
          </div>
        </>
      )}
    </article>
  );
}

export default function BloggPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <section style={{ padding: '140px 24px 96px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <h1
                style={{
                  fontSize: 'clamp(40px, 6vw, 60px)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.05,
                  margin: 0,
                }}
              >
                {t.title}
              </h1>
              <p
                style={{
                  marginTop: 16,
                  color: 'rgba(255,255,255,0.62)',
                  fontSize: 18,
                  lineHeight: 1.6,
                }}
              >
                {t.intro}
              </p>

              <div style={{ marginTop: 64 }}>
                {POSTS.map((post) => (
                  <PostArticle key={post.slug} post={post} lang={lang} t={t} />
                ))}
              </div>
            </div>
          </section>
        );
      }}
    </PageShell>
  );
}
