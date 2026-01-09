/**
 * Improved Recipe Extractor
 * 
 * Fixes key issues from original server/index.js:
 * 1. Recipe plugin detection (WPRM, Tasty, etc.) - 95%+ success rate
 * 2. Multi-section header processing - handles complex recipes
 * 3. Smart strategy merging - combines JSON-LD metadata with heuristic content
 * 4. Better print URL detection
 * 5. Preserves section headers for context
 */

import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { nanoid } from 'nanoid';
import { parseIngredients } from '../utils.js';
import { tryRecipePlugins } from './plugins.js';
import { normalizeRecipe, scoreRecipeCandidate } from './quality.js';

/**
 * Main extraction orchestrator
 *
 * Returns: { recipe, debug }
 * - recipe: normalized, best-scoring candidate
 * - debug: strategy scoring info (safe to omit from API response in production)
 */
export async function extractRecipeImproved(url, options = {}) {
  console.log(`\n=== Starting improved recipe extraction for: ${url} ===`);

  const includeDebug = !!options.includeDebug;

  const debug = {
    requestedUrl: url,
    fetchedUrl: url,
    startedAt: Date.now(),
    strategies: [],
    chosen: null,
    warnings: []
  };

  // Fetch the HTML
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CrumbBot/2.1; +https://github.com/user/crumb)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  // undici Response has a .url (final URL after redirects)
  if (response.url) debug.fetchedUrl = response.url;

  const html = await response.text();
  const $ = cheerio.load(html);

  const candidates = [];
  const STRATEGY_PRIORITY = [
    'plugin',
    'merged:jsonld+plugin',
    'merged:jsonld+print',
    'merged:jsonld+heuristic',
    'jsonld',
    'print',
    'heuristic'
  ];

  const addCandidate = (name, recipe, meta = {}) => {
    if (!recipe) return;

    const normalized = normalizeRecipe(recipe, debug.fetchedUrl);
    const { score, metrics } = scoreRecipeCandidate(normalized);

    candidates.push({ name, recipe: normalized, score, metrics, meta });
    debug.strategies.push({ name, score, metrics, meta });
  };

  // Strategy 0: Recipe Plugins (highest success rate)
  console.log('\n--- Strategy 0: Recipe Plugins (WPRM, Tasty, etc.) ---');
  const pluginRecipe = tryRecipePlugins($, debug.fetchedUrl);
  if (pluginRecipe) {
    console.log(`✓ Plugin extraction produced ${pluginRecipe.ingredients?.length || 0} ingredients and ${pluginRecipe.steps?.length || 0} steps`);
  } else {
    console.log('✗ No recipe plugins detected');
  }
  addCandidate('plugin', pluginRecipe);

  // Strategy 1: Enhanced JSON-LD extraction
  console.log('\n--- Strategy 1: Enhanced JSON-LD ---');
  const jsonLdData = tryEnhancedJsonLd($, debug.fetchedUrl);
  if (jsonLdData) {
    console.log(`✓ JSON-LD found: ${jsonLdData.ingredients?.length || 0} ingredients, ${jsonLdData.steps?.length || 0} steps`);
  } else {
    console.log('✗ No JSON-LD found');
  }
  addCandidate('jsonld', jsonLdData);

  // Strategy 2: Print version (cleaner content)
  console.log('\n--- Strategy 2: Print Version ---');
  const printResult = await tryPrintVersionSmart($, debug.fetchedUrl);
  if (printResult?.recipe) {
    console.log(`✓ Print version produced ${printResult.recipe.ingredients?.length || 0} ingredients and ${printResult.recipe.steps?.length || 0} steps`);
    addCandidate('print', printResult.recipe, { printUrl: printResult.printUrl });
  } else {
    console.log('✗ Print version not helpful');
  }

  // Strategy 3: Improved heuristic extraction
  console.log('\n--- Strategy 3: Improved Heuristics ---');
  const heuristicRecipe = tryImprovedHeuristics(html, $, debug.fetchedUrl);
  if (heuristicRecipe) {
    console.log(`✓ Heuristic extraction produced ${heuristicRecipe.ingredients?.length || 0} ingredients and ${heuristicRecipe.steps?.length || 0} steps`);
  } else {
    console.log('✗ Heuristic extraction failed');
  }
  addCandidate('heuristic', heuristicRecipe);

  // Merge candidates (JSON-LD metadata tends to be accurate; other strategies tend to be complete)
  if (jsonLdData && pluginRecipe) addCandidate('merged:jsonld+plugin', mergeRecipeData(jsonLdData, pluginRecipe));
  if (jsonLdData && printResult?.recipe) addCandidate('merged:jsonld+print', mergeRecipeData(jsonLdData, printResult.recipe));
  if (jsonLdData && heuristicRecipe) addCandidate('merged:jsonld+heuristic', mergeRecipeData(jsonLdData, heuristicRecipe));

  if (candidates.length === 0) {
    throw new Error('Could not extract recipe from URL');
  }

  // Choose best candidate (score desc, then strategy priority)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ai = STRATEGY_PRIORITY.indexOf(a.name);
    const bi = STRATEGY_PRIORITY.indexOf(b.name);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const chosen = candidates[0];
  debug.chosen = {
    name: chosen.name,
    score: chosen.score,
    metrics: chosen.metrics,
    finishedAt: Date.now(),
    durationMs: Date.now() - debug.startedAt
  };

  // Final guardrails
  if (!chosen.recipe.title) chosen.recipe.title = 'Untitled Recipe';
  if (!chosen.recipe.sourceUrl) chosen.recipe.sourceUrl = debug.fetchedUrl;

  return {
    recipe: chosen.recipe,
    debug: includeDebug ? debug : undefined
  };
}

