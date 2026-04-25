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
Anvend med: `npx wrangler d1 migrations apply gameday-db --remote`
Account ID: `7e32b34a4c1bfd168cd4132055b1505b`

## Datamodel — nøglepunkter
- `organizations` → `teams` → `games` → `game_roster`
- En sæson (fx "2025/26") har op til 3 hold
- Hold har: navn, beskrivelse, farve (hex), Holdsport ID — konfigureres i Indstillinger
- `season_config`: webcal-link per org+sæson (bruges til kalenderimport, ikke implementeret endnu)
- Dobbeltbooking: spiller på roster for to kampe samme dato → returneres som `double_booked_players`
- Alle datoer gemmes som ISO strings. Holdsport-tider: split på T, ignorer tidspunkt hvis "00:00"

## API
Alle ruter kræver `Authorization: Bearer <JWT>` undtagen `/auth/*`.
JWT signeres med `JWT_SECRET` (Worker Secret), levetid 30 dage.
CORS tillader kun `https://gameday-b2x.pages.dev`.

## Bruger i prod
- Email: claus.takman@gmail.com
- Org: `org-ajax-u11` (Ajax U11)
- Role: admin

## Frontend
- `src/lib/api.ts` — fetch-wrapper, bruger `VITE_API_URL` env var i prod (sat i workflow)
- `src/lib/auth.tsx` — AuthProvider + useAuth, token i localStorage
- `src/lib/types.ts` — delte TypeScript-typer (Team, Game osv.)
- Sider: HomePage, GamesPage, GameDetailPage, StatsPage, SettingsPage
- Tab-navigation: Hjem / Kampe / Stats / Indstillinger

## Vigtige regler
- Tema er ALTID lyst (hvid baggrund) — ingen dark mode
- Dobbeltbooking-check kører server-side
- Alle datoer gemmes som ISO strings i D1
- Max 3 hold per sæson
- Ingen lokal dev — alt testes via deploy til prod
