/**
 * Apple Sign In Wrapper
 *
 * Unified Apple Sign In that works across platforms using ASWebAuthenticationSession.
 * Integrates with Supabase authentication.
 *
 * Features:
 * - Native Sign in with Apple on iOS (via @capgo/capacitor-social-login)
 * - Web fallback using Supabase OAuth
 * - Uses ASWebAuthenticationSession (correct iOS OAuth API)
 * - No external browser redirects
 * - Automatic user profile creation
 * - Error handling and user-friendly messages
 * - iOS App Store compliance
 *
 * Usage:
 *   import { signInWithApple } from '@/lib/auth/appleSignIn';
 *
 *   try {
 *     await signInWithApple(supabaseClient);
 *     // User is now signed in
 *   } catch (error) {
 *     console.error(error);
 *   }
 *
 * Requirements:
 * - Supabase project must have Apple OAuth configured
 * - iOS app must have "Sign in with Apple" capability enabled
 * - Apple Developer account with Services ID configured
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '@/lib/utils/logger';
import { mapAuthError } from './utils';

const logger = createLogger('AppleSignIn');
const DEFAULT_APPLE_BUNDLE_ID = process.env.NEXT_PUBLIC_APPLE_BUNDLE_ID ?? 'io.godaisy.app';
const DEFAULT_APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ?? 'godaisy://auth/callback';
const DEFAULT_AUTH_CALLBACK = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL ?? 'https://godaisy.io/auth/callback';

function resolveWebCallback(override?: string): string {
  if (override) {
    return override;
  }
  if (process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL) {
    return process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL;
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.startsWith('http')) {
      return `${origin}/auth/callback`;
    }
  }
  return DEFAULT_AUTH_CALLBACK;
}

/**
 * Check if Apple Sign In is available on this platform
 */
export function isAppleSignInAvailable(): boolean {
  // Apple Sign In is available on:
  // 1. Native iOS apps
  // 2. Web browsers (via Supabase OAuth redirect)
  if (typeof window === 'undefined') {
    return false; // SSR
  }

  // Native iOS: Always available (required by App Store)
  if (Capacitor.getPlatform() === 'ios') {
    return true;
  }

  // Web: Available on all browsers (Supabase handles OAuth redirect)
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  // Android: Not available (Apple doesn't support it)
  return false;
}

/**
 * Sign in with Apple on native iOS
 * Uses @capacitor-community/apple-sign-in (official plugin)
 *
 * CRITICAL: This uses ID token flow, NOT OAuth authorization code flow
 * See docs/NATIVE_AUTH_ROOT_CAUSE_FIX.md for why this matters
 */
async function signInWithAppleNative(supabase: SupabaseClient): Promise<void> {
  try {
    logger.info('Starting native Apple Sign In flow with official plugin');

    // Import the official Apple Sign In plugin
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

    logger.info('Plugin loaded, preparing nonce');

    // CRITICAL: Apple requires SHA-256 hashed nonce, Supabase needs raw nonce
    // Reference: https://supabase.com/docs/guides/auth/social-login/auth-apple
    const rawNonce = crypto.randomUUID();

    // Hash the nonce with SHA-256 for Apple
    const encoder = new TextEncoder();
    const data = encoder.encode(rawNonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    logger.info('Nonce prepared', {
      rawLength: rawNonce.length,
      hashedLength: hashedNonce.length
    });

    // Sign in with Apple using official plugin
    // NOTE: redirectURI is required by type but not used for native iOS
    // Using custom URL scheme to ensure no web redirects happen
    const result = await SignInWithApple.authorize({
      clientId: DEFAULT_APPLE_BUNDLE_ID,
      redirectURI: DEFAULT_APPLE_REDIRECT_URI,
      scopes: 'email name',
      nonce: hashedNonce, // SHA-256 hashed nonce (required by Apple)
    });

    logger.info('Apple Sign In successful', {
      hasIdentityToken: !!result.response?.identityToken,
      hasAuthorizationCode: !!result.response?.authorizationCode,
      email: result.response?.email,
    });

    // The plugin returns an identity token (JWT)
    if (!result.response?.identityToken) {
      throw new Error('No identity token returned from Apple Sign In');
    }

    logger.info('Exchanging Apple ID token for Supabase session');

    // Exchange Apple identity token for Supabase session
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: result.response.identityToken,
      nonce: rawNonce, // ⭐ Pass THE RAW (unhashed) nonce to Supabase
    });

    if (error) {
      logger.error('Supabase signInWithIdToken failed', {
        error,
        hasToken: !!result.response.identityToken,
      });
      throw error;
    }

    logger.info('Supabase session created successfully');
  } catch (error: unknown) {
    logger.error('Native Apple Sign In failed', error);

    // Check if user cancelled
    if (isUserCancellation(error)) {
      throw new Error('Sign in cancelled');
    }

    throw error;
  }
}

/**
 * Sign in with Apple on web
 * Uses Supabase OAuth redirect flow
 */
async function signInWithAppleWeb(
  supabase: SupabaseClient,
  redirectTo?: string
): Promise<void> {
  try {
    logger.info('Starting web Apple Sign In flow');

    const finalRedirectTo = resolveWebCallback(redirectTo);

    logger.info('OAuth redirect URL:', finalRedirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: finalRedirectTo,
        queryParams: {
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }

    // User will be redirected to Apple's OAuth page
    logger.info('Redirecting to Apple OAuth');
  } catch (error) {
    logger.error('Web Apple Sign In failed', error);
    throw error;
  }
}

/**
 * Sign in with Apple (unified across platforms)
 *
 * @param supabase - Supabase client instance
 * @param redirectTo - Optional redirect URL after authentication (default: current origin + /auth/callback)
 * @throws Error with user-friendly message
 */
export async function signInWithApple(
  supabase: SupabaseClient,
  redirectTo?: string
): Promise<void> {
  if (!isAppleSignInAvailable()) {
    throw new Error('Apple Sign In is not available on this platform');
  }

  try {
    // On native iOS, use the native plugin with ASWebAuthenticationSession
    if (Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform()) {
      logger.info('Using native Apple Sign In flow');
      await signInWithAppleNative(supabase);
    } else {
      // On web, use standard OAuth flow
      logger.info('Using web OAuth flow for Apple Sign In');
      await signInWithAppleWeb(supabase, redirectTo);
    }
  } catch (error: unknown) {
    // Special handling for user cancellation (don't show error)
    if (isUserCancellation(error)) {
      logger.info('User cancelled Apple Sign In');
      return; // Silently return, no error needed
    }

    // Map to user-friendly error message
    const friendlyError = mapAuthError(error);
    throw new Error(friendlyError);
  }
}

/**
 * Check if error is from user cancelling the sign in
 */
function isUserCancellation(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error ? String(error.message).toLowerCase() : '';
    const code = 'code' in error ? String(error.code).toLowerCase() : '';

    return (
      message.includes('cancel') ||
      message.includes('user cancel') ||
      code.includes('cancel') ||
      code === '1001' // Apple Sign In cancellation code
    );
  }
  return false;
}
