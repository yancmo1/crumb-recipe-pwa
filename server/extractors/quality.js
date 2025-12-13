/**
 * Recipe quality + normalization helpers
 *
 * Goal: make extraction deterministic and easier to debug by:
 * - normalizing output shape (trim, de-dupe, remove obvious noise)
 * - scoring candidates consistently across strategies
 */

import { parseIngredients } from '../utils.js';

const SECTION_HEADER_RE = /^\*\*[^*]+:\*\*$/;

export function isSectionHeader(text) {
  if (!text || typeof text !== 'string') return false;
  return SECTION_HEADER_RE.test(text.trim());
}

function normalizeWhitespace(text) {
  return String(text)
    .replace(/\u00A0/g, ' ') // nbsp
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeNoiseStep(text) {
  const t = text.toLowerCase();
  if (t.length < 10) return true;
  if (/^(print|share|save|rate|review|comment)\b/.test(t)) return true;
  if (/^last\s+updated\b/.test(t)) return true;
  if (/^updated\b/.test(t)) return true;
  if (/^published\b/.test(t)) return true;
  if (t.includes('★') || t.includes('☆')) return true;
  if (t.includes('facebook') || t.includes('pinterest') || t.includes('instagram')) return true;
  if (t.includes('sign up') || t.includes('newsletter')) return true;
  return false;
}

export function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];

  const out = [];
  const seen = new Set();

  for (const s of steps) {
    if (s == null) continue;
    const t = normalizeWhitespace(s);
    if (!t) continue;

    if (isSectionHeader(t)) {
      // keep section headers, but de-dupe
      if (!seen.has(t)) {
        out.push(t);
        seen.add(t);
      }
      continue;
    }

    if (looksLikeNoiseStep(t)) continue;

    // Some sites embed multiple sentences that are really multiple steps; keep as-is for now
    if (!seen.has(t)) {
      out.push(t);
      seen.add(t);
    }
  }

  // Avoid absurdly long lists caused by article extraction
  return out.slice(0, 60);
}

function normalizeTitle(title) {
  const t = normalizeWhitespace(title || '');
  // Avoid ultra-long titles with site suffixes; keep simple trimming heuristics
  return t.replace(/\s*[|•\-–—]\s*[^|•\-–—]{2,}$/g, '').trim() || 'Untitled Recipe';
}

function makeAbsoluteUrl(maybeUrl, baseUrl) {
  if (!maybeUrl) return undefined;
  try {
    return new URL(String(maybeUrl), baseUrl).toString();
  } catch {
    return String(maybeUrl);
  }
}

function headerToken(raw) {
  let txt = normalizeWhitespace(raw);

  // Remove any existing markdown wrappers
  txt = txt.replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '');

  // Strip trailing colons/spaces to avoid "::" when we re-wrap
  txt = txt.replace(/\s*:+\s*$/, '').trim();

  return { raw: `**${txt}:**`, isGroupHeader: true };
}

export function normalizeIngredientTokens(input) {
  // Input can be:
  // - IngredientToken[]
  // - string[]
  // - mixed (from heuristic collectors)

  if (!Array.isArray(input)) return [];

  const out = [];
  const seen = new Set();

  for (const item of input) {
    if (item == null) continue;

    // Already a token-ish object
    if (typeof item === 'object' && typeof item.raw === 'string') {
      const raw = normalizeWhitespace(item.raw);
      if (!raw) continue;

      const isHeader = !!item.isGroupHeader || isSectionHeader(raw);
      const token = isHeader ? headerToken(raw) : { ...item, raw };
      const key = `${token.isGroupHeader ? 'H' : 'I'}:${token.raw}`;
      if (!seen.has(key)) {
        out.push(token);
        seen.add(key);
      }
      continue;
    }

    // String line
    const line = normalizeWhitespace(item);
    if (!line) continue;

    if (isSectionHeader(line) || /^\*\*.+\*\*$/.test(line) || line.endsWith(':')) {
      const token = headerToken(line);
      const key = `H:${token.raw}`;
      if (!seen.has(key)) {
        out.push(token);
        seen.add(key);
      }
      continue;
    }

    const parsed = parseIngredients([line])[0] || { raw: line };
    parsed.raw = normalizeWhitespace(parsed.raw || line);
    const key = `I:${parsed.raw}`;
    if (!seen.has(key)) {
      out.push(parsed);
      seen.add(key);
    }
  }

  return out;
}

export function computeRecipeMetrics(recipe) {
  const titleLen = recipe?.title ? normalizeWhitespace(recipe.title).length : 0;

  const ingredientsCount = Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0;
  const steps = Array.isArray(recipe?.steps) ? recipe.steps : [];
  const stepsCount = steps.length;

  const nonHeaderSteps = steps.filter(s => !isSectionHeader(s));
  const avgStepLength = nonHeaderSteps.length
    ? nonHeaderSteps.reduce((sum, s) => sum + String(s).length, 0) / nonHeaderSteps.length
    : 0;

  return {
    titleLen,
    ingredientsCount,
    stepsCount,
    avgStepLength,
    hasImage: !!recipe?.image,
    hasAuthor: !!recipe?.author,
    hasTimes: !!recipe?.times && Object.keys(recipe.times).length > 0,
    hasYield: !!recipe?.yield || typeof recipe?.servings === 'number'
  };
}

export function scoreRecipeCandidate(recipe) {
  const m = computeRecipeMetrics(recipe);

  let score = 0;

  // Hard requirements contribute most
  if (m.titleLen >= 4) score += 15;

  // Ingredients
  score += Math.min(35, m.ingredientsCount * 3.5);

  // Steps
  score += Math.min(35, m.stepsCount * 3.5);

  // Step quality
  if (m.stepsCount >= 3) {
    if (m.avgStepLength >= 45) score += 10;
    else if (m.avgStepLength >= 30) score += 7;
    else if (m.avgStepLength >= 20) score += 4;
    else score -= 5;
  }

  // Metadata bonuses
  if (m.hasImage) score += 3;
  if (m.hasAuthor) score += 2;
  if (m.hasTimes) score += 2;
  if (m.hasYield) score += 1;

  // Penalties for obviously bad shapes
  if (m.ingredientsCount < 2) score -= 25;
  if (m.stepsCount < 2) score -= 25;
  if (m.stepsCount > 80) score -= 10;

  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, metrics: m };
}

export function normalizeRecipe(recipe, baseUrl) {
  if (!recipe || typeof recipe !== 'object') return recipe;

  const normalized = { ...recipe };

  normalized.title = normalizeTitle(normalized.title);
  if (normalized.image) {
    // Drop common lazy-load placeholders (these break the UI and shouldn't count as "has image")
    if (typeof normalized.image === 'string' && normalized.image.startsWith('data:image')) {
      normalized.image = undefined;
    } else {
      normalized.image = makeAbsoluteUrl(normalized.image, baseUrl || normalized.sourceUrl);
    }
  }

  normalized.ingredients = normalizeIngredientTokens(normalized.ingredients);
  normalized.steps = normalizeSteps(normalized.steps);

  // Ensure sourceUrl is present and absolute
  if (normalized.sourceUrl) normalized.sourceUrl = makeAbsoluteUrl(normalized.sourceUrl, baseUrl || normalized.sourceUrl);

  // Defensive defaults
  if (!normalized.createdAt) normalized.createdAt = Date.now();
  if (!normalized.updatedAt) normalized.updatedAt = normalized.createdAt;

  return normalized;
}
