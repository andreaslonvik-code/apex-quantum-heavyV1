import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { askAboutTicker } from '@/lib/grok-plus';
import { isPlusLang } from '@/lib/i18n/plus-lang';
import { hasPlusAccess } from '@/lib/access';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ ok: false, error: 'beta_only' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  const { ticker, question, lang } = body as Record<string, unknown>;
  if (typeof ticker !== 'string' || ticker.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'ticker required' }, { status: 400 });
  }
  if (typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'question required' }, { status: 400 });
  }
  if (question.length > 1500) {
    return NextResponse.json({ ok: false, error: 'question too long' }, { status: 400 });
  }
  const langKey = isPlusLang(lang) ? lang : 'en';

  const result = await askAboutTicker(ticker.trim(), question.trim(), langKey);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, answer: result.answer });
}
