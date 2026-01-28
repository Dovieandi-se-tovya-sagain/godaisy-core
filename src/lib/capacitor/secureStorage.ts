/**
 * Secure Storage for Native Apps
 *
 * Uses Capacitor Preferences (backed by Android Keystore / iOS Keychain)
 * for native platforms, falls back to localStorage for web.
 *
 * This provides better security for sensitive data like auth tokens
 * compared to plain localStorage on mobile devices.
 */

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// Robust native detection for remote URL loading
function detectNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;

  // Primary: Direct Capacitor check
  if (Capacitor.isNativePlatform()) return true;

  // Fallback: Check platform
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return true;

  return false;
}

const isNative = detectNativePlatform();

/**
 * Secure storage interface compatible with Supabase storage requirements
 */
export const secureStorage = {
  /**
   * Get an item from secure storage
   */
  async getItem(key: string): Promise<string | null> {
    if (isNative) {
      try {
        const { value } = await Preferences.get({ key });
        return value;
      } catch (error) {
        console.warn('[SecureStorage] Failed to get item:', key, error);
        return null;
      }
    }
    return localStorage.getItem(key);
  },

  /**
   * Set an item in secure storage
   */
  async setItem(key: string, value: string): Promise<void> {
    if (isNative) {
      try {
        await Preferences.set({ key, value });
      } catch (error) {
        console.warn('[SecureStorage] Failed to set item:', key, error);
        throw error;
      }
    } else {
      localStorage.setItem(key, value);
    }
  },

  /**
   * Remove an item from secure storage
   */
  async removeItem(key: string): Promise<void> {
    if (isNative) {
      try {
        await Preferences.remove({ key });
      } catch (error) {
        console.warn('[SecureStorage] Failed to remove item:', key, error);
      }
    } else {
      localStorage.removeItem(key);
    }
  },

  /**
   * Clear all items from secure storage
   * WARNING: This clears ALL app preferences, not just auth data
   */
  async clear(): Promise<void> {
    if (isNative) {
      try {
        await Preferences.clear();
      } catch (error) {
        console.warn('[SecureStorage] Failed to clear storage:', error);
      }
    } else {
      localStorage.clear();
    }
  },

  /**
   * Get all keys in secure storage
   */
  async keys(): Promise<string[]> {
    if (isNative) {
      try {
        const { keys } = await Preferences.keys();
        return keys;
      } catch (error) {
        console.warn('[SecureStorage] Failed to get keys:', error);
        return [];
      }
    }
    return Object.keys(localStorage);
  },
};

/**
 * Create a synchronous storage adapter for Supabase
 *
 * Note: Supabase's createBrowserClient expects synchronous localStorage API.
 * This adapter provides a synchronous interface but internally uses async
 * Preferences. For initial page load, we read from a memory cache that
 * gets hydrated from Preferences on app init.
 */
class SupabaseStorageAdapter {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  /**
   * Initialize the cache from Preferences (call during app init)
   */
  async initialize(): Promise<void> {
    if (!isNative || this.initialized) return;

    try {
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          const { value } = await Preferences.get({ key });
          if (value) {
            this.cache.set(key, value);
          }
        }
      }
      this.initialized = true;
      console.log('[SecureStorage] Supabase adapter initialized with', this.cache.size, 'keys');
    } catch (error) {
      console.warn('[SecureStorage] Failed to initialize adapter:', error);
    }
  }

  getItem(key: string): string | null {
    if (isNative) {
      // Return from cache (sync), but also trigger async update
      const cached = this.cache.get(key) ?? null;
      // Fire and forget - update cache from Preferences
      Preferences.get({ key }).then(({ value }) => {
        if (value) this.cache.set(key, value);
        else this.cache.delete(key);
      }).catch(() => {});
      return cached;
    }
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (isNative) {
      // Update cache immediately (sync), persist async
      this.cache.set(key, value);
      Preferences.set({ key, value }).catch((error) => {
        console.warn('[SecureStorage] Failed to persist:', key, error);
      });
    } else {
      localStorage.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (isNative) {
      this.cache.delete(key);
      Preferences.remove({ key }).catch((error) => {
        console.warn('[SecureStorage] Failed to remove:', key, error);
      });
    } else {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Singleton adapter for Supabase
 */
export const supabaseStorageAdapter = new SupabaseStorageAdapter();

/**
 * Initialize secure storage (call during app init)
 */
export async function initSecureStorage(): Promise<void> {
  await supabaseStorageAdapter.initialize();
}
