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
