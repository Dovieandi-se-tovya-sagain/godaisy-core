/**
 * Performance Monitoring Types
 *
 * Shared type definitions for iOS performance profiling
 */

export type Platform = 'ios' | 'android' | 'web';
export type CacheStatus = 'hit' | 'miss' | 'stale' | 'bypass';

export interface TimingMark {
  name: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TimingMeasure {
  name: string;
  startMark: string;
  endMark: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ApiCallMetric {
  endpoint: string;
  method: string;
  startedAt: number;
  duration: number;
  status: number | null;
  cacheStatus: CacheStatus;
  responseSize: number | null;
  ttlSeconds: number | null;
  error: string | null;
}

export interface ScreenMetric {
  screenName: string;
  startedAt: number;
  timeToFirstRender: number | null;
  timeToFirstData: number | null;
  timeToInteractive: number | null;
  apiCalls: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface PerformanceSnapshot {
  platform: Platform;
  sessionId: string;
  startedAt: string;
  uptimeMs: number;
  coldStartMs: number | null;
  screens: ScreenMetricSummary[];
  apiMetrics: ApiMetricSummary;
  marks: TimingMark[];
  measures: TimingMeasure[];
}

export interface ScreenMetricSummary {
  screenName: string;
  visits: number;
  avgTimeToFirstRender: number | null;
  avgTimeToFirstData: number | null;
  avgTimeToInteractive: number | null;
  p95TimeToFirstRender: number | null;
}

export interface ApiMetricSummary {
  totalCalls: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  avgDuration: number;
  p95Duration: number;
  byEndpoint: EndpointSummary[];
}

export interface EndpointSummary {
  endpoint: string;
  calls: number;
  avgDuration: number;
  cacheHitRate: number;
  errorRate: number;
}
