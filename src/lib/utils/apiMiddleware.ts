/**
 * API Middleware Helpers
 *
 * Common middleware patterns for API routes including:
 * - Rate limiting
 * - CORS handling
 * - Error handling
 *
 * Usage:
 * ```typescript
 * import { withRateLimit, withCors } from './apiMiddleware';
 *
 * export default withRateLimit(
 *   async function handler(req, res) {
 *     // Your handler logic
 *   },
 *   { maxRequests: 10, windowMs: 60000 }
 * );
 * ```
 */

import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import {
  rateLimiter,
  strictRateLimiter,
  lenientRateLimiter,
  RateLimitError,
  addRateLimitHeaders,
  type RateLimitOptions,
} from './rate-limiter';
import { applyCors } from './cors';

export type RateLimitPreset = 'default' | 'strict' | 'lenient';

/**
 * Wrap an API handler with rate limiting
 *
 * @param handler - The API handler function
 * @param options - Rate limit options or preset name
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit(
  handler: NextApiHandler,
  options: Partial<RateLimitOptions> | RateLimitPreset = 'default'
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Select rate limiter based on preset
    const limiter =
      options === 'strict'
        ? strictRateLimiter
        : options === 'lenient'
          ? lenientRateLimiter
          : rateLimiter;

    const customOptions =
      typeof options === 'object' ? options : undefined;

    try {
      await limiter.check(req, customOptions);
      addRateLimitHeaders(res, limiter.getStatus(req));
      return handler(req, res);
    } catch (error) {
      if (error instanceof RateLimitError) {
        addRateLimitHeaders(res, {
          count: error.limit,
          limit: error.limit,
          remaining: error.remaining,
          resetTime: Date.now() + error.retryAfter * 1000,
        });
        res.setHeader('Retry-After', error.retryAfter);
        return res.status(429).json({
          error: 'Too many requests',
          message: error.message,
          retryAfter: error.retryAfter,
        });
      }
      throw error;
    }
  };
}

/**
 * Wrap an API handler with CORS support
 *
 * @param handler - The API handler function
 * @param options - CORS options
 * @returns Wrapped handler with CORS
 */
export function withCors(
  handler: NextApiHandler,
  options: {
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  } = {}
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const isPreflightHandled = applyCors(req, res, options);
    if (isPreflightHandled) return;

    return handler(req, res);
  };
}

/**
 * Combine multiple middleware wrappers
 *
 * @param handler - The API handler function
 * @param middlewares - Array of middleware wrapper functions
 * @returns Handler wrapped with all middleware
 */
export function withMiddleware(
  handler: NextApiHandler,
  ...middlewares: Array<(h: NextApiHandler) => NextApiHandler>
): NextApiHandler {
  return middlewares.reduceRight((h, middleware) => middleware(h), handler);
}

/**
 * Quick helper to add both CORS and rate limiting
 *
 * @param handler - The API handler function
 * @param rateLimit - Rate limit preset or options
 * @returns Handler with CORS and rate limiting
 */
export function withSecureApi(
  handler: NextApiHandler,
  rateLimit: Partial<RateLimitOptions> | RateLimitPreset = 'default'
): NextApiHandler {
  return withCors(withRateLimit(handler, rateLimit));
}

const apiMiddlewareApi = {
  withRateLimit,
  withCors,
  withMiddleware,
  withSecureApi,
};

export default apiMiddlewareApi;
