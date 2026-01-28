/**
 * Offline Initialization Component
 *
 * Initializes offline storage and sync service on app startup
 * Runs in the background and starts automatic sync when online
 */

'use client';

import { useEffect } from 'react';

export function OfflineInit() {
  useEffect(() => {
    // Initialize offline services on mount
    const initOffline = async () => {
      try {
        // Initialize secure storage for native apps (must happen before Supabase auth)
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { initSecureStorage } = await import('../lib/capacitor/secureStorage');
          await initSecureStorage();
          if (process.env.NODE_ENV === 'development') {
            console.log('[OfflineInit] Secure storage initialized');
          }

          // Initialize push notifications for native apps
          // Wrapped in try-catch as plugin may not be available in hybrid mode
          try {
            console.log('[OfflineInit] Initializing push notifications...');
            const { initPushNotifications } = await import('../lib/capacitor/pushNotifications');
            await initPushNotifications();
            console.log('[OfflineInit] Push notifications initialized');
          } catch (pushError) {
            // Don't fail initialization if push notifications aren't available
            console.warn('[OfflineInit] Push notifications unavailable:', pushError);
          }
        }

        // Initialize IndexedDB
        const { initDB } = await import('../lib/offline/db');
        await initDB();
        if (process.env.NODE_ENV === 'development') {
          console.log('[OfflineInit] IndexedDB initialized');
        }

        // Start sync service
        const { getSyncService } = await import('../lib/offline/sync');
        const sync = getSyncService();
        sync.start();
        if (process.env.NODE_ENV === 'development') {
          console.log('[OfflineInit] Sync service started');
        }

        // Cleanup on unmount
        return () => {
          sync.stop();
        };
      } catch (error) {
        console.error('[OfflineInit] Failed to initialize offline services:', error);
      }
    };

    initOffline();
  }, []);

  // This component doesn't render anything
  return null;
}
