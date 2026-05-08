import { PUBLIC_ORIGIN } from '@/lib/email';

interface BriefArgs {
  /** ISO date for the brief (e.g. "2026-05-09"). */
  reportDate: string;
  /** Title in the user's language. */
  title: string;
  /** Markdown body in the user's language. */
  body: string;
  /** Norsk eller engelsk — brukes til intro/footer-strenger. */
  lang: 'no' | 'en';
  /** Optional: top 3 BUY signals to highlight at the top. */
  topSignals?: Array<{
    ticker: string;
    name: string;
    confidence: number;
    reasoning: string;
  }>;
  /** Per-user unsubscribe token. */
  unsubscribeUrl: string;
}

const COPY = {
  no: {
    eyebrow: 'APEX QUANTUM + · MORGENBRIEF',
    todayLabel: (d: string) =>
      new Date(d + 'T00:00:00').toLocaleDateString('no-NO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    topSignalsHeader: 'Dagens topp-signaler',
    confidenceLabel: 'konfidens',
    openDashboard: 'Åpne dashboardet',
    bestRegards: 'Best regards — the team from',
    legalLine:
      'Apex Quantum + er en lærings- og analyseplattform. Innholdet er ikke individuell investeringsrådgivning. Tidligere resultater er ingen garanti for fremtidige resultater.',
    unsubscribe: 'Avmeld morgenbrief',
    sentTo: 'Sendt til',
  },
  en: {
    eyebrow: 'APEX QUANTUM + · MORNING BRIEF',
    todayLabel: (d: string) =>
      new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    topSignalsHeader: "Today's top signals",
    confidenceLabel: 'confidence',
    openDashboard: 'Open dashboard',
    bestRegards: 'Best regards — the team from',
    legalLine:
      'Apex Quantum + is a learning and analysis platform. Content is not individual investment advice. Past performance is no guarantee of future results.',
    unsubscribe: 'Unsubscribe from morning brief',
    sentTo: 'Sent to',
  },
} as const;

/**
 * Lightweight markdown → HTML for email. Email clients render a hostile
 * subset of HTML (no flexbox, no CSS variables, limited @media). We stick
 * to inline styles + table layouts where needed.
 */
function mdToHtml(md: string): string {
  const blocks = md.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (t.startsWith('# ')) {
        return `<h1 style="font-size:22px;font-weight:700;margin:24px 0 8px;color:#ffffff;">${escapeHtml(t.replace(/^#\s+/, ''))}</h1>`;
      }
      if (t.startsWith('## ')) {
        return `<h2 style="font-size:17px;font-weight:600;margin:20px 0 8px;color:#ffffff;">${escapeHtml(t.replace(/^##\s+/, ''))}</h2>`;
      }
      if (t.startsWith('### ')) {
        return `<h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;color:rgba(255,255,255,0.92);">${escapeHtml(t.replace(/^###\s+/, ''))}</h3>`;
      }
      if (/^[-*]\s/.test(t)) {
        const items = t.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
        return `<ul style="margin:0 0 14px 20px;padding:0;color:rgba(255,255,255,0.82);">${items
          .map((it) => `<li style="margin:0 0 4px;font-size:14px;line-height:1.6;">${escapeHtml(it)}</li>`)
          .join('')}</ul>`;
      }
      return `<p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.85);">${escapeHtml(t)}</p>`;
    })
    .join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render the morning-brief email as full HTML with the Apex Quantum
 * signature image at the bottom. Returns `{ subject, html, text }`.
 *
 * The signature lives at /email-signature.png in the public/ folder of
 * the Next.js app — referenced via PUBLIC_ORIGIN so email clients can
 * load it. Save the PNG/WebP there before first send.
 */
export function renderMorningBrief(args: BriefArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const t = COPY[args.lang];
  const subject =
    args.lang === 'no'
      ? `Apex Quantum + · ${t.todayLabel(args.reportDate)}`
      : `Apex Quantum + · ${t.todayLabel(args.reportDate)}`;

  const topBlock =
    args.topSignals && args.topSignals.length > 0
      ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;">
  <tr>
    <td>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#5CFAFF;margin-bottom:12px;">
        ${escapeHtml(t.topSignalsHeader)}
      </div>
      ${args.topSignals
        .map(
          (s) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(0,245,255,0.18);border-radius:10px;background:rgba(0,245,255,0.04);margin-bottom:10px;">
          <tr>
            <td style="padding:14px 16px;">
              <div style="display:block;">
                <span style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#5CFAFF;">${escapeHtml(s.ticker)}</span>
                <span style="font-size:13px;color:rgba(255,255,255,0.6);margin-left:8px;">${escapeHtml(s.name)}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:11px;float:right;color:#34D399;">${s.confidence}% ${escapeHtml(t.confidenceLabel)}</span>
              </div>
              <div style="font-size:13px;line-height:1.55;color:rgba(255,255,255,0.78);margin-top:8px;">
                ${escapeHtml(s.reasoning)}
              </div>
            </td>
          </tr>
        </table>`,
        )
        .join('')}
    </td>
  </tr>
</table>
`
      : '';

  const html = `<!DOCTYPE html>
<html lang="${args.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#05050A;color:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05050A;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0a1218;border:1px solid rgba(0,245,255,0.15);border-radius:14px;">
          <tr>
            <td style="padding:32px 36px 8px;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#5CFAFF;">
                ${escapeHtml(t.eyebrow)}
              </div>
              <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:6px;">
                ${escapeHtml(t.todayLabel(args.reportDate))}
              </div>
              <h1 style="font-size:26px;font-weight:700;letter-spacing:-0.015em;margin:14px 0 0;color:#ffffff;line-height:1.2;">
                ${escapeHtml(args.title)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px;">
              ${topBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 12px;">
              ${mdToHtml(args.body)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 24px;" align="center">
              <a href="${PUBLIC_ORIGIN}/dashboard" style="display:inline-block;padding:12px 22px;background:#5CFAFF;color:#05050A;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;letter-spacing:-0.01em;">
                ${escapeHtml(t.openDashboard)} →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0 0 8px;font-size:11px;line-height:1.55;color:rgba(255,255,255,0.45);">
                ${escapeHtml(t.legalLine)}
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.35);">
                <a href="${args.unsubscribeUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">${escapeHtml(t.unsubscribe)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 32px;" align="center">
              <img src="${PUBLIC_ORIGIN}/email-signature.png" alt="Apex Quantum — best regards from the team" width="280" style="display:block;width:280px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    t.eyebrow,
    t.todayLabel(args.reportDate),
    '',
    args.title,
    '',
    args.body,
    '',
    `${PUBLIC_ORIGIN}/dashboard`,
    '',
    `--`,
    t.bestRegards + ' Apex Quantum',
    '',
    t.legalLine,
    '',
    `${t.unsubscribe}: ${args.unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}
