# Juridisk gjennomgang — APEX QUANTUM AS

Status: Plus-produktet er bygget, men juridisk gjennomgang av norsk advokat er **ikke utført**. Denne sjekklisten er en ærlig oversikt over hva som er på plass i kode/innhold og hva som fortsatt krever advokat-vurdering før kommersiell lansering.

## Hva som er ivaretatt teknisk og i innhold

### Personvern (GDPR / personopplysningsloven)
- ✅ Personvernerklæring oppdatert med alle databehandlere: Clerk, Supabase, Vercel, Stripe, xAI, Alpaca
- ✅ Behandlingsgrunnlag spesifisert per kategori (avtale, berettiget interesse, samtykke, rettslig forpliktelse)
- ✅ Lagringstider angitt (12 mnd post-konto, 5 år for bokføring, 90 dager for logger)
- ✅ Rettighetene listet (innsyn, retting, sletting, portabilitet, klage til Datatilsynet)
- ✅ Tredjelandsoverføringer notert (DPF / SCC der relevant)
- ✅ AI-bruk eksplisitt forklart

### Forbrukerrett
- ✅ Vilkår oppdatert med Plus-tier, prising, ingen bindingstid, oppsigelse via Stripe-portal
- ✅ Angrerett-klausul: kunden samtykker til umiddelbar levering og bekrefter at angreretten bortfaller
- ✅ Aldersgrense 18 år
- ✅ Lovvalg norsk rett, vernetingsforbehold for forbrukere

### Finansregulering
- ✅ Vilkår presiserer at Apex Quantum AS **ikke** er konsesjonspliktig verdipapirforetak
- ✅ Plus-innholdet rammes som "generell markedsanalyse og læring", ikke individuell investeringsrådgivning
- ✅ Ansvarsfraskrivelse på dashbordet og i signal-feed
- ✅ Risikofaktorer-side med Plus-spesifikt avsnitt øverst

### Teknisk sikkerhet
- ✅ TLS 1.3 (Vercel default)
- ✅ AES-256-GCM kryptering av Alpaca-nøkler
- ✅ Stripe webhook-signatur verifiseres kryptografisk
- ✅ Vi ser aldri kortdata — Stripe håndterer alt

## Hva som fortsatt krever advokat-vurdering

### KRITISK — før kommersiell lansering

1. **MAR / EU Market Abuse Regulation — investment recommendations**
   Plus-signalene kan teknisk sett klassifiseres som "investeringsanbefalinger" under MAR art. 20 hvis de oppfyller definisjonen "informasjon som anbefaler eller foreslår en investeringsstrategi". Hvis ja, må vi:
   - Oppgi forfatter / qualifications
   - Disclose interesser og posisjoner
   - Holde dokumentasjon på beslutningsgrunnlag
   - Følge format-krav (CDR 2016/958)
   Krever advokat-vurdering: **er Plus-signalene "investment recommendations" under norsk implementering?** Hvis ja må format og disclosures justeres.

2. **Finanstilsynet — er Plus konsesjonspliktig?**
   Verdipapirhandelloven § 2-3 lister konsesjonspliktige investeringstjenester. "Investeringsrådgivning" er punkt 5. Vi argumenterer for at Plus = "generell informasjon" (unntatt fra konsesjonsplikt), men dette må verifiseres med Finanstilsynet eller advokat. Eksempler på lignende plattformer (Aksjeakademiet, NyePenger) opererer uten konsesjon, men presedens er ikke garanti.

3. **Skatte-implikasjoner for utenlandske kunder**
   Norge skattlegger digitale tjenester levert til norske forbrukere (MVA via Stripe). For kunder i andre EU-land håndteres VAT MOSS via Stripe Tax. Bekreft med regnskapsfører at Stripe-konfigurasjonen dekker alle EU-land.

### VIKTIG — bør på plass innen 30 dager etter lansering

