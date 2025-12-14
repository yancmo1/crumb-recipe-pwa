/**
 * API client for recipe operations
 * Provides server-side persistence with IndexedDB fallback for offline use
 */

import type { Recipe } from '../types';
import { useSettings } from '../state/session';

const API_BASE = '/api';

function getSyncKeyHeader(): Record<string, string> {
  try {
    const key = (useSettings.getState().syncKey || '').trim();
    return key ? { 'X-Crumb-Sync-Key': key } : {};
  } catch {
    return {};
  }
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Check if server is reachable
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get all recipes from server
 */
export async function getAllRecipes(): Promise<Recipe[]> {
  try {
    const response = await fetch(`${API_BASE}/recipes`, {
      headers: {
        ...getSyncKeyHeader()
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch recipes');
    }
    
    return data.recipes || [];
  } catch (error) {
    // Avoid noisy logs: offline mode and local dev without Postgres are normal.
    throw error;
  }
}

/**
 * Get single recipe by ID
 */
export async function getRecipe(id: string): Promise<Recipe | null> {
  try {
    const response = await fetch(`${API_BASE}/recipes/${id}`, {
      headers: {
        ...getSyncKeyHeader()
      }
    });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch recipe');
    }
    
    return data.recipe;
  } catch (error) {
    console.error(`Failed to fetch recipe ${id}:`, error);
    throw error;
  }
}

/**
 * Save recipe (create or update)
 */
export async function saveRecipe(recipe: Recipe): Promise<Recipe> {
  try {
    const response = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSyncKeyHeader()
      },
      body: JSON.stringify(recipe)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to save recipe');
    }
    
    return data.recipe;
  } catch (error) {
    console.error('Failed to save recipe to server:', error);
    throw error;
  }
}

/**
 * Update existing recipe
 */
export async function updateRecipe(id: string, recipe: Partial<Recipe>): Promise<Recipe> {
  try {
    const response = await fetch(`${API_BASE}/recipes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getSyncKeyHeader()
      },
      body: JSON.stringify(recipe)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update recipe');
    }
    
    return data.recipe;
  } catch (error) {
    console.error(`Failed to update recipe ${id}:`, error);
    throw error;
  }
}

/**
 * Delete recipe
 */
export async function deleteRecipe(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/recipes/${id}`, {
      method: 'DELETE',
      headers: {
        ...getSyncKeyHeader()
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete recipe');
    }
  } catch (error) {
    console.error(`Failed to delete recipe ${id}:`, error);
    throw error;
  }
}

/**
 * Import recipe from URL (with optional server save)
 */
export async function importRecipe(url: string, saveToServer = true): Promise<Recipe> {
  try {
    const response = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSyncKeyHeader()
      },
      body: JSON.stringify({ 
        url,
        useImprovedExtractor: true,
        saveToServer 
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to import recipe');
    }
    
    return data.recipe;
  } catch (error) {
    console.error('Failed to import recipe:', error);
    throw error;
  }
}
