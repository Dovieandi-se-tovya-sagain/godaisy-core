/**
 * Capacitor Initialization Hook
 *
 * Hook to initialize Capacitor features (splash screen, offline sync, etc.)
 * Call this in your top-level page component to properly initialize the app.
 *
 * Usage:
 * ```typescript
 * import { useCapacitorInit } from './useCapacitorInit';
 *
 * export default function HomePage() {
 *   const { isReady, isNative, platform } = useCapacitorInit({
 *     preloadImages: true,
 *     imageUrls: ['/images/hero.jpg', '/images/logo.png'],
 *   });
 *
 *   if (!isReady) return null; // Or loading state
 *
 *   return <div>...</div>;
 * }
 * ```
 */

import { useEffect, useState } from 'react';
import { initializeApp, isNativePlatform, getPlatform } from '../lib/capacitor/appInit';

interface UseCapacitorInitOptions {
  /** Whether to initialize Grow sync (default: true) */
  initGrowSync?: boolean;
  /** Whether to preload images (default: false) */
  preloadImages?: boolean;
  /** Image URLs to preload */
  imageUrls?: string[];
  /** Minimum splash time in ms (default: 500) */
  minSplashTime?: number;
  /** Skip initialization (for web-only pages) */
  skip?: boolean;
}

interface UseCapacitorInitResult {
  /** Whether initialization is complete */
  isReady: boolean;
  /** Whether running on native platform */
  isNative: boolean;
  /** Current platform */
  platform: 'ios' | 'android' | 'web';
  /** Any error that occurred during init */
  error: Error | null;
}

export function useCapacitorInit(options: UseCapacitorInitOptions = {}): UseCapacitorInitResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    initGrowSync = true,
    preloadImages = false,
    imageUrls = [],
    minSplashTime = 500,
    skip = false,
  } = options;

  useEffect(() => {
    if (skip) {
      setIsReady(true);
      return;
    }

    const init = async () => {
      try {
        await initializeApp({
          initGrowSync,
          preloadImages,
          imageUrls,
          minSplashTime,
        });
        setIsReady(true);
      } catch (err) {
        console.error('[useCapacitorInit] Initialization failed:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsReady(true); // Still mark ready so app can render
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, initGrowSync, preloadImages, imageUrls.length, minSplashTime]);

  return {
    isReady,
    isNative: isNativePlatform(),
    platform: getPlatform(),
    error,
  };
}
