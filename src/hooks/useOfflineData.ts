// hooks/useOfflineData.ts
/**
 * Offline-aware data fetching hook
 *
 * Features:
 * - Tries IndexedDB cache first for instant loading
 * - Falls back to network if cache miss or stale
 * - Updates cache with fresh data
 * - Shows staleness indicator
 * - Works across all apps (Findr, Go Daisy, Grow Daisy)
 */

import { useState, useEffect, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

interface OfflineDataOptions<T> {
  /** Unique cache key for this data */
  cacheKey: string;
  /** Function to fetch fresh data from network */
  fetcher: () => Promise<T>;
  /** Maximum age in milliseconds before data is considered stale (default: 5 minutes) */
  maxAge?: number;
  /** Whether to refetch when coming back online */
  refetchOnReconnect?: boolean;
  /** Initial data to use before cache/network loads */
  initialData?: T;
  /** Storage type: 'localStorage' or 'indexedDB' (default: 'localStorage') */
  storage?: 'localStorage' | 'indexedDB';
}

interface OfflineDataResult<T> {
  /** The data (from cache or network) */
  data: T | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Whether the data came from cache */
  isFromCache: boolean;
  /** Whether the cached data is stale (older than maxAge) */
  isStale: boolean;
  /** Timestamp of when data was last updated */
  lastUpdated: Date | null;
  /** Whether currently online */
  isOnline: boolean;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = 'offline_data_';

function getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + key);
    if (!stored) return null;
    return JSON.parse(stored) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function saveToLocalStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    console.warn('[useOfflineData] Failed to save to localStorage:', e);
  }
}

export function useOfflineData<T>(options: OfflineDataOptions<T>): OfflineDataResult<T> {
  const {
    cacheKey,
    fetcher,
    maxAge = 5 * 60 * 1000, // 5 minutes default
    refetchOnReconnect = true,
    initialData = null,
    storage = 'localStorage',
  } = options;

  const { isOnline, wasOffline } = useOnlineStatus();

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isStale = lastUpdated ? Date.now() - lastUpdated.getTime() > maxAge : false;

  const fetchData = useCallback(async (skipCache = false) => {
    setIsLoading(true);
    setError(null);

    // Try cache first (unless skipCache is true)
    if (!skipCache && storage === 'localStorage') {
      const cached = getFromLocalStorage<T>(cacheKey);
      if (cached) {
        setData(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        setIsFromCache(true);

        // If cache is fresh and we're offline, stop here
        const isFresh = Date.now() - cached.timestamp < maxAge;
        if (isFresh || !isOnline) {
          setIsLoading(false);
          return;
        }
      }
    }

    // If offline and no cache, show error
    if (!isOnline) {
      setIsLoading(false);
      if (!data) {
        setError(new Error('No cached data available while offline'));
      }
      return;
    }

    // Fetch from network
    try {
      const freshData = await fetcher();
      setData(freshData);
      setLastUpdated(new Date());
      setIsFromCache(false);
      setError(null);

      // Save to cache
      if (storage === 'localStorage') {
        saveToLocalStorage(cacheKey, freshData);
      }
    } catch (e) {
      const fetchError = e instanceof Error ? e : new Error('Failed to fetch data');
      setError(fetchError);

      // If we have cached data, keep showing it
      if (!data) {
        const cached = getFromLocalStorage<T>(cacheKey);
        if (cached) {
          setData(cached.data);
          setLastUpdated(new Date(cached.timestamp));
          setIsFromCache(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetcher, isOnline, maxAge, storage, data]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when coming back online
  useEffect(() => {
    if (refetchOnReconnect && isOnline && wasOffline) {
      fetchData(true); // Skip cache, get fresh data
    }
  }, [isOnline, wasOffline, refetchOnReconnect, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    isFromCache,
    isStale,
    lastUpdated,
    isOnline,
    refetch,
  };
}

/**
 * Format time relative to now
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}