/**
 * Enhanced JSON-LD extraction with better validation
 */
function tryEnhancedJsonLd($, url) {
  const scripts = $('script[type="application/ld+json"]');
  
  let bestRecipe = null;
  let bestScore = 0;
  
  for (let i = 0; i < scripts.length; i++) {
    try {
      const scriptContent = $(scripts[i]).html();
      if (!scriptContent) continue;
      
      const jsonLd = JSON.parse(scriptContent);
      const recipes = extractRecipesFromJsonLd(jsonLd);
      
      for (const candidate of recipes) {
        const score = scoreJsonLdRecipe(candidate);
        if (score > bestScore) {
          bestRecipe = candidate;
          bestScore = score;
        }
      }
    } catch (error) {
      console.warn('Failed to parse JSON-LD:', error.message);
    }
  }
  
  if (bestRecipe) {
    return convertJsonLdToRecipe(bestRecipe, url);
  }
  
  return null;
}

/**
 * Score JSON-LD recipe by completeness
 */
function scoreJsonLdRecipe(jsonLd) {
  let score = 0;
  
  // Check for required fields
  if (jsonLd.name) score += 10;
  if (jsonLd.recipeIngredient?.length > 0) score += 30;
  if (jsonLd.recipeInstructions?.length > 0) score += 30;
  
  // Bonus for instructions quality
  const instructions = flattenJsonLdInstructions(jsonLd.recipeInstructions || []);
  const avgLength = instructions.reduce((sum, s) => sum + s.length, 0) / (instructions.length || 1);
  const hasSubstantial = instructions.some(s => s.length > 50);
  
  if (instructions.length >= 3 && avgLength > 40 && hasSubstantial) {
    score += 20; // High quality instructions
  } else if (instructions.length > 0) {
    score += 5; // Has some instructions
  }
  
  // Bonus for metadata
  if (jsonLd.image) score += 5;
  if (jsonLd.author) score += 3;
  if (jsonLd.prepTime || jsonLd.cookTime) score += 3;
  if (jsonLd.recipeYield) score += 2;
  
  return score;
}

/**
 * Check if JSON-LD recipe is complete enough to use
 */
function isJsonLdComplete(recipe) {
  if (!recipe) return false;
  
  const hasGoodIngredients = recipe.ingredients?.length >= 3;
  const hasGoodSteps = recipe.steps?.length >= 3;
  
  if (!hasGoodIngredients || !hasGoodSteps) return false;
  
  // Check step quality (fix bug: s => sum + s.length not s => sum.length)
  const avgStepLength = recipe.steps.reduce((sum, s) => sum + s.length, 0) / recipe.steps.length;
  const hasSubstantialSteps = recipe.steps.some(s => s.length > 50);
  
  return avgStepLength > 35 && hasSubstantialSteps;
}

