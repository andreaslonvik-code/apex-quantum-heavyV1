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
