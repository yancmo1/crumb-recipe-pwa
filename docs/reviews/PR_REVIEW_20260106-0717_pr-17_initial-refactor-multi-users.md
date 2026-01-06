### 1) Scope and intent
- Introduces a multi-user / multi-profile architecture on the client: identity (`local:<uuid>`), profile registry, profile switching UI, and profile-scoped IndexedDB databases.
- Adds one-time migration from the legacy single-user `CrumbDB` + legacy localStorage keys into a default profile namespace.
- Refactors the DB layer to a global wrapper (`CrumbDBWrapper`) that preserves the prior `db` API surface while allowing profile re-initialization.
- Adds snapshot export/import for profile portability, plus docs and unit tests to cover identity/profiles/storage/snapshots.

### 2) Risk inventory (choose what applies)
- Concurrency & reentrancy (init + profile switching; multiple DB instances)
- Error handling & logging (init failure path; migration detection failures)
- State synchronization / single source of truth (active profile tracked in multiple places)
- Backward compatibility / availability gating (legacy storage migration; Safari/WebKit APIs)
- Performance / memory (Dexie connections not closed on reinit; page reload strategy)
- Data integrity / migrations (legacy DB detection; idempotence; partial migration)
- UI/UX regression risk (blocking “Initializing…” gate; Settings page expansion)
- Build/CI / target membership / packaging (Settings file trailing character; type definition loosened)

### 3) Findings summary (High / Medium / Low)
| Severity | Item |
|---|---|
| High | `src/pages/Settings.tsx` has a trailing `%` which will break TypeScript parsing/build |
| High | Profile-scoped settings persistence implementation likely incompatible with Zustand `persist` storage contract (risk: broken settings + syncKey isolation) |
| High | Legacy DB detection uses `indexedDB.databases()` (WebKit/Safari support risk) → migration may silently skip recipe data |
| High | Active profile state is split across two sources (`registry.activeUserId` vs `crumbworks.profiles.active`) → can allow deleting the active profile / inconsistent init |
| Medium | Profile creation uses `crypto.randomUUID()` without fallback + unused `resolveCurrentUserId()` result |
| Medium | `reinitializeForProfile` does not close prior Dexie DB; profile switching also triggers reload redundantly |
| Medium | Missing `docs/design/STRIDELOG_DESIGN_SYSTEM_V1.md` blocks the required UI conformance check/citation |
| Low | `vite.config.d.ts` relaxed to `any` (types degrade) + small cleanup opportunities (unused imports, duplicated state) |

### 4) Decision required (if applicable)
- Decide the intended relationship between **profiles** and **server syncKey**:
  - Should every profile automatically get its own server namespace (e.g., derive a default `syncKey` from `userId`), or is server sync a manual, user-entered “shared library” concept independent of profiles?
  - This decision impacts whether switching profiles can ever “leak” server-synced recipes across profiles.

### 5) Required changes (blocking)

1) **Fix Settings page parse-breaking trailing character**
- Why it matters (impact): A stray `%` at the end of `src/pages/Settings.tsx` will cause TypeScript/JSX parsing to fail, blocking build/CI and runtime.
- Exact fix guidance: Remove the trailing `%` so the file ends with a normal closing brace `}` / newline.
- Anchors: `src/pages/Settings.tsx:Settings(...)` (~L13–L700; specifically ~L699–L700 shows `}%`).

2) **Make profile-scoped settings persistence compatible with Zustand persist**
- Why it matters (impact): The custom `storage` passed to `persist` appears to treat values as objects (parse/stringify) but Zustand’s `persist` `StateStorage` API expects **string values**. This can lead to:
  - Settings not loading/saving
  - `syncKey` not applied consistently
  - Server recipe scoping broken (profiles may fetch the same syncKey scope)
- Exact fix guidance:
  - Implement a storage adapter that conforms to `StateStorage` (`getItem(): string | null`, `setItem(value: string)`), and only change the *key* based on active profile.
  - Alternatively use Zustand’s `createJSONStorage` and provide a wrapper that rewrites the storage key to `crumbworks:${userId}:settings`.
  - Ensure migration and persistence agree on the exact stored format and key names.
- Anchors: `src/state/session.ts:useSettings(...)` (~L309–L398).

3) **Fix legacy DB detection/migration for Safari/WebKit**
- Why it matters (impact): `indexedDB.databases()` is not reliably available across Safari/WebKit. If it throws or returns empty, `hasLegacyDatabase()` returns false, and migration will skip IndexedDB recipe/session data even when legacy `CrumbDB` exists. That is a silent data-loss scenario for existing users.
- Exact fix guidance:
  - Replace `indexedDB.databases()` usage with a Dexie-supported / broadly-compatible check (e.g., Dexie helpers) or attempt an `open()` on `CrumbDB` and detect success.
  - Ensure migration can detect and copy data on iOS Safari (PWA critical).
