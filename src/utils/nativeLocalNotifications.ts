/**
 * Stub for native platform detection.
 * 
 * This file previously contained Capacitor-based native iOS/Android detection.
 * Since the app is now PWA-only, this always returns false.
 * 
 * Kept for backwards compatibility with existing code that checks isNativePlatform().
 */

/**
 * Returns true if running in a native wrapper (Capacitor, Cordova, etc.)
 * Since this is now a PWA-only app, always returns false.
 */
export function isNativePlatform(): boolean {
  return false;
}
