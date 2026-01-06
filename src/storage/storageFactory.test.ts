import { describe, expect, it } from 'vitest';
import { ProfileDB } from '../storage/storageFactory';

describe('Storage Factory', () => {
  it('creates ProfileDB with namespaced database name', () => {
    const userId = 'local:test-123';
    const db = new ProfileDB(userId);
    
    expect(db.name).toBe('crumbworks-local:test-123');
  });

  it('creates separate databases for different userIds', () => {
    const db1 = new ProfileDB('local:user-1');
    const db2 = new ProfileDB('local:user-2');
    
    expect(db1.name).not.toBe(db2.name);
    expect(db1.name).toBe('crumbworks-local:user-1');
    expect(db2.name).toBe('crumbworks-local:user-2');
  });

  it('has recipes and sessions tables', () => {
    const db = new ProfileDB('local:test-123');
    
    expect(db.recipes).toBeDefined();
    expect(db.sessions).toBeDefined();
  });
});
