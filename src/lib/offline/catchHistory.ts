/**
 * Offline Catch History Storage
 *
 * Caches the user's catch history locally for offline viewing.
 * Works with Capacitor Preferences on native, localStorage on web.
 */

export interface CachedCatch {
  id: string;
  species_id: string;
  species_common_name: string;
  caught_at: string;
  rectangle_code: string;
  quantity: number;
  size_category: string;
  bait_used: string;
  habitat_type?: string;
  notes?: string;
  pinned?: boolean;
  photo_assets?: Array<{
    url: string;
    thumbnail_url: string;
  }> | null;
  // Cached thumbnail as base64 for offline
  cached_thumbnail?: string;
}

export interface CatchHistoryCache {
  catches: CachedCatch[];
  cachedAt: string;
  userId: string;
}

const STORAGE_KEY = 'findr_catch_history_cache';
const CACHE_TTL_HOURS = 24 * 7; // Cache valid for 7 days

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
 * Read catch history from storage
 */
async function readFromStorage(): Promise<CatchHistoryCache | null> {
  try {
    const isNative = await isNativePlatform();

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return null;
      return JSON.parse(value) as CatchHistoryCache;
    } else {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CatchHistoryCache;
    }
  } catch (error) {
    console.error('[catchHistory] Failed to read from storage:', error);
    return null;
  }
}

/**
 * Write catch history to storage
 */
async function writeToStorage(cache: CatchHistoryCache): Promise<void> {
  try {
    const isNative = await isNativePlatform();
    const json = JSON.stringify(cache);

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: STORAGE_KEY, value: json });
    } else {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, json);
      }
    }
  } catch (error) {
    console.error('[catchHistory] Failed to write to storage:', error);
  }
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cache: CatchHistoryCache): boolean {
  const cachedAt = new Date(cache.cachedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff < CACHE_TTL_HOURS;
}

/**
 * Get cached catch history for a user
 */
export async function getCachedCatchHistory(userId: string): Promise<{
  catches: CachedCatch[];
  cachedAt: string;
  isStale: boolean;
} | null> {
  const cache = await readFromStorage();

  if (!cache || cache.userId !== userId) {
    return null;
  }

  const isStale = !isCacheValid(cache);

  return {
    catches: cache.catches,
    cachedAt: cache.cachedAt,
    isStale,
  };
}

/**
 * Fetch and convert image to base64
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result); // Includes data:image/... prefix
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Cache thumbnails for catches with user photos
 */
async function cacheThumbnails(catches: CachedCatch[]): Promise<CachedCatch[]> {
  const catchesWithCachedThumbs: CachedCatch[] = [];

  for (const c of catches) {
    // Only cache thumbnails for user-uploaded photos
    if (c.photo_assets && c.photo_assets.length > 0 && !c.cached_thumbnail) {
      const thumbnailUrl = c.photo_assets[0].thumbnail_url;
      if (thumbnailUrl) {
        const base64 = await fetchImageAsBase64(thumbnailUrl);
        catchesWithCachedThumbs.push({
          ...c,
          cached_thumbnail: base64 || undefined,
        });
        continue;
      }
    }
    catchesWithCachedThumbs.push(c);
  }

  return catchesWithCachedThumbs;
}

/**
 * Cache catch history for a user
 */
export async function cacheCatchHistory(
  userId: string,
  catches: CachedCatch[],
  options: { cacheThumbnails?: boolean } = { cacheThumbnails: true }
): Promise<void> {
  // Optionally cache thumbnails for offline photo viewing
  let processedCatches = catches;
  if (options.cacheThumbnails) {
    // Only cache thumbnails in background, don't block
    processedCatches = await cacheThumbnails(catches);
  }

  const cache: CatchHistoryCache = {
    catches: processedCatches,
    cachedAt: new Date().toISOString(),
    userId,
  };

  await writeToStorage(cache);
  console.log('[catchHistory] Cached', catches.length, 'catches for user');
}

/**
 * Add a new catch to the cache (when logging offline)
 */
export async function addCatchToCache(
  userId: string,
  newCatch: CachedCatch
): Promise<void> {
  const existing = await readFromStorage();

  const catches = existing?.userId === userId ? existing.catches : [];

  // Add new catch at the beginning (most recent first)
  catches.unshift(newCatch);

  await cacheCatchHistory(userId, catches);
}

/**
 * Update a catch in the cache (e.g., after sync assigns real ID)
 */
export async function updateCatchInCache(
  userId: string,
  catchId: string,
  updates: Partial<CachedCatch>
): Promise<void> {
  const existing = await readFromStorage();

  if (!existing || existing.userId !== userId) return;

  const catches = existing.catches.map(c =>
    c.id === catchId ? { ...c, ...updates } : c
  );

  await cacheCatchHistory(userId, catches);
}

/**
 * Clear cached catch history
 */
export async function clearCatchHistoryCache(): Promise<void> {
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
    console.log('[catchHistory] Cache cleared');
  } catch (error) {
    console.error('[catchHistory] Failed to clear cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCatchHistoryCacheStats(): Promise<{
  count: number;
  cachedAt: string | null;
  isStale: boolean;
} | null> {
  const cache = await readFromStorage();

  if (!cache) return null;

  return {
    count: cache.catches.length,
    cachedAt: cache.cachedAt,
    isStale: !isCacheValid(cache),
  };
}

export const catchHistoryApi = {
  getCachedCatchHistory,
  cacheCatchHistory,
  addCatchToCache,
  updateCatchInCache,
  clearCatchHistoryCache,
  getCatchHistoryCacheStats,
};

export default catchHistoryApi;
