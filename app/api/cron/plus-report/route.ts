import { NextResponse, type NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'node:crypto';
import { generateWeeklyReport } from '@/lib/grok-plus';
import { insertReport } from '@/lib/plus-db';
import { resend, EMAIL_FROM, PUBLIC_ORIGIN } from '@/lib/email';
import { renderMorningBrief } from '@/lib/email-templates/morning-brief';

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

    // Best-effort: send the brief by email to paying Plus subscribers.
    // Failures here don't fail the cron — the dashboard still has the report.
    let emailSent = 0;
    let emailErrors = 0;
    try {
      const r = await sendMorningBriefEmails({
        reportDate: today,
        titleNo: result.title || 'Daglig morgenbrief',
        titleEn: result.titleEn ?? result.title ?? 'Daily morning brief',
        bodyNo: result.body || '',
        bodyEn: result.bodyEn ?? result.body ?? '',
      });
      emailSent = r.sent;
      emailErrors = r.errors;
    } catch (e) {
      console.error('[plus-report] email broadcast failed', e);
    }

    return NextResponse.json({ ok: true, reportDate: today, emailSent, emailErrors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Iterate paying Plus subscribers in Clerk, send the morning brief.
 * Skips users with `plus_email_opt_out: true` in publicMetadata.
 *
 * Returns counts; does not throw — caller logs and moves on.
 */
async function sendMorningBriefEmails(args: {
  reportDate: string;
  titleNo: string;
  titleEn: string;
  bodyNo: string;
  bodyEn: string;
}): Promise<{ sent: number; errors: number }> {
  if (!resend) return { sent: 0, errors: 0 };

  const client = await clerkClient();
  let sent = 0;
  let errors = 0;
  const SECRET = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? 'apex-quantum-default';

  // Page through all users. Plus = `plusStatus === 'active'` in privateMetadata
  // (set by the Stripe webhook). Cap at 1000 — beyond that we'd shard the job.
  let offset = 0;
  const PAGE = 100;
  while (offset < 1000) {
    const { data: users } = await client.users.getUserList({ limit: PAGE, offset });
    if (users.length === 0) break;

    for (const u of users) {
      const priv = (u.privateMetadata ?? {}) as { plusStatus?: string };
      if (priv.plusStatus !== 'active') continue;

      const pub = (u.publicMetadata ?? {}) as { plus_email_opt_out?: boolean; plus_email_lang?: 'no' | 'en' };
      if (pub.plus_email_opt_out === true) continue;

      const email = u.primaryEmailAddress?.emailAddress;
      if (!email) continue;

      const lang: 'no' | 'en' = pub.plus_email_lang === 'en' ? 'en' : 'no';
      const token = crypto
        .createHmac('sha256', SECRET)
        .update(u.id)
        .digest('hex')
        .slice(0, 32);
      const unsubscribeUrl = `${PUBLIC_ORIGIN}/api/plus/email-unsubscribe?u=${encodeURIComponent(u.id)}&t=${token}`;

      const { subject, html, text } = renderMorningBrief({
        reportDate: args.reportDate,
        title: lang === 'en' ? args.titleEn : args.titleNo,
        body: lang === 'en' ? args.bodyEn : args.bodyNo,
        lang,
        unsubscribeUrl,
      });

      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        sent += 1;
      } catch (e) {
        errors += 1;
        console.error('[plus-report] email send failed for', email, e);
      }
    }

    if (users.length < PAGE) break;
    offset += PAGE;
  }
  return { sent, errors };
}
