/**
 * Identity abstraction layer for multi-user support.
 * 
 * This module provides a minimal, provider-agnostic identity system.
 * Currently implements a local-dev provider that generates stable UUIDs.
 * Future providers (OAuth, etc.) can be added without refactoring storage.
 */

// Opaque user identifier (e.g., "local:abc-123-def", "google:user@example.com")
export type UserId = string;

/**
 * Identity provider interface - abstraction for different auth mechanisms
 */
export interface IdentityProvider {
  getUserId(): Promise<UserId>;
}

/**
 * Local development identity provider.
 * Generates and stores a stable UUID in localStorage.
 * Format: "local:<uuid>"
 */
class LocalDevIdentityProvider implements IdentityProvider {
  private readonly STORAGE_KEY = 'crumbworks.identity.userId';

  async getUserId(): Promise<UserId> {
    // Check for existing ID
    const existing = this.getStoredUserId();
    if (existing) {
      return existing;
    }

    // Generate new ID
    const newId = this.generateUserId();
    this.storeUserId(newId);
    return newId;
  }

  private getStoredUserId(): UserId | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && stored.startsWith('local:')) {
        return stored;
      }
      return null;
    } catch (error) {
      console.error('Failed to read userId from localStorage:', error);
      return null;
    }
  }

  private storeUserId(userId: UserId): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, userId);
    } catch (error) {
      console.error('Failed to store userId in localStorage:', error);
    }
  }

  private generateUserId(): UserId {
    // Use crypto.randomUUID if available (modern browsers + Node 15+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `local:${crypto.randomUUID()}`;
    }
    
    // Fallback for older environments
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `local:${timestamp}-${randomPart}`;
  }
}

// Singleton provider instance
let provider: IdentityProvider | null = null;

/**
 * Set the identity provider (allows future extension to real auth)
 */
export function setIdentityProvider(newProvider: IdentityProvider): void {
  provider = newProvider;
}

/**
 * Get the current identity provider (initializes to LocalDev if not set)
 */
function getIdentityProvider(): IdentityProvider {
  if (!provider) {
    provider = new LocalDevIdentityProvider();
  }
  return provider;
}

/**
 * Resolve the current user ID.
 * This is the primary entry point for the rest of the app.
 */
export async function resolveCurrentUserId(): Promise<UserId> {
  const identityProvider = getIdentityProvider();
  return identityProvider.getUserId();
}

/**
 * For testing: clear stored identity
 * @internal
 */
export function _clearIdentity(): void {
  try {
    localStorage.removeItem('crumbworks.identity.userId');
  } catch {
    // Ignore errors
  }
  provider = null;
}
