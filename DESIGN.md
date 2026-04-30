---
name: Apex Quantum
description: AI-drevet autonom trading-plattform — datatett dashboard for seriøse retail- og prosumer-tradere
colors:
  bg-void: "#05050A"
  text-primary: "rgba(255,255,255,0.88)"
  text-muted: "rgba(255,255,255,0.42)"
  text-mute-deep: "rgba(255,255,255,0.22)"
  surface: "rgba(255,255,255,0.038)"
  surface-hi: "rgba(255,255,255,0.06)"
  border: "rgba(255,255,255,0.07)"
  border-accent: "rgba(0,245,255,0.14)"
  accent-cyan: "#00F5FF"
  accent-magenta: "#C026D3"
  accent-gold: "#F5C443"
  signal-up: "#10b981"
  signal-down: "#ef4444"
typography:
  display:
    fontFamily: "Satoshi, Inter, system-ui, sans-serif"
    fontSize: "clamp(44px, 7vw, 84px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Satoshi, Inter, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "24px"
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Satoshi, Inter, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "14px"
    lineHeight: 1.6
  data:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "13px"
    fontWeight: 500
    fontFeature: "tabular-nums"
  caption:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent-cyan}"
    textColor: "#000"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.accent-cyan}"
    textColor: "#000"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  button-destructive:
    backgroundColor: "{colors.signal-down}"
    textColor: "#fff"
    rounded: "{rounded.lg}"
    padding: "14px"
  surface-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "16px"
  data-table-row:
    backgroundColor: "{colors.bg-void}"
    textColor: "{colors.text-primary}"
    typography: "{typography.data}"
  signal-tag-up:
    backgroundColor: "rgba(16,185,129,0.15)"
    textColor: "{colors.signal-up}"
    rounded: "{rounded.sm}"
    padding: "1px 7px"
  signal-tag-down:
    backgroundColor: "rgba(239,68,68,0.15)"
    textColor: "{colors.signal-down}"
    rounded: "{rounded.sm}"
    padding: "1px 7px"
---

# Design System: Apex Quantum

## 1. Overview

**Creative North Star: "The Quiet Cockpit"**

Apex Quantum er et trading-dashboard som ser ut som en velbygd maskin som jobber for deg. Datatetthet uten kaos, presisjon uten støy. Tall og hierarki gjør jobben — ikke pynt. Inspirert av TradingView (datatetthet), Stripe (klarhet) og Vercel (typografisk selvsikkerhet), pakket inn i en mørk flate som passer den profesjonelle settingen brukerne jobber i.

