/**
 * Tests for Sync Service
 *
 * Tests background sync of catch logs, retry logic with exponential backoff,
 * network reconnection handling, and event listeners.
 */

import { SyncService, getSyncService, SyncResult } from '../sync';
import { getStorage, PendingCatchLog } from '../storage';
import { getNetworkMonitor, NetworkStatus } from '../network';

// Mock dependencies
jest.mock('../storage');
jest.mock('../network');

const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;
const mockGetNetworkMonitor = getNetworkMonitor as jest.MockedFunction<typeof getNetworkMonitor>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('lib/offline/sync', () => {
  let syncService: SyncService;
  let mockStorage: any;
  let mockNetworkMonitor: any;
  let networkListeners: Set<(status: NetworkStatus) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    networkListeners = new Set();

    // Mock storage service
    mockStorage = {
      getPendingCatchLogs: jest.fn(),
      removeCatchLog: jest.fn(),
      updateCatchLogRetryCount: jest.fn(),
    };
    mockGetStorage.mockReturnValue(mockStorage);

    // Mock network monitor
    mockNetworkMonitor = {
      isOnline: jest.fn(),
      addListener: jest.fn((listener) => {
        networkListeners.add(listener);
        return () => networkListeners.delete(listener);
      }),
    };
    mockGetNetworkMonitor.mockReturnValue(mockNetworkMonitor);

    // Default to offline to prevent auto-sync during setup
    mockNetworkMonitor.isOnline.mockResolvedValue(false);

    // Create new sync service for each test
    syncService = new SyncService();
  });

  afterEach(() => {
    syncService.destroy();
    networkListeners.clear();
  });

  describe('getSyncService', () => {
    it('should return singleton instance', () => {
      const instance1 = getSyncService();
      const instance2 = getSyncService();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(SyncService);
    });
  });

  describe('start and stop', () => {
    it('should start listening for network changes', () => {
      syncService.start();

      expect(mockNetworkMonitor.addListener).toHaveBeenCalled();
    });

    it('should not start twice', () => {
      syncService.start();
      syncService.start();

      expect(mockNetworkMonitor.addListener).toHaveBeenCalledTimes(1);
    });

    it('should trigger sync when network reconnects', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      syncService.start();

      // Simulate network reconnection
      const networkStatus: NetworkStatus = {
        connected: true,
        type: 'wifi',
      };

      for (const listener of networkListeners) {
        listener(networkStatus);
      }

      // Wait for async sync to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorage.getPendingCatchLogs).toHaveBeenCalled();
    });

    it('should not sync when network disconnects', async () => {
      syncService.start();

      // Simulate network disconnection
      const networkStatus: NetworkStatus = {
        connected: false,
        type: 'none',
      };

      for (const listener of networkListeners) {
        listener(networkStatus);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorage.getPendingCatchLogs).not.toHaveBeenCalled();
    });

    it('should stop listening when stopped', () => {
      syncService.start();
      const unsubscribe = mockNetworkMonitor.addListener.mock.results[0]?.value;

      syncService.stop();

      // Verify unsubscribe was called
      expect(networkListeners.size).toBe(0);
    });

    it('should trigger initial sync if online when started', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      syncService.start();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorage.getPendingCatchLogs).toHaveBeenCalled();
    });
  });

  describe('syncNow', () => {
    it('should return early if already syncing', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      // Start first sync
      const sync1Promise = syncService.syncNow();

      // Try to start second sync immediately
      const result2 = await syncService.syncNow();

      expect(result2).toEqual({ syncedCount: 0, failedCount: 0, errors: [] });

      // Cleanup
      await sync1Promise;
    });

    it('should return early if offline', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(false);

      const result = await syncService.syncNow();

      expect(result).toEqual({ syncedCount: 0, failedCount: 0, errors: [] });
      expect(mockStorage.getPendingCatchLogs).not.toHaveBeenCalled();
    });

    it('should return early if no pending logs', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const result = await syncService.syncNow();

      expect(result).toEqual({ syncedCount: 0, failedCount: 0, errors: [] });
    });

    it('should sync pending catch logs successfully', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
          },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'Success',
      } as Response);

      const result = await syncService.syncNow();

      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(mockStorage.removeCatchLog).toHaveBeenCalledWith('log-1');
    });

    it('should handle sync failures and update retry count', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
          },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as Response);

      const result = await syncService.syncNow();

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        id: 'log-1',
        error: 'API error: 500 - Server error',
      });
      expect(mockStorage.updateCatchLogRetryCount).toHaveBeenCalledWith('log-1');
    });

    it('should remove logs after 5 failed retries', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
          },
          retryCount: 5, // Already at max retries
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as Response);

      await syncService.syncNow();

      expect(mockStorage.removeCatchLog).toHaveBeenCalledWith('log-1');
    });

    it('should send FormData with all log fields', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
            bait: 'lugworm',
            habitat: 'rocky',
            metadata: { notes: 'Good catch' },
          },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'Success',
      } as Response);

      await syncService.syncNow();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/findr/catch-log',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );

      const formData = mockFetch.mock.calls[0][1]?.body as FormData;
      expect(formData.get('speciesId')).toBe('cod');
      expect(formData.get('rectangleCode')).toBe('31F1');
      expect(formData.get('date')).toBe('2025-01-06');
      expect(formData.get('bait')).toBe('lugworm');
      expect(formData.get('habitat')).toBe('rocky');
      expect(formData.get('metadata')).toBe(JSON.stringify({ notes: 'Good catch' }));
    });

    it('should preserve photo blobs during sync', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const photo1 = new Blob(['photo1'], { type: 'image/jpeg' });
      const photo2 = new Blob(['photo2'], { type: 'image/jpeg' });

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
            photos: [photo1, photo2],
          },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'Success',
      } as Response);

      await syncService.syncNow();

      const formData = mockFetch.mock.calls[0][1]?.body as FormData;
      const photos = formData.getAll('photos');

      expect(photos).toHaveLength(2);
      expect(photos[0]).toBeInstanceOf(Blob);
      expect(photos[1]).toBeInstanceOf(Blob);
    });

    it('should sync multiple logs in sequence', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 0,
        },
        {
          id: 'log-2',
          timestamp: Date.now(),
          data: { speciesId: 'haddock', rectangleCode: '31F2', date: '2025-01-06' },
          retryCount: 0,
        },
        {
          id: 'log-3',
          timestamp: Date.now(),
          data: { speciesId: 'mackerel', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'Success',
      } as Response);

      const result = await syncService.syncNow();

      expect(result.syncedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockStorage.removeCatchLog).toHaveBeenCalledWith('log-1');
      expect(mockStorage.removeCatchLog).toHaveBeenCalledWith('log-2');
      expect(mockStorage.removeCatchLog).toHaveBeenCalledWith('log-3');
    });

    it('should continue syncing even if some logs fail', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 0,
        },
        {
          id: 'log-2',
          timestamp: Date.now(),
          data: { speciesId: 'haddock', rectangleCode: '31F2', date: '2025-01-06' },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);

      // First log succeeds, second fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'Success',
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        } as Response);

      const result = await syncService.syncNow();

      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(mockStorage.removeCatchLog).toHaveBeenCalledWith('log-1');
      expect(mockStorage.updateCatchLogRetryCount).toHaveBeenCalledWith('log-2');
    });
  });

  describe('getPendingSyncCount', () => {
    it('should return count of pending logs', async () => {
      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 0,
        },
        {
          id: 'log-2',
          timestamp: Date.now(),
          data: { speciesId: 'haddock', rectangleCode: '31F2', date: '2025-01-06' },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);

      const count = await syncService.getPendingSyncCount();

      expect(count).toBe(2);
    });

    it('should return 0 if no pending logs', async () => {
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const count = await syncService.getPendingSyncCount();

      expect(count).toBe(0);
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false when not syncing', () => {
      expect(syncService.isSyncInProgress()).toBe(false);
    });

    it('should return true during sync', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 50))
      );

      // Start sync (don't await)
      const syncPromise = syncService.syncNow();

      // Check immediately
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(syncService.isSyncInProgress()).toBe(true);

      // Wait for completion
      await syncPromise;
      expect(syncService.isSyncInProgress()).toBe(false);
    });
  });

  describe('Event listeners', () => {
    it('should notify listeners on sync complete', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const listener = jest.fn();
      syncService.onSyncComplete(listener);

      await syncService.syncNow();

      expect(listener).toHaveBeenCalledWith({
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      });
    });

    it('should notify multiple listeners', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const listener1 = jest.fn();
      const listener2 = jest.fn();
      syncService.onSyncComplete(listener1);
      syncService.onSyncComplete(listener2);

      await syncService.syncNow();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove listener via cleanup function', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const listener = jest.fn();
      const cleanup = syncService.onSyncComplete(listener);

      // Remove listener
      cleanup();

      await syncService.syncNow();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const badListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      syncService.onSyncComplete(badListener);
      syncService.onSyncComplete(goodListener);

      await syncService.syncNow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should stop sync and clear listeners', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);
      mockStorage.getPendingCatchLogs.mockResolvedValue([]);

      const listener = jest.fn();
      syncService.onSyncComplete(listener);
      syncService.start();

      syncService.destroy();

      // Verify listeners cleared
      await syncService.syncNow();
      expect(listener).not.toHaveBeenCalled();

      // Verify network listener removed
      expect(networkListeners.size).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle network errors during sync', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await syncService.syncNow();

      expect(result.failedCount).toBe(1);
      expect(result.errors[0].error).toBe('Network failure');
    });

    it('should handle malformed responses', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 0,
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => {
          throw new Error('Failed to read response');
        },
      } as Response);

      const result = await syncService.syncNow();

      expect(result.failedCount).toBe(1);
    });
  });

  describe('Retry logic', () => {
    it('should track retry count correctly', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      const pendingLogs: PendingCatchLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
          retryCount: 2, // Already retried twice
        },
      ];

      mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      } as Response);

      await syncService.syncNow();

      expect(mockStorage.updateCatchLogRetryCount).toHaveBeenCalledWith('log-1');
      // Should NOT remove yet (< 5 retries)
      expect(mockStorage.removeCatchLog).not.toHaveBeenCalled();
    });

    it('should remove logs exactly at 5 retries', async () => {
      mockNetworkMonitor.isOnline.mockResolvedValue(true);

      for (let retries = 0; retries <= 6; retries++) {
        jest.clearAllMocks();

        const pendingLogs: PendingCatchLog[] = [
          {
            id: `log-${retries}`,
            timestamp: Date.now(),
            data: { speciesId: 'cod', rectangleCode: '31F1', date: '2025-01-06' },
            retryCount: retries,
          },
        ];

        mockStorage.getPendingCatchLogs.mockResolvedValue(pendingLogs);
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Error',
        } as Response);

        await syncService.syncNow();

        if (retries >= 5) {
          expect(mockStorage.removeCatchLog).toHaveBeenCalledWith(`log-${retries}`);
        } else {
          expect(mockStorage.removeCatchLog).not.toHaveBeenCalled();
        }
      }
    });
  });
});
