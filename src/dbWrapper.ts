/**
 * Database wrapper with server-first, cache-fallback logic.
 * Now supports multi-user profiles via ProfileDB instances.
 */

import type { ProfileDB } from './storage/storageFactory';
import type { Recipe, CookSession } from './types';
import * as api from './api/recipes';

export class CrumbDBWrapper {
  private profileDb: ProfileDB;
  private serverAvailable: boolean = true;

  constructor(profileDb: ProfileDB) {
    this.profileDb = profileDb;
    
    // Check server availability on init
    this.checkServer();
  }

  private async checkServer(): Promise<void> {
    try {
      const ok = await api.checkServerHealth();
      this.serverAvailable = ok;
      if (ok) console.log('✓ Server connection established');
    } catch {
      this.serverAvailable = false;
      console.warn('⚠ Server unavailable - using offline cache');
    }
  }

  private formatErrorForLog(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return typeof error === 'string' ? error : JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  /**
   * Get all recipes - server first, cache fallback
   */
  async getAllRecipes(): Promise<Recipe[]> {
    try {
      // Try server first
      const serverRecipes = await api.getAllRecipes();
      
      // Update local cache in background
      this.syncToCache(serverRecipes).catch(console.error);
      
      return serverRecipes;
    } catch (error) {
      console.warn('Using cached recipes:', this.formatErrorForLog(error));
      // Fallback to IndexedDB cache
      return this.profileDb.recipes.toArray();
    }
  }

  /**
   * Get single recipe - server first, cache fallback
   */
  async getRecipe(id: string): Promise<Recipe | undefined> {
    try {
      const recipe = await api.getRecipe(id);
      
      if (recipe) {
        // Cache for offline
        await this.profileDb.recipes.put(recipe);
      }
      
      return recipe || undefined;
    } catch (error) {
      console.warn(`Using cached recipe ${id}:`, this.formatErrorForLog(error));
      return this.profileDb.recipes.get(id);
    }
  }

  /**
   * Save recipe - server first, cache fallback
   */
  async saveRecipe(recipe: Recipe): Promise<Recipe> {
    try {
      // Save to server
      const saved = await api.saveRecipe(recipe);
      
      // Update cache
      await this.profileDb.recipes.put(saved);
      
      return saved;
    } catch (error) {
      console.warn('Server save failed, caching locally:', this.formatErrorForLog(error));
      // Save to cache only
      await this.profileDb.recipes.put(recipe);
      return recipe;
    }
  }

  /**
   * Update recipe - server first, cache fallback
   */
  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
    try {
      // Update on server
      const updated = await api.updateRecipe(id, updates);
      
      // Update cache
      await this.profileDb.recipes.put(updated);
      
      return updated;
    } catch (error) {
      console.warn('Server update failed, updating cache:', this.formatErrorForLog(error));
      // Update cache only
      const existing = await this.profileDb.recipes.get(id);
      if (existing) {
        const merged = { ...existing, ...updates, updatedAt: Date.now() };
        await this.profileDb.recipes.put(merged);
        return merged;
      }
      throw new Error('Recipe not found in cache');
    }
  }

  /**
   * Delete recipe - server first, cache sync
   */
  async deleteRecipe(id: string): Promise<void> {
    try {
      // Delete from server
      await api.deleteRecipe(id);
      
      // Delete from cache
      await this.profileDb.recipes.delete(id);
    } catch (error) {
      console.warn('Server delete failed, removing from cache:', this.formatErrorForLog(error));
      // Delete from cache anyway
      await this.profileDb.recipes.delete(id);
    }
  }

  /**
   * Sync server recipes to local cache
   */
  private async syncToCache(recipes: Recipe[]): Promise<void> {
    try {
      await this.profileDb.recipes.bulkPut(recipes);
      console.log(`✓ Synced ${recipes.length} recipes to cache`);
    } catch (error) {
      console.error('Failed to sync to cache:', error);
    }
  }

  /**
   * Import recipe from URL
   */
  async importRecipe(url: string): Promise<Recipe> {
    try {
      const recipe = await api.importRecipe(url, true);
      
      // Cache locally
      await this.profileDb.recipes.put(recipe);
      
      return recipe;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions() {
    const now = Date.now();
    await this.profileDb.sessions.where('expiresAt').below(now).delete();
  }

  async getActiveSession(recipeId: string): Promise<CookSession | undefined> {
    const session = await this.profileDb.sessions.get(recipeId);
    if (!session) return undefined;
    
    if (session.expiresAt < Date.now()) {
      await this.profileDb.sessions.delete(recipeId);
      return undefined;
    }
    
    return session;
  }

  async createSession(recipeId: string, durationHours = 72): Promise<CookSession> {
    const session: CookSession = {
      recipeId,
      checkedIngredients: {},
      checkedSteps: {},
      multiplier: 1,
      expiresAt: Date.now() + (durationHours * 60 * 60 * 1000)
    };
    
    await this.profileDb.sessions.put(session);
    return session;
  }

  async updateSession(session: CookSession): Promise<void> {
    await this.profileDb.sessions.put(session);
  }

  async extendSession(recipeId: string, additionalHours = 48): Promise<void> {
    const session = await this.getActiveSession(recipeId);
    if (session) {
      session.expiresAt = Math.max(
        session.expiresAt,
        Date.now()
      ) + (additionalHours * 60 * 60 * 1000);
      await this.profileDb.sessions.put(session);
    }
  }

  async deleteSession(recipeId: string): Promise<void> {
    await this.profileDb.sessions.delete(recipeId);
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    // Get all recipes (server-first)
    const recipes = await this.getAllRecipes();
    
    const lowerQuery = query.toLowerCase();
    return recipes.filter((recipe: Recipe) => 
      recipe.title.toLowerCase().includes(lowerQuery) ||
      recipe.sourceName?.toLowerCase().includes(lowerQuery) ||
      recipe.ingredients.some((ing: any) => 
        ing.raw.toLowerCase().includes(lowerQuery) ||
        ing.item?.toLowerCase().includes(lowerQuery)
      )
    );
  }

  async getRecentRecipes(limit = 10): Promise<Recipe[]> {
    // Get all recipes (server-first)
    const recipes = await this.getAllRecipes();
    
    // Sort by updatedAt
    return recipes
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, limit);
  }

  async exportData() {
    const recipes = await this.profileDb.recipes.toArray();
    return {
      recipes,
      exportedAt: Date.now(),
      version: '1.0.0'
    };
  }

  async importData(data: { recipes: Recipe[] }) {
    for (const recipe of data.recipes) {
      await this.profileDb.recipes.put(recipe);
    }
  }

  /**
   * Get direct access to the underlying ProfileDB for advanced operations
   */
  get db(): ProfileDB {
    return this.profileDb;
  }
}

// Global instance holder (will be initialized during app startup)
let globalDb: CrumbDBWrapper | null = null;

/**
 * Set the global database instance
 * @internal Called during app initialization
 */
export function setGlobalDb(dbWrapper: CrumbDBWrapper): void {
  globalDb = dbWrapper;
}

/**
 * Get the global database instance
 * Maintains backward compatibility with existing code
 */
export function getDb(): CrumbDBWrapper {
  if (!globalDb) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return globalDb;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getDb() instead
 */
export const db = new Proxy({} as CrumbDBWrapper, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});
