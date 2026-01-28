/**
 * Offline Initialization Component
 *
 * Initializes offline storage and manages data cleanup for mobile app.
 * Should be mounted in _app.tsx when running as a mobile app.
 *
 * Features:
 * - Initializes IndexedDB on app start
 * - Runs daily cleanup of old data (7+ days old)
 * - Monitors storage usage
 * - Provides offline status indicator
 */

import { useEffect, useState } from 'react';
import { initDB, cleanupOldData, getDatabaseSize } from '../../lib/offline/db';
import { isNative } from '../../lib/capacitor/platform';
import { createLogger } from '../../lib/utils/logger';

const logger = createLogger('OfflineInit');

export function OfflineInit() {
  const [initialized, setInitialized] = useState(false);
  const [storageSize, setStorageSize] = useState<number | null>(null);

  useEffect(() => {
    // Only run in mobile app context
    if (!isNative()) {
      return;
    }

    let cleanupInterval: NodeJS.Timeout | null = null;

    async function initialize() {
      try {
        // Initialize IndexedDB
        logger.info('Initializing offline storage...');
        await initDB();

        // Run initial cleanup
        logger.info('Running initial data cleanup...');
        await cleanupOldData();

        // Get initial storage size
        const size = await getDatabaseSize();
        setStorageSize(size);
        logger.info(`Offline storage initialized (${(size / 1024).toFixed(2)} KB)`);

        setInitialized(true);

        // Schedule daily cleanup (every 24 hours)
        cleanupInterval = setInterval(
          async () => {
            logger.info('Running daily data cleanup...');
            try {
              await cleanupOldData();
              const newSize = await getDatabaseSize();
              setStorageSize(newSize);
              logger.info(`Cleanup complete (${(newSize / 1024).toFixed(2)} KB)`);
            } catch (error) {
              logger.error('Daily cleanup failed', error);
            }
          },
          24 * 60 * 60 * 1000
        ); // 24 hours
      } catch (error) {
        logger.error('Failed to initialize offline storage', error);
      }
    }

    initialize();

    // Cleanup on unmount
    return () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
    };
  }, []);

  // Only render in development to show status
  if (process.env.NODE_ENV !== 'development' || !isNative()) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-base-200 p-2 rounded-lg shadow-lg text-xs">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            initialized ? 'bg-success' : 'bg-warning animate-pulse'
          }`}
        />
        <span>
          {initialized
            ? `Offline: ${storageSize ? (storageSize / 1024).toFixed(1) + ' KB' : '...'}`
            : 'Initializing...'}
        </span>
      </div>
    </div>
  );
}
