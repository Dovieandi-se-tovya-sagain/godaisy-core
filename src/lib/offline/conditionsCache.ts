/**
 * Offline Conditions Cache
 *
 * Stores environmental conditions data persistently for offline access.
 * Uses Capacitor Preferences on native, localStorage on web.
 *
 * Conditions include sea temperature, salinity, chlorophyll, etc.
 * These change slowly (daily), so caching is effective.
 */

import type { FallbackConditionPayload } from '../findr/fallbackConditions';

export interface CachedConditionsData {
  conditions: FallbackConditionPayload;
  cachedAt: string;
  expiresAt: string;
}

interface ConditionsCacheEntry {
  rectangleCode: string;
  data: CachedConditionsData;
}

interface ConditionsCacheStore {
  entries: ConditionsCacheEntry[];
  version: number;
}

const STORAGE_KEY = 'findr_conditions_cache';
const MAX_ENTRIES = 5; // Cache last 5 rectangles
const CACHE_TTL_HOURS = 6; // Conditions valid for 6 hours

/**
 * Check if running on native platform
 */
async function isNativePlatform(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Read cache from storage
 */
async function readCache(): Promise<ConditionsCacheStore> {
  const defaultStore: ConditionsCacheStore = { entries: [], version: 1 };

  try {
    const isNative = await isNativePlatform();

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return defaultStore;
      return JSON.parse(value) as ConditionsCacheStore;
    } else {
      if (typeof localStorage === 'undefined') return defaultStore;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStore;
      return JSON.parse(raw) as ConditionsCacheStore;
    }
  } catch (error) {
    console.error('[conditionsCache] Failed to read:', error);
    return defaultStore;
  }
}

/**
 * Write cache to storage
 */
async function writeCache(store: ConditionsCacheStore): Promise<void> {
  try {
    const isNative = await isNativePlatform();
    const json = JSON.stringify(store);

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: STORAGE_KEY, value: json });
    } else {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, json);
      }
    }
  } catch (error) {
    console.error('[conditionsCache] Failed to write:', error);
  }
}

/**
 * Check if cache entry is expired
 */
function isExpired(entry: CachedConditionsData): boolean {
  return new Date(entry.expiresAt) < new Date();
}

/**
 * Get cached conditions for a rectangle
 */
export async function getCachedConditions(
  rectangleCode: string
): Promise<CachedConditionsData | null> {
  const store = await readCache();
  const entry = store.entries.find(e => e.rectangleCode === rectangleCode);

  if (!entry) return null;

  // Check if expired
  if (isExpired(entry.data)) {
    console.log('[conditionsCache] Cache expired for', rectangleCode);
    return null;
  }

  console.log('[conditionsCache] Cache hit for', rectangleCode);
  return entry.data;
}

/**
 * Cache conditions for a rectangle
 */
export async function cacheConditions(
  rectangleCode: string,
  conditions: FallbackConditionPayload
): Promise<void> {
  const store = await readCache();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  const newEntry: ConditionsCacheEntry = {
    rectangleCode,
    data: {
      conditions,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };

  // Remove existing entry for this rectangle
  store.entries = store.entries.filter(e => e.rectangleCode !== rectangleCode);

  // Add new entry at the beginning
  store.entries.unshift(newEntry);

  // Keep only MAX_ENTRIES
  if (store.entries.length > MAX_ENTRIES) {
    store.entries = store.entries.slice(0, MAX_ENTRIES);
  }

  await writeCache(store);
  console.log('[conditionsCache] Cached conditions for', rectangleCode, '- expires', expiresAt.toISOString());
}

/**
 * Get cache age in human-readable format
 */
export function getConditionsCacheAge(data: CachedConditionsData): string {
  const cachedAt = new Date(data.cachedAt);
  const now = new Date();
  const diffMs = now.getTime() - cachedAt.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Check if cache is stale (> 3 hours old)
 */
export function isConditionsCacheStale(data: CachedConditionsData): boolean {
  const cachedAt = new Date(data.cachedAt);
  const now = new Date();
  const diffMs = now.getTime() - cachedAt.getTime();
  return diffMs > 3 * 60 * 60 * 1000; // 3 hours
}

/**
 * Clear all cached conditions
 */
export async function clearConditionsCache(): Promise<void> {
  try {
    const isNative = await isNativePlatform();

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: STORAGE_KEY });
    } else {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    console.log('[conditionsCache] Cache cleared');
  } catch (error) {
    console.error('[conditionsCache] Failed to clear:', error);
  }
}

export const conditionsCacheApi = {
  getCachedConditions,
  cacheConditions,
  getConditionsCacheAge,
  isConditionsCacheStale,
  clearConditionsCache,
};

export default conditionsCacheApi;
