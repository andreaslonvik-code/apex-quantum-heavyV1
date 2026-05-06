'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Lang } from './i18n';

type AssetClass = 'stocks' | 'crypto' | 'commodities';
type Action = 'BUY' | 'SELL' | 'HOLD';

interface GrokDecision {
  ticker: string;
  action: Action;
  notional_usd?: number;
  reason: string;
}

interface TradeOutcome {
  ticker: string;
  action: 'BUY' | 'SELL';
  status: 'OK' | 'ERR' | 'SKIP';
  notional: number;
  qty: number;
  reason: string;
  error?: string;
}

interface GrokRow {
  blueprintId: AssetClass;
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
  tradeOutcomes: TradeOutcome[];
  failed: boolean;
  errorMessage: string | null;
}

const COPY = {
  no: {
    title: 'Grok-thesis',
    sub: 'Siste beslutning per blueprint (2 min cadence)',
    none: 'Ingen Grok-beslutninger ennå — trykk "Kjør nå" eller vent på neste cron-tick.',
    failed: 'Grok-feil',
    blueprints: { stocks: 'Aksjer', crypto: 'Krypto', commodities: 'Råvarer' },
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD' },
    decided: 'Besluttet',
    minAgo: 'min siden',
    hAgo: 't siden',
    runNow: 'Kjør nå',
    running: 'Kjører …',
    runOk: 'Grok-tick utført',
    runFail: 'Grok-tick feilet',
  },
  en: {
    title: 'Grok thesis',
    sub: 'Latest decision per blueprint (2 min cadence)',
    none: 'No Grok decisions yet — click "Run now" or wait for the next cron tick.',
    failed: 'Grok error',
    blueprints: { stocks: 'Stocks', crypto: 'Crypto', commodities: 'Commodities' },
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD' },
    decided: 'Decided',
    minAgo: 'min ago',
    hAgo: 'h ago',
    runNow: 'Run now',
    running: 'Running …',
    runOk: 'Grok tick executed',
    runFail: 'Grok tick failed',
  },
} as const;

interface Props {
  lang: Lang;
}

