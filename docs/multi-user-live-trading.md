# Apex Quantum — Multi-bruker autonom live-handel

## Hvordan koblingen fungerer

Apex Quantum har **én** OAuth-app registrert hos Saxo Developer Portal. Den
appen er definert av `SAXO_CLIENT_ID` + `SAXO_CLIENT_SECRET` i Vercel-miljøet.
Det er ikke "din private demo-konto" — det er produktets autorisasjonsidentitet
hos Saxo.

Hver kunde kobler sin egen Saxo-konto slik:

1. Kunden trykker **"Koble til Saxo Bank"** på `/saxo-simulation`
2. De redirectes til `https://sim.logonvalidation.net/authorize` (eller
   `live.logonvalidation.net/authorize` for live) med vår `client_id`
3. Saxo viser deres egen påloggings­side — **Apex Quantum ser aldri passordet**
4. Kunden godkjenner at vår app får handle på deres konto
5. Saxo sender dem tilbake til `/callback?code=...`
6. `app/api/apex/saxo-token` veksler `code` mot kundens `access_token` +
   `refresh_token` og lagrer dem i Supabase-tabellen `saxo_tokens` med deres
   `clerk_user_id` som unik nøkkel
7. `app/api/apex/connect-saxo` validerer kontoen og låser kundens
   `start_balance` (avkastning beregnes mot dette, aldri overskrives)

## Autonom handel per bruker

To uavhengige loops kan kjøre per kunde:

### Vercel Cron (`/api/cron/autonomous`)

- Trigger: hvert minutt (`* * * * *` i `vercel.json`)
- Henter alle rader fra `saxo_tokens` via service-role-client
- For hver kunde:
  1. `ensureFreshToken()` sjekker `expires_at` og refresher mot riktig endpoint
     (sim vs live) hvis det er <5 min igjen
  2. Kjører handelsskanning mot kundens egen `accountKey` med deres token
  3. Kun kunden eier ordrene — ingen krysskontaminering

### Inngest (`apexQuantumTick`)

- Samme mønster, men kjøres via Inngests retry/observability-stack
- 2 ticks per minutt (30s mellomrom)
- Concurrency-batching på 5 brukere om gangen for å respektere Saxos
  rate-limits

## Refresh-logikk

`lib/saxo-refresh.ts` håndterer per-bruker token-refresh:

- Saxo SIM-tokens varer typisk ~24 timer
- Saxo LIVE-tokens varer typisk ~20 minutter
- Refresh-tokens varer 1 år (sim) / 1 time (live, app-spesifikt)
- Hvis refresh feiler: kunden må reconnecte. Cron logger og fortsetter med
  resten av brukerne.

## Live-modus per kunde

Hver kunde har sitt eget `environment`-felt (`sim` eller `live`) i
`saxo_tokens`. Cron + Inngest leser dette per rad og bygger riktig API-base
(`gateway.saxobank.com/sim/openapi` vs `gateway.saxobank.com/openapi`). Dette
betyr du kan ha **noen kunder på sim og andre på live samtidig** — den
globale `SAXO_ENV`-variabelen er kun en default for nye tilkoblinger.

For at en kunde skal kunne koble en LIVE-konto, må vi:

1. Registrere en separat **LIVE OAuth-app** hos `developer.saxo` (forskjellig
   fra SIM-appen som er registrert hos `sim.developer.saxo`)
2. Bruke den live-appens `CLIENT_ID/SECRET` når `SAXO_ENV=live`
3. Eventuelt støtte begge samtidig ved å splitte env-vars
   (`SAXO_LIVE_CLIENT_ID`, `SAXO_SIM_CLIENT_ID`) — ikke implementert ennå,
   bytt env-var ved deploy om du vil swappe

## Påkrevde miljøvariabler i Vercel

| Variabel | Hvorfor |
|---|---|
| `SAXO_CLIENT_ID` | Vår OAuth-app-ID hos Saxo |
| `SAXO_CLIENT_SECRET` | Vår OAuth-app-secret |
| `NEXT_PUBLIC_SAXO_CLIENT_ID` | Eksponert til browser for OAuth-redirect |
| `SAXO_REDIRECT_URI` | Må matche det som er registrert i Saxo Dev Portal |
| `NEXT_PUBLIC_SAXO_REDIRECT_URI` | Browser-versjon av samme |
| `SAXO_ENV` | `sim` eller `live` — default for nye tilkoblinger |
| `CLERK_SECRET_KEY` | Server-side Clerk-auth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser Clerk-auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Database |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-side Supabase (RLS-beskyttet) |
| `SUPABASE_SERVICE_ROLE_KEY` | **NY** — kreves for at cron skal kunne lese alle brukere |
| `CRON_SECRET` | Hindrer at cron-endpointen kan trigges utenfra |
| `START_BALANCE` | Default startkapital (kun fallback) |

## Deploy-checklist

1. **Supabase migration** — kjør oppdatert `prisma/supabase-setup.sql` i SQL
   Editor. Den legger til indices på `expires_at` + `environment` og en CHECK
   constraint på `environment`.
2. **Service role key** — kopier fra Supabase → Settings → API →
   `service_role` (ikke `anon`!) inn i Vercel som `SUPABASE_SERVICE_ROLE_KEY`.
3. **Saxo Dev Portal** — bekreft at `Redirect URI` matcher
   `https://apex-quantum.com/callback` for både SIM og LIVE-appen.
4. **`CRON_SECRET`** — generer en lang random string og legg den i Vercel.
5. **Push** — `git push` deployer automatisk via Vercel-integrasjonen
   (`vercel.json` setter `deploymentEnabled.main = true`).
6. **Verifiser** — etter deploy:
   - Lag en test­konto i Clerk
   - Koble Saxo SIM via `/saxo-simulation`
   - Sjekk at det dukker opp en rad i `saxo_tokens` med riktig `environment`
   - Vent ett minutt og se på Vercel cron-loggen — skal vise
     `[CRON] Done in Xms — N/M orders across 1 users`

## Sikkerhetsnotater

- `saxo_tokens.access_token` ligger plain-text i Postgres. Supabase tilbyr
  pgsodium for kolonne-kryptering om du vil legge til det senere.
- RLS er disabled på tabellen — *all* tilgang skjer server-side. Anon-nøkkelen
  i browser ser ikke tabellen.
- `apex_saxo_token`-cookien (HttpOnly) brukes som same-device fallback men
  utløper innen 24t — DB-en er kilden til sannhet.
- Cron-endpointen avviser alle requests uten `Authorization: Bearer
  ${CRON_SECRET}`.
