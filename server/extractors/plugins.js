/**
 * Recipe Plugin Extractor
 * 
 * Handles popular WordPress recipe plugins that 70%+ of food blogs use.
 * These plugins have consistent, reliable structure that we can depend on.
 */

import { nanoid } from 'nanoid';
import { parseIngredients } from '../utils.js';

/**
 * Detect and extract from WordPress Recipe Maker (WPRM)
 * Used by many modern food blogs
 */
export function tryWPRM($, url) {
  const container = $('.wprm-recipe, [data-recipe-id]').first();
  if (container.length === 0) return null;

  console.log('✓ Detected WordPress Recipe Maker (WPRM)');

  const now = Date.now();
  const recipe = {
    id: nanoid(),
    sourceUrl: url,
    sourceName: extractSourceName(url),
    createdAt: now,
    updatedAt: now
  };

  // Title
  recipe.title = container.find('.wprm-recipe-name').first().text().trim()
    || $('h1').first().text().trim()
    || 'Untitled Recipe';

  // Summary/Description
  const summary = container.find('.wprm-recipe-summary').first().text().trim();
  if (summary) recipe.description = summary;

  // Times
  const times = {};
  const prepTime = container.find('.wprm-recipe-prep_time-minutes').first().text().trim();
  const cookTime = container.find('.wprm-recipe-cook_time-minutes').first().text().trim();
  const totalTime = container.find('.wprm-recipe-total_time-minutes').first().text().trim();
  
  if (prepTime) times.prep = parseInt(prepTime);
  if (cookTime) times.cook = parseInt(cookTime);
  if (totalTime) times.total = parseInt(totalTime);
  if (Object.keys(times).length > 0) recipe.times = times;

  // Servings
  const servings = container.find('.wprm-recipe-servings').first().text().trim();
  if (servings) {
    const servingNum = parseInt(servings);
    if (!isNaN(servingNum)) recipe.servings = servingNum;
    recipe.yield = servings;
  }

  // Image
  const img = container.find('.wprm-recipe-image img').first().attr('src') 
    || container.find('img').first().attr('src');
  if (img) recipe.image = img;

  // Ingredients - handle groups
  const ingredients = [];
  container.find('.wprm-recipe-ingredient-group').each((_, group) => {
    const groupName = $(group).find('.wprm-recipe-ingredient-group-name').text().trim();
    if (groupName) {
      ingredients.push(`**${groupName}:**`);
    }
    
    $(group).find('.wprm-recipe-ingredient').each((_, ing) => {
      const amount = $(ing).find('.wprm-recipe-ingredient-amount').text().trim();
      const unit = $(ing).find('.wprm-recipe-ingredient-unit').text().trim();
      const name = $(ing).find('.wprm-recipe-ingredient-name').text().trim();
      const notes = $(ing).find('.wprm-recipe-ingredient-notes').text().trim();
      
      let line = [amount, unit, name].filter(Boolean).join(' ');
      if (notes) line += ` (${notes})`;
      
      if (line.trim()) ingredients.push(line.trim());
    });
  });

  // Fallback if no groups
  if (ingredients.length === 0) {
    container.find('.wprm-recipe-ingredient').each((_, ing) => {
      const text = $(ing).text().trim();
      if (text) ingredients.push(text);
    });
  }

  // Parse ingredients, preserving headers (they start with **)
  recipe.ingredients = ingredients.map(ing => {
    if (ing.startsWith('**') && ing.endsWith(':**')) {
      // This is a header - return as-is without parsing
      return { raw: ing, isGroupHeader: true };
    }
    // Parse normal ingredients
    const parsed = parseIngredients([ing]);
    return parsed[0] || { raw: ing };
  });

  // Instructions - handle groups and keep section headers
  const steps = [];
  container.find('.wprm-recipe-instruction-group').each((_, group) => {
    const groupNameRaw = $(group).find('.wprm-recipe-instruction-group-name').text().trim();
    const groupName = groupNameRaw.replace(/\s*:+\s*$/, '').trim();
    if (groupName) {
      steps.push(`**${groupName}:**`);
    }

    // Some WPRM themes split sub-step labels (e.g. "Mix:") into their own node.
    // Collect raw lines first, then merge short label-only lines with the next line.
    const rawLines = [];
    $(group)
      .find('.wprm-recipe-instruction-text, .wprm-recipe-instruction')
      .each((_, step) => {
        const text = $(step).text().trim();
        if (text) rawLines.push(text);
      });

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const isLabel = /:$/.test(line) && line.length <= 40;
      const next = rawLines[i + 1];

      if (isLabel && next) {
        steps.push(`${line} ${next}`.trim());
        i++; // skip next
        continue;
      }

      steps.push(line);
    }
  });

  // Fallback if no groups
  if (steps.length === 0) {
    const rawLines = [];
    container
      .find('.wprm-recipe-instruction-text, .wprm-recipe-instruction')
      .each((_, step) => {
        const text = $(step).text().trim();
        if (text) rawLines.push(text);
      });

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const isLabel = /:$/.test(line) && line.length <= 40;
      const next = rawLines[i + 1];

      if (isLabel && next) {
        steps.push(`${line} ${next}`.trim());
        i++;
        continue;
      }

      steps.push(line);
    }
  }

  recipe.steps = steps;

  // Notes
  const notes = container.find('.wprm-recipe-notes').first().text().trim();
  if (notes) recipe.notes = notes;

  // Nutrition
  const nutrition = {};
  const nutritionContainer = container.find('.wprm-nutrition-label-container, #wprm-recipe-nutrition');
  if (nutritionContainer.length > 0) {
    const extractNutrition = (selector, key) => {
      const value = nutritionContainer.find(selector).text().trim();
      const num = parseFloat(value);
      if (!isNaN(num)) nutrition[key] = num;
    };
    
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-calories .wprm-nutrition-label-text-nutrition-value', 'calories');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-fat .wprm-nutrition-label-text-nutrition-value', 'totalFat');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-saturated_fat .wprm-nutrition-label-text-nutrition-value', 'saturatedFat');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-trans_fat .wprm-nutrition-label-text-nutrition-value', 'transFat');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-cholesterol .wprm-nutrition-label-text-nutrition-value', 'cholesterol');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-sodium .wprm-nutrition-label-text-nutrition-value', 'sodium');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-carbohydrates .wprm-nutrition-label-text-nutrition-value', 'totalCarbohydrates');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-fiber .wprm-nutrition-label-text-nutrition-value', 'dietaryFiber');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-sugar .wprm-nutrition-label-text-nutrition-value', 'sugars');
    extractNutrition('.wprm-nutrition-label-text-nutrition-container-protein .wprm-nutrition-label-text-nutrition-value', 'protein');
    
    if (Object.keys(nutrition).length > 0) recipe.nutrition = nutrition;
  }

  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    console.log('✗ WPRM container found but missing ingredients/steps');
    return null;
  }

  console.log(`✓ WPRM extraction successful: ${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps`);
  return recipe;
}

