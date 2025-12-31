# Copilot instructions for `crumb-recipe-pwa`

## Instruction structure (read these first)
- UI rules: `.github/instructions/ui.instructions.md`
- UI Canon (tokens + visuals): `.github/instructions/UI-Cannon-and-style-guide.md`
- PWA rules: `.github/instructions/pwa.instructions.md`
- Server/API rules: `.github/instructions/server.instructions.md`

## Big picture (how the app is split)
- Frontend: React + Vite PWA in `src/` (routes in `src/App.tsx`). Service worker is registered via `virtual:pwa-register`.
- Backend: Express (ESM) in `server/index.js`.
  - Serves the built frontend from `dist/` and also exposes REST endpoints under `/api/*` plus `/health`.
- Storage model is “server-first, offline-capable”:
  - Server persistence: PostgreSQL via `server/db.js` (requires `DATABASE_URL`; schema auto-created by `initDatabase()` on startup).
  - Offline cache: IndexedDB via Dexie in `src/db.ts`.

## Critical data flows & conventions
- Recipe CRUD/import should go through the hybrid DB wrapper `db` in `src/db.ts` (server-first, IndexedDB fallback). UI state uses this via Zustand stores in `src/state/session.ts`.
- API contract is implemented in `server/index.js` and consumed via `src/api/recipes.ts`.
  - Keep endpoints stable: `/api/recipes`, `/api/recipes/:id`, `/api/import`, `/health`.
- Recipe import pipeline (server): `POST /api/import` → `extractRecipeImproved(url)` in `server/extractors/improved-extractor.js`.
  - Strategy order matters: plugin extraction first (`server/extractors/plugins.js`), then JSON-LD, then print, then heuristics.
  - Ingredients may include group headers using `IngredientToken.isGroupHeader` and `raw` like "**For the dough:**" (see `src/types.ts`). Preserve this shape when editing extractors.

## Local dev workflows (commands that actually match this repo)
- Frontend only (offline mode is fine): `npm run dev` (Vite on 5173).
- Full stack (recommended when touching API/import):
  - `npm run server` (Express; default `PORT=3000`)
  - `npm run dev` (Vite proxies `/api` → `http://localhost:3000` per `vite.config.ts`)
- Tests:
  - Unit: `npm test` (Vitest config in `vitest.config.ts`)
  - E2E: `npm run test:e2e` (Playwright)
  - Import regression script: `node server/test-imports.js`

## Docker/CI notes (don’t guess ports)
- Image build/push: GitHub Actions in `.github/workflows/build-push.yml` (publishes to GHCR).
- Server reads `PORT` at runtime; `/health` is used for health checks.
- Source of truth for dev ports is `server/index.js` + `vite.config.ts`.
- If you change runtime ports, update both `docker-compose.yml` and any reverse proxy expectations.

## When making changes
- Prefer modifying the canonical implementations:
  - Import logic: `server/extractors/*` (not ad-hoc parsing in routes).
  - Storage behavior: `src/db.ts` (not direct `fetch` sprinkled through UI).
  - State: `src/state/session.ts` (Zustand stores for recipes/sessions/settings).

## PR completion expectations
- Follow `.github/instructions/*.instructions.md`.
- UI PRs must include `/styleguide` screenshots (mobile/tablet/desktop) per the UI instructions.
- Do not claim completion without evidence.