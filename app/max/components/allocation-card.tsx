'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Lang } from './i18n';

interface Allocation {
  stocks: number;
  crypto: number;
  commodities: number;
}

const DEFAULTS: Allocation = { stocks: 33, crypto: 33, commodities: 34 };

const COPY = {
  no: {
    title: 'Kapital-allokering',
    sub: 'Fordel hvor mye av kontoen som handles av hver blueprint. Sum må være 100 %.',
    stocks: 'Aksjer',
    crypto: 'Krypto',
    commodities: 'Råvarer (gull + olje)',
    sum: 'Sum',
    save: 'Lagre',
    saving: 'Lagrer …',
    saved: 'Allokering lagret',
    saveError: 'Kunne ikke lagre allokering',
    sumNot100: 'Summen må være 100 %',
  },
  en: {
    title: 'Capital allocation',
    sub: 'Pick how much of the account each blueprint trades. Sum must equal 100 %.',
    stocks: 'Stocks',
    crypto: 'Crypto',
    commodities: 'Commodities (gold + oil)',
    sum: 'Sum',
    save: 'Save',
    saving: 'Saving …',
    saved: 'Allocation saved',
    saveError: 'Could not save allocation',
    sumNot100: 'Sum must equal 100 %',
  },
} as const;

interface Props {
  lang: Lang;
}

export function AllocationCard({ lang }: Props) {
  const t = COPY[lang];
  const [alloc, setAlloc] = useState<Allocation>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/apex/allocation', { credentials: 'include' });
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data?.allocation) {
          setAlloc({
            stocks: Number(data.allocation.stocks) || DEFAULTS.stocks,
            crypto: Number(data.allocation.crypto) || DEFAULTS.crypto,
            commodities: Number(data.allocation.commodities) || DEFAULTS.commodities,
          });
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sum = alloc.stocks + alloc.crypto + alloc.commodities;
  const sumIs100 = Math.abs(sum - 100) < 0.5;

  const update = (k: keyof Allocation, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setAlloc((prev) => ({ ...prev, [k]: Math.max(0, Math.min(100, n)) }));
  };

  const onSave = async () => {
    if (!sumIs100) {
      toast.error(t.sumNot100);
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/apex/allocation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alloc),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || t.saveError);
      }
      toast.success(t.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="cap">{t.title}</div>
          <div className="panel-sub">{t.sub}</div>
        </div>
        <span
          className="tag"
          style={{ color: sumIs100 ? 'var(--aq-green)' : 'var(--aq-warn)' }}
        >
          {t.sum}: {sum.toFixed(0)} %
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px 12px' }}>
        {(['stocks', 'crypto', 'commodities'] as const).map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label
              htmlFor={`alloc-${key}`}
              style={{ flex: '0 0 160px', fontSize: 13, color: 'var(--aq-text)' }}
            >
              {t[key]}
            </label>
            <input
              id={`alloc-${key}`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={alloc[key]}
              onChange={(e) => update(key, e.target.value)}
              disabled={loading || saving}
              style={{ flex: 1, accentColor: 'var(--aq-cyan)' }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={Number.isFinite(alloc[key]) ? alloc[key] : 0}
              onChange={(e) => update(key, e.target.value)}
              disabled={loading || saving}
              style={{
                flex: '0 0 70px',
                padding: '6px 8px',
                background: 'var(--aq-surface)',
                border: '1px solid var(--aq-border-hi)',
                borderRadius: 8,
                color: 'var(--aq-text)',
                fontFamily: 'var(--font-jetbrains)',
                textAlign: 'right',
                fontSize: 13,
              }}
            />
            <span style={{ width: 14, color: 'var(--aq-muted)' }}>%</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onSave}
          disabled={loading || saving || !sumIs100}
          className="btn-primary-v8"
          style={{ opacity: loading || saving || !sumIs100 ? 0.5 : 1 }}
        >
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