/**
 * Detect and extract from Tasty Recipes
 */
export function tryTastyRecipes($, url) {
  const container = $('.tasty-recipes, .tasty-recipe-card').first();
  if (container.length === 0) return null;

  console.log('✓ Detected Tasty Recipes');

  const now = Date.now();
  const recipe = {
    id: nanoid(),
    sourceUrl: url,
    sourceName: extractSourceName(url),
    createdAt: now,
    updatedAt: now
  };

  // Title
  recipe.title = container.find('.tasty-recipes-title, h2').first().text().trim()
    || $('h1').first().text().trim()
    || 'Untitled Recipe';

  // Description
  const desc = container.find('.tasty-recipes-description').first().text().trim();
  if (desc) recipe.description = desc;

  // Times
  const times = {};
  container.find('.tasty-recipes-details-item').each((_, item) => {
    const label = $(item).find('.tasty-recipes-label').text().toLowerCase();
    const value = $(item).find('.tasty-recipes-value').text().trim();
    
    if (label.includes('prep') && value) {
      times.prep = parseTimeValue(value);
    } else if (label.includes('cook') && value) {
      times.cook = parseTimeValue(value);
    } else if (label.includes('total') && value) {
      times.total = parseTimeValue(value);
    } else if (label.includes('servings') && value) {
      const servingNum = parseInt(value);
      if (!isNaN(servingNum)) recipe.servings = servingNum;
      recipe.yield = value;
    }
  });
  if (Object.keys(times).length > 0) recipe.times = times;

  // Image
  const img = container.find('.tasty-recipes-image img').first().attr('src');
  if (img) recipe.image = img;

  // Ingredients
  const ingredients = [];
  container.find('.tasty-recipes-ingredients ul li, .tasty-recipe-ingredients li').each((_, ing) => {
    const text = $(ing).text().trim();
    if (text) ingredients.push(text);
  });
  recipe.ingredients = parseIngredients(ingredients);

  // Instructions
  const steps = [];
  container.find('.tasty-recipes-instructions ol li, .tasty-recipe-instructions li').each((_, step) => {
    const text = $(step).text().trim();
    if (text && text.length > 10) steps.push(text);
  });
  recipe.steps = steps;

  // Notes
  const notes = container.find('.tasty-recipes-notes').first().text().trim();
  if (notes) recipe.notes = notes;

  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    console.log('✗ Tasty Recipes container found but missing ingredients/steps');
    return null;
  }

  console.log(`✓ Tasty Recipes extraction successful: ${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps`);
  return recipe;
}

