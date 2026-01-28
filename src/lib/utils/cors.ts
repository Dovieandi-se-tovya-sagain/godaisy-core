/**
 * CORS Utility for API Routes
 *
 * Provides secure CORS handling with origin validation.
 * Only allows requests from known production and development origins.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Allowed origins for CORS
 * Includes production domains and localhost for development
 */
const ALLOWED_ORIGINS = [
  // Production domains
  'https://godaisy.io',
  'https://www.godaisy.io',
  'https://fishfindr.eu',
  'https://www.fishfindr.eu',
  'https://grow.godaisy.io',
  // Vercel preview deployments
  /^https:\/\/wotnow-.*\.vercel\.app$/,
  /^https:\/\/.*-mrdamianrafferty\.vercel\.app$/,
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  // Capacitor native apps (no origin header)
  null,
];

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow requests with no origin (same-origin, Capacitor, curl, etc.)
    return true;
  }

  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed === null) continue;
    if (typeof allowed === 'string' && allowed === origin) {
      return true;
    }
    if (allowed instanceof RegExp && allowed.test(origin)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the CORS origin to return
 * Returns the request origin if allowed, null otherwise
 */
function getCorsOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return null; // No origin header, no CORS header needed
  }

  if (isOriginAllowed(origin)) {
    return origin;
  }

  return null;
}

/**
 * Apply CORS headers to a response
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 * @param options - CORS options
 * @returns true if this is a preflight request that was handled
 */
export function applyCors(
  req: NextApiRequest,
  res: NextApiResponse,
  options: {
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  } = {}
): boolean {
  const origin = req.headers.origin;
  const corsOrigin = getCorsOrigin(origin);

  const methods = options.methods || ['GET', 'POST', 'OPTIONS'];
  const headers = options.headers || ['Content-Type', 'Authorization'];
  const credentials = options.credentials ?? true;

  // Set CORS headers if origin is allowed
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', headers.join(', '));

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(204).end();
    return true;
  }

  return false;
}

/**
 * Check if request origin is allowed
 * Use this to reject requests from unknown origins
 */
export function isRequestOriginAllowed(req: NextApiRequest): boolean {
  return isOriginAllowed(req.headers.origin);
}

const corsApi = {
  applyCors,
  isRequestOriginAllowed,
  isOriginAllowed,
};

export default corsApi;
