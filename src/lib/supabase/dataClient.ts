// src/lib/supabase/dataClient.ts
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Configuration for creating an app-specific data client
 */
export interface DataClientConfig {
  url: string;      // App's Supabase URL (e.g., findr-production)
  anonKey: string;  // App's anon key
}

/**
 * Detect if running in native Capacitor environment
 */
function detectNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;

  const win = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
    webkit?: { messageHandlers?: unknown };
  };

  // Method 1: Direct Capacitor check
  if (win.Capacitor?.isNativePlatform?.()) return true;

  // Method 2: Check platform
  const platform = win.Capacitor?.getPlatform?.();
  if (platform === 'ios' || platform === 'android') return true;

  // Method 3: Check user agent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('capacitor') || ua.includes('ionic')) return true;

  // Method 4: Check for native bridge markers
  if ('webkit' in window && win.webkit?.messageHandlers) return true;

  return false;
}

/**
 * Factory function to create app-specific data clients
 * 
 * Each app calls this with their own database credentials:
 * - Findr → findr-production Supabase
 * - Grow Daisy → growdaisy-production Supabase
 * - Go Daisy → godaisy-production Supabase
 * 
 * @example
 * // In findr app
 * const findrDb = createDataClient({
 *   url: process.env.NEXT_PUBLIC_FINDR_DB_URL!,
 *   anonKey: process.env.NEXT_PUBLIC_FINDR_DB_ANON_KEY!
 * });
 * 
 * const catches = await findrDb.from('catches').select('*');
 */
export function createDataClient(config: DataClientConfig): SupabaseClient {
  const isNative = detectNativePlatform();

  if (typeof window !== 'undefined') {
    console.log('[Supabase DataClient] Creating client:', {
      isNative,
      url: config.url.substring(0, 30) + '...',
    });
  }

  return createBrowserClient(config.url, config.anonKey);
}

/**
 * Legacy export for backward compatibility
 * Apps should migrate to using createDataClient() with explicit config
 * 
 * @deprecated Use createDataClient() instead
 */
export function createClient(): SupabaseClient {
  console.warn(
    '⚠️ createClient() is deprecated. Use createDataClient() with explicit config, ' +
    'or authClient for authentication.'
  );
  
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}