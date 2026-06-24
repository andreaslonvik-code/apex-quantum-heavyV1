# Apex Quantum — Teknisk & Sikkerhets-underlag

**Status:** Internt arbeidsdokument · underlag til investormemorandum
**Versjon:** 2026-06-16 · **Klassifisering:** Konfidensielt

> **VIKTIGE FORBEHOLD — LES FØRST**
> - Dette er et **teknisk underlag**, ikke et ferdig investormemorandum. Det **må** gjennomgås og pakkes inn juridisk korrekt av verdipapiradvokat før det vises til investorer (prospekt-/markedsføringsregler, Finanstilsynet).
> - Dokumentet inneholder **ingen avkastningsprognoser** og **ingen påstander om å slå indekser**. Historisk/simulert avkastning indikerer ikke fremtidig avkastning. Handel innebærer **risiko for tap**.
> - Beskrivelsene er holdt på et nivå som **ikke avslører proprietære parametere** (terskler, vekter). Den proprietære strategikonfigurasjonen omtales som «AI-motoren».
> - Tall merket «Sim» er simulerte / ikke representative for live drift og må presenteres som dette.

---

## 1. Hva Apex Quantum er

Apex Quantum (AQ) er en AI-drevet handelsplattform bygget rundt to klart adskilte produkter:

- **Apex Quantum Max** — et **autonomt** system som handler i kundens egen meglerkonto etter en AI-styrt strategi, med et flerlags risikorammeverk.
- **Apex Quantum +** — et **forenklet signalprodukt** for kunder som vil handle selv. Leverer daglige signaler/innsikt; kunden utfører handlene manuelt.

De to produktene er teknisk og kommersielt atskilt. + er inngangsproduktet (lav terskel, kunden beholder full kontroll); Max er det autonome premiumproduktet.

**Kjernedesign-prinsipp:** AQ er **ikke-kustodial**. Plattformen oppbevarer aldri kundenes penger. Kapitalen blir værende på kundens egen meglerkonto; AQ sender kun ordrer via API og kan når som helst kobles fra av kunden.

---

## 2. Arkitektur

```
                         ┌─────────────────────────────┐
                         │        Kunde (nettleser)      │
                         │   apex-quantum.com/max  / +   │
                         └───────────────┬──────────────┘
                                         │  (Clerk-autentisering)
                         ┌───────────────▼──────────────┐
                         │      Apex Quantum-plattform    │
                         │        (Next.js / Vercel)      │
                         │  ┌──────────────────────────┐  │
                         │  │  AI-motoren (strategi)    │  │
                         │  │  · teknisk analyse-lag    │  │
                         │  │  · filter-/portlag        │  │
                         │  │  · AI-beslutningslag       │  │
                         │  │  · risikostyringslag      │  │
                         │  └──────────────────────────┘  │
                         └───┬───────────────┬───────────┘
                             │               │
              (krypterte API-nøkler)   (markedsdata + beslutning)
                             │               │
              ┌──────────────▼───┐   ┌────────▼─────────────┐
              │  Alpaca (megler)  │   │  Markedsdata / AI-    │
              │  kundens EGEN     │   │  beslutningstjeneste  │
              │  konto + midler   │   └──────────────────────┘
              └───────────────────┘
```

**Komponenter:**
- **Frontend / app:** Next.js, driftet på Vercel.
- **Autentisering:** Clerk (identitet, økt, tilgangsstyring).
- **Datalag:** administrert database (kundekonfig, beslutningslogg, allokeringer).
- **Megler:** Alpaca — kundens egen konto (se kap. 5).
- **AI-/beslutningslag:** en stor språkmodell (LLM) tar de endelige kjøp/selg/hold-beslutningene basert på et strengt forhåndsfiltrert beslutningsgrunnlag motoren bygger.
- **AI-motoren:** den proprietære konfigurasjonen som binder teknisk analyse, filtre, AI-beslutning og risikostyring sammen.

---

## 3. Hvordan Max virker (det autonome systemet)

Max kjører en kontinuerlig løkke gjennom handelsdagen. For **hver** vurdering går systemet gjennom flere lag før en ordre i det hele tatt kan sendes:

**Lag 1 — Datainnsamling og teknisk analyse.** For hvert navn i universet bygges et omfattende teknisk øyeblikksbilde, bl.a.:
- momentum- og styrkemål (RSI, MACD),
- trendstruktur (glidende snitt på kort og lang sikt, «stigende kanal» / høyere topper og bunner),
- volatilitet (ATR, realisert volatilitet),
- relativ styrke mot markedet og mot sektor,
- volum-/akkumulasjonsmønstre,
- fler-tidsramme-bekreftelse (intradag mot daglig),
- katalysatorer (resultatkalender, nyhetstetthet).

