'use client';

import { useEffect, useMemo, useState } from 'react';
import '../components/marketing-v2/styles.css';
import './innsyn.css';
import type { Lang } from '../components/marketing/types';
import type { GrokCatalyst, GrokDecision } from '@/lib/grok';
import { HeaderV2 } from '../components/marketing-v2/header';
import { FooterV2 } from '../components/marketing-v2/cta-footer';

/** Public-safe view — mirrors /api/transparency/timeline's PublicTradeOutcome.
 *  H8: raw `error` strings are NEVER published; only a stable `error_code`. */
interface PublicTradeOutcome {
  ticker: string;
  action: 'BUY' | 'SELL';
  status: 'OK' | 'ERR' | 'SKIP';
  notional: number;
  qty: number;
  reason: string;
  error_code?: string;
}

interface TimelineRow {
  id: number;
  blueprintId: 'stocks' | 'crypto' | 'commodities';
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
  tradeOutcomes: PublicTradeOutcome[];
  catalysts: GrokCatalyst[];
  sourcesUsed: number | null;
  failed: boolean;
}

interface TimelineResponse {
  ok: boolean;
  rows?: TimelineRow[];
  asOfIso?: string;
}

/** A flattened "event" entry derived from one catalyst inside one scan. */
interface EventEntry {
  /** Stable key for React. */
  key: string;
  catalyst: GrokCatalyst;
  blueprintId: TimelineRow['blueprintId'];
  decidedAt: string;
  /** Decisions in the same scan whose ticker matches the catalyst.tickers
   *  set — these are the bot's response to the event. */
  relatedDecisions: Array<{ decision: GrokDecision; outcome: PublicTradeOutcome | null }>;
  /** Total live-search sources used for the scan that produced this event. */
  sourcesUsed: number | null;
}

type CategoryKey = GrokCatalyst['category'];

const CATEGORY_LABEL: Record<Lang, Record<CategoryKey, string>> = {
  no: {
    trump: 'Trump',
    macro: 'Makro',
    geopolitics: 'Geopolitikk',
    earnings: 'Earnings',
    sector: 'Sektor',
    company: 'Selskap',
    other: 'Annet',
  },
  en: {
    trump: 'Trump',
    macro: 'Macro',
    geopolitics: 'Geopolitics',
    earnings: 'Earnings',
    sector: 'Sector',
    company: 'Company',
    other: 'Other',
  },
};

