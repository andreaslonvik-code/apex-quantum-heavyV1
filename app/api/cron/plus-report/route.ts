import { NextResponse, type NextRequest } from 'next/server';
import { generateWeeklyReport } from '@/lib/grok-plus';
import { insertReport } from '@/lib/plus-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly Plus market report. Triggered by Vercel cron Sunday 18:00 UTC.
 * Generates a 600–900 word market wrap via Grok and stores in plus_reports.
 * Idempotent per (week_starts_on) — re-runs replace the existing row.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await generateWeeklyReport();
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    const weekStart = mondayOfThisWeek();
    await insertReport({
      weekStartsOn: weekStart,
      title: result.title || 'Ukentlig markedsrapport',
      body: result.body || '',
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return NextResponse.json({ ok: true, weekStartsOn: weekStart });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
