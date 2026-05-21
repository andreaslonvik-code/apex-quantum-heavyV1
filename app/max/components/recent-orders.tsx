'use client';

import { I18N, type Lang } from './i18n';

export interface RecentOrder {
  /** ISO 8601 — client formats in browser locale. */
  submittedAt: string;
  /** ISO 8601, or null if not yet filled. */
  filledAt: string | null;
  ticker: string;
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
  status: 'OK' | 'PENDING' | 'ERR' | 'CANCELED';
  reason: string;
  /** Raw Alpaca status (e.g. 'new', 'partially_filled', 'rejected') for tooltip / debug. */
  orderStatus?: string;
}

interface Props {
  lang: Lang;
  orders: RecentOrder[];
  onSeeAll?: () => void;
}

/** Format an ISO timestamp as HH:MM:SS in the user's local timezone. */
function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RecentOrders({ lang, orders, onSeeAll }: Props) {
  const t = I18N[lang];
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="cap">{t.ordersTitle}</div>
          <div className="panel-sub">
            {t.ordersSub} {orders.length}
          </div>
        </div>
        {onSeeAll && (
          <button className="btn-ghost-sm" onClick={onSeeAll}>
            {t.seeAll}
          </button>
        )}
      </div>
      <div className="orders">
        {orders.length === 0 ? (
          <p className="panel-sub">—</p>
        ) : (
          orders.map((tr, i) => {
            // For pending orders we don't have a fill yet — display the
            // submitted qty + limit price but make it visually softer so
            // it's obvious nothing has executed. Filled orders show the
            // actual execution.
            const time = formatLocalTime(tr.filledAt ?? tr.submittedAt);
            const pillClass =
              tr.status === 'OK'
                ? 'pill pill-ok'
                : tr.status === 'PENDING'
                ? 'pill pill-pending'
                : tr.status === 'CANCELED'
                ? 'pill pill-canceled'
                : 'pill pill-err';
            const pillLabel =
              tr.status === 'OK'
                ? t.okPill
                : tr.status === 'PENDING'
                ? lang === 'no'
                  ? 'AVVENT'
                  : 'PENDING'
                : tr.status === 'CANCELED'
                ? lang === 'no'
                  ? 'KANSELLERT'
                  : 'CANCELED'
                : t.errPill;
            return (
              <div key={i} className={`order order-${tr.status.toLowerCase()}`}>
                <div className={`order-tick ${tr.action === 'BUY' ? 'up' : 'dn'}`}>
                  {tr.action === 'BUY' ? '▲' : '▼'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="order-l1">
                    <span className="tk-name">{tr.ticker}</span>
                    <span className={`sig sig-${tr.action.toLowerCase()}`}>
                      {tr.action === 'BUY' ? t.buy : t.sell}
                    </span>
                    <span className={pillClass} title={tr.orderStatus}>
                      {pillLabel}
                    </span>
                    <span className="order-time aq-mono" title={tr.submittedAt}>
                      {time}
                    </span>
                  </div>
                  <div className="order-l2 aq-mono">
                    {tr.qty} × ${tr.price.toFixed(2)} = $
                    {(tr.qty * tr.price).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="order-reason">{tr.reason}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
