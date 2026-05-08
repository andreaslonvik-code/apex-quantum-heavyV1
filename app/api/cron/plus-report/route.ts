import { NextResponse, type NextRequest } from 'next/server';
import { generateWeeklyReport } from '@/lib/grok-plus';
import { insertReport } from '@/lib/plus-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily Plus morning brief. Triggered by Vercel cron 05:00 UTC every day
 * (≈07:00 norsk tid) so the report is in the dashboard before 08:00.
 * Idempotent per (report_date) — re-runs on the same day replace the row.
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
    const today = new Date().toISOString().slice(0, 10);
    await insertReport({
      reportDate: today,
      title: result.title || 'Daglig morgenbrief',
      titleEn: result.titleEn ?? null,
      body: result.body || '',
      bodyEn: result.bodyEn ?? null,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return NextResponse.json({ ok: true, reportDate: today });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