- Anchors:
  - `src/storage/storageFactory.ts:hasLegacyDatabase(...)` (~L86–L97)
  - `src/migrations/migrateToMultiUserV1.ts:migrateToMultiUserV1(...)` (~L125–L154)

4) **Unify active profile tracking; prevent deleting active profile reliably**
- Why it matters (impact): Active profile is tracked in two places:
  - `crumbworks.profiles.active` (read by `getActiveProfileId()`)
  - `ProfileRegistry.activeUserId` (used by `deleteProfile()` and `ensureDefaultProfile()`)

  If these diverge (very plausible), `deleteProfile()` may allow deleting the active profile, leaving the app in a broken state (active profile points to a non-existent registry entry). Also `ensureDefaultProfile()` may incorrectly pick a profile.
- Exact fix guidance:
  - Choose **one** source of truth (prefer `crumbworks.profiles.active` since that is already used) and remove/stop using `registry.activeUserId`, or keep it but always read/write it in lockstep.
  - Ensure `deleteProfile()` checks the actual active ID returned from `getActiveProfileId()`.
  - Ensure `ensureDefaultProfile()` respects `getActiveProfileId()`.
- Anchors:
  - `src/profile/profileManager.ts:getActiveProfileId(...)` (~L57–L65)
  - `src/profile/profileManager.ts:setActiveProfile(...)` (~L81–L100)
  - `src/profile/profileManager.ts:deleteProfile(...)` (~L146–L156)
  - `src/profile/profileManager.ts:ensureDefaultProfile(...)` (~L170–L191)

### 6) Approval criteria
- [ ] Build succeeds (TypeScript/Vite) with no syntax errors (must include `src/pages/Settings.tsx` trailing `%` fix).
- [ ] Unit tests pass (`npm test`) including newly added identity/profile/storage/snapshot tests.
- [ ] Manual multi-user verification passes (run through the scenarios in `docs/multiuser-verification.md`) including:
  - Fresh install creates default profile and uses profile-scoped storage
  - Migration copies legacy `CrumbDB` data on Safari/WebKit
  - Switching profiles does not leak recipes/settings
  - Snapshot export/import validates schema and imports correctly
- [ ] Profile switching does not leave open Dexie handles / doesn’t cause stale state.
- [ ] ✅ UI conforms to `docs/design/STRIDELOG_DESIGN_SYSTEM_V1.md` (gradient, spacing, cards, typography, icons).
  - **Note:** This file was not found in the repo during review, so UI conformance cannot be verified or cited by section (§x.y). Please add the doc or update the reference to the correct design system source.

### 7) File-by-file notes

- `docs/multiuser-implementation-summary.md`: Helpful overview, but it contains assertions like “CodeQL 0 alerts” / “all unit tests passing” that should be backed by linked CI artifacts or phrased more cautiously.
- `docs/multiuser-migration-notes.md`: Good inventory + pitfalls; aligns with the repo’s server-first/offline model.
- `docs/multiuser-verification.md`: Very useful manual checklist; ensure it explicitly calls out Safari/iOS behaviors given PWA constraints.

- `src/App.tsx`: Adds DB initialization gate before rendering routes; good for preventing early access to uninitialized `db`. Consider an explicit error state if init fails (currently toasts but remains on “Initializing…”).
- `src/db.ts`: Converts to re-exports/aliases for backward compatibility. Ensure no code relies on Dexie-specific APIs from the old `CrumbDB` class.
- `src/dbWrapper.ts`: Wraps ProfileDB with server-first logic and maintains old API surface via a Proxy `db`. Watch for runtime errors if any code accesses properties before init.
- `src/identity/identity.ts`: Reasonable minimal identity abstraction; note `crypto.randomUUID` fallback is handled here (good).
- `src/identity/identity.test.ts`: Solid basic tests for stability/persistence of identity.
- `src/initDatabase.ts`: Central init flow + profile-specific reinit. Potential resource leak if old ProfileDB instances aren’t closed.
- `src/storage/storageFactory.ts`: Profile-scoped Dexie DB creation looks sensible. Legacy DB detection via `indexedDB.databases()` is a Safari risk.
- `src/storage/storageFactory.test.ts`: Light unit coverage of DB naming/shape. Consider adding a test ensuring names are stable and don’t include unsafe characters if userId formats expand.
- `src/migrations/migrateToMultiUserV1.ts`: Clear migration flow and idempotence flag. Detection relies on `hasLegacyDatabase()` which may under-detect on Safari.
- `src/profile/profileManager.ts`: API is straightforward; biggest concern is dual active-profile sources (`activeUserId` in registry vs separate key), and delete-active guard depending on registry state.
- `src/profile/profileManager.test.ts`: Covers CRUD/active behavior; however, it currently “passes” with the dual-source model. Consider adding a regression test that validates delete-active protection via the same source used by the app runtime.
- `src/pages/Settings.tsx`: Adds profile management and snapshot UI. Blocking: trailing `%`. Also has minor code cleanup opportunities (unused imports, redundant reload strategy).
- `src/sharing/snapshot.ts`: Good separation of export/validate/import; ensure validation stays strict enough to prevent foot-guns.
- `src/sharing/snapshot.test.ts`: Good validation coverage for schema/version errors.
- `src/state/session.ts`: Attempts to make settings per-profile, but storage adapter likely mismatches Zustand persist contract (high risk).
- `src/utils/welcome.ts`: Makes welcome flag per-profile using active profile key; seems aligned with goal.
- `src/types.ts`: Adds profile types; OK.
- `vite.config.d.ts`: Loosens typing (`any`); acceptable as a stopgap but worth fixing properly.


