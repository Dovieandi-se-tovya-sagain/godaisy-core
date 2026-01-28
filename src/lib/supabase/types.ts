// src/lib/supabase/types.ts

/**
 * Re-export commonly used Supabase types
 */
export type {
  User,
  Session,
  AuthError,
  AuthResponse,
  SupabaseClient,
  PostgrestError,
  PostgrestResponse,
} from '@supabase/supabase-js';

/**
 * Data client configuration
 */
export type { DataClientConfig } from './dataClient';