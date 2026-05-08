/**
 * Internal ops dashboard — admin-only, NOT linked from any public nav.
 * Live-probes every external dependency Apex Quantum runs on so triage
 * is one URL away when the trader stops working.
 *
 * Auth strategy (in priority order):
 *   1. `?ops_secret=<OPS_EMERGENCY_SECRET>` — emergency bypass that does
 *      NOT depend on Clerk. Critical because Clerk itself is one of the
 *      services this page probes; if Clerk is down, the gate must still
 *      let an operator in.
 *   2. Logged-in admin email (in ADMIN_EMAILS) — normal path.
 *   3. Logged out → redirect to /sign-in so the operator knows what to do
 *      instead of seeing an opaque 404.
 *   4. Logged in but not admin → notFound() preserves obscurity from
 *      regular paying customers stumbling on the URL.
 */
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_EMAILS = new Set(['post@apex-quantum.com']);

type Status = 'ok' | 'warn' | 'down' | 'unknown';

interface Probe {
  name: string;
  status: Status;
  latencyMs?: number;
  detail?: string;
  hint?: string;
  dashboardUrl?: string;
}

const PROBE_TIMEOUT_MS = 6000;

async function withTimeout<T>(p: PromiseLike<T>, ms = PROBE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function fmtAge(ts: Date | null, now = new Date()): string {
  if (!ts) return 'never';
  const ms = now.getTime() - ts.getTime();
  if (ms < 0) return 'in future';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ============================================================
// Probes
// ============================================================

async function probeSupabase(): Promise<Probe> {
  const t0 = Date.now();
  try {
    const sb = createAdminClient();
    const { error, count } = await withTimeout(
      sb.from('alpaca_accounts').select('clerk_user_id', { count: 'exact', head: true }),
    );
    const latencyMs = Date.now() - t0;
    if (error) {
      return {
        name: 'Supabase',
        status: 'down',
        latencyMs,
        detail: error.message,
        dashboardUrl: 'https://supabase.com/dashboard/projects',
      };
    }
    return {
      name: 'Supabase',
      status: latencyMs > 2000 ? 'warn' : 'ok',
      latencyMs,
      detail: `alpaca_accounts: ${count ?? 0} rows`,
      dashboardUrl: 'https://supabase.com/dashboard/projects',
    };
  } catch (e) {
    return {
      name: 'Supabase',
      status: 'down',
      latencyMs: Date.now() - t0,
      detail: String(e),
      dashboardUrl: 'https://supabase.com/dashboard/projects',
    };
  }
}

async function probeXai(): Promise<Probe> {
  const t0 = Date.now();
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      name: 'xAI / Grok',
      status: 'down',
      detail: 'XAI_API_KEY not set',
      dashboardUrl: 'https://console.x.ai/',
    };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return {
        name: 'xAI / Grok',
        status: 'down',
        latencyMs,
        detail: `HTTP ${res.status}`,
        hint: res.status === 401 ? 'Bad XAI_API_KEY' : undefined,
        dashboardUrl: 'https://console.x.ai/',
      };
    }
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    const requested = process.env.GROK_MODEL || 'grok-4';
    const has = json.data?.some((m) => m.id === requested) ?? false;
    return {
      name: 'xAI / Grok',
      status: has ? (latencyMs > 3000 ? 'warn' : 'ok') : 'warn',
      latencyMs,
      detail: `${json.data?.length ?? 0} models · ${requested} ${has ? 'available' : 'NOT in list'}`,
      dashboardUrl: 'https://console.x.ai/',
    };
  } catch (e) {
    return {
      name: 'xAI / Grok',
      status: 'down',
      latencyMs: Date.now() - t0,
      detail: String(e),
      dashboardUrl: 'https://console.x.ai/',
    };
  }
}

async function probeClerk(): Promise<Probe> {
  const t0 = Date.now();
  try {
    const client = await clerkClient();
    const count = await withTimeout(client.users.getCount());
    const latencyMs = Date.now() - t0;
    return {
      name: 'Clerk',
      status: latencyMs > 2000 ? 'warn' : 'ok',
      latencyMs,
      detail: `${count} signed-up users`,
      dashboardUrl: 'https://dashboard.clerk.com/',
    };
  } catch (e) {
    return {
      name: 'Clerk',
      status: 'down',
      latencyMs: Date.now() - t0,
      detail: String(e),
      dashboardUrl: 'https://dashboard.clerk.com/',
    };
  }
}

