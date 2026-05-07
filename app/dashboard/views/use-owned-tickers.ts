import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'aqp:owned-tickers';

function readOwned(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    /* ignore */
  }
  return new Set();
}

function writeOwned(owned: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(owned)));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Tracks which tickers the signed-in user has marked as "owned" so HOLD/SELL
 * signals can render context appropriately. Persists to localStorage for now;
 * will move to Supabase in phase 2 once we have user-bound tables.
 */
export function useOwnedTickers() {
  const [owned, setOwned] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // localStorage isn't available during SSR; hydrate the set on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwned(readOwned());
  }, []);

  const toggle = useCallback((ticker: string) => {
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      writeOwned(next);
      return next;
    });
  }, []);

  const isOwned = useCallback(
    (ticker: string) => owned.has(ticker),
    [owned],
  );

  return { owned, toggle, isOwned };
}
