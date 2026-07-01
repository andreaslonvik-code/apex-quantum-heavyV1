import type { ReactNode } from 'react';
import type { Lang } from '@/app/components/marketing/types';
import type { Post, PostImage } from './posts';

/**
 * Minimal markdown-renderer for bloggposter — flyttet ut av page.tsx
 * så både FT-indeksen (/blogg) og artikkelmalen (/blogg/[slug]) kan
 * bruke den. Emitterer ren semantisk markup; all typografi kommer fra
 * .article-body-reglene i marketing-v2/styles.css.
 */

export function formatPostDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Tiny inline renderer — supports **bold** and *italic*. */
function renderInline(text: string): ReactNode {
  const out: ReactNode[] = [];
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

export function renderMarkdown(body: string): ReactNode[] {
  const blocks = body.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('## ')) {
      return <h2 key={i}>{trimmed.replace(/^##\s+/, '')}</h2>;
    }
    if (trimmed.startsWith('### ')) {
      return <h3 key={i}>{trimmed.replace(/^###\s+/, '')}</h3>;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^\d+\.\s+/, ''));
      return (
        <ol key={i}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    }
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
      return (
        <ul key={i}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{renderInline(trimmed)}</p>;
  });
}

export function PostFigure({ image, lang }: { image: PostImage; lang: Lang }) {
  const caption = image.caption?.[lang];
  return (
    <figure className="pg-blog-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt[lang]} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/**
 * Full artikkelkropp — deler brødteksten på <!-- image2 -->-markøren og
 * legger den sekundære figuren mellom halvdelene, som før.
 */
export function PostBody({ post, lang }: { post: Post; lang: Lang }) {
  const body = post.body[lang];
  const marker = '<!-- image2 -->';
  const idx = body.indexOf(marker);
  const before = idx >= 0 ? body.slice(0, idx).trim() : body;
  const after = idx >= 0 ? body.slice(idx + marker.length).trim() : '';
  return (
    <>
      {post.image && <PostFigure image={post.image} lang={lang} />}
      {renderMarkdown(before)}
      {after && post.image2 && (
        <>
          <PostFigure image={post.image2} lang={lang} />
          {renderMarkdown(after)}
        </>
      )}
    </>
  );
}
