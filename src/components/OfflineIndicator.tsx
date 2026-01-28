import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, Wifi, RefreshCw, Fish, Leaf, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

type AppContext = 'godaisy' | 'findr' | 'growdaisy';

/**
 * Offline Indicator Component
 *
 * Features:
 * - Shows banner when user goes offline
 * - Shows "reconnecting" banner when back online
 * - Smooth animations
 * - App-aware messaging (Findr, Grow Daisy, Go Daisy)
 * - Non-intrusive (auto-hides when online)
 *
 * Usage:
 * ```tsx
 * // In _app.tsx or main layout
 * <OfflineIndicator />
 * ```
 */
export const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [appContext, setAppContext] = useState<AppContext>('godaisy');

  // Detect app context from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectApp = () => {
      const path = window.location.pathname;
      const hostname = window.location.hostname;

      if (path.startsWith('/findr') || hostname.includes('fishfindr')) {
        setAppContext('findr');
      } else if (path.startsWith('/grow') || hostname.includes('growdaisy')) {
        setAppContext('growdaisy');
      } else {
        setAppContext('godaisy');
      }
    };

    detectApp();
    // Re-detect on navigation
    window.addEventListener('popstate', detectApp);
    return () => window.removeEventListener('popstate', detectApp);
  }, []);

  const getOfflineMessage = () => {
    switch (appContext) {
      case 'findr':
        return 'Cached predictions and favourites are still available';
      case 'growdaisy':
        return 'Your garden and saved tasks are still available';
      default:
        return 'Cached data and saved locations are still available';
    }
  };

  const getAppIcon = () => {
    switch (appContext) {
      case 'findr':
        return <Fish className="w-4 h-4" />;
      case 'growdaisy':
        return <Leaf className="w-4 h-4" />;
      default:
        return <Sun className="w-4 h-4" />;
    }
  };

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-warning text-warning-content shadow-lg"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="max-w-4xl mx-auto px-4 py-2.5">
            <div className="flex items-center justify-center gap-3">
              <WifiOff className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 text-center">
                <p className="font-semibold text-sm">You&apos;re Offline</p>
                <p className="text-xs opacity-90 flex items-center justify-center gap-1.5">
                  {getAppIcon()}
                  {getOfflineMessage()}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {isOnline && wasOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-success text-success-content shadow-lg"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="max-w-4xl mx-auto px-4 py-2.5">
            <div className="flex items-center justify-center gap-3">
              <Wifi className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 text-center">
                <p className="font-semibold text-sm flex items-center justify-center gap-2">
                  Back Online
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </p>
                <p className="text-xs opacity-90">
                  Syncing your data...
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
