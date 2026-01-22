import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseOptions = Parameters<typeof createClient>[2]

const DEFAULT_SUPABASE_OPTIONS: SupabaseOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}

// PERFORMANCE FIX: No caching - create fresh client per request
// This prevents auth state pollution between different users/requests
// In serverless environments, each function invocation is isolated anyway
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('SUPABASE_URL environment variable is required.')
  }

  const key = serviceRoleKey || anonKey

  if (!key) {
    throw new Error('Supabase credentials missing: set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.')
  }

  if (!serviceRoleKey && process.env.NODE_ENV !== 'production') {
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set; falling back to anon key with limited permissions.')
  }

  // Always create a fresh client - no caching to prevent auth pollution
  return createClient(url, key, DEFAULT_SUPABASE_OPTIONS)
}

export type { SupabaseClient }
