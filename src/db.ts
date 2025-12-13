import Dexie, { Table } from 'dexie';
import type { Recipe, CookSession } from './types';
import * as api from './api/recipes';

export class CrumbDB extends Dexie {
  recipes!: Table<Recipe>;
  sessions!: Table<CookSession>;
  private serverAvailable: boolean = true;

  constructor() {
    super('CrumbDB');
    
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
    
    // Check server availability on init
    this.checkServer();
  }
  
  private async checkServer(): Promise<void> {
    try {
      await api.getAllRecipes();
      this.serverAvailable = true;
      console.log('✓ Server connection established');
    } catch {
      this.serverAvailable = false;
      console.warn('⚠ Server unavailable - using offline cache');
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
      console.warn('Using cached recipes:', error);
      // Fallback to IndexedDB cache
      return this.recipes.toArray();
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
        await this.recipes.put(recipe);
      }
      
      return recipe || undefined;
    } catch (error) {
      console.warn(`Using cached recipe ${id}:`, error);
      return this.recipes.get(id);
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
      await this.recipes.put(saved);
      
      return saved;
    } catch (error) {
      console.warn('Server save failed, caching locally:', error);
      // Save to cache only
      await this.recipes.put(recipe);
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
      await this.recipes.put(updated);
      
      return updated;
    } catch (error) {
      console.warn('Server update failed, updating cache:', error);
      // Update cache only
      const existing = await this.recipes.get(id);
      if (existing) {
        const merged = { ...existing, ...updates, updatedAt: Date.now() };
        await this.recipes.put(merged);
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
      await this.recipes.delete(id);
    } catch (error) {
      console.warn('Server delete failed, removing from cache:', error);
      // Delete from cache anyway
      await this.recipes.delete(id);
    }
  }
  
  /**
   * Sync server recipes to local cache
   */
  private async syncToCache(recipes: Recipe[]): Promise<void> {
    try {
      await this.recipes.bulkPut(recipes);
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
      await this.recipes.put(recipe);
      
      return recipe;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions() {
    const now = Date.now();
    await this.sessions.where('expiresAt').below(now).delete();
  }

  async getActiveSession(recipeId: string): Promise<CookSession | undefined> {
    const session = await this.sessions.get(recipeId);
    if (!session) return undefined;
    
    if (session.expiresAt < Date.now()) {
      await this.sessions.delete(recipeId);
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
    
    await this.sessions.put(session);
    return session;
  }

  async updateSession(session: CookSession): Promise<void> {
    await this.sessions.put(session);
  }

  async extendSession(recipeId: string, additionalHours = 48): Promise<void> {
    const session = await this.getActiveSession(recipeId);
    if (session) {
      session.expiresAt = Math.max(
        session.expiresAt,
        Date.now()
      ) + (additionalHours * 60 * 60 * 1000);
      await this.sessions.put(session);
    }
  }

  async deleteSession(recipeId: string): Promise<void> {
    await this.sessions.delete(recipeId);
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
    const recipes = await this.recipes.toArray();
    return {
      recipes,
      exportedAt: Date.now(),
      version: '1.0.0'
    };
  }

  async importData(data: { recipes: Recipe[] }) {
    for (const recipe of data.recipes) {
      await this.recipes.put(recipe);
    }
  }
}

// Create singleton instance
export const db = new CrumbDB();