**Lag 2 — Filtre og porter (kapitaldisiplin).** Et navn må passere flere harde porter før det er kjøpbart, bl.a.:
- **trendport** (ingen kjøp i etablert nedtrend — «ikke grip fallende kniver»),
- **sektorport** (kun navn i sektorer som leder markedet),
- **resultat-blackout** (ingen nye kjøp tett opp mot resultatfremleggelse),
- **laggard-filter** (avvis navn som strukturelt henger etter markedet).
Navn som passerer, vurderes mot flere validerte **inngangs-arketyper** (momentum-ledere, bekreftede trender, disiplinerte dip-kjøp m.fl.). Et navn uten et gyldig inngangssignal blir **hoppet over** — disiplinen ligger i å la være.

**Lag 3 — AI-beslutning.** Først her tar AI-laget den endelige beslutningen (kjøp/selg/hold) på det forhåndsfiltrerte, kontekstrike grunnlaget. AI-en kan ikke overstyre de harde sikkerhetsportene.

**Lag 4 — Posisjonering og risiko.** Størrelsen settes volatilitetsjustert, med tak per posisjon, per sektor og samlet, og innenfor tilgjengelig kjøpekraft.

> **Et illustrerende eksempel på disiplinen:** når AI-laget foreslo å selge sterke navn kun fordi de var «overkjøpte», ble salget **overstyrt** av motoren fordi det ikke fantes tegn til reell svekkelse — systemet lar bevisst vinnere løpe og lar en automatisk trailing-stop fange en *faktisk* vending i stedet for å selge for tidlig.

---

## 4. Hvordan + virker (signalproduktet)

+ er for kunder som vil handle selv. Det leverer signaler/innsikt (daglig morgenbrief og beslutningsgrunnlag) avledet fra samme AI-motor, men **kunden utfører handlene manuelt** i sin egen konto. Ingen autonom utførelse, lavere abonnementsterskel, full kundekontroll. Produktet er bevisst skilt fra Max både i tilgang og funksjon.

---

## 5. Alpaca-integrasjonen — og hvor sikker handelen er

**Hva Alpaca er:** Alpaca er en amerikansk, regulert meglerplattform med et moderne handels-API. (Reguleringsstatus, medlemskap og kundebeskyttelsesordninger må **verifiseres mot Alpacas gjeldende offentlige opplysninger** før de gjengis i memorandumet.)

**Hvordan koblingen fungerer — og hvorfor den er trygg for kunden:**
- Kunden oppretter og eier **sin egen** Alpaca-konto. Midlene ligger hos megleren, ikke hos AQ.
- Kunden gir AQ et **API-nøkkelpar** som lagres **kryptert** (se kap. 6). AQ bruker nøklene utelukkende til å sende ordrer.
- **AQ oppbevarer aldri kundens penger** og kan ikke ta dem ut. Plattformen er ikke-kustodial.
- Kunden kan **når som helst trekke tilbake nøklene** eller koble fra, og handelen stopper.

Dette er et sentralt trygghetspunkt: kundens kapital forblir under kundens kontroll i en regulert meglerkonto gjennom hele forholdet.

---

## 6. Sikkerhet (eget kapittel)

**6.1 Beskyttelse av nøkler og data**
- Kundenes megler-API-nøkler lagres **kryptert i ro** (AES-256-GCM). Klartekst-nøkler skrives aldri til disk i drift.
- Autentisering og øktstyring via Clerk.
- Streng **per-bruker-isolasjon** av data; privilegert databasetilgang kun i server-kontekster.

**6.2 Beskyttelse av selve handelen**
- **Ikke-kustodial:** plattformen flytter aldri kundens midler; den sender kun ordrer (se kap. 5).
- Bakgrunnsprosessene som utfører handel er **autentisert** og avviser å kjøre uten gyldig hemmelig nøkkel.
- Per-bruker feilisolering: en feil på én konto påvirker ikke andre.

**6.3 Kapitalbeskyttelse (risikokontroller)**
Flere uavhengige lag verner åpne posisjoner og porteføljen:
- **Daglig tap-bryter** som stopper ny risiko ved et fastsatt dagstap.
- **Drawdown-bryter** som stopper ny risiko ved et større fall fra toppnivå.
- **Stop-loss** (volatilitetsbasert) med en megler-side backup-ordre som overlever driftsavbrudd.
- **Trailing-stop** som låser inn en andel av oppnådd gevinst.
- **Bjørnemarkeds-deteksjon** som demper posisjonsstørrelser i fallende marked.
- **Konsentrasjonstak** per posisjon og per sektor.
- **Avkjølingsperiode** etter en utstopping (hindrer pisking inn/ut av samme navn).

