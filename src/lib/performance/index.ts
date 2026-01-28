/**
 * Performance Monitoring Module
 *
 * iOS Speed + Offline Plan - Phase 0 Baseline Profiling
 *
 * Usage:
 *
 * 1. Initialize in your app:
 * ```typescript
 * import { usePerformanceInit, useColdStartTracking } from './';
 *
 * function App() {
 *   usePerformanceInit();
 *   useColdStartTracking();
 *   return <Routes />;
 * }
 * ```
 *
 * 2. Track screens:
 * ```typescript
 * import { useScreenTracking } from './';
 *
 * function WeeklyTaskView() {
 *   const { markFirstData, markInteractive } = useScreenTracking('WeeklyTaskView');
 *
 *   useEffect(() => {
 *     fetchCalendar().then(() => {
 *       markFirstData();
 *       markInteractive();
 *     });
 *   }, []);
 * }
 * ```
 *
 * 3. Track API calls:
 * ```typescript
 * import { trackedFetch, recordCacheHit } from './';
 *
 * // Network fetch with automatic tracking
 * const response = await trackedFetch('/api/grow/planting-calendar');
 *
 * // Or record cache hit for local data
 * recordCacheHit('/api/grow/planting-calendar', 3600);
 * ```
 *
 * 4. View metrics:
 * ```typescript
 * import { perfMetrics } from './';
 *
 * // Log to console
 * perfMetrics.logSnapshot();
 *
 * // Get raw data
 * const snapshot = perfMetrics.snapshot();
 * ```
 */

// Core metrics
export { perfMetrics, ScreenTracker } from './metrics';

// API tracking
export { trackedFetch, createTrackedApi, recordCacheHit, recordStaleCacheHit } from './api-tracker';

// React hooks
export { useScreenTracking, useColdStartTracking, usePerformanceInit, usePerformanceSnapshot } from './hooks';

// Types
export type {
  Platform,
  CacheStatus,
  TimingMark,
  TimingMeasure,
  ApiCallMetric,
  ScreenMetric,
  PerformanceSnapshot,
  ScreenMetricSummary,
  ApiMetricSummary,
  EndpointSummary,
} from './types';
