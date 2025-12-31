

# Server Instructions — CrumbWorks (Express + Postgres)

These rules apply to backend/API work in `server/`.

## API stability
- Keep existing endpoints stable unless explicitly asked to change:
  - `/api/recipes`, `/api/recipes/:id`, `/api/import`, `/health`
- Do not rename routes or alter response shapes without updating both server + client and documenting the change.

## Database
- Server persistence is Postgres via `server/db.js` (`DATABASE_URL` required).
- Schema is created/updated by `initDatabase()` on startup.
- Do not introduce migrations tooling unless requested.

## Import pipeline
- `POST /api/import` uses `extractRecipeImproved(url)`.
- Maintain extractor strategy order:
  1) plugins
  2) JSON-LD
  3) print
  4) heuristics
- Preserve Ingredient group header semantics (`IngredientToken.isGroupHeader`).

## Security & robustness
- Sanitize URL input for import.
- Do not log secrets.
- Return consistent error payloads with appropriate status codes.
- Always keep `/health` fast and dependency-light.

## Performance
- Avoid blocking calls in request handlers.
- Use timeouts for external fetches.

## Testing expectations
- If you change import behavior, update/verify `server/test-imports.js`.