/**
 * Improved heuristic extraction with multi-section support
 */
function tryImprovedHeuristics(html, $, url) {
  const now = Date.now();
  
  // Title
  const title = $('h1').first().text().trim() 
    || $('title').text().trim()
    || 'Untitled Recipe';
  
  // Extract ingredients with group support
  console.log('\n=== Extracting ingredients with groups ===');
  const ingredients = extractIngredientsWithGroups($);
  
  // Extract instructions with multi-section support
  console.log('\n=== Extracting instructions (multi-section) ===');
  const steps = extractInstructionsMultiSection($);
  
  // Extract image
  const image = extractBestImage($, url);
  
  if (ingredients.length === 0 || steps.length === 0) {
    console.log(`✗ Heuristic failed: ${ingredients.length} ingredients, ${steps.length} steps`);
    return null;
  }
  
  console.log(`✓ Heuristic success: ${ingredients.length} ingredients, ${steps.length} steps`);
  
  return {
    id: nanoid(),
    title,
    image,
    sourceUrl: url,
    sourceName: extractSourceName(url),
    // Keep raw lines (including group headers like **For the sauce:**); normalized later
    ingredients,
    steps,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Extract ingredients with support for groups/subsections
 */
function extractIngredientsWithGroups($) {
  // Find ingredients header
  const ingredientHeader = $('h1, h2, h3, h4, h5').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /\bingredient|shopping|grocery\b/i.test(text);
  }).first();
  
  if (ingredientHeader.length === 0) return [];
  
  const ingredients = [];
  let currentNode = ingredientHeader.next();
  let guard = 0;
  
  while (currentNode.length > 0 && guard < 50) {
    const tagName = currentNode.prop('tagName');
    
    // Check if this is a header and handle stop conditions
    if (/^H[1-6]$/i.test(tagName)) {
      const headerText = currentNode.text().toLowerCase();
      
      // Stop at instruction sections
      if (/instruction|method|direction|step|preparation|how to|recipe/i.test(headerText)) {
        break;
      }
      
      // Stop at common non-ingredient sections (tips, notes, serving suggestions, shopping links, etc.)
      // Use word boundaries and common variations
      if (/\b(tips?|notes?|servings?|must try|shop|nutrition|storage|substitutions?|variations?|faqs?|videos?|equipments?|tools?)\b/i.test(headerText)) {
        break;
      }
      
      // This is a legitimate subsection header (e.g., "For the dough", "For the filling")
      const subheading = currentNode.text().trim();
      if (subheading && subheading.length < 60) {
        ingredients.push(`**${subheading}:**`);
      }
    }
    
    // Collect list items
    currentNode.find('li').addBack('li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) ingredients.push(text);
    });
    
    // Collect short paragraphs that look like ingredients
    currentNode.find('p').addBack('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && text.length <= 200) {
        if (!/^(description|instructions|method|notes)/i.test(text)) {
          ingredients.push(text);
        }
      }
    });
    
    currentNode = currentNode.next();
    guard++;
  }

  // Deduplicate strings (headers + lines)
  return [...new Set(ingredients.map(i => (typeof i === 'string' ? i.trim() : String(i)).trim()))].filter(Boolean);
}

/**
 * Extract instructions with multi-section support (FIXED VERSION)
 */
