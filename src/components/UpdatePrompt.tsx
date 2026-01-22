/**
 * Update Prompt Component
 *
 * Displays a modal when a new app version is available.
 * Handles both optional and required updates.
 *
 * Usage in _app.tsx:
 *   import { UpdatePrompt } from '@/components/UpdatePrompt';
 *
 *   function MyApp({ Component, pageProps }: AppProps) {
 *     return (
 *       <>
 *         <UpdatePrompt />
 *         <Component {...pageProps} />
 *       </>
 *     );
 *   }
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Download, X } from 'lucide-react';
import {
  shouldShowUpdatePrompt,
  openAppStore,
  dismissUpdate,
  type UpdateInfo,
} from '@/lib/app-update/checker';

export function UpdatePrompt() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    async function checkUpdate() {
      const { show, updateInfo: info } = await shouldShowUpdatePrompt();
      if (show && info) {
        setUpdateInfo(info);
        setIsVisible(true);
      }
    }

    checkUpdate();

    // Also check periodically (every 6 hours)
    const intervalId = setInterval(checkUpdate, 6 * 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await openAppStore();
    } catch (error) {
      console.error('[UpdatePrompt] Failed to open app store:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    if (!updateInfo) return;

    // Don't allow dismissing required updates
    if (updateInfo.required) {
      return;
    }

    dismissUpdate(updateInfo.version);
    setIsVisible(false);
  };

  // Don't render if not visible or no update info
  if (!isVisible || !updateInfo) {
    return null;
  }

  const { version, required, releaseNotes } = updateInfo;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-base-100 rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
        {/* Close button (only for optional updates) */}
        {!required && (
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 btn btn-ghost btn-sm btn-circle"
            aria-label="Dismiss update"
          >
            <X size={20} />
          </button>
        )}

        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            {required ? (
              <AlertCircle className="text-primary" size={32} />
            ) : (
              <Download className="text-primary" size={32} />
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2">
          {required ? 'Update Required' : 'Update Available'}
        </h2>

        {/* Version */}
        <p className="text-center text-base-content/70 mb-4">
          Version {version} is now available
        </p>

        {/* Release notes */}
        {releaseNotes && (
          <div className="bg-base-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">What&apos;s New:</h3>
            <p className="text-sm text-base-content/80 whitespace-pre-line">
              {releaseNotes}
            </p>
          </div>
        )}

        {/* Required update message */}
        {required && (
          <div className="alert alert-warning mb-4">
            <AlertCircle size={20} />
            <span className="text-sm">
              This update is required to continue using the app.
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {!required && (
            <button
              onClick={handleDismiss}
              className="btn btn-ghost flex-1"
              disabled={isUpdating}
            >
              Later
            </button>
          )}
          <button
            onClick={handleUpdate}
            className={`btn btn-primary flex-1 ${isUpdating ? 'loading' : ''}`}
            disabled={isUpdating}
          >
            {isUpdating ? 'Opening...' : 'Update Now'}
          </button>
        </div>

        {/* Info text */}
        <p className="text-xs text-center text-base-content/50 mt-4">
          {required
            ? 'You must update to continue'
            : 'You can update now or later from Settings'}
        </p>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
