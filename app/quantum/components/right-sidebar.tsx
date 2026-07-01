'use client';

/**
 * «Journalen» (§10 høyre, 336px): hendelsesloggen som tidslinje —
 * EKTE kjøp/salg fra /api/apex/recent-orders og motorens vurderinger
 * fra /api/transparency/timeline. Gullprikker, mono-tidsstempler med
 * sekunder, én setning per hendelse, filterchips, og «N NYE»-pill når
 * brukeren har scrollet ned i loggen — aldri auto-scroll.
 *
 * Den gamle fabrikkerte watchlisten, «Asymmetrisk Scoring Engine» og
 * de funksjonsløse «Realloker nå»/«Purge & Evolve»-knappene er slettet
 * (§13.2 — ingen udokumenterte tall eller påståtte handlinger).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '@/app/components/marketing/types';
import { COCKPIT_COPY } from '../lib/copy';
import type { CockpitDecision, CockpitOrder } from '../lib/types';

type Filter = 'all' | 'trades' | 'signals';

interface JournalEvent {
  id: string;
  tsMs: number;
  kind: 'trade' | 'signal';
  side?: 'BUY' | 'SELL';
  status?: CockpitOrder['status'];
  title: string;
  meta: string;
}

function fmtTs(tsMs: number, lang: Lang): string {
  const d = new Date(tsMs);
  const date = d.toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
  });
  const time = d.toLocaleTimeString(lang === 'no' ? 'nb-NO' : 'en-GB', { hour12: false });
  return `${date} ${time}`;
}

function firstSentence(text: string, maxLen = 160): string {
  const idx = text.indexOf('. ');
  const s = idx > 20 ? text.slice(0, idx + 1) : text;
  return s.length > maxLen ? `${s.slice(0, maxLen - 1).trimEnd()}…` : s;
}

export function RightSidebar({
  lang,
  orders,
  decisions,
  embedded,
}: {
  lang: Lang;
  /** null = laster / ikke tilkoblet (ordrer krever konto) */
  orders: CockpitOrder[] | null;
  /** null = laster (offentlig beslutningslogg) */
  decisions: CockpitDecision[] | null;
  /** true når journalen rendres inne i hovedflaten (tab-modus) */
  embedded?: boolean;
}) {
  const t = COCKPIT_COPY[lang];
  const [filter, setFilter] = useState<Filter>('all');
  const [newCount, setNewCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

  const events: JournalEvent[] = useMemo(() => {
    const out: JournalEvent[] = [];
    for (const o of orders ?? []) {
      const ts = Date.parse(o.filledAt ?? o.submittedAt);
      if (!Number.isFinite(ts)) continue;
      const sideLabel =
        lang === 'no' ? (o.action === 'BUY' ? 'KJØP' : 'SALG') : o.action;
      const price =
        o.price > 0
          ? ` @ $${o.price.toLocaleString(lang === 'no' ? 'nb-NO' : 'en-US', { maximumFractionDigits: 2 })}`
          : '';
      const statusSuffix =
        o.status === 'ERR'
          ? ` — ${t.orderErr}`
          : o.status === 'PENDING'
            ? ` — ${t.orderPending}`
            : o.status === 'CANCELED'
              ? ` — ${t.orderCanceled}`
              : '';
      out.push({
        id: `o:${o.ticker}:${o.submittedAt}`,
        tsMs: ts,
        kind: 'trade',
        side: o.action,
        status: o.status,
        title: `${sideLabel} ${o.qty} ${o.ticker}${price}${statusSuffix}`,
        meta: sideLabel,
      });
    }
    for (const d of decisions ?? []) {
      const ts = Date.parse(d.decidedAt);
      if (!Number.isFinite(ts) || d.failed || !d.thesis) continue;
      out.push({
        id: `d:${d.id}`,
        tsMs: ts,
        kind: 'signal',
        title: firstSentence(d.thesis),
        meta: `${t.assessment} · ${t.blueprint[d.blueprintId]}`,
      });
    }
    out.sort((a, b) => b.tsMs - a.tsMs);
    return out;
  }, [orders, decisions, lang, t]);

  const visible = useMemo(() => {
    if (filter === 'trades') return events.filter((e) => e.kind === 'trade');
    if (filter === 'signals') return events.filter((e) => e.kind === 'signal');
    return events;
  }, [events, filter]);

  // «N NYE»-pill: tell nye hendelser når brukeren IKKE står øverst.
  // Vi scroller aldri listen for brukeren.
  useEffect(() => {
    if (seenIdsRef.current == null) {
      seenIdsRef.current = new Set(events.map((e) => e.id));
      return;
    }
    const seen = seenIdsRef.current;
    let fresh = 0;
    for (const e of events) if (!seen.has(e.id)) fresh += 1;
    if (fresh > 0) {
      const el = feedRef.current;
      const scrolledAway = !!el && el.scrollTop > 24;
      if (scrolledAway) setNewCount((n) => n + fresh);
      seenIdsRef.current = new Set(events.map((e) => e.id));
    }
  }, [events]);

  const handleScroll = () => {
    const el = feedRef.current;
    if (el && el.scrollTop <= 24 && newCount > 0) setNewCount(0);
  };

  const jumpToTop = () => {
    feedRef.current?.scrollTo({ top: 0 });
    setNewCount(0);
  };

  const loading = orders == null && decisions == null;

  return (
    <aside
      className="aq-ck-journal"
      data-embedded={embedded || undefined}
      aria-label={t.journalTitle}
    >
      <div className="aq-ck-col-head">{t.journalTitle}</div>

      <div className="aq-ck-chips" role="tablist" aria-label={t.journalTitle}>
        {(
          [
            ['all', t.filterAll],
            ['trades', t.filterTrades],
            ['signals', t.filterSignals],
          ] as Array<[Filter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className="aq-ck-chip"
            data-on={filter === key || undefined}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {newCount > 0 && (
        <button type="button" className="aq-ck-newpill" onClick={jumpToTop}>
          {newCount} {t.newEntries} ↑
        </button>
      )}

      {loading ? (
        <div className="aq-hatch aq-ck-hatch-fill">{t.dataUnavailable}</div>
      ) : visible.length === 0 ? (
        <div className="aq-hatch aq-ck-hatch-fill">{t.journalEmpty}</div>
      ) : (
        <div className="aq-ck-feed" ref={feedRef} onScroll={handleScroll}>
          {visible.map((e) => (
            <div key={e.id} className="aq-ck-event">
              <div className="aq-ck-event-ts">
                <span className="aq-num" suppressHydrationWarning>
                  {fmtTs(e.tsMs, lang)}
                </span>
                <span
                  className="aq-ck-event-kind"
                  data-status={e.status === 'ERR' ? 'err' : undefined}
                >
                  {e.meta}
                </span>
              </div>
              <div className="aq-ck-event-title">
                {e.kind === 'trade' ? (
                  <span
                    className="aq-num"
                    data-side={e.side === 'BUY' ? 'up' : 'down'}
                  >
                    {e.title}
                  </span>
                ) : (
                  e.title
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
