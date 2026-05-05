import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { decide } from '@/lib/grok';
import { getLatestDecisionsForUser } from '@/lib/grok-decisions';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Quick diagnostic for the Grok integration. Reports:
 *   - Whether XAI_API_KEY is set
 *   - Whether the configured XAI_MODEL responds to a minimal prompt
 *   - The latest stored decisions per blueprint (or "no rows" if the table is empty)
 *
 * Hit with `GET /api/apex/grok-diagnostic` while logged in to see what
 * the engine is seeing.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const apiKeyPresent = Boolean(process.env.XAI_API_KEY);
  const model =
    process.env.XAI_MODEL ?? process.env.GROK_MODEL ?? 'grok-4';

  // Probe Grok with a minimal prompt to surface API/model errors.
  const probeStart = Date.now();
  const probe = await decide({
    systemPrompt: 'You are a JSON test. Reply with the exact object {"ok": true}.',
    userPrompt: 'Reply with {"ok": true}.',
    model,
  });
  const probeMs = Date.now() - probeStart;

  let latest: unknown = null;
  let latestError: string | null = null;
  try {
    latest = await getLatestDecisionsForUser(userId);
  } catch (e) {
    latestError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    env: {
      XAI_API_KEY_present: apiKeyPresent,
      XAI_MODEL_resolved: model,
    },
    probe: probe.success
      ? {
          status: 'ok',
          latencyMs: probeMs,
          parsed_payload: probe.payload,
          usage: probe.usage,
        }
      : {
          status: 'error',
          latencyMs: probeMs,
          error: probe.error,
          raw_preview:
            typeof probe.raw === 'string'
              ? probe.raw.slice(0, 500)
              : probe.raw
                ? JSON.stringify(probe.raw).slice(0, 500)
                : null,
        },
    latest_decisions: latestError
      ? { error: latestError, hint: 'Likely the grok_decisions table does not exist — run prisma/supabase-setup.sql.' }
      : latest,
  });
}
