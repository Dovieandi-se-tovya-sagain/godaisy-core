'use client';

/**
 * Performance Initialization Component
 *
 * Initializes performance tracking for iOS profiling.
 * Must be placed near the root of the app.
 */

import { usePerformanceInit, useColdStartTracking, usePerformanceSnapshot } from '../lib/performance';
import { useEffect } from 'react';

export function PerformanceInit() {
  // Initialize performance tracking with platform detection
  usePerformanceInit();

  // Track cold start time
  useColdStartTracking();

  // Get snapshot logger for debugging
  const logSnapshot = usePerformanceSnapshot();

  // Expose snapshot function globally for debugging in console
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__perfSnapshot = logSnapshot;

      // Also import perfMetrics for direct access
      import('../lib/performance').then(({ perfMetrics }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__perfMetrics = perfMetrics;
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[Perf] Performance tracking initialized. Use window.__perfSnapshot() to view metrics.');
      }
    }
  }, [logSnapshot]);

  return null;
}
