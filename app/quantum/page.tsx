'use client';

/**
 * /quantum — «Forvalterens bord» (§10 i masterdirektivet).
 *
 * Full rekonstruksjon av SKALLET i terminal-dialekten: CSS-grid på
 * 100dvh (56px topplinje / 1fr / 32px statuslinje), ingen partikler,
 * ingen neon, ingen entry-koreografi — investoren ser tallene
 * umiddelbart. All data er EKTE og kommer fra de samme API-rutene
 * som Max-cockpiten allerede bruker:
 *   - GET /api/apex/alpaca/connect   → tilkoblingsstatus + kontomiljø
 *   - GET /api/apex/performance?tf=  → porteføljeutvikling
 *   - GET /api/apex/positions        → posisjoner
 *   - GET /api/apex/recent-orders    → gjennomførte ordre
 *   - GET /api/transparency/timeline → motorens vurderinger (offentlig)
 * Mangler en live-verdi vises ærlig tomhet (§5.7) — aldri fiktive tall.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '@/app/components/marketing/types';
import { readLangCookie } from '@/lib/i18n/lang-cookie';
import { StatusLine } from '@/app/components/terminal/statusline';
import { Topline } from './components/topline';
import { LeftSidebar } from './components/left-sidebar';
import { RightSidebar } from './components/right-sidebar';
import { PriceChart } from './components/price-chart';
import { AIChat } from './components/ai-chat';
import { COCKPIT_COPY } from './lib/copy';
import type {
  CockpitDecision,
  CockpitOrder,
  CockpitPerformance,
  CockpitPosition,
  CockpitTf,
} from './lib/types';
import '@/app/components/marketing-v2/styles.css';
import '@/app/styles/terminal.css';

type LayoutMode = 'wide' | 'mid' | 'mobile';
type MobileTab = 'portfolio' | 'chart' | 'ai' | 'log';

/** ≤1100px: journalen blir tab i hovedflaten · ≤768px: bunn-tab-bar. */
function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>('wide');
  useEffect(() => {
    const midQ = window.matchMedia('(max-width: 1100px)');
    const mobQ = window.matchMedia('(max-width: 768px)');
    const update = () => {
      setMode(mobQ.matches ? 'mobile' : midQ.matches ? 'mid' : 'wide');
    };
    update();
    midQ.addEventListener('change', update);
    mobQ.addEventListener('change', update);
    return () => {
      midQ.removeEventListener('change', update);
      mobQ.removeEventListener('change', update);
    };
  }, []);
  return mode;
}

const POLL_MS = 15_000;
const TIMELINE_POLL_MS = 60_000;

