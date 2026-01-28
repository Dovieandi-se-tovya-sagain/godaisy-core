/**
 * Offline Species Advice Cache
 *
 * Caches species details, tactical advice, and strategic advice for offline access.
 * Stores data per rectangle to ensure relevant species are available offline.
 *
 * Uses Capacitor Preferences on native, localStorage on web.
 */

import type { FavoritesTacticalAdvice } from '../findr/generateFavouritesAdvice';
import type { FavoritesStrategicAdvice } from '../findr/generateFavouritesAdvice';

export interface CachedSpeciesDetails {
  species_id: string;
  species_code: string;
  name_en: string;
  scientific_name?: string;
  playful_bio?: string;
  fun_fact?: string;
  techniques?: string[];
  baits?: string[];
  habitats?: string[];
  guild?: string;
  eating_quality?: number;
  conservation_status?: string;
}

export interface CachedSpeciesAdvice {
  rectangleCode: string;
  species: CachedSpeciesDetails[];
  tacticalAdvice?: FavoritesTacticalAdvice;
  strategicAdvice?: FavoritesStrategicAdvice;
  cachedAt: string;
  expiresAt: string;
}

interface SpeciesAdviceCacheStore {
  entries: CachedSpeciesAdvice[];
  version: number;
}

const STORAGE_KEY = 'findr_species_advice_cache';
const MAX_RECTANGLES = 3; // Cache for up to 3 rectangles
const SPECIES_CACHE_TTL_HOURS = 168; // Species text valid for 7 days
const ADVICE_CACHE_TTL_HOURS = 6; // Advice valid for 6 hours

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
async function readCache(): Promise<SpeciesAdviceCacheStore> {
  const defaultStore: SpeciesAdviceCacheStore = { entries: [], version: 1 };

  try {
    const isNative = await isNativePlatform();

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return defaultStore;
      return JSON.parse(value) as SpeciesAdviceCacheStore;
    } else {
      if (typeof localStorage === 'undefined') return defaultStore;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStore;
      return JSON.parse(raw) as SpeciesAdviceCacheStore;
    }
  } catch (error) {
    console.error('[speciesAdviceCache] Failed to read:', error);
    return defaultStore;
  }
}

/**
 * Write cache to storage
 */
async function writeCache(store: SpeciesAdviceCacheStore): Promise<void> {
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
    console.error('[speciesAdviceCache] Failed to write:', error);
  }
}

/**
 * Get cached species data for a rectangle
 */
export async function getCachedSpeciesAdvice(
  rectangleCode: string
): Promise<CachedSpeciesAdvice | null> {
  const store = await readCache();
  const entry = store.entries.find(e => e.rectangleCode === rectangleCode);

  if (!entry) return null;

  // Check if species data expired
  if (new Date(entry.expiresAt) < new Date()) {
    console.log('[speciesAdviceCache] Cache expired for', rectangleCode);
    return null;
  }

  console.log('[speciesAdviceCache] Cache hit for', rectangleCode);
  return entry;
}

/**
 * Cache species details for a rectangle
 */
export async function cacheSpeciesDetails(
  rectangleCode: string,
  species: CachedSpeciesDetails[]
): Promise<void> {
  const store = await readCache();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SPECIES_CACHE_TTL_HOURS * 60 * 60 * 1000);

  // Find or create entry
  const existingIndex = store.entries.findIndex(e => e.rectangleCode === rectangleCode);

  const newEntry: CachedSpeciesAdvice = {
    rectangleCode,
    species,
    tacticalAdvice: existingIndex >= 0 ? store.entries[existingIndex].tacticalAdvice : undefined,
    strategicAdvice: existingIndex >= 0 ? store.entries[existingIndex].strategicAdvice : undefined,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Remove existing entry
  store.entries = store.entries.filter(e => e.rectangleCode !== rectangleCode);

  // Add new entry at the beginning
  store.entries.unshift(newEntry);

  // Keep only MAX_RECTANGLES
  if (store.entries.length > MAX_RECTANGLES) {
    store.entries = store.entries.slice(0, MAX_RECTANGLES);
  }

  await writeCache(store);
  console.log('[speciesAdviceCache] Cached', species.length, 'species for', rectangleCode);
}

/**
 * Cache tactical advice for a rectangle
 */
export async function cacheTacticalAdvice(
  rectangleCode: string,
  advice: FavoritesTacticalAdvice
): Promise<void> {
  const store = await readCache();
  const entry = store.entries.find(e => e.rectangleCode === rectangleCode);

  if (!entry) {
    // No species cached yet - create minimal entry
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ADVICE_CACHE_TTL_HOURS * 60 * 60 * 1000);

    store.entries.unshift({
      rectangleCode,
      species: [],
      tacticalAdvice: advice,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    if (store.entries.length > MAX_RECTANGLES) {
      store.entries = store.entries.slice(0, MAX_RECTANGLES);
    }
  } else {
    entry.tacticalAdvice = advice;
  }

  await writeCache(store);
  console.log('[speciesAdviceCache] Cached tactical advice for', rectangleCode);
}

/**
 * Cache strategic advice for a rectangle
 */
export async function cacheStrategicAdvice(
  rectangleCode: string,
  advice: FavoritesStrategicAdvice
): Promise<void> {
  const store = await readCache();
  const entry = store.entries.find(e => e.rectangleCode === rectangleCode);

  if (!entry) {
    // No species cached yet - create minimal entry
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ADVICE_CACHE_TTL_HOURS * 60 * 60 * 1000);

    store.entries.unshift({
      rectangleCode,
      species: [],
      strategicAdvice: advice,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    if (store.entries.length > MAX_RECTANGLES) {
      store.entries = store.entries.slice(0, MAX_RECTANGLES);
    }
  } else {
    entry.strategicAdvice = advice;
  }

  await writeCache(store);
  console.log('[speciesAdviceCache] Cached strategic advice for', rectangleCode);
}

/**
 * Check if tactical advice is stale (> 3 hours old)
 */
export function isTacticalAdviceStale(entry: CachedSpeciesAdvice): boolean {
  if (!entry.tacticalAdvice) return true;
  const cachedAt = new Date(entry.cachedAt);
  const now = new Date();
  const diffMs = now.getTime() - cachedAt.getTime();
  return diffMs > 3 * 60 * 60 * 1000; // 3 hours
}

/**
 * Check if strategic advice is stale (> 6 hours old)
 */
export function isStrategicAdviceStale(entry: CachedSpeciesAdvice): boolean {
  if (!entry.strategicAdvice) return true;
  const cachedAt = new Date(entry.cachedAt);
  const now = new Date();
  const diffMs = now.getTime() - cachedAt.getTime();
  return diffMs > 6 * 60 * 60 * 1000; // 6 hours
}

/**
 * Get cache age in human-readable format
 */
export function getAdviceCacheAge(entry: CachedSpeciesAdvice): string {
  const cachedAt = new Date(entry.cachedAt);
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
 * Clear all cached species advice
 */
export async function clearSpeciesAdviceCache(): Promise<void> {
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
    console.log('[speciesAdviceCache] Cache cleared');
  } catch (error) {
    console.error('[speciesAdviceCache] Failed to clear:', error);
  }
}

export const speciesAdviceCacheApi = {
  getCachedSpeciesAdvice,
  cacheSpeciesDetails,
  cacheTacticalAdvice,
  cacheStrategicAdvice,
  isTacticalAdviceStale,
  isStrategicAdviceStale,
  getAdviceCacheAge,
  clearSpeciesAdviceCache,
};

export default speciesAdviceCacheApi;
