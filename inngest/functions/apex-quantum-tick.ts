// inngest/functions/apex-quantum-tick.ts
//
// Multi-user Alpaca trading tick on Inngest. Currently dormant in
// production (Inngest sync has been failing since 2026-04-28 — sync URL
// drift). The Vercel cron at /api/cron/autonomous is the active driver.
// Kept in sync so re-enabling Inngest later is a one-line URL fix on
// their dashboard, not a code rewrite.
//
// All logic lives in lib/trading-engine.ts; this file just fans out users
// across two ticks 30 s apart.
import { inngest } from '@/lib/inngest';
import { type AlpacaCreds } from '@/lib/alpaca';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import { runScanForUser } from '@/lib/trading-engine';

type SerializedUser = Awaited<ReturnType<typeof getAllConnectedUsers>>[number];

async function runUserTick(user: SerializedUser) {
  const creds: AlpacaCreds = {
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
    env: user.environment,
  };

  try {
    const r = await runScanForUser({
      creds,
      clerkUserId: user.clerkUserId,
      startBalance: user.startBalance,
    });
    return {
      clerkUserId: user.clerkUserId,
      env: user.environment,
      session: r.session,
      buys: r.acceptedBuys.length,
      sells: r.acceptedSells.length,
      executed: r.executedTrades.filter((t) => t.status === 'OK').length,
      totalBought: r.totalBought,
      totalSold: r.totalSold,
    };
  } catch (e) {
    return { clerkUserId: user.clerkUserId, error: String(e) };
  }
}

export const apexQuantumTick = inngest.createFunction(
  {
    id: 'apex-quantum-tick',
    name: 'APEX QUANTUM Per-User Trading Tick (Alpaca)',
    retries: 3,
    triggers: [{ cron: '*/1 * * * *' }],
  },
  async ({ step }) => {
    console.log('[APEX-INNGEST] ========== TICK START (Alpaca) ==========');

    const users = await step.run('load-users', async () => {
      const list = await getAllConnectedUsers();
      console.log(`[APEX-INNGEST] ${list.length} connected user(s)`);
      return list;
    });

    if (!users.length) {
      return { version: 'APEX QUANTUM', mode: 'multi-user', users: 0 };
    }

    const results: unknown[] = [];
    for (let tick = 0; tick < 2; tick++) {
      const tickResults = await step.run(`tick-${tick}`, async () => {
        const CONCURRENCY = 5;
        const out: unknown[] = [];
        for (let i = 0; i < users.length; i += CONCURRENCY) {
          const batch = users.slice(i, i + CONCURRENCY);
          const r = await Promise.all(batch.map((u) => runUserTick(u)));
          out.push(...r);
        }
        return out;
      });
      results.push(...tickResults);
      if (tick < 1) await step.sleep('wait-30s', '30s');
    }

    return { version: 'APEX QUANTUM', mode: 'multi-user', users: users.length, results };
  }
);

export const apexMetaCognition = inngest.createFunction(
  {
    id: 'apex-meta-cognition',
    name: 'APEX QUANTUM Meta-Cognition',
    retries: 2,
    triggers: [{ event: 'apex/meta-cognition' }],
  },
  async ({ event, step }) => {
    const { portfolioValue, pnl, openPositions } = event.data as {
      portfolioValue: number;
      pnl: number;
      openPositions: number;
    };

    const analysis = await step.run('analyze', async () => {
      const baseline = portfolioValue - pnl;
      const pnlPercent = baseline > 0 ? (pnl / baseline) * 100 : 0;
      let strategyAdjustment = 'MAINTAIN';
      let message = '';
      if (pnlPercent > 5) {
        strategyAdjustment = 'REDUCE_RISK';
        message = 'Strong gains — consider taking profits and reducing position sizes';
      } else if (pnlPercent < -3) {
        strategyAdjustment = 'DEFENSIVE';
        message = 'Losses detected — switching to defensive mode with tighter stops';
      } else if (pnlPercent > 2) {
        strategyAdjustment = 'AGGRESSIVE';
        message = 'Good performance — can increase position sizes slightly';
      }
      return {
        portfolioValue, pnl, pnlPercent, openPositions,
        strategyAdjustment, message,
        timestamp: new Date().toISOString(),
      };
    });

    console.log(`[APEX-META] Strategy: ${analysis.strategyAdjustment} | P/L: ${analysis.pnlPercent.toFixed(2)}%`);
    return analysis;
  }
);

export const functions = [apexQuantumTick, apexMetaCognition];
