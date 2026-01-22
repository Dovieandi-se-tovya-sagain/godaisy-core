/**
 * API Call Tracker
 *
 * Wraps fetch to automatically track performance metrics including cache status
 */

import { perfMetrics } from './metrics';
import type { CacheStatus, ApiCallMetric } from './types';

interface TrackedFetchOptions extends RequestInit {
  /**
   * Override the cache status (e.g., if you know it's from a local cache)
   */
  cacheStatus?: CacheStatus;

  /**
   * TTL of the cached response in seconds
   */
  cacheTtlSeconds?: number;

  /**
   * Skip tracking this request
   */
  skipTracking?: boolean;
}

/**
 * Determine cache status from response headers
 */
function detectCacheStatus(response: Response): CacheStatus {
  // Check for custom cache header (if your API sets one)
  const cacheHeader = response.headers.get('x-cache-status');
  if (cacheHeader) {
    if (cacheHeader === 'HIT') return 'hit';
    if (cacheHeader === 'STALE') return 'stale';
    if (cacheHeader === 'MISS') return 'miss';
    if (cacheHeader === 'BYPASS') return 'bypass';
  }

  // Check standard cache headers
  const age = response.headers.get('age');
  const cacheControl = response.headers.get('cache-control');

  if (age && parseInt(age, 10) > 0) {
    // Response was served from cache
    return 'hit';
  }

  if (cacheControl?.includes('no-cache') || cacheControl?.includes('no-store')) {
    return 'bypass';
  }

  // Default to miss
  return 'miss';
}

/**
 * Extract TTL from Cache-Control header
 */
function extractTtl(response: Response): number | null {
  const cacheControl = response.headers.get('cache-control');
  if (!cacheControl) return null;

  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  if (maxAgeMatch) {
    return parseInt(maxAgeMatch[1], 10);
  }

  const sMaxAgeMatch = cacheControl.match(/s-maxage=(\d+)/);
  if (sMaxAgeMatch) {
    return parseInt(sMaxAgeMatch[1], 10);
  }

  return null;
}

/**
 * Get response size from Content-Length header
 */
function getResponseSize(response: Response): number | null {
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    return parseInt(contentLength, 10);
  }
  return null;
}

/**
 * Clean endpoint path for grouping (remove IDs and query params)
 */
function cleanEndpoint(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    let path = parsed.pathname;

    // Remove UUIDs
    path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');

    // Remove numeric IDs
    path = path.replace(/\/\d+/g, '/:id');

    return path;
  } catch {
    return url;
  }
}

/**
 * Tracked fetch wrapper
 *
 * Usage:
 * ```typescript
 * const response = await trackedFetch('/api/grow/planting-calendar');
 * ```
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: TrackedFetchOptions
): Promise<Response> {
  if (init?.skipTracking) {
    return fetch(input, init);
  }

  const startedAt = Date.now();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? 'GET';
  const endpoint = cleanEndpoint(url);

  let response: Response;
  let error: string | null = null;
  let status: number | null = null;
  let cacheStatus: CacheStatus = init?.cacheStatus ?? 'miss';
  let responseSize: number | null = null;
  let ttlSeconds: number | null = init?.cacheTtlSeconds ?? null;

  try {
    response = await fetch(input, init);
    status = response.status;
    cacheStatus = init?.cacheStatus ?? detectCacheStatus(response);
    responseSize = getResponseSize(response);
    ttlSeconds = ttlSeconds ?? extractTtl(response);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    const duration = Date.now() - startedAt;

    const metric: ApiCallMetric = {
      endpoint,
      method,
      startedAt,
      duration,
      status,
      cacheStatus,
      responseSize,
      ttlSeconds,
      error,
    };

    perfMetrics.recordApiCall(metric);
  }

  return response;
}

/**
 * Create a tracked API client for a specific base URL
 *
 * Usage:
 * ```typescript
 * const api = createTrackedApi('/api/grow');
 * const data = await api.get('/planting-calendar');
 * ```
 */
export function createTrackedApi(baseUrl: string) {
  return {
    async get<T>(path: string, options?: TrackedFetchOptions): Promise<T> {
      const response = await trackedFetch(`${baseUrl}${path}`, {
        method: 'GET',
        ...options,
      });
      return response.json();
    },

    async post<T>(path: string, body?: unknown, options?: TrackedFetchOptions): Promise<T> {
      const response = await trackedFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });
      return response.json();
    },

    async put<T>(path: string, body?: unknown, options?: TrackedFetchOptions): Promise<T> {
      const response = await trackedFetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });
      return response.json();
    },

    async delete<T>(path: string, options?: TrackedFetchOptions): Promise<T> {
      const response = await trackedFetch(`${baseUrl}${path}`, {
        method: 'DELETE',
        ...options,
      });
      return response.json();
    },
  };
}

/**
 * Record a cache hit manually (for local caches like IndexedDB)
 */
export function recordCacheHit(endpoint: string, ttlSeconds?: number) {
  perfMetrics.recordApiCall({
    endpoint: cleanEndpoint(endpoint),
    method: 'GET',
    startedAt: Date.now(),
    duration: 1, // Essentially instant
    status: 200,
    cacheStatus: 'hit',
    responseSize: null,
    ttlSeconds: ttlSeconds ?? null,
    error: null,
  });
}

/**
 * Record a stale cache hit manually
 */
export function recordStaleCacheHit(endpoint: string, ageSeconds: number, ttlSeconds?: number) {
  perfMetrics.recordApiCall({
    endpoint: cleanEndpoint(endpoint),
    method: 'GET',
    startedAt: Date.now(),
    duration: 1,
    status: 200,
    cacheStatus: 'stale',
    responseSize: null,
    ttlSeconds: ttlSeconds ?? null,
    error: null,
  });

  console.log(`[Perf] Stale cache hit: ${endpoint} (${ageSeconds}s old)`);
}
