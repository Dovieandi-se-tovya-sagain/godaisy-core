/**
 * Rate Limiter Utility
 *
 * Prevents API abuse by limiting the number of requests per time window.
 * Uses in-memory storage (resets on server restart).
 *
 * Features:
 * - Sliding window rate limiting
 * - Per-user or per-IP rate limiting
 * - Configurable limits and windows
 * - User-friendly error messages
 *
 * Usage in API routes:
 *   import { rateLimiter, RateLimitError } from './rate-limiter';
 *
 *   export default async function handler(req, res) {
 *     try {
 *       await rateLimiter.check(req, { maxRequests: 10, windowMs: 60000 });
 *       // Handle request...
 *     } catch (error) {
 *       if (error instanceof RateLimitError) {
 *         return res.status(429).json({ error: error.message, retryAfter: error.retryAfter });
 *       }
 *       throw error;
 *     }
 *   }
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom identifier (defaults to user ID or IP) */
  identifier?: string;
}

export interface RateLimitInfo {
  /** Number of requests made in current window */
  count: number;
  /** Timestamp when the window resets */
  resetTime: number;
  /** Array of request timestamps in current window */
  requests: number[];
}

/**
 * Custom error for rate limit exceeded
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number, // Seconds until limit resets
    public limit: number,
    public remaining: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * In-memory store for rate limit data
 * Format: Map<identifier, RateLimitInfo>
 */
const rateLimitStore = new Map<string, RateLimitInfo>();

/**
 * Clean up old entries periodically (every 60 seconds)
 * Removes entries that:
 * 1. Have passed their reset time
 * 2. Have no recent requests (inactive for 2x window duration)
 */
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, info] of entries) {
    // Remove if reset time has passed
    if (info.resetTime < now) {
      rateLimitStore.delete(key);
      continue;
    }

    // Remove if no recent requests (stale for 2x window duration)
    const lastRequest = info.requests[info.requests.length - 1] || 0;
    const maxStaleTime = 2 * 60 * 1000; // 2 minutes (2x default window)
    if (now - lastRequest > maxStaleTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Every 60 seconds

/**
 * Get identifier from request (user ID or IP address)
 */
function getIdentifier(req: NextApiRequest, customIdentifier?: string): string {
  if (customIdentifier) {
    return customIdentifier;
  }

  // Try to get user ID from session/auth (implement based on your auth system)
  // For now, use IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.socket.remoteAddress || 'unknown';

  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 *
 * @param req - Next.js API request
 * @param options - Rate limit configuration
 * @throws RateLimitError if limit exceeded
 * @returns Remaining requests in current window
 */
export async function checkRateLimit(
  req: NextApiRequest,
  options: RateLimitOptions
): Promise<number> {
  const { maxRequests, windowMs, identifier: customIdentifier } = options;
  const identifier = getIdentifier(req, customIdentifier);
  const now = Date.now();

  // Get or create rate limit info
  let info = rateLimitStore.get(identifier);

  if (!info) {
    // First request from this identifier
    info = {
      count: 0,
      resetTime: now + windowMs,
      requests: [],
    };
    rateLimitStore.set(identifier, info);
  }

  // Check if window has expired
  if (now >= info.resetTime) {
    // Reset window
    info = {
      count: 0,
      resetTime: now + windowMs,
      requests: [],
    };
    rateLimitStore.set(identifier, info);
  }

  // Remove requests outside the current window (sliding window)
  const windowStart = now - windowMs;
  info.requests = info.requests.filter((timestamp) => timestamp > windowStart);
  info.count = info.requests.length;

  // Check if limit exceeded
  if (info.count >= maxRequests) {
    const oldestRequest = info.requests[0] || now;
    const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

    throw new RateLimitError(
      `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds. Please try again in ${retryAfter} seconds.`,
      retryAfter,
      maxRequests,
      0
    );
  }

  // Add current request
  info.requests.push(now);
  info.count++;

  return maxRequests - info.count;
}

/**
 * Rate limiter class with preset configurations
 */
export class RateLimiter {
  constructor(private defaultOptions: RateLimitOptions) {}

  /**
   * Check rate limit with default or custom options
   */
  async check(
    req: NextApiRequest,
    options?: Partial<RateLimitOptions>
  ): Promise<number> {
    const finalOptions = { ...this.defaultOptions, ...options };
    return checkRateLimit(req, finalOptions);
  }

  /**
   * Get current rate limit status without incrementing
   */
  getStatus(req: NextApiRequest, identifier?: string): {
    count: number;
    limit: number;
    remaining: number;
    resetTime: number;
  } {
    const id = identifier || getIdentifier(req);
    const info = rateLimitStore.get(id);
    const now = Date.now();

    if (!info || now >= info.resetTime) {
      return {
        count: 0,
        limit: this.defaultOptions.maxRequests,
        remaining: this.defaultOptions.maxRequests,
        resetTime: now + this.defaultOptions.windowMs,
      };
    }

    // Remove expired requests
    const windowStart = now - this.defaultOptions.windowMs;
    const activeRequests = info.requests.filter((timestamp) => timestamp > windowStart);

    return {
      count: activeRequests.length,
      limit: this.defaultOptions.maxRequests,
      remaining: Math.max(0, this.defaultOptions.maxRequests - activeRequests.length),
      resetTime: info.resetTime,
    };
  }

  /**
   * Reset rate limit for an identifier (useful for testing)
   */
  reset(identifier: string): void {
    rateLimitStore.delete(identifier);
  }

  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    rateLimitStore.clear();
  }
}

/**
 * Default rate limiter (10 requests per minute)
 */
export const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Strict rate limiter for sensitive endpoints (5 requests per minute)
 */
export const strictRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000,
});

/**
 * Lenient rate limiter for public endpoints (30 requests per minute)
 */
export const lenientRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000,
});

/**
 * Helper: Add rate limit headers to response
 *
 * @example
 * const remaining = await rateLimiter.check(req);
 * addRateLimitHeaders(res, rateLimiter.getStatus(req));
 */
export function addRateLimitHeaders(
  res: NextApiResponse,
  status: { count: number; limit: number; remaining: number; resetTime: number }
): void {
  res.setHeader('X-RateLimit-Limit', status.limit);
  res.setHeader('X-RateLimit-Remaining', status.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(status.resetTime / 1000));
}