**6.4 Sporbarhet**
Hver beslutning logges med begrunnelse og utfall, og en offentlig innsyns-tidslinje gjør strategiens beslutninger etterprøvbare. Full transparens er en bevisst del av tillitsmodellen.

---

## 7. Resultater så langt (ærlig fremstilling)

> Denne seksjonen **må** presenteres med forbeholdene intakt. Den gir **ingen** prognose.

- Systemet har en **kort driftshistorikk** (oppstart for ~40 dager siden).
- Resultattall vist i kundedashboardet er per nå merket **«Sim · ikke representativt for live»**, og nøkkeltall som treffrate og Sharpe er merket **simulert** med **lite datagrunnlag**.
- Perioden falt sammen med et **gunstig markedsvindu** (momentum-/teknologidrevet oppgang), som er strategiens beste miljø.
- Den gjeldende strategiversjonen er **nylig satt i drift** og har begrenset live-historikk.

**Konklusjon for memorandumet:** legg frem de faktiske tallene med disse merkingene og en standard formulering om at «historisk/simulert avkastning ikke indikerer fremtidig avkastning». Den korte, ærlige fremstillingen er i seg selv et troverdighetssignal overfor profesjonelle investorer. Et lengre **backtest** (klart merket som historikk, ikke garanti) kan utarbeides for å gi et bredere bilde.

---

## 8. Hva som skiller Apex Quantum ut (etterrettelig)

- **Disiplinert, flerlags risikostyring** — kapitalvern er bygget inn på flere uavhengige nivåer, ikke et påheng.
- **Ikke-kustodial modell** — kunden beholder kontroll over egne midler i regulert meglerkonto.
- **Full sporbarhet** — offentlig beslutnings-tidslinje; uvanlig åpenhet i bransjen.
- **To-produkts-design** — lavterskel signalprodukt (+) og autonomt premiumprodukt (Max) fra samme motor.
- **AI-beslutning over et deterministisk risikorammeverk** — AI-laget kan aldri overstyre de harde sikkerhetsportene.

---

## 9. Hvordan systemet forbedres over tid (uten overdrivelse)

AQ forbedres gjennom en **disiplinert, menneskestyrt** sløyfe — ikke autonom selv-mutering på live kapital:
1. **Måle** faktiske handelsresultater (attribusjon: hvilke beslutningstyper tjener/taper).
2. **Finne** mønstre som svekker resultatet.
3. **Backteste** en konkret justering på historiske data.
4. **Validere** ut-av-utvalg.
5. **Sette i drift** etter gjennomgang og godkjenning.

Dette gir kontinuerlig, etterprøvbar forbedring med revisjonsspor — og uten å sette kundekapital bak uvaliderte endringer.

---

## 10. Risikofaktorer (for investorpresentasjonen)

Følgende **må** med i memorandumet (ikke uttømmende — advokat utvider):
- **Markedsrisiko / tap av kapital:** ingen avkastning er garantert; tap kan forekomme.
- **Strategi-/modellrisiko:** historiske/simulerte resultater forutsier ikke fremtiden; ytelse varierer med markedsregime.
- **Kort historikk:** begrenset live driftsgrunnlag.
- **Konsentrasjonsrisiko:** strategien kan være konsentrert i få posisjoner/sektorer.
- **Teknologi-/utførelsesrisiko:** avhengighet av tredjeparter (megler, AI-tjeneste, sky-/datatjenester) og av nettverk/oppetid.
- **Avhengighetsrisiko:** strategien styres fra en sentral beslutningskilde.
- **Regulatorisk risiko:** rammeverk for AI-drevet/finansiell virksomhet kan endres.

---

## 11. Til memorandum-arbeidet (grafikk og prosess)

- **Grafikk:** Jeg kan ikke produsere animasjoner/illustrasjoner i seg selv. Bruk en designer på det visuelle, men hold innholdet til **faktiske** data:
  - faktisk egenkapitalkurve **merket Sim/forbehold**, drawdown-kurve, allokering nå.
  - arkitekturdiagrammet i kap. 2 kan tegnes profesjonelt opp.
  - **Ingen** «forventet avkastning 1/2/3 år»-grafer — fabrikerte prognosekurver er villedende og et regelproblem i en emisjon.
- **Juridisk:** hele memorandumet må gjennom verdipapiradvokat; involver rådgiverne (regnskap/revisjon) tidlig.
- **IP-beskyttelse:** del dette kun under **konfidensialitetsavtale (NDA)**; hold proprietære parametere ute (som her); vurder vannmerking av distribuerte kopier. (Teknisk «kopisperre» i et dokument er ikke en reell beskyttelse — NDA og juridiske vilkår er det som beskytter.)

---

*Konfidensielt. Utarbeidet som teknisk underlag for Apex Quantum AS sin emisjon. Skal ikke distribueres uten NDA og uten juridisk gjennomgang.*
