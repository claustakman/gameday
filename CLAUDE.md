# CLAUDE.md — Gameday

## Stack
React + Vite (frontend), Cloudflare Workers + D1 (backend), TypeScript overalt.

## Repo-struktur
- frontend/   React app (Vite + Tailwind)
- worker/     Cloudflare Worker API (Hono)

## Deploy
- Frontend: Cloudflare Pages (`gameday-b2x.pages.dev`) via GitHub Actions (`wrangler pages deploy`)
  - Lokalt: `npx wrangler pages deploy dist --project-name gameday --commit-dirty=true`
  - Project name er `gameday` (ikke `gameday-b2x`)
- Worker: `gameday-worker.claus-takman.workers.dev` via GitHub Actions (`wrangler deploy`)
  - Lokalt: `npx wrangler deploy` fra `worker/`
- Push til `main` trigger det relevante workflow baseret på hvilke stier der er ændret

## Database
D1 SQLite, database-navn: `gameday-db`, ID: `8f36b1b1-3b21-47f5-aeb0-90033908bf51`.
Migrations ligger i `worker/migrations/`. Navngivning: `000N_beskrivelse.sql`.
OBS: `wrangler d1 migrations apply gameday-db --remote` fejler med auth 7403.
Brug i stedet: `npx wrangler d1 execute gameday-db --remote --command="<SQL>"`
Account ID: `7e32b34a4c1bfd168cd4132055b1505b`

## Datamodel — nøglepunkter
- `organizations` → `teams` → `games` → `game_roster`
- En sæson (fx "2025/26") har op til 3 hold
- Hold har: navn, beskrivelse, farve (hex), Holdsport ID, standing_url — konfigureres i Indstillinger
- `season_config`: webcal-link per org+sæson (bruges til kalenderimport, ikke implementeret endnu)
- Dobbeltbooking: spiller på roster for to kampe samme dato → returneres som `double_booked_players`
- Alle datoer gemmes som ISO strings. Holdsport-tider: split på T, ignorer tidspunkt hvis "00:00"
- `games.tag`: fritekst-tag per kamp (fx 'turnering', 'træningskamp', 'albertslund cup'). Default 'turnering'. Migration: `0007_game_tag.sql`
- `games.notes`: fritekst-notefelt per kamp. Migration: `0008_game_notes.sql`
- `teams.standing_url`: URL til danskhaandbold.dk/puljer/XXXXX/stilling. Migration: `0009_team_standing_url.sql`
- `games.motm_player_id`: "Fidus — dagens spiller" (tidligere kaldet MOTM). Vises som 🧸 på kort, i Stats og i Hold-sektion på kampdetalje

### players
Felter: `id`, `org_id`, `full_name`, `nickname`, `birth_year` (obligatorisk), `shirt_number`,
`primary_team_id` (valgfri FK til teams), `is_default_keeper`, `hs_user_id`, `active`.
- Spillere tilhører org'en, ikke et bestemt hold (ingen hold-tilknytning pr. spiller)
- `primary_team_id` bruges kun til visning (avatar-farve i Trup)
- `hs_user_id`: Holdsport bruger-ID — sættes automatisk ved sync, kan redigeres i spillerprofil
- `player_teams`-tabellen eksisterer men bruges ikke aktivt i UI pt.

### coaches
Felter: `id`, `org_id`, `name`, `hs_user_id`.
- Vises og redigeres i Indstillinger → Trænere
- Kan tilknyttes `game_roster` som `coach_id`
- Importeres automatisk fra Holdsport ved sync (role=2 i `/members`)

### users
Felter: `id`, `org_id`, `email`, `name`, `password_hash`, `role` ('admin'|'coach').
- `invite_tokens`: single-use, 7 dages udløb, oprettes af admin

## API
Alle ruter kræver `Authorization: Bearer <JWT>` undtagen `/auth/*` og `/invite/:token`.
JWT signeres med `JWT_SECRET` (Worker Secret), levetid 30 dage.
CORS tillader kun `https://gameday-b2x.pages.dev`.

