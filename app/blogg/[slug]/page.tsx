import { notFound } from 'next/navigation';
import { POSTS } from '../posts';
import { BloggArticleClient } from './article-client';

/**
 * /blogg/[slug] — artikkelmalen (eksisterende .article, §9).
 * Server-komponent: params er en Promise i Next 16 og awaites her;
 * innholdet er statiske data fra posts.ts.
 */

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function BloggArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) notFound();
  return <BloggArticleClient post={post} />;
}
