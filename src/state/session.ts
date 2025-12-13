import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../db';
import type { CookSession, Recipe } from '../types';

interface CookSessionStore {
  // Current session state
  currentSession: CookSession | null;
  isLoading: boolean;
  
  // Actions
  loadSession: (recipeId: string) => Promise<void>;
  createNewSession: (recipeId: string) => Promise<void>;
  toggleIngredient: (index: number) => Promise<void>;
  toggleStep: (index: number) => Promise<void>;
  setMultiplier: (multiplier: number) => Promise<void>;
  extendSession: (additionalHours?: number) => Promise<void>;
  resetSession: () => Promise<void>;
  clearSession: () => void;
  
  // Computed values
  getTimeRemaining: () => number;
  isExpiring: () => boolean;
  isExpired: () => boolean;
}

export const useCookSession = create<CookSessionStore>((set, get) => ({
  currentSession: null,
  isLoading: false,
  
  loadSession: async (recipeId: string) => {
    set({ isLoading: true });
    try {
      const session = await db.getActiveSession(recipeId);
      set({ currentSession: session, isLoading: false });
    } catch (error) {
      console.error('Failed to load session:', error);
      set({ isLoading: false });
    }
  },
  
  createNewSession: async (recipeId: string) => {
    set({ isLoading: true });
    try {
      const session = await db.createSession(recipeId);
      set({ currentSession: session, isLoading: false });
    } catch (error) {
      console.error('Failed to create session:', error);
      set({ isLoading: false });
    }
  },
  
  toggleIngredient: async (index: number) => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    const updatedSession = {
      ...currentSession,
      checkedIngredients: {
        ...currentSession.checkedIngredients,
        [index]: !currentSession.checkedIngredients[index]
      }
    };
    
    try {
      await db.updateSession(updatedSession);
      set({ currentSession: updatedSession });
    } catch (error) {
      console.error('Failed to toggle ingredient:', error);
    }
  },
  
  toggleStep: async (index: number) => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    const updatedSession = {
      ...currentSession,
      checkedSteps: {
        ...currentSession.checkedSteps,
        [index]: !currentSession.checkedSteps[index]
      }
    };
    
    try {
      await db.updateSession(updatedSession);
      set({ currentSession: updatedSession });
    } catch (error) {
      console.error('Failed to toggle step:', error);
    }
  },
  
  setMultiplier: async (multiplier: number) => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    const updatedSession = {
      ...currentSession,
      multiplier
    };
    
    try {
      await db.updateSession(updatedSession);
      set({ currentSession: updatedSession });
    } catch (error) {
      console.error('Failed to set multiplier:', error);
    }
  },
  
  extendSession: async (additionalHours = 48) => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      await db.extendSession(currentSession.recipeId, additionalHours);
      const updatedSession = await db.getActiveSession(currentSession.recipeId);
      set({ currentSession: updatedSession });
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  },
  
  resetSession: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    const resetSession = {
      ...currentSession,
      checkedIngredients: {},
      checkedSteps: {},
      multiplier: 1,
      expiresAt: Date.now() + (72 * 60 * 60 * 1000) // Fresh 72h
    };
    
    try {
      await db.updateSession(resetSession);
      set({ currentSession: resetSession });
    } catch (error) {
      console.error('Failed to reset session:', error);
    }
  },
  
  clearSession: () => {
    const { currentSession } = get();
    if (currentSession) {
      db.deleteSession(currentSession.recipeId);
    }
    set({ currentSession: null });
  },
  
  getTimeRemaining: () => {
    const { currentSession } = get();
    if (!currentSession) return 0;
    return Math.max(0, currentSession.expiresAt - Date.now());
  },
  
  isExpiring: () => {
    const timeRemaining = get().getTimeRemaining();
    return timeRemaining > 0 && timeRemaining < (24 * 60 * 60 * 1000); // Less than 24h
  },
  
  isExpired: () => {
    return get().getTimeRemaining() <= 0;
  }
}));

// Recipe library store
interface RecipeStore {
  recipes: Recipe[];
  searchQuery: string;
  isLoading: boolean;
  
  loadRecipes: () => Promise<void>;
  addRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  searchRecipes: (query: string) => void;
  getFilteredRecipes: () => Recipe[];
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
  searchQuery: '',
  isLoading: false,
  
  loadRecipes: async () => {
    set({ isLoading: true });
    try {
      const recipes = await db.getAllRecipes();
      set({ recipes, isLoading: false });
    } catch (error) {
      console.error('Failed to load recipes:', error);
      set({ isLoading: false });
    }
  },
  
  addRecipe: async (recipe: Recipe) => {
    try {
      await db.saveRecipe(recipe);
      const { recipes } = get();
      set({ recipes: [recipe, ...recipes] });
    } catch (error) {
      console.error('Failed to add recipe:', error);
      throw error;
    }
  },
  
  updateRecipe: async (recipe: Recipe) => {
    try {
      const updated = await db.updateRecipe(recipe.id, recipe);
      const { recipes } = get();
      const updatedRecipes = recipes.map(r => r.id === recipe.id ? updated : r);
      set({ recipes: updatedRecipes });
    } catch (error) {
      console.error('Failed to update recipe:', error);
      throw error;
    }
  },
  
  deleteRecipe: async (id: string) => {
    try {
      await db.deleteRecipe(id);
      await db.sessions.delete(id);
      const { recipes } = get();
      set({ recipes: recipes.filter(r => r.id !== id) });
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      throw error;
    }
  },
  
  searchRecipes: (query: string) => {
    set({ searchQuery: query });
  },
  
  getFilteredRecipes: () => {
    const { recipes, searchQuery } = get();
    const base = !searchQuery.trim()
      ? recipes
      : (() => {
          const query = searchQuery.toLowerCase().trim();
          return recipes.filter(recipe => 
            recipe.title.toLowerCase().includes(query) ||
            recipe.sourceName?.toLowerCase().includes(query) ||
            recipe.ingredients.some(ing => 
              ing.raw.toLowerCase().includes(query) ||
              ing.item?.toLowerCase().includes(query)
            )
          );
        })();
    
    // Favorites to the top, then most recently updated, then title.
    return [...base].sort((a, b) => {
      const favA = a.isFavorite ? 1 : 0;
      const favB = b.isFavorite ? 1 : 0;
      if (favA !== favB) return favB - favA;
      const upA = a.updatedAt || 0;
      const upB = b.updatedAt || 0;
      if (upA !== upB) return upB - upA;
      return (a.title || '').localeCompare(b.title || '');
    });
  }
}));

// Settings store
interface SettingsStore {
  theme: 'light' | 'dark' | 'system';
  keepSessionsOnClose: boolean;
  autoExtendSessions: boolean;
  
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setKeepSessionsOnClose: (keep: boolean) => void;
  setAutoExtendSessions: (auto: boolean) => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'light',
      keepSessionsOnClose: false,
      autoExtendSessions: true,
      
      setTheme: (theme) => set({ theme }),
      setKeepSessionsOnClose: (keepSessionsOnClose) => set({ keepSessionsOnClose }),
      setAutoExtendSessions: (autoExtendSessions) => set({ autoExtendSessions })
    }),
    {
      name: 'crumb-settings'
    }
  )
);