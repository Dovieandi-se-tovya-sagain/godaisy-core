/**
 * React Hooks for Performance Tracking
 *
 * Easy integration with React components
 */

import { useEffect, useRef, useCallback } from 'react';
import { perfMetrics, ScreenTracker } from './metrics';
import type { CacheStatus } from './types';

/**
 * Track screen/page performance
 *
 * Usage:
 * ```typescript
 * function MyPage() {
 *   const { markFirstData, markInteractive } = useScreenTracking('MyPage');
 *
 *   useEffect(() => {
 *     fetchData().then(() => {
 *       markFirstData();
 *       markInteractive();
 *     });
 *   }, []);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useScreenTracking(screenName: string) {
  const trackerRef = useRef<ScreenTracker | null>(null);
  const mountedRef = useRef(false);

  // Start tracking on mount
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    trackerRef.current = perfMetrics.startScreen(screenName);

    // Mark first render immediately
    trackerRef.current.markFirstRender();

    // Complete tracking on unmount
    return () => {
      trackerRef.current?.complete();
    };
  }, [screenName]);

  const markFirstData = useCallback(() => {
    trackerRef.current?.markFirstData();
  }, []);

  const markInteractive = useCallback(() => {
    trackerRef.current?.markInteractive();
  }, []);

  const recordApiCall = useCallback((cacheStatus: CacheStatus) => {
    trackerRef.current?.recordApiCall(cacheStatus);
  }, []);

  return {
    markFirstData,
    markInteractive,
    recordApiCall,
  };
}

/**
 * Track cold start time
 *
 * Call this once in your root component
 *
 * Usage:
 * ```typescript
 * function App() {
 *   useColdStartTracking();
 *   return <Routes />;
 * }
 * ```
 */
export function useColdStartTracking() {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    // Use Navigation Timing API if available
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

      if (navigation) {
        // Time from navigation start to DOM content loaded
        const coldStart = navigation.domContentLoadedEventEnd - navigation.startTime;
        perfMetrics.setColdStart(Math.round(coldStart));
      } else {
        // Fallback: use performance.now() as approximate cold start
        const approxColdStart = performance.now();
        perfMetrics.setColdStart(Math.round(approxColdStart));
      }
    }
  }, []);
}

/**
 * Initialize performance tracking with platform info
 *
 * Call this once at app startup
 *
 * Usage:
 * ```typescript
 * function App() {
 *   usePerformanceInit();
 *   return <Routes />;
 * }
 * ```
 */
export function usePerformanceInit() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Detect platform
    const detectPlatform = async () => {
      try {
        // Dynamic import to avoid issues in SSR
        const { Capacitor } = await import('@capacitor/core');
        const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
        perfMetrics.init(platform);
      } catch {
        // Not running in Capacitor, assume web
        perfMetrics.init('web');
      }
    };

    void detectPlatform();
  }, []);
}

/**
 * Log performance snapshot on demand
 *
 * Usage:
 * ```typescript
 * function DebugPanel() {
 *   const logSnapshot = usePerformanceSnapshot();
 *   return <button onClick={logSnapshot}>Log Performance</button>;
 * }
 * ```
 */
export function usePerformanceSnapshot() {
  return useCallback(() => {
    perfMetrics.logSnapshot();
  }, []);
}
