import { createAdminClient } from '@/utils/supabase/admin';
import type { AssetClass } from './blueprints';

export type UserAllocation = Record<AssetClass, number>;

export const DEFAULT_ALLOCATION: UserAllocation = {
  stocks: 33,
  crypto: 33,
  commodities: 34,
};

interface AllocationRow {
  alloc_stocks_pct: number | string | null;
  alloc_crypto_pct: number | string | null;
  alloc_commodities_pct: number | string | null;
}

function rowToAllocation(row: AllocationRow): UserAllocation {
  return {
    stocks: Number(row.alloc_stocks_pct ?? DEFAULT_ALLOCATION.stocks),
    crypto: Number(row.alloc_crypto_pct ?? DEFAULT_ALLOCATION.crypto),
    commodities: Number(row.alloc_commodities_pct ?? DEFAULT_ALLOCATION.commodities),
  };
}

export async function getUserAllocation(clerkUserId: string): Promise<UserAllocation> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('alpaca_accounts')
      .select('alloc_stocks_pct, alloc_crypto_pct, alloc_commodities_pct')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (error || !data) return DEFAULT_ALLOCATION;
    return rowToAllocation(data as AllocationRow);
  } catch {
    return DEFAULT_ALLOCATION;
  }
}

/** Validate + persist a user's allocation. Throws on invalid input. */
export async function saveUserAllocation(
  clerkUserId: string,
  alloc: UserAllocation,
): Promise<void> {
  const values = [alloc.stocks, alloc.crypto, alloc.commodities];
  if (!values.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) {
    throw new Error('Allocation values must be numbers in [0, 100].');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.5) {
    throw new Error(`Allocation must sum to 100, got ${sum}.`);
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('alpaca_accounts')
    .update({
      alloc_stocks_pct: alloc.stocks,
      alloc_crypto_pct: alloc.crypto,
      alloc_commodities_pct: alloc.commodities,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', clerkUserId);
  if (error) throw new Error(error.message);
}
