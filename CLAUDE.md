# CLAUDE.md — Gameday

## Stack
React + Vite (frontend), Cloudflare Workers + D1 (backend), TypeScript overalt.

## Repo-struktur
- frontend/   React app (Vite + Tailwind)
- worker/     Cloudflare Worker API (Hono)

## Deploy
- Frontend: Cloudflare Pages (`gameday-b2x.pages.dev`) via GitHub Actions (`wrangler pages deploy`)
- Worker: `gameday-worker.claus-takman.workers.dev` via GitHub Actions (`wrangler deploy`)
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
- Hold har: navn, beskrivelse, farve (hex), Holdsport ID — konfigureres i Indstillinger
- `season_config`: webcal-link per org+sæson (bruges til kalenderimport, ikke implementeret endnu)
- Dobbeltbooking: spiller på roster for to kampe samme dato → returneres som `double_booked_players`
- Alle datoer gemmes som ISO strings. Holdsport-tider: split på T, ignorer tidspunkt hvis "00:00"

### players
Felter: `id`, `org_id`, `full_name`, `nickname`, `birth_year` (obligatorisk), `shirt_number`,
`primary_team_id` (valgfri FK til teams), `is_default_keeper`, `hs_user_id`, `active`.
- Spillere tilhører org'en, ikke et bestemt hold (ingen hold-tilknytning pr. spiller)
- `primary_team_id` bruges kun til visning (avatar-farve i Trup)
- `hs_user_id`: Holdsport bruger-ID — redigeres i spillerprofil, bruges til fremtidig HS-integration
- `player_teams`-tabellen eksisterer men bruges ikke aktivt i UI pt.

### users
Felter: `id`, `org_id`, `email`, `name`, `password_hash`, `role` ('admin'|'coach').
- `invite_tokens`: single-use, 7 dages udløb, oprettes af admin

## API
Alle ruter kræver `Authorization: Bearer <JWT>` undtagen `/auth/*` og `/invite/:token`.
JWT signeres med `JWT_SECRET` (Worker Secret), levetid 30 dage.
CORS tillader kun `https://gameday-b2x.pages.dev`.

### Vigtige ruter
- `GET/POST /players` — hent/opret spillere (query: active, season, team_id)
- `PATCH /players/:id` — opdater spiller (inkl. shirt_number, primary_team_id, active)
- `GET/POST /games` — hent/opret kampe
- `PATCH /games/:id` — rediger kamp inkl. team_id
- `POST /games/:id/finish` — gem resultat + evaluering
- `POST /games/:id/focus` — gem fokuspunkter + tally
- `GET/POST/DELETE /game_roster/:game_id` — fremmødeliste pr. kamp
- `GET /users`, `POST /users`, `DELETE /users/:id`, `POST /users/:id/invite` — brugeradmin (kun admin)
- `GET /users/me`, `PATCH /users/me` — egen profil

## Bruger i prod
- Email: claus.takman@gmail.com
- Org: `org-ajax-u11` (Ajax U11)
- Role: admin

## Frontend
- `src/lib/api.ts` — fetch-wrapper, bruger `VITE_API_URL` env var i prod (sat i workflow)
- `src/lib/auth.tsx` — AuthProvider + useAuth + updateUser, token i localStorage
- `src/lib/types.ts` — delte TypeScript-typer: Team, Game, Player, Coach, RosterEntry, PlayerStat

### Sider og navigation
Tab-bar: **Hjem / Kampe / Stats** + hamburger **Mere** (slide-up menu)
- `/`          → HomePage — næste kamp pr. hold, seneste resultater
- `/games`     → GamesPage — liste med hold/status/sæson-filter + chip-sortering
- `/games/:id` → GameDetailPage — detaljer, fokus+tally, rediger, resultat
- `/stats`     → StatsPage — statistik pr. hold/sæson
- `/squad`     → SquadPage — trupsstyring: liste, opret/rediger, årgangsfilter, sortering
- `/profile`   → ProfilePage — rediger navn/kodeord, logout
- `/settings`  → SettingsPage — hold, webcal, brugere (admin)
- `/invite/:token` → AcceptInvitePage — public, accepter invitation

### Design-tokens (Tailwind)
`bg-bg`, `bg-bg2`, `text-text1/2/3`, `text-green`, `text-red`, `border-border`,
`bg-green-light`, `text-green-dark`

### Mønstre
- Bottom sheets: `fixed bottom-14 left-0 right-0 z-50`, `max-h-[calc(90dvh-3.5rem)]`, `env(safe-area-inset-bottom)`
- Chip-filtre: `shrink-0 px-3 py-1 rounded-full text-xs font-semibold` med aktiv/inaktiv farve
- Avatar med holdfarve: `backgroundColor: team.color`, hvid tekst
- Farvet kamp-/holdkort: `backgroundColor: color+'12'`, `borderLeft: 3px solid color`

## Vigtige regler
- Tema er ALTID lyst (hvid baggrund) — ingen dark mode
- Dobbeltbooking-check kører server-side
- Alle datoer gemmes som ISO strings i D1
- Max 3 hold per sæson
- Ingen lokal dev — alt testes via deploy til prod
- TypeScript strict: ubrugte variabler (`TS6133`) bryder buildet — fjern dem altid
