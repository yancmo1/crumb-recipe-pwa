/**
 * Database initialization for multi-user support.
 * 
 * This module orchestrates:
 * 1. Identity resolution
 * 2. Profile setup
 * 3. Migration from single-user
 * 4. Database instantiation
 */

import { resolveCurrentUserId } from './identity/identity';
import { ensureDefaultProfile, getActiveProfileId } from './profile/profileManager';
import { migrateToMultiUserV1 } from './migrations/migrateToMultiUserV1';
import { openProfileStore } from './storage/storageFactory';
import { CrumbDBWrapper, setGlobalDb } from './dbWrapper';

let initPromise: Promise<CrumbDBWrapper> | null = null;

/**
 * Initialize the database system with multi-user support.
 * This should be called once during app startup.
 * 
 * @returns Promise that resolves to the initialized database wrapper
 */
export async function initializeDatabase(): Promise<CrumbDBWrapper> {
  // Return existing initialization promise if already in progress
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('Initializing multi-user database...');

      // Step 1: Resolve current user identity
      const userId = await resolveCurrentUserId();
      console.log(`✓ User identity resolved: ${userId}`);

      // Step 2: Run migration if needed (before opening any profile DB)
      await migrateToMultiUserV1(userId);

      // Step 3: Ensure profile exists in registry
      ensureDefaultProfile(userId);

      // Step 4: Determine which profile to use (support future profile switching)
      const activeUserId = getActiveProfileId() || userId;

      // Step 5: Open profile-scoped database
      const profileDb = await openProfileStore(activeUserId);
      console.log(`✓ Opened profile database: crumbworks-${activeUserId}`);

      // Step 6: Create wrapper with server-first logic
      const dbWrapper = new CrumbDBWrapper(profileDb);

      // Step 7: Set as global instance
      setGlobalDb(dbWrapper);

      console.log('✓ Multi-user database initialized');
      return dbWrapper;
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Get the current database instance (must be initialized first)
 */
export { getDb } from './dbWrapper';

/**
 * Re-initialize database for a different profile.
 * Used when switching profiles.
 */
export async function reinitializeForProfile(userId: string): Promise<CrumbDBWrapper> {
  console.log(`Re-initializing database for profile: ${userId}`);
  
  // Clear existing initialization
  initPromise = null;
  
  // Open new profile database
  const profileDb = await openProfileStore(userId);
  const dbWrapper = new CrumbDBWrapper(profileDb);
  setGlobalDb(dbWrapper);
  
  console.log(`✓ Re-initialized for profile: ${userId}`);
  return dbWrapper;
}