### Vigtige ruter
- `GET/POST /players` — hent/opret spillere (query: active, season, team_id). Returnerer active som integer (normaliseret fra D1)
- `PATCH /players/:id` — opdater spiller (inkl. shirt_number, primary_team_id, active)
- `DELETE /players/:id` — slet spiller (fjerner også game_roster + player_teams entries)
- `GET/POST /games` — hent/opret kampe (returnerer også `player_count`, `coach_names`, `tag`)
- `GET /games/tags` — returnerer distinkte tags for org'en, merget med defaults ['turnering', 'træningskamp']
- `PATCH /games/:id` — rediger kamp inkl. team_id, tag, notes, status (inkl. 'archived')
- `POST /games/:id/finish` — gem resultat + evaluering (went_well, went_bad, motm_player_id)
- `POST /games/:id/focus` — gem fokuspunkter + tally
- `GET/POST/DELETE /game_roster/:game_id` — fremmødeliste pr. kamp (spillere + trænere)
- `GET/POST /coaches`, `PATCH/DELETE /coaches/:id` — trænerstyring
- `GET /users`, `POST /users`, `DELETE /users/:id`, `POST /users/:id/invite` — brugeradmin (kun admin)
- `GET /users/me`, `PATCH /users/me` — egen profil
- `GET /standing/:poolId` — henter turneringsstilling fra DHF API (cms.dhf.dk). Returnerer `{ poolName, rows, lines }`
  - `poolName`: fuldt navn sammensat af `Row.Name + Pool.Name` fra DHF
  - `rows`: `{ priority, teamId, teamName, matchCount, wins, draws, losses, goalsFor, goalsAgainst, points }`
  - `lines`: `{ position, type }` — promotions-/nedrykkningslinjer
  - DHF API: `https://cms.dhf.dk/api/v1/proxy?endpoint=pools/:id`, API-key hardkodet i worker
- `PATCH /teams/:id` — opdater hold inkl. `standing_url`

### Holdsport-ruter (`/holdsport/*`)
Kræver Worker Secrets: `HOLDSPORT_USER`, `HOLDSPORT_PASS` (Basic auth mod `https://api.holdsport.dk/v1`).

- `GET /holdsport/teams` — proxy til Holdsport /teams (til ID-opslag)
- `GET /holdsport/activities/:hs_team_id` — hent aktiviteter til preview (bruges af importmodal)
- `POST /holdsport/import-games` — importer brugervalgte aktiviteter som kampe
  - Body: `{ items: [{ hs_activity_id, team_id, opponent, is_home, date, time, location, tag }] }`
  - Springer over allerede-importerede (tjekker `hs_activity_id`)
- `POST /holdsport/sync-players` — synk spillere + trænere fra `/teams/:id/members`
  - `role=1` → players, `role=2` → coaches
  - Deduplicerer på navn+birthday, matcher eksisterende på `hs_user_id` → `full_name`
  - Returnerer `{ players: {imported, updated}, coaches: {imported, updated}, total }`
- `POST /holdsport/sync-game-players` — synk tilmeldte til én kamp fra Holdsport-aktiviteten
  - Henter `/activities/:id` (indeholder `activities_users` + `activities_coaches` embedded)
  - `status_code=1` = "Tilmeldt" (kun disse synkes)
  - `user_id`-feltet (ikke `id`) mappes mod `hs_user_id` i DB
  - Tilføjer nye + fjerner frameldte (kun dem med `hs_user_id` — manuelle røres ikke)
  - Returnerer `{ added, removed, total }`
- `POST /holdsport/bulk-update-games` — opdater tid, sted og tilmeldte for alle planlagte kampe med `hs_activity_id`
  - Returnerer `{ updated, playersAdded, playersRemoved, total }`

