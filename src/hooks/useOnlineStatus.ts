import { useEffect, useState } from 'react';

// Type for Capacitor window object (future-proof for native apps)
interface CapacitorWindow extends Window {
  Capacitor?: {
    Plugins: {
      Network?: {
        getStatus: () => Promise<{ connected: boolean }>;
        addListener: (
          event: string,
          callback: (status: { connected: boolean }) => void
        ) => { remove: () => void };
      };
    };
  };
}

/**
 * Hook to detect online/offline status
 *
 * Features:
 * - Detects network status changes
 * - Works in browser and native (via Capacitor Network plugin if available)
 * - Returns online status and was-offline flag for sync indicators
 *
 * Usage:
 * ```tsx
 * const { isOnline, wasOffline } = useOnlineStatus();
 *
 * if (!isOnline) {
 *   return <div>You're offline</div>
 * }
 *
 * if (wasOffline) {
 *   return <div>Back online! Syncing...</div>
 * }
 * ```
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  });

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Update online status immediately
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);

      // Clear "was offline" flag after 5 seconds
      setTimeout(() => {
        setWasOffline(false);
      }, 5000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen for network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for Capacitor Network plugin (for native apps)
    // This will be available once Capacitor is installed
    const capacitorWindow = window as CapacitorWindow;
    if (typeof window !== 'undefined' && capacitorWindow.Capacitor) {
      const { Network } = capacitorWindow.Capacitor.Plugins;

      if (Network) {
        // Get initial network status
        Network.getStatus().then((status: { connected: boolean }) => {
          setIsOnline(status.connected);
        });

        // Listen for network status changes
        const listener = Network.addListener(
          'networkStatusChange',
          (status: { connected: boolean }) => {
            if (status.connected) {
              handleOnline();
            } else {
              handleOffline();
            }
          }
        );

        return () => {
          listener.remove();
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
  };
};