async function probeInngest(): Promise<Probe> {
  // The inngest serve handler responds to GET with a JSON manifest of
  // registered functions. If this 200s, the route + client wiring is fine.
  // Note: we don't fetch over the network — we just verify env presence
  // because we don't know our own deploy URL from here. Inngest cloud
  // controls firing, so the meaningful failure mode is "key wrong / app
  // not registered with cloud" — surfaced via the cloud dashboard.
  const hasEventKey = Boolean(process.env.INNGEST_EVENT_KEY);
  const hasSigningKey = Boolean(process.env.INNGEST_SIGNING_KEY);
  if (!hasEventKey && !hasSigningKey) {
    return {
      name: 'Inngest',
      status: 'unknown',
      detail: 'No INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY set — running unauth/dev mode',
      hint: 'Verify in Inngest cloud dashboard whether the app is registered',
      dashboardUrl: 'https://app.inngest.com/',
    };
  }
  return {
    name: 'Inngest',
    status: 'ok',
    detail: `keys present (event: ${hasEventKey}, signing: ${hasSigningKey})`,
    dashboardUrl: 'https://app.inngest.com/',
  };
}

interface DbActivity {
  table: string;
  rows: number | null;
  lastActivity: Date | null;
  lastActivityField?: string;
  error?: string;
}

async function probeDbActivity(): Promise<DbActivity[]> {
  const sb = createAdminClient();
  const tables: Array<{ name: string; tsCol?: string }> = [
    { name: 'alpaca_accounts', tsCol: 'updated_at' },
  ];
  return Promise.all(
    tables.map(async ({ name, tsCol }): Promise<DbActivity> => {
      try {
        const { count, error: countErr } = await withTimeout(
          sb.from(name).select('*', { count: 'exact', head: true }),
        );
        if (countErr) return { table: name, rows: null, lastActivity: null, error: countErr.message };
        let lastActivity: Date | null = null;
        if (tsCol) {
          const { data, error } = await withTimeout(
            sb.from(name).select(tsCol).order(tsCol, { ascending: false }).limit(1).maybeSingle(),
          );
          if (!error && data) {
            const row = data as unknown as Record<string, unknown>;
            const v = row[tsCol];
            if (v) lastActivity = new Date(String(v));
          }
        }
        return { table: name, rows: count ?? 0, lastActivity, lastActivityField: tsCol };
      } catch (e) {
        return { table: name, rows: null, lastActivity: null, error: String(e) };
      }
    }),
  );
}

// ============================================================
// Env presence (no values exposed)
// ============================================================

const ENV_KEYS: Array<{ key: string; group: string; required: boolean }> = [
  { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', group: 'Clerk', required: true },
  { key: 'CLERK_SECRET_KEY', group: 'Clerk', required: true },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', group: 'Supabase', required: true },
  { key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', group: 'Supabase', required: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', group: 'Supabase', required: true },
  { key: 'ENCRYPTION_KEY', group: 'Crypto', required: true },
  { key: 'XAI_API_KEY', group: 'xAI', required: true },
  { key: 'GROK_MODEL', group: 'xAI', required: false },
  { key: 'GROK_MODEL_NEWS', group: 'xAI', required: false },
  { key: 'GROK_MODEL_PORTFOLIO', group: 'xAI', required: false },
  { key: 'CRON_SECRET', group: 'Vercel Cron', required: false },
  { key: 'INNGEST_EVENT_KEY', group: 'Inngest', required: false },
  { key: 'INNGEST_SIGNING_KEY', group: 'Inngest', required: false },
  { key: 'ALPACA_DATA_URL', group: 'Alpaca', required: false },
  { key: 'SENTRY_DSN', group: 'Observability', required: false },
];

function checkEnv() {
  return ENV_KEYS.map((e) => ({ ...e, present: Boolean(process.env[e.key]) }));
}

// ============================================================
// Render
// ============================================================

const STATUS_COLOR: Record<Status, string> = {
  ok: 'var(--aq-green)',
  warn: 'var(--aq-warn)',
  down: 'var(--aq-red)',
  unknown: 'rgba(255,255,255,0.35)',
};

const STATUS_LABEL: Record<Status, string> = {
  ok: 'OK',
  warn: 'WARN',
  down: 'DOWN',
  unknown: '?',
};

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 999,
        background: STATUS_COLOR[status],
        boxShadow: `0 0 12px ${STATUS_COLOR[status]}`,
      }}
    />
  );
}

