/**
 * Migration from single-user to multi-user architecture.
 * 
 * This migration runs once on app startup to:
 * 1. Detect legacy "CrumbDB" database
 * 2. Copy all data to the default user profile
 * 3. Migrate localStorage settings
 * 4. Mark migration complete
 */

import Dexie from 'dexie';
import type { UserId } from '../identity/identity';
import type { Recipe, CookSession } from '../types';
import { openLegacyDatabase, hasLegacyDatabase } from '../storage/storageFactory';
import { openProfileStore } from '../storage/storageFactory';

const MIGRATION_FLAG_KEY = 'crumbworks.migrations.multiuser.v1';
const LEGACY_SETTINGS_KEY = 'crumb-settings';
const LEGACY_WELCOME_KEY = 'crumb_hasSeenWelcome_v1';

/**
 * Check if migration has already been completed
 */
export function isMigrationComplete(): boolean {
  try {
    return localStorage.getItem(MIGRATION_FLAG_KEY) === 'done';
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete
 */
function markMigrationComplete(): void {
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
    console.log('✓ Multi-user migration marked complete');
  } catch (error) {
    console.error('Failed to mark migration complete:', error);
  }
}

/**
 * Migrate localStorage settings from legacy keys to profile-scoped keys
 */
async function migrateLocalStorageSettings(userId: UserId): Promise<void> {
  try {
    // Migrate settings
    const legacySettings = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (legacySettings) {
      const newKey = `crumbworks:${userId}:settings`;
      localStorage.setItem(newKey, legacySettings);
      console.log(`✓ Migrated settings to ${newKey}`);
      
      // Keep legacy settings for safety (don't delete)
    }
    
    // Migrate welcome flag
    const legacyWelcome = localStorage.getItem(LEGACY_WELCOME_KEY);
    if (legacyWelcome) {
      const newKey = `crumbworks:${userId}:welcomeSeen`;
      localStorage.setItem(newKey, legacyWelcome);
      console.log(`✓ Migrated welcome flag to ${newKey}`);
    }
  } catch (error) {
    console.error('Failed to migrate localStorage settings:', error);
    throw error;
  }
}

/**
 * Migrate data from legacy CrumbDB to new profile-scoped database
 */
async function migrateDatabaseData(userId: UserId): Promise<number> {
  const legacyDb = await openLegacyDatabase();
  
  if (!legacyDb) {
    console.log('No legacy database found, skipping data migration');
    return 0;
  }
  
  try {
    const profileDb = await openProfileStore(userId);
    let migratedCount = 0;
    
    // Migrate recipes
    const recipes = await (legacyDb.table('recipes') as Dexie.Table<Recipe>).toArray();
    if (recipes.length > 0) {
      await profileDb.recipes.bulkPut(recipes);
      migratedCount += recipes.length;
      console.log(`✓ Migrated ${recipes.length} recipes`);
    }
    
    // Migrate sessions
    const sessions = await (legacyDb.table('sessions') as Dexie.Table<CookSession>).toArray();
    if (sessions.length > 0) {
      // Filter out expired sessions during migration
      const now = Date.now();
      const activeSessions = sessions.filter(s => s.expiresAt > now);
      
      if (activeSessions.length > 0) {
        await profileDb.sessions.bulkPut(activeSessions);
        migratedCount += activeSessions.length;
        console.log(`✓ Migrated ${activeSessions.length} active sessions (${sessions.length - activeSessions.length} expired sessions skipped)`);
      }
    }
    
    // Close databases
    profileDb.close();
    legacyDb.close();
    
    return migratedCount;
  } catch (error) {
    console.error('Failed to migrate database data:', error);
    legacyDb?.close();
    throw error;
  }
}

/**
 * Run the complete migration process.
 * This should be called during app initialization, before any data access.
 */
export async function migrateToMultiUserV1(userId: UserId): Promise<void> {
  // Check if migration already completed
  if (isMigrationComplete()) {
    console.log('Multi-user migration already complete, skipping');
    return;
  }
  
  console.log('Starting multi-user migration...');
  
  try {
    // Check if there's anything to migrate
    const hasLegacy = await hasLegacyDatabase();
    const hasLegacySettings = !!localStorage.getItem(LEGACY_SETTINGS_KEY);
    
    if (!hasLegacy && !hasLegacySettings) {
      console.log('No legacy data found, this is a fresh install');
      markMigrationComplete();
      return;
    }
    
    // Migrate localStorage settings
    await migrateLocalStorageSettings(userId);
    
    // Migrate database data
    const migratedCount = await migrateDatabaseData(userId);
    
    // Mark migration complete
    markMigrationComplete();
    
    console.log(`✓ Multi-user migration complete! Migrated ${migratedCount} records.`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * For testing: reset migration state
 * @internal
 */
export function _resetMigration(): void {
  try {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  } catch {
    // Ignore errors
  }
}
