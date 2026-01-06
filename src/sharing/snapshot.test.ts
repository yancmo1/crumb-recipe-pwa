import { describe, expect, it } from 'vitest';
import { validateSnapshot } from '../sharing/snapshot';
import type { Snapshot } from '../sharing/snapshot';

describe('Snapshot Validation', () => {
  it('validates a correct snapshot', () => {
    const snapshot: Snapshot = {
      version: 1,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      exportedBy: 'local:test-123',
      payload: {
        recipes: [
          {
            id: 'recipe-1',
            title: 'Test Recipe',
            sourceUrl: 'https://example.com/recipe',
            ingredients: [{ raw: '1 cup flour' }],
            steps: ['Mix ingredients'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
  });

  it('rejects non-object snapshot', () => {
    const result = validateSnapshot('not an object');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain('Snapshot must be an object');
    }
  });

  it('rejects snapshot with missing version', () => {
    const snapshot = {
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: { recipes: [] }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    }
  });

  it('rejects snapshot with unsupported version', () => {
    const snapshot = {
      version: 999,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: { recipes: [] }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('Unsupported snapshot version'))).toBe(true);
    }
  });

  it('rejects snapshot with missing exportedAt', () => {
    const snapshot = {
      version: 1,
      appVersion: '1.0.0',
      payload: { recipes: [] }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('exportedAt'))).toBe(true);
    }
  });

  it('rejects snapshot with invalid payload', () => {
    const snapshot = {
      version: 1,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: 'not an object'
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('payload'))).toBe(true);
    }
  });

  it('rejects snapshot with non-array recipes', () => {
    const snapshot = {
      version: 1,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: {
        recipes: 'not an array'
      }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('recipes must be an array'))).toBe(true);
    }
  });

  it('rejects snapshot with invalid recipe structure', () => {
    const snapshot = {
      version: 1,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: {
        recipes: [
          {
            // Missing required fields
            id: 'recipe-1'
          }
        ]
      }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
      expect(result.errors.some(e => e.includes('ingredients'))).toBe(true);
      expect(result.errors.some(e => e.includes('steps'))).toBe(true);
    }
  });

  it('accepts snapshot with optional sessions', () => {
    const snapshot: Snapshot = {
      version: 1,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: {
        recipes: [],
        sessions: [
          {
            recipeId: 'recipe-1',
            checkedIngredients: {},
            checkedSteps: {},
            multiplier: 1,
            expiresAt: Date.now() + 1000000
          }
        ]
      }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
  });

  it('rejects snapshot with invalid sessions type', () => {
    const snapshot = {
      version: 1,
      appVersion: '1.0.0',
      exportedAt: Date.now(),
      payload: {
        recipes: [],
        sessions: 'not an array'
      }
    };

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('sessions must be an array'))).toBe(true);
    }
  });
});