function ProbeCard({ p }: { p: Probe }) {
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 12,
        background: 'rgba(10,10,20,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
          <StatusDot status={p.status} />
          {p.name}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            color: STATUS_COLOR[p.status],
            letterSpacing: 0.5,
          }}
        >
          {STATUS_LABEL[p.status]}
          {p.latencyMs !== undefined ? ` · ${p.latencyMs}ms` : ''}
        </span>
      </div>
      {p.detail && (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{p.detail}</div>
      )}
      {p.hint && (
        <div style={{ fontSize: 12, color: 'var(--aq-warn)' }}>↳ {p.hint}</div>
      )}
      {p.dashboardUrl && (
        <a
          href={p.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--aq-cyan)',
            textDecoration: 'none',
            marginTop: 2,
          }}
        >
          → dashboard
        </a>
      )}
    </div>
  );
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ ops_secret?: string }>;
}) {
  const sp = await searchParams;
  const emergencySecret = process.env.OPS_EMERGENCY_SECRET;
  const bypass =
    !!emergencySecret && !!sp.ops_secret && sp.ops_secret === emergencySecret;

  let email = bypass ? 'emergency-bypass' : '';
  if (!bypass) {
    const user = await currentUser();
    if (!user) {
      // Logged out: send to sign-in so the operator gets a clear next step
      // rather than an opaque 404. The sign-in page will redirect back here.
      redirect('/sign-in?redirect_url=/ops');
    }
    email = user.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
    if (!email || !ADMIN_EMAILS.has(email)) {
      notFound();
    }
  }

  const [supabase, xai, clerk, inngest, dbActivity] = await Promise.all([
    probeSupabase(),
    probeXai(),
    probeClerk(),
    probeInngest(),
    probeDbActivity(),
  ]);

  const services: Probe[] = [supabase, xai, clerk, inngest];
  const env = checkEnv();
  const envByGroup = env.reduce<Record<string, typeof env>>((acc, e) => {
    (acc[e.group] ||= []).push(e);
    return acc;
  }, {});
  const missingRequired = env.filter((e) => e.required && !e.present);
  const overallDown = services.some((p) => p.status === 'down') || missingRequired.length > 0;
  const overallWarn = services.some((p) => p.status === 'warn');
  const overall: Status = overallDown ? 'down' : overallWarn ? 'warn' : 'ok';

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '40px 24px 80px',
        maxWidth: 1100,
        margin: '0 auto',
        color: 'var(--aq-text)',
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--aq-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Internal · ops
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>
              Apex Quantum drift{' '}
              <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <StatusDot status={overall} />
                <span style={{ color: STATUS_COLOR[overall], letterSpacing: 0.5 }}>
                  {STATUS_LABEL[overall]}
                </span>
              </span>
            </h1>
          </div>
          <form>
            <button
              type="submit"
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(0,245,255,0.08)',
                border: '1px solid rgba(0,245,255,0.3)',
                color: 'var(--aq-cyan)',
                fontFamily: 'var(--font-jetbrains)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ↻ refresh
            </button>
          </form>
        </div>
        <div style={{ fontSize: 12, color: 'var(--aq-muted)', marginTop: 8, fontFamily: 'var(--font-jetbrains)' }}>
          Probed {new Date().toISOString()} · {email}
        </div>
      </header>

      <Section title="Eksterne tjenester">
        <Grid>
          {services.map((p) => (
            <ProbeCard key={p.name} p={p} />
          ))}
        </Grid>
      </Section>

      <Section title="Database — siste aktivitet">
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={thStyle}>tabell</th>
                <th style={thStyle}>rader</th>
                <th style={thStyle}>siste aktivitet</th>
                <th style={thStyle}>kolonne</th>
              </tr>
            </thead>
            <tbody>
              {dbActivity.map((d) => (
                <tr key={d.table} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={tdStyle}>{d.table}</td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains)' }}>
                    {d.error ? <span style={{ color: 'var(--aq-red)' }}>err</span> : d.rows}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-jetbrains)', color: d.lastActivity ? 'var(--aq-text)' : 'var(--aq-muted)' }}>
                    {d.error ? d.error : fmtAge(d.lastActivity)}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--aq-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                    {d.lastActivityField ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Miljøvariabler${missingRequired.length ? ` · ${missingRequired.length} kritisk mangler` : ''}`}>
        <Grid>
          {Object.entries(envByGroup).map(([group, items]) => (
            <div
              key={group}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(10,10,20,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--aq-muted)', letterSpacing: 1, marginBottom: 8 }}>
                {group}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((e) => {
                  const bad = e.required && !e.present;
                  return (
                    <li
                      key={e.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'var(--font-jetbrains)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: bad ? 'var(--aq-red)' : 'var(--aq-text)' }}>{e.key}</span>
                      <span
                        style={{
                          color: e.present ? 'var(--aq-green)' : e.required ? 'var(--aq-red)' : 'var(--aq-muted)',
                        }}
                      >
                        {e.present ? '✓' : e.required ? '✗ required' : '·'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Grid>
      </Section>

      <Section title="Eksterne dashboards">
        <Grid>
          {[
            ['Vercel · deploys + cron logs', 'https://vercel.com/dashboard'],
            ['Supabase · DB + logs', 'https://supabase.com/dashboard/projects'],
            ['Clerk · auth + users', 'https://dashboard.clerk.com/'],
            ['xAI Console · billing + keys', 'https://console.x.ai/'],
            ['Inngest · function runs', 'https://app.inngest.com/'],
            ['Alpaca · brokerage (per-bruker)', 'https://app.alpaca.markets/'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(10,10,20,0.6)',
                border: '1px solid rgba(0,245,255,0.12)',
                color: 'var(--aq-cyan)',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              {label} →
            </a>
          ))}
        </Grid>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--aq-muted)', marginBottom: 14 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--aq-muted)',
  fontWeight: 500,
};
const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 13,
};
