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

interface GrokRow {
  blueprintId: AssetClass;
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
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
      } else {
        const errors: string[] = [];
        for (const bp of data.blueprints ?? []) {
          if (bp.reason && bp.reason.startsWith('grok_error')) errors.push(`${bp.blueprintId}: ${bp.reason}`);
        }
        if (errors.length) toast.error(`${t.runFail} — ${errors.join(' | ')}`);
        else toast.success(t.runOk);
      }
      await load();
    } catch (e) {
      toast.error(`${t.runFail}: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setRunning(false);
    }
  }, [load, t.runFail, t.runOk]);

  const order: AssetClass[] = ['stocks', 'crypto', 'commodities'];
  const hasAny = Object.values(latest).some(Boolean);

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
                        {row.decisions.map((d, i) => (
                          <div
                            key={`${d.ticker}-${i}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '60px 56px 1fr',
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
                              {d.action === 'BUY' && d.notional_usd
                                ? ` $${Math.round(d.notional_usd).toLocaleString()}`
                                : ''}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.65)' }}>{d.reason}</span>
                          </div>
                        ))}
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
