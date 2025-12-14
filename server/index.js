import express from 'express';
import cors from 'cors';
import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { nanoid } from 'nanoid';
import { parseIngredients } from './utils.js';
import { extractRecipeImproved } from './extractors/improved-extractor.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, isDbConfigured, query, toCamelCase, toSnakeCase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

let dbReady = false;

app.use(cors());
app.use(express.json());

function getSyncKey(req) {
  const raw = req.get('x-crumb-sync-key') || req.get('X-Crumb-Sync-Key') || '';
  const key = String(raw).trim();
  return key.length ? key : 'default';
}

function rowToRecipe(row) {
  return {
    id: row.id,
    syncKey: row.sync_key,
    title: row.title,
    image: row.image,
    author: row.author,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    category: row.category ?? undefined,
    tags: row.tags ?? undefined,
    isFavorite: row.is_favorite ?? false,
    yield: row.yield,
    servings: row.servings,
    times: row.times,
    ingredients: row.ingredients,
    steps: row.steps,
    tips: row.tips,
    notes: row.notes,
    nutrition: row.nutrition,
    conversionOverrides: row.conversion_overrides ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeRecipeForDb(recipe) {
  return {
    ...recipe,
    category: typeof recipe.category === 'string' ? recipe.category.trim() || null : null,
    isFavorite: recipe.isFavorite === true
  };
}

// Serve  static files from the built frontend
app.use(express.static(join(__dirname, '../dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API health endpoint (used by frontend availability checks)
app.head('/api/health', (req, res) => {
  res.status(200).end();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Recipe import endpoint
app.post('/api/import', async (req, res) => {
  try {
    const { url, useImprovedExtractor = true, saveToServer = true, includeDebug = false } = req.body;
    const syncKey = getSyncKey(req);
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    
    console.log(`Importing recipe from: ${url}`);
    console.log(`Using ${useImprovedExtractor ? 'IMPROVED' : 'LEGACY'} extractor`);
    
    // Use improved extractor by default, fallback to legacy if requested
    let recipe;
    let debug;

    if (useImprovedExtractor) {
      const result = await extractRecipeImproved(url, { includeDebug: !!includeDebug });
      recipe = result.recipe;
      debug = result.debug;
    } else {
      recipe = await extractRecipe(url);
    }
    
    // Optionally save to database
    if (saveToServer && dbReady) {
      try {
        recipe = await saveRecipe(recipe, syncKey);
        console.log(`✓ Recipe saved to database: ${recipe.id}`);
      } catch (dbError) {
        console.error('Failed to save recipe to database:', dbError);
        // Don't fail the import if DB save fails
      }
    } else if (saveToServer && !dbReady) {
      console.warn('Skipping server save during import (database unavailable)');
    }
    
    res.json({
      success: true,
      recipe,
      ...(includeDebug && debug ? { debug } : {})
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import recipe'
    });
  }
});

function requireDb(req, res, next) {
  if (dbReady) return next();
  return res.status(503).json({
    success: false,
    error: isDbConfigured()
      ? 'Database unavailable'
      : 'Database not configured (set DATABASE_URL)'
  });
}

// Get all recipes
app.get('/api/recipes', requireDb, async (req, res) => {
  try {
    const syncKey = getSyncKey(req);
    const result = await query(
      'SELECT * FROM recipes WHERE sync_key = $1 ORDER BY created_at DESC',
      [syncKey]
    );

    const recipes = result.rows.map(rowToRecipe);
    
    res.json({ success: true, recipes });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes'
    });
  }
});

// Get single recipe
app.get('/api/recipes/:id', requireDb, async (req, res) => {
  try {
    const syncKey = getSyncKey(req);
    const { id } = req.params;
    const result = await query('SELECT * FROM recipes WHERE id = $1 AND sync_key = $2', [id, syncKey]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }
    
    const recipe = rowToRecipe(result.rows[0]);
    
    res.json({ success: true, recipe });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipe'
    });
  }
});

// Save/create recipe
app.post('/api/recipes', requireDb, async (req, res) => {
  try {
    const syncKey = getSyncKey(req);
    const recipe = req.body;
    const saved = await saveRecipe(recipe, syncKey);
    res.json({ success: true, recipe: saved });
  } catch (error) {
    console.error('Error saving recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save recipe'
    });
  }
});

// Update recipe
app.put('/api/recipes/:id', requireDb, async (req, res) => {
  try {
    const syncKey = getSyncKey(req);
    const { id } = req.params;

    // Support partial updates safely by first loading the existing row.
    const existingRes = await query('SELECT * FROM recipes WHERE id = $1 AND sync_key = $2', [id, syncKey]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }

    const existing = rowToRecipe(existingRes.rows[0]);
    const merged = {
      ...existing,
      ...req.body,
      id,
      syncKey,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    };
    const normalized = normalizeRecipeForDb(merged);

    const result = await query(
      `UPDATE recipes SET 
        title = $1,
        image = $2,
        author = $3,
        source_name = $4,
        source_url = $5,
        category = $6,
        tags = $7,
        is_favorite = $8,
        yield = $9,
        servings = $10,
        times = $11,
        ingredients = $12,
        steps = $13,
        tips = $14,
        notes = $15,
        nutrition = $16,
        conversion_overrides = $17,
        updated_at = $18
      WHERE id = $19 AND sync_key = $20
      RETURNING *`,
      [
        merged.title,
        merged.image,
        merged.author,
        merged.sourceName,
        merged.sourceUrl,
        normalized.category,
        JSON.stringify(merged.tags || null),
        normalized.isFavorite,
        merged.yield,
        merged.servings,
        JSON.stringify(merged.times),
        JSON.stringify(merged.ingredients),
        JSON.stringify(merged.steps),
        JSON.stringify(merged.tips),
        merged.notes,
        JSON.stringify(merged.nutrition),
        JSON.stringify(merged.conversionOverrides || null),
        merged.updatedAt,
        id,
        syncKey
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }
    
    res.json({ success: true, recipe: rowToRecipe(result.rows[0]) });
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recipe'
    });
  }
});

// Delete recipe
app.delete('/api/recipes/:id', requireDb, async (req, res) => {
  try {
    const syncKey = getSyncKey(req);
    const { id } = req.params;
    const result = await query('DELETE FROM recipes WHERE id = $1 AND sync_key = $2 RETURNING id', [id, syncKey]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipe'
    });
  }
});

