'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

/**
 * /status — terminal-dialekt på marketingside (§9): en mono-tabell over
 * komponenter som FAKTISK måles fra denne siden i sanntid, med up-/warn-/
 * faint-dots og «SIST SJEKKET»-tidsstempel. Ingen fiktiv oppetid, ingen
 * håndvedlikeholdt «Operativ»-liste — kun det som måles idet du ser på.
 */

type Tone = 'up' | 'warn' | 'down' | 'faint';

interface Measurement {
  /** Målt API-svartid i ms; null = ikke målt ennå / feilet. */
  apiMs: number | null;
  apiOk: boolean | null;
  /** asOfIso fra timeline-APIet. */
  dataAsOf: string | null;
  /** Siste beslutning fra signalmotoren (max decidedAt). */
  lastDecision: string | null;
  /** Når målingen ble utført. */
  checkedAt: Date | null;
}

const EMPTY: Measurement = {
  apiMs: null,
  apiOk: null,
  dataAsOf: null,
  lastDecision: null,
  checkedAt: null,
};

const COPY = {
  no: {
    eye: 'Status',
    titlePre: 'Målt. ',
    titleEm: 'Ikke lovet',
    titlePost: '.',
    lede: 'Denne siden viser kun komponenter som faktisk måles i det øyeblikket du åpner den. Ingen håndsatt «alt er grønt»-liste, ingen fiktiv oppetid.',
    head: ['Komponent', 'Målt verdi', 'Status'],
    rows: {
      api: 'Innsyns-API (/api/transparency/timeline)',
      sync: 'Datasynk — siste publiserte tidslinje',
      engine: 'Signalmotor — siste beslutning',
    },
    states: {
      ok: 'SVARER',
      fail: 'SVARER IKKE',
      fresh: 'OPPDATERT',
      stale: 'ELDRE ENN 24 T',
      unknown: 'IKKE MÅLT',
      checking: 'MÅLER …',
    },
    lastChecked: 'SIST SJEKKET',
    recheck: 'Sjekk på nytt',
    note: 'Målingene gjøres fra din nettleser mot produksjonsmiljøet. Historisk oppetid rapporteres ikke før den faktisk måles og lagres — hendelseshistorikk publiseres her når vi har måledata å vise.',
    incidentsHead: 'Kjente hendelser',
    incidentsBody:
      'Ved driftshendelser varsles abonnenter på e-post. Denne siden viser sanntidsmålingen over — ikke en manuelt vedlikeholdt hendelseslogg.',
  },
  en: {
    eye: 'Status',
    titlePre: 'Measured. ',
    titleEm: 'Not promised',
    titlePost: '.',
    lede: 'This page only shows components that are actually measured the moment you open it. No hand-curated "all green" list, no fictional uptime.',
    head: ['Component', 'Measured value', 'Status'],
    rows: {
      api: 'Transparency API (/api/transparency/timeline)',
      sync: 'Data sync — latest published timeline',
      engine: 'Signal engine — latest decision',
    },
    states: {
      ok: 'RESPONDING',
      fail: 'NOT RESPONDING',
      fresh: 'UP TO DATE',
      stale: 'OLDER THAN 24 H',
      unknown: 'NOT MEASURED',
      checking: 'MEASURING …',
    },
    lastChecked: 'LAST CHECKED',
    recheck: 'Check again',
    note: 'Measurements are made from your browser against the production environment. Historical uptime is not reported until it is actually measured and stored — an incident history will be published here once we have measurement data to show.',
    incidentsHead: 'Known incidents',
    incidentsBody:
      'During operational incidents, subscribers are notified by email. This page shows the real-time measurement above — not a manually maintained incident log.',
  },
} as const;

function fmtClock(iso: string | null, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'no' ? 'nb-NO' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function freshness(iso: string | null): Tone {
  if (!iso) return 'faint';
  const age = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(age) || age < 0) return 'faint';
  return age < 24 * 60 * 60 * 1000 ? 'up' : 'warn';
}

