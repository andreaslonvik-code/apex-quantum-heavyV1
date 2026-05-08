// Læringsinnhold for Apex Quantum +. Hold leksjonene korte (250–400 ord)
// og handlingsorienterte. NO + EN er fullt oversatt; andre språk vises på
// engelsk inntil oversettelser er klare.

import type { PlusLang } from '@/lib/i18n/plus-lang';

export type LessonLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Lesson {
  id: string;
  level: LessonLevel;
  title: Record<'no' | 'en', string>;
  summary: Record<'no' | 'en', string>;
  body: Record<'no' | 'en', string>;
  /** Estimated reading time in minutes. */
  readMinutes: number;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'what-is-a-stock',
    level: 'beginner',
    readMinutes: 4,
    title: {
      no: 'Hva er en aksje?',
      en: 'What is a stock?',
    },
    summary: {
      no: 'Eierandel, utbytte, stemmerett — det fundamentale.',
      en: 'Ownership, dividends, voting rights — the fundamentals.',
    },
    body: {
      no: `# Hva er en aksje?

En aksje er en eierandel i et selskap. Når du kjøper én aksje i Equinor, eier du en bitteliten brøkdel av selskapet — av oljefeltene, kontorbygningene, av kontantbeholdningen og av framtidig overskudd.

## Hvorfor selskaper utsteder aksjer

Selskaper trenger kapital. I stedet for å låne fra en bank kan de selge eierandeler til offentligheten. Investorer kjøper aksjene fordi de tror selskapet vil vokse, og verdien av eierandelen vil øke.

## Hva du får som aksjonær

- **Verdistigning**: Hvis selskapet gjør det bra, kan aksjekursen stige
- **Utbytte**: Mange selskaper deler ut deler av overskuddet til aksjonærene
- **Stemmerett**: Du kan stemme på generalforsamlingen (én aksje = én stemme)
- **Rettigheter ved oppløsning**: Hvis selskapet selges eller går konkurs, får aksjonærer det som er igjen *etter* at kreditorer er betalt

## Det viktigste å huske

Aksjekursen er hva markedet er villig til å betale **akkurat nå**. Den kan svinge mye fra dag til dag — men over tid reflekterer den selskapets faktiske verdiskaping.

> [!key]
> En aksje er ikke et tall på en skjerm — det er en faktisk eierandel i et faktisk selskap. Hvis du ikke ville eid hele selskapet for å sitte med utbyttet og verdistigningen, bør du ikke eie aksjen heller.

## Neste steg

Når du forstår at en aksje er en eierandel, ikke et lotto-flax, endrer du måten du tenker på handel. Du kjøper *eierskap* i selskaper du tror på.`,
      en: `# What is a stock?

A stock is a share of ownership in a company. When you buy one share of Equinor, you own a tiny fraction of the company — of its oil fields, office buildings, cash and future profits.

## Why companies issue stock

Companies need capital. Instead of borrowing from a bank, they can sell ownership to the public. Investors buy shares because they believe the company will grow, and the value of their ownership will increase.

## What you get as a shareholder

- **Capital appreciation**: If the company performs well, the share price may rise
- **Dividends**: Many companies distribute part of profits to shareholders
- **Voting rights**: You can vote at the annual general meeting (one share = one vote)
- **Liquidation rights**: If the company is sold or goes bankrupt, shareholders get whatever is left *after* creditors are paid

## The key takeaway

The stock price is what the market is willing to pay **right now**. It can swing a lot day to day — but over time it reflects the actual value the company creates.

> [!key]
> A stock isn't a number on a screen — it's a real share of a real business. If you wouldn't want to own the entire company for its dividends and growth, you probably shouldn't own the share either.

## Next step

Once you understand that a stock is ownership, not a lottery ticket, the way you think about trading changes. You're buying *ownership* in companies you believe in.`,
    },
  },
  {
    id: 'how-prices-move',
    level: 'beginner',
    readMinutes: 5,
    title: {
      no: 'Hvordan kursene beveger seg',
      en: 'How stock prices move',
    },
    summary: {
      no: 'Tilbud og etterspørsel — og hva som driver dem.',
      en: 'Supply and demand — and what drives them.',
    },
    body: {
      no: `# Hvordan kursene beveger seg

Aksjekurser beveger seg av én grunn: mer interesse for å kjøpe enn å selge (kursen stiger), eller mer interesse for å selge enn å kjøpe (kursen faller). Tilbud og etterspørsel.

## Hva flytter etterspørselen

- **Inntjeningsforventninger**: Selskaper som tjener mer penger enn forventet, blir mer attraktive
- **Nyheter**: Et nytt produkt, en stor kontrakt, en regulatorisk fordel
- **Makro**: Renter, valuta, oljepriser. Lave renter = aksjer mer attraktive enn obligasjoner
- **Sentiment**: Stemningen i markedet — frykt eller grådighet

## Bid og ask

På børsen ser du to priser: **bid** (hva noen vil betale) og **ask** (hva noen vil selge for). Forskjellen kalles spread. Likvide aksjer som NVDA har en spread på noen øre. Illikvide har spreads på flere prosent.

## Volum betyr noe

Hvis 10 millioner aksjer handles på en dag, er prisen mer "ekte" enn hvis bare 50 000 handles. Lav volum = stor sjanse for at en enkelt ordre flytter kursen.

## Det viktigste å huske

Pris ≠ verdi. En aksje kan være "billig" på 1 000 kr og "dyr" på 50 kr — det avhenger av hva selskapet faktisk tjener. Lær å skille mellom de to.

## Praktisk øvelse

Velg en aksje fra watchlisten vår og se på 1-årig graf. Identifiser tre store hopp (opp eller ned). Søk på datoen og finn ut hvilken nyhet som drev bevegelsen.`,
      en: `# How stock prices move

Stock prices move for one reason: more interest in buying than selling (price rises), or more interest in selling than buying (price falls). Supply and demand.

## What moves demand

- **Earnings expectations**: Companies that earn more than expected become more attractive
- **News**: A new product, a big contract, a regulatory advantage
- **Macro**: Interest rates, FX, oil. Low rates = stocks more attractive than bonds
- **Sentiment**: The mood of the market — fear or greed

## Bid and ask

On the exchange you see two prices: **bid** (what someone will pay) and **ask** (what someone will sell for). The difference is the spread. Liquid stocks like NVDA have spreads of a few cents. Illiquid ones have spreads of several percent.

## Volume matters

If 10 million shares trade in a day, the price is more "real" than if only 50,000 trade. Low volume = high chance a single order moves the price.

## The key takeaway

Price ≠ value. A stock can be "cheap" at 1,000 NOK and "expensive" at 50 NOK — it depends on what the company actually earns. Learn to distinguish the two.

## Practical exercise

Pick a stock from our watchlist and look at the 1-year chart. Identify three big jumps (up or down). Search the date and find what news drove the move.`,
    },
  },
  {
    id: 'pe-and-eps',
    level: 'intermediate',
    readMinutes: 6,
    title: {
      no: 'Fundamental analyse: P/E og EPS',
      en: 'Fundamental analysis: P/E and EPS',
    },
    summary: {
      no: 'De to viktigste tallene for å vurdere om en aksje er dyr eller billig.',
      en: 'The two key numbers for assessing whether a stock is cheap or expensive.',
    },
    body: {
      no: `# Fundamental analyse: P/E og EPS

To tall danner grunnlaget for verdsettelse av en aksje: **EPS** (earnings per share) og **P/E** (price-to-earnings ratio).

## EPS — overskudd per aksje

EPS = totalt overskudd / antall utestående aksjer.

Eksempel: Hvis et selskap tjener 1 milliard og har 100 millioner aksjer, er EPS = 10 kr.

EPS sier hvor mye av selskapets overskudd som "tilhører" hver aksje. Voksende EPS over tid = sterkt selskap.

## P/E — pris i forhold til inntjening

P/E = aksjekurs / EPS.

Hvis aksjen koster 200 kr og EPS er 10 kr, er P/E = 20. Det betyr at du betaler 20 kr for hver krone selskapet tjener i året.

## Hva er en "god" P/E?

Det avhenger av sektoren. En typisk industri-aksje handler på P/E 15. Et hurtigvoksende teknologi-selskap kan handle på 40+ fordi markedet forventer at EPS vil vokse betydelig.

- **Lav P/E (<15)**: Modent selskap eller lave forventninger
- **Medium P/E (15–25)**: Typisk for stabile selskaper
- **Høy P/E (25+)**: Vekstforventninger priset inn

## Forward P/E

Forward P/E bruker forventet EPS neste år, ikke historisk. For raskt voksende selskaper er forward P/E mer relevant.

## Fallgruver

- **P/E uten kontekst**: Sammenlign alltid P/E med peers i samme sektor, ikke på tvers av sektorer
- **Engangshendelser**: Et utbetaling fra et søksmål kan blåse opp EPS midlertidig
- **Negative inntekter**: Selskaper som taper penger har ikke meningsfull P/E

## Praktisk anvendelse

Når du leser et signal i Apex Quantum + som nevner "verdsettelsen er rik (P/E ~35)", vet du nå at modellen mener prisen forutsetter sterk fremtidig vekst.`,
      en: `# Fundamental analysis: P/E and EPS

Two numbers form the foundation of stock valuation: **EPS** (earnings per share) and **P/E** (price-to-earnings ratio).

## EPS — earnings per share

EPS = total earnings / shares outstanding.

Example: If a company earns 1 billion and has 100 million shares, EPS = 10.

EPS says how much of the company's profit "belongs" to each share. Growing EPS over time = strong company.

## P/E — price relative to earnings

P/E = stock price / EPS.

If the stock costs 200 and EPS is 10, P/E = 20. That means you pay 20 for every unit the company earns per year.

## What is a "good" P/E?

It depends on the sector. A typical industrial stock trades at P/E 15. A fast-growing tech company may trade at 40+ because the market expects EPS to grow substantially.

- **Low P/E (<15)**: Mature company or low expectations
- **Medium P/E (15–25)**: Typical for stable companies
- **High P/E (25+)**: Growth expectations priced in

## Forward P/E

Forward P/E uses next year's expected EPS, not historical. For fast-growing companies, forward P/E is more relevant.

## Pitfalls

- **P/E without context**: Always compare P/E to peers in the same sector, not across sectors
- **One-time events**: A lawsuit settlement can inflate EPS temporarily
- **Negative earnings**: Companies losing money don't have meaningful P/E

## Practical application

When you read a signal in Apex Quantum + that says "valuation is rich (P/E ~35)", you now know the model means the price assumes strong future growth.`,
    },
  },
  {
    id: 'rsi-and-moving-averages',
    level: 'intermediate',
    readMinutes: 5,
    title: {
      no: 'Teknisk analyse: RSI og glidende snitt',
      en: 'Technical analysis: RSI and moving averages',
    },
    summary: {
      no: 'Hva chartet kan fortelle deg uten å snakke om regnskap.',
      en: 'What the chart can tell you without touching the income statement.',
    },
    body: {
      no: `# Teknisk analyse: RSI og glidende snitt

Teknisk analyse studerer pris- og volumdata for å identifisere mønstre. Det er ikke krystallkulesyn — men noen verktøy gir nyttig kontekst.

## Glidende snitt (SMA)

Et **50-dagers SMA** er gjennomsnittsprisen siste 50 dager. Et **200-dagers SMA** er siste 200.

- Aksjen *over* SMA200 = oppadgående trend (bullish)
- Aksjen *under* SMA200 = nedadgående trend (bearish)
- "Golden cross" = SMA50 krysser over SMA200 → ofte tolket som bullish-signal
- "Death cross" = SMA50 krysser under SMA200 → bearish

Dette er ikke kjøp-/salgsregler. De er kontekst-indikatorer.

## RSI — Relative Strength Index

RSI måler styrken i prisbevegelser, fra 0 til 100.

- **RSI > 70** = "overkjøpt" — aksjen har steget mye, kortvarig korreksjon mer sannsynlig
- **RSI < 30** = "oversolgt" — har falt mye, kortvarig rebound mer sannsynlig
- **RSI 40–60** = nøytral

Apex Quantum + sin blueprint bruker RSI 55–72 som "sunt momentum" — sterk men ikke ekstrem.

## Hvorfor det fungerer (delvis)

Tradere ser på de samme indikatorene. Når mange aktører reagerer på SMA200 eller RSI 70, blir nivåene selv-oppfyllende profetier — i hvert fall kortsiktig.

## Begrensninger

- Tekniske mønstre fungerer best i likvide aksjer med høyt volum
- Brutte trender kan vare lenge; ikke kjemp mot trenden
- Bruk teknisk analyse som *bekreftelse* av en fundamental tese, ikke som eneste grunn

## Praktisk anvendelse

Når Apex Quantum + sin blueprint sier "Trend-kanalen er intakt over SMA200, RSI 62 viser sunt momentum", oversetter det til: prisen er over 200-dagers gjennomsnittet (oppadgående) og momentumet er sterkt uten å være ekstremt.`,
      en: `# Technical analysis: RSI and moving averages

Technical analysis studies price and volume data to identify patterns. It's not crystal-ball stuff — but some tools provide useful context.

## Moving averages (SMA)

A **50-day SMA** is the average price of the last 50 days. A **200-day SMA** is the last 200.

- Stock *above* SMA200 = uptrend (bullish)
- Stock *below* SMA200 = downtrend (bearish)
- "Golden cross" = SMA50 crosses above SMA200 → often read as bullish
- "Death cross" = SMA50 crosses below SMA200 → bearish

These are not buy/sell rules. They're context indicators.

## RSI — Relative Strength Index

RSI measures the strength of price moves, from 0 to 100.

- **RSI > 70** = "overbought" — the stock has risen a lot, short-term correction more likely
- **RSI < 30** = "oversold" — has fallen a lot, short-term rebound more likely
- **RSI 40–60** = neutral

Apex Quantum +'s blueprint uses RSI 55–72 as "healthy momentum" — strong but not extreme.

## Why it works (partly)

Traders look at the same indicators. When many actors react to SMA200 or RSI 70, the levels become self-fulfilling prophecies — at least short-term.

## Limitations

- Technical patterns work best in liquid stocks with high volume
- Broken trends can last long; don't fight the trend
- Use technical analysis as *confirmation* of a fundamental thesis, not the sole reason

## Practical application

When Apex Quantum +'s blueprint says "trend channel intact above SMA200, RSI 62 shows healthy momentum," that translates to: price is above the 200-day average (uptrend) and momentum is strong without being extreme.`,
    },
  },
  {
    id: 'valuation-multiples',
    level: 'advanced',
    readMinutes: 7,
    title: {
      no: 'Verdsettelse og multiple-sammenligning',
      en: 'Valuation and multiple comparison',
    },
    summary: {
      no: 'Hvordan bestemme om en aksje er over- eller underpriset i forhold til sektoren.',
      en: 'How to decide if a stock is over- or under-priced relative to its sector.',
    },
    body: {
      no: `# Verdsettelse og multiple-sammenligning

Du har lært at P/E er én verdsettelsesmetrik. Profesjonelle investorer bruker flere — og sammenligner alltid mot peers.

## De viktigste multiplene

**P/E**: Pris / inntjening per aksje. Best for modne selskaper med stabile resultater.

**EV/EBITDA**: Enterprise value / inntjening før renter, skatt, av- og nedskrivninger. Justerer for gjeld og kapitalstruktur — bedre for selskaper med ulik gjeldsgrad.

**P/S**: Pris / salg per aksje. Brukes når selskapet ennå ikke er lønnsomt (mange tech-selskaper) eller har volatil inntjening.

**P/B**: Pris / bok-verdi. Relevant for finansselskaper og selskaper med store eiendeler.

**FCF-yield**: Fri kontantstrøm / markedsverdi. Hvor mye "ekte" cash selskapet genererer per investerte krone — gull verdt for utbyttejegere.

## Peer comparison

En P/E på 30 betyr ingenting alene. Men hvis Microsoft handler P/E 30 og Oracle P/E 25, har du noe konkret å snakke om: hvorfor verdsettes Microsoft 20% høyere?

Mulige svar:
- Sterkere vekst (Azure-vekst > Oracle-cloud)
- Bedre marginer
- Sterkere konkurransefortrinn (moat)
- Bedre kapitalavkastning (ROIC)

## Mean reversion

Multipler tenderer å vende mot sektorens gjennomsnitt over tid. Hvis ett selskap handler 50% over sektor-snittet, må enten *fundamentene* rettferdiggjøre premien, eller multipelen vil komprimeres.

## Det Plus-blueprinten gjør

Tilleggsmoment 1 i blueprinten — *peer comparison & relative valuation* — sammenligner systematisk multipler mot peers. Det fanger mispricing som ren absolutt P/E ikke fanger.

## Begrensninger

- Multipler fungerer best for sammenlignbare selskaper i samme sektor og region
- Engangshendelser (oppkjøp, frasalg, søksmål) forvrenger tall
- Fremvoksende markeder har strukturelt ulike multipler enn USA

## Praktisk øvelse

Velg tre selskaper i samme sektor (f.eks. NVDA, AMD, AVGO). Sammenlign forward P/E. Forklar hvorfor de avviker.`,
      en: `# Valuation and multiple comparison

You've learned P/E is one valuation metric. Professional investors use several — and always compare against peers.

## The key multiples

**P/E**: Price / earnings per share. Best for mature companies with stable results.

**EV/EBITDA**: Enterprise value / earnings before interest, taxes, depreciation, amortization. Adjusts for debt and capital structure — better for companies with different leverage.

**P/S**: Price / sales per share. Used when the company isn't profitable yet (many tech companies) or has volatile earnings.

**P/B**: Price / book value. Relevant for financials and asset-heavy companies.

**FCF yield**: Free cash flow / market cap. How much "real" cash the company generates per unit invested — gold for dividend hunters.

## Peer comparison

A P/E of 30 means nothing alone. But if Microsoft trades at P/E 30 and Oracle at P/E 25, you have something concrete: why is Microsoft valued 20% higher?

Possible answers:
- Stronger growth (Azure growth > Oracle cloud)
- Better margins
- Stronger moat
- Better return on invested capital (ROIC)

## Mean reversion

Multiples tend to revert to the sector mean over time. If one company trades 50% above the sector average, either *fundamentals* must justify the premium, or the multiple compresses.

## What the Plus blueprint does

Factor 1 in the blueprint — *peer comparison & relative valuation* — systematically compares multiples to peers. It catches mispricing that pure absolute P/E misses.

## Limitations

- Multiples work best for comparable companies in the same sector and region
- One-time events (acquisitions, divestitures, lawsuits) distort numbers
- Emerging markets have structurally different multiples than the US

## Practical exercise

Pick three companies in the same sector (e.g. NVDA, AMD, AVGO). Compare forward P/E. Explain why they differ.`,
    },
  },
  {
    id: 'risk-and-position-sizing',
    level: 'advanced',
    readMinutes: 6,
    title: {
      no: 'Risikostyring og posisjonsstørrelse',
      en: 'Risk management and position sizing',
    },
    summary: {
      no: 'Det viktigste skillet mellom hobby-investorer og profesjonelle.',
      en: 'The biggest difference between hobbyists and professionals.',
    },
    body: {
      no: `# Risikostyring og posisjonsstørrelse

Den vanligste feilen nye investorer gjør er ikke å velge feil aksje. Det er å satse for mye på én aksje. Profesjonelle vinner ved å begrense tap, ikke bare ved å plukke vinnere.

## Den fundamentale regelen

Aldri risiker mer enn du har råd til å tape — ikke per posisjon, ikke totalt.

Standard tommelfingerregel: maksimalt **1–2 %** av total portefølje tapt per enkelt posisjon. Hvis porteføljen er 100 000 kr, betyr det maksimalt 1 000–2 000 kr i tap per aksje.

## Posisjonsstørrelse: hvordan beregne

Tre tall:
- **Kontostørrelse**: Hvor mye du har totalt
- **Risiko per trade**: Prosent av kontoen du tåler å tape (f.eks. 1 %)
- **Stop-loss-avstand**: Hvor langt fra inngangsprisen du setter stop-loss

Formel: Posisjonsstørrelse = (kontostørrelse × risiko %) / stop-loss-avstand

Eksempel:
- Konto: 100 000 kr
- Risiko per trade: 1 % = 1 000 kr
- Inngangspris NVDA: 1 200 kr
- Stop-loss: 1 080 kr (10 % under)
- Stop-loss-avstand: 120 kr per aksje
- Maksimal posisjonsstørrelse: 1 000 / 120 = 8,3 aksjer

Du bryter regelen ved å kjøpe mer enn 8 aksjer.

## Diversifisering

Ikke alle dine 1 % er uavhengige. Hvis du har 20 aksjer, men alle er amerikanske halvledere, har du fortsatt konsentrert risiko. Diversifiser på tvers av:
- Sektorer (tech, energi, helse, finans)
- Regioner (NO, US, Asia)
- Stilarter (verdi, vekst)

## Drawdown-management

**Drawdown** = nedtrekk fra topp til bunn. Hvis porteføljen din var verdt 100 000 og er nede på 80 000, er drawdown 20 %.

Etter en 20 %-drawdown må du opp 25 % bare for å være tilbake på utgangspunktet. Etter 50 %-drawdown trenger du 100 % oppgang. Tap er asymmetriske — derfor er beskyttelse mot store tap så viktig.

## Plus-blueprintens tilnærming

Apex Quantum +'s deep-analysis-momenter inkluderer regulatorisk risiko, sentimentdeteksjon (insider/short) og sesongmønstre — alle bidrag til *bedre risikovurdering*. Forventet effekt: 10–20 % drawdown-reduksjon ifølge AQR/BlackRock-litteraturen.

## Praktisk anvendelse

Før du legger inn neste ordre: skriv ned din stop-loss-avstand. Hvis du ikke kan, vet du ikke hva du risikerer.`,
      en: `# Risk management and position sizing

The most common mistake new investors make isn't picking the wrong stock. It's betting too much on one. Professionals win by limiting losses, not just by picking winners.

## The fundamental rule

Never risk more than you can afford to lose — not per position, not in total.

Standard rule of thumb: maximum **1–2%** of total portfolio lost per single position. If your portfolio is 100,000, that means a max of 1,000–2,000 in loss per stock.

## Position sizing: how to calculate

Three numbers:
- **Account size**: How much you have total
- **Risk per trade**: Percent of account you can stomach losing (e.g. 1%)
- **Stop-loss distance**: How far from entry you place your stop

Formula: Position size = (account size × risk %) / stop-loss distance

Example:
- Account: 100,000
- Risk per trade: 1% = 1,000
- NVDA entry: 1,200
- Stop-loss: 1,080 (10% below)
- Stop-loss distance: 120 per share
- Max position size: 1,000 / 120 = 8.3 shares

You break the rule by buying more than 8 shares.

## Diversification

Not all your 1%-positions are independent. If you have 20 stocks but all are US semis, you still have concentrated risk. Diversify across:
- Sectors (tech, energy, health, finance)
- Regions (NO, US, Asia)
- Styles (value, growth)

## Drawdown management

**Drawdown** = peak-to-trough decline. If your portfolio was 100,000 and is now 80,000, drawdown is 20%.

After a 20% drawdown you need 25% to get back to par. After 50%, you need 100%. Losses are asymmetric — that's why protecting against big losses matters so much.

## The Plus blueprint approach

Apex Quantum +'s deep-analysis factors include regulatory risk, sentiment detection (insider/short), and seasonal patterns — all contributing to *better risk assessment*. Expected impact: 10–20% drawdown reduction per AQR/BlackRock literature.

## Practical application

Before placing your next order: write down your stop-loss distance. If you can't, you don't know what you're risking.`,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BEGINNER — added lessons
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'reading-a-ticker',
    level: 'beginner',
    readMinutes: 6,
    title: { no: 'Lese en ticker — fra symbol til pris', en: 'Reading a ticker — from symbol to price' },
    summary: {
      no: 'Hva betyr NVDA, EQNR.OL og 2330.TW? Anatomien til en aksjenotering.',
      en: 'What do NVDA, EQNR.OL and 2330.TW mean? The anatomy of a quote.',
    },
    body: {
      no: `# Lese en ticker — fra symbol til pris

Hver aksje på en børs har et **ticker-symbol**: en kort kode som identifiserer den unikt. Når du ser \`NVDA\` i Apex Quantum +, refererer det til NVIDIA Corporation på NASDAQ. Når du ser \`EQNR.OL\`, refererer det til Equinor på Oslo Børs.

## Symbol-anatomi

Symbolet består av to deler: aksjekoden og børs-suffikset. På amerikanske børser (NYSE, NASDAQ) er det vanligvis bare aksjekoden — \`NVDA\`, \`AAPL\`, \`MSFT\`. På internasjonale børser legges et suffiks til.

| Suffiks | Børs | Eksempel |
| --- | --- | --- |
| (ingen) | NYSE / NASDAQ (USA) | NVDA, AVGO, LLY |
| .OL | Oslo Børs (Norge) | EQNR.OL, MOWI.OL |
| .DE | Xetra (Tyskland) | SAP.DE, RHM.DE |
| .L | London Stock Exchange | BA.L, SSE.L |
| .PA | Euronext Paris | AIR.PA, EDF.PA |
| .HK | Hong Kong | 0700.HK, 9988.HK |
| .T | Tokyo | 7203.T, 8035.T |
| .TW | Taiwan | 2330.TW, 2454.TW |
| .KS | Korea | 005930.KS |

## Hva en quote forteller deg

Når du ser en aksje-quote, får du fem grunnleggende tall: **siste pris**, **endring**, **dagens høy/lav**, **volum**, og **bid/ask**.

[viz:candlestick]

I illustrasjonen over ser du anatomien til én dags handel:
- **Åpning** (968): første handel etter børsen åpnet
- **Slutt** (975): siste handel før børsen stengte
- **Høy** (982) og **Lav** (962): største svingninger i løpet av dagen
- **Tynne linjen** (vekt/wick): indikerer ekstrempriser intraday

Når slutt > åpning, fargelegges "kroppen" grønn (oppgang). Når slutt < åpning: rød (nedgang). Lange "vekter" forteller at markedet testet nivåer det ikke holdt.

> [!example]
> Hvis Equinor (EQNR.OL) åpnet på 285.00, gikk så lavt som 281.40 men endte dagen på 287.20, har vi en grønn candle med lang nedre vekt. Det signaliserer at noen forsøkte å presse kursen ned, men kjøperne tok over.

## Siste-pris vs midtpris

Mange handelsplattformer viser "siste pris" — den siste handelen som ble gjennomført. Men "den ekte" prisen ligger ofte mellom **bid** (hva kjøper er villig til å betale) og **ask** (hva selger forlanger). Forskjellen heter **spread**.

> [!key]
> Spread = ask − bid. Likvide aksjer som NVDA har spread på noen øre. Illikvide små-cap har spreads på 1–3%. Stor spread = stor "kostnad" når du går inn og ut av posisjon.

## Praktisk øvelse

Velg tre tickere fra Apex Quantum + sin watchlist — én norsk, én amerikansk, én asiatisk. Sammenlign hvor stor spread'en er i prosent (ask − bid) / midtpris. Aksjen med størst spread vil koste deg mest når du handler den.`,
      en: `# Reading a ticker — from symbol to price

Every stock on an exchange has a **ticker symbol**: a short code that uniquely identifies it. When you see \`NVDA\` in Apex Quantum +, it refers to NVIDIA Corporation on NASDAQ. When you see \`EQNR.OL\`, it's Equinor on Oslo Børs.

## Symbol anatomy

The symbol has two parts: the stock code and the exchange suffix. On US exchanges (NYSE, NASDAQ) it's typically just the code — \`NVDA\`, \`AAPL\`, \`MSFT\`. On international exchanges, a suffix is added.

| Suffix | Exchange | Examples |
| --- | --- | --- |
| (none) | NYSE / NASDAQ (USA) | NVDA, AVGO, LLY |
| .OL | Oslo Børs (Norway) | EQNR.OL, MOWI.OL |
| .DE | Xetra (Germany) | SAP.DE, RHM.DE |
| .L | London Stock Exchange | BA.L, SSE.L |
| .PA | Euronext Paris | AIR.PA, EDF.PA |
| .HK | Hong Kong | 0700.HK, 9988.HK |
| .T | Tokyo | 7203.T, 8035.T |
| .TW | Taiwan | 2330.TW, 2454.TW |
| .KS | Korea | 005930.KS |

## What a quote tells you

When you see a stock quote, you get five basic numbers: **last price**, **change**, **day's high/low**, **volume**, and **bid/ask**.

[viz:candlestick]

The illustration shows one day of trading:
- **Open** (968): first trade after the exchange opened
- **Close** (975): last trade before the exchange closed
- **High** (982) and **Low** (962): biggest swings during the day
- **Thin line** (wick): indicates intraday extremes

When close > open, the body is green (up). When close < open: red (down). Long wicks tell you the market tested levels it couldn't hold.

> [!example]
> If Equinor (EQNR.OL) opened at 285.00, went as low as 281.40 but closed the day at 287.20, you'd see a green candle with a long lower wick. That signals someone tried to push the price down, but buyers took control.

## Last price vs mid-price

Most platforms show "last price" — the last trade executed. But "the real" price sits between **bid** (what a buyer is willing to pay) and **ask** (what a seller demands). The gap is called **spread**.

> [!key]
> Spread = ask − bid. Liquid stocks like NVDA have spreads of a few cents. Illiquid small-caps have spreads of 1–3%. A wide spread is a real "cost" every time you enter or exit.

## Practice exercise

Pick three tickers from the Apex Quantum + watchlist — one Norwegian, one US, one Asian. Compare each spread as a percent: (ask − bid) / mid. The widest-spread stock will cost you the most every trade.`,
    },
  },

  {
    id: 'bid-ask-and-orderbook',
    level: 'beginner',
    readMinutes: 6,
    title: { no: 'Ordreboken — slik fungerer børsen under panseret', en: 'The order book — how the exchange works under the hood' },
    summary: {
      no: 'Bid, ask, dybde og market vs limit. Mekanikken bak hver handel.',
      en: 'Bid, ask, depth, and market vs limit. The mechanics behind every trade.',
    },
    body: {
      no: `# Ordreboken — slik fungerer børsen under panseret

Når du legger en kjøpsordre, dukker den ikke bare opp ut av løse luften. Den havner i **ordreboken** — en sortert liste over alle kjøps- og salgsordrer på den aktuelle aksjen.

[viz:order-book]

## To sider av boken

På venstre side: **bid** — alle kjøperne, sortert fra høyeste til laveste pris. Den øverste bid'en er hva noen er villig til å betale akkurat nå.

På høyre side: **ask** — alle selgerne, sortert fra laveste til høyeste pris. Den øverste ask'en er hva noen vil selge for akkurat nå.

> [!key]
> En handel skjer kun når en kjøper og en selger er enige om pris. Ordreboken gir deg kontinuerlig oversikt over hvor det er overlapp.

## Eksempel: Eli Lilly (LLY)

| Bid (kjøper) | Ask (selger) |
| --- | --- |
| 975.4 × 120 | 975.6 × 100 |
| 975.3 × 104 | 975.7 × 88 |
| 975.2 × 88 | 975.8 × 76 |
| 975.1 × 72 | 975.9 × 64 |

Spread = 975.6 − 975.4 = 0.20 (~0.02%). Topp-bid er 120 aksjer på 975.4. Topp-ask er 100 aksjer på 975.6.

> [!example]
> Du sender en **markedsordre** for å kjøpe 250 aksjer LLY. Børsen tar 100 aksjer fra ask 975.6, deretter 88 aksjer fra ask 975.7, deretter 62 aksjer fra ask 975.8. Snittpris du betaler: ~975.71. Med stor ordre "spiser" du flere nivåer — det heter **slippage**.

## Markedsordre vs limit-ordre

**Markedsordre** = kjøp/selg umiddelbart til hvilken som helst pris. Du får sikker eksekvering, men ukontrollert pris.

**Limit-ordre** = kjøp på maks 975.50 (ingen høyere) eller selg på minst 976.00 (ingen lavere). Du kontrollerer prisen, men du er ikke garantert eksekvering.

> [!warn]
> Aldri bruk markedsordre på illikvide aksjer (lavt volum, stor spread). Du kan få fyll på dramatisk dårligere pris enn du forventet. Ny handelsregel: alltid limit-ordre når spread'en er > 0.5%.

## Dybde og likviditet

**Dybde** = hvor mange aksjer som ligger på hvert nivå. NVDA har ofte tusenvis av aksjer på hvert tier — du kan handle 10 000 aksjer uten å flytte prisen merkbart. En småselskaps-aksje på Oslo Børs kan ha 200 aksjer på topp-nivå — en ordre på 10 000 ville beveget kursen 1–2%.

## Praktisk øvelse

På Nordnet eller en hvilken som helst meglerplattform: åpne en aksje du eier, klikk "ordrebok" / "depth" / "level 2". Tell hvor mange aksjer som ligger på de fem øverste bid- og ask-nivåene. Dette er **utskiftbar likviditet** — den du kan flytte ut av posisjon med uten å bli hindret av tynn marked.`,
      en: `# The order book — how the exchange works under the hood

When you place a buy order, it doesn't appear out of thin air. It lands in the **order book** — a sorted list of all buy and sell orders for that stock.

[viz:order-book]

## Two sides of the book

Left side: **bid** — every buyer, sorted high-to-low. The top bid is what someone is willing to pay right now.

Right side: **ask** — every seller, sorted low-to-high. The top ask is what someone will sell for right now.

> [!key]
> A trade only happens when a buyer and a seller agree on price. The order book gives you continuous visibility into where overlap exists.

## Example: Eli Lilly (LLY)

| Bid (buyer) | Ask (seller) |
| --- | --- |
| 975.4 × 120 | 975.6 × 100 |
| 975.3 × 104 | 975.7 × 88 |
| 975.2 × 88 | 975.8 × 76 |
| 975.1 × 72 | 975.9 × 64 |

Spread = 975.6 − 975.4 = 0.20 (~0.02%). Top bid: 120 shares at 975.4. Top ask: 100 shares at 975.6.

> [!example]
> You send a **market order** to buy 250 LLY. The exchange takes 100 from 975.6, then 88 from 975.7, then 62 from 975.8. Your average fill: ~975.71. With size, you "eat" multiple levels — that's **slippage**.

## Market vs limit orders

**Market order** = buy/sell immediately at whatever price. Guaranteed fill, uncontrolled price.

**Limit order** = buy at no more than 975.50, or sell at no less than 976.00. You control price, but no guarantee of fill.

> [!warn]
> Never use market orders on illiquid stocks (low volume, wide spread). You can get filled dramatically worse than you expected. Personal rule: always limit-order when spread > 0.5%.

## Depth and liquidity

**Depth** = shares resting at each level. NVDA usually has thousands per tier — you can trade 10,000 shares without moving the price meaningfully. A small-cap on Oslo Børs may have 200 shares at the top — a 10,000-share order would move the price 1–2%.

## Practice exercise

On any broker (Nordnet, IBKR, etc.): open a stock you own, click "order book" / "depth" / "level 2". Count the shares at the top five bid and ask levels. That's **executable liquidity** — what you can exit into without fighting a thin market.`,
    },
  },

  {
    id: 'dividends-and-buybacks',
    level: 'beginner',
    readMinutes: 5,
    title: { no: 'Utbytte og tilbakekjøp — hvordan selskaper deler ut penger', en: 'Dividends and buybacks — how companies return cash' },
    summary: {
      no: 'To måter selskaper sender penger tilbake til eierne. Hvilken er best?',
      en: 'Two ways companies send cash back to owners. Which is better?',
    },
    body: {
      no: `# Utbytte og tilbakekjøp

Når et selskap tjener mer penger enn det trenger til drift og vekst, har ledelsen tre valg:
1. **Reinvestere** i driften (R&D, fabrikker, markedsføring)
2. **Betale utbytte** til aksjonærene
3. **Kjøpe tilbake egne aksjer** (buybacks)

## Utbytte — direkte cashflow

Et utbytte er en kontant utbetaling per aksje. Equinor betalte ~13 NOK/aksje i utbytte i 2024. Hvis du eide 100 aksjer, fikk du 1 300 NOK direkte i kontoen din.

> [!example]
> Du eier 100 aksjer Equinor til kurs 285 (verdi 28 500 NOK). Selskapet annonserer et utbytte på 3.50 NOK/aksje. På "ex-date" justeres kursen ned med utbyttet (kursen åpner ~281.50), og du får 350 NOK i kontanter. Total verdi: 28 500 NOK fortsatt — men nå har du 350 i kontanter + 28 150 i aksjer.

## Tilbakekjøp — indirekte verdiøkning

I stedet for å betale ut kontanter, kan selskapet kjøpe tilbake egne aksjer i markedet. Apple har gjennomført over $700 milliarder i buybacks det siste tiåret.

**Mekanikken:** færre aksjer i omløp = hver gjenværende aksje eier en større del av selskapet. EPS (earnings per share) stiger automatisk selv om totalt overskudd er det samme.

> [!key]
> Buybacks er skattegunstigere enn utbytte i mange jurisdiksjoner: du betaler ikke skatt før du selger aksjen. Utbytte beskattes når du mottar det.

## Sammenligning

| Faktor | Utbytte | Tilbakekjøp |
| --- | --- | --- |
| Skatteeffekt | Beskattes ved utbetaling | Utsatt til salg |
| Forutsigbarhet | Høy (kvartals/årlig) | Lav (kan stoppes) |
| Signaleffekt | "Vi har overskuddslikviditet" | "Vi mener aksjen er undervurdert" |
| Påvirkning på EPS | Ingen direkte | Øker EPS |
| Aksjonærens kontroll | Får kontanter, kan reinvestere | Må selge aksjer for likviditet |

## Når selskaper velger hva

**Modne selskaper med stabil cashflow** (Coca-Cola, Equinor, Equity REIT-er) betaler typisk utbytte. De har færre attraktive interne investeringer.

**Vekstselskaper** (NVIDIA, Tesla i tidlige år) reinvesterer alt — verken utbytte eller buybacks. Hver krone går til R&D og kapasitet.

**Veldig modne tech-giganter** (Apple, Microsoft, Meta) gjør ofte begge: små utbytter + massive buybacks. Apple har redusert antall utestående aksjer fra ~26 milliarder (2012) til ~15 milliarder (2024) — det betyr hver av dine aksjer eier nesten dobbelt så mye av selskapet.

> [!warn]
> Stort buyback-program er ikke alltid bra. Hvis selskapet kjøper egne aksjer på all-time-high mens innsiderne selger, er det et rødt flagg. Sjekk alltid om buybacks finansieres med fri cashflow eller med ny gjeld.

## Hva du bør se etter

For utbytteaksjer: **payout ratio** = utbytte / overskudd. Over 80% er sårbart hvis overskuddet faller. Under 50% gir rom for å øke utbyttet.

For buybacks: er antall utestående aksjer faktisk synkende? Sjekk "diluted shares outstanding" i årsrapporten over 5 år. Hvis tallet ikke synker tross store buyback-programmer, brukes mye av kapitalen til å motvirke aksje-baserte bonuser til ledelsen — ikke å returnere verdi til deg.`,
      en: `# Dividends and buybacks

When a company makes more cash than it needs for operations and growth, management has three choices:
1. **Reinvest** in the business (R&D, capacity, marketing)
2. **Pay dividends** to shareholders
3. **Buy back its own shares** (buybacks)

## Dividends — direct cashflow

A dividend is a cash payment per share. Equinor paid ~13 NOK/share in 2024. If you owned 100 shares, you got 1,300 NOK in your account.

> [!example]
> You own 100 Equinor shares at 285 (28,500 NOK total). The company declares a 3.50 NOK/share dividend. On ex-date, the share opens ~281.50, and 350 NOK lands in your cash account. Total value: still 28,500 — but now 350 in cash + 28,150 in stock.

## Buybacks — indirect value increase

Instead of paying cash, the company buys its own shares in the open market. Apple has executed over $700B in buybacks over the past decade.

**Mechanics:** fewer shares outstanding = each remaining share owns a bigger slice. EPS rises automatically even if total earnings are flat.

> [!key]
> Buybacks are more tax-efficient than dividends in many jurisdictions: you don't pay tax until you sell the stock. Dividends are taxed on receipt.

## Comparison

| Factor | Dividends | Buybacks |
| --- | --- | --- |
| Tax timing | At receipt | Deferred to sale |
| Predictability | High (quarterly/annual) | Low (can be paused) |
| Signal | "We have excess cash" | "We think shares are undervalued" |
| Direct EPS impact | None | Increases EPS |
| Shareholder control | Cash to redeploy | Must sell shares for liquidity |

## When companies choose what

**Mature companies with stable cashflow** (Coca-Cola, Equinor, REITs) typically pay dividends. They have fewer attractive internal investment opportunities.

**Growth companies** (NVIDIA, early Tesla) reinvest everything — no dividends, no buybacks. Every dollar goes to R&D and capacity.

**Very mature tech giants** (Apple, Microsoft, Meta) often do both: small dividends + massive buybacks. Apple has reduced shares outstanding from ~26B (2012) to ~15B (2024) — meaning each of your shares now owns nearly double the company.

> [!warn]
> A big buyback isn't always good. If the company is buying its own shares at all-time-highs while insiders are selling, that's a red flag. Always check whether buybacks are funded by free cashflow or by new debt.

## What to look for

For dividend stocks: **payout ratio** = dividend / earnings. Over 80% is fragile if earnings dip. Under 50% leaves room to grow the dividend.

For buybacks: is share count actually falling? Check "diluted shares outstanding" in the 10-K over 5 years. If the number isn't dropping despite big buybacks, much of the capital is offsetting employee stock-comp dilution — not returning value to you.`,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // INTERMEDIATE — added lessons
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'reading-an-income-statement',
    level: 'intermediate',
    readMinutes: 8,
    title: { no: 'Lese en resultatregnskap — Equinor Q3 som case', en: 'Reading an income statement — Equinor Q3 as a case' },
    summary: {
      no: 'Fra topplinje til bunnlinje: hva hver linje forteller deg.',
      en: 'From top line to bottom line: what each row tells you.',
    },
    body: {
      no: `# Lese en resultatregnskap

Resultatregnskapet (income statement) viser hva som skjedde med selskapet i en periode — typisk ett kvartal eller ett år. Du går fra **omsetning** (det selskapet solgte for) ned til **netto resultat** (det som er igjen til aksjonærene).

## Strukturen — fra topp til bunn

| Linje | Hva det er | Hva det forteller |
| --- | --- | --- |
| Omsetning | Total inntekt fra salg | Selskapets størrelse / vekst |
| Vareforbruk (COGS) | Direkte kostnader | Marginrom |
| Bruttoresultat | Omsetning − COGS | Hvor lønnsom kjernedriften er |
| Driftskostnader | Lønn, marketing, R&D | Effektivitet |
| EBIT | Bruttoresultat − driftskost | Underliggende driftslønnsomhet |
| Renter | Kostnad på gjeld | Gjeldsbyrde |
| Skatt | Selskapsskatt | Effektiv skatterate |
| Netto resultat | Bunnlinjen | Det som er aksjonærenes |

## Worked example: Equinor Q3 2024 (skissert)

> [!data]
> Tall i milliarder USD. Disse er forenklet for læringsformål — alltid sjekk reelle filer i kvartalsrapporten.
>
> Omsetning: 25.9
> Vareforbruk: −13.2
> Bruttoresultat: 12.7
> Drifts- og lete-kostnader: −5.1
> EBIT: 7.6
> Netto rentekostnad: −0.4
> Skatt: −5.2
> Netto resultat: 2.0

## Hva tallene forteller

**Bruttomargin** = bruttoresultat / omsetning = 12.7 / 25.9 = **49%**. For et oljeselskap er dette høyt og avhenger sterkt av oljepris. Sammenlign med:

| Selskap | Bruttomargin (typisk) | Hvorfor |
| --- | --- | --- |
| NVIDIA | 70–75% | Software-lignende halvledere |
| Equinor | 35–55% | Volatil oljepris, kapital-tung |
| Mowi | 15–25% | Råvare-syklisk laksenæring |
| Microsoft | 65–70% | Cloud + lisens-modell |

> [!key]
> Bruttomargin forteller deg om prismakt. Når margin holder seg stabil eller stiger ved volumvekst, har selskapet en moat. Når den krymper, er konkurransen i ferd med å vinne.

**EBIT-margin** = EBIT / omsetning = 7.6 / 25.9 = **29%**. Dette er underliggende lønnsomhet før skatt og kapitalstruktur. Sammenligning på tvers av selskaper er ofte fairere på EBIT enn på netto resultat (siden skatt og gjeld varierer).

**Effektiv skatterate** = skatt / (EBIT − renter) = 5.2 / 7.2 = **72%**. Voldsom høy! Hvorfor? Norge har egen petroleumsskatt på 78% på sokkelvirksomhet (vanlig selskapsskatt 22% + spesialskatt 56%). Dette er den største grunnen til at Equinor's "operating margin" og "net margin" er svært forskjellige.

> [!warn]
> Aldri sammenlign netto resultat på tvers av jurisdiksjoner uten å justere for skatteregime. Equinor's effektive skatt på 60–80% gjør P/E-forholdet kunstig høyt sammenlignet med f.eks. Exxon (~20% effektiv skatt).

## Trender betyr mer enn nivåer

Et øyeblikksbilde sier lite. Sammenligning over flere kvartaler/år forteller historien:

[viz:trend-channel]

Se på Equinor's bruttomargin de siste 8 kvartalene. Hvis den ligger i en stigende kanal, øker selskapet gradvis sin prismakt — kanskje på grunn av høyere oljepris eller mer effektiv produksjon. Hvis den faller, er kostnader i ferd med å erodere lønnsomheten.

## Hva du skal se etter

1. **Vekst på topplinjen** (omsetning) — er selskapet faktisk større år-over-år?
2. **Marginekspansjon** — vokser bruttomargin eller EBIT-margin?
3. **Operativ leverage** — hvis omsetning vokser 10% og EBIT vokser 25%, er kostnader relativt faste — det er bra
4. **Kvalitet** — engangsoppskrivninger, kursgevinster, valutaeffekter forskyvende seg ofte i bunnlinjen, men forteller lite om underliggende drift

## Praktisk øvelse

Velg en aksje fra Apex Quantum +-watchlisten. Last ned siste kvartalsrapport (selskapets investor-relations-side har dem som PDF). Skriv opp omsetning, bruttoresultat, EBIT og netto resultat for de siste 4 kvartalene. Beregn tre marginer (brutto, EBIT, netto) og spør: er trenden opp eller ned? Det forteller mer enn dagens kurs.`,
      en: `# Reading an income statement

The income statement shows what happened to the company during a period — usually a quarter or a year. You go from **revenue** (what the company sold) down to **net income** (what's left for shareholders).

## Structure — top to bottom

| Line | What it is | What it tells you |
| --- | --- | --- |
| Revenue | Total sales | Company size / growth |
| Cost of goods (COGS) | Direct costs | Margin headroom |
| Gross profit | Revenue − COGS | Core profitability |
| Operating expenses | SG&A, R&D | Efficiency |
| EBIT | Gross − OpEx | Underlying operating profit |
| Interest | Cost of debt | Leverage burden |
| Tax | Corporate tax | Effective tax rate |
| Net income | The bottom line | What belongs to shareholders |

## Worked example: Equinor Q3 2024 (illustrative)

> [!data]
> USD billions. Simplified for learning — always cross-check the actual filing.
>
> Revenue: 25.9
> COGS: −13.2
> Gross profit: 12.7
> Operating + exploration costs: −5.1
> EBIT: 7.6
> Net interest: −0.4
> Tax: −5.2
> Net income: 2.0

## What the numbers tell you

**Gross margin** = gross profit / revenue = 12.7 / 25.9 = **49%**. High for an oil company, sensitive to oil price. Compare:

| Company | Typical gross margin | Why |
| --- | --- | --- |
| NVIDIA | 70–75% | Software-like semis |
| Equinor | 35–55% | Volatile oil, capex-heavy |
| Mowi | 15–25% | Cyclical commodity (salmon) |
| Microsoft | 65–70% | Cloud + license model |

> [!key]
> Gross margin signals pricing power. When margin stays flat or rises during volume growth, the company has a moat. When it shrinks, competition is winning.

**EBIT margin** = EBIT / revenue = 7.6 / 25.9 = **29%**. Underlying profitability before tax and capital structure. Cross-company comparison is usually fairer on EBIT than on net income (since tax and leverage differ).

**Effective tax rate** = tax / (EBIT − interest) = 5.2 / 7.2 = **72%**. Extremely high! Why? Norway charges a special petroleum tax of 78% on continental-shelf operations (22% corporate + 56% special). This is the biggest reason Equinor's "operating margin" and "net margin" diverge so much.

> [!warn]
> Never compare net income across jurisdictions without adjusting for tax regime. Equinor's 60–80% effective tax makes its P/E look inflated next to e.g. Exxon (~20% effective).

## Trends beat snapshots

A single snapshot says little. Multi-quarter comparison tells the story:

[viz:trend-channel]

Look at Equinor's gross margin over 8 quarters. Rising channel → pricing power building (higher oil, more efficient output). Falling channel → cost erosion.

## What to look for

1. **Top-line growth** — is the company actually larger YoY?
2. **Margin expansion** — gross or EBIT margin trending up?
3. **Operating leverage** — if revenue grows 10% and EBIT grows 25%, costs are relatively fixed — that's good
4. **Quality** — one-time gains, FX swings, mark-to-markets distort net income but say nothing about underlying operations

## Practice exercise

Pick a stock from the Apex Quantum + watchlist. Download the latest quarterly report (investor-relations page has the PDF). Write down revenue, gross profit, EBIT and net income for the last 4 quarters. Compute three margins (gross, EBIT, net) and ask: trend up or down? That tells you more than today's price.`,
    },
  },

  {
    id: 'support-and-resistance',
    level: 'intermediate',
    readMinutes: 6,
    title: { no: 'Støtte, motstand og trend-kanaler', en: 'Support, resistance and trend channels' },
    summary: {
      no: 'Hvorfor priser ofte vender på samme nivåer.',
      en: 'Why prices often turn at the same levels.',
    },
    body: {
      no: `# Støtte, motstand og trend-kanaler

Aksjekurser er ikke tilfeldige — de beveger seg ofte i mønstre fordi mange handler med like data og psykologi. Tre konsepter forklarer mye:

## Støtte (support)

Et **støtte-nivå** er en pris hvor aksjen historisk har sluttet å falle — kjøpere har trådt til. Hvis NVDA gang på gang bunnet på rundt 870 USD, og hver gang sprang opp 10–15% derfra, er 870 et støttenivå.

> [!example]
> Eli Lilly bunnet på rundt 700 USD tre ganger fra mai til august 2024. Hver gang det testet 700, kom kjøpere inn. Den fjerde testen brøt nivået — kursen falt til 620 før den fant nytt fotfeste. Brutt støtte = ofte fortsatt fall.

## Motstand (resistance)

Det motsatte: et nivå hvor aksjen historisk har sluttet å stige — selgere har trådt til. Hvis Equinor flere ganger nådde 320 NOK og falt tilbake fra det nivået, er 320 en motstand.

> [!key]
> Når motstand brytes, blir den ofte til ny støtte. Psykologi: alle som solgte på 320 vil "kjøpe tilbake hvis det kommer ned dit igjen" — så når kursen retesterer 320 ovenfra, kommer kjøperne i stedet for selgerne.

## Trend-kanaler

[viz:trend-channel]

En **trend-kanal** er to parallelle linjer som viser hvor en aksje har handlet over tid:
- **Øvre linje** = motstand (kjøperne mister momentum)
- **Nedre linje** = støtte (selgerne mister momentum)

I en stigende kanal hever begge linjene seg over tid — selskapet har positiv momentum. I en fallende kanal synker begge linjene — negativ momentum.

## Hvorfor det fungerer

Tre grunner:
1. **Anker-pris** — de fleste handlere ser samme historiske grafer, og legger ordrer på samme nivåer
2. **Stop-loss-clustering** — mange traders setter stops 1–2% under et åpenbart støttenivå, så et brudd utløser kaskade av salg
3. **Round numbers** — psykologisk er 100, 500, 1000 sterke nivåer (Tesla på 200, Bitcoin på 100k)

## Hvordan bruke det

| Situasjon | Hva det betyr |
| --- | --- |
| Nær støtte i stigende kanal | Asymmetrisk oppside — risk/reward ofte 1:3 eller bedre |
| Nær motstand i stigende kanal | Tidspunkt for å tåle volatilitet — kursen kan falle tilbake til støtte før neste leg opp |
| Brudd på motstand med høy volum | Trend-fortsettelse — ofte 5–15% videre opp |
| Brudd på støtte med høy volum | Trendskifte — vurder å redusere posisjon |

> [!warn]
> Teknisk analyse er sannsynlighet, ikke garanti. En "klassisk" støtte holder ~60% av tiden — bra nok til å justere posisjonsstørrelse, ikke bra nok til å gå all-in.

## Praktisk øvelse

Tegn (på papir eller i grafverktøy) en linje under de siste 3 lokale bunnene på en aksje fra Apex Quantum +. Tegn også en linje over de siste 3 lokale toppene. Hvis linjene er parallelle, har du en kanal. Hvis ikke, leter du etter feil mønster — prøv kortere eller lengre tidshorisont.`,
      en: `# Support, resistance and trend channels

Stock prices aren't random — they often move in patterns because everyone trades with similar data and psychology. Three concepts explain a lot:

## Support

A **support level** is a price where the stock historically stopped falling — buyers stepped in. If NVDA repeatedly bottomed near 870 USD, jumping 10–15% from there each time, 870 is support.

> [!example]
> Eli Lilly bottomed near 700 USD three times from May to August 2024. Every test of 700, buyers came in. The fourth test broke through — the stock fell to 620 before finding new footing. Broken support = often continued decline.

## Resistance

The opposite: a level where the stock historically stopped rising — sellers stepped in. If Equinor repeatedly hit 320 NOK and fell back from that level, 320 is resistance.

> [!key]
> When resistance breaks, it often becomes new support. Psychology: everyone who sold at 320 wants to "buy back if it comes down here again" — so on a re-test from above, buyers replace sellers.

## Trend channels

[viz:trend-channel]

A **trend channel** is two parallel lines showing where a stock has traded:
- **Upper line** = resistance (buyers lose steam)
- **Lower line** = support (sellers lose steam)

In a rising channel both lines rise over time — positive momentum. In a falling channel both lines fall — negative momentum.

## Why it works

Three reasons:
1. **Price anchoring** — most traders see the same charts and place orders at the same levels
2. **Stop-loss clustering** — many traders set stops 1–2% below an obvious support, so a break triggers a cascade
3. **Round numbers** — 100, 500, 1000 are psychologically strong (Tesla at 200, Bitcoin at 100k)

## How to use it

| Situation | What it means |
| --- | --- |
| Near support in rising channel | Asymmetric upside — risk/reward often 1:3 or better |
| Near resistance in rising channel | Expect a pullback to support before the next leg up |
| Resistance break on high volume | Trend continuation — often 5–15% more upside |
| Support break on high volume | Trend change — consider trimming |

> [!warn]
> Technicals are probabilistic, not deterministic. A "classic" support holds ~60% of the time — enough to size positions, not enough to go all-in.

## Practice exercise

Draw (on paper or in a charting tool) a line under the last 3 local lows on a stock from Apex Quantum +. Draw another line over the last 3 local highs. If the lines are parallel, you have a channel. If not, you're forcing the wrong pattern — try a shorter or longer timeframe.`,
    },
  },

  {
    id: 'sector-rotation-cycles',
    level: 'intermediate',
    readMinutes: 7,
    title: { no: 'Sektorrotasjon — hvordan kapital flyter mellom sektorer', en: 'Sector rotation — how capital flows between sectors' },
    summary: {
      no: 'Tidlig syklus, midt-syklus, sen-syklus: hva leder og hva henger etter.',
      en: 'Early, mid, late cycle: what leads and what lags.',
    },
    body: {
      no: `# Sektorrotasjon

Markedet er ikke ett enkelt skip — det er en flåte. Når makro-vinden snur, flytter kapitalen seg mellom sektorer i forutsigbare mønstre. Å forstå dette gjør deg bedre på timing.

## De fire fasene

| Fase | Makro-signaler | Sektor-ledere | Sektorer som henger etter |
| --- | --- | --- | --- |
| Tidlig syklus | Renter faller, økonomien snur opp | Finans, eiendom, forbruksvarer | Energi, råvarer |
| Midt-syklus | Vekst akselererer, optimisme | Tech, industri, semis | Defensive, utilities |
| Sen-syklus | Inflasjon, renter stiger | Energi, råvarer, materials | Tech, vekst |
| Resesjon / kontraksjon | BNP faller, renter høye→snur | Helse, utilities, dagligvare | Sykliske (auto, retail, hus) |

## Worked example: 2020–2024

**2020 (tidlig syklus etter COVID-krise):** Renter slik mot null, stimulus pumpet inn. Lederene: tech (NVDA +120%), forbruksdiskresjon (ETSY +400%). Energi-aksjer (XLE) falt ~40% — ingen kjørte bil.

**2021 (midt-syklus):** Reopening, semis-knapphet, AI-narrative starter. Lederene: NVDA, AMD, ASML — alt halvledere. SaaS og fintech også stort.

**2022 (sen-syklus, inflasjons-fight):** Fed hevet renter agressivt. Tech kollapset (NASDAQ −33%), men energi-aksjer leverte sitt beste år på flere tiår (XLE +60%, Equinor +85%). Defensive holdt seg (Walmart, Coca-Cola).

**2023–2024 (ny syklus, AI-bonanza):** Tech tilbake i lederrollen (NVDA +250% i 2023), spesielt AI-eksponering. Energi henger etter (oljepris flat).

> [!key]
> Sektor-rotasjonen er ikke deterministisk — AI-rallyet i 2023 brøt klassiske mønstre. Men den gir deg et rammeverk: når renter er på vei opp, vær forsiktig med høyt verdsatt vekst. Når renter er på vei ned, dump defensive til fordel for sykliske.

## Hvordan se det i Apex Quantum +

Watchlisten din dekker flere sektorer:
- **Semis / AI infra** (NVDA, AVGO, TSM, AMD, ARM, ANET) — leder i midt-syklus
- **Energi / kjernekraft** (OKLO, GEV, TLN, CEG, BWXT) — leder i sen-syklus + AI strømbehov
- **Defensive helse** (UNH, ELV, ABT) — defensive, henger ofte etter midt-syklus men holder ved kontraksjon
- **Defense** (LMT, RTX, NOC, KOG.OL) — geopolitikk-drevet, mindre konjunktur-følsom
- **Norsk olje/oljeservice** (EQNR.OL, AKSO.OL, SUBC.OL, BORR.OL) — sen-syklus / commodity-cycle

> [!example]
> Hvis du tror Fed snart kutter renter (vi går fra sen-syklus til ny tidlig-syklus), vil du redusere energi-eksponering og legge til mer tech/forbruks-eksponering. Hvis du tror inflasjonen kommer tilbake, gjør du det motsatte.

## Sektorbredde — et viktig signal

Når kun 5 aksjer driver hele markedet (S&P 500 var sånn i 2023, drevet av "Magnificent 7"), er trenden skjør. Når **bredde** øker — flere sektorer deltar — er trenden sunn.

> [!warn]
> Avanserte traders ser på "advance/decline-line": hvor mange av S&P 500-aksjene stiger på en dag vs faller. Hvis indeksen stiger men advance/decline faller, er momentum konsentrert i få aksjer — risiko for ras.

## Praktisk øvelse

Velg fire sektor-ETFer: XLE (energi), XLK (tech), XLV (helse), XLF (finans). Sjekk 1-årig avkastning på Yahoo Finance. Hvilke leder akkurat nå? Hva forteller det deg om hvilken syklus-fase markedet tror vi er i?`,
      en: `# Sector rotation

The market isn't one ship — it's a fleet. When the macro wind shifts, capital moves between sectors in predictable patterns. Understanding this makes you better at timing.

## The four phases

| Phase | Macro signals | Sector leaders | Laggards |
| --- | --- | --- | --- |
| Early cycle | Rates falling, economy turning up | Financials, real estate, consumer disc. | Energy, materials |
| Mid cycle | Growth accelerating, optimism | Tech, industrials, semis | Defensives, utilities |
| Late cycle | Inflation, rates rising | Energy, materials, commodities | Tech, growth |
| Recession | GDP falling, rates high→cutting | Health, utilities, staples | Cyclicals (auto, retail, housing) |

## Worked example: 2020–2024

**2020 (early cycle post-COVID):** Rates slammed to zero, stimulus pumped. Leaders: tech (NVDA +120%), consumer disc. (ETSY +400%). Energy (XLE) −40% — no one drove.

**2021 (mid cycle):** Reopening, semis shortage, AI narrative starting. Leaders: NVDA, AMD, ASML — all semis. SaaS and fintech big too.

**2022 (late cycle, inflation fight):** Fed hiked aggressively. Tech collapsed (NASDAQ −33%), but energy delivered its best year in decades (XLE +60%, Equinor +85%). Defensives held (Walmart, Coca-Cola).

**2023–2024 (new cycle, AI bonanza):** Tech back in the lead (NVDA +250% in 2023), especially AI exposure. Energy lagged (oil flat).

> [!key]
> Rotation isn't deterministic — the 2023 AI rally broke classical patterns. But it gives you a framework: when rates rise, be cautious of expensive growth. When rates fall, dump defensives for cyclicals.

## How to see it in Apex Quantum +

Your watchlist spans multiple sectors:
- **Semis / AI infra** (NVDA, AVGO, TSM, AMD, ARM, ANET) — leads mid-cycle
- **Energy / nuclear** (OKLO, GEV, TLN, CEG, BWXT) — leads late-cycle + AI power demand
- **Defensive health** (UNH, ELV, ABT) — defensive, lags mid-cycle, holds in contraction
- **Defense** (LMT, RTX, NOC, KOG.OL) — geopolitics-driven, less cyclical
- **Norwegian oil/services** (EQNR.OL, AKSO.OL, SUBC.OL, BORR.OL) — late-cycle / commodity cycle

> [!example]
> If you believe the Fed is about to cut rates (late-cycle → new early-cycle), you'd trim energy and add tech/consumer. If you believe inflation is returning, you'd do the opposite.

## Breadth — a key signal

When only 5 stocks drive the whole market (S&P 500 in 2023 with the "Magnificent 7"), the trend is fragile. When **breadth** widens — more sectors participating — the trend is healthy.

> [!warn]
> Advanced traders watch the "advance/decline line": how many S&P 500 stocks rise vs fall on a day. If the index rises but A/D falls, momentum is concentrated in a few names — risk of a sharp reversal.

## Practice exercise

Pick four sector ETFs: XLE (energy), XLK (tech), XLV (health), XLF (financials). Look up 1-year returns on Yahoo Finance. Which leads now? What does that tell you about which cycle phase the market thinks we're in?`,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ADVANCED — added lessons
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'peer-comparison-deep',
    level: 'advanced',
    readMinutes: 9,
    title: { no: 'Peer-sammenligning på dybden — NVDA vs AMD vs AVGO', en: 'Deep peer comparison — NVDA vs AMD vs AVGO' },
    summary: {
      no: 'Hvordan plassere en aksje i konkurranselandskapet med data, ikke gjettverk.',
      en: 'Position a stock against its competitive set with data, not gut feel.',
    },
    body: {
      no: `# Peer-sammenligning på dybden

En multiplikator (P/E, EV/EBITDA) i isolasjon er meningsløs. Den må sammenlignes mot peers — selskaper i samme bransje med tilsvarende forretningsmodell. Først da forteller den deg om en aksje er dyr eller billig.

## Hva gjør en god peer?

| Kriterium | Hvorfor |
| --- | --- |
| Samme sluttmarked | NVIDIA vs AMD: begge selger compute-akselerasjon |
| Lignende vekstprofil | NVIDIA vs Intel er ikke en god peer i 2024 — ulike vekstrater |
| Lignende margin-profil | Software-selskaper sammenlignes med software, ikke hardware |
| Tilsvarende geografisk eksponering | TSM (50% Kina-eksponering) vs Intel (Korea/USA) gir ulik risiko |

## Worked example: AI-akseleratorer Q4 2024 (illustrativt)

> [!data]
> Tall er forenklet og illustrative — alltid sjekk reelle filings.

| Metric | NVDA | AMD | AVGO | Hva forteller det |
| --- | --- | --- | --- | --- |
| Markedsverdi | $3 200B | $260B | $810B | Størrelses-skala |
| Omsetning (TTM) | $113B | $25B | $51B | Faktisk salg |
| Vekst (YoY) | +94% | +18% | +44% | NVDA klart i lederrollen |
| Bruttomargin | 75% | 51% | 75% | NVDA og AVGO har samme prismakt |
| EBIT-margin | 62% | 22% | 45% | NVDA's operative leverage er dramatisk |
| FCF (TTM) | $59B | $2.6B | $19B | Cash-konvertering |
| P/E | 56× | 110× | 36× | Verdsettelse |
| EV/Revenue | 28× | 10× | 16× | Pris per krone salg |
| EV/EBITDA | 41× | 45× | 31× | Pris per driftsoverskudd |

## Hva tallene forteller

**Vekst:** NVDA leder klart. +94% topplinje-vekst er en kategori for seg selv — ikke fordi de er smartere enn AMD, men fordi de har CUDA-økosystemet og majoritet av AI-treningsmarkedet.

**Lønnsomhet:** NVDA's 62% EBIT-margin er nær unike i halvledere. AMD på 22% reflekterer at de selger til samme markedet men med mindre prismakt. AVGO's 45% er imponerende — de tjener stort på AI-network-chips (custom ASICs for hyperscalers).

> [!key]
> P/E på 56× ser dyrt ut — men hvis du justerer for vekst (PEG = P/E / vekst%), får du PEG = 56 / 94 = **0.6**. Under 1.0 er klassisk billig på vekst-justert basis. AMD's PEG = 110/18 = 6.1 — voldsom dyr på samme metrikk.

**EV/EBITDA er den fairere multiplikatoren** når selskapene har ulik gjeld og skattestruktur. Her er NVDA og AVGO faktisk billigere enn AMD — fordi AMD's lavere lønnsomhet gjør at en mindre del av salget blir til driftsoverskudd.

## Når peer-sammenligning villeder

> [!warn]
> Hvis hele bransjen er overpriset, vil "fair vs peers" gi falsk komfort. Tech-bransjen i mars 2000 så også "rimelig" ut sammenlignet med peers — alle var overpriset. Bruk peer-comp i kombinasjon med absolutt verdsettelse (DCF, FCF-yield).

## Sektor-rotasjon i peer-rommet

Innenfor halvledere er det undersegmenter som beveger seg ulikt:
- **AI-trening** (NVDA, AMD MI-serien): hyperscaler-driven, stort momentum
- **Custom ASICs** (AVGO, MRVL, CIEN): hyperscaler vil bygge egne chips i stedet for å kjøpe NVDA — gradvis vinner
- **Edge / classical compute** (INTC, AMD client): lav vekst
- **Memory** (MU, samsung): syklisk, drevet av HBM (high-bandwidth memory) for AI

Når Apex Quantum + foreslår NVDA, er peer-comp-spørsmålet alltid: *hvor mye av AI-CapEx vinner NVDA, og hvor mye går til AVGO/MRVL via custom-silicon?*

## Praktisk øvelse

Plukk en aksje fra Apex Quantum +-watchlisten (f.eks. CRDO eller CIEN). Identifiser 2–3 nærmeste peers. Lag selv en tabell som over for: omsetning-vekst, bruttomargin, EBIT-margin, EV/EBITDA. Hvilken er billigst justert for kvalitet?`,
      en: `# Deep peer comparison

A multiple (P/E, EV/EBITDA) in isolation is meaningless. It must be compared against peers — companies in the same industry with similar business models. Only then does it tell you whether a stock is cheap or expensive.

## What makes a good peer?

| Criterion | Why |
| --- | --- |
| Same end market | NVIDIA vs AMD: both sell compute acceleration |
| Similar growth profile | NVIDIA vs Intel isn't a good peer in 2024 — very different growth |
| Similar margin profile | Software peers with software, not hardware |
| Comparable geographic mix | TSM (50% China exposure) vs Intel (Korea/US) carry different risks |

## Worked example: AI accelerators Q4 2024 (illustrative)

> [!data]
> Numbers are simplified and illustrative — always check the actual filings.

| Metric | NVDA | AMD | AVGO | What it tells you |
| --- | --- | --- | --- | --- |
| Market cap | $3,200B | $260B | $810B | Scale |
| Revenue (TTM) | $113B | $25B | $51B | Actual sales |
| Growth (YoY) | +94% | +18% | +44% | NVDA clearly leads |
| Gross margin | 75% | 51% | 75% | NVDA and AVGO have similar pricing power |
| EBIT margin | 62% | 22% | 45% | NVDA operating leverage is dramatic |
| FCF (TTM) | $59B | $2.6B | $19B | Cash conversion |
| P/E | 56× | 110× | 36× | Valuation |
| EV/Revenue | 28× | 10× | 16× | Price per dollar of sales |
| EV/EBITDA | 41× | 45× | 31× | Price per dollar of operating profit |

## What the numbers tell you

**Growth:** NVDA leads decisively. +94% top-line growth is a category of its own — not because they're smarter than AMD but because of CUDA's network effects and majority share of AI training.

**Profitability:** NVDA's 62% EBIT margin is near-unique in semis. AMD at 22% reflects similar end markets with less pricing power. AVGO's 45% is impressive — they make a fortune on AI networking ASICs (custom chips for hyperscalers).

> [!key]
> P/E of 56× looks expensive — but adjusted for growth (PEG = P/E / growth%), PEG = 56/94 = **0.6**. Under 1.0 is classically cheap on growth-adjusted basis. AMD's PEG = 110/18 = 6.1 — very expensive on the same metric.

**EV/EBITDA is the fairer multiple** when companies have different leverage and tax structures. Here NVDA and AVGO are actually cheaper than AMD — because AMD's lower profitability means less of its revenue converts to operating profit.

## When peer comparison misleads

> [!warn]
> If the entire sector is overpriced, "fair vs peers" gives false comfort. Tech in March 2000 looked "reasonable vs peers" too — everyone was overpriced. Use peer comp alongside absolute valuation (DCF, FCF yield).

## Sector rotation within peers

Inside semis, sub-segments move differently:
- **AI training** (NVDA, AMD MI-series): hyperscaler-driven, massive momentum
- **Custom ASICs** (AVGO, MRVL, CIEN): hyperscalers building their own chips instead of buying NVDA — gradual share gain
- **Edge / classical compute** (INTC, AMD client): low growth
- **Memory** (MU, Samsung): cyclical, driven by HBM (high-bandwidth memory) for AI

When Apex Quantum + flags NVDA, the peer-comp question is always: *how much of AI CapEx does NVDA capture, and how much goes to AVGO/MRVL via custom silicon?*

## Practice exercise

Pick a stock from the Apex Quantum + watchlist (e.g., CRDO or CIEN). Identify 2–3 nearest peers. Build the same table above: revenue growth, gross margin, EBIT margin, EV/EBITDA. Which is cheapest adjusted for quality?`,
    },
  },

  {
    id: 'insider-signals-and-short-interest',
    level: 'advanced',
    readMinutes: 7,
    title: { no: 'Innsidesignaler og short-interest', en: 'Insider signals and short interest' },
    summary: {
      no: 'Form 4-filings, days-to-cover, og hvordan tolke informert handel.',
      en: 'Form 4 filings, days-to-cover, and how to read informed trading.',
    },
    body: {
      no: `# Innsidesignaler og short-interest

To av de sterkeste asymmetriske signalene i markedet er **insider-kjøp** og **short-interest-bevegelse**. Begge forteller deg hva informerte aktører gjør med egne penger — og data er offentlig.

## Form 4 — innsidehandel

I USA må alle innsidere (CEO, CFO, styremedlemmer, eiere over 10%) rapportere kjøp og salg innen 2 dager via SEC Form 4. Tilsvarende regler finnes for norske selskaper (Oslo Børs Innsiderapporten).

### Kjøp vs salg — ulik signalverdi

> [!key]
> **Innsidekjøp** er sterke signaler. Innsidere kan ha mange grunner til å selge (skatt, diversifisering, eiendomskjøp), men kun én grunn til å kjøpe: de tror aksjen skal opp.

| Signal-styrke | Eksempel |
| --- | --- |
| Veldig sterkt | CEO kjøper $5M+ etter et stort kursfall |
| Sterkt | Flere innsidere kjøper samtidig |
| Moderat | Enkelt-innsider kjøper i normalt prismiljø |
| Svakt / negativt | Innsidere selger på all-time-high |

### Worked example: Madrigal Pharmaceuticals (MDGL) 2023

I januar 2023 falt MDGL ~30% etter en delvis skuffende studielesning. I løpet av to uker kjøpte CEO og CFO til sammen ~$3M aksjer i åpent marked. Aksjen leverte +180% over de neste 6 månedene da fase 3-data viste seg å være sterk.

> [!example]
> Mønsteret er ikke ufeilbarlig. I 2022 kjøpte ledelsen i Carvana stort på vei ned. Selskapet falt videre 90%. Innsidere kan ta feil — særlig hvis de har emosjonell binding til selskapet.

## Short interest — hvor mange som veddet imot

**Short interest** = antall aksjer som er solgt short i markedet, dvs. lånt og solgt med håp om å kjøpe tilbake billigere. Rapporteres bi-månedlig av børsen.

### Days-to-cover

> [!example]
> **Days-to-cover** = short interest / gjennomsnittlig daglig volum.
>
> Hvis SMCI har 25M aksjer short og handler 5M aksjer per dag, er days-to-cover = 5. Det betyr "det vil ta 5 handelsdager å lukke alle short-posisjoner hvis alle ville ut samtidig".

| Days-to-cover | Tolkning |
| --- | --- |
| <2 | Liten short-eksponering, ingen squeeze-risiko |
| 2–5 | Moderat — verdt å følge med |
| 5–10 | Høy — short-squeeze potensial hvis positive nyheter kommer |
| >10 | Ekstrem — squeezing kan gi 50–200% bevegelse på dager |

## Short-squeeze-eksempler

**GameStop (GME), januar 2021:** Days-to-cover var ~25. Da Reddit-brigaden kjøpte aggressivt, måtte shortere kjøpe tilbake til hvilken som helst pris. Aksjen gikk fra $20 til $480 på 3 uker.

**Volkswagen, oktober 2008:** Porsche annonserte at de hadde kjøpt 75% av VW. Floaten som var igjen kunne ikke dekke short-posisjonene. VW ble verdens mest verdifulle selskap i to dager.

> [!warn]
> Short-squeezes er ekstremt volatile. Du kan tjene 100% på en dag — eller tape 50% når squeeze'n er over. Profesjonelle bruker squeeze-data for å unngå å være short i feil aksje, ikke for å handle long-aggressivt.

## Hvor du finner data

| Datatype | Kilde |
| --- | --- |
| Form 4 (USA) | sec.gov/edgar, openinsider.com |
| Innsiderapport (Norge) | newsweb.oslobors.no |
| Short interest (USA) | finra.org, fintel.io |
| Short interest (Norge) | finanstilsynet.no |

## Hvordan Apex Quantum + bruker dette

I signal-pipelinen er **insider_signal** et eget felt. Hvis modellen oppdager:
- Multiple innsidere kjøper innen samme måned
- Total kjøps-størrelse > $1M
- Aksjen ned > 10% siste 30 dager (kjøp i nedgang er sterkere signal)

…flagges det som "innsidesignal: BULLISH" på signal-kortet. Dette kombineres med peer-comp og technicals for å bygge en konfidens-score.

## Praktisk øvelse

Gå til openinsider.com og filtrer på "cluster buys" (3+ innsidere kjøper innen 30 dager). Velg en aksje med stort cluster fra siste måned, sjekk hvordan kursen har beveget seg etter kjøpene. Hold den selv på radaren — innsidere har ofte 6–18 måneders horisont når de kjøper.`,
      en: `# Insider signals and short interest

Two of the strongest asymmetric signals in markets are **insider buying** and **short interest** moves. Both tell you what informed players are doing with their own money — and data is public.

## Form 4 — insider trading

In the US, all insiders (CEO, CFO, directors, 10%+ owners) must report buys and sells within 2 days via SEC Form 4. Norway has a similar regime (Oslo Børs Insider Report).

### Buys vs sells — asymmetric signal

> [!key]
> **Insider buying** is a strong signal. Insiders can sell for many reasons (taxes, diversification, buying a house). They buy for one reason: they think the stock will rise.

| Signal strength | Example |
| --- | --- |
| Very strong | CEO buys $5M+ after a big drop |
| Strong | Multiple insiders buying simultaneously |
| Moderate | Single insider buying at normal levels |
| Weak / negative | Insiders selling at all-time highs |

### Worked example: Madrigal Pharmaceuticals (MDGL) 2023

In January 2023, MDGL fell ~30% on a partially disappointing study readout. Within two weeks the CEO and CFO together bought ~$3M of shares in the open market. The stock returned +180% over the next 6 months as Phase 3 data turned out strong.

> [!example]
> The pattern isn't infallible. In 2022 Carvana management bought big on the way down. The stock fell another 90%. Insiders can be wrong — especially when emotionally tied to the company.

## Short interest — how many bet against

**Short interest** = number of shares sold short — borrowed and sold expecting to buy back cheaper. Reported bi-monthly by the exchange.

### Days-to-cover

> [!example]
> **Days-to-cover** = short interest / average daily volume.
>
> If SMCI has 25M shares short and trades 5M shares per day, days-to-cover = 5. Meaning "it would take 5 trading days to close all shorts if they all wanted out at once".

| Days-to-cover | Interpretation |
| --- | --- |
| <2 | Low short interest, no squeeze risk |
| 2–5 | Moderate — worth watching |
| 5–10 | High — squeeze potential on positive news |
| >10 | Extreme — squeezes can move 50–200% in days |

## Short-squeeze examples

**GameStop (GME), Jan 2021:** Days-to-cover ~25. When Reddit traders bought aggressively, shorts had to cover at any price. From $20 to $480 in 3 weeks.

**Volkswagen, Oct 2008:** Porsche announced 75% ownership. Remaining float couldn't cover shorts. VW became the world's most valuable company for two days.

> [!warn]
> Squeezes are extremely volatile. You can make 100% in a day — or lose 50% when the squeeze ends. Pros use squeeze data to avoid being short the wrong stock, not to chase longs.

## Where to find data

| Data | Source |
| --- | --- |
| Form 4 (US) | sec.gov/edgar, openinsider.com |
| Insider Report (Norway) | newsweb.oslobors.no |
| Short interest (US) | finra.org, fintel.io |
| Short interest (Norway) | finanstilsynet.no |

## How Apex Quantum + uses this

In the signal pipeline, **insider_signal** is its own field. If the model detects:
- Multiple insiders buying within the same month
- Total buy size > $1M
- Stock down >10% over the past 30 days (buying into weakness is stronger)

…it flags as "insider signal: BULLISH" on the card. Combined with peer-comp and technicals to build a confidence score.

## Practice exercise

Go to openinsider.com and filter on "cluster buys" (3+ insiders buying within 30 days). Pick a stock with a large cluster from the last month, see how the price has moved since. Keep it on your watchlist — insiders typically have 6–18 month horizons when they buy.`,
    },
  },

  {
    id: 'options-flow-basics',
    level: 'advanced',
    readMinutes: 8,
    title: { no: 'Opsjons-flow — sentiment-leading-indicator', en: 'Options flow — a sentiment-leading indicator' },
    summary: {
      no: 'Put/call-ratio, IV skew og uvanlig aktivitet — hva opsjonsmarkedet vet før aksjekursen.',
      en: 'Put/call ratio, IV skew, unusual activity — what options know before the stock.',
    },
    body: {
      no: `# Opsjons-flow

Opsjonsmarkedet er ofte raskere enn aksjemarkedet til å reflektere ny informasjon. Profesjonelle bruker opsjons-data som leading indicator for aksjebevegelser. Du trenger ikke handle opsjoner for å bruke dem.

## Tre nøkkel-metrikker

### 1. Put/call-ratio (P/C)

P/C = total volum av put-opsjoner / total volum av call-opsjoner.

| P/C | Tolkning |
| --- | --- |
| <0.5 | Ekstrem optimisme — fare for korreksjon |
| 0.5–0.8 | Normalt bullish marked |
| 0.8–1.2 | Balansert / nøytral |
| 1.2–1.5 | Frykt — kan være kjøps-signal kontrarisk |
| >1.5 | Panikk — historisk ofte bunner |

> [!key]
> P/C er et **kontrarisk** signal i ekstreme nivåer. Når alle kjøper puts (frykt), er det ofte fordi de værste rystelsene allerede er priset inn.

### 2. Implied volatility (IV) og IV-skew

**IV** = markedets forventning om hvor mye aksjen vil bevege seg fremover. Høy IV = stort spenn forventet.

**IV skew** = forskjellen mellom IV på out-of-the-money puts og out-of-the-money calls.

> [!example]
> NVDA handler på $135. En 30-dag put med strike $120 har IV på 65%. En 30-dag call med strike $150 har IV på 45%. Skew = 65 − 45 = 20 punkter. Det betyr markedet betaler mer for nedside-beskyttelse enn for oppside-eksponering — typisk når noen forventer dårlige nyheter.

| Skew | Tolkning |
| --- | --- |
| Lav (<5) | Ingen frykt for halvevent — markedet er rolig |
| Moderat (5–15) | Normal frykt-premie |
| Høy (15–30) | Folk hedger aggressivt — usikkerhet før earnings/event |
| Ekstrem (>30) | Sterk forventning om stort negativt event |

### 3. Unusual options activity

Når opsjonsvolumet på én aksje er flere ganger høyere enn snittet på 20 dager, er det noen som tar en stor posisjon. Det kan være:
- Insider-handel (sjelden, men forekommer)
- Hedge-fond som posisjonerer seg før kjent katalysator
- Pre-positionering for FDA-beslutning, earnings, fusjon

> [!example]
> 14. juli 2024 så vi 12× normalt call-volum på Catalyst Pharmaceuticals (CPRX). To uker senere annonserte selskapet positive Phase 3-data; aksjen +27% på dagen. Hvem som handlet kan vi ikke vite, men "smart money" hadde tydelig posisjonert.

## Worked example: Eli Lilly (LLY) Q3 2024 earnings (illustrativt)

> [!data]
> Tre dager før earnings:
> - P/C-ratio på LLY: 0.35 (svært bullish)
> - 30-dag IV: 38% (over 1-års gjennomsnitt på 28%)
> - Calls strike $1000 og over: 4× normalt volum
> - Implied move basert på opsjonsmarked: ±7%

Tolkning: markedet forventet en stor bevegelse, og posisjoneringen lente seg bullish. Hvis LLY hadde levert "kun" gode tall, ville aksjen sannsynligvis falt — fordi den positive forventningen allerede var priset inn. Hvis de leverte stort, ville opsjons-leverage lagt til ekstra fart.

> [!warn]
> "Implied move" er nyttig. Hvis aksjen forventes å bevege seg ±7% etter earnings, er en 1% post-earnings-bevegelse i realiteten en *skuffelse* — selv om aksjen tilsynelatende "leverte". Markedet hadde priset inn mer.

## Hvordan Apex Quantum + integrerer opsjons-flow

Vi monitorerer:
- P/C-ratio per ticker (terskler 0.5 / 1.2 utløser flagg)
- IV-skew (ekstreme nivåer flagges som "options-stress")
- Unusual call/put activity (>3× normalt volum på 1 dag)

Disse går inn som **catalysts** eller **risks** i daglige signaler. Eksempel-fra-virkeligheten: hvis SMCI har skew på 35 + put-aktivitet 5×, vil signalkortet kunne advare "options-marked priser inn negativ event".

## Hvor du finner data

| Datatype | Kilde |
| --- | --- |
| P/C-ratio (per aksje) | barchart.com/options/put-call-ratios |
| IV / skew | barchart.com, IBKR options chain |
| Unusual activity | unusualwhales.com, marketchameleon.com |
| Implied move (earnings) | TheStreet, MarketChameleon |

## Praktisk øvelse

Velg en aksje fra Apex Quantum +-watchlisten som har earnings den neste uken. Sjekk implied move på MarketChameleon. Ta vare på tallet, og post-earnings: ble bevegelsen større eller mindre? Over tid bygger du intuisjon for når markedet er over- eller underpriset volatilitet.`,
      en: `# Options flow

The options market is often faster than the stock market at reflecting new information. Pros use options data as a leading indicator. You don't need to trade options to use them.

## Three key metrics

### 1. Put/call ratio (P/C)

P/C = total put volume / total call volume.

| P/C | Interpretation |
| --- | --- |
| <0.5 | Extreme optimism — correction risk |
| 0.5–0.8 | Normal bullish market |
| 0.8–1.2 | Balanced / neutral |
| 1.2–1.5 | Fear — possible contrarian buy |
| >1.5 | Panic — often marks bottoms |

> [!key]
> P/C is a **contrarian** signal at extremes. When everyone buys puts (fear), the worst is often already priced in.

### 2. Implied volatility (IV) and IV skew

**IV** = market's expectation of future stock movement. High IV = big range expected.

**IV skew** = difference between IV on out-of-the-money puts and out-of-the-money calls.

> [!example]
> NVDA trades at $135. A 30-day put at strike $120 has IV 65%. A 30-day call at strike $150 has IV 45%. Skew = 65 − 45 = 20 points. The market is paying more for downside protection than for upside exposure — typically when bad news is anticipated.

| Skew | Interpretation |
| --- | --- |
| Low (<5) | No tail-event fear — calm market |
| Moderate (5–15) | Normal fear premium |
| High (15–30) | Aggressive hedging — uncertainty before earnings/event |
| Extreme (>30) | Strong expectation of negative event |

### 3. Unusual options activity

When options volume on a stock is several times the 20-day average, someone is taking a large position. Could be:
- Insider trading (rare but happens)
- Hedge funds positioning before a known catalyst
- Pre-positioning for FDA decision, earnings, merger

> [!example]
> July 14, 2024: 12× normal call volume on Catalyst Pharmaceuticals (CPRX). Two weeks later positive Phase 3 data; stock +27% on the day. We can't know who traded, but "smart money" was clearly positioned.

## Worked example: Eli Lilly (LLY) Q3 2024 earnings (illustrative)

> [!data]
> Three days before earnings:
> - P/C ratio on LLY: 0.35 (very bullish)
> - 30-day IV: 38% (above 1-year average of 28%)
> - Calls strike $1000+: 4× normal volume
> - Implied move from options: ±7%

Read: market expected a big move, positioning leaned bullish. If LLY had merely delivered good numbers, the stock would likely fall — positive expectations already priced in. If they crushed it, options leverage would amplify the move.

> [!warn]
> "Implied move" is useful. If a stock is expected to move ±7% post-earnings, a 1% move is actually a *disappointment* — even if numbers seemed fine. The market priced in more.

## How Apex Quantum + integrates options flow

We monitor:
- P/C ratio per ticker (thresholds 0.5 / 1.2 trigger flags)
- IV skew (extreme levels flagged as "options stress")
- Unusual call/put activity (>3× normal on 1 day)

These appear as **catalysts** or **risks** in daily signals. Real example: SMCI with skew 35 + put activity 5× would trigger a "options market pricing negative event" warning on the card.

## Where to find data

| Data | Source |
| --- | --- |
| P/C ratio (per stock) | barchart.com/options/put-call-ratios |
| IV / skew | barchart.com, IBKR options chain |
| Unusual activity | unusualwhales.com, marketchameleon.com |
| Implied move (earnings) | TheStreet, MarketChameleon |

## Practice exercise

Pick a stock from the Apex Quantum + watchlist with earnings in the next week. Check implied move on MarketChameleon. Save the number, and post-earnings: was the actual move bigger or smaller? Over time you'll build intuition for when the market over- or underprices volatility.`,
    },
  },
];

export function getLessonsByLevel(): Record<LessonLevel, Lesson[]> {
  return {
    beginner: LESSONS.filter((l) => l.level === 'beginner'),
    intermediate: LESSONS.filter((l) => l.level === 'intermediate'),
    advanced: LESSONS.filter((l) => l.level === 'advanced'),
  };
}

export function lessonText(lesson: Lesson, lang: PlusLang): {
  title: string;
  summary: string;
  body: string;
  fallbackToEn: boolean;
} {
  const supported = lang === 'no' || lang === 'en';
  const useLang = (supported ? lang : 'en') as 'no' | 'en';
  return {
    title: lesson.title[useLang],
    summary: lesson.summary[useLang],
    body: lesson.body[useLang],
    fallbackToEn: !supported,
  };
}