/**
 * Detect and extract from older WordPress plugins (EasyRecipe, Ziplist)
 */
export function tryLegacyPlugins($, url) {
  // Try EasyRecipe
  let container = $('.easyrecipe, .ERSName').first().closest('.easyrecipe');
  let pluginName = 'EasyRecipe';
  
  if (container.length === 0) {
    // Try Ziplist
    container = $('.ziplist-recipe, .zlrecipe-container').first();
    pluginName = 'Ziplist';
  }
  
  if (container.length === 0) {
    // Try WP Ultimate Recipe
    container = $('.wpurp-container').first();
    pluginName = 'WP Ultimate Recipe';
  }

  if (container.length === 0) return null;

  console.log(`✓ Detected ${pluginName}`);

  const now = Date.now();
  const recipe = {
    id: nanoid(),
    sourceUrl: url,
    sourceName: extractSourceName(url),
    createdAt: now,
    updatedAt: now
  };

  // Title - try multiple selectors
  recipe.title = container.find('.ERSName, .zlrecipe-title, .wpurp-recipe-name, h1, h2').first().text().trim()
    || $('h1').first().text().trim()
    || 'Untitled Recipe';

  // Ingredients - flexible selectors
  const ingredients = [];
  const ingSelectors = [
    '.ERSIngredients li',
    '.zlrecipe-ingredient',
    '.ingredients li',
    '.wpurp-recipe-ingredient',
    '.ingredient'
  ];
  
  for (const selector of ingSelectors) {
    container.find(selector).each((_, ing) => {
      const text = $(ing).text().trim();
      if (text) ingredients.push(text);
    });
    if (ingredients.length > 0) break;
  }
  recipe.ingredients = parseIngredients(ingredients);

  // Instructions - flexible selectors
  const steps = [];
  const stepSelectors = [
    '.ERSInstructions li',
    '.ERSInstructions p',
    '.zlrecipe-instruction',
    '.instructions li',
    '.instructions p',
    '.wpurp-recipe-instruction',
    '.instruction'
  ];
  
  for (const selector of stepSelectors) {
    container.find(selector).each((_, step) => {
      const text = $(step).text().trim();
      if (text && text.length > 10) steps.push(text);
    });
    if (steps.length > 0) break;
  }
  recipe.steps = steps;

  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    console.log(`✗ ${pluginName} container found but missing ingredients/steps`);
    return null;
  }

  console.log(`✓ ${pluginName} extraction successful: ${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps`);
  return recipe;
}

/**
 * Detect and extract from Cooked WordPress Plugin
 */
