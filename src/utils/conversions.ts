import type { IngredientToken } from '../types';
import { useSettings } from '../state/session';

// Weight conversion ratios to grams
const WEIGHT_CONVERSIONS: Record<string, number> = {
  // US volume to weight conversions (approximate for common ingredients)
  'cup': 240,
  'cups': 240,
  'c': 240,
  
  'tablespoon': 15,
  'tablespoons': 15,
  'tbsp': 15,
  'tbs': 15,
  'tb': 15,
  
  'teaspoon': 5,
  'teaspoons': 5,
  'tsp': 5,
  'ts': 5,
  't': 5,
  
  // Direct weight conversions
  'ounce': 28.35,
  'ounces': 28.35,
  'oz': 28.35,
  
  'pound': 453.6,
  'pounds': 453.6,
  'lb': 453.6,
  'lbs': 453.6,
  
  'kilogram': 1000,
  'kilograms': 1000,
  'kg': 1000,
  
  'gram': 1,
  'grams': 1,
  'g': 1,
  
  // Fluid measurements (approximate as weight)
  'fluid ounce': 30,
  'fluid ounces': 30,
  'fl oz': 30,
  'fl. oz.': 30,
};

// Ingredient-specific conversion ratios (more accurate for common ingredients)
const INGREDIENT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Flour (all types)
  'flour': { 'cup': 125, 'cups': 125, 'c': 125 },
  'all-purpose flour': { 'cup': 125, 'cups': 125, 'c': 125 },
  'all purpose flour': { 'cup': 125, 'cups': 125, 'c': 125 },
  'bread flour': { 'cup': 127, 'cups': 127, 'c': 127 },
  'cake flour': { 'cup': 114, 'cups': 114, 'c': 114 },
  'whole wheat flour': { 'cup': 120, 'cups': 120, 'c': 120 },
  
  // Sugar (all types)
  'sugar': { 'cup': 200, 'cups': 200, 'c': 200 },
  'granulated sugar': { 'cup': 200, 'cups': 200, 'c': 200 },
  'white granulated sugar': { 'cup': 200, 'cups': 200, 'c': 200 },
  'white sugar': { 'cup': 200, 'cups': 200, 'c': 200 },
  'brown sugar': { 'cup': 220, 'cups': 220, 'c': 220 },
  'light brown sugar': { 'cup': 213, 'cups': 213, 'c': 213 },
  'dark brown sugar': { 'cup': 220, 'cups': 220, 'c': 220 },
  'powdered sugar': { 'cup': 120, 'cups': 120, 'c': 120 },
  'confectioners sugar': { 'cup': 120, 'cups': 120, 'c': 120 },
  
  // Butter and fats
  'butter': {
    'cup': 227, 'cups': 227, 'c': 227,
    'tablespoon': 14, 'tablespoons': 14, 'tbsp': 14, 'tbs': 14, 'tb': 14,
    'teaspoon': 5, 'teaspoons': 5, 'tsp': 5, 'ts': 5,
  },
  'unsalted butter': {
    'cup': 227, 'cups': 227, 'c': 227,
    'tablespoon': 14, 'tablespoons': 14, 'tbsp': 14, 'tbs': 14, 'tb': 14,
  },
  
  // Liquids (water, milk, etc.)
  'water': {
    'cup': 240, 'cups': 240, 'c': 240,
    'tablespoon': 15, 'tablespoons': 15, 'tbsp': 15,
    'teaspoon': 5, 'teaspoons': 5, 'tsp': 5,
  },
  'milk': {
    'cup': 240, 'cups': 240, 'c': 240,
    'tablespoon': 15, 'tablespoons': 15, 'tbsp': 15,
  },
  '2% milk': {
    'cup': 240, 'cups': 240, 'c': 240,
  },
  
  // Oils
  'oil': {
    'cup': 218, 'cups': 218, 'c': 218,
    'tablespoon': 14, 'tablespoons': 14, 'tbsp': 14,
  },
  'olive oil': {
    'cup': 216, 'cups': 216, 'c': 216,
    'tablespoon': 14, 'tablespoons': 14, 'tbsp': 14,
  },
  'vegetable oil': {
    'cup': 218, 'cups': 218, 'c': 218,
    'tablespoon': 14, 'tablespoons': 14, 'tbsp': 14,
  },
  
  // Oats
  'oats': { 'cup': 80, 'cups': 80, 'c': 80 },
  'rolled oats': { 'cup': 80, 'cups': 80, 'c': 80 },
  
  // Chocolate
  'chocolate chips': { 'cup': 175, 'cups': 175, 'c': 175 },
  'chocolate': { 'cup': 175, 'cups': 175, 'c': 175 },
  
  // Cream cheese
  'cream cheese': {
    'ounce': 28.35, 'ounces': 28.35, 'oz': 28.35,
    'cup': 227, 'cups': 227, 'c': 227,
  },
};

