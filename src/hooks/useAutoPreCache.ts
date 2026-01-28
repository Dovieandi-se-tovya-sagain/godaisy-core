/**
 * Auto Pre-Cache Hook
 *
 * Automatically pre-caches predictions and species images when the app is online.
 * Runs in the background without blocking the UI.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useUnifiedLocation } from '../contexts/UnifiedLocationContext';
import { useOnlineStatus } from './useOnlineStatus';
import { preCacheAllLocations, getPreCachedRectangles } from '../lib/findr/preCachePredictions';
import { loadSpeciesBundle, preCacheSpeciesImages } from '../lib/findr/speciesBundle';

interface PreCacheStatus {
  predictions: {
    inProgress: boolean;
    completed: boolean;
    cachedCount: number;
    totalCount: number;
    currentRectangle: string | null;
  };
  images: {
    inProgress: boolean;
    completed: boolean;
    progress: number;
  };
  lastRun: string | null;
}

const STORAGE_KEY = 'findr_auto_precache_status';

function getLastRunDate(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { lastRun } = JSON.parse(raw);
    return lastRun;
  } catch {
    return null;
  }
}

function setLastRunDate(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lastRun: new Date().toISOString().split('T')[0],
    }));
  } catch {
    // Ignore
  }
}

export function useAutoPreCache(language: string = 'en'): PreCacheStatus {
  const { locations } = useUnifiedLocation();
  const isOnline = useOnlineStatus();
  const hasRun = useRef(false);

  const [status, setStatus] = useState<PreCacheStatus>({
    predictions: {
      inProgress: false,
      completed: false,
      cachedCount: 0,
      totalCount: 0,
      currentRectangle: null,
    },
    images: {
      inProgress: false,
      completed: false,
      progress: 0,
    },
    lastRun: getLastRunDate(),
  });

  const runPreCache = useCallback(async () => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Check if already run today
    const lastRun = getLastRunDate();
    const today = new Date().toISOString().split('T')[0];
    if (lastRun === today) {
      console.log('[useAutoPreCache] Already ran today, skipping');
      return;
    }

    console.log('[useAutoPreCache] Starting auto pre-cache');

    // Pre-cache predictions for all locations
    const validLocations = locations.filter(loc => loc.rectangleCode);
    if (validLocations.length > 0) {
      setStatus(prev => ({
        ...prev,
        predictions: {
          ...prev.predictions,
          inProgress: true,
          totalCount: validLocations.length,
        },
      }));

      try {
        const result = await preCacheAllLocations(
          validLocations,
          language,
          (current, total, rectangleCode) => {
            setStatus(prev => ({
              ...prev,
              predictions: {
                ...prev.predictions,
                cachedCount: current,
                totalCount: total,
                currentRectangle: rectangleCode,
              },
            }));
          }
        );

        setStatus(prev => ({
          ...prev,
          predictions: {
            ...prev.predictions,
            inProgress: false,
            completed: true,
            cachedCount: result.cached + result.skipped,
          },
        }));
      } catch (error) {
        console.error('[useAutoPreCache] Prediction caching failed:', error);
        setStatus(prev => ({
          ...prev,
          predictions: { ...prev.predictions, inProgress: false },
        }));
      }
    }

    // Pre-cache species images (only if not already cached)
    const imageCacheKey = 'findr_species_images_cached';
    const imageCached = typeof localStorage !== 'undefined' && localStorage.getItem(imageCacheKey);
    if (!imageCached) {
      setStatus(prev => ({
        ...prev,
        images: { ...prev.images, inProgress: true },
      }));

      try {
        // Load bundle first
        await loadSpeciesBundle();

        // Then cache images
        await preCacheSpeciesImages((loaded, total) => {
          setStatus(prev => ({
            ...prev,
            images: {
              ...prev.images,
              progress: Math.round((loaded / total) * 100),
            },
          }));
        });

        setStatus(prev => ({
          ...prev,
          images: { ...prev.images, inProgress: false, completed: true, progress: 100 },
        }));
      } catch (error) {
        console.error('[useAutoPreCache] Image caching failed:', error);
        setStatus(prev => ({
          ...prev,
          images: { ...prev.images, inProgress: false },
        }));
      }
    } else {
      setStatus(prev => ({
        ...prev,
        images: { ...prev.images, completed: true, progress: 100 },
      }));
    }

    // Mark as run
    setLastRunDate();
    setStatus(prev => ({
      ...prev,
      lastRun: today,
    }));

    console.log('[useAutoPreCache] Completed auto pre-cache');
  }, [locations, language]);

  // Trigger pre-cache when online and locations are available
  useEffect(() => {
    if (!isOnline) return;
    if (locations.length === 0) return;
    if (hasRun.current) return;

    // Delay start to avoid competing with initial page load
    const timeout = setTimeout(() => {
      runPreCache();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isOnline, locations, runPreCache]);

  // Also trigger when coming back online after being offline
  useEffect(() => {
    if (!isOnline) {
      // Reset hasRun when going offline so we re-cache on reconnect
      hasRun.current = false;
    }
  }, [isOnline]);

  return status;
}

/**
 * Get pre-cached rectangle codes (for UI display)
 */
export function usePreCachedRectangles(): string[] {
  const [rectangles, setRectangles] = useState<string[]>([]);

  useEffect(() => {
    setRectangles(getPreCachedRectangles());
  }, []);

  return rectangles;
}

export default useAutoPreCache;
