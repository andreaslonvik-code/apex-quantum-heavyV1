'use client';

import { I18N, type Lang } from './i18n';

export interface RecentOrder {
  time: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
  status: 'OK' | 'ERR';
  reason: string;
}

interface Props {
  lang: Lang;
  orders: RecentOrder[];
  onSeeAll?: () => void;
}

export function RecentOrders({ lang, orders, onSeeAll }: Props) {
  const t = I18N[lang];
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="cap">📋 {t.ordersTitle}</div>
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
          orders.map((tr, i) => (
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
                  <span className={`pill ${tr.status === 'OK' ? 'pill-ok' : 'pill-err'}`}>
                    {tr.status === 'OK' ? t.okPill : t.errPill}
                  </span>
                  <span className="order-time aq-mono">{tr.time}</span>
                </div>
                <div className="order-l2 aq-mono">
                  {tr.qty} × ${tr.price.toFixed(2)} = $
                  {(tr.qty * tr.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="order-reason">{tr.reason}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
