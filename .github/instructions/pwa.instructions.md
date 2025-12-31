

# PWA Instructions — CrumbWorks

These instructions apply to PWA installability, offline behavior, caching, and cross-device browser compatibility (mobile/tablet Safari + desktop browsers).

## Non-negotiables
- The app must remain installable as a PWA on mobile/tablet Safari and desktop.
- Offline mode must remain functional.
- Do not break the service worker update flow.
- Do not add new PWA-related dependencies unless explicitly requested.

## Manifest rules
- `manifest.webmanifest` must remain valid and referenced.
- App icons must be PNG and include a 1024×1024 source asset.
- Do not bake rounded corners into icon PNGs (platform applies masks).
- No transparency for Apple icon exports.

## Service worker & caching
- Use a conservative caching strategy:
  - Cache static assets (JS/CSS/fonts) safely.
  - Avoid caching API responses unless explicitly versioned and invalidated.
- Ensure SW updates are detectable:
  - When a new SW is available, prompt or refresh per current app convention.
- Never create a “stale forever” cache on HTML shell.

## Offline-first behavior
- Recipes should remain available offline via IndexedDB/Dexie.
- Server-first sync must fail gracefully when offline.
- When offline:
  - UI should show an offline indicator state
  - Actions that require network should provide clear messaging

## Safari/WebKit specifics
- Respect safe-area insets (notch) in the header.
- Avoid layout that relies on `100vh` without Safari fixes; prefer `100dvh` or a safe viewport strategy.
- Verify install + launch behavior for mobile/tablet Safari (installed).

## Acceptance checks (must pass)
- Lighthouse PWA checks (as feasible)
- Install prompt works where supported
- Offline mode works after a hard refresh
- No console errors related to SW registration or manifest