const HAS_SEEN_WELCOME_KEY = 'crumb_hasSeenWelcome_v1';

/**
 * Returns whether the user has already seen the one-time welcome/hero screen.
 * Uses localStorage so it persists across reloads and PWA launches.
 */
export function getHasSeenWelcome(): boolean {
  try {
    return window.localStorage.getItem(HAS_SEEN_WELCOME_KEY) === '1';
  } catch {
    // If storage is unavailable (private mode / blocked), fail open:
    // allow the welcome screen once per session by treating as not-seen.
    return false;
  }
}

/** Marks the welcome/hero screen as seen. */
export function setHasSeenWelcome(): void {
  try {
    window.localStorage.setItem(HAS_SEEN_WELCOME_KEY, '1');
  } catch {
    // Ignore storage write errors.
  }
}
