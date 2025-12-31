/**
 * URL utilities.
 *
 * WebKit can throw opaque errors like:
 *   "The string did not match the expected pattern."
 * when given slightly-invalid URLs (whitespace, missing scheme, etc.).
 */

/** Remove common invisible/control characters and trim whitespace. */
export function cleanUrlInput(input: string): string {
  return (input || '')
    // Remove zero-width + BOM chars that sometimes appear when pasting.
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Collapse internal whitespace/newlines to single spaces.
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a user-entered recipe URL into a valid absolute http(s) URL string.
 *
 * - Adds https:// if scheme is missing.
 * - Converts protocol-relative URLs (//example.com) to https://example.com.
 * - Percent-encodes spaces to avoid WebKit URL parsing failures.
 */
export function normalizeRecipeUrl(input: string): string {
  const cleaned = cleanUrlInput(input);
  if (!cleaned) throw new Error('Please enter a URL');

  let candidate = cleaned;

  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  }

  // If user pasted "example.com/recipe" without scheme, assume https.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  // WebKit can be strict about raw spaces in URLs.
  candidate = candidate.replace(/ /g, '%20');

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Invalid URL. Please paste a full link like https://example.com/recipe');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('URL must start with http:// or https://');
  }

  return url.toString();
}
