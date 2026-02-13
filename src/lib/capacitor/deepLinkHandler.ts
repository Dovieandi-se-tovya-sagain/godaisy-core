/**
 * Deep Link Handler for Capacitor Native Apps
 *
 * Handles OAuth callbacks and other deep links for:
 * - godaisy://auth/callback
 * - fishfindr://auth/callback
 * - growdaisy://auth/callback
 *
 * Also handles HTTPS App Links:
 * - https://godaisy.io/*
 * - https://fishfindr.eu/*
 * - https://grow.godaisy.io/*
 */

import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabase/client';

const isNative = Capacitor.isNativePlatform();

interface DeepLinkResult {
  handled: boolean;
  path?: string;
  error?: string;
}

/**
 * Initialize deep link handler
 * Should be called once during app startup
 */
export function initDeepLinkHandler(): void {
  if (!isNative) {
    console.log('[DeepLink] Skipping - not on native platform');
    return;
  }

  console.log('[DeepLink] Initializing deep link handler');

  App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    console.log('[DeepLink] Received URL:', event.url);

    try {
      const result = await handleDeepLink(event.url);

      if (result.handled) {
        console.log('[DeepLink] Successfully handled, navigating to:', result.path);
        if (result.path) {
          // Navigate to the path
          window.location.href = result.path;
        }
      } else {
        console.log('[DeepLink] URL not handled:', event.url);
      }
    } catch (error) {
      console.error('[DeepLink] Error handling URL:', error);
    }
  });
}

/**
 * Handle a deep link URL
 */
async function handleDeepLink(urlString: string): Promise<DeepLinkResult> {
  try {
    const url = new URL(urlString);
    const scheme = url.protocol.replace(':', '');
    const host = url.host;
    const pathname = url.pathname;

    // Handle OAuth callback URLs
    if (pathname.includes('auth/callback') || pathname.includes('auth/receive-session')) {
      return await handleAuthCallback(url);
    }

    // Handle magic link URLs
    if (pathname.includes('magic-link') || pathname.includes('verify')) {
      return await handleMagicLink(url);
    }

    // Handle app-specific paths
    // Custom scheme: godaisy://path, fishfindr://path, growdaisy://path
    // HTTPS: https://godaisy.io/path, etc.
    if (isAppScheme(scheme) || isAppHost(host)) {
      return {
        handled: true,
        path: pathname || '/',
      };
    }

    return { handled: false };
  } catch (error) {
    console.error('[DeepLink] Failed to parse URL:', error);
    return { handled: false, error: String(error) };
  }
}

/**
 * Handle OAuth callback with code exchange
 */
async function handleAuthCallback(url: URL): Promise<DeepLinkResult> {
  const code = url.searchParams.get('code');
  const accessToken = url.searchParams.get('access_token');
  const refreshToken = url.searchParams.get('refresh_token');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Check for errors first
  if (error) {
    console.error('[DeepLink] Auth error:', error, errorDescription);
    return {
      handled: true,
      path: `/auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`,
      error: errorDescription || error,
    };
  }


  try {
    // PKCE flow: exchange code for session
    if (code) {
      console.log('[DeepLink] Exchanging auth code for session');
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('[DeepLink] Code exchange failed:', exchangeError);
        return {
          handled: true,
          path: `/auth/error?error=${encodeURIComponent(exchangeError.message)}`,
          error: exchangeError.message,
        };
      }

      console.log('[DeepLink] Session established for user:', data.user?.email);
      return {
        handled: true,
        path: getDestinationPath(url),
      };
    }

    // Implicit flow: set session directly from tokens
    if (accessToken && refreshToken) {
      console.log('[DeepLink] Setting session from tokens');
      const { error: setError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setError) {
        console.error('[DeepLink] Failed to set session:', setError);
        return {
          handled: true,
          path: `/auth/error?error=${encodeURIComponent(setError.message)}`,
          error: setError.message,
        };
      }

      return {
        handled: true,
        path: getDestinationPath(url),
      };
    }

    // No auth params found
    console.warn('[DeepLink] Auth callback without code or tokens');
    return { handled: false };
  } catch (error) {
    console.error('[DeepLink] Auth handling error:', error);
    return {
      handled: true,
      path: '/auth/error',
      error: String(error),
    };
  }
}

/**
 * Handle magic link / email verification
 */
async function handleMagicLink(url: URL): Promise<DeepLinkResult> {
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');


  try {
    // Handle token_hash style links
    if (tokenHash && type) {
      console.log('[DeepLink] Verifying OTP with token_hash');
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'email' | 'signup' | 'recovery' | 'invite',
      });

      if (error) {
        console.error('[DeepLink] OTP verification failed:', error);
        return {
          handled: true,
          path: `/auth/error?error=${encodeURIComponent(error.message)}`,
          error: error.message,
        };
      }

      // Recovery flow goes to password update
      if (type === 'recovery') {
        return { handled: true, path: '/auth/update-password' };
      }

      return { handled: true, path: getDestinationPath(url) };
    }

    // Handle PKCE code style links
    if (code) {
      return await handleAuthCallback(url);
    }

    return { handled: false };
  } catch (error) {
    console.error('[DeepLink] Magic link error:', error);
    return {
      handled: true,
      path: '/auth/error',
      error: String(error),
    };
  }
}

/**
 * Check if scheme is one of our app schemes
 */
function isAppScheme(scheme: string): boolean {
  return ['godaisy', 'fishfindr', 'growdaisy'].includes(scheme);
}

/**
 * Check if host is one of our app domains
 */
function isAppHost(host: string): boolean {
  return [
    'godaisy.io',
    'fishfindr.eu',
    'grow.godaisy.io',
    'www.godaisy.io',
    'www.fishfindr.eu',
  ].includes(host);
}

/**
 * Get destination path after auth
 */
function getDestinationPath(url: URL): string {
  // Check for explicit return URL
  const returnTo = url.searchParams.get('returnTo') || url.searchParams.get('next');
  if (returnTo && returnTo.startsWith('/')) {
    return returnTo;
  }

  // Route based on app context
  const urlString = url.toString().toLowerCase();

  if (urlString.includes('findr') || urlString.includes('fishfindr')) {
    return '/findr';
  }

  if (urlString.includes('grow')) {
    return '/grow';
  }

  // Default to home
  return '/';
}

/**
 * Remove deep link listener (for cleanup)
 */
export async function removeDeepLinkHandler(): Promise<void> {
  if (!isNative) return;

  try {
    await App.removeAllListeners();
    console.log('[DeepLink] Listeners removed');
  } catch (error) {
    console.warn('[DeepLink] Failed to remove listeners:', error);
  }
}
