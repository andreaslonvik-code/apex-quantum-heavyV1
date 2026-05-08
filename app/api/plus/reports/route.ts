import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import { listReports } from '@/lib/plus-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const wantEn = req.nextUrl.searchParams.get('lang') === 'en';

  try {
    const reports = await listReports(8);
    return NextResponse.json({
      ok: true,
      reports: reports.map((r) => ({
        id: r.id,
        reportDate: r.report_date,
        title: wantEn ? (r.title_en ?? r.title) : r.title,
        body: wantEn ? (r.body_en ?? r.body) : r.body,
        publishedAt: r.published_at,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
