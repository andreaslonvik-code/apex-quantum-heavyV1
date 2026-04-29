// Lists all xAI models the current API key has access to. Hit this from
// a browser tab while signed in to find the exact model id for Grok 4
// Heavy (or whichever variant your account has) and set GROK_MODEL to
// that string in Vercel env vars.
//
// xAI's models endpoint mirrors OpenAI's: GET /v1/models with bearer auth
// returns { data: [{ id, object, created, owned_by }, ...] }.
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';

const XAI_API_BASE = 'https://api.x.ai/v1';

export async function GET() {
  // Authenticated route — only signed-in dashboard users can list models.
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json(
      { error: 'Sign in via dashboard first' },
      { status: 401 },
    );
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'XAI_API_KEY not set on Vercel' },
      { status: 500 },
    );
  }

  try {
    const r = await fetch(`${XAI_API_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
    const body = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: r.status,
          response: body,
          hint: 'xAI rejected the request. If 401 → wrong API key. If 403 → key does not have model-list permission.',
        },
        { status: r.status },
      );
    }
    const parsed = JSON.parse(body) as {
      data?: Array<{ id: string; object?: string; created?: number; owned_by?: string }>;
    };
    const models = (parsed.data ?? []).map((m) => m.id).sort();

    // Suggest the most appropriate model for our use cases based on what's
    // actually available. Heavy reasoning > fast reasoning > base > older.
    const preferenceOrder = [
      'grok-4-heavy',
      'grok-4-heavy-latest',
      'grok-4',
      'grok-4-latest',
      'grok-4-fast-reasoning',
      'grok-4-0709',
      'grok-3',
      'grok-3-latest',
    ];
    const recommended = preferenceOrder.find((p) => models.includes(p)) ?? models[0] ?? null;

    return NextResponse.json({
      ok: true,
      currentlyConfigured: process.env.GROK_MODEL ?? '(default: grok-4)',
      availableModels: models,
      totalCount: models.length,
      recommendedForGROK_MODEL: recommended,
      note: recommended
        ? `Set GROK_MODEL=${recommended} on Vercel for the highest-tier model your key can call.`
        : 'No models returned — verify the API key on console.x.ai.',
      raw: parsed.data ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
