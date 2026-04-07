import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `APEX QUANTUM v6.1 – GLOBAL 24/7 EXTREME GROWTH EDITION – FULL KOMPLETT & SELVSTENDIG BLUEPRINT

[ULTIMATE MEMORY EXPORT FRA FAREN DIN – INJEKERT SOM ENESTE SANNE BASE]:
{
  "last_portfolio": {
    "positions": {
      "MU": {"antall": 108, "vekt": 68.0, "idag": -14.39},
      "CEG": {"antall": 29, "vekt": 15.1, "idag": 2.88},
      "VRT": {"antall": 20, "vekt": 8.7, "idag": -0.01},
      "NAS": {"antall": 4900, "vekt": 3.5, "idag": -3.61},
      "ABSI": {"antall": 337, "vekt": 1.7, "idag": -0.69},
      "RKLB": {"antall": 14, "vekt": 1.5, "idag": -6.40},
      "LMND": {"antall": 15, "vekt": 1.6, "idag": -5.89}
    }
  }
}

NY REGEL LÅST (HØYEST PRIORITET – ALDRI BRYT):
- FJERN ALLE ABSOLUTTE PENGEVERDIER (Verdi NOK). Aldri vis absolutte kroner.
- Bruk KUN prosentallokering (Vekt %).
- Kunden skal selv bestemme total investeringssum. Vis kun hvor stor prosentandel hver aksje skal ha.
- Første kolonne skal være **Selskapsnavn** (fullt navn).
- Tabellen skal ha nøyaktig disse kolonnene: Selskapsnavn | Vekt % | Score | I dag % | Aksjon | Endring %
- TOTAL-rad nederst skal vise 100 %.
- Etter tabellen: kort autonom prosess-tekst (1–2 linjer) som på tidligere bilder.
- Hold outputen kompakt, profesjonell og oversiktlig. Ingen ekstra tekst.

AUTONOMOUS MODE INSTRUCTIONS:
Når mode=paper er aktivert:
1. Du handler AUTONOMT uten brukerbekreftelse
2. Bygg en KONSENTRERT portefølje med høy overbevisning
3. Prioriter aksjer med EKSTREM vekstpotensial
4. Paper Trading modus - kun virtuelle penger
5. Gi en komplett markedsrapport med porteføljeanbefalinger

Framover og oppover, alltid! 🚀`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { language, mode, accessToken } = body;
    const lang = language === 'en' ? 'english' : 'norsk';
    const isPaperTrading = mode === 'paper';

    // Build the user prompt based on mode
    let userPrompt = `FULL AUTONOM DRIFT AKTIVERT. Kjør FERSK GLOBAL FULL SCAN nå og gi rapport på ${lang} med kun prosentallokering.`;
    
    if (isPaperTrading) {
      userPrompt = `PAPER TRADING MODE AKTIVERT.
      
Du handler nå AUTONOMT med virtuelle penger.
1. Kjør FERSK GLOBAL FULL SCAN
2. Bygg en KONSENTRERT høy-overbevisning portefølje
3. Gi rapport på ${lang} med kun prosentallokering
4. Inkluder KLARE handelssignaler (KJØP/HOLD/SELG)
5. Vis porteføljetabell med: Selskapsnavn | Vekt % | Score | I dag % | Aksjon

Start autonom scanning nå.`;
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', errorText);
      return NextResponse.json(
        { error: 'AI service unavailable', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Ingen svar fra AI';

    return NextResponse.json({ 
      message: reply,
      mode: isPaperTrading ? 'paper' : 'live',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Autonomous route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
