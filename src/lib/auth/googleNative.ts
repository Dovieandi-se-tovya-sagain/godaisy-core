import type { SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('GoogleNativeAuth');

// Configuration
const AUTH_TIMEOUT_MS = 30000; // 30 seconds max for auth flow
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

export const GOOGLE_NATIVE_ERRORS = {
  NOT_AVAILABLE: 'GOOGLE_NATIVE_NOT_AVAILABLE',
  NOT_CONFIGURED: 'GOOGLE_NATIVE_NOT_CONFIGURED',
  CANCELLED: 'GOOGLE_NATIVE_CANCELLED',
  MISSING_ID_TOKEN: 'GOOGLE_NATIVE_MISSING_ID_TOKEN',
  SESSION_CREATION_FAILED: 'GOOGLE_NATIVE_SESSION_CREATION_FAILED',
  TIMEOUT: 'GOOGLE_NATIVE_TIMEOUT',
} as const;

let initialized = false;
let initializationPromise: Promise<void> | null = null;

// ============================================================================
// Helper Functions
// ============================================================================

function isNativeEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return Capacitor.isNativePlatform();
  } catch (error) {
    logger.warn('Capacitor platform detection failed', error);
    return false;
  }
}

function getPlatform(): 'ios' | 'android' | 'web' {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
    return 'web';
  } catch {
    return 'web';
  }
}

interface GoogleClientConfig {
  iosClientId: string;
  webClientId: string;
  androidClientId?: string;
}

function getGoogleClientConfig(): GoogleClientConfig {
  const iosClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  // Android-specific client ID (uses SHA-1 fingerprint from release keystore)
  const androidClientId = process.env.NEXT_PUBLIC_GOOGLE_GODAISY_ANDROID_CLIENT_ID?.trim();

  if (!iosClientId || !webClientId) {
    throw new Error(GOOGLE_NATIVE_ERRORS.NOT_CONFIGURED);
  }

  return { iosClientId, webClientId, androidClientId };
}

function isCancellationError(error: unknown): boolean {
  if (!error) return false;
  const message = typeof error === 'string'
    ? error
    : typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  return message.toLowerCase().includes('cancel');
}

