/**
 * Haptic Feedback Wrapper
 *
 * Unified haptic feedback (vibration) that works across platforms.
 * Provides tactile feedback for user actions and events.
 *
 * Features:
 * - Native haptics on iOS/Android (via Capacitor)
 * - Fallback to vibration API on web
 * - Multiple feedback types (impact, notification, selection)
 * - Configurable intensity
 * - Graceful degradation (no errors if not supported)
 *
 * Usage:
 *   import { haptics } from './haptics';
 *
 *   // On button press
 *   haptics.light();
 *
 *   // On success
 *   haptics.success();
 *
 *   // On error
 *   haptics.error();
 *
 *   // On selection change
 *   haptics.selection();
 */

import { Haptics as CapacitorHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '../utils/logger';

const logger = createLogger('Haptics');

/**
 * Check if haptics are available on this platform
 */
function isHapticsAvailable(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true; // Always available on native
  }

  // Check for web vibration API
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Haptic impact feedback
 * Used for physical impacts (button presses, collisions, etc.)
 *
 * @param style - Impact intensity (light, medium, heavy)
 */
export async function impact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  if (!isHapticsAvailable()) {
    return; // Graceful degradation
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // Use native haptics
      const impactStyle =
        style === 'light'
          ? ImpactStyle.Light
          : style === 'heavy'
            ? ImpactStyle.Heavy
            : ImpactStyle.Medium;

      await CapacitorHaptics.impact({ style: impactStyle });
    } else {
      // Fallback to web vibration
      const duration = style === 'light' ? 10 : style === 'heavy' ? 50 : 25;
      navigator.vibrate(duration);
    }
  } catch (error) {
    // Silently fail - haptics are nice-to-have
    logger.debug('Impact failed', error);
  }
}

/**
 * Haptic notification feedback
 * Used for status updates (success, warning, error)
 *
 * @param type - Notification type (success, warning, error)
 */
export async function notification(
  type: 'success' | 'warning' | 'error' = 'success'
): Promise<void> {
  if (!isHapticsAvailable()) {
    return;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // Use native haptics
      const notificationType =
        type === 'success'
          ? NotificationType.Success
          : type === 'warning'
            ? NotificationType.Warning
            : NotificationType.Error;

      await CapacitorHaptics.notification({ type: notificationType });
    } else {
      // Fallback to web vibration with pattern
      const pattern =
        type === 'success'
          ? [10, 50, 10] // Quick double vibration
          : type === 'warning'
            ? [50, 50, 50] // Single longer vibration
            : [50, 50, 50, 50, 50]; // Triple vibration

      navigator.vibrate(pattern);
    }
  } catch (error) {
    logger.debug('Notification failed', error);
  }
}

/**
 * Haptic selection feedback
 * Used for selection changes (sliders, pickers, toggles)
 */
export async function selection(): Promise<void> {
  if (!isHapticsAvailable()) {
    return;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // Use native haptics
      await CapacitorHaptics.selectionStart();
      await CapacitorHaptics.selectionChanged();
      await CapacitorHaptics.selectionEnd();
    } else {
      // Fallback to subtle web vibration
      navigator.vibrate(5);
    }
  } catch (error) {
    logger.debug('Selection failed', error);
  }
}

/**
 * Convenient haptics functions for common scenarios
 */
export const haptics = {
  /**
   * Light tap feedback (buttons, links)
   */
  light: () => impact('light'),

  /**
   * Medium tap feedback (default buttons)
   */
  medium: () => impact('medium'),

  /**
   * Heavy tap feedback (important actions)
   */
  heavy: () => impact('heavy'),

  /**
   * Success feedback (completed actions)
   */
  success: () => notification('success'),

  /**
   * Warning feedback (reversible errors)
   */
  warning: () => notification('warning'),

  /**
   * Error feedback (failures)
   */
  error: () => notification('error'),

  /**
   * Selection feedback (toggles, switches)
   */
  selection: () => selection(),

  /**
   * Custom vibration pattern (web only)
   * @param pattern - Array of vibration durations in milliseconds
   */
  custom: async (pattern: number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },
};

/**
 * Haptic feedback for specific UI actions
 * Use these in event handlers
 */
export const uiHaptics = {
  /** Button press */
  buttonPress: () => haptics.light(),

  /** Primary button press (submit, confirm) */
  primaryButton: () => haptics.medium(),

  /** Danger button press (delete, cancel) */
  dangerButton: () => haptics.heavy(),

  /** Toggle switch */
  toggle: () => haptics.selection(),

  /** Tab change */
  tabChange: () => haptics.selection(),

  /** Successful form submission */
  formSuccess: () => haptics.success(),

  /** Form validation error */
  formError: () => haptics.error(),

  /** Item added to favorites */
  favorite: () => haptics.success(),

  /** Item removed from favorites */
  unfavorite: () => haptics.light(),

  /** Photo taken */
  photoCapture: () => haptics.medium(),

  /** Photo deleted */
  photoDelete: () => haptics.light(),

  /** Notification scheduled */
  notificationScheduled: () => haptics.success(),

  /** Notification cancelled */
  notificationCancelled: () => haptics.light(),

  /** Location selected */
  locationSelected: () => haptics.medium(),

  /** Prediction refreshed */
  predictionRefresh: () => haptics.light(),

  /** Catch logged */
  catchLogged: () => haptics.success(),

  /** Long press activated */
  longPress: () => haptics.heavy(),

  /** Pull to refresh triggered */
  pullToRefresh: () => haptics.medium(),

  /** Modal opened */
  modalOpen: () => haptics.light(),

  /** Modal closed */
  modalClose: () => haptics.light(),
};

/**
 * Check if haptics are enabled in user settings
 */
export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') {
    return true; // Default to enabled on server
  }

  const setting = localStorage.getItem('haptics_enabled');
  return setting !== 'false'; // Enabled by default
}

/**
 * Enable or disable haptics
 * @param enabled - Whether to enable haptics
 */
export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('haptics_enabled', String(enabled));
  logger.info(`${enabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Wrapper that checks if haptics are enabled before triggering
 */
export async function triggerHaptic(hapticFn: () => Promise<void>): Promise<void> {
  if (!isHapticsEnabled()) {
    return;
  }

  await hapticFn();
}
