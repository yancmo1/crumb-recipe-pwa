/**
 * Snapshot export/import for profile data sharing.
 * 
 * Level 1 sharing: local export/import of recipe data via JSON files.
 * No server involvement - pure client-side data portability.
 */

import type { Recipe, CookSession } from '../types';
import type { ProfileDB } from '../storage/storageFactory';

const SNAPSHOT_VERSION = 1;

/**
 * Snapshot format for exporting profile data
 */
export type Snapshot = {
  version: number;
  appVersion: string;
  exportedAt: number;
  exportedBy?: string; // userId (optional, for reference)
  payload: {
    recipes: Recipe[];
    sessions?: CookSession[]; // Optional: active cook sessions
  };
};

/**
 * Validation result
 */
type ValidationResult = 
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Import mode
 */
export type ImportMode = 'merge' | 'replace';

/**
 * Export a snapshot of the current profile's data
 */
export async function exportSnapshot(
  db: ProfileDB,
  options?: {
    includeSessions?: boolean;
    userId?: string;
  }
): Promise<Snapshot> {
  const { includeSessions = false, userId } = options || {};

  try {
    // Get all recipes
    const recipes = await db.recipes.toArray();

    // Optionally get sessions
    let sessions: CookSession[] | undefined;
    if (includeSessions) {
      sessions = await db.sessions.toArray();
      // Filter out expired sessions
      const now = Date.now();
      sessions = sessions.filter(s => s.expiresAt > now);
    }

    const snapshot: Snapshot = {
      version: SNAPSHOT_VERSION,
      appVersion: '1.0.0', // Could read from package.json
      exportedAt: Date.now(),
      exportedBy: userId,
      payload: {
        recipes,
        sessions
      }
    };

    return snapshot;
  } catch (error) {
    console.error('Failed to export snapshot:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate a snapshot before import
 */
export function validateSnapshot(snapshot: unknown): ValidationResult {
  const errors: string[] = [];

  // Check if snapshot is an object
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['Snapshot must be an object'] };
  }

  const snap = snapshot as Record<string, unknown>;

  // Check version
  if (typeof snap.version !== 'number') {
    errors.push('Missing or invalid version field');
  } else if (snap.version !== SNAPSHOT_VERSION) {
    errors.push(`Unsupported snapshot version: ${snap.version} (expected ${SNAPSHOT_VERSION})`);
  }

  // Check exportedAt
  if (typeof snap.exportedAt !== 'number') {
    errors.push('Missing or invalid exportedAt field');
  }

  // Check payload
  if (!snap.payload || typeof snap.payload !== 'object') {
    errors.push('Missing or invalid payload field');
  } else {
    const payload = snap.payload as Record<string, unknown>;

    // Check recipes
    if (!Array.isArray(payload.recipes)) {
      errors.push('Payload.recipes must be an array');
    } else {
      // Validate each recipe has required fields
      payload.recipes.forEach((recipe: unknown, idx: number) => {
        if (!recipe || typeof recipe !== 'object') {
          errors.push(`Recipe at index ${idx} is not an object`);
          return;
        }
        const r = recipe as Record<string, unknown>;
        if (typeof r.id !== 'string') {
          errors.push(`Recipe at index ${idx} missing id field`);
        }
        if (typeof r.title !== 'string') {
          errors.push(`Recipe at index ${idx} missing title field`);
        }
        if (!Array.isArray(r.ingredients)) {
          errors.push(`Recipe at index ${idx} missing ingredients array`);
        }
        if (!Array.isArray(r.steps)) {
          errors.push(`Recipe at index ${idx} missing steps array`);
        }
      });
    }

    // Check sessions (optional)
    if (payload.sessions !== undefined && !Array.isArray(payload.sessions)) {
      errors.push('Payload.sessions must be an array if provided');
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Import a snapshot into the current profile
 */
export async function importSnapshot(
  db: ProfileDB,
  snapshot: Snapshot,
  mode: ImportMode = 'merge'
): Promise<{ imported: number; skipped: number }> {
  // Validate snapshot
  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    throw new Error(`Invalid snapshot: ${validation.errors.join(', ')}`);
  }

  try {
    let imported = 0;
    let skipped = 0;

    // Handle replace mode
    if (mode === 'replace') {
      console.log('Replace mode: clearing existing data...');
      await db.recipes.clear();
      await db.sessions.clear();
    }

    // Import recipes
    const { recipes, sessions } = snapshot.payload;

    if (mode === 'merge') {
      // In merge mode, import each recipe individually to avoid overwriting
      // existing recipes with the same ID
      for (const recipe of recipes) {
        const existing = await db.recipes.get(recipe.id);
        if (existing) {
          console.log(`Skipping recipe ${recipe.id} (already exists)`);
          skipped++;
        } else {
          await db.recipes.put(recipe);
          imported++;
        }
      }
    } else {
      // In replace mode, bulk import
      await db.recipes.bulkPut(recipes);
      imported = recipes.length;
    }

    // Import sessions (if present)
    if (sessions && sessions.length > 0) {
      // Filter out expired sessions
      const now = Date.now();
      const validSessions = sessions.filter(s => s.expiresAt > now);

      if (mode === 'merge') {
        for (const session of validSessions) {
          const existing = await db.sessions.get(session.recipeId);
          if (!existing) {
            await db.sessions.put(session);
          }
        }
      } else {
        await db.sessions.bulkPut(validSessions);
      }
    }

    console.log(`✓ Import complete: ${imported} recipes imported, ${skipped} skipped`);
    return { imported, skipped };
  } catch (error) {
    console.error('Failed to import snapshot:', error);
    throw new Error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Download a snapshot as a JSON file
 */
export function downloadSnapshot(snapshot: Snapshot, filename?: string): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `crumbworks-snapshot-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Parse a snapshot from a file
 */
export async function parseSnapshotFile(file: File): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        const validation = validateSnapshot(parsed);
        if (!validation.valid) {
          reject(new Error(`Invalid snapshot file: ${validation.errors.join(', ')}`));
          return;
        }

        resolve(parsed as Snapshot);
      } catch (error) {
        reject(new Error(`Failed to parse snapshot file: ${error instanceof Error ? error.message : String(error)}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
