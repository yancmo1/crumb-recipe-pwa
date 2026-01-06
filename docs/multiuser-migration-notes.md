# Multi-User Migration Notes

## Current Storage Architecture (Single-User)

### IndexedDB Storage
**Database Name**: `CrumbDB` (hardcoded singleton)

**Tables**:
1. **recipes** 
   - Primary key: `id`
   - Indices: `id, title, category, isFavorite, sourceName, sourceUrl, createdAt, updatedAt`
   - Contains: Recipe objects with ingredients, steps, metadata
   - Current version: 2 (with schema migration for isFavorite and category)

2. **sessions**
   - Primary key: `recipeId`
   - Indices: `recipeId, expiresAt`
   - Contains: CookSession objects (ephemeral state for active cooking)
   - Fields: checkedIngredients, checkedSteps, multiplier, expiresAt

**Access Pattern**: Server-first with local cache fallback
- All operations try server API first (`/api/recipes/*`)
- On server failure, fall back to IndexedDB cache
- Background sync updates cache after successful server calls

### localStorage Storage

**Keys Used**:
1. `crumb-settings` - Zustand persist storage
   - theme, keepSessionsOnClose, autoExtendSessions, preferGrams
   - syncKey, apiBaseUrl, conversionOverrides
   
2. `crumb_hasSeenWelcome_v1` - Welcome screen flag (value: "1")

3. `crumbClientId` - Push notification client identifier (UUID)

### Singleton Assumptions

**Hard Dependencies**:
1. `src/db.ts` - Creates single `CrumbDB` instance exported as `db`
2. Database name "CrumbDB" is hardcoded in constructor
3. All components import and use the singleton `db` instance
4. No concept of user isolation or data scoping

**Usage Locations**:
- `src/state/session.ts` - Zustand stores import `db` directly
- `src/App.tsx` - Initial recipe load via `useRecipeStore`
- All page components use Zustand stores which wrap `db` calls

## Migration Strategy

### Namespacing Approach

**IndexedDB**:
- Old: `CrumbDB`
- New: `crumbworks-${userId}` (e.g., `crumbworks-local:abc-123-def`)
- Ensures complete database isolation per profile

**localStorage**:
- Old: `crumb-settings`, `crumb_hasSeenWelcome_v1`
- New: Prefix with userId for profile-specific data
  - `crumbworks:${userId}:settings`
  - `crumbworks:${userId}:welcomeSeen`
- Keep global keys for: `crumbworks.identity.userId`, `crumbworks.profiles.registry`, `crumbworks.profiles.active`

### Migration Path

1. **Identity Bootstrap**:
   - On first app load, check for `crumbworks.identity.userId`
   - If missing, generate `local:<uuid>` and store it
   - This becomes the default profile for existing users

2. **Legacy Data Detection**:
   - Check for existence of "CrumbDB" IndexedDB database
   - Check for "crumb-settings" localStorage key
   - If found, migration needed

3. **Data Migration**:
   - Copy all records from `CrumbDB.recipes` → new `crumbworks-${userId}.recipes`
   - Copy all records from `CrumbDB.sessions` → new `crumbworks-${userId}.sessions`
   - Copy `localStorage['crumb-settings']` → `localStorage['crumbworks:${userId}:settings']`
   - Copy welcome flag to namespaced key
   - Set migration complete flag: `crumbworks.migrations.multiuser.v1 = "done"`
   - Keep legacy DB intact (for rollback safety)

4. **Profile Registry**:
   - Create initial profile registry in `crumbworks.profiles.registry`
   - Add default profile: `{ userId: <generated-id>, label: "My Profile", createdAt: <now> }`
   - Set active profile: `crumbworks.profiles.active = <generated-id>`

## Potential Pitfalls

1. **Race Conditions**:
   - Migration must complete before any db operations
   - Need synchronous check or blocking promise

2. **Push Notification Client ID**:
   - `crumbClientId` is currently global
   - Should remain global (device-level, not profile-level)
   - Multiple profiles on same device should share push subscription

3. **Service Worker Cache**:
   - SW caches are origin-scoped, not profile-scoped
   - No changes needed to SW behavior
   - Recipe data cached in IndexedDB is already profile-isolated

4. **Server API Implications**:
   - Current server stores recipes in Postgres
   - No user concept on server currently
   - Keep server as optional sync layer
   - Profile switching doesn't affect server state

5. **Settings Migration**:
   - Existing users have settings in `crumb-settings`
   - Must migrate to namespaced key for default profile
   - New profiles start with default settings

6. **Zustand Persist**:
   - Current settings store uses Zustand persist middleware
   - Must update storage key to be profile-aware
   - Settings store needs to reinitialize on profile switch

## Implementation Order

1. Identity layer (non-breaking)
2. Storage factory (non-breaking, new API)
3. Migration logic (runs once, preserves old data)
4. Refactor db usage to factory pattern
5. Profile manager (new feature)
6. UI for profile switching
7. Snapshot export/import (new feature)

## Rollback Strategy

- Keep legacy `CrumbDB` database intact
- Migration flag prevents re-running
- If issues arise, user can clear site data to reset
- Code can fall back to legacy mode if migration flag not set
