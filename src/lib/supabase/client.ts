// src/lib/supabase/client.ts
/**
 * DEPRECATED: This file exists for backward compatibility.
 * 
 * New code should use:
 * - authClient (from './authClient') for authentication
 * - createDataClient (from './dataClient') for app-specific data
 * 
 * @example
 * // Old way (deprecated)
 * import { supabase } from '@godaisy/core/lib/supabase/client';
 * 
 * // New way
 * import { authClient, createDataClient } from '@godaisy/core';
 * 
 * // For auth
 * const { user } = await authClient.auth.getUser();
 * 
 * // For app data
 * const db = createDataClient({
 *   url: process.env.NEXT_PUBLIC_APP_DB_URL!,
 *   anonKey: process.env.NEXT_PUBLIC_APP_DB_ANON_KEY!
 * });
 */

// Re-export for backward compatibility
export { createClient, createDataClient } from './dataClient';

// Legacy singleton - will use old env vars if they exist
import { createClient as createLegacyClient } from './dataClient';
export const supabase = createLegacyClient();