// ============================================================================
// Utility Functions: Timeout & Retry
// ============================================================================

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = MAX_RETRY_ATTEMPTS,
    baseDelayMs = RETRY_BASE_DELAY_MS,
    shouldRetry = (error) => {
      // Don't retry user cancellation or config errors
      if (isCancellationError(error)) return false;
      if (error instanceof Error) {
        if (error.message === GOOGLE_NATIVE_ERRORS.NOT_CONFIGURED) return false;
        if (error.message === GOOGLE_NATIVE_ERRORS.NOT_AVAILABLE) return false;
        if (error.message === GOOGLE_NATIVE_ERRORS.CANCELLED) return false;
      }
      return true;
    }
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed`, error);

      if (attempt < maxAttempts && shouldRetry(error, attempt)) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Initialization
// ============================================================================

function resetInitialization(): void {
  initialized = false;
  initializationPromise = null;
  logger.info('Google native auth initialization reset');
}

async function ensureInitialized(): Promise<void> {
  if (!isNativeEnvironment()) {
    throw new Error(GOOGLE_NATIVE_ERRORS.NOT_AVAILABLE);
  }

  if (initialized) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      const { iosClientId, webClientId, androidClientId } = getGoogleClientConfig();
      const platform = getPlatform();

      logger.info('Initializing Google native auth plugin', { platform });

      const { SocialLogin } = await import('@capgo/capacitor-social-login');

      // Platform-specific configuration
      const googleConfig: {
        iOSClientId: string;
        iOSServerClientId: string;
        webClientId: string;
        mode: 'online' | 'offline';
      } = {
        iOSClientId: iosClientId,
        iOSServerClientId: webClientId,
        // For Android, we should use webClientId (which must match the OAuth config in Google Cloud Console)
        // The SHA-1 fingerprint registered in Google Cloud Console determines which apps can use this client ID
        webClientId: platform === 'android' && androidClientId ? androidClientId : webClientId,
        mode: 'online',
      };

      logger.info('Google OAuth config', {
        platform,
        usingAndroidClientId: platform === 'android' && !!androidClientId
      });

      await SocialLogin.initialize({
        google: googleConfig,
      });

      initialized = true;
      logger.info('Google native auth plugin ready');
    })()
      .catch((error) => {
        // Reset state to allow retry
        resetInitialization();

        if (isCancellationError(error)) {
          throw new Error(GOOGLE_NATIVE_ERRORS.CANCELLED);
        }
        if (error instanceof Error && error.message === GOOGLE_NATIVE_ERRORS.NOT_CONFIGURED) {
          throw error;
        }
        logger.error('Failed to initialize Google native auth plugin', error);
        throw error;
      });
  }

  await initializationPromise;
}

// ============================================================================
// Public API
// ============================================================================

export function isGoogleNativeAvailable(): boolean {
  if (!isNativeEnvironment()) {
    return false;
  }

  try {
    getGoogleClientConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Force reset of the Google native auth plugin.
 * Call this if auth is in a bad state and you want to retry from scratch.
 */
export function resetGoogleNative(): void {
  resetInitialization();
}

export async function signInWithGoogleNative(supabase: SupabaseClient): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error(GOOGLE_NATIVE_ERRORS.NOT_AVAILABLE);
  }

  const platform = getPlatform();
  logger.info('Starting Google native sign-in', { platform });

  // Wrap entire auth flow in retry logic
  await retryWithBackoff(async () => {
    // Initialize plugin (with timeout)
    await withTimeout(
      ensureInitialized(),
      AUTH_TIMEOUT_MS,
      GOOGLE_NATIVE_ERRORS.TIMEOUT
    );

    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');

      // Perform login (with timeout)
      const result = await withTimeout(
        SocialLogin.login({
          provider: 'google',
          options: {
            scopes: ['profile', 'email'],
            prompt: 'select_account',
            forcePrompt: true,
          },
        }),
        AUTH_TIMEOUT_MS,
        GOOGLE_NATIVE_ERRORS.TIMEOUT
      );

      const payload = result.result;

      // Check responseType first - offline responses don't have idToken
      if (payload.responseType !== 'online') {
        logger.error('Google native login returned offline response', {
          responseType: payload.responseType
        });
        throw new Error(GOOGLE_NATIVE_ERRORS.MISSING_ID_TOKEN);
      }

      // Now TypeScript knows it's an online response with idToken
      if (!payload.idToken) {
        logger.error('Google native login missing ID token');
        throw new Error(GOOGLE_NATIVE_ERRORS.MISSING_ID_TOKEN);
      }

      logger.info('Got ID token from Google, exchanging with Supabase');

      // Exchange token with Supabase
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: payload.idToken,
      });

      if (signInError) {
        logger.error('Supabase token exchange failed', signInError);
        throw signInError;
      }

      // Validate session was actually created
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error('Failed to get session after sign-in', sessionError);
        throw new Error(GOOGLE_NATIVE_ERRORS.SESSION_CREATION_FAILED);
      }

      if (!sessionData.session) {
        logger.error('No session found after successful token exchange');
        throw new Error(GOOGLE_NATIVE_ERRORS.SESSION_CREATION_FAILED);
      }

      logger.info('Google native sign-in completed successfully', {
        userId: sessionData.session.user.id,
        email: sessionData.session.user.email,
      });

    } catch (error) {
      if (isCancellationError(error)) {
        throw new Error(GOOGLE_NATIVE_ERRORS.CANCELLED);
      }

      // Check for known error types
      if (error instanceof Error) {
        const knownErrors = Object.values(GOOGLE_NATIVE_ERRORS);
        if (knownErrors.includes(error.message as typeof knownErrors[number])) {
          throw error;
        }
      }

      logger.error('Google native sign-in failed', error);
      throw error instanceof Error ? error : new Error('Google Sign In failed');
    }
  }, {
    maxAttempts: MAX_RETRY_ATTEMPTS,
    baseDelayMs: RETRY_BASE_DELAY_MS,
  });
}
