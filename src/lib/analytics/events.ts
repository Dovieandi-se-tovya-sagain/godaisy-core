/**
 * Analytics Event Tracking
 *
 * Unified analytics that works across platforms and providers.
 * Supports multiple analytics backends (Google Analytics, Mixpanel, etc.)
 *
 * Features:
 * - Type-safe event names and properties
 * - Multiple provider support
 * - Graceful degradation (works without analytics configured)
 * - User property tracking
 * - Screen view tracking
 * - E-commerce tracking
 *
 * Setup:
 * 1. Install desired provider: npm install @capacitor-community/firebase-analytics
 * 2. Set NEXT_PUBLIC_GA_MEASUREMENT_ID in .env.local
 * 3. Events will be automatically tracked
 *
 * Usage:
 *   import { trackEvent, trackScreenView, setUserProperties } from './events';
 *
 *   // Track user actions
 *   trackEvent('prediction_viewed', {
 *     species_id: 'cod',
 *     rectangle_code: '31F1',
 *     confidence: 85,
 *   });
 *
 *   // Track screen views
 *   trackScreenView('Predictions', '/findr');
 *
 *   // Set user properties
 *   setUserProperties({
 *     user_type: 'premium',
 *     location_region: 'north_sea',
 *   });
 */

import { Capacitor } from '@capacitor/core';

/**
 * Event names (type-safe)
 */
export type AnalyticsEvent =
  // Prediction events
  | 'prediction_viewed'
  | 'prediction_refreshed'
  | 'species_favorited'
  | 'species_unfavorited'

  // Catch logging events
  | 'catch_logged'
  | 'catch_photo_added'
  | 'session_log_started'
  | 'session_log_completed'

  // Location events
  | 'location_selected'
  | 'location_detected'
  | 'rectangle_changed'

  // Notification events
  | 'notification_scheduled'
  | 'notification_cancelled'
  | 'notification_clicked'

  // Settings events
  | 'language_changed'
  | 'theme_changed'
  | 'settings_updated'

  // Navigation events
  | 'screen_viewed'
  | 'tab_changed'
  | 'external_link_clicked'

  // Auth events
  | 'sign_in'
  | 'sign_out'
  | 'sign_up'

  // Error events
  | 'error_occurred'
  | 'api_error'
  | 'network_error';

/**
 * Event properties (generic, extend per event)
 */
export interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Check if analytics is configured
 */
function isAnalyticsAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN
  );
}

/**
 * Lazy-load analytics providers
 */
let analyticsInitialized = false;

