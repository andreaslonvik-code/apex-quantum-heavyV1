import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import {
  deleteJournalEntry,
  updateJournalEntry,
  type JournalAction,
} from '@/lib/plus-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACTIONS = new Set(['BUY', 'SELL', 'HOLD', 'WATCH', 'NOTE']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { ticker, action, thesis, outcome, notes } = body as Record<string, unknown>;
  const actionStr = typeof action === 'string' ? action.trim().toUpperCase() : '';
  const actionVal: JournalAction | null | undefined =
    action === undefined
      ? undefined
      : VALID_ACTIONS.has(actionStr)
        ? (actionStr as JournalAction)
        : null;

  try {
    const entry = await updateJournalEntry(userId, id, {
      ...(ticker !== undefined
        ? { ticker: typeof ticker === 'string' ? ticker.trim().toUpperCase().slice(0, 32) : null }
        : {}),
      ...(actionVal !== undefined ? { action: actionVal } : {}),
      ...(thesis !== undefined ? { thesis: typeof thesis === 'string' ? thesis.slice(0, 4000) : null } : {}),
      ...(outcome !== undefined ? { outcome: typeof outcome === 'string' ? outcome.slice(0, 4000) : null } : {}),
      ...(notes !== undefined ? { notes: typeof notes === 'string' ? notes.slice(0, 8000) : null } : {}),
    });
    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await deleteJournalEntry(userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
