/**
 * Hook to fetch real tide data for a location
 *
 * Features:
 * - Persistent caching for offline use
 * - Returns cached data when offline
 * - Processes tide extremes to determine current phase
 */

import { useEffect, useState } from 'react';
import {
  getCachedTides,
  cacheTides,
  isTideCacheStale,
  type TideExtreme,
} from '@/lib/offline/tideCache';
import { useOnlineStatus } from './useOnlineStatus';

export interface TidePhaseInfo {
  currentPhase: 'rising' | 'falling' | 'high_slack' | 'low_slack';
  timeToNextChange?: number; // minutes
  currentStrength?: 'weak' | 'moderate' | 'strong';
  isFromCache?: boolean;
}

interface TideAPIResponse {
  success: boolean;
  data: Array<{
    time: string;
    type: 'high' | 'low';
    height: number;
  }>;
  limited?: boolean;
}

export function useTideData(location: { lat: number; lon: number } | null): TidePhaseInfo | null {
  const [tideInfo, setTideInfo] = useState<TidePhaseInfo | null>(null);
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    if (!location) {
      setTideInfo(null);
      return;
    }

    const fetchTideData = async () => {
      try {
        // Step 1: Check persistent cache first
        const cached = await getCachedTides(location.lat, location.lon);

        if (cached) {
          const tidePhase = processTideExtremes(cached.extremes);
          setTideInfo({ ...tidePhase, isFromCache: true });

          // If offline or cache is fresh, use cached data only
          if (!isOnline || !isTideCacheStale(cached)) {
            console.log('[useTideData] Using cached tides');
            return;
          }

          // Cache is stale but we're online - continue to fetch fresh data
          console.log('[useTideData] Cache stale, fetching fresh');
        } else if (!isOnline) {
          // No cache and offline - nothing we can do
          console.log('[useTideData] Offline with no cache');
          return;
        }

        // Step 2: Fetch from API
        const response = await fetch(`/api/tides?lat=${location.lat}&lon=${location.lon}`);

        if (!response.ok) {
          console.warn('[useTideData] API error:', response.status);
          return;
        }

        const result = await response.json() as TideAPIResponse;

        if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
          console.warn('[useTideData] No tide data available');
          return;
        }

        // Step 3: Cache for offline use
        await cacheTides(location.lat, location.lon, result.data);

        // Process tide extremes to determine current phase
        const tidePhase = processTideExtremes(result.data);
        setTideInfo({ ...tidePhase, isFromCache: false });
      } catch (error) {
        console.error('[useTideData] Error:', error);

        // Try to fall back to cache on network error
        const cached = await getCachedTides(location.lat, location.lon);
        if (cached) {
          console.log('[useTideData] Network error, using cache');
          const tidePhase = processTideExtremes(cached.extremes);
          setTideInfo({ ...tidePhase, isFromCache: true });
        }
      }
    };

    fetchTideData();
  }, [location, isOnline]);

  return tideInfo;
}

/**
 * Process tide extremes to determine current phase
 * Simplified version of the logic in lib/weather/stormglass.ts
 */
function processTideExtremes(extremes: TideExtreme[]): Omit<TidePhaseInfo, 'isFromCache'> {
  const now = new Date();

  // Filter upcoming tides
  const upcomingTides = extremes.filter(tide => new Date(tide.time) > now);

  if (upcomingTides.length === 0) {
    // Fallback if no upcoming tides
    return {
      currentPhase: 'rising',
      timeToNextChange: 360,
      currentStrength: 'moderate',
    };
  }

  const nextTide = upcomingTides[0];
  const timeToNext = Math.round((new Date(nextTide.time).getTime() - now.getTime()) / (1000 * 60));

  // Determine current phase based on next tide type and time
  let currentPhase: 'rising' | 'falling' | 'high_slack' | 'low_slack';
  let currentStrength: 'weak' | 'moderate' | 'strong';

  if (timeToNext < 30) {
    // Near tide change - slack water
    currentPhase = nextTide.type === 'high' ? 'high_slack' : 'low_slack';
    currentStrength = 'weak';
  } else {
    // Active tide
    currentPhase = nextTide.type === 'high' ? 'rising' : 'falling';
    currentStrength = timeToNext < 120 ? 'strong' : 'moderate';
  }

  return {
    currentPhase,
    timeToNextChange: timeToNext,
    currentStrength,
  };
}
