import { NextResponse } from 'next/server';
import { getUsdNok } from '@/lib/fx';

/**
 * Public FX endpoint — returns the current USD→NOK reference rate so
 * the cockpit can show portfolio values in NOK as a display preference.
 * No auth required: this is a public market reference, not user data.
 *
 * The actual ledger is always USD (Alpaca). This rate exists for
 * presentation only. See `lib/fx.ts` for the architectural contract.
 */
export async function GET() {
  const fx = await getUsdNok();
  return NextResponse.json(fx, {
    headers: {
      // Allow the browser + CDN to cache for 5 min; server cache is
      // already 15 min so this just trims redundant round-trips.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
