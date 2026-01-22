/**
 * Network Status Detection
 *
 * Monitors network connectivity using Capacitor Network plugin on native
 * and Navigator.onLine on web.
 *
 * Usage:
 * ```typescript
 * import { NetworkMonitor } from '@/lib/offline/network';
 *
 * const monitor = new NetworkMonitor();
 *
 * // Check current status
 * const isOnline = await monitor.isOnline();
 *
 * // Listen for changes
 * monitor.addListener((status) => {
 *   console.log('Network status:', status);
 *   if (status.connected) {
 *     // Trigger sync
 *   }
 * });
 * ```
 */

import { Network, ConnectionStatus } from '@capacitor/network';
import { isNative } from '../capacitor/platform';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('NetworkMonitor');

/**
 * Network status
 */
export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

/**
 * Network status change listener
 */
export type NetworkStatusListener = (status: NetworkStatus) => void;

/**
 * Network Monitor
 */
export class NetworkMonitor {
  private listeners: Set<NetworkStatusListener> = new Set();
  private nativeUnsubscribe: (() => void) | null = null;
  private lastStatus: NetworkStatus | null = null;

  constructor() {
    this.initializeListeners();
  }

  /**
   * Initialize network listeners
   */
  private async initializeListeners(): Promise<void> {
    if (isNative()) {
      // Use Capacitor Network plugin on native
      const listener = await Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
        const networkStatus = this.mapNativeStatus(status);
        this.notifyListeners(networkStatus);
      });

      this.nativeUnsubscribe = () => {
        listener.remove();
      };
    } else {
      // Use Navigator API on web
      window.addEventListener('online', this.handleWebOnline);
      window.addEventListener('offline', this.handleWebOffline);
    }
  }

  /**
   * Map native ConnectionStatus to NetworkStatus
   */
  private mapNativeStatus(status: ConnectionStatus): NetworkStatus {
    return {
      connected: status.connected,
      connectionType: status.connectionType as 'wifi' | 'cellular' | 'none' | 'unknown',
    };
  }

  /**
   * Handle web online event
   */
  private handleWebOnline = (): void => {
    this.notifyListeners({
      connected: true,
      connectionType: 'unknown',
    });
  };

  /**
   * Handle web offline event
   */
  private handleWebOffline = (): void => {
    this.notifyListeners({
      connected: false,
      connectionType: 'none',
    });
  };

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(status: NetworkStatus): void {
    // Only notify if status actually changed
    if (
      this.lastStatus &&
      this.lastStatus.connected === status.connected &&
      this.lastStatus.connectionType === status.connectionType
    ) {
      return;
    }

    this.lastStatus = status;

    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        logger.error('Listener error', error);
      }
    }
  }

  /**
   * Check if currently online
   */
  async isOnline(): Promise<boolean> {
    if (isNative()) {
      const status = await Network.getStatus();
      return status.connected;
    } else {
      // Use Navigator API on web
      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        return navigator.onLine;
      }
      // Assume online if Navigator API not available (SSR)
      return true;
    }
  }

  /**
   * Get current network status
   */
  async getStatus(): Promise<NetworkStatus> {
    if (isNative()) {
      const status = await Network.getStatus();
      return this.mapNativeStatus(status);
    } else {
      // Use Navigator API on web
      const connected = typeof navigator !== 'undefined' && 'onLine' in navigator
        ? navigator.onLine
        : true;

      return {
        connected,
        connectionType: connected ? 'unknown' : 'none',
      };
    }
  }

  /**
   * Add a network status change listener
   * Returns a cleanup function to remove the listener
   */
  addListener(callback: NetworkStatusListener): () => void {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Remove all listeners and cleanup
   */
  destroy(): void {
    if (this.nativeUnsubscribe) {
      this.nativeUnsubscribe();
      this.nativeUnsubscribe = null;
    }

    if (!isNative()) {
      window.removeEventListener('online', this.handleWebOnline);
      window.removeEventListener('offline', this.handleWebOffline);
    }

    this.listeners.clear();
  }
}

/**
 * Singleton instance
 */
let monitorInstance: NetworkMonitor | null = null;

/**
 * Get the network monitor instance
 */
export function getNetworkMonitor(): NetworkMonitor {
  if (!monitorInstance) {
    monitorInstance = new NetworkMonitor();
  }
  return monitorInstance;
}

/**
 * Check if currently online (convenience function)
 */
export async function isOnline(): Promise<boolean> {
  const monitor = getNetworkMonitor();
  return monitor.isOnline();
}

/**
 * Get current network status (convenience function)
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const monitor = getNetworkMonitor();
  return monitor.getStatus();
}
