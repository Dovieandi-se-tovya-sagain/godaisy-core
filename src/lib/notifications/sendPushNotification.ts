/**
 * Unified Push Notification Sender
 *
 * Sends push notifications to both iOS (APNS) and Android (FCM) devices.
 * Queries user_push_tokens table and routes to the appropriate service.
 */

import { createClient } from '@supabase/supabase-js';
import { sendApnsPushNotification } from '../findr/apnsClient';
import { sendFcmPushNotification } from './fcmClient';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  imageUrl?: string;
}

export interface PushResult {
  ios: { sent: boolean; error?: string };
  android: { sent: boolean; error?: string };
}

/**
 * Send push notification to a user on all their registered devices
 *
 * @param userId - The user's ID
 * @param payload - Notification content
 * @returns Promise<PushResult> - Results for each platform
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<PushResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Push] Missing Supabase configuration');
    return {
      ios: { sent: false, error: 'Missing Supabase config' },
      android: { sent: false, error: 'Missing Supabase config' },
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get all push tokens for this user
  const { data: tokens, error } = await supabase
    .from('user_push_tokens')
    .select('token, platform')
    .eq('user_id', userId);

  if (error) {
    console.error('[Push] Error fetching tokens:', error);
    return {
      ios: { sent: false, error: 'Failed to fetch tokens' },
      android: { sent: false, error: 'Failed to fetch tokens' },
    };
  }

  if (!tokens || tokens.length === 0) {
    console.log('[Push] No tokens found for user:', userId);
    return {
      ios: { sent: false, error: 'No token registered' },
      android: { sent: false, error: 'No token registered' },
    };
  }

  const result: PushResult = {
    ios: { sent: false },
    android: { sent: false },
  };

  for (const { token, platform } of tokens) {
    if (platform === 'ios') {
      try {
        const sent = await sendApnsPushNotification(token, {
          title: payload.title,
          body: payload.body,
          data: payload.data,
          badge: payload.badge,
          sound: payload.sound,
        });
        result.ios.sent = sent;

        // Remove invalid token
        if (!sent) {
          console.log('[Push] Removing invalid iOS token for user:', userId);
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('token', token);
        }
      } catch (err) {
        result.ios.error = err instanceof Error ? err.message : 'Unknown error';
      }
    } else if (platform === 'android') {
      try {
        const sent = await sendFcmPushNotification(token, {
          title: payload.title,
          body: payload.body,
          data: payload.data,
          imageUrl: payload.imageUrl,
        });
        result.android.sent = sent;

        // Remove invalid token
        if (!sent) {
          console.log('[Push] Removing invalid Android token for user:', userId);
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('token', token);
        }
      } catch (err) {
        result.android.error = err instanceof Error ? err.message : 'Unknown error';
      }
    }
  }

  return result;
}

/**
 * Check if push notifications are configured for at least one platform
 */
export function isPushConfigured(): { ios: boolean; android: boolean } {
  const ios = !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_KEY
  );

  const android = !!(
    process.env.FCM_PROJECT_ID &&
    process.env.FCM_CLIENT_EMAIL &&
    process.env.FCM_PRIVATE_KEY
  );

  return { ios, android };
}
