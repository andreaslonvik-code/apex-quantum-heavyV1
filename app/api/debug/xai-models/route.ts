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

    // Recommendations for the two roles we use Grok in:
    // - Portfolio selection: highest-quality reasoning model accessible via
    //   /v1/chat/completions. NOTE: multi-agent models (like
    //   grok-4.20-multi-agent-0309) are NOT in this list because xAI
    //   rejects them on chat completions — they require a dedicated
    //   endpoint we haven't wired up.
    // - News scan: fast non-reasoning (fact extraction doesn't need
    //   chain-of-thought; cheaper + faster)
    const portfolioPreference = [
      'grok-4.20-0309-reasoning',
      'grok-4-1-fast-reasoning',
      'grok-4-fast-reasoning',
      'grok-4-0709',
      'grok-4',
      'grok-3',
    ];
    const newsPreference = [
      'grok-4-1-fast-non-reasoning',
      'grok-4-fast-non-reasoning',
      'grok-4.20-0309-non-reasoning',
      'grok-3-mini',
      'grok-3',
    ];
    const recommendedPortfolio = portfolioPreference.find((p) => models.includes(p)) ?? null;
    const recommendedNews = newsPreference.find((p) => models.includes(p)) ?? null;

    return NextResponse.json({
      ok: true,
      currentlyConfigured: {
        GROK_MODEL_PORTFOLIO:
          process.env.GROK_MODEL_PORTFOLIO ??
          (process.env.GROK_MODEL ? `(via legacy GROK_MODEL: ${process.env.GROK_MODEL})` : '(default: grok-4.20-multi-agent-0309)'),
        GROK_MODEL_NEWS:
          process.env.GROK_MODEL_NEWS ??
          (process.env.GROK_MODEL ? `(via legacy GROK_MODEL: ${process.env.GROK_MODEL})` : '(default: grok-4-1-fast-non-reasoning)'),
      },
      availableModels: models,
      totalCount: models.length,
      recommendations: {
        GROK_MODEL_PORTFOLIO: recommendedPortfolio,
        GROK_MODEL_NEWS: recommendedNews,
      },
      note: recommendedPortfolio
        ? `Optimal split: GROK_MODEL_PORTFOLIO=${recommendedPortfolio} GROK_MODEL_NEWS=${recommendedNews ?? '(none found)'}`
        : 'No portfolio-grade reasoning model available — verify API key.',
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