export function tryCookedPlugin($, url) {
  // First check if ANY Cooked elements exist at all
  const cookedElements = $('.cooked-recipe-ingredients, .cooked-recipe-directions, .cooked-single-ingredient');
  if (cookedElements.length === 0) return null;
  
  // Use body as container if we can't find a specific wrapper (print pages may not have article tags)
  let container = $('.cooked-recipe-ingredients, .cooked-recipe-directions').first().closest('article, .cooked-recipe');
  if (container.length === 0) {
    // Fall back to body for print pages
    container = $('body');
  }

  console.log('✓ Detected Cooked WordPress Plugin');

  const now = Date.now();
  const recipe = {
    id: nanoid(),
    sourceUrl: url,
    sourceName: extractSourceName(url),
    createdAt: now,
    updatedAt: now
  };

  // Title - including print page specific selectors
  recipe.title = container.find('.cooked-recipe-name, h1.entry-title').first().text().trim()
    || $('#printTitle').text().trim()
    || $('h1').first().text().trim()
    || 'Untitled Recipe';

  // Image
  const img = container.find('.cooked-recipe-image img, .cooked-recipe-thumb img').first().attr('src')
    || $('meta[property="og:image"]').attr('content');
  if (img) recipe.image = img;

  // Ingredients - handle groups (headings)
  const ingredients = [];
  container.find('.cooked-recipe-ingredients .cooked-single-ingredient').each((_, ing) => {
    const $ing = $(ing);
    
    // Check if this is a heading/group
    if ($ing.hasClass('cooked-heading')) {
      const groupName = $ing.text().trim();
      if (groupName) {
        ingredients.push(`**${groupName}:**`);
      }
    } else if ($ing.hasClass('cooked-ingredient')) {
      // Regular ingredient
      const amount = $ing.find('.cooked-ing-amount').text().trim();
      const measurement = $ing.find('.cooked-ing-measurement').text().trim();
      const name = $ing.find('.cooked-ing-name').text().trim();
      const description = $ing.find('.cooked-ing-description').text().trim();
      
      let line = [amount, measurement, name].filter(Boolean).join(' ');
      if (description) line += ` ${description}`;
      
      if (line.trim()) ingredients.push(line.trim());
    }
  });

  // Parse ingredients, preserving headers (they start with **)
  recipe.ingredients = ingredients.map(ing => {
    if (ing.startsWith('**') && ing.endsWith(':**')) {
      // This is a header - return as-is without parsing
      return { raw: ing, isGroupHeader: true };
    }
    // Parse normal ingredients
    const parsed = parseIngredients([ing]);
    return parsed[0] || { raw: ing };
  });

  // Instructions - handle groups
  const steps = [];
  container.find('.cooked-recipe-directions .cooked-single-direction, .cooked-recipe-directions .cooked-direction').each((_, step) => {
    const $step = $(step);
    
    // Check if this is a heading/group
    if ($step.hasClass('cooked-heading')) {
      const groupName = $step.text().trim();
      if (groupName) {
        steps.push(`**${groupName}:**`);
      }
    } else {
      let text = $step.text().trim();
      // Remove leading step numbers (e.g., "1\n\n", "10\n\n")
      text = text.replace(/^\d+\s*\n+\s*/, '');
      if (text && text.length > 10) steps.push(text);
    }
  });

  // Fallback: try to find any directions
  if (steps.length === 0) {
    container.find('.cooked-recipe-directions p, .cooked-recipe-directions li').each((_, step) => {
      let text = $(step).text().trim();
      // Remove leading step numbers
      text = text.replace(/^\d+\s*\n+\s*/, '');
      if (text && text.length > 10) steps.push(text);
    });
  }

  recipe.steps = steps;

  // Times
  const times = {};
  container.find('.cooked-meta-title').each((_, meta) => {
    const $meta = $(meta);
    const title = $meta.text().toLowerCase();
    const value = $meta.next().text().trim();
    
    if (title.includes('prep') && value) {
      times.prep = parseTimeValue(value);
    } else if (title.includes('cook') && value) {
      times.cook = parseTimeValue(value);
    } else if (title.includes('total') && value) {
      times.total = parseTimeValue(value);
    }
  });
  if (Object.keys(times).length > 0) recipe.times = times;

  // Nutrition (Cooked plugin format)
  const nutrition = {};
  const nutritionContainer = container.find('.cooked-nutrition, .nutrition-info');
  if (nutritionContainer.length > 0) {
    const extractNutrition = (label, key) => {
      const elem = nutritionContainer.find(`:contains("${label}")`).first();
      if (elem.length > 0) {
        const text = elem.text();
        const match = text.match(/\d+\.?\d*/); 
        if (match) nutrition[key] = parseFloat(match[0]);
      }
    };
    
    extractNutrition('Calories', 'calories');
    extractNutrition('Total Fat', 'totalFat');
    extractNutrition('Saturated Fat', 'saturatedFat');
    extractNutrition('Cholesterol', 'cholesterol');
    extractNutrition('Sodium', 'sodium');
    extractNutrition('Total Carbohydrate', 'totalCarbohydrates');
    extractNutrition('Dietary Fiber', 'dietaryFiber');
    extractNutrition('Sugars', 'sugars');
    extractNutrition('Protein', 'protein');
    
    if (Object.keys(nutrition).length > 0) recipe.nutrition = nutrition;
  }

  // Servings
  const servingsText = container.find('.cooked-yield, .cooked-servings').first().text().trim();
  if (servingsText) {
    const servingNum = parseInt(servingsText);
    if (!isNaN(servingNum)) recipe.servings = servingNum;
    recipe.yield = servingsText;
  }

  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    console.log('✗ Cooked container found but missing ingredients/steps');
    return null;
  }

  console.log(`✓ Cooked plugin extraction successful: ${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps`);
  return recipe;
}

/**
 * Try all recipe plugins in order of popularity
 */
export function tryRecipePlugins($, url) {
  // Try most popular plugins first
  const extractors = [
    tryWPRM,
    tryTastyRecipes,
    tryCookedPlugin,
    tryLegacyPlugins
  ];

  for (const extractor of extractors) {
    try {
      const recipe = extractor($, url);
      if (recipe) return recipe;
    } catch (error) {
      console.warn(`Plugin extractor failed: ${error.message}`);
    }
  }

  return null;
}

// Helper functions
function extractSourceName(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '');
  } catch {
    return 'Unknown Source';
  }
}

function parseTimeValue(value) {
  // Parse time strings like "30 minutes", "1 hour 30 minutes", "1h 30m"
  const hours = value.match(/(\d+)\s*(?:hour|hr|h)/i);
  const minutes = value.match(/(\d+)\s*(?:minute|min|m)/i);
  
  let total = 0;
  if (hours) total += parseInt(hours[1]) * 60;
  if (minutes) total += parseInt(minutes[1]);
  
  return total || parseInt(value) || 0;
}