### 8) Concrete suggested edits

**A) Remove trailing `%` in Settings**
```diff
--- a/src/pages/Settings.tsx
+++ b/src/pages/Settings.tsx
@@
-}%
+}
```
Anchors: `src/pages/Settings.tsx:Settings(...)` (~L699–L700)

**B) Fix active profile single source of truth**
Suggested approach: use only `crumbworks.profiles.active` for “active”, and derive everything else from it.
```ts
// deleteProfile should compare against getActiveProfileId(), not registry.activeUserId
const activeId = getActiveProfileId();
if (activeId === userId) throw new Error('Cannot delete the active profile...');
```
Anchors: `src/profile/profileManager.ts:deleteProfile(...)` (~L146–L156)

**C) Implement a correct Zustand persist storage adapter**
Goal: change *key selection*, not JSON encoding.
```ts
// storage.getItem returns string | null
// storage.setItem accepts string
```
Anchors: `src/state/session.ts:useSettings(...)` (~L309–L398)

**D) Avoid Safari-incompatible `indexedDB.databases()` in migration**
Suggested direction: use Dexie-supported methods or attempt open + catch.
Anchors: `src/storage/storageFactory.ts:hasLegacyDatabase(...)` (~L86–L97)

### 9) Most likely future bugs (1–3)

1) **Profiles “share” recipes unexpectedly when online**
- Symptom in production: Switching profiles still shows the same server-synced library.
- Root cause hypothesis: `syncKey` is not correctly persisted/loaded per-profile due to storage adapter mismatch; API calls use default/previous syncKey.
- Guardrails: Add an integration test that switches profiles and asserts different `syncKey` headers are sent; add runtime logging (debug-level) of active profile + syncKey.

2) **Existing iOS Safari users lose legacy recipes after update**
- Symptom in production: After update, library appears empty; legacy data still exists in IndexedDB but migration didn’t run.
- Root cause hypothesis: `indexedDB.databases()` unsupported → `hasLegacyDatabase()` false → recipe migration skipped.
- Guardrails: Add a migration test that simulates legacy DB presence without relying on `indexedDB.databases()`; add a post-migration sanity check (e.g., legacy DB exists and new DB empty ⇒ warn and do not mark migration done).

3) **App gets stuck on “Initializing…”**
- Symptom in production: Users see indefinite loading screen.
- Root cause hypothesis: init throws (e.g., IDB open fails) and UI only shows a toast; state never transitions.
- Guardrails: Add an error UI state with retry; log the error with enough detail and include a “Reset local data” affordance.

### 10) Copy/paste PR reply (final block)

**Decision: Block**

**Risk: High**

**Required actions**
- Remove the stray trailing `%` in `src/pages/Settings.tsx` (currently build-breaking).
- Fix `useSettings` persistence to conform to Zustand `persist` storage contract while still using profile-scoped keys.
- Make legacy migration Safari/WebKit-compatible (avoid `indexedDB.databases()` dependency) to prevent silent data loss.
- Unify active profile state (single source of truth) so deleting the active profile is reliably prevented and init respects the chosen active profile.
- (Process) Add `docs/design/STRIDELOG_DESIGN_SYSTEM_V1.md` or update the review checklist reference so UI conformance can be verified/cited by section.

**Must-verify steps (tests not run in this review)**
- Run unit tests: `npm test`
- Run the app and validate multi-user flows per `docs/multiuser-verification.md` (especially migration on Safari/iOS)
- Verify profile switching isolates both local IndexedDB and server sync scopes (syncKey behavior)
- Verify build/TS: `npm run build` (or CI equivalent)
