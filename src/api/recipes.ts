/**
 * API client for recipe operations
 * Provides server-side persistence with IndexedDB fallback for offline use
 */

import type { Recipe } from '../types';
import { useSettings } from '../state/session';

function getApiBase(): string {
  // In web builds we normally use the same-origin API (Vite proxies /api in dev).
  const raw = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  const settingsBase = (() => {
    try {
      return (useSettings.getState().apiBaseUrl || '').trim();
    } catch {
      return '';
    }
  })();

  const base = (raw || settingsBase || '/api').trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

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
    const response = await fetch(apiUrl('/health'), { 
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
    const response = await fetch(apiUrl('/recipes'), {
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
    const response = await fetch(apiUrl(`/recipes/${id}`), {
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
    const response = await fetch(apiUrl('/recipes'), {
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
    const response = await fetch(apiUrl(`/recipes/${id}`), {
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
    const response = await fetch(apiUrl(`/recipes/${id}`), {
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
    const requestUrl = apiUrl('/import');

    // Validate URL early to avoid opaque WebKit errors like:
    // "The string did not match the expected pattern."
    try {
      // new URL() requires an absolute base.
      new URL(requestUrl, window.location.href);
    } catch {
      throw new Error(
        `Invalid API base URL. Tried to call: ${requestUrl}. ` +
          `Set VITE_API_BASE_URL (or Settings → Server URL) to something like https://your-server.com/api.`
      );
    }

    const response = await fetch(requestUrl, {
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
    // Some environments stringify Errors to {} in console, so log message+stack explicitly.
    if (error instanceof Error) {
      console.error('Failed to import recipe:', { message: error.message, stack: error.stack });
    } else {
      console.error('Failed to import recipe:', error);
    }
    throw error;
  }
}
