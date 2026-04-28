'use client';

import { I18N, fmtUSD, type Lang } from './i18n';

export type Signal = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

export interface WatchlistRow {
  ticker: string;
  name: string;
  qty: number;
  avg: number;
  mark: number;
  signal: Signal;
}

interface Props {
  lang: Lang;
  rows: WatchlistRow[];
}

export function Watchlist({ lang, rows }: Props) {
  const t = I18N[lang];
  const sigLabel: Record<Signal, string> = {
    BUY: t.sigBuy,
    SELL: t.sigSell,
    HOLD: t.sigHold,
    WATCH: t.sigWatch,
  };
  const heldCount = rows.filter((r) => r.qty > 0).length;
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="cap">📡 {t.watchlistTitle}</div>
          <div className="panel-sub">{t.watchlistSub}</div>
        </div>
        <div className="panel-head-r">
          <span className="tag">
            {heldCount}/{rows.length} {t.holding.toLowerCase()}
          </span>
          <span className="tag tag-live">
            <span className="dot" />
            {t.streaming}
          </span>
        </div>
      </div>
      <table className="dtable-v8">
        <thead>
          <tr>
            <th>{t.ticker}</th>
            <th className="r">{t.qty}</th>
            <th className="r">{t.avg}</th>
            <th className="r">{t.mark}</th>
            <th className="r">{t.pnl}</th>
            <th className="r">{t.pct}</th>
            <th className="r">{t.signal}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
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
                <td className="r aq-mono">{held ? `$${fmtUSD(p.avg)}` : <span className="mute">—</span>}</td>
                <td className="r aq-mono">${fmtUSD(p.mark)}</td>
                <td className={`r aq-mono ${held ? (up ? 'up' : 'dn') : 'mute'}`}>
                  {held ? `${up ? '+' : ''}$${fmtUSD(pnl)}` : '—'}
                </td>
                <td className={`r aq-mono ${held ? (up ? 'up' : 'dn') : 'mute'}`}>
                  {held ? `${up ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                </td>
                <td className="r">
                  <span className={sigClass}>
                    {arrow}
                    {sigLabel[p.signal]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
