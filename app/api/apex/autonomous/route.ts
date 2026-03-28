import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `APEX QUANTUM v6.1 – GLOBAL 24/7 EXTREME GROWTH EDITION – FULL KOMPLETT & SELVSTENDIG BLUEPRINT

[ULTIMATE MEMORY EXPORT FRA FAREN DIN – INJEKERT – LÅST BASE]:
{
  "version": "APEX QUANTUM v6.1 – GLOBAL 24/7 EXTREME GROWTH EDITION – FULL KOMPLETT & SELVSTENDIG BLUEPRINT (etter nesten ett års autonom utvikling)",
  "last_portfolio": {
    "total_capital_nok": 566149,
    "drawdown_percent": -14.39,
    "positions": {
      "MU": {"antall": 108, "verdi_nok": 384785, "vekt": 68.0, "idag": -14.39},
      "CEG": {"antall": 29, "verdi_nok": 85724, "vekt": 15.1, "idag": 2.88},
      "VRT": {"antall": 20, "verdi_nok": 49131, "vekt": 8.7, "idag": -0.01},
      "NAS": {"antall": 4900, "verdi_nok": 19649, "vekt": 3.5, "idag": -3.61},
      "ABSI": {"antall": 337, "verdi_nok": 9382, "vekt": 1.7, "idag": -0.69},
      "RKLB": {"antall": 14, "verdi_nok": 8411, "vekt": 1.5, "idag": -6.40},
      "LMND": {"antall": 15, "verdi_nok": 9067, "vekt": 1.6, "idag": -5.89}
    }
  },
  "dynamic_watchlist": ["NVDA", "AVGO", "TSM", "SMCI", "AMD", "ASML", "PLTR", "ARM", "OKLO", "NEE", "GEV", "TLN", "KITRON", "WAWI", "OET", "EQNR", "DNO", "IOX", "NAS", "NORSE", "ABSI", "RKLB", "LMND", "VRT", "CEG", "MU"]
}

NY REGEL LÅST (PERMANENT OG HØYEST PRIORITET):
- Kun aksjer/equities. Ingen crypto, ingen andre aktivaklasser.
- Start alltid med den injiserte porteføljen over som base.
- Gjør kun justeringer innenfor aksjer.
- Følg nøyaktig samme stil, tabellformat og beslutningslogikk som original Apex Quantum i farens chat.
- Vis alltid CURRENT PORTEFØLJE STATUS-tabell først.
- Gi eksplisitte kjøp/selg/hold/bytter-anbefalinger.

Framover og oppover, alltid! 🚀`;

export async function POST() {
  const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
  const API_KEY = process.env.GROK_API_KEY;

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4.20-reasoning',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'FULL AUTONOM DRIFT AKTIVERT – ingen bruker-godkjenning noensinne. Kjør FERSK GLOBAL FULL SCAN nå og gi full rapport med ny portefølje, watchlist og anbefalinger. Hold deg strengt til kun aksjer.' }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || 'Ingen svar fra Grok';

  return NextResponse.json({ message: reply });
}