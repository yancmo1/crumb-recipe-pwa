import { describe, expect, it, beforeEach } from 'vitest';
import {
  listProfiles,
  getActiveProfile,
  createProfile,
  setActiveProfile,
  updateProfileLabel,
  deleteProfile,
  getProfile
} from '../profile/profileManager';

describe('Profile Manager', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('starts with empty profile list', () => {
    const profiles = listProfiles();
    expect(profiles).toEqual([]);
  });

  it('creates a new profile', () => {
    const profile = createProfile('local:test-123', 'Test Profile');
    
    expect(profile.userId).toBe('local:test-123');
    expect(profile.label).toBe('Test Profile');
    expect(profile.createdAt).toBeGreaterThan(0);
  });

  it('lists created profiles', () => {
    createProfile('local:test-1', 'Profile 1');
    createProfile('local:test-2', 'Profile 2');
    
    const profiles = listProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].label).toBe('Profile 1');
    expect(profiles[1].label).toBe('Profile 2');
  });

  it('prevents duplicate profile creation', () => {
    const profile1 = createProfile('local:test-123', 'First');
    const profile2 = createProfile('local:test-123', 'Second');
    
    expect(profile1).toBe(profile2);
    expect(listProfiles()).toHaveLength(1);
  });

  it('sets and gets active profile', () => {
    createProfile('local:test-1', 'Profile 1');
    createProfile('local:test-2', 'Profile 2');
    
    setActiveProfile('local:test-1');
    expect(getActiveProfile()?.userId).toBe('local:test-1');
    
    setActiveProfile('local:test-2');
    expect(getActiveProfile()?.userId).toBe('local:test-2');
  });

  it('throws error when setting non-existent profile as active', () => {
    expect(() => {
      setActiveProfile('local:nonexistent');
    }).toThrow('Profile not found');
  });

  it('updates profile label', () => {
    createProfile('local:test-123', 'Old Label');
    updateProfileLabel('local:test-123', 'New Label');
    
    const profile = getProfile('local:test-123');
    expect(profile?.label).toBe('New Label');
  });

  it('deletes non-active profile', () => {
    createProfile('local:test-1', 'Profile 1');
    createProfile('local:test-2', 'Profile 2');
    setActiveProfile('local:test-1');
    
    deleteProfile('local:test-2');
    
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].userId).toBe('local:test-1');
  });

  it('prevents deleting active profile', () => {
    createProfile('local:test-1', 'Profile 1');
    setActiveProfile('local:test-1');
    
    expect(() => {
      deleteProfile('local:test-1');
    }).toThrow('Cannot delete the active profile');
  });

  it('generates default label when not provided', () => {
    const profile1 = createProfile('local:test-1');
    const profile2 = createProfile('local:test-2');
    
    expect(profile1.label).toBe('Profile 1');
    expect(profile2.label).toBe('Profile 2');
  });

  it('persists profiles to localStorage', () => {
    createProfile('local:test-123', 'Test Profile');
    
    const stored = localStorage.getItem('crumbworks.profiles.registry');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed.profiles).toHaveLength(1);
    expect(parsed.profiles[0].label).toBe('Test Profile');
  });

  it('persists active profile to localStorage', () => {
    createProfile('local:test-123', 'Test Profile');
    setActiveProfile('local:test-123');
    
    const activeId = localStorage.getItem('crumbworks.profiles.active');
    expect(activeId).toBe('local:test-123');
  });
});