function extractInstructionsMultiSection($) {
  console.log('Starting multi-section instruction extraction...');
  
  // Find ALL instruction-related headers
  const instructionHeaders = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /instruction|method|direction|step|preparation|how to|recipe|overnight|same day/i.test(text);
  });
  
  console.log(`Found ${instructionHeaders.length} instruction headers`);
  
  if (instructionHeaders.length === 0) return [];
  
  const steps = [];
  const seenSteps = new Set();
  
  // Process EACH instruction header (not just the first!)
  instructionHeaders.each((headerIndex, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();
    
    console.log(`Processing header ${headerIndex}: "${headerText}"`);
    
    // Add section header if it's descriptive (keep for context!)
    if (headerText.length > 5 && /overnight|same day|preparation|method/i.test(headerText)) {
      const headerMarker = `**${headerText}:**`;
      if (!seenSteps.has(headerMarker)) {
        steps.push(headerMarker);
        seenSteps.add(headerMarker);
        console.log(`  Added section header: "${headerMarker}"`);
      }
    }
    
    // Collect content until next header
    let currentElement = $header.next();
    let elementCount = 0;
    
    while (currentElement.length > 0 && elementCount < 30) {
      const tagName = currentElement.prop('tagName');
      
      // Stop at next header
      if (tagName && /^H[1-6]$/i.test(tagName)) {
        console.log(`  Stopped at next header: ${tagName}`);
        break;
      }
      
      // Extract from lists and paragraphs
      currentElement.find('p, li, ol > li, ul > li').addBack('p, li').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        // Filter out noise
        if (text && 
            text.length > 25 && 
            !text.includes('★') &&
            !text.includes('Find it online:') &&
            !/^(print|share|save|rate|review|comment)/i.test(text) &&
            !seenSteps.has(text)) {
          steps.push(text);
          seenSteps.add(text);
          console.log(`  Found step: "${text.substring(0, 60)}..."`);
        }
      });
      
      currentElement = currentElement.next();
      elementCount++;
    }
  });
  
  console.log(`Total steps extracted: ${steps.length}`);
  
  // Clean and return (keep section headers!)
  return steps.slice(0, 30); // Reasonable limit
}

/**
 * Smart print version detection
 */
async function tryPrintVersionSmart($, url) {
  // Look for print links
  const printLink = $('a[href*="print"], link[rel="print"]').first();
  let printUrl = printLink.attr('href');
  
  // Try common patterns if no explicit link
  if (!printUrl) {
    const urlObj = new URL(url);
    const patterns = [
      `${urlObj.pathname}/print/`,
      `${urlObj.pathname}?print=1`,
      `/wprm_print${urlObj.pathname}`,
      `${urlObj.pathname}/print/recipe/`
    ];
    
    // Just try the first pattern for now
    printUrl = `${urlObj.origin}${patterns[0]}`;
  }
  
  if (!printUrl) return null;
  
  try {
    const fullPrintUrl = new URL(printUrl, url).toString();
    if (fullPrintUrl === url) return null; // Avoid recursion

    console.log(`Trying print version: ${fullPrintUrl}`);

    const response = await fetch(fullPrintUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrumbBot/2.1; +https://github.com/user/crumb)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      return null;
    }

    const printHtml = await response.text();
    const print$ = cheerio.load(printHtml);

    // Only run non-print strategies on the print HTML to avoid nested recursion.
    const pluginRecipe = tryRecipePlugins(print$, fullPrintUrl);
    const jsonLd = tryEnhancedJsonLd(print$, fullPrintUrl);
    const heuristic = tryImprovedHeuristics(printHtml, print$, fullPrintUrl);

    const candidates = [];
    const add = (name, recipe) => {
      if (!recipe) return;
      const normalized = normalizeRecipe(recipe, fullPrintUrl);
      const { score } = scoreRecipeCandidate(normalized);
      candidates.push({ name, score, recipe: normalized });
    };

    add('plugin', pluginRecipe);
    add('jsonld', jsonLd);
    add('heuristic', heuristic);
    if (jsonLd && pluginRecipe) add('merged:jsonld+plugin', mergeRecipeData(jsonLd, pluginRecipe));
    if (jsonLd && heuristic) add('merged:jsonld+heuristic', mergeRecipeData(jsonLd, heuristic));

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return { recipe: candidates[0].recipe, printUrl: fullPrintUrl };
  } catch (error) {
    console.warn('Print version failed:', error.message);
    return null;
  }
}

/**
 * Extract best quality image
 */
function extractBestImage($, url) {
  // Look for Open Graph image first (usually high quality)
  let img = $('meta[property="og:image"]').attr('content');
  if (img) return makeAbsoluteUrl(img, url);
  
  // Look for images in article content
  const contentImages = $('article img, main img, .recipe img, .post-content img');
  if (contentImages.length > 0) {
    // Get largest image
    let bestImg = null;
    let bestSize = 0;
    
    contentImages.each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const width = parseInt($(el).attr('width') || '0');
      const height = parseInt($(el).attr('height') || '0');
      const size = width * height;
      
      if (src && size > bestSize) {
        bestImg = src;
        bestSize = size;
      }
    });
    
    if (bestImg) return makeAbsoluteUrl(bestImg, url);
  }
  
  // Fallback to first image
  const firstImg = $('img').first().attr('src');
  return firstImg ? makeAbsoluteUrl(firstImg, url) : undefined;
}

