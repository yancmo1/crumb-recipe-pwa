# Multi-User Verification Checklist

This document outlines the test scenarios that must pass to verify the multi-user refactor is working correctly.

## Test Environment Setup

1. Clear browser storage (IndexedDB, localStorage, sessionStorage)
2. Open browser DevTools > Application tab to monitor storage
3. Have 2-3 test recipe URLs ready for import

## Verification Scenarios

### 1. Fresh Install (No Legacy Data)

**Goal**: Verify new users get a clean multi-user experience

**Steps**:
1. Clear all browser data
2. Open the app
3. Verify initialization logs show:
   - "Initializing multi-user database..."
   - "User identity resolved: local:<uuid>"
   - "No legacy data found, this is a fresh install"
   - "Multi-user migration marked complete"
   - "Opened profile database: crumbworks-local:<uuid>"
4. Navigate to Settings
5. Verify "Profile Management" section shows:
   - Current Profile: "My Profile"
   - No other profiles listed
6. Import or create a recipe
7. Verify recipe appears in Library

**Expected Result**: ✅ Clean initialization without errors, single default profile created

---

### 2. Legacy Migration (Existing Single-User Data)

**Goal**: Verify existing users' data is preserved after refactor

**Setup**:
1. Clear all browser data
2. Create legacy data:
   - In DevTools Console, run:
     ```javascript
     localStorage.setItem('crumb-settings', '{"theme":"dark","preferGrams":true}');
     localStorage.setItem('crumb_hasSeenWelcome_v1', '1');
     ```
   - Create a legacy IndexedDB named "CrumbDB" with some recipes (or use app in single-user mode first)

**Steps**:
1. Reload the app
2. Verify initialization logs show:
   - "Starting multi-user migration..."
   - "Migrated X recipes"
   - "Migrated settings to crumbworks:<userId>:settings"
   - "Multi-user migration complete!"
3. Navigate to Library
4. Verify all legacy recipes are present
5. Navigate to Settings
6. Verify settings (theme, preferGrams) were preserved
7. Verify "My Profile" was created as default profile

**Expected Result**: ✅ All legacy data migrated to default profile, no data loss

---

### 3. Profile Isolation

**Goal**: Verify recipes and settings are isolated between profiles