export default function QuantumDashboard() {
  const [lang, setLang] = useState<Lang>('no');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [environment, setEnvironment] = useState<'paper' | 'live'>('paper');
  const [tf, setTf] = useState<CockpitTf>('24H');
  const [performance, setPerformance] = useState<CockpitPerformance | null>(null);
  const [positions, setPositions] = useState<CockpitPosition[] | null>(null);
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [orders, setOrders] = useState<CockpitOrder[] | null>(null);
  const [decisions, setDecisions] = useState<CockpitDecision[] | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<'overview' | 'journal'>('overview');
  const [mobileTab, setMobileTab] = useState<MobileTab>('portfolio');
  const layout = useLayoutMode();
  const t = COCKPIT_COPY[lang];

  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang) setLang(cookieLang);
  }, []);

  const markSynced = useCallback(() => {
    setLastSync(new Date().toLocaleTimeString('en-GB', { hour12: false }));
  }, []);

  // Kontodata — samme kilder og payloads som Max-klienten.
  const refreshAll = useCallback(async () => {
    try {
      const [perfRes, posRes, ordRes] = await Promise.all([
        fetch(`/api/apex/performance?tf=${encodeURIComponent(tf)}`, {
          credentials: 'include',
        }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/apex/positions', { credentials: 'include' }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch('/api/apex/recent-orders', { credentials: 'include' }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);
      let synced = false;
      if (perfRes?.current) {
        setPerformance(perfRes as CockpitPerformance);
        synced = true;
      }
      if (Array.isArray(posRes?.positions)) {
        setPositions(posRes.positions as CockpitPosition[]);
        if (typeof posRes.totalValue === 'number') setTotalValue(posRes.totalValue);
        synced = true;
      }
      if (Array.isArray(ordRes?.orders)) {
        setOrders(ordRes.orders as CockpitOrder[]);
        synced = true;
      }
      if (synced) markSynced();
    } catch {
      /* soft-fail; neste poll prøver igjen */
    }
  }, [tf, markSynced]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/apex/alpaca/connect', { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        if (data.connected) {
          setConnected(true);
          if (data.accountInfo?.environment === 'live') setEnvironment('live');
        } else {
          setConnected(false);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!connected) return;
    refreshAll();
    const id = setInterval(refreshAll, POLL_MS);
    return () => clearInterval(id);
  }, [connected, refreshAll]);

  // Motorens vurderinger — offentlig beslutningslogg, uavhengig av konto.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/transparency/timeline');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.ok || !Array.isArray(data.rows)) return;
        setDecisions(
          (data.rows as Array<Record<string, unknown>>).map((r) => ({
            id: Number(r.id),
            blueprintId: r.blueprintId as CockpitDecision['blueprintId'],
            decidedAt: String(r.decidedAt),
            thesis: (r.thesis as string | null) ?? null,
            failed: Boolean(r.failed),
          })),
        );
      } catch {
        /* soft-fail */
      }
    };
    load();
    const id = setInterval(load, TIMELINE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const changePct = performance?.current?.pnlPercent ?? null;
  const chatStatus = {
    totalValue,
    positionsCount: positions ? positions.length : null,
    changePct,
    tf,
  };

  const showLedger = layout !== 'mobile' || mobileTab === 'portfolio';
  const showJournalColumn = layout === 'wide';
  const journalInMain =
    (layout === 'mid' && mainTab === 'journal') ||
    (layout === 'mobile' && mobileTab === 'log');
  const showChart =
    layout === 'wide' ||
    (layout === 'mid' && mainTab === 'overview') ||
    (layout === 'mobile' && mobileTab === 'chart');
  const showChat =
    layout === 'wide' ||
    (layout === 'mid' && mainTab === 'overview') ||
    (layout === 'mobile' && mobileTab === 'ai');
  const showMain = layout !== 'mobile' || mobileTab !== 'portfolio';
  const mainIsSingle = [showChart, showChat, journalInMain].filter(Boolean).length === 1;

  return (
    <div className="aq-term aq-cockpit">
      <Topline lang={lang} connected={connected} environment={environment} />

      <div className="aq-ck-body">
        {showLedger && (
          <LeftSidebar
            lang={lang}
            connected={connected}
            positions={positions}
            totalValue={totalValue}
            changePct={changePct}
            tf={tf}
          />
        )}

        {showMain && (
          <main className="aq-ck-main" data-single={mainIsSingle || undefined}>
            {layout === 'mid' && (
              <div className="aq-ck-midtabs aq-ck-chips" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'overview'}
                  className="aq-ck-chip"
                  data-on={mainTab === 'overview' || undefined}
                  onClick={() => setMainTab('overview')}
                >
                  {t.tabOverview}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'journal'}
                  className="aq-ck-chip"
                  data-on={mainTab === 'journal' || undefined}
                  onClick={() => setMainTab('journal')}
                >
                  {t.tabJournal}
                </button>
              </div>
            )}

            {showChart && (
              <PriceChart
                lang={lang}
                connected={connected}
                performance={performance}
                tf={tf}
                onTf={setTf}
              />
            )}
            {showChat && <AIChat lang={lang} connected={connected} status={chatStatus} />}
            {journalInMain && (
              <RightSidebar lang={lang} orders={orders} decisions={decisions} embedded />
            )}
          </main>
        )}

        {showJournalColumn && (
          <RightSidebar lang={lang} orders={orders} decisions={decisions} />
        )}
      </div>

      {layout === 'mobile' && (
        <nav className="aq-ck-tabbar" aria-label="Cockpit">
          {(
            [
              ['portfolio', t.tabPortfolio],
              ['chart', t.tabChart],
              ['ai', t.tabAi],
              ['log', t.tabLog],
            ] as Array<[MobileTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="aq-ck-tab"
              data-on={mobileTab === key || undefined}
              onClick={() => setMobileTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <StatusLine
        lang={lang}
        lastSync={lastSync}
        modeOverride={
          environment === 'live'
            ? lang === 'no'
              ? 'LIVE TRADING · REELL KAPITAL'
              : 'LIVE TRADING · REAL CAPITAL'
            : undefined
        }
      />
    </div>
  );
}
