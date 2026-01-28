import { createServerClient } from '@supabase/ssr'
import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Creates a Supabase client for use in Next.js Pages API routes
 *
 * @deprecated Use createPagesServerClient from @supabase/auth-helpers-nextjs instead
 * This function is maintained for backwards compatibility but should be migrated
 */
export function createServerSupabaseClient(context: { req: NextApiRequest; res: NextApiResponse }) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          // Convert req.cookies object to array format expected by @supabase/ssr
          return Object.keys(context.req.cookies).map(name => ({
            name,
            value: context.req.cookies[name] || ''
          }));
        },
        setAll: (cookiesToSet) => {
          // Set multiple cookies at once
          const cookieStrings = cookiesToSet.map(({ name, value, options }) => {
            const opts = options || {};
            return `${name}=${value}; Path=${opts.path || '/'}; HttpOnly=${opts.httpOnly !== false}; SameSite=${opts.sameSite || 'lax'}; Secure=${opts.secure !== false}${opts.maxAge ? `; Max-Age=${opts.maxAge}` : ''}${opts.domain ? `; Domain=${opts.domain}` : ''}`;
          });
          const existing = context.res.getHeader('Set-Cookie') || [];
          const existingArray = Array.isArray(existing) ? existing : [existing.toString()];
          context.res.setHeader('Set-Cookie', [...existingArray, ...cookieStrings]);
        },
      },
    }
  )
}

/**
 * Recommended: Creates a Supabase client for Pages API routes using official helper
 */
export function createPagesServerClient(context: { req: NextApiRequest; res: NextApiResponse }) {
  return createServerSupabaseClient(context);
}