import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolveCurrentUserId, _clearIdentity } from '../identity/identity';

describe('Identity Module', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    _clearIdentity();
  });

  afterEach(() => {
    localStorage.clear();
    _clearIdentity();
  });

  it('generates a stable userId on first call', async () => {
    const userId1 = await resolveCurrentUserId();
    expect(userId1).toMatch(/^local:/);
    expect(userId1.length).toBeGreaterThan(10);

    const userId2 = await resolveCurrentUserId();
    expect(userId2).toBe(userId1);
  });

  it('persists userId in localStorage', async () => {
    const userId = await resolveCurrentUserId();
    
    const stored = localStorage.getItem('crumbworks.identity.userId');
    expect(stored).toBe(userId);
  });

  it('reuses existing userId from localStorage', async () => {
    const existingId = 'local:test-123-abc';
    localStorage.setItem('crumbworks.identity.userId', existingId);
    
    const userId = await resolveCurrentUserId();
    expect(userId).toBe(existingId);
  });

  it('generates different IDs for different instances', async () => {
    _clearIdentity();
    const userId1 = await resolveCurrentUserId();
    
    _clearIdentity();
    localStorage.clear();
    const userId2 = await resolveCurrentUserId();
    
    expect(userId1).not.toBe(userId2);
  });
});
