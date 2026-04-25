# Gameday — Technical Specification

Holdstyringsapp til Ajax U11. Afløser for prototype-appen "Holdstyr".

---

## Stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React (Vite), TailwindCSS |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Auth | Cloudflare Workers + JWT (eller Clerk.dev) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |
| CI/CD | GitHub Actions |
| Repo | `claustakman/gameday` |

---

## Projektstruktur

```
gameday/
├── frontend/          # React/Vite app
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── worker/            # Cloudflare Worker (API)
│   ├── src/
│   │   ├── routes/
│   │   ├── db/
│   │   └── index.ts
│   └── wrangler.toml
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml
│       └── deploy-worker.yml
└── CLAUDE.md
```

---

## Datamodel (D1 / SQLite)

### `organizations`
```sql
id          TEXT PRIMARY KEY,  -- uuid
name        TEXT NOT NULL,     -- "Ajax U11"
created_at  TEXT NOT NULL
```

### `users`
```sql
id              TEXT PRIMARY KEY,
org_id          TEXT REFERENCES organizations(id),
email           TEXT UNIQUE NOT NULL,
name            TEXT NOT NULL,
role            TEXT NOT NULL,  -- 'admin' | 'coach'
password_hash   TEXT,
created_at      TEXT NOT NULL
```

### `teams`
```sql
id          TEXT PRIMARY KEY,
org_id      TEXT REFERENCES organizations(id),
name        TEXT NOT NULL,      -- "Hold A", "Hold B"
color       TEXT NOT NULL,      -- hex, bruges til UI-kortfarve
season      TEXT NOT NULL,      -- "2024/25"
hs_team_id  TEXT,               -- Holdsport team ID
created_at  TEXT NOT NULL
```

### `players`
```sql
id              TEXT PRIMARY KEY,
org_id          TEXT REFERENCES organizations(id),
full_name       TEXT NOT NULL,
nickname        TEXT,
birth_year      INTEGER,
is_default_keeper BOOLEAN DEFAULT 0,
hs_user_id      TEXT,           -- Holdsport bruger-ID
active          BOOLEAN DEFAULT 1,
created_at      TEXT NOT NULL
```

### `coaches`
```sql
id          TEXT PRIMARY KEY,
org_id      TEXT REFERENCES organizations(id),
user_id     TEXT REFERENCES users(id),
name        TEXT NOT NULL,
hs_user_id  TEXT,
created_at  TEXT NOT NULL
```

### `games`
```sql
id              TEXT PRIMARY KEY,
team_id         TEXT REFERENCES teams(id),
season          TEXT NOT NULL,      -- "2024/25"
date            TEXT NOT NULL,      -- ISO date "2025-05-03"
time            TEXT,               -- "16:30" eller NULL
meetup_time     TEXT,               -- "15:45" eller NULL
opponent        TEXT NOT NULL,
location        TEXT,
is_home         BOOLEAN DEFAULT 1,
status          TEXT DEFAULT 'planned',  -- 'planned' | 'done' | 'archived'
result_us       INTEGER,
result_them     INTEGER,
focus_1         TEXT,
focus_2         TEXT,
focus_3         TEXT,
goal_1          TEXT,               -- målbeskrivelse for fokus_1
goal_2          TEXT,
goal_3          TEXT,
tally_1         INTEGER DEFAULT 0,  -- live-tæller for fokus_1
tally_2         INTEGER DEFAULT 0,
tally_3         INTEGER DEFAULT 0,
went_well       TEXT,
went_bad        TEXT,
motm_player_id  TEXT REFERENCES players(id),
hs_activity_id  TEXT,
created_at      TEXT NOT NULL
```

### `game_roster` — spillere og trænere på en kamp
```sql
id          TEXT PRIMARY KEY,
game_id     TEXT REFERENCES games(id),
player_id   TEXT REFERENCES players(id),  -- NULL hvis coach
coach_id    TEXT REFERENCES coaches(id),  -- NULL hvis player
is_keeper   BOOLEAN DEFAULT 0,
created_at  TEXT NOT NULL
```

### `player_teams` — spiller kan være på flere hold
```sql
player_id   TEXT REFERENCES players(id),
team_id     TEXT REFERENCES teams(id),
season      TEXT NOT NULL,
PRIMARY KEY (player_id, team_id, season)
```

---

## API-ruter (Cloudflare Worker)

Alle ruter kræver Bearer JWT i `Authorization`-header undtagen `/auth/*`.

### Auth
```
POST /auth/login          { email, password } → { token, user }
POST /auth/logout
GET  /auth/me             → { user }
```

### Holds
```
GET    /teams             → [team]
POST   /teams             { name, color, season, hs_team_id }
PATCH  /teams/:id
DELETE /teams/:id
```

### Kampe
```
GET    /games             ?team_id=&season=&status=&opponent=
POST   /games             { team_id, date, time, meetup_time, opponent, location, is_home }
GET    /games/:id
PATCH  /games/:id
DELETE /games/:id

POST   /games/:id/focus   { focus_1, goal_1, focus_2, goal_2, focus_3, goal_3 }
PATCH  /games/:id/tally   { field: 'tally_1'|'tally_2'|'tally_3', delta: 1|-1 }
POST   /games/:id/finish  { result_us, result_them, went_well, went_bad, motm_player_id }
```

