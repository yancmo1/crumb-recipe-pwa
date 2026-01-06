/**
 * Backward compatibility re-exports.
 * 
 * The database layer has been refactored to support multi-user profiles.
 * This file maintains backward compatibility by re-exporting the new API.
 * 
 * Legacy code can continue to use `import { db } from './db'`
 * New code should use `import { getDb } from './dbWrapper'`
 */

export { db, getDb, CrumbDBWrapper } from './dbWrapper';
export { ProfileDB } from './storage/storageFactory';

// Keep legacy CrumbDB name as alias
export { CrumbDBWrapper as CrumbDB } from './dbWrapper';