const COPY: Record<Lang, {
  pageTitle: { pre: string; em: string; post: string };
  eye: string;
  lede: string;
  body: string;
  statEvents: string;
  statActions: string;
  statSources: string;
  statLastUpdate: string;
  loading: string;
  empty: string;
  emptyHint: string;
  blueprints: Record<TimelineRow['blueprintId'], string>;
  actions: Record<'BUY' | 'SELL' | 'HOLD', string>;
  status: Record<'OK' | 'SKIP' | 'ERR', string>;
  sourcesSuffix: string;
  actionLabel: string;
  thesisLabel: string;
  failedLabel: string;
  liveBadge: string;
  ago: { sec: string; min: string; hour: string; day: string };
  noteHead: string;
  noteBody: string;
  noteEye: string;
  readArticle: string;
}> = {
  no: {
    pageTitle: { pre: 'Hendelsene som driver ', em: 'hver handel', post: '.' },
    eye: '00 · INNSYN',
    lede:
      'Når et utsagn fra Trump, en makro-print eller en sektor-rotasjon flytter markedet, leser motoren det og bestemmer hva som skal skje. Her vises hver eksterne hendelse — og hva boten gjorde med den.',
    body:
      'Strømmen under er leder-kontoens autentiske aktivitet. Hendelsene under er sitert av motoren via Live Search; handlingene er det den faktisk gjorde i samme scan. Ingenting er kuratert.',
    statEvents: 'hendelser',
    statActions: 'handlinger',
    statSources: 'kilder',
    statLastUpdate: 'sist oppdatert',
    loading: 'Henter siste hendelser …',
    empty: 'Ingen merkbar nyhetsdriver i siste scan-vindu.',
    emptyHint:
      'Motoren har kjørt rutinemessig vedlikehold, men ikke flagget noen ekstern hendelse som driver. Hendelser dukker opp her så snart en Trump-post, makro-print, geopol-eskalering eller sektor-rotasjon påvirker porteføljen.',
    blueprints: { stocks: 'Aksjer', crypto: 'Krypto', commodities: 'Råvarer' },
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD' },
    status: { OK: 'INNSENDT', SKIP: 'HOPPET', ERR: 'AVVIST' },
    sourcesSuffix: 'kilder i scan',
    actionLabel: 'Hva boten gjorde',
    thesisLabel: 'Tese i samme scan',
    failedLabel: 'Beslutning feilet',
    liveBadge: 'LIVE',
    ago: { sec: 's', min: 'min', hour: 't', day: 'd' },
    noteHead: 'Hvorfor vi viser dette',
    noteBody:
      'AI-trading er bygd på tillit. Vi viser hendelsene som drev hver handel — Trump-poster, tariffer, makro-prints, sektor-rotasjoner — og hva motoren gjorde med dem. Ikke kuratert. Bare det som faktisk skjedde, slik det skjedde.',
    noteEye: 'Hva du ser',
    readArticle: 'Les',
  },
  en: {
    pageTitle: { pre: 'The events that drive ', em: 'every trade', post: '.' },
    eye: '00 · TRANSPARENCY',
    lede:
      'When a Trump statement, macro print or sector rotation moves the market, the engine reads it and decides what happens next. Each external event — and what the bot did with it — is shown below.',
    body:
      'The stream below is the leader account’s genuine activity. The events are cited by the engine via Live Search; the actions are what it actually did in the same scan. Nothing curated.',
    statEvents: 'events',
    statActions: 'actions',
    statSources: 'sources',
    statLastUpdate: 'last update',
    loading: 'Loading latest events …',
    empty: 'No notable news driver in the recent scans.',
    emptyHint:
      'The engine has been running routine maintenance but has not flagged an external event as a driver. Events appear here the moment a Trump post, macro print, geopolitical escalation, or sector rotation moves the portfolio.',
    blueprints: { stocks: 'Equities', crypto: 'Crypto', commodities: 'Commodities' },
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD' },
    status: { OK: 'SUBMITTED', SKIP: 'SKIPPED', ERR: 'REJECTED' },
    sourcesSuffix: 'sources in scan',
    actionLabel: 'What the bot did',
    thesisLabel: 'Thesis in the same scan',
    failedLabel: 'Decision failed',
    liveBadge: 'LIVE',
    ago: { sec: 's', min: 'm', hour: 'h', day: 'd' },
    noteHead: 'Why we publish this',
    noteBody:
      'AI trading runs on trust. We expose the events that drove each trade — Trump posts, tariffs, macro prints, sector rotations — and what the engine did with them. Not curated. Just what actually happened, as it happened.',
    noteEye: 'What you’re seeing',
    readArticle: 'Read',
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

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function flattenEvents(rows: TimelineRow[]): EventEntry[] {
  const out: EventEntry[] = [];
  for (const row of rows) {
    if (!row.catalysts || row.catalysts.length === 0) continue;
    for (let i = 0; i < row.catalysts.length; i++) {
      const c = row.catalysts[i];
      const tickerSet = new Set(c.tickers.map((t) => t.toUpperCase()));
      const related: EventEntry['relatedDecisions'] = [];
      for (const d of row.decisions) {
        if (!tickerSet.has(d.ticker.toUpperCase())) continue;
        const outcome =
          row.tradeOutcomes.find(
            (o) => o.ticker === d.ticker && o.action === d.action,
          ) ?? null;
        related.push({ decision: d, outcome });
      }
      out.push({
        key: `${row.id}-${i}`,
        catalyst: c,
        blueprintId: row.blueprintId,
        decidedAt: row.decidedAt,
        relatedDecisions: related,
        sourcesUsed: row.sourcesUsed,
      });
    }
  }
  return out;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render every 15 s so relative timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const events = useMemo(() => (rows ? flattenEvents(rows) : []), [rows]);

  const actionsCount = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum, r) => sum + r.tradeOutcomes.filter((o) => o.status === 'OK').length, 0);
  }, [rows]);
  const sourcesCount = useMemo(
    () => (rows ? rows.reduce((sum, r) => sum + (r.sourcesUsed ?? 0), 0) : 0),
    [rows],
  );

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
                <span className="innsyn-stat-num">{events.length}</span>
                <span className="innsyn-stat-lbl">{t.statEvents}</span>
              </div>
              <div className="innsyn-stat">
                <span className="innsyn-stat-num">{actionsCount}</span>
                <span className="innsyn-stat-lbl">{t.statActions}</span>
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
              {t.noteEye}
            </span>
            <h2 className="innsyn-h2">{t.noteHead}</h2>
            <p className="innsyn-note">{t.noteBody}</p>
          </div>
        </section>

        <section className="innsyn-timeline">
          <div className="container">
            {rows === null ? (
              <p className="innsyn-loading">{t.loading}</p>
            ) : events.length === 0 ? (
              <div className="innsyn-empty">
                <p className="innsyn-empty-headline">{t.empty}</p>
                <p className="innsyn-empty-body">{t.emptyHint}</p>
              </div>
            ) : (
              <ol className="innsyn-list">
                {events.map((ev) => (
                  <li key={ev.key} className="innsyn-row">
                    <div className="innsyn-row-rail" />
                    <span
                      className={`innsyn-row-dot innsyn-cat-${ev.catalyst.category}`}
                      aria-hidden="true"
                    />
                    <article className="innsyn-card">
                      <header className="innsyn-card-head">
                        <span
                          className={`innsyn-cat innsyn-cat-${ev.catalyst.category}`}
                        >
                          {CATEGORY_LABEL[lang][ev.catalyst.category]}
                        </span>
                        <span className="innsyn-blueprint">
                          · {t.blueprints[ev.blueprintId]}
                        </span>
                        <span className="innsyn-time" title={ev.decidedAt}>
                          {formatClock(ev.decidedAt, lang)}
                          <span className="innsyn-time-rel">
                            · {formatRelative(ev.decidedAt, lang)}
                          </span>
                        </span>
                      </header>

                      <h3 className="innsyn-event-title">{ev.catalyst.title}</h3>
                      {ev.catalyst.summary && (
                        <p className="innsyn-event-summary">
                          {ev.catalyst.summary}
                        </p>
                      )}

                      {ev.catalyst.sources.length > 0 && (
                        <div className="innsyn-sources">
                          {ev.catalyst.sources.map((s, i) => (
                            <a
                              key={`${ev.key}-src-${i}`}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="innsyn-source"
                            >
                              <span className="innsyn-source-host">
                                {hostFromUrl(s.url)}
                              </span>
                              <span className="innsyn-source-headline">
                                {s.headline ?? t.readArticle}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                      {ev.relatedDecisions.length > 0 && (
                        <div className="innsyn-action">
                          <span className="innsyn-label">{t.actionLabel}</span>
                          <ul>
                            {ev.relatedDecisions.map(({ decision, outcome }, i) => {
                              const status = outcome?.status;
                              const statusKey =
                                status === 'OK' || status === 'SKIP' || status === 'ERR'
                                  ? status
                                  : null;
                              return (
                                <li
                                  key={`${ev.key}-d-${i}`}
                                  className="innsyn-dec"
                                >
                                  <span className="innsyn-tk">{decision.ticker}</span>
                                  <span
                                    className={`innsyn-act innsyn-act-${decision.action.toLowerCase()}`}
                                  >
                                    {t.actions[decision.action]}
                                  </span>
                                  {statusKey && (
                                    <span
                                      className={`innsyn-pill innsyn-pill-${statusKey.toLowerCase()}`}
                                    >
                                      {t.status[statusKey]}
                                    </span>
                                  )}
                                  <span className="innsyn-reason">
                                    {outcome?.error_code
                                      ? `${decision.reason} — ${outcome.error_code}`
                                      : statusKey === 'SKIP' && outcome?.reason
                                        ? `${decision.reason} · ${outcome.reason.slice(0, 110)}`
                                        : decision.reason}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {ev.sourcesUsed != null && ev.sourcesUsed > 0 && (
                        <footer className="innsyn-card-foot">
                          <span className="innsyn-sources-dot" />
                          {ev.sourcesUsed} {t.sourcesSuffix}
                        </footer>
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
