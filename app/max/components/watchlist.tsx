'use client';

import { useState } from 'react';
import { I18N, formatMoney, fmtUSD, type Currency, type Lang } from './i18n';
import { sectorOf, type Sector } from '@/lib/blueprints/sectors';

export type Signal = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

export interface WatchlistRow {
  ticker: string;
  name: string;
  qty: number;
  avg: number;
  mark: number;
  signal: Signal;
  /** Position market value as a % of total account capital. Only set for
   *  held positions in the "Mine posisjoner" panel. */
  weightPct?: number;
}

interface Props {
  lang: Lang;
  rows: WatchlistRow[];
  /** Optional override of the panel title (default = i18n watchlistTitle). */
  title?: string;
  /** Optional override of the panel subtitle. */
  subtitle?: string;
  /** When true, render a "VEKT" column showing each position's share of
   *  total capital. Used by the "Mine posisjoner" panel. */
  showWeight?: boolean;
  /** When true, the panel head is a clickable button that toggles the body.
   *  A chevron rotates to indicate state. */
  collapsible?: boolean;
  /** Initial expanded state when collapsible. Default true. */
  defaultExpanded?: boolean;
  /** Group rows by sector (using sectorOf). Renders a mono caps sub-header
   *  per sector. Only meaningful for the stocks blueprint — crypto and
   *  commodities tickers fall into "Other" and read better flat. */
  groupBySector?: boolean;
  /** Display currency for monetary columns (avg, mark, P&L). Defaults to USD
   *  if omitted so older call sites keep working. */
  displayCurrency?: Currency;
  /** USD→NOK rate for conversion. Ignored unless displayCurrency='NOK'. */
  fxRate?: number | null;
}

type GroupKey = Sector | 'other';

const SECTOR_LABELS: Record<GroupKey, { no: string; en: string }> = {
  tech_ai:       { no: 'Tech / AI',         en: 'Tech / AI' },
  consumer:      { no: 'Forbruker',         en: 'Consumer' },
  health:        { no: 'Helse',             en: 'Health' },
  energy:        { no: 'Energi',            en: 'Energy' },
  financial:     { no: 'Finans',            en: 'Financial' },
  industrial:    { no: 'Industri',          en: 'Industrial' },
  auto_ev:       { no: 'Bil / EV',          en: 'Auto / EV' },
  telecom_media: { no: 'Telekom & Media',   en: 'Telecom & Media' },
  other:         { no: 'Annet',             en: 'Other' },
};

const SECTOR_ORDER: GroupKey[] = [
  'tech_ai', 'health', 'energy', 'industrial',
  'financial', 'consumer', 'auto_ev', 'telecom_media', 'other',
];

function sortRows(rows: WatchlistRow[]): WatchlistRow[] {
  // Holdings first (by descending market value), then watch-only alphabetical.
  return [...rows].sort((a, b) => {
    const aHeld = a.qty > 0 ? 1 : 0;
    const bHeld = b.qty > 0 ? 1 : 0;
    if (aHeld !== bHeld) return bHeld - aHeld;
    if (aHeld) return b.qty * b.mark - a.qty * a.mark;
    return a.ticker.localeCompare(b.ticker);
  });
}

