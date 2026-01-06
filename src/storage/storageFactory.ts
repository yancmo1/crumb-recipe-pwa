/**
 * Storage factory - creates profile-scoped database instances.
 * 
 * This module centralizes the logic for namespacing storage by userId,
 * ensuring complete data isolation between profiles.
 */

import Dexie, { Table } from 'dexie';
import type { Recipe, CookSession } from '../types';
import type { UserId } from '../identity/identity';

/**
 * Profile-scoped database class.
 * Same schema as the original CrumbDB, but with namespaced database name.
 */
export class ProfileDB extends Dexie {
  recipes!: Table<Recipe>;
  sessions!: Table<CookSession>;

  constructor(userId: UserId) {
    // Namespace database by userId to ensure profile isolation
    super(`crumbworks-${userId}`);
    
    this.version(1).stores({
      recipes: 'id, title, sourceName, sourceUrl, createdAt, updatedAt',
      sessions: 'recipeId, expiresAt'
    });

    this.version(2)
      .stores({
        recipes: 'id, title, category, isFavorite, sourceName, sourceUrl, createdAt, updatedAt',
        sessions: 'recipeId, expiresAt'
      })
      .upgrade(async (tx) => {
        // Ensure existing cached recipes have a boolean favorite flag
        await tx.table('recipes').toCollection().modify((r: any) => {
          if (typeof r.isFavorite !== 'boolean') r.isFavorite = false;
          if (typeof r.category === 'string') {
            const trimmed = r.category.trim();
            r.category = trimmed.length ? trimmed : undefined;
          }
        });
      });
  }
}

/**
 * Factory function to open a profile-scoped store.
 * This is the primary entry point for accessing user data.
 */
export async function openProfileStore(userId: UserId): Promise<ProfileDB> {
  const db = new ProfileDB(userId);
  
  // Ensure DB is open and ready
  await db.open();
  
  return db;
}

/**
 * Get list of all profile databases that exist in IndexedDB.
 * Useful for migration and debugging.
 */
export async function listProfileDatabases(): Promise<string[]> {
  if (!('indexedDB' in window)) {
    return [];
  }
  
  try {
    if (typeof indexedDB.databases !== 'function') {
      // Safari/WebKit: indexedDB.databases() is not reliably available.
      return [];
    }

    const databases = await indexedDB.databases();
    return databases
      .map(db => db.name)
      .filter((name): name is string => {
        return name !== undefined && name.startsWith('crumbworks-');
      });
  } catch (error) {
    console.warn('Failed to list IndexedDB databases:', error);
    return [];
  }
}

/**
 * Check if legacy single-user database exists.
 * Used by migration logic.
 */
export async function hasLegacyDatabase(): Promise<boolean> {
  if (!('indexedDB' in window)) {
    return false;
  }
  
  try {
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      return databases.some(db => db.name === 'CrumbDB');
    }

    // Fallback for Safari/WebKit: probe existence without relying on indexedDB.databases().
    return await probeIndexedDbExists('CrumbDB');
  } catch (error) {
    console.warn('Failed to check for legacy database:', error);
    return false;
  }
}

async function probeIndexedDbExists(name: string): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let didUpgrade = false;
    let request: IDBOpenDBRequest | null = null;

    try {
      request = indexedDB.open(name);
    } catch {
      resolve(false);
      return;
    }

    request.onupgradeneeded = () => {
      // If onupgradeneeded fires with oldVersion=0, the DB didn't exist.
      // Abort to avoid creating a new DB just for detection.
      didUpgrade = true;
      try {
        request?.transaction?.abort();
      } catch {
        // ignore
      }
    };

    request.onsuccess = () => {
      try {
        request?.result?.close();
      } catch {
        // ignore
      }

      // If we accidentally created something (implementation-dependent), clean it up.
      if (didUpgrade) {
        try {
          indexedDB.deleteDatabase(name);
        } catch {
          // ignore
        }
        resolve(false);
        return;
      }

      resolve(true);
    };

    request.onerror = () => {
      // If we aborted an upgrade transaction, treat as "did not exist".
      if (didUpgrade) {
        try {
          indexedDB.deleteDatabase(name);
        } catch {
          // ignore
        }
        resolve(false);
        return;
      }

      resolve(false);
    };

    request.onblocked = () => {
      resolve(false);
    };
  });
}

/**
 * Open the legacy single-user database for migration.
 * Returns null if it doesn't exist.
 */
export async function openLegacyDatabase(): Promise<Dexie | null> {
  if (!(await hasLegacyDatabase())) {
    return null;
  }
  
  const legacyDb = new Dexie('CrumbDB');
  
  // Define schema for legacy DB (version 2 was the last)
  legacyDb.version(2).stores({
    recipes: 'id, title, category, isFavorite, sourceName, sourceUrl, createdAt, updatedAt',
    sessions: 'recipeId, expiresAt'
  });
  
  try {
    await legacyDb.open();
    return legacyDb;
  } catch (error) {
    console.error('Failed to open legacy database:', error);
    return null;
  }
}
