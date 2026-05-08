import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import {
  insertJournalEntry,
  listJournalEntries,
  type JournalAction,
} from '@/lib/plus-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACTIONS = new Set(['BUY', 'SELL', 'HOLD', 'WATCH', 'NOTE']);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  try {
    const entries = await listJournalEntries(userId);
    return NextResponse.json({
      ok: true,
      entries: entries.map((e) => ({
        id: e.id,
        ticker: e.ticker,
        action: e.action,
        thesis: e.thesis,
        outcome: e.outcome,
        notes: e.notes,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

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
  const actionVal: JournalAction | null =
    VALID_ACTIONS.has(actionStr) ? (actionStr as JournalAction) : null;

  try {
    const entry = await insertJournalEntry(userId, {
      ticker: typeof ticker === 'string' ? ticker.trim().toUpperCase().slice(0, 32) : null,
      action: actionVal,
      thesis: typeof thesis === 'string' ? thesis.slice(0, 4000) : null,
      outcome: typeof outcome === 'string' ? outcome.slice(0, 4000) : null,
      notes: typeof notes === 'string' ? notes.slice(0, 8000) : null,
    });
    return NextResponse.json({
      ok: true,
      entry: {
        id: entry.id,
        ticker: entry.ticker,
        action: entry.action,
        thesis: entry.thesis,
        outcome: entry.outcome,
        notes: entry.notes,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