#### Holdsport API-noter
- Base URL: `https://api.holdsport.dk/v1`
- Ét Holdsport-trup dækker alle app-hold — hold bestemmes af aktivitetsnavn
- Aktivitetsnavn format: `"Kamp: Ajax København 2 - Holte 2"` eller `"FHH90 - Ajax 2 (Træningskamp i Fløng)"`
- Filtrering: brug `event_type_id` (1=Kamp, 2=Træning, 4=Stævne) — ikke titel-parsing
- Hold-matching: `teamMatches(titleSide, teamName)` — word-subset match så "Ajax 2" matcher "Ajax København 2"
- Strip trailing parentes: `"FHH90 - Ajax 2 (Træningskamp i Fløng)"` → strip `(...)` → `"FHH90 - Ajax 2"`
- Pagination: `/teams/:id/activities?per_page=100` — default returnerer kun ~20 aktiviteter
- Timestamps: `"2026-05-31T13:00:00+02:00"` — strip timezone med `.replace(/[+-]\d{2}:\d{2}$/, '')`
- `/teams/:id/members` returnerer: `{ id, firstname, lastname, role, birthday }`
- `/activities/:id` returnerer array med ét objekt med `activities_users` + `activities_coaches`
- `activities_users[].user_id` = Holdsport bruger-ID (ikke `.id` som er enrollment-ID)
- `status_code`: 1=Tilmeldt, 4=Udvalgt, 5=Ukendt
- Ny spiller på roster: sæt `is_keeper=1` hvis spillerens `is_default_keeper=1`

## Bruger i prod
- Email: claus.takman@gmail.com
- Org: `org-ajax-u11` (Ajax U11)
- Role: admin

## Frontend
- `src/lib/api.ts` — fetch-wrapper, bruger `VITE_API_URL` env var i prod, 401 → clear localStorage + reload
- `src/lib/auth.tsx` — AuthProvider + useAuth + updateUser, token i localStorage
- `src/lib/types.ts` — delte TypeScript-typer: Team, Game, Player, Coach, RosterEntry, PlayerStat
- `frontend/.env.production` — `VITE_API_URL=https://gameday-worker.claus-takman.workers.dev`

### Sider og navigation
Tab-bar: **Hjem / Kampe / Stats** + hamburger **Mere** (slide-up menu)
- `/`          → HomePage — næste kamp pr. hold (m. tilmeldte + trænere), seneste resultater
- `/games`     → GamesPage — liste med hold/status/sæson-filter + chip-sortering. Default: Planlagt. Kampe sorteres stigende efter dato+tid
  - FAB (+) nederst højre: åbner mini-menu med "Opret kamp" og "Importer fra Holdsport"
  - Header: sync-ikon (bulk-update fra Holdsport) + "Vælg"-chip
  - Multi-select: "Vælg" aktiverer select-tilstand → action-bar med Arkivér, Holdsport-sync, Slet
  - Enkelt slet: × på hvert kort med inline bekræftelse
- `/games/:id` → GameDetailPage — detaljer, fokus+tally, noter, rediger (inkl. tag), resultat (fullscreen), arkivér, Holdsport-sync knap
  - Advarsler (ingen keeper, dobbeltbooking) vises som kollapsbar boks — default kollapset
  - Fidus-spiller markeres med 🧸 ved siden af K-knappen i Hold-sektionen
- `/stats`     → StatsPage — statistik pr. hold/sæson
- `/standing`  → StandingPage — turneringsstilling hentet live fra DHF API. Hold-chip filter øverst. Ajax-hold markeres med farvet venstrekant + baggrund
- `/squad`     → SquadPage — trupsstyring: liste, opret/rediger/slet, årgangfilter, sortering, inaktive-filter (chip skifter mellem aktive og inaktive)
- `/profile`   → ProfilePage — rediger navn/kodeord, logout
- `/settings`  → SettingsPage — hold (inkl. standing_url), webcal, trænere, Holdsport, brugere (admin)
- `/invite/:token` → AcceptInvitePage — public, accepter invitation

