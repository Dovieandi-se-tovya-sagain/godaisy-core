/**
 * Offline Weather Cache
 *
 * Stores last-known weather data in localStorage for offline access.
 * Works across all three apps: Go Daisy, Findr, and Grow Daisy.
 *
 * Strategy:
 * - Cache weather responses after successful API calls
 * - Show cached data immediately on page load (instant display)
 * - Upgrade to fresh data when online
 * - Indicate data staleness to user
 *
 * Usage:
 * ```typescript
 * import { cacheWeather, getCachedWeather, isWeatherStale } from './weatherCache';
 *
 * // Cache after successful fetch
 * const data = await fetchWeather(lat, lon);
 * cacheWeather(lat, lon, data);
 *
 * // Get cached data for instant display
 * const cached = getCachedWeather(lat, lon);
 * if (cached) {
 *   setWeather(cached.data);
 *   if (isWeatherStale(cached)) {
 *     // Show stale indicator
 *   }
 * }
 * ```
 */

const CACHE_KEY = 'wotnow_weather_cache';
const MAX_CACHE_ENTRIES = 5; // Keep last 5 locations
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours
const EXPIRED_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedWeatherEntry<T = unknown> {
  lat: number;
  lon: number;
  data: T;
  cachedAt: string;
  source?: string; // Which API provided this data
}

interface WeatherCache {
  entries: CachedWeatherEntry[];
  version: number;
}

/**
 * Round coordinates for cache key (1 decimal place ~ 11km)
 */
function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Get cache key for a location
 */
function getCacheKey(lat: number, lon: number): string {
  return `${roundCoord(lat)}_${roundCoord(lon)}`;
}

/**
 * Load cache from localStorage
 */
function loadCache(): WeatherCache {
  if (typeof window === 'undefined') {
    return { entries: [], version: 1 };
  }

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { entries: [], version: 1 };

    const cache = JSON.parse(raw) as WeatherCache;
    return cache;
  } catch {
    return { entries: [], version: 1 };
  }
}

/**
 * Save cache to localStorage
 */
function saveCache(cache: WeatherCache): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (_e) {
    // Storage full - clear old entries and retry
    console.warn('[weatherCache] Storage full, clearing old entries');
    cache.entries = cache.entries.slice(-2);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      console.warn('[weatherCache] Unable to save cache');
    }
  }
}

/**
 * Cache weather data for a location
 */
export function cacheWeather<T>(lat: number, lon: number, data: T, source?: string): void {
  const cache = loadCache();
  const key = getCacheKey(lat, lon);

  // Remove existing entry for this location
  cache.entries = cache.entries.filter(e => getCacheKey(e.lat, e.lon) !== key);

  // Add new entry
  cache.entries.push({
    lat: roundCoord(lat),
    lon: roundCoord(lon),
    data,
    cachedAt: new Date().toISOString(),
    source,
  });

  // Keep only most recent entries
  if (cache.entries.length > MAX_CACHE_ENTRIES) {
    cache.entries = cache.entries.slice(-MAX_CACHE_ENTRIES);
  }

  saveCache(cache);
}

/**
 * Get cached weather for a location
 */
export function getCachedWeather<T>(lat: number, lon: number): CachedWeatherEntry<T> | null {
  const cache = loadCache();
  const key = getCacheKey(lat, lon);

  const entry = cache.entries.find(e => getCacheKey(e.lat, e.lon) === key);
  if (!entry) return null;

  // Check if expired (> 24 hours old)
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  if (age > EXPIRED_THRESHOLD_MS) {
    // Remove expired entry
    cache.entries = cache.entries.filter(e => getCacheKey(e.lat, e.lon) !== key);
    saveCache(cache);
    return null;
  }

  return entry as CachedWeatherEntry<T>;
}

/**
 * Check if cached weather is stale (> 3 hours old)
 */
export function isWeatherStale(entry: CachedWeatherEntry): boolean {
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  return age > STALE_THRESHOLD_MS;
}

/**
 * Get age of cached weather in human-readable format
 */
export function getWeatherCacheAge(entry: CachedWeatherEntry): string {
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  const minutes = Math.floor(age / (60 * 1000));
  const hours = Math.floor(age / (60 * 60 * 1000));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return 'over a day ago';
}

/**
 * Clear all cached weather data
 */
export function clearWeatherCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get all cached locations
 */
export function getCachedLocations(): Array<{ lat: number; lon: number; cachedAt: string }> {
  const cache = loadCache();
  return cache.entries.map(e => ({
    lat: e.lat,
    lon: e.lon,
    cachedAt: e.cachedAt,
  }));
}

/**
 * Pre-warm weather cache with initial data
 * Called when app loads with known location
 */
export async function prewarmWeatherCache(lat: number, lon: number): Promise<void> {
  // Check if we already have recent cached data
  const cached = getCachedWeather(lat, lon);
  if (cached && !isWeatherStale(cached)) {
    return; // Already have fresh data
  }

  // Try to fetch and cache new data
  try {
    const response = await fetch(`/api/unified-weather?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      cacheWeather(lat, lon, data, 'prewarm');
    }
  } catch {
    // Silently fail - we'll use any existing cached data
  }
}

const weatherCacheApi = {
  cacheWeather,
  getCachedWeather,
  isWeatherStale,
  getWeatherCacheAge,
  clearWeatherCache,
  getCachedLocations,
  prewarmWeatherCache,
};

export default weatherCacheApi;