async function initializeAnalytics(): Promise<void> {
  if (analyticsInitialized || !isAnalyticsAvailable()) {
    return;
  }

  try {
    // Initialize Google Analytics (web)
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      // Google Analytics 4 via gtag.js
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`;
      script.async = true;
      document.head.appendChild(script);

      // @ts-expect-error - gtag is loaded dynamically
      window.dataLayer = window.dataLayer || [];
      // @ts-expect-error - gtag is loaded dynamically
      window.gtag = function gtag(...args: unknown[]) { window.dataLayer.push(args); };
      // @ts-expect-error - gtag is loaded dynamically
      window.gtag('js', new Date());
      // @ts-expect-error - gtag is loaded dynamically
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        send_page_view: false, // We'll track manually
      });

      console.log('[Analytics] Google Analytics initialized');
    }

    // Initialize Firebase Analytics (native)
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
        await FirebaseAnalytics.initializeFirebase({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
          measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '',
        });
        console.log('[Analytics] Firebase Analytics initialized');
      } catch (error) {
        console.warn('[Analytics] Firebase Analytics not available:', error);
      }
    }

    analyticsInitialized = true;
  } catch (error) {
    console.error('[Analytics] Failed to initialize:', error);
  }
}

/**
 * Track an event
 *
 * @param eventName - Type-safe event name
 * @param properties - Event properties (optional)
 *
 * @example
 * trackEvent('prediction_viewed', {
 *   species_id: 'cod',
 *   rectangle_code: '31F1',
 *   confidence: 85,
 * });
 */
export async function trackEvent(
  eventName: AnalyticsEvent,
  properties?: EventProperties
): Promise<void> {
  // Always log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics] Event:', eventName, properties);
  }

  if (!isAnalyticsAvailable()) {
    return; // Graceful degradation
  }

  await initializeAnalytics();

  try {
    // Google Analytics (web)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // @ts-expect-error - gtag is loaded dynamically
      window.gtag('event', eventName, properties);
    }

    // Firebase Analytics (native)
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
        await FirebaseAnalytics.logEvent({
          name: eventName,
          params: properties || {},
        });
      } catch (_error) {
        // Silently fail if Firebase not available
      }
    }
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
}

/**
 * Track screen view
 *
 * @param screenName - Human-readable screen name
 * @param screenPath - Route path
 *
 * @example
 * trackScreenView('Predictions', '/findr');
 * trackScreenView('Catch Log', '/findr/my-catches');
 */
export async function trackScreenView(
  screenName: string,
  screenPath: string
): Promise<void> {
  await trackEvent('screen_viewed', {
    screen_name: screenName,
    screen_path: screenPath,
  });
}

/**
 * Set user properties
 *
 * @param properties - User properties to set
 *
 * @example
 * setUserProperties({
 *   user_type: 'premium',
 *   location_region: 'north_sea',
 *   language: 'en',
 * });
 */
export async function setUserProperties(
  properties: Record<string, string | number | boolean>
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics] User Properties:', properties);
  }

  if (!isAnalyticsAvailable()) {
    return;
  }

  await initializeAnalytics();

  try {
    // Google Analytics (web)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // @ts-expect-error - gtag is loaded dynamically
      window.gtag('set', 'user_properties', properties);
    }

    // Firebase Analytics (native)
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
        for (const [key, value] of Object.entries(properties)) {
          await FirebaseAnalytics.setUserProperty({
            name: key,
            value: String(value),
          });
        }
      } catch (_error) {
        // Silently fail
      }
    }
  } catch (error) {
    console.error('[Analytics] Failed to set user properties:', error);
  }
}

/**
 * Set user ID for tracking across sessions
 *
 * @param userId - Unique user identifier
 *
 * @example
 * setUserId('user_123456');
 */
export async function setUserId(userId: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics] User ID:', userId);
  }

  if (!isAnalyticsAvailable()) {
    return;
  }

  await initializeAnalytics();

  try {
    // Google Analytics (web)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // @ts-expect-error - gtag is loaded dynamically
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        user_id: userId,
      });
    }

    // Firebase Analytics (native)
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
        await FirebaseAnalytics.setUserId({ userId });
      } catch (_error) {
        // Silently fail
      }
    }
  } catch (error) {
    console.error('[Analytics] Failed to set user ID:', error);
  }
}

/**
 * Enable/disable analytics collection
 *
 * @param enabled - Whether to enable analytics
 *
 * @example
 * setAnalyticsEnabled(false); // User opts out
 */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  console.log('[Analytics] Collection enabled:', enabled);

  if (!isAnalyticsAvailable()) {
    return;
  }

  try {
    // Firebase Analytics (native)
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
        await FirebaseAnalytics.setCollectionEnabled({ enabled });
      } catch (_error) {
        // Silently fail
      }
    }

    // Store preference for web
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_enabled', String(enabled));
    }
  } catch (error) {
    console.error('[Analytics] Failed to set analytics enabled:', error);
  }
}

/**
 * Convenient tracking functions for common events
 */
export const analytics = {
  // Predictions
  viewPrediction: (speciesId: string, rectangleCode: string, confidence: number) =>
    trackEvent('prediction_viewed', { species_id: speciesId, rectangle_code: rectangleCode, confidence }),

  refreshPrediction: (rectangleCode: string) =>
    trackEvent('prediction_refreshed', { rectangle_code: rectangleCode }),

  favoriteSpecies: (speciesId: string) =>
    trackEvent('species_favorited', { species_id: speciesId }),

  unfavoriteSpecies: (speciesId: string) =>
    trackEvent('species_unfavorited', { species_id: speciesId }),

  // Catch logging
  logCatch: (speciesId: string, rectangleCode: string, hasPhoto: boolean) =>
    trackEvent('catch_logged', { species_id: speciesId, rectangle_code: rectangleCode, has_photo: hasPhoto }),

  addCatchPhoto: (count: number) =>
    trackEvent('catch_photo_added', { photo_count: count }),

  // Location
  selectLocation: (rectangleCode: string, method: 'gps' | 'manual') =>
    trackEvent('location_selected', { rectangle_code: rectangleCode, method }),

  // Notifications
  scheduleNotification: (speciesId: string, time: string) =>
    trackEvent('notification_scheduled', { species_id: speciesId, scheduled_time: time }),

  // Navigation
  viewScreen: (screenName: string, path: string) =>
    trackScreenView(screenName, path),

  // Errors
  logError: (errorType: string, errorMessage: string) =>
    trackEvent('error_occurred', { error_type: errorType, error_message: errorMessage }),
};