**Steps**:
1. Start with a profile that has 3 recipes (Profile A)
2. Note the recipe titles
3. Go to Settings > Profile Management
4. Create a new profile: "Profile B"
5. Switch to "Profile B"
6. After page reload, go to Library
7. Verify Library is empty (no recipes from Profile A)
8. Import or create 2 different recipes
9. Verify these 2 recipes appear
10. Go to Settings
11. Change theme to "dark" and preferGrams to false
12. Switch back to "Profile A"
13. After reload, verify:
    - Library shows original 3 recipes (not Profile B's 2)
    - Settings show original values (not Profile B's changes)

**Expected Result**: ✅ Complete data isolation between profiles

---

### 4. Profile Switching Persistence

**Goal**: Verify active profile persists across sessions

**Steps**:
1. Have 2 profiles: "Profile A" (active) and "Profile B"
2. Switch to "Profile B"
3. After reload, add a recipe to Profile B
4. Close browser completely
5. Reopen browser and navigate to app
6. Verify Profile B is still active
7. Verify Library shows Profile B's recipes

**Expected Result**: ✅ Active profile remembered across sessions

---

### 5. Snapshot Export

**Goal**: Verify snapshot export creates valid JSON

**Steps**:
1. Ensure current profile has 3-5 recipes
2. Go to Settings > Data Management
3. Click "Export Snapshot"
4. Verify file downloads: `crumbworks-<profile-name>-<timestamp>.json`
5. Open file in text editor
6. Verify JSON structure:
   ```json
   {
     "version": 1,
     "appVersion": "1.0.0",
     "exportedAt": <timestamp>,
     "exportedBy": "<userId>",
     "payload": {
       "recipes": [ ... ]
     }
   }
   ```
7. Verify all recipes are present in payload
8. Verify each recipe has required fields: id, title, ingredients, steps

**Expected Result**: ✅ Valid snapshot file with all recipe data

---

### 6. Snapshot Import (Merge Mode)

**Goal**: Verify snapshot import merges without duplicates

**Steps**:
1. Create Profile A with 3 recipes (IDs: R1, R2, R3)
2. Export snapshot of Profile A
3. Create Profile B (empty)
4. Switch to Profile B
5. Go to Settings > Data Management
6. Import the snapshot from Profile A
7. Verify toast shows "Imported 3 recipes! (0 skipped)"
8. Verify Library shows 3 recipes
9. Add 1 new recipe to Profile B (ID: R4)
10. Export snapshot of Profile B (should have R1, R2, R3, R4)
11. Import the same Profile B snapshot again
12. Verify toast shows "Imported 0 recipes! (4 skipped)"
13. Verify Library still shows 4 recipes (no duplicates)

**Expected Result**: ✅ Import merges data, skips duplicates by ID

---

### 7. Snapshot Import (Invalid File)

**Goal**: Verify import rejects invalid snapshots

**Steps**:
1. Create a text file with invalid JSON:
   ```
   { "invalid": "data" }
   ```
2. Go to Settings > Data Management
3. Try to import this file
4. Verify error toast appears: "Invalid snapshot file: ..."
5. Verify no data was imported
6. Create a file with wrong version:
   ```json
   { "version": 999, "payload": { "recipes": [] } }
   ```
7. Try to import
8. Verify error toast about unsupported version

**Expected Result**: ✅ Invalid snapshots rejected gracefully

---

### 8. Profile Creation and Deletion

**Goal**: Verify profile lifecycle management

**Steps**:
1. Go to Settings > Profile Management
2. Create 3 new profiles: "Test1", "Test2", "Test3"
3. Verify all 3 appear in profile list
4. Try to delete the active profile
5. Verify error message: "Cannot delete the active profile..."
6. Switch to "Test1"
7. Delete "Test2" profile
8. Verify "Test2" removed from list
9. Verify "Test1" still active
10. Switch to "My Profile" (default)
11. Verify "Test1" and "Test3" still in list

**Expected Result**: ✅ Profiles created/deleted correctly, cannot delete active profile

---

### 9. Welcome Screen Profile Isolation

**Goal**: Verify welcome screen is tracked per-profile

**Steps**:
1. Clear all browser data
2. Open app, should see welcome/home screen
3. Dismiss welcome, verify redirected to Library
4. Create new profile "Profile B"
5. Switch to "Profile B"
6. After reload, verify welcome screen appears again
7. Dismiss welcome for Profile B
8. Switch back to "My Profile"
9. Verify NO welcome screen (already dismissed for this profile)
10. Switch to "Profile B" again
11. Verify NO welcome screen (already dismissed for this profile too)

**Expected Result**: ✅ Welcome state tracked per profile

---

### 10. Settings Isolation

**Goal**: Verify settings are profile-scoped

**Steps**:
1. Profile A: Set theme=dark, preferGrams=true
2. Add conversion override: "flour" cup → 120g
3. Create and switch to Profile B
4. Verify settings reset to defaults: theme=light, preferGrams=true (default)
5. Verify conversion overrides are empty
6. Set theme=system for Profile B
7. Add different override: "sugar" cup → 200g
8. Switch back to Profile A
9. Verify theme=dark, preferGrams=true
10. Verify flour override still present, sugar override NOT present

**Expected Result**: ✅ Complete settings isolation between profiles

---

### 11. Offline Behavior

**Goal**: Verify profiles work offline

**Steps**:
1. With Profile A active and 3 recipes cached
2. Open DevTools Network tab
3. Throttle to "Offline"
4. Reload app
5. Verify initialization completes
6. Verify console shows: "⚠ Server unavailable - using offline cache"
7. Navigate to Library
8. Verify 3 recipes still appear (from IndexedDB cache)
9. Try to create new profile
10. Verify it works (localStorage operations)
11. Switch profiles
12. Verify switch works offline

**Expected Result**: ✅ Multi-user system fully functional offline

---

### 12. IndexedDB Database Naming

**Goal**: Verify database isolation at IndexedDB level

**Steps**:
1. Create 3 profiles and switch between them
2. Open DevTools > Application > IndexedDB
3. Verify databases exist:
   - `crumbworks-local:<uuid1>` (Profile A)
   - `crumbworks-local:<uuid2>` (Profile B)
   - `crumbworks-local:<uuid3>` (Profile C)
4. Expand each database
5. Verify each has `recipes` and `sessions` object stores
6. Verify each has different data

**Expected Result**: ✅ Separate IndexedDB databases per profile

---

### 13. localStorage Namespacing

**Goal**: Verify localStorage keys are properly namespaced

**Steps**:
1. Open DevTools > Application > Local Storage
2. After having 2 profiles, verify keys:
   - `crumbworks.identity.userId` (global - user's identity)
   - `crumbworks.profiles.registry` (global - list of profiles)
   - `crumbworks.profiles.active` (global - active profile ID)
   - `crumbworks.migrations.multiuser.v1` (global - migration flag)
   - `crumbworks:<userId1>:settings` (per-profile)
   - `crumbworks:<userId2>:settings` (per-profile)
   - `crumbworks:<userId1>:welcomeSeen` (per-profile, if welcome dismissed)
   - `crumbClientId` (global - push notification client, unchanged)
3. Verify legacy keys still present (for safety):
   - `crumb-settings` (original, not used)
   - `crumb_hasSeenWelcome_v1` (original, not used)

**Expected Result**: ✅ Proper namespacing, global and per-profile keys correct

---

### 14. Server Sync with Profiles

**Goal**: Verify server sync respects profile boundaries

**Setup**: Requires running server

**Steps**:
1. Profile A: Create recipe R1, verify synced to server
2. Profile B: Create recipe R2, verify synced to server
3. Clear Profile A's IndexedDB only (keep Profile B)
4. Reload app, switch to Profile A
5. Verify Recipe R1 reappears (fetched from server)
6. Switch to Profile B
7. Verify Recipe R2 still present
8. Verify Recipe R1 NOT present in Profile B

**Expected Result**: ✅ Server sync works, but data isolation maintained locally

---

## Test Summary Template

After running all tests, fill out:

```
✅ / ❌  Test 1: Fresh Install
✅ / ❌  Test 2: Legacy Migration
✅ / ❌  Test 3: Profile Isolation
✅ / ❌  Test 4: Profile Switching Persistence
✅ / ❌  Test 5: Snapshot Export
✅ / ❌  Test 6: Snapshot Import (Merge)
✅ / ❌  Test 7: Snapshot Import (Invalid)
✅ / ❌  Test 8: Profile Creation and Deletion
✅ / ❌  Test 9: Welcome Screen Profile Isolation
✅ / ❌  Test 10: Settings Isolation
✅ / ❌  Test 11: Offline Behavior
✅ / ❌  Test 12: IndexedDB Database Naming
✅ / ❌  Test 13: localStorage Namespacing
✅ / ❌  Test 14: Server Sync with Profiles

Overall Pass Rate: __/14 (___%)
```

## Known Limitations

1. **Server-side**: The server currently has no concept of users or profiles. All clients share the same server data. This is intentional - local profiles are for client-side organization only.

2. **Push Notifications**: The `crumbClientId` remains global (device-level), not per-profile. All profiles on the same device share the same push subscription.

3. **No Cloud Backup**: Profile data is purely local. Users must manually export/import snapshots to transfer data between devices or backup.

4. **Profile Deletion**: Deleting a profile from the registry does NOT delete its IndexedDB database. The data remains until manually cleared via browser settings.
