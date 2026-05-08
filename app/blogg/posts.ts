// Blog posts for apex-quantum.com/blogg.
// Add a new entry to the top of POSTS for chronological newest-first display.
// NO + EN are fully translated; other Plus dashboard languages fall back to EN
// (the marketing site is NO/EN only).

export interface PostImage {
  src: string;
  alt: { no: string; en: string };
  /** Optional caption shown below the image. */
  caption?: { no: string; en: string };
}

export interface Post {
  slug: string;
  /** ISO date — drives sort and "Sist oppdatert" footer. */
  publishedOn: string;
  /** Optional hero image rendered at the top of the post. */
  image?: PostImage;
  /** Optional secondary image rendered after the body's first half. */
  image2?: PostImage;
  title: { no: string; en: string };
  excerpt: { no: string; en: string };
  body: { no: string; en: string };
}

export const POSTS: readonly Post[] = [
  {
    slug: '2026-05-08-utviklingen-sa-langt',
    publishedOn: '2026-05-08',
    image: {
      src: '/blog/2026-05-08-max-sim-1h.png',
      alt: {
        no: 'Apex Quantum Max-dashboardet viser +14 848 USD (+1,49 %) avkastning siste time i simulert miljø',
        en: 'Apex Quantum Max dashboard showing +14,848 USD (+1.49%) return over the last hour in simulation',
      },
      caption: {
        no: 'Avkastning siste time i simulert miljø — én datapunkt, ikke representativt for langsiktig forventet avkastning.',
        en: 'Return over the last hour in simulation — one datapoint, not representative of long-term expected return.',
      },
    },
    image2: {
      src: '/blog/2026-05-08-max-sim-positions.png',
      alt: {
        no: 'To aktive posisjoner i simulert miljø: QCOM og MU, begge med urealisert gevinst og HOLD-signal',
        en: 'Two active positions in simulation: QCOM and MU, both with unrealized gains and HOLD signals',
      },
      caption: {
        no: 'AI-en holder posisjonene i stedet for å ta gevinst — trenden er intakt. "Ta ut gevinst" er alltid tilgjengelig som ett-klikks-handling for brukeren.',
        en: 'The AI holds the positions rather than taking profits — the trend is intact. "Withdraw profits" is always available as a one-click user action.',
      },
    },
    title: {
      no: 'Utviklingen så langt — fra idé til ekte signaler',
      en: 'Where we are — from idea to real signals',
    },
    excerpt: {
      no: 'Første offentlige utviklings-oppdatering fra Apex Quantum. Vi bygger to produkter parallelt: Apex Quantum + (lærings- og analyseplattform) og Apex Quantum Max (autonom AI-trading). Slik ser status ut.',
      en: "First public dev update from Apex Quantum. We're building two products in parallel: Apex Quantum + (learning and analysis platform) and Apex Quantum Max (autonomous AI trading). Here's where things stand.",
    },
    body: {
      no: `Dette er den første offentlige utviklings-oppdateringen fra Apex Quantum-teamet. Vi bygger to produkter parallelt, og det er på tide å være tydelige om hvor vi står og hva slutt-produktet skal være.

## Apex Quantum Max — den autonome motoren

Skjermbildet over er fra Max-dashbordet i simulert miljø, kjørt mot én million dollar i virtuell startkapital. Siste time: **+14 848 USD (+1,49 %)**.

Det er viktig å være ærlig her: én time i simulering med 84 % eksponering forteller veldig lite om langsiktig forventet avkastning. Det vi *kan* lese ut av det, er at infrastrukturen fungerer — AI-en tar beslutninger, ordre legges inn på Alpaca, og dashbordet oppdaterer seg i realtid med live P&L og benchmark-sammenligning.

I dette tilfellet har AI-en valgt å holde to halvleder-aksjer (QCOM og MU) som begge viser solid urealisert gevinst. I stedet for å ta gevinst tidlig, lar den posisjonene løpe så lenge trenden er intakt — det er en sentral del av hvordan systemet er designet. "Ta ut gevinst"-knappen er alltid synlig for brukeren, så du har kontroll når du vil ha det.

<!-- image2 -->

Max ligger i lukket beta nå. Den åpnes bredere når Finanstilsynet-lisensen er på plass.

## Apex Quantum + — produktet som åpner først

Mens Max venter på regulatorisk godkjenning, åpner vi Plus globalt fra 199 kr/mnd. Plus tar samme analyse-motor som driver Max, men kobler den fra Alpaca og presenterer den som en lærings- og analyseplattform. Du tar alle handelsbeslutninger selv, hos den megleren du foretrekker.

I løpet av de siste ukene har vi bygget:

- **Daglige AI-signaler** fra global watchlist (Norge, Europa, USA, Taiwan, Korea, Japan, Hongkong, India). Publiseres kl. 08:00 norsk tid, hver dag, før EU åpner.
- **Ukentlig markedsrapport** — søndag kl. 20:00 norsk tid. Sektorrotasjon, makro, fokus neste uke.
- **6 læringsmoduler** i tre nivåer (nybegynner / mellom / avansert) med ekte eksempler fra signal-feeden.
- **Spør AI om hvilken som helst aksje** — fri-tekst-spørringer kjøres mot live web- og X-søk og besvares pedagogisk uten konkrete kjøps-/salgs-anbefalinger.
- **Investerings-journal** med tese, forventet utfall, utfall-tracking — slik at du over tid ser dine egne mønstre.

## Hjertet i begge produkter

Det som gjør AI-en relevant er ikke modellen i seg selv — det er rammeverket den følger. Vi har brukt over et år på å utvikle en proprietær blueprint som styrer hvordan analysen utføres. Dette er kjernen i både Plus og Max, og det vi *ikke* kommer til å beskrive offentlig — det er det som skiller oss fra alle andre AI-trading-produkter du har sett.

Det vi *kan* si: blueprinten kjører en full global skanning på hver analyse, kombinerer signaler fra mange uavhengige kilder, og er bygget for å gi *risikojustert* avkastning — ikke maksimal teoretisk avkastning på papir. Tonen er forsiktig der det er fortjent, og aggressiv der det er asymmetrisk oppside.

## Hva slutt-produktet er

Apex Quantum + er ikke ment å være enda et signal-spam-abonnement. Det er ment å lære deg markedet mens du bruker det. Hvert signal kommer med begrunnelse, katalysatorer og risiko — slik at du forstår *hvorfor*, ikke bare *hva*. Når Plus er ferdig utbygget skal du ha:

1. **AI som ekspert-veileder** — Spør AI gir deg en uavhengig analytiker tilgjengelig 24/7
2. **Strukturert læring** — fra "hva er en aksje?" til DCF-verdsettelse, alt knyttet til konkrete eksempler fra dagens marked
3. **Personlig journal** som over tid viser dine egne beslutningsmønstre — hvor du tar gode kall og hvor du faller i samme felle gang etter gang
4. **Globalt utvalg** — hvis du sitter i Tokyo, Houston eller Trondheim, får du relevante aksjer fra ditt marked, ikke bare amerikanske selskaper

Apex Quantum Max blir steget videre: når lisens og infrastruktur er på plass, kobler du megleren din og lar AI-en handle for deg autonomt. For de som ikke vil bruke tid selv, men som er komfortable med kapital under autonom forvaltning.

## Hva som kommer

Neste milepæl er den første ekte AI-genererte signal-batchen i Plus. Pipelinen er testet — vi mangler kun å trekke i bryteren. Det skjer i løpet av de neste ukene, ikke månedene.

Vi pusher trinnvis. Følg med her, eller send en e-post til post@apex-quantum.com merket "blogg" for å få beskjed når neste oppdatering kommer.

— Andreas, grunnlegger av Apex Quantum`,
      en: `This is the first public dev update from the Apex Quantum team. We're building two products in parallel, and it's time to be clear about where we stand and what the final product is meant to be.

## Apex Quantum Max — the autonomous engine

The screenshot above is from the Max dashboard in simulation, running against one million dollars of virtual starting capital. Last hour: **+14,848 USD (+1.49%)**.

It's important to be honest: one hour in simulation with 84% exposure tells you very little about long-term expected return. What it *does* tell us is that the infrastructure works — the AI makes decisions, orders are placed on Alpaca, and the dashboard updates in real time with live P&L and benchmark comparison.

In this case the AI is holding two semiconductor names (QCOM and MU), both showing solid unrealized gains. Rather than taking profits early, it lets the positions run as long as the trend is intact — that's a deliberate part of how the system is designed. The "Withdraw profits" button is always visible to the user, so you remain in control whenever you want.

<!-- image2 -->

Max is in closed beta now. It opens more broadly once the Finanstilsynet license is in place.

## Apex Quantum + — the product launching first

While Max waits for regulatory approval, we're opening Plus globally from $19/month. Plus takes the same analysis engine that drives Max but disconnects it from Alpaca and presents it as a learning and analysis platform. You make all trading decisions yourself, at whatever broker you prefer.

Over the past weeks we've built:

- **Daily AI signals** from a global watchlist (Norway, Europe, US, Taiwan, Korea, Japan, Hong Kong, India). Published at 08:00 CET every day, before EU markets open.
- **Weekly market report** — Sunday at 20:00 CET. Sector rotation, macro, what to watch next week.
- **6 learning modules** across three levels (beginner / intermediate / advanced) with real examples from the signal feed.
- **Ask AI about any stock** — free-text queries run against live web and X search, answered educationally without specific buy/sell calls.
- **Investment journal** with thesis, expected outcome, and outcome tracking — so you see your own patterns over time.

## The heart of both products

What makes the AI relevant isn't the model itself — it's the framework it follows. We've spent over a year developing a proprietary blueprint that governs how the analysis is performed. It's the core of both Plus and Max, and something we *won't* describe publicly — it's what sets us apart from every other AI trading product you've seen.

What we *can* say: the blueprint runs a full global scan on each analysis, combines signals from many independent sources, and is built for *risk-adjusted* returns — not maximum theoretical performance on paper. The tone is cautious where caution is earned, and aggressive where the upside is asymmetric.

## What the final product is

Apex Quantum + is not meant to be yet another signal-spam subscription. It's meant to teach you the market while you use it. Every signal comes with reasoning, catalysts and risk — so you understand the *why*, not just the *what*. When Plus is fully built out you'll have:

1. **AI as an expert tutor** — Ask AI gives you an independent analyst available 24/7
2. **Structured learning** — from "what is a stock?" to DCF valuation, all tied to concrete examples from today's market
3. **Personal journal** that over time reveals your own decision patterns — where you make good calls and where you keep falling into the same trap
4. **Global universe** — whether you're in Tokyo, Houston or Trondheim, you get relevant stocks from your own market, not just US names

Apex Quantum Max is the next step: once licensing and infrastructure are in place, you connect your broker and let the AI trade for you autonomously. For people who don't want to spend the time, but are comfortable with capital under autonomous management.

## What's next

The next milestone is the first real AI-generated signal batch in Plus. The pipeline is tested — we just need to flip the switch. That happens in the next few weeks, not months.

We're shipping incrementally. Follow along here, or send an email to post@apex-quantum.com tagged "blog" to be notified when the next update goes out.

— Andreas, founder of Apex Quantum`,
    },
  },
];
