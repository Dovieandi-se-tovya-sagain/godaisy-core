/**
 * Sync Service
 *
 * Manages synchronization of offline data (catch logs, favorites) when
 * network connectivity is restored.
 *
 * Usage:
 * ```typescript
 * import { SyncService } from './sync';
 *
 * const sync = new SyncService();
 *
 * // Start automatic sync on network reconnect
 * sync.start();
 *
 * // Listen for sync events
 * sync.onSyncComplete((result) => {
 *   console.log('Synced:', result.syncedCount);
 *   console.log('Failed:', result.failedCount);
 * });
 *
 * // Manual sync trigger
 * await sync.syncNow();
 * ```
 */

import { getStorage, PendingCatchLog } from './storage';
import { getNetworkMonitor, NetworkStatus } from './network';
import { createLogger } from '../utils/logger';

const logger = createLogger('SyncService');

/**
 * Sync result
 */
export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Sync event listener
 */
export type SyncEventListener = (result: SyncResult) => void;

/**
 * Sync Service
 */
export class SyncService {
  private storage = getStorage();
  private networkMonitor = getNetworkMonitor();
  private isSyncing = false;
  private syncListeners: Set<SyncEventListener> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private autoSyncEnabled = false;

  /**
   * Start automatic sync on network reconnect
   */
  start(): void {
    if (this.autoSyncEnabled) {
      return; // Already started
    }

    this.autoSyncEnabled = true;

    // Listen for network status changes
    this.networkUnsubscribe = this.networkMonitor.addListener((status: NetworkStatus) => {
      if (status.connected && !this.isSyncing) {
        logger.info('Network reconnected, starting sync...');
        this.syncNow().catch((error) => {
          logger.error('Auto-sync failed', error);
        });
      }
    });

    // Check if online now and sync if needed
    this.networkMonitor.isOnline().then((online) => {
      if (online) {
        this.syncNow().catch((error) => {
          logger.error('Initial sync failed', error);
        });
      }
    });
  }

  /**
   * Stop automatic sync
   */
  stop(): void {
    this.autoSyncEnabled = false;

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  /**
   * Manually trigger a sync
   */
  async syncNow(): Promise<SyncResult> {
    // Check if already syncing
    if (this.isSyncing) {
      logger.info('Sync already in progress, skipping...');
      return { syncedCount: 0, failedCount: 0, errors: [] };
    }

    // Check if online
    const online = await this.networkMonitor.isOnline();
    if (!online) {
      logger.info('Cannot sync while offline');
      return { syncedCount: 0, failedCount: 0, errors: [] };
    }

    this.isSyncing = true;

    try {
      const result = await this.syncCatchLogs();
      this.notifySyncComplete(result);
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync all pending catch logs
   */
  private async syncCatchLogs(): Promise<SyncResult> {
    const pendingLogs = await this.storage.getPendingCatchLogs();

    if (pendingLogs.length === 0) {
      logger.info('No pending catch logs to sync');
      return { syncedCount: 0, failedCount: 0, errors: [] };
    }

    logger.info(`Syncing ${pendingLogs.length} pending catch logs...`);

    const result: SyncResult = {
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    for (const log of pendingLogs) {
      try {
        await this.syncSingleCatchLog(log);
        result.syncedCount++;
        logger.info(`Successfully synced catch log ${log.id}`);
      } catch (error) {
        result.failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ id: log.id, error: errorMessage });
        logger.error(`Failed to sync catch log ${log.id}:`, errorMessage);

        // Update retry count
        await this.storage.updateCatchLogRetryCount(log.id);

        // If too many retries, consider removing it
        if (log.retryCount >= 5) {
          logger.warn(`Catch log ${log.id} failed 5+ times, removing from queue`);
          await this.storage.removeCatchLog(log.id);
        }
      }
    }

    logger.info(`Sync complete: ${result.syncedCount} synced, ${result.failedCount} failed`);
    return result;
  }

  /**
   * Sync a single catch log
   */
  private async syncSingleCatchLog(log: PendingCatchLog): Promise<void> {
    // Prepare FormData for API request
    const formData = new FormData();

    // Add basic data
    formData.append('speciesId', log.data.speciesId);
    formData.append('rectangleCode', log.data.rectangleCode);
    formData.append('date', log.data.date);

    if (log.data.bait) {
      formData.append('bait', log.data.bait);
    }

    if (log.data.habitat) {
      formData.append('habitat', log.data.habitat);
    }

    if (log.data.metadata) {
      formData.append('metadata', JSON.stringify(log.data.metadata));
    }

    // Add photos if present
    if (log.data.photos && log.data.photos.length > 0) {
      for (let i = 0; i < log.data.photos.length; i++) {
        const photo = log.data.photos[i];
        const filename = `catch-photo-${log.id}-${i}.jpg`;
        formData.append('photos', photo, filename);
      }
    }

    // Send to API
    const response = await fetch('/api/findr/catch-log', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    // Success - remove from queue
    await this.storage.removeCatchLog(log.id);
  }

  /**
   * Get pending sync count
   */
  async getPendingSyncCount(): Promise<number> {
    const pendingLogs = await this.storage.getPendingCatchLogs();
    return pendingLogs.length;
  }

  /**
   * Check if currently syncing
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Add a sync complete listener
   * Returns a cleanup function to remove the listener
   */
  onSyncComplete(callback: SyncEventListener): () => void {
    this.syncListeners.add(callback);

    return () => {
      this.syncListeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of sync completion
   */
  private notifySyncComplete(result: SyncResult): void {
    for (const listener of this.syncListeners) {
      try {
        listener(result);
      } catch (error) {
        logger.error('Listener error', error);
      }
    }
  }

  /**
   * Clear all listeners and stop sync
   */
  destroy(): void {
    this.stop();
    this.syncListeners.clear();
  }
}

/**
 * Singleton instance
 */
let syncInstance: SyncService | null = null;

/**
 * Get the sync service instance
 */
export function getSyncService(): SyncService {
  if (!syncInstance) {
    syncInstance = new SyncService();
  }
  return syncInstance;
}
