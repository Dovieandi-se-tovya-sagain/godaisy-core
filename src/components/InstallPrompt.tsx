import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { X, Download, Share } from 'lucide-react';
import { useState } from 'react';

/**
 * PWA Install Prompt Component
 *
 * Features:
 * - Shows custom install banner for Android/Desktop (Chrome/Edge)
 * - Shows iOS-specific instructions for Safari users
 * - Dismissible (won't show again for 7 days)
 * - Non-intrusive design (banner at bottom)
 * - Integrates with existing DaisyUI theme
 *
 * Usage:
 * ```tsx
 * // In _app.tsx or main layout
 * <InstallPrompt />
 * ```
 */
export const InstallPrompt = () => {
  const { showPrompt, installApp, dismissPrompt, platform } = useInstallPrompt();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  if (!showPrompt) return null;

  // iOS Safari - Show custom instructions
  if (platform.isIOS && platform.isSafari) {
    return (
      <>
        {/* Main Banner */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300 shadow-lg safe-bottom">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Install Findr App</h3>
                  <p className="text-xs text-base-content/70">
                    Add to home screen for a better experience
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowIOSInstructions(true)}
                  className="btn btn-primary btn-sm"
                >
                  How to Install
                </button>
                <button
                  onClick={dismissPrompt}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* iOS Instructions Modal */}
        {showIOSInstructions && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Install Findr on iOS</h2>
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-content rounded-full flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-base-content/70">
                      Look for the <Share className="inline w-4 h-4 mx-1" /> icon in Safari&apos;s toolbar (bottom of screen)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-content rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Select &ldquo;Add to Home Screen&rdquo;</p>
                    <p className="text-sm text-base-content/70">
                      Scroll down in the share menu to find this option
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-content rounded-full flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Tap &ldquo;Add&rdquo;</p>
                    <p className="text-sm text-base-content/70">
                      Findr will appear on your home screen like a native app!
                    </p>
                  </div>
                </div>

                <div className="bg-info/10 border border-info/20 rounded-lg p-3 mt-4">
                  <p className="text-sm text-info-content">
                    <strong>Tip:</strong> Once installed, Findr works offline and loads faster!
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowIOSInstructions(false);
                    dismissPrompt();
                  }}
                  className="btn btn-block btn-primary"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Chrome/Edge on Android/Desktop - Native install prompt
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300 shadow-lg safe-bottom">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Install Findr App</h3>
              <p className="text-xs text-base-content/70">
                Quick access, offline mode, and faster loading
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={installApp}
              className="btn btn-primary btn-sm"
            >
              Install
            </button>
            <button
              onClick={dismissPrompt}
              className="btn btn-ghost btn-sm btn-circle"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
