/**
 * Notifications Wrapper
 *
 * Unified notifications API that works seamlessly across web and native platforms
 *
 * Features:
 * - Push notifications (for future backend integration)
 * - Local notifications (scheduled reminders)
 * - Uses native Push/Local Notifications plugins on iOS/Android
 * - Falls back to Web Notifications API in browser
 * - Type-safe permission handling
 * - Notification action handlers
 *
 * Usage:
 * ```typescript
 * import {
 *   scheduleLocalNotification,
 *   requestPermissions,
 *   registerForPushNotifications,
 * } from '@/lib/capacitor/notifications';
 *
 * // Schedule a local notification
 * await scheduleLocalNotification({
 *   title: 'High Tide Alert',
 *   body: 'Prime fishing time in 1 hour!',
 *   schedule: { at: new Date(Date.now() + 3600000) },
 * });
 *
 * // Register for push notifications
 * const token = await registerForPushNotifications();
 * console.log('Push token:', token);
 * ```
 */

import {
  LocalNotifications,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNative } from './platform';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('Notifications');

/**
 * Notification schedule options
 */
export interface NotificationSchedule {
  at?: Date; // Schedule for specific date/time
  every?: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute'; // Repeating notification
}

/**
 * Local notification options
 */
export interface LocalNotificationOptions {
  id?: number; // Optional ID for managing notification
  title: string;
  body: string;
  schedule?: NotificationSchedule;
  sound?: string; // Sound file name (native only)
  actionTypeId?: string; // Action buttons (native only)
  extra?: Record<string, unknown>; // Custom data
}

/**
 * Notification permission status
 */
export type PermissionStatus = 'granted' | 'denied' | 'prompt';

/**
 * Notification error types
 */
export type NotificationError = 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'UNKNOWN';

/**
 * Custom error class for notification errors
 */
export class NotificationException extends Error {
  constructor(
    public type: NotificationError,
    message: string
  ) {
    super(message);
    this.name = 'NotificationException';
  }
}

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (
  options: LocalNotificationOptions
): Promise<number> => {
  const { id, title, body, schedule, sound, actionTypeId, extra } = options;

  try {
    if (isNative()) {
      // Use native Local Notifications plugin
      const notification: LocalNotificationSchema = {
        id: id || Date.now(),
        title,
        body,
        sound,
        actionTypeId,
        extra,
      };

      // Add schedule if provided
      if (schedule) {
        if (schedule.at) {
          notification.schedule = { at: schedule.at };
        } else if (schedule.every) {
          notification.schedule = { every: schedule.every };
        }
      }

      const result = await LocalNotifications.schedule({
        notifications: [notification],
      });

      return result.notifications[0].id;
    } else {
      // Use Web Notifications API
      if (!('Notification' in window)) {
        throw new NotificationException('UNAVAILABLE', 'Notifications not supported');
      }

      if (Notification.permission !== 'granted') {
        throw new NotificationException(
          'PERMISSION_DENIED',
          'Notification permission not granted'
        );
      }

      // Web doesn't support scheduled notifications natively
      // We'll use setTimeout for simple scheduling
      const notificationId = id || Date.now();

      const showNotification = () => {
        new Notification(title, {
          body,
          icon: '/findr-favicon-v2/favicon-96x96.png', // Use app icon
          tag: notificationId.toString(),
          data: extra,
        });
      };

      if (schedule?.at) {
        const delay = schedule.at.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(showNotification, delay);
        } else {
          // Past date, show immediately
          showNotification();
        }
      } else {
        // No schedule, show immediately
        showNotification();
      }

      return notificationId;
    }
  } catch (error) {
    if (error instanceof NotificationException) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        throw new NotificationException('PERMISSION_DENIED', error.message);
      }
      throw new NotificationException('UNKNOWN', error.message);
    }

    throw new NotificationException('UNKNOWN', 'Failed to schedule notification');
  }
};

/**
 * Cancel a scheduled local notification
 */
export const cancelLocalNotification = async (id: number): Promise<void> => {
  if (isNative()) {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } else {
    // Web notifications can't be cancelled before they're shown
    // But we can close them if they're already displayed
    // (This is a limitation of Web Notifications API)
    logger.warn('Web notifications cannot be cancelled before display');
  }
};

/**
 * Cancel all scheduled local notifications
 */
export const cancelAllLocalNotifications = async (): Promise<void> => {
  if (isNative()) {
    await LocalNotifications.cancel({ notifications: [] });
  } else {
    logger.warn('Web notifications cannot be cancelled before display');
  }
};

/**
 * Check notification permissions
 */
export const checkPermissions = async (): Promise<PermissionStatus> => {
  if (isNative()) {
    const permissions = await LocalNotifications.checkPermissions();
    return permissions.display as PermissionStatus;
  } else {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission as PermissionStatus;
  }
};

/**
 * Request notification permissions
 */
export const requestPermissions = async (): Promise<PermissionStatus> => {
  if (isNative()) {
    const permissions = await LocalNotifications.requestPermissions();
    return permissions.display as PermissionStatus;
  } else {
    if (!('Notification' in window)) {
      throw new NotificationException('UNAVAILABLE', 'Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission as PermissionStatus;
  }
};

/**
 * Register for push notifications (native only)
 * Returns the device push token for sending to backend
 *
 * NOTE: This requires backend integration to send push notifications
 * The token should be sent to your backend for use with APNs/FCM
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!isNative()) {
    logger.warn('Push notifications are only available on native platforms');
    return null;
  }

  try {
    // Request permission
    const permissionResult = await PushNotifications.requestPermissions();
    if (permissionResult.receive !== 'granted') {
      throw new NotificationException('PERMISSION_DENIED', 'Push permission denied');
    }

    // Register with APNs/FCM
    await PushNotifications.register();

    // Listen for registration success
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new NotificationException('UNKNOWN', 'Registration timeout'));
      }, 10000);

      PushNotifications.addListener('registration', (token) => {
        clearTimeout(timeout);
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        clearTimeout(timeout);
        reject(new NotificationException('UNKNOWN', error.error));
      });
    });
  } catch (error) {
    if (error instanceof NotificationException) {
      throw error;
    }

    if (error instanceof Error) {
      throw new NotificationException('UNKNOWN', error.message);
    }

    throw new NotificationException('UNKNOWN', 'Failed to register for push notifications');
  }
};

/**
 * Add listener for push notification received while app is in foreground
 * (Native only)
 */
export const addPushNotificationListener = async (
  callback: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
): Promise<(() => void) | null> => {
  if (!isNative()) {
    logger.warn('Push notifications are only available on native platforms');
    return null;
  }

  const listener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    callback({
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });
  });

  // Return cleanup function
  return () => {
    listener.remove();
  };
};

/**
 * Add listener for push notification action performed (user tapped notification)
 * (Native only)
 */
export const addPushNotificationActionListener = async (
  callback: (action: { actionId: string; notification: unknown }) => void
): Promise<(() => void) | null> => {
  if (!isNative()) {
    logger.warn('Push notifications are only available on native platforms');
    return null;
  }

  const listener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    callback({
      actionId: action.actionId,
      notification: action.notification as unknown,
    });
  });

  // Return cleanup function
  return () => {
    listener.remove();
  };
};
