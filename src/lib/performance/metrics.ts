/**
 * Core Performance Metrics Collection
 *
 * Collects and stores performance data for iOS profiling
 */

import type {
  Platform,
  TimingMark,
  TimingMeasure,
  ApiCallMetric,
  ScreenMetric,
  PerformanceSnapshot,
  ScreenMetricSummary,
  ApiMetricSummary,
  EndpointSummary,
  CacheStatus,
} from './types';

// Generate unique session ID
const generateSessionId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
};

// Calculate percentile from sorted array
const percentile = (arr: number[], p: number): number | null => {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

class PerformanceMetrics {
  private sessionId = generateSessionId();
  private startedAt = Date.now();
  private coldStartMs: number | null = null;

  private marks: TimingMark[] = [];
  private measures: TimingMeasure[] = [];
  private apiCalls: ApiCallMetric[] = [];
  private screens: Map<string, ScreenMetric[]> = new Map();

  private platform: Platform = 'web';
  private maxStoredItems = 1000; // Limit memory usage

  /**
   * Initialize with platform info
   */
  init(platform: Platform) {
    this.platform = platform;
    this.mark('perf:init');

    // Log initialization
    if (typeof console !== 'undefined') {
      console.log(`[Perf] Initialized on ${platform}, session: ${this.sessionId}`);
    }
  }

  /**
   * Record cold start time (from app launch to first content)
   */
  setColdStart(durationMs: number) {
    this.coldStartMs = durationMs;
    console.log(`[Perf] Cold start: ${durationMs}ms`);
  }

  /**
   * Add a timing mark
   */
  mark(name: string, metadata?: Record<string, unknown>) {
    const mark: TimingMark = {
      name,
      timestamp: Date.now(),
      metadata,
    };

    this.marks.push(mark);
    this.trimIfNeeded('marks');

    // Also use native Performance API if available
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(name);
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark: string, metadata?: Record<string, unknown>): number | null {
    const start = this.marks.find((m) => m.name === startMark);
    const end = this.marks.find((m) => m.name === endMark);

    if (!start || !end) {
      console.warn(`[Perf] Cannot measure "${name}": missing marks`);
      return null;
    }

    const duration = end.timestamp - start.timestamp;

    const measure: TimingMeasure = {
      name,
      startMark,
      endMark,
      duration,
      metadata,
    };

    this.measures.push(measure);
    this.trimIfNeeded('measures');

    console.log(`[Perf] ${name}: ${duration}ms`);

    return duration;
  }

  /**
   * Record an API call
   */
  recordApiCall(metric: ApiCallMetric) {
    this.apiCalls.push(metric);
    this.trimIfNeeded('apiCalls');

    const cacheIcon = metric.cacheStatus === 'hit' ? '💾' : metric.cacheStatus === 'stale' ? '⏰' : '🌐';
    const statusIcon = metric.status && metric.status >= 400 ? '❌' : '✅';

    console.log(
      `[Perf] API ${cacheIcon} ${metric.method} ${metric.endpoint} - ${metric.duration}ms ${statusIcon}`,
      {
        cache: metric.cacheStatus,
        size: metric.responseSize,
        ttl: metric.ttlSeconds,
      }
    );
  }

  /**
   * Start tracking a screen
   */
  startScreen(screenName: string): ScreenTracker {
    const startedAt = Date.now();
    this.mark(`screen:${screenName}:start`);

    return new ScreenTracker(this, screenName, startedAt);
  }

  /**
   * Record completed screen metrics
   */
  recordScreen(metric: ScreenMetric) {
    if (!this.screens.has(metric.screenName)) {
      this.screens.set(metric.screenName, []);
    }

    const screenMetrics = this.screens.get(metric.screenName)!;
    screenMetrics.push(metric);

    // Limit per-screen history
    if (screenMetrics.length > 100) {
      screenMetrics.shift();
    }

    console.log(`[Perf] Screen "${metric.screenName}"`, {
      firstRender: metric.timeToFirstRender,
      firstData: metric.timeToFirstData,
      interactive: metric.timeToInteractive,
      apiCalls: metric.apiCalls,
      cacheHits: metric.cacheHits,
    });
  }

  /**
   * Get full performance snapshot
   */
  snapshot(): PerformanceSnapshot {
    const uptimeMs = Date.now() - this.startedAt;

    return {
      platform: this.platform,
      sessionId: this.sessionId,
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeMs,
      coldStartMs: this.coldStartMs,
      screens: this.getScreenSummaries(),
      apiMetrics: this.getApiSummary(),
      marks: [...this.marks],
      measures: [...this.measures],
    };
  }

  /**
   * Get screen metric summaries
   */
  private getScreenSummaries(): ScreenMetricSummary[] {
    const summaries: ScreenMetricSummary[] = [];

    for (const [screenName, metrics] of this.screens) {
      const renderTimes = metrics.map((m) => m.timeToFirstRender).filter((t): t is number => t !== null);
      const dataTimes = metrics.map((m) => m.timeToFirstData).filter((t): t is number => t !== null);
      const interactiveTimes = metrics.map((m) => m.timeToInteractive).filter((t): t is number => t !== null);

      summaries.push({
        screenName,
        visits: metrics.length,
        avgTimeToFirstRender: renderTimes.length ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : null,
        avgTimeToFirstData: dataTimes.length ? dataTimes.reduce((a, b) => a + b, 0) / dataTimes.length : null,
        avgTimeToInteractive: interactiveTimes.length
          ? interactiveTimes.reduce((a, b) => a + b, 0) / interactiveTimes.length
          : null,
        p95TimeToFirstRender: percentile(renderTimes, 95),
      });
    }

    return summaries.sort((a, b) => b.visits - a.visits);
  }

  /**
   * Get API metrics summary
   */
  private getApiSummary(): ApiMetricSummary {
    const calls = this.apiCalls;
    const hits = calls.filter((c) => c.cacheStatus === 'hit' || c.cacheStatus === 'stale').length;
    const misses = calls.filter((c) => c.cacheStatus === 'miss').length;
    const durations = calls.map((c) => c.duration);

    // Group by endpoint
    const byEndpoint = new Map<string, ApiCallMetric[]>();
    for (const call of calls) {
      const key = call.endpoint;
      if (!byEndpoint.has(key)) {
        byEndpoint.set(key, []);
      }
      byEndpoint.get(key)!.push(call);
    }

    const endpointSummaries: EndpointSummary[] = [];
    for (const [endpoint, endpointCalls] of byEndpoint) {
      const endpointHits = endpointCalls.filter((c) => c.cacheStatus === 'hit' || c.cacheStatus === 'stale').length;
      const endpointErrors = endpointCalls.filter((c) => c.error !== null).length;
      const endpointDurations = endpointCalls.map((c) => c.duration);

      endpointSummaries.push({
        endpoint,
        calls: endpointCalls.length,
        avgDuration: endpointDurations.length
          ? endpointDurations.reduce((a, b) => a + b, 0) / endpointDurations.length
          : 0,
        cacheHitRate: endpointCalls.length ? endpointHits / endpointCalls.length : 0,
        errorRate: endpointCalls.length ? endpointErrors / endpointCalls.length : 0,
      });
    }

    return {
      totalCalls: calls.length,
      cacheHits: hits,
      cacheMisses: misses,
      cacheHitRate: calls.length ? hits / calls.length : 0,
      avgDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p95Duration: percentile(durations, 95) ?? 0,
      byEndpoint: endpointSummaries.sort((a, b) => b.calls - a.calls),
    };
  }

  /**
   * Log current snapshot to console
   */
  logSnapshot() {
    const snap = this.snapshot();
    console.log('[Perf] === PERFORMANCE SNAPSHOT ===');
    console.log(`Platform: ${snap.platform}`);
    console.log(`Session: ${snap.sessionId}`);
    console.log(`Uptime: ${(snap.uptimeMs / 1000).toFixed(1)}s`);
    console.log(`Cold Start: ${snap.coldStartMs ?? 'not recorded'}ms`);
    console.log('');
    console.log('Screens:');
    for (const screen of snap.screens) {
      console.log(
        `  ${screen.screenName}: ${screen.visits} visits, ` +
          `render=${screen.avgTimeToFirstRender?.toFixed(0) ?? '-'}ms, ` +
          `data=${screen.avgTimeToFirstData?.toFixed(0) ?? '-'}ms`
      );
    }
    console.log('');
    console.log('API Metrics:');
    console.log(`  Total: ${snap.apiMetrics.totalCalls} calls`);
    console.log(`  Cache Hit Rate: ${(snap.apiMetrics.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`  Avg Duration: ${snap.apiMetrics.avgDuration.toFixed(0)}ms`);
    console.log(`  P95 Duration: ${snap.apiMetrics.p95Duration.toFixed(0)}ms`);
    console.log('[Perf] === END SNAPSHOT ===');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.sessionId = generateSessionId();
    this.startedAt = Date.now();
    this.coldStartMs = null;
    this.marks = [];
    this.measures = [];
    this.apiCalls = [];
    this.screens.clear();
    console.log(`[Perf] Reset, new session: ${this.sessionId}`);
  }

  /**
   * Trim arrays to prevent memory issues
   */
  private trimIfNeeded(type: 'marks' | 'measures' | 'apiCalls') {
    const arr = this[type];
    if (arr.length > this.maxStoredItems) {
      arr.splice(0, arr.length - this.maxStoredItems);
    }
  }
}

/**
 * Screen tracker helper class
 */
export class ScreenTracker {
  private metrics: PerformanceMetrics;
  private screenName: string;
  private startedAt: number;
  private firstRenderAt: number | null = null;
  private firstDataAt: number | null = null;
  private interactiveAt: number | null = null;
  private apiCallCount = 0;
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  constructor(metrics: PerformanceMetrics, screenName: string, startedAt: number) {
    this.metrics = metrics;
    this.screenName = screenName;
    this.startedAt = startedAt;
  }

  /**
   * Mark first render (React component mounted)
   */
  markFirstRender() {
    if (!this.firstRenderAt) {
      this.firstRenderAt = Date.now();
      this.metrics.mark(`screen:${this.screenName}:firstRender`);
    }
  }

  /**
   * Mark first data loaded
   */
  markFirstData() {
    if (!this.firstDataAt) {
      this.firstDataAt = Date.now();
      this.metrics.mark(`screen:${this.screenName}:firstData`);
    }
  }

  /**
   * Mark screen interactive (all critical data loaded)
   */
  markInteractive() {
    if (!this.interactiveAt) {
      this.interactiveAt = Date.now();
      this.metrics.mark(`screen:${this.screenName}:interactive`);
    }
  }

  /**
   * Record an API call for this screen
   */
  recordApiCall(cacheStatus: CacheStatus) {
    this.apiCallCount++;
    if (cacheStatus === 'hit' || cacheStatus === 'stale') {
      this.cacheHitCount++;
    } else if (cacheStatus === 'miss') {
      this.cacheMissCount++;
    }
  }

  /**
   * Complete screen tracking and record metrics
   */
  complete() {
    const now = Date.now();

    // Auto-set interactive if not set
    if (!this.interactiveAt) {
      this.interactiveAt = now;
    }

    this.metrics.recordScreen({
      screenName: this.screenName,
      startedAt: this.startedAt,
      timeToFirstRender: this.firstRenderAt ? this.firstRenderAt - this.startedAt : null,
      timeToFirstData: this.firstDataAt ? this.firstDataAt - this.startedAt : null,
      timeToInteractive: this.interactiveAt ? this.interactiveAt - this.startedAt : null,
      apiCalls: this.apiCallCount,
      cacheHits: this.cacheHitCount,
      cacheMisses: this.cacheMissCount,
    });
  }
}

// Singleton instance
export const perfMetrics = new PerformanceMetrics();
