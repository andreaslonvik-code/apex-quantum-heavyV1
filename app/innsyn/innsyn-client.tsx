'use client';

import { useEffect, useState } from 'react';
import '../components/marketing-v2/styles.css';
import './innsyn.css';
import type { Lang } from '../components/marketing/types';
import type { GrokDecision } from '@/lib/grok';
import type { TradeOutcome } from '@/lib/grok-decisions';
import { HeaderV2 } from '../components/marketing-v2/header';
import { FooterV2 } from '../components/marketing-v2/cta-footer';

interface TimelineRow {
  id: number;
  blueprintId: 'stocks' | 'crypto' | 'commodities';
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
  tradeOutcomes: TradeOutcome[];
  sourcesUsed: number | null;
  failed: boolean;
}

interface TimelineResponse {
  ok: boolean;
  rows?: TimelineRow[];
  asOfIso?: string;
}

const COPY: Record<Lang, {
  pageTitle: { pre: string; em: string; post: string };
  eye: string;
  lede: string;
  body: string;
  statDecisions: string;
  statSources: string;
  statLastUpdate: string;
  loading: string;
  empty: string;
  blueprints: Record<TimelineRow['blueprintId'], string>;
  actions: Record<'BUY' | 'SELL' | 'HOLD', string>;
  status: Record<'OK' | 'SKIP' | 'ERR', string>;
  sourcesSuffix: string;
  thesisLabel: string;
  decisionsLabel: string;
  failedLabel: string;
  liveBadge: string;
  ago: { sec: string; min: string; hour: string; day: string };
  intro: string;
  noteHead: string;
  noteBody: string;
}> = {
  no: {
    pageTitle: { pre: 'Hver beslutning. Hver kilde. ', em: 'Live', post: '.' },
    eye: '00 · INNSYN',
    lede:
      'Apex Quantum tar mange titalls beslutninger om dagen. Her kan du følge dem i sanntid — hva motoren tenkte, hvorfor, og hva som faktisk ble utført.',
    body:
      'Strømmen under viser leder-kontoens autentiske handlinger. Ingenting er kuratert. Når motoren venter, ser du det. Når den feiler en ordre, ser du det. Når den selger et lykkebarn, leser du begrunnelsen.',
    statDecisions: 'beslutninger',
    statSources: 'kilder',
    statLastUpdate: 'sist oppdatert',
    loading: 'Henter siste beslutninger …',
    empty: 'Ingen beslutninger funnet enda. Sjekk tilbake om noen minutter.',
    blueprints: { stocks: 'Aksjer', crypto: 'Krypto', commodities: 'Råvarer' },
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD' },
    status: { OK: 'INNSENDT', SKIP: 'HOPPET', ERR: 'AVVIST' },
    sourcesSuffix: 'kilder konsultert',
    thesisLabel: 'Tese',
    decisionsLabel: 'Per ticker',
    failedLabel: 'Beslutning feilet',
    liveBadge: 'LIVE',
    ago: { sec: 's', min: 'min', hour: 't', day: 'd' },
    intro: 'Hva du ser',
    noteHead: 'Hvorfor vi viser dette',
    noteBody:
      'AI-trading er bygd på tillit. Den eneste måten å bygge tillit på er å vise prosessen — hver tick, hver kilde, hver beslutning. Resultatene under er ikke kuratert markedsføringsmateriale; det er hvordan motoren faktisk fungerer akkurat nå.',
  },
  en: {
    pageTitle: { pre: 'Every decision. Every source. ', em: 'Live', post: '.' },
    eye: '00 · TRANSPARENCY',
    lede:
      'Apex Quantum makes dozens of decisions per day. Watch them in real time — what the engine considered, why, and what actually executed.',
    body:
      'The stream below is the leader account’s genuine action log. Nothing is curated. When the engine waits, you see it. When an order fails, you see it. When it sells a winner, you read the reason.',
    statDecisions: 'decisions',
    statSources: 'sources',
    statLastUpdate: 'last update',
    loading: 'Loading latest decisions …',
    empty: 'No decisions found yet. Check back in a few minutes.',
    blueprints: { stocks: 'Equities', crypto: 'Crypto', commodities: 'Commodities' },
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD' },
    status: { OK: 'SUBMITTED', SKIP: 'SKIPPED', ERR: 'REJECTED' },
    sourcesSuffix: 'sources consulted',
    thesisLabel: 'Thesis',
    decisionsLabel: 'Per ticker',
    failedLabel: 'Decision failed',
    liveBadge: 'LIVE',
    ago: { sec: 's', min: 'm', hour: 'h', day: 'd' },
    intro: 'What you’re seeing',
    noteHead: 'Why we publish this',
    noteBody:
      'AI trading runs on trust. The only honest way to earn it is to expose the process — every tick, every source, every decision. The stream below is not curated marketing; it is how the engine actually behaves right now.',
  },
};