export function Watchlist({
  lang,
  rows,
  title,
  subtitle,
  showWeight = false,
  collapsible = false,
  defaultExpanded = true,
  groupBySector = false,
  displayCurrency = 'USD',
  fxRate = null,
}: Props) {
  const t = I18N[lang];
  const sigLabel: Record<Signal, string> = {
    BUY: t.sigBuy,
    SELL: t.sigSell,
    HOLD: t.sigHold,
    WATCH: t.sigWatch,
  };
  const [expanded, setExpanded] = useState(defaultExpanded);

  const sorted = sortRows(rows);
  const heldCount = sorted.filter((r) => r.qty > 0).length;
  const colCount = showWeight ? 8 : 7;

  // Group rows by sector (stocks only) or one flat group (crypto / commodities
  // / Mine posisjoner). Sectors render in SECTOR_ORDER so tech/AI sits up top.
  const groups: Array<{ key: GroupKey; rows: WatchlistRow[] }> = groupBySector
    ? (() => {
        const map = new Map<GroupKey, WatchlistRow[]>();
        for (const r of sorted) {
          const sec = (sectorOf(r.ticker) ?? 'other') as GroupKey;
          const bucket = map.get(sec) ?? [];
          bucket.push(r);
          map.set(sec, bucket);
        }
        return SECTOR_ORDER
          .filter((k) => map.has(k))
          .map((k) => ({ key: k, rows: map.get(k) ?? [] }));
      })()
    : [{ key: 'other', rows: sorted }];

  // Per-share price formatter — keeps 2 decimals because individual share
  // prices need cent-precision even in NOK (otherwise $182.43 → "2 020 kr"
  // hides moves under 1%). P&L gets 0-decimals to keep the table calm.
  const fmtPrice = (usd: number): string =>
    displayCurrency === 'NOK' && fxRate
      ? formatMoney(usd, 'NOK', fxRate, { decimals: 2 })
      : `$${fmtUSD(usd)}`;
  const fmtPnl = (usd: number): string =>
    formatMoney(usd, displayCurrency, fxRate, { decimals: 0, signed: true });

  const renderRow = (p: WatchlistRow) => {
    const held = p.qty > 0;
    const pnl = held ? (p.mark - p.avg) * p.qty : 0;
    const pct = held && p.avg > 0 ? (p.mark / p.avg - 1) * 100 : 0;
    const up = pnl >= 0;
    const sigClass = `sig sig-${p.signal.toLowerCase()}`;
    const arrow = p.signal === 'BUY' ? '▲ ' : p.signal === 'SELL' ? '▼ ' : p.signal === 'WATCH' ? '◌ ' : '— ';
    return (
      <tr key={p.ticker} className={held ? '' : 'tr-watch'}>
        <td>
          <div className="tk-row">
            <span className={`tk-bullet ${held ? 'tk-bullet-held' : 'tk-bullet-watch'}`} />
            <div>
              <div className="tk-name">{p.ticker}</div>
              <div className="tk-sub">{p.name}</div>
            </div>
          </div>
        </td>
        <td className="r aq-mono">{held ? p.qty : <span className="mute">—</span>}</td>
        <td className="r aq-mono">{held ? fmtPrice(p.avg) : <span className="mute">—</span>}</td>
        <td className={`r aq-mono ${held ? '' : 'mute'}`}>
          {p.mark > 0 ? fmtPrice(p.mark) : <span className="mute">—</span>}
        </td>
        <td className={`r aq-mono ${held ? (up ? 'up' : 'dn') : 'mute'}`}>
          {held ? fmtPnl(pnl) : '—'}
        </td>
        <td className={`r aq-mono ${held ? (up ? 'up' : 'dn') : 'mute'}`}>
          {held ? `${up ? '+' : ''}${pct.toFixed(2)}%` : '—'}
        </td>
        {showWeight && (
          <td className={`r aq-mono ${held && p.weightPct != null ? '' : 'mute'}`}>
            {held && p.weightPct != null ? `${p.weightPct.toFixed(1)} %` : '—'}
          </td>
        )}
        <td className="r">
          <span className={sigClass}>
            {arrow}
            {sigLabel[p.signal]}
          </span>
        </td>
      </tr>
    );
  };

  const summary = (
    <>
      <div>
        <div className="cap">{title ?? t.watchlistTitle}</div>
        <div className="panel-sub">{subtitle ?? t.watchlistSub}</div>
      </div>
      <div className="panel-head-r">
        <span className="tag">
          {heldCount}/{rows.length} {t.holding.toLowerCase()}
        </span>
        <span className="tag tag-live">
          <span className="dot" />
          {t.streaming}
        </span>
        {collapsible && (
          <span className={`watchlist-chevron ${expanded ? 'is-open' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={`panel ${collapsible ? 'panel-collapsible' : ''}`}>
      {collapsible ? (
        <button
          type="button"
          className="panel-head panel-head-btn"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {summary}
        </button>
      ) : (
        <div className="panel-head">{summary}</div>
      )}
      {(!collapsible || expanded) && (
        <table className="dtable-v8">
          <thead>
            <tr>
              <th>{t.ticker}</th>
              <th className="r">{t.qty}</th>
              <th className="r">{t.avg}</th>
              <th className="r">{t.mark}</th>
              <th className="r">{t.pnl}</th>
              <th className="r">{t.pct}</th>
              {showWeight && <th className="r">{t.weight}</th>}
              <th className="r">{t.signal}</th>
            </tr>
          </thead>
          {groups.map(({ key, rows: groupRows }) => (
            <tbody key={key}>
              {groupBySector && (
                <tr className="sector-row">
                  <td colSpan={colCount}>
                    <span className="sector-name">{SECTOR_LABELS[key][lang]}</span>
                    <span className="sector-count">{groupRows.length}</span>
                  </td>
                </tr>
              )}
              {groupRows.map(renderRow)}
            </tbody>
          ))}
        </table>
      )}
    </div>
  );
}
