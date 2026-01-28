/**
 * Offline Tide Cache
 *
 * Stores tide data persistently for offline access.
 * Uses Capacitor Preferences on native, localStorage on web.
 *
 * Tides are predictable days in advance, so we can cache
 * multiple days of data for offline use.
 */

export interface TideExtreme {
  time: string;
  type: 'high' | 'low';
  height: number;
}

export interface CachedTideData {
  extremes: TideExtreme[];
  cachedAt: string;
  expiresAt: string;
}

interface TideCacheEntry {
  lat: number;
  lon: number;
  data: CachedTideData;
}

interface TideCacheStore {
  entries: TideCacheEntry[];
  version: number;
}

const STORAGE_KEY = 'findr_tide_cache';
const MAX_ENTRIES = 5; // Cache last 5 locations
const CACHE_TTL_HOURS = 12; // Tide data valid for 12 hours

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
async function readCache(): Promise<TideCacheStore> {
  const defaultStore: TideCacheStore = { entries: [], version: 1 };

  try {
    const isNative = await isNativePlatform();

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return defaultStore;
      return JSON.parse(value) as TideCacheStore;
    } else {
      if (typeof localStorage === 'undefined') return defaultStore;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStore;
      return JSON.parse(raw) as TideCacheStore;
    }
  } catch (error) {
    console.error('[tideCache] Failed to read:', error);
    return defaultStore;
  }
}

/**
 * Write cache to storage
 */
async function writeCache(store: TideCacheStore): Promise<void> {
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
    console.error('[tideCache] Failed to write:', error);
  }
}

/**
 * Generate cache key from coordinates (rounded to 3 decimals)
 */
function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Check if cache entry is expired
 */
function isExpired(entry: CachedTideData): boolean {
  return new Date(entry.expiresAt) < new Date();
}

/**
 * Get cached tide data for a location
 */
export async function getCachedTides(
  lat: number,
  lon: number
): Promise<CachedTideData | null> {
  const store = await readCache();
  const key = getCacheKey(lat, lon);

  const entry = store.entries.find(
    e => getCacheKey(e.lat, e.lon) === key
  );

  if (!entry) return null;

  // Check if expired
  if (isExpired(entry.data)) {
    console.log('[tideCache] Cache expired for', key);
    return null;
  }

  console.log('[tideCache] Cache hit for', key);
  return entry.data;
}

/**
 * Cache tide data for a location
 */
export async function cacheTides(
  lat: number,
  lon: number,
  extremes: TideExtreme[]
): Promise<void> {
  const store = await readCache();
  const key = getCacheKey(lat, lon);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  const newEntry: TideCacheEntry = {
    lat,
    lon,
    data: {
      extremes,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };

  // Remove existing entry for this location
  store.entries = store.entries.filter(
    e => getCacheKey(e.lat, e.lon) !== key
  );

  // Add new entry at the beginning
  store.entries.unshift(newEntry);

  // Keep only MAX_ENTRIES locations
  if (store.entries.length > MAX_ENTRIES) {
    store.entries = store.entries.slice(0, MAX_ENTRIES);
  }

  await writeCache(store);
  console.log('[tideCache] Cached tides for', key, '- expires', expiresAt.toISOString());
}

/**
 * Get cache age in human-readable format
 */
export function getTideCacheAge(data: CachedTideData): string {
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
export function isTideCacheStale(data: CachedTideData): boolean {
  const cachedAt = new Date(data.cachedAt);
  const now = new Date();
  const diffMs = now.getTime() - cachedAt.getTime();
  return diffMs > 3 * 60 * 60 * 1000; // 3 hours
}

/**
 * Clear all cached tides
 */
export async function clearTideCache(): Promise<void> {
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
    console.log('[tideCache] Cache cleared');
  } catch (error) {
    console.error('[tideCache] Failed to clear:', error);
  }
}

export const tideCacheApi = {
  getCachedTides,
  cacheTides,
  getTideCacheAge,
  isTideCacheStale,
  clearTideCache,
};

export default tideCacheApi;
