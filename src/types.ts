// Canonical Recipe model
export type IngredientToken = {
  raw: string;         // original line, always keep
  amount?: number;     // 1.5
  amountDisplay?: string; // "1 1/2" (nice fraction)
  unit?: string;       // "cup", "g"
  item?: string;       // "bread flour"
  note?: string;       // "room temp"
  isGroupHeader?: boolean; // true if this is a section header like "**Donut Batter:**"
};

export type NutritionInfo = {
  servingSize?: string;
  calories?: number;
  totalFat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
  sodium?: number;
  totalCarbohydrates?: number;
  dietaryFiber?: number;
  sugars?: number;
  protein?: number;
};

export type Recipe = {
  id: string;          // nanoid
  title: string;
  image?: string;
  author?: string;
  sourceName?: string; // e.g., "The Clever Carrot"
  sourceUrl: string;
  /**
   * Optional user-defined category (e.g., "Breakfast", "Dinner", "Desserts", "Drinks").
   * Free-form so users can add their own.
   */
  category?: string;
  /** Optional tag list for organization and filtering. */
  tags?: string[];
  /**
   * User favorite flag. Favorites are sorted to the top of the library.
   */
  isFavorite?: boolean;
  /** Optional per-recipe ingredient/unit → grams overrides. */
  conversionOverrides?: Record<string, Record<string, number>>;
  yield?: string;      // e.g., "12 pancakes"
  servings?: number;   // numeric serving size if known
  times?: { prep?: number; cook?: number; total?: number }; // minutes
  ingredients: IngredientToken[];
  steps: string[];     // ordered steps
  tips?: string[];     // optional extra tips/notes
  notes?: string;      // personal user notes for modifications
  nutrition?: NutritionInfo; // optional nutrition facts
  createdAt: number;
  updatedAt: number;
};

// Ephemeral cook-session state (per-recipe)
export type CookSession = {
  recipeId: string;
  checkedIngredients: Record<number, boolean>; // index => checked
  checkedSteps: Record<number, boolean>;
  multiplier: number;  // e.g., 1.5 (default 1)
  expiresAt: number;   // epoch ms; default now + 72h
};

// API types
export type ImportRequest = {
  url: string;
};

export type ImportResponse = {
  success: boolean;
  recipe?: Recipe;
  debug?: ImportDebugReport;
  error?: string;
};

// Optional debug info returned by the server during import.
// This is intentionally lightweight and may change over time.
export type ImportDebugReport = {
  requestedUrl: string;
  fetchedUrl: string;
  startedAt: number;
  strategies: Array<{
    name: string;
    score: number;
    metrics?: {
      titleLen: number;
      ingredientsCount: number;
      stepsCount: number;
      avgStepLength: number;
      hasImage: boolean;
      hasAuthor: boolean;
      hasTimes: boolean;
      hasYield: boolean;
    };
    meta?: Record<string, unknown>;
  }>;
  chosen?: {
    name: string;
    score: number;
    durationMs?: number;
  };
  warnings: string[];
};

// Scaling types
export type ScaledIngredient = IngredientToken & {
  scaledAmount?: number;
  scaledAmountDisplay?: string;
  gramsAmount?: number;
  gramsDisplay?: string;
};

// UI types
export type ToastType = 'success' | 'error' | 'info';

export type SessionStatus = 'active' | 'expiring' | 'expired';

// Storage types
export type ExportData = {
  recipes: Recipe[];
  exportedAt: number;
  version: string;
};

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Settings types
export type Settings = {
  theme: Theme;
  keepSessionsOnClose: boolean;
  autoExtendSessions: boolean;
  /** Prefer showing gram conversions when available. */
  preferGrams: boolean;
  /** Optional shared key to scope server-side sync across devices. */
  syncKey: string;
  /** User overrides for ingredient/unit → grams. */
  conversionOverrides: Record<string, Record<string, number>>;
};

// JSON-LD Schema.org types for parsing
export interface JsonLdRecipe {
  '@type': string | string[];
  name?: string;
  author?: string | { name?: string; '@type'?: string };
  image?: string | string[] | { url?: string };
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text?: string; name?: string }>;
  recipeYield?: string | number;
  totalTime?: string;
  prepTime?: string;
  cookTime?: string;
  nutrition?: {
    servingSize?: string;
  };
  aggregateRating?: {
    ratingValue?: number;
    reviewCount?: number;
  };
  review?: Array<{
    reviewBody?: string;
    author?: { name?: string };
  }>;
}