export default function StatusPage() {
  const [m, setM] = useState<Measurement>(EMPTY);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const started = performance.now();
    try {
      const res = await fetch('/api/transparency/timeline', { cache: 'no-store' });
      const ms = Math.round(performance.now() - started);
      let dataAsOf: string | null = null;
      let lastDecision: string | null = null;
      if (res.ok) {
        try {
          const data: {
            ok?: boolean;
            rows?: Array<{ decidedAt?: string }>;
            asOfIso?: string;
          } = await res.json();
          dataAsOf = data.asOfIso ?? null;
          if (Array.isArray(data.rows) && data.rows.length > 0) {
            lastDecision = data.rows.reduce<string | null>((acc, r) => {
              if (!r.decidedAt) return acc;
              return !acc || r.decidedAt > acc ? r.decidedAt : acc;
            }, null);
          }
        } catch {
          /* svar uten JSON — behold null-verdier, målingen står */
        }
      }
      setM({
        apiMs: ms,
        apiOk: res.ok,
        dataAsOf,
        lastDecision,
        checkedAt: new Date(),
      });
    } catch {
      setM({
        apiMs: null,
        apiOk: false,
        dataAsOf: null,
        lastDecision: null,
        checkedAt: new Date(),
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        const apiTone: Tone =
          m.apiOk == null ? 'faint' : m.apiOk ? 'up' : 'down';
        const apiState =
          m.apiOk == null
            ? checking
              ? t.states.checking
              : t.states.unknown
            : m.apiOk
              ? t.states.ok
              : t.states.fail;
        const syncTone = freshness(m.dataAsOf);
        const engineTone = freshness(m.lastDecision);
        const toneState = (tone: Tone) =>
          tone === 'up' ? t.states.fresh : tone === 'warn' ? t.states.stale : t.states.unknown;
        return (
          <>
            <section className="pg-hero">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.eye}</span>
                <h1>
                  {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-sub" style={{ fontSize: 16.5 }}>{t.lede}</p>
              </div>
            </section>

            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <div className="pg-status-table">
                  <div className="pg-status-row head" aria-hidden>
                    <span>{t.head[0]}</span>
                    <span className="pg-status-val">{t.head[1]}</span>
                    <span>{t.head[2]}</span>
                  </div>
                  <div className="pg-status-row">
                    <span className="pg-status-name">{t.rows.api}</span>
                    <span className="pg-status-val">
                      {m.apiMs == null ? '—' : `${m.apiMs} ms`}
                    </span>
                    <span className="pg-status-state" data-tone={apiTone}>
                      <span className="pg-dot" data-tone={apiTone} aria-hidden />
                      {apiState}
                    </span>
                  </div>
                  <div className="pg-status-row">
                    <span className="pg-status-name">{t.rows.sync}</span>
                    <span className="pg-status-val" suppressHydrationWarning>
                      {fmtClock(m.dataAsOf, lang)}
                    </span>
                    <span className="pg-status-state" data-tone={syncTone}>
                      <span className="pg-dot" data-tone={syncTone} aria-hidden />
                      {toneState(syncTone)}
                    </span>
                  </div>
                  <div className="pg-status-row">
                    <span className="pg-status-name">{t.rows.engine}</span>
                    <span className="pg-status-val" suppressHydrationWarning>
                      {fmtClock(m.lastDecision, lang)}
                    </span>
                    <span className="pg-status-state" data-tone={engineTone}>
                      <span className="pg-dot" data-tone={engineTone} aria-hidden />
                      {toneState(engineTone)}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    marginTop: 20,
                  }}
                >
                  <span className="pg-mononote" suppressHydrationWarning>
                    {t.lastChecked}{' '}
                    {m.checkedAt
                      ? m.checkedAt.toLocaleTimeString(lang === 'no' ? 'nb-NO' : 'en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '—'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void runCheck()}
                    disabled={checking}
                  >
                    {t.recheck}
                  </button>
                </div>

                <div className="pg-note" style={{ marginTop: 48 }}>
                  <span className="pg-note-eye">{t.incidentsHead}</span>
                  <p>{t.note}</p>
                  <p>{t.incidentsBody}</p>
                </div>
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