export interface ConversionResult {
  grams: number;
  gramsDisplay: string;
  isConvertible: boolean;
  confidence: 'high' | 'medium' | 'low';
  source?: 'user' | 'built-in';
}

function normalizeKey(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchIngredientKey(item: string, key: string): boolean {
  const a = normalizeKey(item);
  const b = normalizeKey(key);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Convert an ingredient amount to grams
 */
export function convertToGrams(ingredient: IngredientToken): ConversionResult {
  if (!ingredient.amount || !ingredient.unit) {
    return {
      grams: 0,
      gramsDisplay: '',
      isConvertible: false,
      confidence: 'low'
    };
  }

  const unit = ingredient.unit.toLowerCase().trim();
  const amount = ingredient.amount;
  const item = ingredient.item?.toLowerCase().trim() || '';

  // 0) User overrides (highest priority)
  try {
    const overrides = useSettings.getState().conversionOverrides || {};
    for (const [ingredientKey, conversions] of Object.entries(overrides)) {
      if (!conversions) continue;
      if (!matchIngredientKey(item, ingredientKey)) continue;
      const gramsPerUnit = conversions[unit];
      if (typeof gramsPerUnit === 'number' && Number.isFinite(gramsPerUnit) && gramsPerUnit > 0) {
        const grams = Math.round(amount * gramsPerUnit);
        return {
          grams,
          gramsDisplay: `${grams}g`,
          isConvertible: true,
          confidence: 'high',
          source: 'user'
        };
      }
    }
  } catch {
    // Ignore settings read issues and continue with built-in conversions
  }

  // Check for ingredient-specific conversions first
  for (const [ingredientName, conversions] of Object.entries(INGREDIENT_CONVERSIONS)) {
    if (item.includes(ingredientName) || ingredientName.includes(item)) {
      if (conversions[unit]) {
        const grams = Math.round(amount * conversions[unit]);
        return {
          grams,
          gramsDisplay: `${grams}g`,
          isConvertible: true,
          confidence: 'high',
          source: 'built-in'
        };
      }
    }
  }

  // Fall back to general conversions
  if (WEIGHT_CONVERSIONS[unit]) {
    const grams = Math.round(amount * WEIGHT_CONVERSIONS[unit]);
    return {
      grams,
      gramsDisplay: `${grams}g`,
      isConvertible: true,
      confidence: item ? 'medium' : 'low', // Lower confidence without ingredient context
      source: 'built-in'
    };
  }

  return {
    grams: 0,
    gramsDisplay: '',
    isConvertible: false,
    confidence: 'low'
  };
}

/**
 * Convert multiple ingredients to grams
 */
export function convertIngredientsToGrams(ingredients: IngredientToken[]): (IngredientToken & { conversion?: ConversionResult })[] {
  return ingredients.map(ingredient => ({
    ...ingredient,
    conversion: convertToGrams(ingredient)
  }));
}

/**
 * Check if an ingredient can be converted to grams
 */
export function isConvertibleToGrams(ingredient: IngredientToken): boolean {
  if (!ingredient.unit || !ingredient.amount) return false;
  
  const unit = ingredient.unit.toLowerCase().trim();
  const item = ingredient.item?.toLowerCase().trim() || '';
  
  // Check ingredient-specific conversions
  for (const [ingredientName, conversions] of Object.entries(INGREDIENT_CONVERSIONS)) {
    if (item.includes(ingredientName) && conversions[unit]) {
      return true;
    }
  }
  
  // Check general conversions
  return unit in WEIGHT_CONVERSIONS;
}

/**
 * Get list of units that can be converted to grams
 */
export function getConvertibleUnits(): string[] {
  const units = new Set<string>();
  
  // Add general units
  Object.keys(WEIGHT_CONVERSIONS).forEach(unit => units.add(unit));
  
  // Add ingredient-specific units
  Object.values(INGREDIENT_CONVERSIONS).forEach(conversions => {
    Object.keys(conversions).forEach(unit => units.add(unit));
  });
  
  return Array.from(units).sort();
}

/**
 * Format conversion display with confidence indicator
 */
export function formatConversionDisplay(ingredient: IngredientToken, conversion: ConversionResult): string {
  if (!conversion.isConvertible) return '';
  
  let display = conversion.gramsDisplay;
  
  // Add confidence indicator
  if (conversion.confidence === 'medium') {
    display += ' (approx.)';
  } else if (conversion.confidence === 'low') {
    display += ' (est.)';
  }
  
  return display;
}