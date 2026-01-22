/**
 * Error Tracking with Sentry Integration
 *
 * Unified error tracking that works across web and native platforms.
 * Captures errors with device context (OS, version, platform).
 *
 * Features:
 * - Automatic Sentry initialization (if SENTRY_DSN configured)
 * - Graceful degradation (works without Sentry)
 * - Device context capture
 * - Breadcrumb tracking
 * - User identification
 * - Capacitor plugin error wrapping
 *
 * Setup:
 * 1. Install: npm install @sentry/nextjs @sentry/capacitor
 * 2. Set NEXT_PUBLIC_SENTRY_DSN in .env.local
 * 3. Errors will be automatically tracked
 *
 * Usage:
 *   import { captureError, captureMessage, wrapCapacitorCall } from '@/lib/capacitor/error-tracking';
 *
 *   // Manual error capture
 *   try {
 *     riskyOperation();
 *   } catch (error) {
 *     captureError(error, { context: 'User action' });
 *   }
 *
 *   // Wrap Capacitor calls
 *   const photo = await wrapCapacitorCall(
 *     'Camera.getPhoto',
 *     () => Camera.getPhoto({ ... })
 *   );
 */

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ErrorTracking');

/**
 * Check if Sentry is configured and available
 */
function isSentryAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Lazy-load Sentry (only if configured)
 */
let SentryModule: typeof import('@sentry/nextjs') | null = null;

async function getSentry() {
  if (!isSentryAvailable()) {
    return null;
  }

  if (SentryModule) {
    return SentryModule;
  }

  try {
    SentryModule = await import('@sentry/nextjs');
    return SentryModule;
  } catch (_error) {
    logger.warn('Sentry not installed. Run: npm install @sentry/nextjs');
    return null;
  }
}

/**
 * Initialize Sentry with device context
 * Called automatically on first use
 */
let sentryInitialized = false;

async function initializeSentry(): Promise<void> {
  if (sentryInitialized || !isSentryAvailable()) {
    return;
  }

  const Sentry = await getSentry();
  if (!Sentry) {
    return;
  }

  try {
    // Get device info
    const deviceInfo = await Device.getInfo();
    const deviceId = await Device.getId();

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Add device context
      initialScope: {
        tags: {
          platform: deviceInfo.platform,
          osVersion: deviceInfo.osVersion,
          manufacturer: deviceInfo.manufacturer,
          model: deviceInfo.model,
          isNative: Capacitor.isNativePlatform().toString(),
        },
        user: {
          id: deviceId.identifier,
        },
        contexts: {
          device: {
            name: deviceInfo.name,
            model: deviceInfo.model,
            manufacturer: deviceInfo.manufacturer,
            brand: deviceInfo.manufacturer,
            os: {
              name: deviceInfo.operatingSystem,
              version: deviceInfo.osVersion,
            },
            screen: {
              width: typeof window !== 'undefined' ? window.screen.width : undefined,
              height: typeof window !== 'undefined' ? window.screen.height : undefined,
            },
          },
          app: {
            app_version: process.env.npm_package_version || '1.0.0',
            app_build: '1',
          },
        },
      },

      beforeSend(event) {
        // Filter out development errors in production
        if (process.env.NODE_ENV === 'production') {
          // Don't send errors from localhost
          if (event.request?.url?.includes('localhost')) {
            return null;
          }
        }
        return event;
      },
    });

    sentryInitialized = true;
    logger.info('Sentry initialized');
  } catch (error) {
    logger.error('Failed to initialize Sentry', error);
  }
}

/**
 * Capture an error with optional context
 */
export async function captureError(
  error: Error | unknown,
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'info';
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    context?: string;
  }
): Promise<void> {
  // Always log to console
  logger.error(context?.context || 'Error:', error);

  const Sentry = await getSentry();
  if (!Sentry) {
    return; // Graceful degradation
  }

  await initializeSentry();

  Sentry.captureException(error, {
    level: context?.level || 'error',
    tags: context?.tags,
    extra: context?.extra,
    contexts: context?.context
      ? {
          custom: {
            context: context.context,
          },
        }
      : undefined,
  });
}

/**
 * Capture a message (non-error)
 */
export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): Promise<void> {
  logger.info(`${level}:`, message, context);

  const Sentry = await getSentry();
  if (!Sentry) {
    return;
  }

  await initializeSentry();

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for tracking user actions
 */
export async function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>
): Promise<void> {
  const Sentry = await getSentry();
  if (!Sentry) {
    return;
  }

  await initializeSentry();

  Sentry.addBreadcrumb({
    message,
    category: category || 'user-action',
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 */
export async function setUser(user: {
  id: string;
  email?: string;
  username?: string;
}): Promise<void> {
  const Sentry = await getSentry();
  if (!Sentry) {
    return;
  }

  await initializeSentry();

  Sentry.setUser(user);
}

/**
 * Clear user context (e.g., on logout)
 */
export async function clearUser(): Promise<void> {
  const Sentry = await getSentry();
  if (!Sentry) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Wrap a Capacitor plugin call with error tracking
 *
 * @param pluginName - Name of the plugin and method (e.g., "Camera.getPhoto")
 * @param fn - Function to execute
 * @param context - Additional context for error tracking
 * @returns Result of the function
 *
 * @example
 * const photo = await wrapCapacitorCall(
 *   'Camera.getPhoto',
 *   () => Camera.getPhoto({ resultType: CameraResultType.DataUrl }),
 *   { source: 'catch-log-modal' }
 * );
 */
export async function wrapCapacitorCall<T>(
  pluginName: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    // Add breadcrumb
    await addBreadcrumb(`Calling ${pluginName}`, 'capacitor', context);

    const result = await fn();

    // Add success breadcrumb
    await addBreadcrumb(`${pluginName} succeeded`, 'capacitor', context);

    return result;
  } catch (error) {
    // Capture error with Capacitor context
    await captureError(error, {
      level: 'error',
      tags: {
        plugin: pluginName.split('.')[0],
        method: pluginName.split('.')[1] || '',
      },
      extra: {
        pluginName,
        ...context,
      },
      context: `Capacitor: ${pluginName}`,
    });

    throw error; // Re-throw so caller can handle
  }
}

/**
 * Initialize error tracking on app startup
 * Call this in _app.tsx useEffect
 */
export async function initializeErrorTracking(): Promise<void> {
  if (!isSentryAvailable()) {
    logger.info('Sentry not configured (NEXT_PUBLIC_SENTRY_DSN not set)');
    return;
  }

  await initializeSentry();
}
