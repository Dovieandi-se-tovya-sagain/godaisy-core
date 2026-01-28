/**
 * Push Notification Service for Capacitor Native Apps
 *
 * Handles:
 * - Push notification registration
 * - Local notification scheduling for reminders
 * - Notification tap handling with deep linking
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { PlannedActivity } from '../../components/PlanItSheet';

// Storage key for push token
const PUSH_TOKEN_KEY = 'push_notification_token';

/**
 * Initialize push notification service
 * Call this early in app lifecycle (e.g., in OfflineInit)
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Skipping - not a native platform');
    return;
  }

  // Check if PushNotifications plugin is actually available
  // In hybrid mode (server URL), plugins may not be properly bridged
  if (!Capacitor.isPluginAvailable('PushNotifications')) {
    console.log('[Push] Skipping - PushNotifications plugin not available');
    return;
  }

  try {
    // IMPORTANT: Set up listeners BEFORE registering to catch the registration event
    setupPushListeners();
    console.log('[Push] Listeners set up');

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    console.log('[Push] Permission status:', permResult.receive);

    if (permResult.receive === 'granted') {
      // Register for push notifications
      await PushNotifications.register();
      console.log('[Push] Registration requested');
    } else {
      console.log('[Push] Permission denied');
    }

    // Also request local notification permissions
    if (Capacitor.isPluginAvailable('LocalNotifications')) {
      const localPermResult = await LocalNotifications.requestPermissions();
      if (localPermResult.display === 'granted') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Push] Local notifications permitted');
        }
      }
    }
  } catch (error) {
    console.error('[Push] Failed to initialize:', error);
  }
}

/**
 * Set up push notification event listeners
 */
function setupPushListeners(): void {
  // Called when registration is successful
  PushNotifications.addListener('registration', async (token) => {
    console.log('[Push] Got token:', token.value.substring(0, 20) + '...');

    // Store the token
    localStorage.setItem(PUSH_TOKEN_KEY, token.value);

    // If user is authenticated, sync token to server immediately
    try {
      const { supabase } = await import('../../lib/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        console.log('[Push] User authenticated, syncing token...');
        const success = await syncPushTokenToServer(session.access_token);
        console.log('[Push] Token sync result:', success ? 'SUCCESS' : 'FAILED');
      } else {
        console.log('[Push] No session, token stored locally for later sync');
      }
    } catch (e) {
      console.error('[Push] Failed to sync token:', e);
    }
  });

  // Called when registration fails
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', JSON.stringify(error));
  });

  // Called when a push notification is received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Push] Received:', notification);
    }
  });

  // Called when user taps on a push notification
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Push] Action performed:', action);
    }
    handleNotificationTap(action.notification.data);
  });

  // Local notification tap handler
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Local] Action performed:', action);
    }
    handleNotificationTap(action.notification.extra);
  });
}

/**
 * Handle notification tap - navigate to appropriate screen
 */
function handleNotificationTap(data: Record<string, unknown>): void {
  const app = data.app as string | undefined;
  const planId = data.planId as string | undefined;

  if (!app) return;

  // Navigate based on app
  switch (app) {
    case 'godaisy':
      window.location.href = '/';
      break;
    case 'findr':
      window.location.href = '/findr';
      break;
    case 'growdaisy':
      window.location.href = '/grow';
      break;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Push] Navigating to:', app, 'plan:', planId);
  }
}

/**
 * Get the stored push token
 */
export function getPushToken(): string | null {
  return localStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Sync push token to server for authenticated users
 * This enables server-sent push notifications for reminders
 */
export async function syncPushTokenToServer(accessToken: string): Promise<boolean> {
  const token = getPushToken();
  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Push] No token to sync');
    }
    return false;
  }

  // Determine platform - use Capacitor.getPlatform() as primary method
  let platform: 'ios' | 'android' = 'android';
  try {
    const { Capacitor } = await import('@capacitor/core');
    const capPlatform = Capacitor.getPlatform();
    platform = capPlatform === 'ios' ? 'ios' : 'android';
    console.log('[Push] Detected platform:', platform);
  } catch (e) {
    console.warn('[Push] Platform detection failed, defaulting to android:', e);
  }

  try {
    const response = await fetch('/api/notifications/register-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token, platform }),
    });

    if (response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Push] Token synced to server');
      }
      return true;
    } else {
      console.warn('[Push] Failed to sync token:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[Push] Token sync error:', error);
    return false;
  }
}

