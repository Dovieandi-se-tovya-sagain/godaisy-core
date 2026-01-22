/**
 * Firebase Cloud Messaging (FCM) Client for Android Push Notifications
 *
 * Sends push notifications to Android devices using the FCM HTTP v1 API.
 *
 * Prerequisites:
 * - Firebase project created
 * - Service account JSON key from Firebase Console
 *
 * Environment Variables Required:
 * - FCM_PROJECT_ID: Your Firebase project ID (e.g., fishfindr-12345)
 * - FCM_CLIENT_EMAIL: Service account email
 * - FCM_PRIVATE_KEY: Service account private key (PEM format with \n)
 */

import { google } from 'googleapis';

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL;
const FCM_PRIVATE_KEY = process.env.FCM_PRIVATE_KEY;

const FCM_API_URL = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

let cachedAccessToken: { token: string; expiry: number } | null = null;

/**
 * Get OAuth2 access token for FCM API
 * Tokens are cached until near expiry
 */
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && cachedAccessToken.expiry > Date.now() + 5 * 60 * 1000) {
    return cachedAccessToken.token;
  }

  if (!FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    console.error('[FCM] Missing configuration. Required: FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY');
    return null;
  }

  try {
    const jwtClient = new google.auth.JWT({
      email: FCM_CLIENT_EMAIL,
      key: FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const credentials = await jwtClient.authorize();

    if (!credentials.access_token) {
      console.error('[FCM] Failed to get access token');
      return null;
    }

    // Cache token with expiry
    cachedAccessToken = {
      token: credentials.access_token,
      expiry: credentials.expiry_date || Date.now() + 3600 * 1000,
    };

    console.log('[FCM] Access token obtained successfully');
    return credentials.access_token;
  } catch (error) {
    console.error('[FCM] Error getting access token:', error);
    return null;
  }
}

export interface FcmNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Send push notification to Android device via FCM
 *
 * @param token - FCM device token (obtained from Android device registration)
 * @param payload - Notification content and metadata
 * @returns Promise<boolean> - True if sent successfully, false otherwise
 *
 * @example
 * ```typescript
 * await sendFcmPushNotification('device-token-123', {
 *   title: '🎣 Hot Bite Alert!',
 *   body: 'Bass at 89% confidence in Cork Harbor',
 *   data: {
 *     type: 'hot_bite',
 *     speciesId: 'BSS',
 *     rectangleCode: '31E8',
 *   },
 * });
 * ```
 */
export async function sendFcmPushNotification(
  token: string,
  payload: FcmNotificationPayload
): Promise<boolean> {
  if (!FCM_PROJECT_ID) {
    console.error('[FCM] Missing FCM_PROJECT_ID - cannot send notification');
    return false;
  }

  if (!token || token.trim() === '') {
    console.error('[FCM] Invalid device token provided');
    return false;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('[FCM] Could not obtain access token');
    return false;
  }

  try {
    const message = {
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { image: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            channel_id: 'default',
          },
        },
      },
    };

    const response = await fetch(FCM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[FCM] Failed to send notification:', {
        status: response.status,
        error: errorData,
        token: token.substring(0, 20) + '...',
      });

      // Check for invalid token errors
      if (response.status === 404 || response.status === 400) {
        // Token is invalid - caller should remove it from database
        return false;
      }

      return false;
    }

    const result = await response.json();
    console.log('[FCM] Notification sent successfully:', {
      token: token.substring(0, 20) + '...',
      title: payload.title,
      messageId: result.name,
    });

    return true;
  } catch (error) {
    console.error('[FCM] Unexpected error sending notification:', error);
    return false;
  }
}

/**
 * Send push notifications to multiple Android devices (batch)
 *
 * @param tokens - Array of FCM device tokens
 * @param payload - Notification content and metadata
 * @returns Promise<{ sent: number; failed: number }> - Success/failure counts
 */
export async function sendBatchFcmPushNotifications(
  tokens: string[],
  payload: FcmNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!tokens || tokens.length === 0) {
    console.warn('[FCM] No tokens provided for batch send');
    return { sent: 0, failed: 0 };
  }

  console.log(`[FCM] Sending batch notification to ${tokens.length} devices`);

  const results = await Promise.allSettled(
    tokens.map(token => sendFcmPushNotification(token, payload))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - sent;

  console.log(`[FCM] Batch send complete: ${sent} sent, ${failed} failed`);

  return { sent, failed };
}

/**
 * Test FCM configuration
 *
 * Validates that all required environment variables are set.
 *
 * @returns boolean - True if configuration is valid
 */
export function testFcmConfiguration(): boolean {
  console.log('[FCM] Testing configuration...');

  if (!FCM_PROJECT_ID) {
    console.error('[FCM] Missing FCM_PROJECT_ID');
    return false;
  }

  if (!FCM_CLIENT_EMAIL) {
    console.error('[FCM] Missing FCM_CLIENT_EMAIL');
    return false;
  }

  if (!FCM_PRIVATE_KEY) {
    console.error('[FCM] Missing FCM_PRIVATE_KEY');
    return false;
  }

  console.log('[FCM] Configuration OK:', {
    projectId: FCM_PROJECT_ID,
    clientEmail: FCM_CLIENT_EMAIL.substring(0, 20) + '...',
  });

  return true;
}
