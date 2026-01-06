import { getActiveProfileId } from '../profile/profileManager';

/**
 * Get the localStorage key for welcome flag (profile-scoped in multi-user mode)
 */
function getWelcomeKey(): string {
  const userId = getActiveProfileId();
  if (userId) {
    return `crumbworks:${userId}:welcomeSeen`;
  }
  // Fallback to legacy key for transition period
  return 'crumb_hasSeenWelcome_v1';
}

/**
 * Returns whether the user has already seen the one-time welcome/hero screen.
 * Uses localStorage so it persists across reloads and PWA launches.
 */
export function getHasSeenWelcome(): boolean {
  try {
    const key = getWelcomeKey();
    return window.localStorage.getItem(key) === '1';
  } catch {
    // If storage is unavailable (private mode / blocked), fail open:
    // allow the welcome screen once per session by treating as not-seen.
    return false;
  }
}

/** Marks the welcome/hero screen as seen. */
export function setHasSeenWelcome(): void {
  try {
    const key = getWelcomeKey();
    window.localStorage.setItem(key, '1');
  } catch {
    // Ignore storage write errors.
  }
}
