/**
 * Background Sync Service
 *
 * Enables background data sync for iOS/Android using:
 * - App lifecycle events (resume, pause)
 * - Network status changes
 * - Periodic sync when app is in foreground
 *
 * Note: True background fetch requires native code setup in iOS.
 * This module handles app lifecycle sync opportunities.
 */

import { Capacitor } from '@capacitor/core';
import { App, type AppState } from '@capacitor/app';
import { Network, type ConnectionStatus } from '@capacitor/network';

const isNative = Capacitor.isNativePlatform();

type SyncCallback = () => Promise<void>;

interface BackgroundSyncOptions {
  /** Sync interval when app is foregrounded (ms, default: 5 minutes) */
  foregroundInterval?: number;
  /** Whether to sync immediately on network reconnect */
  syncOnReconnect?: boolean;
  /** Whether to sync when app resumes from background */
  syncOnResume?: boolean;
}

class BackgroundSyncService {
  private syncCallbacks: Set<SyncCallback> = new Set();
  private isInitialized = false;
  private foregroundInterval: ReturnType<typeof setInterval> | null = null;
  private lastNetworkState: boolean = true;
  private options: BackgroundSyncOptions = {};

  /**
   * Initialize background sync with callbacks
   */
  async initialize(options: BackgroundSyncOptions = {}): Promise<void> {
    if (this.isInitialized) return;
    if (!isNative) {
      this.isInitialized = true;
      return;
    }

    this.options = {
      foregroundInterval: 5 * 60 * 1000, // 5 minutes
      syncOnReconnect: true,
      syncOnResume: true,
      ...options,
    };

    // Get initial network state
    const status = await Network.getStatus();
    this.lastNetworkState = status.connected;

    // Listen for app state changes
    App.addListener('appStateChange', (state: AppState) => {
      this.handleAppStateChange(state);
    });

    // Listen for network changes
    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      this.handleNetworkChange(status);
    });

    // Start foreground interval
    this.startForegroundInterval();

    this.isInitialized = true;
    console.log('[BackgroundSync] Initialized');
  }

  /**
   * Register a sync callback
   */
  registerSync(callback: SyncCallback): () => void {
    this.syncCallbacks.add(callback);
    return () => this.syncCallbacks.delete(callback);
  }

  /**
   * Trigger all sync callbacks
   */
  async triggerSync(reason: string): Promise<void> {
    if (this.syncCallbacks.size === 0) return;

    console.log('[BackgroundSync] Triggering sync (' + reason + ')...');

    const results = await Promise.allSettled(
      Array.from(this.syncCallbacks).map((callback) => callback())
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log('[BackgroundSync] Sync complete: ' + succeeded + ' succeeded, ' + failed + ' failed');
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange(state: AppState): void {
    console.log('[BackgroundSync] App state changed:', state.isActive ? 'foreground' : 'background');

    if (state.isActive) {
      // App came to foreground
      this.startForegroundInterval();

      if (this.options.syncOnResume) {
        // Sync after a short delay to let UI settle
        setTimeout(() => {
          this.triggerSync('app-resume');
        }, 1000);
      }
    } else {
      // App went to background
      this.stopForegroundInterval();
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkChange(status: ConnectionStatus): void {
    const wasOffline = !this.lastNetworkState;
    this.lastNetworkState = status.connected;

    console.log('[BackgroundSync] Network changed:', status.connected ? 'online' : 'offline');

    if (wasOffline && status.connected && this.options.syncOnReconnect) {
      // Just came back online - trigger sync
      this.triggerSync('network-reconnect');
    }
  }

  /**
   * Start periodic sync while in foreground
   */
  private startForegroundInterval(): void {
    if (this.foregroundInterval) return;

    this.foregroundInterval = setInterval(() => {
      this.triggerSync('periodic');
    }, this.options.foregroundInterval || 5 * 60 * 1000);
  }

  /**
   * Stop periodic sync (when going to background)
   */
  private stopForegroundInterval(): void {
    if (this.foregroundInterval) {
      clearInterval(this.foregroundInterval);
      this.foregroundInterval = null;
    }
  }

  /**
   * Check if sync is available
   */
  isAvailable(): boolean {
    return isNative && this.isInitialized;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopForegroundInterval();
    this.syncCallbacks.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
export const backgroundSync = new BackgroundSyncService();

/**
 * Initialize background sync for Grow Daisy
 */
export async function initGrowBackgroundSync(): Promise<void> {
  await backgroundSync.initialize({
    foregroundInterval: 5 * 60 * 1000, // 5 minutes
    syncOnReconnect: true,
    syncOnResume: true,
  });

  // Register Grow Daisy sync callback
  backgroundSync.registerSync(async () => {
    try {
      const { growOfflineSync } = await import('@/lib/offline/growSync');
      await growOfflineSync.syncPendingChanges();
    } catch (error) {
      console.error('[BackgroundSync] Grow sync failed:', error);
    }
  });
}
