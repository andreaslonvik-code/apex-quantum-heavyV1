/**
 * Vercel Cron — daily self-learning loop. Aggregates closed lots from the
 * last 60 days, computes hit rate + average return per BUY signal type, and
 * updates the signal_multipliers table with bounded steps. The trading
 * engine's signal-sizing reads from that table, so winning signals
 * automatically get bigger bets and losing signals get throttled.
 *
 * Schedule: daily at 02:00 UTC (set in vercel.json). Bounded so it can't
 * overshoot: max ±0.10 multiplier change per run, hard floor 0.50, hard
 * ceiling 1.50. Convergence to a target multiplier is gradual (~10 days).
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server';
import { computeAndUpdateMultipliers } from '@/lib/learning';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    const result = await computeAndUpdateMultipliers();
    const elapsed = Date.now() - startTime;
    console.log(
      `[LEARN] Updated ${result.updated.length} signal multipliers, skipped ${result.skipped.length} (insufficient samples) in ${elapsed}ms`
    );
    return NextResponse.json({ success: true, elapsedMs: elapsed, ...result });
  } catch (err) {
    console.error('[LEARN] Failed:', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