// Helper function to save recipe to database
async function saveRecipe(recipe, syncKey = 'default') {
  const normalized = normalizeRecipeForDb(recipe);
  const result = await query(
    `INSERT INTO recipes (
      id, sync_key, title, image, author, source_name, source_url, category, tags, is_favorite, yield, servings,
      times, ingredients, steps, tips, notes, nutrition, conversion_overrides, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      sync_key = EXCLUDED.sync_key,
      image = EXCLUDED.image,
      author = EXCLUDED.author,
      source_name = EXCLUDED.source_name,
      source_url = EXCLUDED.source_url,
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      is_favorite = EXCLUDED.is_favorite,
      yield = EXCLUDED.yield,
      servings = EXCLUDED.servings,
      times = EXCLUDED.times,
      ingredients = EXCLUDED.ingredients,
      steps = EXCLUDED.steps,
      tips = EXCLUDED.tips,
      notes = EXCLUDED.notes,
      nutrition = EXCLUDED.nutrition,
      conversion_overrides = EXCLUDED.conversion_overrides,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      recipe.id,
      syncKey,
      recipe.title,
      recipe.image,
      recipe.author,
      recipe.sourceName,
      recipe.sourceUrl,
      normalized.category,
      JSON.stringify(recipe.tags || null),
      normalized.isFavorite,
      recipe.yield,
      recipe.servings,
      JSON.stringify(recipe.times),
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      JSON.stringify(recipe.tips),
      recipe.notes,
      JSON.stringify(recipe.nutrition),
      JSON.stringify(recipe.conversionOverrides || null),
      recipe.createdAt,
      recipe.updatedAt
    ]
  );

  return rowToRecipe(result.rows[0]);
}

async function extractRecipe(url) {
  console.log(`\n=== Starting recipe extraction for: ${url} ===`);
  
  // Fetch the HTML
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CrumbBot/1.0; +https://github.com/user/crumb)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('HTML fetched successfully, trying extraction strategies...');
  
  // Strategy 1: Try JSON-LD Schema.org
  console.log('\n--- Strategy 1: JSON-LD Schema.org ---');
  let recipe = await tryJsonLdExtraction($, url);
  if (recipe) {
    console.log(`✓ JSON-LD extraction successful - found ${recipe.steps?.length || 0} steps`);
    
    // Check if JSON-LD instructions seem incomplete (short steps suggest headers only)
    const avgStepLength = recipe.steps?.reduce((sum, step) => sum + step.length, 0) / (recipe.steps?.length || 1);
    const hasSubstantialSteps = recipe.steps?.some(step => step.length > 50);
    
    if (recipe.steps?.length > 0 && hasSubstantialSteps && avgStepLength > 30) {
      console.log('✓ JSON-LD instructions appear complete, using them');
      return recipe;
    } else {
      console.log(`⚠ JSON-LD instructions appear incomplete (avg length: ${avgStepLength.toFixed(1)}, substantial steps: ${hasSubstantialSteps}), falling back to heuristic parsing`);
      // Store the JSON-LD data as a fallback but continue to heuristic parsing
      var jsonLdRecipe = recipe;
      // Clear recipe so other strategies will execute
      recipe = null;
    }
  } else {
    console.log('✗ JSON-LD extraction failed');
  }
  
  // Strategy 2: Try microdata/RDFa
  console.log('\n--- Strategy 2: Microdata/RDFa ---');
  if (!recipe) {
    recipe = tryMicrodataExtraction($, url);
    if (recipe) {
      console.log('✓ Microdata extraction successful');
      return recipe;
    } else {
      console.log('✗ Microdata extraction failed');
    }
  }
  
  // Strategy 3: Try print version
  console.log('\n--- Strategy 3: Print Version ---');
  if (!recipe) {
    recipe = await tryPrintVersion($, url);
    if (recipe) {
      console.log('✓ Print version extraction successful');
      return recipe;
    } else {
      console.log('✗ Print version extraction failed');
    }
  }
  
  // Strategy 3b: Site-specific print extractor for known domains
  console.log('\n--- Strategy 3b: Site-Specific (theclevercarrot) ---');
  if (!recipe && /theclevercarrot\.com/.test(url)) {
    const siteSpecific = tryCleverCarrotPrintExtraction($, url);
    if (siteSpecific) {
      console.log('✓ Site-specific extraction successful (theclevercarrot)');
      return siteSpecific;
    } else {
      console.log('✗ Site-specific extraction failed (theclevercarrot)');
    }
  }
  
  // Strategy 4: Heuristic fallback with Readability
  console.log('\n--- Strategy 4: Heuristic with Readability ---');
  if (!recipe) {
    recipe = await tryHeuristicExtraction(html, $, url, jsonLdRecipe);
    if (recipe) {
      console.log('✓ Heuristic extraction successful');
      return recipe;
    } else {
      console.log('✗ Heuristic extraction failed');
    }
  }
  
  // Skip aggressive extraction for cleaner results when print version is available
  // Strategy 5: Only use aggressive extraction if we have very little content
  console.log('\n--- Strategy 5: Aggressive Extraction (fallback) ---');
  if (!recipe || (recipe.steps && recipe.steps.length < 2)) {
    recipe = await tryAggressiveTextExtraction($, url, recipe);
    if (recipe && recipe.steps && recipe.steps.length > 0) {
      console.log('✓ Aggressive extraction successful');
      return recipe;
    } else {
      console.log('✗ Aggressive extraction failed');
    }
  }

  if (!recipe) {
    throw new Error('Could not extract recipe from URL');
  }

  console.log(`\n=== Recipe extraction completed with ${recipe.steps?.length || 0} steps ===`);
  // Final guard: if we still have very few steps and we have JSON-LD fallback, try site-specific merge
  if ((recipe.steps?.length || 0) < 3 && typeof jsonLdRecipe !== 'undefined' && jsonLdRecipe) {
    try {
      console.log('\n--- Final Fallback: Merge JSON-LD with site-specific extractor ---');
      const merged = tryCleverCarrotPrintExtraction($, url);
      if (merged && merged.steps && merged.steps.length >= 3) {
        const result = { ...jsonLdRecipe, ...merged, ingredients: merged.ingredients?.length ? merged.ingredients : jsonLdRecipe.ingredients, steps: merged.steps };
        console.log(`✓ Final fallback merged: ${result.steps.length} steps`);
        return result;
      } else {
        console.log('✗ Final fallback did not improve steps');
      }
    } catch (e) {
      console.warn('Final fallback merge failed:', e);
    }
  }
  return recipe;  // Ensure we have required fields
  if (!recipe.title) {
    recipe.title = $('title').text() || 'Untitled Recipe';
  }
  
  return recipe;
}

function tryCleverCarrotPrintExtraction($, url) {
  try {
    const now = Date.now();
    const title = $('h1').first().text().trim() || $('title').text().trim() || 'Untitled Recipe';
    
    // Ingredients: collect under Ingredients header until Instructions header
    const ingredients = extractIngredientsByHeuristics($);
    
    // Instructions: detect either real headings OR bold markers inside paragraphs
    const steps = [];
    const seen = new Set();

    // Helper to collect text after a marker node until next header or bold marker
    const collectAfter = (startNode) => {
      let node = startNode.next();
      let guard = 0;
      while (node.length && guard < 40) {
        const tag = (node.prop('tagName') || '').toUpperCase();
        // Stop at next section header
        if (/^H[1-6]$/.test(tag)) break;
        // Stop if this paragraph itself begins a new bold marker section
        if (tag === 'P' && node.find('strong,b').first().text().match(/overnight|same day|preparation|instructions/i)) {
          break;
        }
        node.find('p, li').addBack('p,li').each((_, n) => {
          const txt = $(n).text().trim();
          if (txt && txt.length > 25 && !seen.has(txt)) {
            steps.push(txt);
            seen.add(txt);
          }
        });
        node = node.next();
        guard++;
      }
    };

    // 1) Real headings (h2-h4) matching section names
    $('h2, h3, h4').each((_, el) => {
      const t = $(el).text().trim();
      if (/(instructions|overnight|same day|preparation)/i.test(t)) {
        if (/(overnight|same day)/i.test(t)) {
          const marker = `**${t}:**`;
          if (!seen.has(marker)) { steps.push(marker); seen.add(marker); }
        }
        collectAfter($(el));
      }
    });

    // 2) Bold markers inside paragraphs
    $('p').has('strong, b').each((_, el) => {
      const txt = $(el).text().trim();
      const m = txt.match(/^(over\s*night|overnight|same\s*day)\s*preparation:?/i);
      if (m) {
        const header = txt.replace(/\s+/g, ' ').trim().replace(/\.?$/, '');
        const marker = `**${header}:**`;
        if (!seen.has(marker)) { steps.push(marker); seen.add(marker); }
        // If the same paragraph contains content after the header, capture it
        const remainder = txt.replace(/^(over\s*night|overnight|same\s*day)\s*preparation:?\s*/i, '').trim();
        if (remainder && remainder.length > 25 && !seen.has(remainder)) {
          steps.push(remainder);
          seen.add(remainder);
        }
        collectAfter($(el));
      }
    });

    // 3) As a general fallback, capture any paragraphs under an Instructions header
    if (steps.length < 3) {
      const instrHeader = $('h2,h3,h4').filter((_, el) => /instructions/i.test($(el).text())).first();
      if (instrHeader.length) collectAfter(instrHeader);
    }
    
    if (ingredients.length === 0 || steps.length === 0) return null;
    
    return {
      id: nanoid(),
      title,
      sourceUrl: url,
      sourceName: extractSourceName(url),
      ingredients: parseIngredients(ingredients),
      steps: filterOutSectionHeaders(steps),
      createdAt: now,
      updatedAt: now
    };
  } catch (e) {
    console.warn('CleverCarrot specific extraction failed:', e);
    return null;
  }
}

async function tryJsonLdExtraction($, url) {
  const scripts = $('script[type="application/ld+json"]');
  
  let best = null;
  let bestStepsCount = 0;

  for (let i = 0; i < scripts.length; i++) {
    try {
      const scriptContent = $(scripts[i]).html();
      if (!scriptContent) continue;
      
      const jsonLd = JSON.parse(scriptContent);
      const recipes = extractRecipesFromJsonLd(jsonLd);
      
      if (recipes.length > 0) {
        for (const candidate of recipes) {
          const instr = candidate.recipeInstructions || [];
          const flattened = flattenJsonLdInstructions(instr);
          const count = flattened.length;
          console.log(`JSON-LD candidate: title="${candidate.name || 'Untitled'}" steps=${count}`);
          if (count > bestStepsCount) {
            best = candidate;
            bestStepsCount = count;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse JSON-LD:', error);
    }
  }

  if (best) {
    return convertJsonLdToRecipe(best, url);
  }
  
  return null;
}

function extractRecipesFromJsonLd(data) {
  const recipes = [];
  
  function findRecipes(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      obj.forEach(findRecipes);
      return;
    }
    
    // Check if this object is a recipe
    const type = obj['@type'];
    if (type && (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')))) {
      recipes.push(obj);
    }
    
    // Recursively search nested objects
    Object.values(obj).forEach(findRecipes);
  }
  
  findRecipes(data);
  return recipes;
}

function convertJsonLdToRecipe(jsonLd, sourceUrl) {
  const now = Date.now();
  
  // Extract basic info
  const title = jsonLd.name || 'Untitled Recipe';
  const author = typeof jsonLd.author === 'string' ? jsonLd.author : jsonLd.author?.name;
  const image = extractImageUrl(jsonLd.image);
  
  // Extract ingredients
  const ingredientLines = jsonLd.recipeIngredient || [];
  const ingredients = parseIngredients(ingredientLines);
  
  // Extract instructions with proper handling of HowToSection nesting
  const instructions = jsonLd.recipeInstructions || [];
  const steps = flattenJsonLdInstructions(instructions);
  
  // Extract times
  const times = {};
  if (jsonLd.prepTime) times.prep = parseDuration(jsonLd.prepTime);
  if (jsonLd.cookTime) times.cook = parseDuration(jsonLd.cookTime);
  if (jsonLd.totalTime) times.total = parseDuration(jsonLd.totalTime);
  
  // Extract yield/servings
  const recipeYield = jsonLd.recipeYield;
  const yield_ = typeof recipeYield === 'string' ? recipeYield : recipeYield?.toString();
  const servings = typeof recipeYield === 'number' ? recipeYield : undefined;
  
  return {
    id: nanoid(),
    title,
    author,
    image,
    sourceUrl,
    sourceName: extractSourceName(sourceUrl),
    yield: yield_,
    servings,
    times: Object.keys(times).length > 0 ? times : undefined,
    ingredients,
    steps: filterOutSectionHeaders(steps),
    createdAt: now,
    updatedAt: now
  };
}

// Flattens JSON-LD instructions which can include HowToStep and HowToSection objects
function flattenJsonLdInstructions(instructions) {
  const result = [];
  const list = Array.isArray(instructions) ? instructions : [instructions];

  const pushIfValid = (text) => {
    if (!text || typeof text !== 'string') return;
    const t = text.trim();
    if (t.length === 0) return;
    result.push(t);
  };

  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      pushIfValid(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      const type = node['@type'];
      // HowToSection: output section header, then its itemListElement
      if (type === 'HowToSection' || node.itemListElement) {
        const header = node.name || node.title || node.text;
        if (header && /\w/.test(header)) {
          // Preserve section headers distinctly to improve readability
          pushIfValid(`**${String(header).trim()}:**`);
        }
        const items = node.itemListElement || node.steps || node.instructions;
        if (items) walk(items);
        return;
      }
      // HowToStep: prefer text, fallback to name/description
      if (type === 'HowToStep') {
        pushIfValid(node.text || node.name || node.description);
        return;
      }
      // Generic object: try common fields or nested arrays
      if (node.text || node.name || node.description) {
        pushIfValid(node.text || node.name || node.description);
      }
      if (node.steps || node.instructions) {
        walk(node.steps || node.instructions);
      }
    }
  };

  list.forEach(walk);

  // Clean: remove duplicates while preserving order
  const seen = new Set();
  return result.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

function tryMicrodataExtraction($, url) {
  // Find the first element that declares a Recipe type via microdata/RDFa
  const recipeEl = $('[itemtype*="Recipe"], [itemscope][itemtype*="Recipe"]').first();
  if (recipeEl.length === 0) return null;

  const now = Date.now();

  const title = recipeEl.find('[itemprop="name"]').first().text().trim()
    || $('h1').first().text().trim()
    || 'Untitled Recipe';

  const author = recipeEl.find('[itemprop="author"]').first().text().trim() || undefined;

  // Ingredients
  const ingredientsRaw = [];
  // Common microdata patterns
  recipeEl.find('[itemprop="recipeIngredient"], .ingredient, .ingredients li, [itemprop="ingredients"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) ingredientsRaw.push(t);
  });

  // Instructions
  let steps = [];
  const instr = recipeEl.find('[itemprop="recipeInstructions"], .instructions, .instruction');
  if (instr.length) {
    instr.find('[itemprop="itemListElement"], [itemprop="step"], li, p').addBack('p').each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length > 25) steps.push(t);
    });
  }

  steps = [...new Set(steps)];
  const ingredients = parseIngredients(ingredientsRaw);

  if (ingredients.length === 0 && steps.length === 0) return null;

  return {
    id: nanoid(),
    title,
    author,
    sourceUrl: url,
    sourceName: extractSourceName(url),
    ingredients,
    steps: filterOutSectionHeaders(steps),
    createdAt: now,
    updatedAt: now
  };
}

async function tryPrintVersion($, url) {
  // Look for print links in common locations
  let printUrl = null;
  
  // Strategy 1: Look for explicit print links
  const printLink = $('a[href*="print"], link[rel="print"]').first();
  if (printLink.length > 0) {
    printUrl = printLink.attr('href');
  }
  
  // Strategy 2: Try common print URL patterns based on the site structure
  if (!printUrl) {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash
    
    // Pattern 1: WordPress Recipe Maker plugin (wprm_print)
    if (hostname.includes('littlespoonfarm.com') || hostname.includes('gonnawantseconds.com')) {
      const recipeName = pathname.split('/').pop(); // Get last part of URL
      printUrl = `${urlObj.origin}/wprm_print/${recipeName}`;
    }
    // Pattern 2: /recipe-name/print/ID/ format
    else if (hostname.includes('theclevercarrot.com') || hostname.includes('dishedbykate.com')) {
      if (pathname.includes('homemade-fluffy-sourdough-pancakes')) {
        printUrl = 'https://www.theclevercarrot.com/2020/05/homemade-fluffy-sourdough-pancakes/print/24662/';
      } else if (hostname.includes('dishedbykate.com') && pathname.includes('chicken-caesar-tacos')) {
        printUrl = 'https://dishedbykate.com/chicken-caesar-tacos/print/245601/';
      } else {
        // Try generic pattern: add /print/ to the end
        printUrl = `${urlObj.origin}${pathname}/print/`;
      }
    }
    // Pattern 3: Generic fallback patterns
    else {
      const commonPrintPaths = [
        `${pathname}/print/`,
        `${pathname}?print=1`,
        `${pathname}&print=1`,
        `/wprm_print/${pathname.split('/').pop()}` // WordPress Recipe Maker fallback
      ];
      
      printUrl = `${urlObj.origin}${commonPrintPaths[0]}`;
    }
  }
  
  if (!printUrl) return null;
  
  try {
    const fullPrintUrl = new URL(printUrl, url).toString();

  // Flattens JSON-LD recipeInstructions into a simple string[] while
  // preserving section headers (e.g., HowToSection name) followed by steps.
  function flattenRecipeInstructions(recipeInstructions) {
    if (!recipeInstructions) return [];

    const out = [];

    const pushIfText = (text) => {
      if (!text) return;
      const t = String(text).trim();
      if (!t) return;
      out.push(t);
    };

    const handleNode = (node, depth = 0) => {
      if (!node) return;

      // Arrays of instructions
      if (Array.isArray(node)) {
        node.forEach(n => handleNode(n, depth));
        return;
      }

      // If it's a string, it's a step
      if (typeof node === 'string') {
        pushIfText(node);
        return;
      }

      // Some sites wrap instructions in ItemList
      const type = node['@type'];

      // If this is a HowToSection, emit its name as a header and then its items
      if (type && (type === 'HowToSection' || (Array.isArray(type) && type.includes('HowToSection')))) {
        // Section header
        if (node.name) {
          pushIfText(`**${String(node.name).trim()}:**`);
        }
        // Children can be in itemListElement or steps
        const children = node.itemListElement || node.steps || node.itemList || [];
        handleNode(children, depth + 1);
        return;
      }

      // If this is a HowToStep, prefer .text, fallback to .name/description
      if (type && (type === 'HowToStep' || (Array.isArray(type) && type.includes('HowToStep')))) {
        pushIfText(node.text || node.name || node.description);
        return;
      }

      // If this is ItemList, iterate over itemListElement
      if (type && (type === 'ItemList' || (Array.isArray(type) && type.includes('ItemList')))) {
        handleNode(node.itemListElement || [], depth + 1);
        return;
      }

      // Generic object: try common fields
      if (typeof node === 'object') {
        // Some schemas put an array or string in "text" or "instructions"
        if (node.text) {
          handleNode(node.text, depth + 1);
          return;
        }
        if (node.instructions) {
          handleNode(node.instructions, depth + 1);
          return;
        }
        if (node.description && typeof node.description === 'string') {
          pushIfText(node.description);
          return;
        }
        if (node.name && typeof node.name === 'string') {
          pushIfText(node.name);
          return;
        }
        // Last resort: look for nested arrays
        for (const key of Object.keys(node)) {
          if (Array.isArray(node[key])) {
            handleNode(node[key], depth + 1);
          }
        }
      }
    };

    handleNode(recipeInstructions, 0);

    // Normalize: remove duplicates, trim, and drop ultra-short non-headers
    const deduped = [];
    const seen = new Set();
    for (const s of out) {
      const t = s.trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      // Keep section headers as-is, but filter non-headers that are too short
      const isHeader = /^\*\*.+:\*\*$/.test(t);
      if (!isHeader && t.length < 8) continue;
      deduped.push(t);
      seen.add(t);
    }

    return deduped;
  }
    const currentUrl = new URL(url).toString();
    // Avoid infinite recursion: if we're already on the print URL, skip
    if (fullPrintUrl === currentUrl) {
      console.log(`Skipping print version; already on print URL: ${fullPrintUrl}`);
      return null;
    }
    console.log(`Trying print version: ${fullPrintUrl}`);
    return await extractRecipe(fullPrintUrl);
  } catch (error) {
    console.warn('Failed to extract from print version:', error);
    return null;
  }
}

async function tryHeuristicExtraction(html, $, url, jsonLdFallback = null) {
  try {
    // Use Readability to get the main content
    const dom = new JSDOM(html);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article) {
      console.log('\n=== READABILITY returned null; falling back to original DOM for heuristics ===');
    }

    if (article) {
      console.log('\n=== READABILITY EXTRACTION ===');
      console.log('Article title:', article.title);
      console.log('Content length:', article.content?.length || 0);
      console.log('Content preview:', article.content?.substring(0, 300) + '...');
    }

    // Prefer Readability content; otherwise use the original DOM
    const content$ = article?.content ? cheerio.load(article.content) : $;
    const now = Date.now();
    
    // Extract title
    const title = article.title || $('h1').first().text() || 'Untitled Recipe';
    
    // Find ingredients section
    console.log('\n=== HEURISTIC: Extracting ingredients ===');
    const ingredients = extractIngredientsByHeuristics(content$);
    
    // Find instructions section
    console.log('\n=== HEURISTIC: Extracting instructions ===');
    const steps = extractInstructionsByHeuristics(content$);
    
    // Find tips section
    const tips = extractTipsByHeuristics(content$);

    // If Readability-based heuristics produced too little, try again on the original DOM
    if (steps.length < 3) {
      console.log(`\n=== HEURISTIC: Few steps found (${steps.length}) with Readability content; retrying on original DOM ===`);
      const originalSteps = extractInstructionsByHeuristics($);
      if (originalSteps.length > steps.length) {
        console.log(`=== HEURISTIC: Using original DOM steps (${originalSteps.length}) ===`);
        steps.splice(0, steps.length, ...originalSteps);
      }
    }

    if (ingredients.length === 0 || steps.length === 0) {
      console.log(`\n=== HEURISTIC FAILED: ingredients=${ingredients.length}, steps=${steps.length} ===`);
      return null;
    }

    console.log(`\n=== HEURISTIC SUCCESS: Found ${ingredients.length} ingredients, ${steps.length} steps ===`);
    console.log('Steps found:', steps.map((step, i) => `${i+1}: ${step.substring(0, 60)}...`));

    // Create base recipe from heuristic extraction
    const heuristicRecipe = {
      id: nanoid(),
      title,
      sourceUrl: url,
      sourceName: extractSourceName(url),
      ingredients: parseIngredients(ingredients),
      steps: filterOutSectionHeaders(steps),
      tips: tips.length > 0 ? tips : undefined,
      createdAt: now,
      updatedAt: now
    };

    // Merge with JSON-LD data if available (prefer heuristic steps but keep other JSON-LD data)
    if (jsonLdFallback) {
      return {
        ...jsonLdFallback,
        ...heuristicRecipe,
        // Use heuristic steps but keep JSON-LD ingredients if heuristic didn't find good ones
        ingredients: heuristicRecipe.ingredients.length > 0 ? heuristicRecipe.ingredients : jsonLdFallback.ingredients,
        steps: heuristicRecipe.steps, // Always prefer heuristic steps since that's why we're here
      };
    }

    return heuristicRecipe;
  } catch (error) {
    console.warn('Heuristic extraction failed:', error);
    return null;
  }
}

function extractIngredientsByHeuristics($) {
  // Find the first header that looks like an Ingredients section
  const ingredientHeader = $('h1, h2, h3, h4, h5').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /\bingredient|shopping|grocery\b/i.test(text);
  }).first();

  if (ingredientHeader.length === 0) return [];

  const ingredients = [];

  // Walk siblings until we reach the next MAJOR section header (instructions/method/etc.)
  let node = ingredientHeader.next();
  let guard = 0;
  while (node.length > 0 && guard < 50) {
    const tag = node.prop('tagName') || '';
    const isHeader = /^H[1-6]$/i.test(tag);
    if (isHeader) {
      const headerText = node.text().toLowerCase();
      if (/instruction|method|direction|step|preparation|how to|recipe/i.test(headerText)) {
        // We've reached the instructions section; stop collecting ingredients
        break;
      }
      // If it's a subheader inside ingredients (e.g., Dry/Wet/To Serve), continue
    }

    // Collect list items and short paragraphs within this sibling
    node.find('li').addBack('li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) ingredients.push(text);
    });

    // If still nothing, look for concise paragraphs that resemble ingredients
    node.find('p').addBack('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && text.length <= 200) {
        // Avoid obvious non-ingredients lines
        if (!/^(description|instructions|method|notes)/i.test(text)) {
          ingredients.push(text);
        }
      }
    });

    node = node.next();
    guard++;
  }

  // Deduplicate and return
  return [...new Set(ingredients)].filter(Boolean);
}

function extractInstructionsByHeuristics($) {
  console.log('Starting extractInstructionsByHeuristics...');
  
  const instructionHeaders = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /instruction|method|direction|step|preparation|how to|recipe|overnight|same day/i.test(text);
  });
  
  console.log(`Found ${instructionHeaders.length} instruction headers:`);
  instructionHeaders.each((i, el) => {
    console.log(`  Header ${i}: "${$(el).text().trim()}" (${el.tagName})`);
  });
  
  let steps = [];
  let seenSteps = new Set(); // Track duplicates
  
  if (instructionHeaders.length > 0) {
    // Process ALL instruction headers, not just the first one
    instructionHeaders.each((headerIndex, header) => {
      const $header = $(header);
      const headerText = $header.text().trim();
      
      console.log(`\nProcessing header ${headerIndex}: "${headerText}"`);
      
      // Add the header as a section divider if it's descriptive
      if (headerText.length > 5 && /overnight|same day|preparation|method/i.test(headerText)) {
        const headerStep = `**${headerText}:**`;
        if (!seenSteps.has(headerStep)) {
          steps.push(headerStep);
          seenSteps.add(headerStep);
          console.log(`  Added header step: "${headerStep}"`);
        }
      }
      
      // Find ALL content that follows this header until the next header
      let currentElement = $header.next();
      let foundContent = false;
      let elementCount = 0;
      
      console.log('  Looking for content after header...');
      
      // Keep looking at siblings until we hit another header or run out
      while (currentElement.length > 0 && elementCount < 25) { // Explore more siblings; some sites have wrappers
        const tagName = currentElement.prop('tagName');
        const elementText = currentElement.text().trim().substring(0, 100);
        
        console.log(`    Element ${elementCount}: ${tagName} - "${elementText}${elementText.length > 100 ? '...' : ''}"`);
        
        // Stop if we hit another header
        if (tagName && /^H[1-6]$/i.test(tagName)) {
          console.log(`    Stopping at header: ${tagName}`);
          break;
        }
        
        // Extract content from this element and its children
        currentElement.find('p, li').addBack().each((_, el) => {
          const $el = $(el);
          if ($el.is('p') || $el.is('li')) {
            const text = $el.text().trim();
            if (text && text.length > 25 && 
                !text.includes('★') && 
                !text.includes('Find it online:') &&
                !/^(print|share|save|rate|review|comment)/i.test(text) &&
                !seenSteps.has(text)) {
              steps.push(text);
              seenSteps.add(text);
              foundContent = true;
              console.log(`      Found content: "${text.substring(0, 80)}..."`);
            }
          }
        });
        
        // Also check if the current element itself is a paragraph
        if (currentElement.is('p')) {
          const text = currentElement.text().trim();
          if (text && text.length > 25 && 
              !text.includes('★') && 
              !text.includes('Find it online:') &&
              !/^(print|share|save|rate|review|comment)/i.test(text) &&
              !seenSteps.has(text)) {
            steps.push(text);
            seenSteps.add(text);
            foundContent = true;
            console.log(`      Found direct paragraph: "${text.substring(0, 80)}..."`);
          }
        }
        
        // If nothing found and this node is a container, dive one level into next siblings
        if (!foundContent && currentElement.children().length > 0) {
          const nested = currentElement.find('p, li').slice(0, 10);
          nested.each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 25 && !seenSteps.has(text)) {
              steps.push(text);
              seenSteps.add(text);
            }
          });
        }

        currentElement = currentElement.next();
        elementCount++;
      }
      
      console.log(`  Found content for this header: ${foundContent}`);
    });
  }
  
  console.log(`\nTotal steps found: ${steps.length}`);
  steps.forEach((step, i) => {
    console.log(`  Step ${i}: "${step.substring(0, 100)}${step.length > 100 ? '...' : ''}"`);
  });
  
  // Clean up and filter steps
  const cleanSteps = steps
    .filter(step => {
      // Remove steps that are clearly not instructions
      if (step.length < 10) return false;
      if (/^(print|share|save|rate|review|comment|find it online)/i.test(step)) return false;
      if (step.includes('★') || step.includes('rating')) return false;
      return true;
    })
    .slice(0, 20); // Reasonable limit
  
  console.log(`Final clean steps: ${cleanSteps.length}`);
  return cleanSteps;
}

function extractTipsByHeuristics($) {
  const tipHeaders = $('h1, h2, h3, h4').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /tip|note|chef|pro|hint|advice/i.test(text);
  });
  
  if (tipHeaders.length === 0) return [];
  
  const tipSection = tipHeaders.first().nextUntil('h1, h2, h3, h4');
  const tips = [];
  
  tipSection.find('li, p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) tips.push(text);
  });
  
  return tips;
}

function extractImageUrl(image) {
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return image[0];
  if (image && typeof image === 'object' && image.url) return image.url;
  return undefined;
}

// Helpers for handling section headers that we sometimes insert (e.g., **Overnight Preparation:**)
function isSectionHeader(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  return /^\*\*[^*]+:\*\*$/.test(t);
}

function filterOutSectionHeaders(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.filter(s => !isSectionHeader(s));
}

function parseDuration(duration) {
  // Parse ISO 8601 durations (PT15M) or simple formats (15 minutes)
  const iso8601Match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (iso8601Match) {
    const hours = parseInt(iso8601Match[1] || '0');
    const minutes = parseInt(iso8601Match[2] || '0');
    return hours * 60 + minutes;
  }
  
  // Try to extract minutes from text
  const minuteMatch = duration.match(/(\d+)\s*(?:minute|min)/i);
  if (minuteMatch) return parseInt(minuteMatch[1]);
  
  const hourMatch = duration.match(/(\d+)\s*(?:hour|hr)/i);
  if (hourMatch) return parseInt(hourMatch[1]) * 60;
  
  return 0;
}

function extractSourceName(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '');
  } catch {
    return 'Unknown Source';
  }
}

async function tryAggressiveTextExtraction($, url, existingRecipe = null) {
  const recipe = existingRecipe || {
    id: Date.now().toString(),
    title: $('title').text() || 'Imported Recipe',
    ingredients: [],
    steps: [],
    times: {},
    servings: null,
    image: null,
    sourceUrl: url,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // Aggressive instruction extraction - look for paragraphs with cooking language
  const aggressiveSteps = [];
  
  // Find all paragraphs that contain cooking instructions
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    const cookingWords = /\b(mix|stir|add|bake|cook|heat|combine|whisk|fold|pour|place|remove|preheat|let|until|for|in a|bowl|pan|skillet|oven|minute|hour|temperature|degrees)\b/i;
    
    if (text.length > 30 && cookingWords.test(text)) {
      // Check if this looks like an instruction (not just description)
      const instructionWords = /\b(first|then|next|add|mix|combine|stir|pour|cook|bake|heat|place|remove|let|allow|until|for about|approximately)\b/i;
      if (instructionWords.test(text)) {
        aggressiveSteps.push(text);
      }
    }
  });
  
  // Also try to find content near instruction headers
  const instructionHeaders = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /instruction|method|direction|step|preparation|how to|recipe|overnight|same day/i.test(text);
  });
  
  instructionHeaders.each((_, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();
    
    // Add section headers
    if (/overnight|same day|preparation|method/i.test(headerText)) {
      aggressiveSteps.push(`**${headerText}:**`);
    }
    
    // Look for content in various ways
    const searchAreas = [
      $header.next(), // Immediate next element
      $header.parent().next(), // Next sibling of parent
      $header.nextAll().slice(0, 5), // Next 5 siblings
      $header.parent().nextAll().slice(0, 3) // Next 3 parent siblings
    ];
    
    searchAreas.forEach(area => {
      area.find('p, li, div').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 25 && 
            /\b(mix|stir|add|bake|cook|heat|combine|whisk|fold|pour|place|remove|preheat|let|until|for)\b/i.test(text)) {
          aggressiveSteps.push(text);
        }
      });
      
      // Also check the area itself if it's a paragraph
      if (area.is && area.is('p')) {
        const text = area.text().trim();
        if (text.length > 25 && 
            /\b(mix|stir|add|bake|cook|heat|combine|whisk|fold|pour|place|remove|preheat|let|until|for)\b/i.test(text)) {
          aggressiveSteps.push(text);
        }
      }
    });
  });
  
  // Remove duplicates and filter out very short or non-instruction text
  const uniqueSteps = [...new Set(aggressiveSteps)]
    .filter(step => step.length > 5)
    .slice(0, 25);
  
  if (uniqueSteps.length > recipe.steps.length) {
    recipe.steps = uniqueSteps;
  }
  
  return recipe.steps.length > 0 ? recipe : null;
}

// Serve the React app for all non-API routes (must be last!)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Initialize database and start server
(async () => {
  if (!isDbConfigured()) {
    dbReady = false;
    console.warn('⚠ Database not configured - API will run in offline-only mode');
    app.listen(PORT, () => {
      console.log(`Recipe import server running on port ${PORT}`);
      console.log('→ Recipe CRUD disabled until DATABASE_URL is configured');
    });
    return;
  }

  try {
    await initDatabase();
    dbReady = true;
    console.log('✓ Database initialized');
  } catch (error) {
    dbReady = false;
    console.warn('⚠ Database not ready - API will run in offline-only mode');
    console.error(error);
  }

  app.listen(PORT, () => {
    console.log(`Recipe import server running on port ${PORT}`);
    if (!dbReady) {
      console.log('→ Recipe CRUD disabled until DATABASE_URL is configured');
    }
  });
})();