function fmtAge(ts: string, lang: Lang): string {
  const t = COPY[lang];
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} ${t.minAgo}`;
  const h = Math.floor(min / 60);
  return `${h} ${t.hAgo}`;
}

export function GrokThesisCard({ lang }: Props) {
  const t = COPY[lang];
  const [latest, setLatest] = useState<Partial<Record<AssetClass, GrokRow>>>({});
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/apex/grok-status', { credentials: 'include' });
      if (!r.ok) return;
      const data = await r.json();
      setLatest((data?.latest as Partial<Record<AssetClass, GrokRow>>) ?? {});
    } catch {
      /* soft-fail */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const onRunNow = useCallback(async () => {
    setRunning(true);
    try {
      const r = await fetch('/api/apex/blueprint-tick', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(`${t.runFail}: ${data?.error ?? r.status}`);
        await load();
        return;
      }

      let totalOk = 0;
      let totalErr = 0;
      const grokErrors: string[] = [];
      const tradeErrors: string[] = [];
      for (const bp of (data.blueprints ?? []) as Array<{
        blueprintId: string;
        reason?: string;
        trades?: Array<{ ticker: string; action: string; status: string; error?: string }>;
      }>) {
        if (bp.reason && bp.reason.startsWith('grok_error')) {
          grokErrors.push(`${bp.blueprintId}: ${bp.reason.slice(0, 100)}`);
        }
        for (const tr of bp.trades ?? []) {
          if (tr.status === 'OK') totalOk += 1;
          else if (tr.status === 'ERR') {
            totalErr += 1;
            if (tradeErrors.length < 10) {
              tradeErrors.push(
                `${bp.blueprintId}/${tr.ticker} ${tr.action}: ${tr.error ?? 'rejected'}`,
              );
            }
          }
        }
      }

      if (grokErrors.length) {
        toast.error(`Grok-feil: ${grokErrors.join(' · ')}`, { duration: 10_000 });
      }
      if (totalErr > 0) {
        toast.error(
          `${totalOk} ordre OK, ${totalErr} avvist av Alpaca:\n${tradeErrors.join('\n')}`,
          { duration: 30_000 },
        );
      }
      if (totalOk > 0 && totalErr === 0 && grokErrors.length === 0) {
        toast.success(`${t.runOk} — ${totalOk} ordre plassert`);
      }
      if (totalOk === 0 && totalErr === 0 && grokErrors.length === 0) {
        toast.info('Grok kjørte men ingen ordre ble lagt inn (HOLD-only eller cadence-throttled)', { duration: 8_000 });
      }
      await load();
    } catch (e) {
      toast.error(`${t.runFail}: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setRunning(false);
    }
  }, [load, t.runFail, t.runOk]);

  // Match the engine's DISABLED_BLUEPRINTS — only show buckets the engine
  // is actively trading. When crypto/commodities are re-enabled, add them
  // back here.
  const order: AssetClass[] = ['stocks'];
  const hasAny = order.some((id) => Boolean(latest[id]));

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="cap">{t.title}</div>
          <div className="panel-sub">{t.sub}</div>
        </div>
        <button
          type="button"
          onClick={onRunNow}
          disabled={running}
          className="btn-primary-v8"
          style={{ opacity: running ? 0.5 : 1, fontSize: 12, padding: '6px 12px' }}
        >
          {running ? t.running : t.runNow}
        </button>
      </div>

      {!loaded ? null : !hasAny ? (
        <div style={{ padding: '12px 4px', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
          {t.none}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 4px' }}>
          {order.map((id) => {
            const row = latest[id];
            if (!row) return null;
            return (
              <div
                key={id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{t.blueprints[id]}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-jetbrains)',
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {t.decided} {fmtAge(row.decidedAt, lang)}
                  </span>
                </div>

                {row.failed ? (
                  <div style={{ fontSize: 12, color: 'var(--aq-red)' }}>
                    {t.failed}: {row.errorMessage ?? 'unknown'}
                  </div>
                ) : (
                  <>
                    {row.thesis && (
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
                        {row.thesis}
                      </div>
                    )}
                    {row.decisions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {row.decisions.map((d, i) => {
                          const outcome = (row.tradeOutcomes ?? []).find(
                            (o) => o.ticker === d.ticker && o.action === d.action,
                          );
                          const status = outcome?.status;
                          const statusBadge =
                            status === 'OK'
                              ? // 'OK' from placeOrder means "Alpaca accepted
                                // the order" — not necessarily filled. Crypto
                                // fills instantly; stocks queue until market
                                // open. The badge reflects this honestly.
                                { label: 'INNSENDT', color: 'var(--aq-green)' }
                              : status === 'ERR'
                                ? { label: 'AVVIST', color: 'var(--aq-red)' }
                                : status === 'SKIP'
                                  ? { label: 'HOPP', color: 'var(--aq-warn)' }
                                  : d.action === 'HOLD'
                                    ? null
                                    : { label: '…', color: 'rgba(255,255,255,0.4)' };
                          return (
                            <div
                              key={`${d.ticker}-${i}`}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '60px 56px 64px 1fr',
                                gap: 8,
                                fontSize: 12,
                                alignItems: 'baseline',
                              }}
                            >
                              <span style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 600 }}>
                                {d.ticker}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-jetbrains)',
                                  fontSize: 11,
                                  color:
                                    d.action === 'BUY'
                                      ? 'var(--aq-green)'
                                      : d.action === 'SELL'
                                        ? 'var(--aq-red)'
                                        : 'rgba(255,255,255,0.5)',
                                }}
                              >
                                {t.actions[d.action]}
                                {outcome && outcome.notional > 0
                                  ? ` $${Math.round(outcome.notional).toLocaleString()}`
                                  : ''}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-jetbrains)',
                                  fontSize: 10,
                                  color: statusBadge?.color ?? 'transparent',
                                }}
                              >
                                {statusBadge?.label ?? ''}
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.65)' }}>
                                {outcome?.error
                                  ? `${d.reason} — ${outcome.error.slice(0, 80)}`
                                  : d.reason}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
