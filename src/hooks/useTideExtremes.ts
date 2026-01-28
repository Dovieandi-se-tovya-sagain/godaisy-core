/**
 * Hook to fetch tide extremes for a location
 * Returns array of tide high/low times for the day
 *
 * Features:
 * - Persistent caching for offline use
 * - Returns cached data when offline
 * - 12-hour cache TTL
 */

import { useEffect, useState, useRef } from 'react';
import type { TideExtreme } from '../lib/findr/conditionHelpers';
import {
  getCachedTides,
  cacheTides,
  isTideCacheStale,
} from '../lib/offline/tideCache';
import { useOnlineStatus } from './useOnlineStatus';

interface TideAPIResponse {
  success: boolean;
  data: Array<{
    time: string;
    type: 'high' | 'low';
    height: number;
  }>;
  limited?: boolean;
}

interface UseTideExtremesResult {
  extremes: TideExtreme[] | null;
  loading: boolean;
  isFromCache?: boolean;
  isOffline?: boolean;
}

export function useTideExtremes(
  location: { lat: number; lon: number } | null
): UseTideExtremesResult {
  const [extremes, setExtremes] = useState<TideExtreme[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const { isOnline } = useOnlineStatus();
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!location) {
      setExtremes(null);
      setIsFromCache(false);
      return;
    }

    const cacheKey = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;

    // Prevent duplicate fetches for same location
    if (fetchedRef.current === cacheKey && extremes !== null) {
      return;
    }

    const fetchTides = async () => {
      setLoading(true);

      try {
        // Step 1: Check persistent cache first
        const cached = await getCachedTides(location.lat, location.lon);

        if (cached) {
          setExtremes(cached.extremes);
          setIsFromCache(true);

          // If offline or cache is fresh, use cached data only
          if (!isOnline || !isTideCacheStale(cached)) {
            console.log('[useTideExtremes] Using cached tides');
            setLoading(false);
            fetchedRef.current = cacheKey;
            return;
          }

          // Cache is stale but we're online - continue to fetch fresh data
          console.log('[useTideExtremes] Cache stale, fetching fresh data');
        } else if (!isOnline) {
          // No cache and offline - nothing we can do
          console.log('[useTideExtremes] Offline with no cache');
          setExtremes(null);
          setIsFromCache(false);
          setLoading(false);
          return;
        }

        // Step 2: Fetch from API
        const response = await fetch(`/api/tides?lat=${location.lat}&lon=${location.lon}`);

        if (!response.ok) {
          console.warn('[useTideExtremes] API error:', response.status);
          // Keep cached data if we have it
          if (!cached) {
            setExtremes(null);
          }
          return;
        }

        const result = await response.json() as TideAPIResponse;

        if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
          console.warn('[useTideExtremes] No tide data available');
          // Keep cached data if we have it
          if (!cached) {
            setExtremes(null);
          }
          return;
        }

        // Transform to TideExtreme format
        const tideExtremes: TideExtreme[] = result.data.map(item => ({
          time: item.time,
          type: item.type,
          height: item.height,
        }));

        // Step 3: Cache for offline use
        await cacheTides(location.lat, location.lon, tideExtremes);

        setExtremes(tideExtremes);
        setIsFromCache(false);
        fetchedRef.current = cacheKey;
      } catch (error) {
        console.error('[useTideExtremes] Error:', error);

        // Try to fall back to cache on network error
        const cached = await getCachedTides(location.lat, location.lon);
        if (cached) {
          console.log('[useTideExtremes] Network error, using cache');
          setExtremes(cached.extremes);
          setIsFromCache(true);
        } else {
          setExtremes(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTides();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to refetch when lat/lon or online status changes
  }, [location?.lat, location?.lon, isOnline]);

  return {
    extremes,
    loading,
    isFromCache,
    isOffline: !isOnline,
  };
}
