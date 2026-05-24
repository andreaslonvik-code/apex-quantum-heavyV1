'use client';

import type { Lang } from './i18n';
import type { PendingTicker } from '@/lib/blueprints/types';

interface Props {
  lang: Lang;
  /** Pending tickers aggregated from every blueprint (stocks + crypto + commodities). */
  items: ReadonlyArray<PendingTicker & { blueprintLabel: string }>;
}

/**
 * Shows pre-IPO / not-yet-tradable symbols that the cockpit is tracking
 * but the engine deliberately ignores. Each row surfaces the expected
 * listing date and the source/notes so the user can verify externally
 * before promoting the symbol from `pendingWatchlist` to `watchlist` in
 * the blueprint file.
 *
 * Empty state: card disappears entirely (no point showing "no IPOs we're
 * watching" — it's noise).
 */
export function PendingIposCard({ lang, items }: Props) {
  if (items.length === 0) return null;

  // Days-until-listing. Negative = listing date has passed; user should
  // verify Alpaca availability and promote manually. This is the entire
  // point of the card — surface the moment something graduates.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  return (
    <div className="panel pending-ipos">
      <div className="panel-head">
        <div>
          <div className="cap">{lang === 'no' ? 'IPOer vi følger' : 'IPOs we are watching'}</div>
          <div className="panel-sub">
            {lang === 'no'
              ? 'Engine handler ikke disse — kun overvåking inntil notert på Alpaca'
              : 'Engine does not trade these — monitoring only until live on Alpaca'}
          </div>
        </div>
        <span className="tag">{items.length}</span>
      </div>
      <div className="pending-rows">
        {items.map((it) => {
          const listingDate = new Date(it.expectedListing + 'T00:00:00');
          const diffDays = Math.round((listingDate.getTime() - today.getTime()) / dayMs);
          const overdue = diffDays < 0;
          const imminent = diffDays >= 0 && diffDays <= 3;
          const stateLabel = overdue
            ? lang === 'no'
              ? 'Forventet listing passert — verifiser på Alpaca'
              : 'Expected listing has passed — verify on Alpaca'
            : diffDays === 0
              ? lang === 'no' ? 'Forventet i dag' : 'Expected today'
              : lang === 'no'
                ? `Forventet om ${diffDays} dag${diffDays === 1 ? '' : 'er'}`
                : `Expected in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
          const stateClass = overdue ? 'is-overdue' : imminent ? 'is-imminent' : '';

          return (
            <div key={it.ticker} className="pending-row">
              <div className="pending-row-l">
                <div className="pending-ticker">{it.ticker}</div>
                <div className="pending-name">{it.name}</div>
              </div>
              <div className="pending-row-r">
                <span className={`pending-state ${stateClass}`}>{stateLabel}</span>
                <span className="pending-date aq-mono">{it.expectedListing}</span>
                <span className="pending-blueprint">{it.blueprintLabel}</span>
              </div>
              {it.notes && <div className="pending-notes">{it.notes}</div>}
            </div>
          );
        })}
      </div>
      <div className="pending-foot">
        {lang === 'no'
          ? 'Når en ticker er live på Alpaca: flytt den fra pendingWatchlist til watchlist i blueprint-filen.'
          : 'When a ticker goes live on Alpaca: move it from pendingWatchlist to watchlist in the blueprint file.'}
      </div>
    </div>
  );
}