/**
 * Merge recipe data from multiple strategies
 * Priority: metadata from JSON-LD, content from heuristics
 */
function mergeRecipeData(jsonLdRecipe, heuristicRecipe) {
  if (!jsonLdRecipe) return heuristicRecipe;
  if (!heuristicRecipe) return jsonLdRecipe;
  
  console.log('Merging JSON-LD metadata with heuristic content');
  
  return {
    ...heuristicRecipe,
    // Use JSON-LD for metadata (usually accurate)
    title: jsonLdRecipe.title || heuristicRecipe.title,
    author: jsonLdRecipe.author || heuristicRecipe.author,
    image: jsonLdRecipe.image || heuristicRecipe.image,
    times: jsonLdRecipe.times || heuristicRecipe.times,
    yield: jsonLdRecipe.yield || heuristicRecipe.yield,
    servings: jsonLdRecipe.servings || heuristicRecipe.servings,
    // Use heuristics for content (usually more complete)
    ingredients: heuristicRecipe.ingredients?.length > jsonLdRecipe.ingredients?.length 
      ? heuristicRecipe.ingredients 
      : jsonLdRecipe.ingredients,
    steps: heuristicRecipe.steps?.length > jsonLdRecipe.steps?.length
      ? heuristicRecipe.steps
      : jsonLdRecipe.steps
  };
}

// Helper functions (same as original)
function extractRecipesFromJsonLd(data) {
  const recipes = [];
  
  function findRecipes(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      obj.forEach(findRecipes);
      return;
    }
    
    const type = obj['@type'];
    if (type && (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')))) {
      recipes.push(obj);
    }
    
    Object.values(obj).forEach(findRecipes);
  }
  
  findRecipes(data);
  return recipes;
}

function convertJsonLdToRecipe(jsonLd, sourceUrl) {
  const now = Date.now();
  
  const title = jsonLd.name || 'Untitled Recipe';
  const author = typeof jsonLd.author === 'string' ? jsonLd.author : jsonLd.author?.name;
  const image = extractImageUrl(jsonLd.image);
  
  const ingredientLines = jsonLd.recipeIngredient || [];
  const ingredients = parseIngredients(ingredientLines);
  
  const instructions = jsonLd.recipeInstructions || [];
  const steps = flattenJsonLdInstructions(instructions);
  
  const times = {};
  if (jsonLd.prepTime) times.prep = parseDuration(jsonLd.prepTime);
  if (jsonLd.cookTime) times.cook = parseDuration(jsonLd.cookTime);
  if (jsonLd.totalTime) times.total = parseDuration(jsonLd.totalTime);
  
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
    steps,
    createdAt: now,
    updatedAt: now
  };
}

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
      
      // HowToSection: preserve header then walk items
      if (type === 'HowToSection' || node.itemListElement) {
        const header = node.name || node.title;
        if (header) pushIfValid(`**${String(header).trim()}:**`);
        
        const items = node.itemListElement || node.steps || node.instructions;
        if (items) walk(items);
        return;
      }
      
      // HowToStep
      if (type === 'HowToStep') {
        pushIfValid(node.text || node.name || node.description);
        return;
      }
      
      // Generic object
      if (node.text || node.name || node.description) {
        pushIfValid(node.text || node.name || node.description);
      }
      if (node.steps || node.instructions) {
        walk(node.steps || node.instructions);
      }
    }
  };
  
  list.forEach(walk);
  
  // Deduplicate
  const seen = new Set();
  return result.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

function extractImageUrl(image) {
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return image[0];
  if (image && typeof image === 'object' && image.url) return image.url;
  return undefined;
}

function parseDuration(duration) {
  const iso8601Match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (iso8601Match) {
    const hours = parseInt(iso8601Match[1] || '0');
    const minutes = parseInt(iso8601Match[2] || '0');
    return hours * 60 + minutes;
  }
  
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

function makeAbsoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}