Systemet bygges på en svart-tintet bakgrunn (#05050A — aldri ren #000) med tinted neutrals i hvitt-på-svart-spekteret. Cyan brukes som **én aksent** for handling, status og fokus — ikke som dekorativt fargeflashes. Mono-font bærer all numerisk informasjon for tabular-nums og terminal-følelse. Sans-font (Satoshi) bærer headlines og UI-tekst med stram negativ letter-spacing.

**Drift-varsel:** Eksisterende kode i `globals.css` (v2.0 "Quantum Void") inneholder cyberpunk-synthwave-elementer — gradient-tekst, glassmorphism, neon-glow, scanline-animasjon, magenta-gradienter — som er i direkte konflikt med PRODUCT.md sin anti-referanse "Crypto-bro neon". Dette systemet dokumenterer **målbildet**, ikke status quo. Do's/Don'ts (§6) flagger eksplisitt hva som må fjernes.

**Key Characteristics:**
- Mørk flate som standpunkt (ikke "fordi tools skal se cool ut" — fordi brukeren jobber i ekspertmodus)
- Mono for tall, sans for tekst — to fonter, ingen flere
- Én aksent-farge (cyan), brukt sparsomt
- Rolig som default, detaljer på forespørsel
- Tabular-nums i alle kolonner

## 2. Colors

Mørke nøytraler på en blå-tintet svart, med én kjølig aksent og to semantiske signal-farger. Magenta og gull eksisterer i kodebasen i dag, men er kandidater for fjerning.

### Primary
- **Cockpit Cyan** (`#00F5FF`): Eneste aksent. Brukes for primær-CTA, fokus-ringer, aktiv-tilstander, live-indikatorer. Maks 10% av enhver skjerm. Sjeldenheten er poenget.

### Secondary (kandidat for fjerning)
- **Synthwave Magenta** (`#C026D3`): Eksisterer i nåværende kode som sekundær-gradient og neon-glow. Bryter med PRODUCT.md ("Crypto-bro neon" anti-referanse). Skal fjernes eller reduseres til en sjelden datavisualiserings-rolle.
- **Editorial Gold** (`#F5C443`): Brukes i hero-aksenter. Vurder fjerning — to aksenter konkurrerer i et system som skal ha én.

### Neutral
- **Void Background** (`#05050A`): Hovedbakgrunn. Tintet mot blå (chroma 0.005) — aldri ren #000.
- **Primary Text** (`rgba(255,255,255,0.88)`): All brødtekst og headlines.
- **Muted Text** (`rgba(255,255,255,0.42)`): Sekundær-tekst, labels, meta-info.
- **Deep Mute** (`rgba(255,255,255,0.22)`): Inaktive states, separatorer.
- **Surface** (`rgba(255,255,255,0.038)`): Kort-bakgrunn (subtilt løft fra void).
- **Surface High** (`rgba(255,255,255,0.06)`): Hover-tilstand for surfaces.
- **Border** (`rgba(255,255,255,0.07)`): Standard-skiller.

### Signal (semantiske, aldri som dekorasjon)
- **Bull Green** (`#10b981`): Positiv PnL, kjøpssignaler, opp-bevegelser.
- **Bear Red** (`#ef4444`): Negativ PnL, salgssignaler, ned-bevegelser, destruktive handlinger (kill-switch).

### Named Rules

**The One Voice Rule.** Cyan er den eneste aksenten. Den brukes på ≤10% av enhver skjerm. Magenta og gull er drift fra v2.0 og fases ut.

**The Tinted Black Rule.** Aldri `#000`, aldri `#fff`. All svart tintes mot kald (`#05050A`); all hvit dempes (`rgba(255,255,255,0.88)`).

**The Signal Color Rule.** Grønn og rød brukes utelukkende for finansielle signaler (PnL, kjøp/salg, opp/ned) og destruktive handlinger. Aldri som dekorativ aksent. Følges alltid av tegn (+/−), ikon eller form for fargeblindhet-vennlighet.

## 3. Typography

**Display Font:** Satoshi (med fallback Inter, system-ui, sans-serif)
**Body Font:** Satoshi (samme stack)
**Data/Mono Font:** JetBrains Mono (med fallback Fira Code, monospace)

**Character:** Satoshi gir geometrisk presisjon og selvsikker negativ letter-spacing — en moderne sans som passer "Vercel-typografisk-selvsikkerhet" uten å være kald. JetBrains Mono bærer alt numerisk og statuselementer, noe som gir TradingView-aktig terminal-følelse uten Bloomberg-overload.

### Hierarchy

- **Display** (700, `clamp(44px, 7vw, 84px)`, line-height 1.02, letter-spacing −0.035em): Kun for hero/landing. Aldri i dashboard.
- **Headline** (700, 24px, line-height 1.2, letter-spacing −0.02em): Seksjonstitler, side-headers.
- **Title** (600, 18px, line-height 1.3): Kort-headlines, modal-titler.
- **Body** (400, 14px, line-height 1.6): All UI-tekst. Maks 65–75ch på lengre tekst.
- **Data** (500, 13px, JetBrains Mono, `font-variant-numeric: tabular-nums`): Alle tall i tabeller, prising, PnL, statistikk. Høyrejustert i kolonner.
- **Caption** (600, 11px, JetBrains Mono, letter-spacing 0.14em, uppercase): Labels, meta-info, status-tags.

### Named Rules

**The Tabular Numbers Rule.** Alle tall i tabeller, lister og statistikk-felt bruker `font-variant-numeric: tabular-nums` og JetBrains Mono. Tall skal aligne perfekt vertikalt slik at brukeren kan skanne en kolonne uten å lese.

**The Two Fonts Rule.** Kun Satoshi og JetBrains Mono. Ingen flere. Aldri serif. Aldri script.

**The No Gradient Text Rule.** Ingen `background-clip: text` med gradient. Vekt og størrelse gir hierarki — ikke fargeskifter. Eksisterende `.gradient-text`, `.gradient-text-gold`, `.m-hero-accent`, `.grad`, `.gold-text` skal erstattes med solid farge.

## 4. Elevation

Systemet er **fundamentalt flatt**. Dybde uttrykkes gjennom subtile bakgrunnsforskjeller (surface 3.8% over void), ikke gjennom skygger eller blur. Eksisterende glassmorphism er drift fra "Quantum Void"-eraen og fjernes.

### Shadow Vocabulary (minimal — kun funksjonell)

- **Focus Ring** (`box-shadow: 0 0 0 2px rgba(0,245,255,0.4)`): Tastaturfokus på interaktive elementer. Ikke estetisk — funksjonell.
- **Hover Lift** (`transform: translateY(-1px)`): Tilbakemelding på primær-CTA. Ingen skygge — bare bevegelse.

### Named Rules

**The Flat-By-Default Rule.** Surfaces er flate. Dybde skapes ved fargetinting av bakgrunnen, ikke ved skygger eller blur.

**The No Glassmorphism Rule.** `backdrop-filter: blur()` er forbudt som dekorasjon. Eksisterende `.glass`, `.glass-hi`, `.glass-card` skal erstattes med solid `--aq-surface`. Eneste tillatte unntak: sticky topbar (`.dbar`) hvor den skiller fra rullende innhold under.

**The No Neon Glow Rule.** `box-shadow` med kuløroffset (eks. `0 0 20px rgba(0,245,255,0.15)`) er dekorativ neon — forbudt. Eksisterende `.neon-cyan-glow`, `.neon-magenta-glow`, `.pulse-live` fases ut.

## 5. Components

### Buttons

- **Shape:** Lett avrundet (12px radius), uten skarpe hjørner, uten pill-form.
- **Primary:** Solid cyan-bakgrunn (`#00F5FF`) med svart tekst (`#000`), 12px×20px padding. Hover: subtil løft (translateY(-1px)). **Ingen gradient.** Eksisterende `.btn-primary-v8` har cyan-chrome-gradient + box-shadow neon — skal forenkles til solid cyan.
- **Ghost:** Transparent bakgrunn med 1px border (`rgba(255,255,255,0.14)`), tekst i text-primary. Hover: border styrkes til cyan (rgba(0,245,255,0.30)).
- **Destructive:** Solid signal-red (`#ef4444`) med hvit tekst. Reserveres for kill-switch og lignende kritiske handlinger. Aldri som standard "delete"-knapp.

### Cards / Containers

- **Corner Style:** 16px radius (`rounded.xl`).
- **Background:** `--aq-surface` (3.8% hvit på void). Aldri glass-blur.
- **Border:** 1px `--aq-border`. Hover øker subtilt til `--aq-border-hi` (cyan-tintet).
- **Internal Padding:** 16px (`spacing.md`) standard, 24px for større innholds-kort.
- **No Nested Cards.** Aldri kort-i-kort. Inni en surface-card brukes kun bakgrunnstinting eller borders for separasjon.

### Inputs / Fields

- **Style:** 1px border `--aq-border` på `--aq-surface`-bakgrunn, 8px radius.
- **Focus:** Cyan border (`#00F5FF`) + 2px ring-offset (synlig fokus-state, aldri fjernet).
- **Min-height:** 44px på mobil for tap-targets.

### Data Table (`.dtable`)

Signaturkomponenten i dashboardet. JetBrains Mono i headers (uppercase, letter-spacing 0.1em, 11px), tabular-nums i cells. Hover på rad gir subtil cyan-tint (`rgba(0,245,255,0.03)`) — leselighet, ikke pynt. Tall høyrejustert. Signal-tags inline.

### Signal Tags (`.sig-tag`)

Inline pill-tag for opp/ned-status. 4px radius, 1px×7px padding, JetBrains Mono 10px. Tre varianter:
- **up:** grønn på 15% grønn-bakgrunn
- **down:** rød på 15% rød-bakgrunn
- **neutral:** grå på 8% hvit-bakgrunn

### Navigation (`.dbar`)

Sticky topbar, 56px høyde, blå-tintet svart med 85% opacity og blur — eneste sted hvor blur er funksjonelt nødvendig (skiller fra rullende innhold).

### Kill Switch

Distinktiv komponent: solid signal-red, full bredde, 14px padding, JetBrains Mono uppercase, blink-animert dot. Brukes til "stopp all autonom trading umiddelbart". Eksklusiv plassering — aldri i en knapperad med andre handlinger.

## 6. Do's and Don'ts

### Do:

- **Do** bruk `#05050A` som bakgrunn — aldri `#000` eller `#fff`.
- **Do** bruk Satoshi for tekst, JetBrains Mono for tall. Ingen andre fonter.
- **Do** bruk `font-variant-numeric: tabular-nums` på alle tall.
- **Do** ledsage grønn/rød med tegn (+/−) eller ikon for fargeblindhet.
- **Do** bruk cyan på maks 10% av en skjerm (One Voice Rule).
- **Do** bruk full borders eller bakgrunnstinting for visuell separasjon.
- **Do** vis fokus-ringer synlig (cyan, 2px). Tastatur-brukere finnes.
- **Do** respekter `prefers-reduced-motion`.
- **Do** bruk solid farger på CTA — gradient er forbudt.
- **Do** hold dybde gjennom bakgrunns-tint, ikke skygger.

### Don't:

- **Don't** bruk gradient-tekst (`background-clip: text` med gradient). Eksisterende `.gradient-text`, `.gradient-text-gold`, `.m-hero-accent`, `.grad`, `.gold-text` skal fjernes. PRODUCT.md anti: "gradient-tekst forbudt".
- **Don't** bruk glassmorphism dekorativt. Eksisterende `.glass`, `.glass-hi`, `.glass-card` fases ut. Eneste unntak: sticky topbar.
- **Don't** bruk neon-glow box-shadow (`.neon-cyan-glow`, `.neon-magenta-glow`, `.pulse-live`, `.cyber-button::before` shimmer). PRODUCT.md anti: "Crypto-bro neon".
- **Don't** bruk magenta og cyan sammen som synthwave-gradient. PRODUCT.md anti: "Crypto-bro neon".
- **Don't** bruk side-stripe borders (`border-left` >1px som farget aksent på kort/lister/varsler).
- **Don't** lag identical card grids med icon + heading + text repetert. PRODUCT.md anti: "SaaS-cream".
- **Don't** bruk hero-metric template (big number + small label + supporting stats). PRODUCT.md anti: "SaaS-cream".
- **Don't** bruk navy + gull-paletter eller oppblåst sirkel-typografi. PRODUCT.md anti: "Boomer bank-fintech".
- **Don't** bruk gamification, konfetti-animasjoner, lekefarger på trade-bekreftelser. PRODUCT.md anti: "Robinhood-confetti".
- **Don't** lag Bloomberg-tetthet (alt-på-en-gang, alle tall samme størrelse). Bruk hierarki. PRODUCT.md anti: "Bloomberg-terminal".
- **Don't** bruk kort-i-kort. Aldri.
- **Don't** bruk modal som første tanke. Inline/progressive alternativer først.
- **Don't** bruk em-dash (—) eller `--` i UI-tekst. Bruk komma, kolon, semikolon, parentes.
- **Don't** bruk "Enterprise-Grade", "Production-Ready", "Revolutionary" badges. PRODUCT.md: "Earned trust over loud claims".
- **Don't** behold scanline-animasjon (`.scanline`). Sci-fi-cliché. Fjernes.
