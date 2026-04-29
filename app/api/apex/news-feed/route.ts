// Returns the latest hourly news intelligence filtered to the user's
// active portfolio (held positions + optimizer's elite picks). Macro
// summary + risk mode are returned as-is; ticker events are filtered to
// only those relevant to the user's actual exposure.
//
// Read-only. Authenticated via getRequestCreds. The dashboard polls this
// every minute or so to keep the news panel fresh.
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  type AlpacaCreds,
  getPositions,
} from '@/lib/alpaca';
import { getLatestNewsIntel } from '@/lib/news-intelligence';
import { computeEliteTickers } from '@/lib/portfolio-optimizer';

export async function GET() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json({ feed: null }, { status: 401 });
  }

  const intel = await getLatestNewsIntel();
  if (!intel) {
    // No usable intel — either the cron hasn't run yet, last scan failed,
    // or confidence is too low. Return an empty-but-valid envelope so the
    // dashboard can render a placeholder ("Ingen ferske nyheter").
    return NextResponse.json({
      feed: {
        scannedAt: null,
        summary: '',
        riskMode: 'normal' as const,
        confidence: 0,
        events: [],
        macroEvents: [],
      },
    });
  }

  // Build the relevant ticker set: held positions + optimizer's elite-8.
  const creds: AlpacaCreds = {
    apiKey: userCreds.apiKey,
    apiSecret: userCreds.apiSecret,
    env: userCreds.environment,
  };
  const heldSet = new Set<string>();
  try {
    const r = await getPositions(creds);
    if (r.success) for (const p of r.data) heldSet.add(p.symbol.toUpperCase());
  } catch {
    /* fall through — heldSet just stays empty */
  }
  let eliteSet: Set<string> = new Set();
  try {
    const r = await computeEliteTickers(creds);
    eliteSet = r.tickers;
  } catch {
    /* fall through */
  }

  const relevantSet = new Set<string>([...heldSet, ...eliteSet]);
  const events = intel.tickerEvents
    .filter((e) => relevantSet.has(e.ticker.toUpperCase()))
    .map((e) => ({
      ticker: e.ticker.toUpperCase(),
      direction: e.direction,
      weight: e.weight,
      source: e.source,
      reason: e.reason,
      held: heldSet.has(e.ticker.toUpperCase()),
      elite: eliteSet.has(e.ticker.toUpperCase()),
    }));

  // Macro events: those with source='macro' regardless of ticker filter.
  // (May include tickers not in the user's portfolio but still useful
  // context — e.g. an oil-price spike note even if the user holds no oil.)
  const macroEvents = intel.tickerEvents
    .filter((e) => e.source === 'macro')
    .map((e) => ({
      ticker: e.ticker.toUpperCase(),
      direction: e.direction,
      weight: e.weight,
      reason: e.reason,
    }));

  return NextResponse.json({
    feed: {
      scannedAt: intel.scannedAt,
      summary: intel.summary,
      riskMode: intel.riskMode,
      sectorBias: intel.sectorBias,
      confidence: intel.confidence,
      events,
      macroEvents,
    },
  });
}