### Design-tokens (Tailwind)
`bg-bg` (#fff), `bg-bg2` (#f5f5f5), `text-text1` (#1a1a1a), `text-text2` (#4a4a4a), `text-text3` (#6b6b6b),
`text-green`, `text-red`, `border-border`, `bg-green-light`, `text-green-dark`

### Mønstre
- Bottom sheets: `fixed bottom-14 left-0 right-0 z-50`, `max-h-[calc(90dvh-3.5rem)]`, `env(safe-area-inset-bottom)`
- Chip-filtre: `shrink-0 px-3 py-1 rounded-full text-xs font-semibold` med aktiv/inaktiv farve
- Avatar med holdfarve: `backgroundColor: team.color`, hvid tekst
- Farvet kamp-/holdkort: `backgroundColor: color+'12'`, `borderLeft: 3px solid color`
- Tilmeldte-badge: grøn pill (spillere) + grøn outline pill (trænere med fornavne)
- Spillere i Hold-sektionen og Fidus-valg: sorteret efter trøjenummer, uden nummer til sidst
- Tag-badge på GameRow: lille mærkat under tid/lokation med `bg-bg2 text-text3 border-border`
- Tag-input med autocomplete: henter `/games/tags` ved fokus, viser dropdown med eksisterende tags. Brugt i EditSheet, NewGameSheet og HsImportGamesModal. Default 'turnering'
- active-felt: D1 kan returnere integer eller boolean — brug altid `Number(p.active) === 1` i frontend og normaliser i worker
- Fullscreen overlay: `fixed inset-0 z-[60] bg-bg flex flex-col` med header + scroll-div. Bruges af ResultSheet og AddToRosterSheet
- Dobbeltbooking-advarsel: gult badge "Dobbelt" med tooltip på GameRow
- Ingen-keeper-advarsel: orange badge "Ingen keeper" på GameRow + orange banner i GameDetailPage Hold-sektion
- Arkivering: PATCH /games/:id med `{ status: 'archived' }` — synlig med 'Arkiveret'-filter i GamesPage
- Stilling: Ajax-hold markeres med `borderLeft: 4px solid color` + `backgroundColor: color+'12'`. Hold-match: `teamName.includes(ourName) || ourName.includes(teamName)` (case-insensitive)
- FAB (floating action button): `fixed z-50 w-14 h-14 rounded-full bg-green`, placeret `bottom: calc(5rem + env(safe-area-inset-bottom)), right: 1rem`. Roterer til × når åben. Mini-menu springer op over FAB.

### Holdsport i UI
- SettingsPage: `hsTeamId`-felt (default "625040") med "(slå op)"-knap der lister Holdsport-hold
- "Importer kampe" → åbner `HsImportGamesModal` (2-trins: datovalg → aktivitetsliste m. tag-felt per kamp)
- "Synkronisér spillere" → `POST /holdsport/sync-players`
- GamesPage: "Opdater"-knap → `POST /holdsport/bulk-update-games` (tid, sted, tilmeldte for alle planlagte)
- GamesPage: "Importer"-knap → `HsImportGamesModal` (hardcoded hsTeamId="625040")
- GameDetailPage: "Holdsport"-knap i Hold-sektion (kun hvis `hs_activity_id` er sat) → `POST /holdsport/sync-game-players`

## Vigtige regler
- Tema er ALTID lyst (hvid baggrund) — ingen dark mode
- Dobbeltbooking-check kører server-side
- Alle datoer gemmes som ISO strings i D1
- Max 3 hold per sæson
- Ingen lokal dev — alt testes via deploy til prod
- TypeScript strict: ubrugte variabler (`TS6133`) bryder buildet — fjern dem altid
- Frontend deployes lokalt med project-name `gameday` (ikke `gameday-b2x`)