function formatRelative(iso: string, lang: Lang): string {
  const t = COPY[lang].ago;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}${t.sec}`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}${t.min}`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}${t.hour}`;
  const day = Math.floor(hour / 24);
  return `${day}${t.day}`;
}

function formatClock(iso: string, lang: Lang): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === 'no' ? 'nb-NO' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function outcomeFor(
  decision: GrokDecision,
  outcomes: TradeOutcome[],
): TradeOutcome | null {
  return (
    outcomes.find(
      (o) => o.ticker === decision.ticker && o.action === decision.action,
    ) ?? null
  );
}

export function InnsynClient({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [rows, setRows] = useState<TimelineRow[] | null>(null);
  const [asOfIso, setAsOfIso] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const t = COPY[lang];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/transparency/timeline', { cache: 'no-store' });
        if (!res.ok) return;
        const data: TimelineResponse = await res.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.rows)) {
          setRows(data.rows);
          setAsOfIso(data.asOfIso ?? new Date().toISOString());
        } else if (rows === null) {
          setRows([]);
        }
      } catch {
        if (rows === null) setRows([]);
      }
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // We deliberately want a stable interval; refreshing on `rows` change
    // would re-fetch on every update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render every 15 s so relative timestamps stay fresh without
  // re-fetching the API.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const decisionsCount = rows?.length ?? 0;
  const sourcesCount = rows
    ? rows.reduce((sum, r) => sum + (r.sourcesUsed ?? 0), 0)
    : 0;

  return (
    <div className="aqv2">
      <div className="atmosphere" aria-hidden="true" />
      <div className="aqv2-grain" aria-hidden="true" />
      <HeaderV2 lang={lang} setLang={setLang} />
      <main>
        <section className="innsyn-hero">
          <div className="container">
            <span className="eyebrow cy">
              <span className="rule" />
              {t.eye}
            </span>
            <h1 className="innsyn-title">
              {t.pageTitle.pre}
              <em>{t.pageTitle.em}</em>
              {t.pageTitle.post}
            </h1>
            <p className="innsyn-lede">{t.lede}</p>
            <p className="innsyn-body">{t.body}</p>

            <div className="innsyn-stats">
              <div className="innsyn-stat">
                <span className="innsyn-stat-num">{decisionsCount}</span>
                <span className="innsyn-stat-lbl">{t.statDecisions}</span>
              </div>
              <div className="innsyn-stat">
                <span className="innsyn-stat-num">{sourcesCount}</span>
                <span className="innsyn-stat-lbl">{t.statSources}</span>
              </div>
              <div className="innsyn-stat">
                <span className="innsyn-stat-num innsyn-stat-num-soft">
                  {asOfIso ? formatRelative(asOfIso, lang) : '—'}
                </span>
                <span className="innsyn-stat-lbl">{t.statLastUpdate}</span>
              </div>
              <div className="innsyn-live">
                <span className="innsyn-live-dot" />
                {t.liveBadge}
              </div>
            </div>
          </div>
        </section>

        <section className="band-parch innsyn-band">
          <div className="container">
            <span className="eyebrow">
              <span className="rule" />
              {t.intro}
            </span>
            <h2 className="innsyn-h2">{t.noteHead}</h2>
            <p className="innsyn-note">{t.noteBody}</p>
          </div>
        </section>

        <section className="innsyn-timeline">
          <div className="container">
            {rows === null ? (
              <p className="innsyn-loading">{t.loading}</p>
            ) : rows.length === 0 ? (
              <p className="innsyn-loading">{t.empty}</p>
            ) : (
              <ol className="innsyn-list">
                {rows.map((row) => (
                  <li key={row.id} className="innsyn-row">
                    <div className="innsyn-row-rail" />
                    <article className="innsyn-card">
                      <header className="innsyn-card-head">
                        <span className="innsyn-blueprint">
                          {t.blueprints[row.blueprintId]}
                        </span>
                        <span className="innsyn-time" title={row.decidedAt}>
                          {formatClock(row.decidedAt, lang)}
                          <span className="innsyn-time-rel">
                            · {formatRelative(row.decidedAt, lang)}
                          </span>
                        </span>
                      </header>

                      {row.failed ? (
                        <p className="innsyn-failed">{t.failedLabel}</p>
                      ) : (
                        <>
                          {row.thesis && (
                            <div className="innsyn-thesis">
                              <span className="innsyn-label">{t.thesisLabel}</span>
                              <p>{row.thesis}</p>
                            </div>
                          )}

                          {row.decisions.length > 0 && (
                            <div className="innsyn-decisions">
                              <span className="innsyn-label">
                                {t.decisionsLabel}
                              </span>
                              <ul>
                                {row.decisions.map((d, i) => {
                                  const outcome = outcomeFor(d, row.tradeOutcomes);
                                  const status = outcome?.status;
                                  const statusKey =
                                    status === 'OK' || status === 'SKIP' || status === 'ERR'
                                      ? status
                                      : null;
                                  return (
                                    <li
                                      key={`${row.id}-${d.ticker}-${i}`}
                                      className="innsyn-dec"
                                    >
                                      <span className="innsyn-tk">{d.ticker}</span>
                                      <span
                                        className={`innsyn-act innsyn-act-${d.action.toLowerCase()}`}
                                      >
                                        {t.actions[d.action]}
                                      </span>
                                      {statusKey && (
                                        <span
                                          className={`innsyn-pill innsyn-pill-${statusKey.toLowerCase()}`}
                                        >
                                          {t.status[statusKey]}
                                        </span>
                                      )}
                                      <span className="innsyn-reason">
                                        {outcome?.error
                                          ? `${d.reason} — ${outcome.error.slice(0, 110)}`
                                          : statusKey === 'SKIP' && outcome?.reason
                                            ? `${d.reason} · ${outcome.reason.slice(0, 110)}`
                                            : d.reason}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {row.sourcesUsed != null && row.sourcesUsed > 0 && (
                            <footer className="innsyn-card-foot">
                              <span className="innsyn-sources-dot" />
                              {row.sourcesUsed} {t.sourcesSuffix}
                            </footer>
                          )}
                        </>
                      )}
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <FooterV2 lang={lang} />
      </main>
    </div>
  );
}
