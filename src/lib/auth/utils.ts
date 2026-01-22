/**
 * Shared authentication utilities for consistent behavior across Go Daisy and Findr
 */

/**
 * Normalize email address for consistent authentication
 * - Trims whitespace
 * - Converts to lowercase
 * - Prevents case-sensitivity issues
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Get error message from unknown error object
 */
function getErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Map Supabase auth errors to user-friendly messages
 * Provides consistent, helpful error messages across all auth pages
 */
export function mapAuthError(err: unknown): string {
  const msg = getErrorMessage(err).toLowerCase();

  // =========================================================================
  // Native Google Auth Errors (from googleNative.ts)
  // =========================================================================

  // User cancelled the sign-in dialog
  if (msg.includes('google_native_cancelled') || msg.includes('cancelled') || msg.includes('canceled')) {
    return 'Sign-in was cancelled. Please try again when you\'re ready.';
  }

  // Missing ID token from Google
  if (msg.includes('google_native_missing_id_token') || msg.includes('missing id token')) {
    return 'Google sign-in failed to complete. Please try again or use email sign-in.';
  }

  // Session wasn't created after auth
  if (msg.includes('google_native_session_creation_failed') || msg.includes('session creation failed')) {
    return 'Sign-in succeeded but session wasn\'t saved. Please try again.';
  }

  // Auth timed out
  if (msg.includes('google_native_timeout') || msg.includes('authentication timed out')) {
    return 'Sign-in took too long. Please check your connection and try again.';
  }

  // Native auth not available (not on mobile)
  if (msg.includes('google_native_not_available')) {
    return 'Native sign-in is not available. Please use browser sign-in.';
  }

  // Native auth not configured
  if (msg.includes('google_native_not_configured')) {
    return 'Google sign-in is not configured. Please use email sign-in instead.';
  }

  // =========================================================================
  // Supabase Auth Errors
  // =========================================================================

  // Invalid credentials
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Invalid email or password. If you signed up with Google or Apple, use that option to sign in.';
  }

  // Rate limiting
  if (msg.includes('email rate limit') || msg.includes('rate limit')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  // PKCE / code verifier issues (browser/tab switching problems)
  if (msg.includes('pkce') || msg.includes('code verifier')) {
    return 'We had trouble completing sign-in in this browser. Please try again or use the magic link option.';
  }

  // Email not confirmed
  if (msg.includes('email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }

  // User already registered
  if (msg.includes('user already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  // =========================================================================
  // Network & General Errors
  // =========================================================================

  // Network/connection issues
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    return 'Connection error. Please check your internet and try again.';
  }

  // Return original message if no specific mapping
  return getErrorMessage(err);
}

/**
 * Validate session and clear if corrupted
 * Returns true if session is valid, false if it was cleared
 */
export async function validateAndCleanSession(
  supabase: { auth: { getSession: () => Promise<{ data: { session: unknown }; error: unknown }>; signOut: () => Promise<{ error: unknown }> } }
): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      // Session is corrupted, clear it
      console.warn('[Auth] Corrupted session detected, clearing:', error);
      await supabase.auth.signOut();
      return false;
    }

    return !!data.session;
  } catch (err) {
    console.error('[Auth] Session validation failed:', err);
    // If validation fails, try to clear session
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signout errors
    }
    return false;
  }
}