4. **Databehandleravtaler (DPA)**
   Vi må ha signerte DPA med:
   - [ ] Clerk (auto-generert ved oppmelding)
   - [ ] Stripe (auto-generert)
   - [ ] Vercel (kan bestilles via dashboard)
   - [ ] Supabase (auto-generert ved Pro-plan)
   - [ ] xAI (kontakt support hvis ikke automatisk)
   - [ ] Alpaca (gjelder kun Max — kontakt deres compliance)

5. **Behandlingsprotokoll (record of processing) — GDPR art. 30**
   APEX QUANTUM AS må føre en intern protokoll over alle behandlingsaktiviteter. Mal finnes hos Datatilsynet. Kreves selv for små selskaper hvis behandling er regulær.

6. **Personvernombud (DPO)**
   Ikke obligatorisk for vår størrelse, men anbefalt hvis vi skalerer. Ved >250 ansatte eller "regelmessig overvåking i stor skala" blir det obligatorisk.

7. **Cookie-banner / samtykke-styring**
   Vi har en cookies-side, men det finnes ikke en aktiv samtykke-banner ved første besøk. ePrivacy-direktivet krever samtykke til alt utover strengt nødvendige cookies. Hvis vi i fremtiden legger til analytics (f.eks. Vercel Analytics, Posthog), må banner implementeres først.

8. **Brukervilkår — angrerett-mekanisme**
   Selv om vilkårene har angrerett-klausul, krever angrerettloven at samtykket gis aktivt og dokumenterbart i bestillingsflyten. Stripes `consent_collection.terms_of_service: 'required'` er én del — men vi bør legge til en eksplisitt **angrerett-avkrysning** i checkout-skjemaet eller på vår side før Stripe omdirigeres til.

### MIDDELS — kontinuerlig

9. **Markedsføring — Markedsføringsloven**
   Forbud mot:
   - Villedende avkastningsløfter ("garantert 20 % årlig" osv.) — vi har ingen slike, men vær påpasselig på TikTok-markedsføring
   - Skjulte sammenligninger med konkurrenter — aksjeakademiet kan nevnes saklig, ikke nedsettende
   - "Skjult reklame" hvis influencere brukes — alltid `#reklame`-merking
   Etabler egne retningslinjer for influencer-samarbeid før vi setter i gang TikTok-kampanjen.

10. **AI Act compliance (EU forordning 2024/1689)**
    Plus faller sannsynligvis i "limited risk"-kategorien. Krav: tydelig informasjon om AI-bruk (vi har det), human oversight (vi anbefaler at brukeren tar egne beslutninger). Trådte i kraft 2026 — overvåk Finanstilsynet/Digitaliseringsdirektoratet for tilsynsrunder.

11. **Bokføringsloven**
    Stripe-fakturaer må arkiveres i 5 år. Kobles til regnskapssystem (Tripletex, Fiken e.l.).

### LANSERINGS-CHECKLIST

Før første betalende kunde:
- [ ] Advokat-gjennomgang av punkt 1 (MAR/recommendations) og 2 (Finanstilsynet-vurdering)
- [ ] Alle DPA-er signert og lagret
- [ ] Behandlingsprotokoll satt opp
- [ ] Cookie-banner hvis vi har analytics
- [ ] Angrerett-avkrysning i checkout
- [ ] Forsikring vurdert (Cyber + Profesjonsansvar)
- [ ] Klagerutiner skrevet ned (kundeklage → 30 dager → Forbrukerklageutvalget hvis uenighet)

## Anbefalt advokat-spesialitet

For punkt 1–2 trenger du en **advokat med spesialisering i finansregulering** (verdipapirhandelloven, MiFID II, MAR). Standard forretningsadvokat er ikke nok. Forslag: SANDS, Wikborg Rein, Schjødt, BAHR — alle har FinReg-team. Estimat: 5–15 timer á 3 000–4 500 kr for en innledende vurdering + dokumentutkast.

For punkt 4–7 (GDPR / forbrukerrett / cookies) kan en allmennpraktiserende advokat eller spesialiserte personverntjenester (f.eks. Sticky GDPR, GDPRX) håndtere det rimeligere.
