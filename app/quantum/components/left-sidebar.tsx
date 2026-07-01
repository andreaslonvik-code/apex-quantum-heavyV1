'use client';

/**
 * «Hovedboken» (§10 venstre, 264px): KPI-blokk (porteføljeverdi i
 * Fraunces 32px tabular + endring i mono), posisjoner som ledger-rader
 * (§5.3) sortert etter vekt, Morgenutgaven (§5.5) nederst.
 *
 * KUN ekte data fra /api/apex/positions og /api/apex/performance —
 * de hardkodede portfolioData/summaryStats er slettet. Mangler en
 * live-verdi vises ærlig tomhet (§5.7), aldri fiktive tall.
 */

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/app/components/marketing/types';
import { EditionLine } from '@/app/components/marketing-v2/edition-line';
import { fmtPct, fmtUsd, fmtCompactUsd } from '@/lib/marketing-format';
import { COCKPIT_COPY } from '../lib/copy';
import type { CockpitPosition, CockpitTf } from '../lib/types';

export function LeftSidebar({
  lang,
  connected,
  positions,
  totalValue,
  changePct,
  tf,
}: {
  lang: Lang;
  connected: boolean | null;
  positions: CockpitPosition[] | null;
  totalValue: number | null;
  /** Endring i prosent over valgt tidsvindu; null = ukjent. */
  changePct: number | null;
  tf: CockpitTf;
}) {
  const t = COCKPIT_COPY[lang];

  // Ticker-pulsen (§5.8): flash KUN når en live-verdi faktisk endres.
  const prevRef = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Map<string, 'up' | 'down'>>(new Map());
  useEffect(() => {
    if (!positions) return;
    const prev = prevRef.current;
    const next = new Map<string, 'up' | 'down'>();
    for (const p of positions) {
      const before = prev.get(p.ticker);
      if (before !== undefined && before !== p.pnlPercent) {
        next.set(p.ticker, p.pnlPercent > before ? 'up' : 'down');
      }
      prev.set(p.ticker, p.pnlPercent);
    }
    if (next.size > 0) {
      // Utsett én frame — unngår synkron setState i effekt (lint) uten
      // synlig forskjell for 600ms-pulsen
      const raf = requestAnimationFrame(() => setFlash(next));
      const id = setTimeout(() => setFlash(new Map()), 600);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(id);
      };
    }
  }, [positions]);

  const sorted = positions ? [...positions].sort((a, b) => b.vekt - a.vekt) : null;

  return (
    <aside className="aq-ck-ledger" aria-label={t.ledgerTitle}>
      <div className="aq-ck-col-head">{t.ledgerTitle}</div>

      <div className="aq-ck-kpi">
        <p className="aq-ck-kpi-label">{t.portfolioValue}</p>
        <div className="aq-ck-kpi-value" suppressHydrationWarning>
          {totalValue != null && totalValue > 0 ? fmtUsd(totalValue, lang) : '—'}
        </div>
        <div className="aq-ck-kpi-delta">
          {t.changePrefix} ({tf}):{' '}
          {changePct == null ? (
            '—'
          ) : (
            <span data-side={changePct >= 0 ? 'up' : 'down'}>{fmtPct(changePct, lang)}</span>
          )}
        </div>
      </div>

      <div className="aq-ck-col-head">
        <span>{t.positionsTitle}</span>
        <span className="aq-ck-panel-note">{t.weightHeader}</span>
      </div>

      {connected === false ? (
        <div className="aq-hatch aq-ck-hatch-fill">{t.noAccount}</div>
      ) : sorted == null ? (
        <div className="aq-hatch aq-ck-hatch-fill">{t.dataUnavailable}</div>
      ) : sorted.length === 0 ? (
        <div className="aq-hatch aq-ck-hatch-fill">{t.noPositions}</div>
      ) : (
        <div className="aq-ck-positions">
          {sorted.map((p) => {
            const side = p.pnl >= 0 ? 'up' : 'down';
            const f = flash.get(p.ticker);
            return (
              <div key={p.ticker} className="aq-ledger-row">
                <span className="aq-ledger-swatch" data-side={side} aria-hidden />
                <span className="aq-ledger-ticker">{p.ticker}</span>
                <span className="aq-ledger-val">
                  {fmtCompactUsd(p.marketValue, lang)} · {p.vekt.toFixed(1).replace('.', lang === 'no' ? ',' : '.')} %
                </span>
                <span
                  className={`aq-ledger-delta${f ? ` aq-tick-${f}` : ''}`}
                  data-side={p.pnlPercent >= 0 ? 'up' : 'down'}
                >
                  {fmtPct(p.pnlPercent, lang)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="aq-ck-edition">
        <EditionLine lang={lang} />
      </div>
    </aside>
  );
}
