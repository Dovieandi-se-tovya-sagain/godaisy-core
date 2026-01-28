// src/lib/supabase/authClient.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Shared authentication client - connects to Go Daisy Auth Supabase project
 * This client is used by ALL apps (Findr, Grow Daisy, Go Daisy) for user authentication.
 * 
 * All three apps share the same user accounts through this single auth database.
 * Each app has its own separate data database, but authentication is unified here.
 */

const supabaseAuthUrl = process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!;
const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY!;

// Validate environment variables in development
if (typeof window !== 'undefined' && (!supabaseAuthUrl || !supabaseAuthAnonKey)) {
  console.warn(
    '⚠️ Supabase Auth environment variables not set. ' +
    'Make sure NEXT_PUBLIC_SUPABASE_AUTH_URL and NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY are defined.'
  );
}

export const authClient = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
  auth: {
    persistSession: true,      // Remember login across page refreshes
    autoRefreshToken: true,    // Automatically refresh auth tokens before expiry
    detectSessionInUrl: true,  // Handle OAuth redirects (Google, GitHub login, etc.)
    storageKey: 'godaisy-auth', // Shared storage key across all apps
  },
});