/**
 * Remove push token from server (e.g., on logout)
 */
export async function removePushTokenFromServer(accessToken: string): Promise<boolean> {
  try {
    // Determine platform
    let platform: 'ios' | 'android' | undefined;
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getInfo();
      platform = info.platform === 'ios' ? 'ios' : 'android';
    } catch {
      // Remove all if we can't determine platform
    }

    const response = await fetch('/api/notifications/register-token', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ platform }),
    });

    if (response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Push] Token removed from server');
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Failed to remove token:', error);
    return false;
  }
}

/**
 * Schedule a local notification for a planned activity reminder
 */
export async function scheduleReminder(plan: PlannedActivity): Promise<number | null> {
  if (!Capacitor.isNativePlatform()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Push] Skipping reminder - not native platform');
    }
    return null;
  }

  if (!Capacitor.isPluginAvailable('LocalNotifications')) {
    console.log('[Push] Skipping reminder - LocalNotifications plugin not available');
    return null;
  }

  if (!plan.reminderEnabled) {
    return null;
  }

  try {
    // Calculate reminder time (1 hour before planned time, or 9am on the day)
    const plannedDate = new Date(plan.plannedFor);
    let reminderDate: Date;

    if (plan.plannedTime) {
      const [hours, minutes] = plan.plannedTime.split(':').map(Number);
      reminderDate = new Date(plannedDate);
      reminderDate.setHours(hours - 1, minutes, 0, 0); // 1 hour before

      // If reminder would be in the past, skip
      if (reminderDate <= new Date()) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Push] Reminder time already passed, skipping');
        }
        return null;
      }
    } else {
      // No specific time - remind at 9am on the day
      reminderDate = new Date(plannedDate);
      reminderDate.setHours(9, 0, 0, 0);

      // If that's in the past, try 2 hours from now
      if (reminderDate <= new Date()) {
        reminderDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      }
    }

    // Generate a unique notification ID
    const notificationId = Math.floor(Math.random() * 2147483647);

    const notification: LocalNotificationSchema = {
      id: notificationId,
      title: getAppTitle(plan.app),
      body: `Reminder: ${plan.activityName}`,
      schedule: { at: reminderDate },
      extra: {
        app: plan.app,
        planId: plan.id,
        activityType: plan.activityType,
      },
    };

    await LocalNotifications.schedule({ notifications: [notification] });

    if (process.env.NODE_ENV === 'development') {
      console.log('[Push] Scheduled reminder:', {
        id: notificationId,
        at: reminderDate.toISOString(),
        activity: plan.activityName,
      });
    }

    // Store the notification ID with the plan for later cancellation
    const reminderIds = JSON.parse(localStorage.getItem('reminder_notification_ids') || '{}');
    reminderIds[plan.id] = notificationId;
    localStorage.setItem('reminder_notification_ids', JSON.stringify(reminderIds));

    return notificationId;
  } catch (error) {
    console.error('[Push] Failed to schedule reminder:', error);
    return null;
  }
}

/**
 * Cancel a scheduled reminder
 */
export async function cancelReminder(planId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) {
    return;
  }

  try {
    const reminderIds = JSON.parse(localStorage.getItem('reminder_notification_ids') || '{}');
    const notificationId = reminderIds[planId];

    if (notificationId) {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      delete reminderIds[planId];
      localStorage.setItem('reminder_notification_ids', JSON.stringify(reminderIds));

      if (process.env.NODE_ENV === 'development') {
        console.log('[Push] Cancelled reminder:', notificationId);
      }
    }
  } catch (error) {
    console.error('[Push] Failed to cancel reminder:', error);
  }
}

/**
 * Get app-specific title for notifications
 */
function getAppTitle(app: PlannedActivity['app']): string {
  switch (app) {
    case 'godaisy':
      return 'Go Daisy';
    case 'findr':
      return 'Fish Findr';
    case 'growdaisy':
      return 'Grow Daisy';
    default:
      return 'Reminder';
  }
}

/**
 * Get all pending local notifications
 */
export async function getPendingReminders(): Promise<LocalNotificationSchema[]> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) {
    return [];
  }

  try {
    const result = await LocalNotifications.getPending();
    return result.notifications;
  } catch (error) {
    console.error('[Push] Failed to get pending reminders:', error);
    return [];
  }
}
