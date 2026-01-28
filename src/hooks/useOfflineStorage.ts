/**
 * React Hooks for Offline Storage
 *
 * Provides React integration for offline storage, network status,
 * and sync operations.
 *
 * Usage:
 * ```typescript
 * import { useNetworkStatus, useOfflinePrediction, useSyncStatus } from './useOfflineStorage';
 *
 * function MyComponent() {
 *   const { isOnline, connectionType } = useNetworkStatus();
 *   const { prediction, loading, freshness } = useOfflinePrediction('31F1', '2025-01-06');
 *   const { pendingCount, syncNow } = useSyncStatus();
 *
 *   return (
 *     <div>
 *       {!isOnline && <div>Offline Mode</div>}
 *       {prediction && <div>Freshness: {freshness}</div>}
 *       {pendingCount > 0 && <button onClick={syncNow}>Sync {pendingCount} items</button>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { getNetworkMonitor, NetworkStatus } from '../lib/offline/network';
import { getStorage, CachedPrediction, FreshnessLevel } from '../lib/offline/storage';
import { getSyncService, SyncResult } from '../lib/offline/sync';

/**
 * Hook for monitoring network status
 */
export function useNetworkStatus(): NetworkStatus & { isLoading: boolean } {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: true, // Assume online initially
    connectionType: 'unknown',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const monitor = getNetworkMonitor();

    // Get initial status
    monitor.getStatus().then((initialStatus) => {
      setStatus(initialStatus);
      setIsLoading(false);
    });

    // Listen for changes
    const unsubscribe = monitor.addListener((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { ...status, isLoading };
}

/**
 * Hook for accessing a cached prediction
 */
export function useOfflinePrediction(rectangleCode: string, date: string): {
  prediction: CachedPrediction | null;
  loading: boolean;
  freshness: FreshnessLevel | null;
  refetch: () => Promise<void>;
} {
  const [prediction, setPrediction] = useState<CachedPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrediction = useCallback(async () => {
    setLoading(true);
    try {
      const storage = getStorage();
      const cached = await storage.getPrediction(rectangleCode, date);
      setPrediction(cached);
    } catch (error) {
      console.error('[useOfflinePrediction] Error fetching prediction:', error);
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, [rectangleCode, date]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  return {
    prediction,
    loading,
    freshness: prediction?.freshness || null,
    refetch: fetchPrediction,
  };
}

/**
 * Hook for sync status and operations
 */
export function useSyncStatus(): {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  syncNow: () => Promise<void>;
  refetch: () => Promise<void>;
} {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const fetchPendingCount = useCallback(async () => {
    try {
      const sync = getSyncService();
      const count = await sync.getPendingSyncCount();
      setPendingCount(count);
    } catch (error) {
      console.error('[useSyncStatus] Error fetching pending count:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const sync = getSyncService();
      const result = await sync.syncNow();
      setLastSyncResult(result);
      await fetchPendingCount(); // Refresh count after sync
    } catch (error) {
      console.error('[useSyncStatus] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchPendingCount]);

  useEffect(() => {
    fetchPendingCount();

    // Listen for sync events
    const sync = getSyncService();
    const unsubscribe = sync.onSyncComplete((result) => {
      setLastSyncResult(result);
      fetchPendingCount();
    });

    // Update syncing status periodically
    const intervalId = setInterval(() => {
      setIsSyncing(sync.isSyncInProgress());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [fetchPendingCount]);

  return {
    pendingCount,
    isSyncing,
    lastSyncResult,
    syncNow,
    refetch: fetchPendingCount,
  };
}

/**
 * Hook for checking if offline storage is initialized
 */
export function useOfflineStorageReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize database on mount
    import('../lib/offline/db')
      .then((module) => module.initDB())
      .then(() => {
        setIsReady(true);
      })
      .catch((error) => {
        console.error('[useOfflineStorageReady] Failed to initialize database:', error);
      });
  }, []);

  return isReady;
}

/**
 * Hook for cache size monitoring
 */
export function useCacheSize(): {
  size: number;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [size, setSize] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSize = useCallback(async () => {
    setLoading(true);
    try {
      const storage = getStorage();
      const cacheSize = await storage.getCacheSize();
      setSize(cacheSize);
    } catch (error) {
      console.error('[useCacheSize] Error fetching cache size:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSize();
  }, [fetchSize]);

  return {
    size,
    loading,
    refetch: fetchSize,
  };
}