### Hold (roster)
```
GET    /games/:id/roster
POST   /games/:id/roster  { player_id?, coach_id?, is_keeper? }
DELETE /games/:id/roster/:roster_id
```

### Spillere
```
GET    /players           ?season=&team_id=&active=
POST   /players           { full_name, nickname, birth_year, is_default_keeper }
PATCH  /players/:id
```

### Trænere
```
GET    /coaches
POST   /coaches           { name }
PATCH  /coaches/:id
```

### Statistik
```
GET    /stats             ?season=&team_id=  → { games, player_stats[], coach_stats[] }
```

### Holdsport-import
```
POST   /holdsport/sync-games    { team_id, hs_team_id }  → importerer kampe
POST   /holdsport/sync-players  { team_id, hs_team_id }  → importerer spillere
```

---

## Dobbeltbooking-logik

En dobbeltbooking opstår når en spiller optræder på roster for to forskellige kampe på samme dato.

- Beregnes ved `GET /games` og `GET /games/:id/roster`
- Returneres som `double_booked_players: [{ player_id, name, other_game_id, other_team_name }]`
- Frontend viser gul markør på kampkort (forside), i kampliste og på Hold-skærmen

---

## Frontend — sider og navigation

### Tab-navigation (bund)
1. **Hjem** — næste kamp per hold + seneste resultater
2. **Kampe** — liste med søgning og filtre (hold, sæson, status)
3. **Stats** — sæsonstatistik for spillere og trænere
4. **Indstillinger** — trupopsætning, Holdsport-konfiguration

### Underflows (ikke egne tabs)
- **Kampdetalje** — åbnes fra kamp-rækker
- **Fokuspunkter** — redigeres fra kampkort/detalje
- **Live-registrering** — tæller under kamp, åbnes fra kampdetalje
- **Hold** — roster-liste per kamp, åbnes fra kampkort

---

## Design-tokens (lyst tema, låst)

```css
--green:        #1D9E75;
--green-light:  #E1F5EE;
--green-dark:   #0F6E56;
--blue:         #185FA5;
--blue-light:   #E6F1FB;
--blue-dark:    #0C447C;
--purple:       #7F77DD;   /* trænere */
--purple-light: #EEEDFE;
--amber-light:  #FFF3CD;   /* dobbeltbooking */
--amber-text:   #854F0B;
--red:          #A32D2D;
--bg:           #ffffff;
--bg2:          #f5f5f5;
--text:         #1a1a1a;
--text2:        #666666;
--text3:        #999999;
--border:       rgba(0,0,0,0.10);
```

Holdfarver sættes per hold i databasen og bruges til kampkort-baggrund på forsiden.

---

## Holdsport-integration

Holdsport-workeren fra prototype-appen genbruges som proxy. Den eksponerer:
- `GET /teams` — henter hold
- `GET /teams/:id/activities` — henter kampe
- `GET /activities/:id/users` — henter tilmeldte

Credentials (`HOLDSPORT_USER`, `HOLDSPORT_PASS`) gemmes som Worker Secrets.

Tidspunkter fra Holdsport er lokal ISO-format (`2026-04-03T16:30:00`). `00:00` behandles som ingen tid (NULL).

---

## GitHub Actions

### `deploy-worker.yml`
Trigger: push til `main` med ændringer i `worker/`
```yaml
- uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CF_API_TOKEN }}
    workingDirectory: worker
    command: deploy
```

### `deploy-frontend.yml`
Trigger: push til `main` med ændringer i `frontend/`
```yaml
- uses: cloudflare/pages-action@v1
  with:
    apiToken: ${{ secrets.CF_API_TOKEN }}
    projectName: gameday
    directory: frontend/dist
    gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

---

## Sikkerhed

- JWT signeres med `JWT_SECRET` (Worker Secret)
- Token-levetid: 30 dage
- Alle D1-kald bruger prepared statements (ingen SQL-injection)
- CORS begrænses til Pages-domænet
- Ingen sensitive data i URL-parametre

---

## Fremtidige faser (ikke i v1)

- **Skudstatistik (angriber)** — tablet-UI med 1/3 håndboldbane, markering af skudposition og placering i mål
- **Skudstatistik (forsvarer/keeper)** — samme interface, redningsprocent og forsvarsanalyse

---

## CLAUDE.md — instruktioner til Claude Code

```markdown
# CLAUDE.md — Gameday

## Stack
React + Vite (frontend), Cloudflare Workers + D1 (backend), TypeScript overalt.

## Repo-struktur
- frontend/   React app (Vite + Tailwind)
- worker/     Cloudflare Worker API

## Deploy
- Frontend: Cloudflare Pages via GitHub Actions
- Worker: Cloudflare Workers via GitHub Actions (wrangler deploy)

## Database
D1 SQLite. Migrations ligger i worker/migrations/.
Kør `wrangler d1 migrations apply gameday-db` for at anvende.

## Lokalt dev
- Worker: `cd worker && wrangler dev`
- Frontend: `cd frontend && npm run dev`
- Brug .dev.vars til lokale secrets (aldrig commit)

## Vigtige regler
- Tema er ALTID lyst (hvid baggrund) — ingen dark mode
- Dobbeltbooking-check skal køre server-side
- Alle datoer gemmes som ISO strings i D1
- Holdsport-tider: split på T, ignorer 00:00
```
