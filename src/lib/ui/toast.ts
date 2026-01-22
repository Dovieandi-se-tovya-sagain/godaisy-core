/**
 * Toast Notification System
 *
 * Provides native-like toast notifications across platforms:
 * - iOS/Android: Uses Capacitor Toast plugin
 * - Web: Custom toast UI with animations
 *
 * Usage:
 *   import { showToast } from '@/lib/ui/toast';
 *
 *   showToast('Success!', 'success');
 *   showToast('Error occurred', 'error');
 *   showToast('Loading...', 'info');
 *   showToast('Warning!', 'warning');
 */

import { Capacitor } from '@capacitor/core';
import { Toast as CapacitorToast } from '@capacitor/toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Message to display */
  message: string;
  /** Type of toast (affects styling) */
  type?: ToastType;
  /** Duration in milliseconds (default: 3000) */
  duration?: number;
  /** Position on screen */
  position?: 'top' | 'center' | 'bottom';
}

// Web toast container element
let toastContainer: HTMLDivElement | null = null;

/**
 * Initialize the web toast container (called automatically)
 */
function initWebToastContainer(): void {
  if (toastContainer) return;

  toastContainer = document.createElement('div');
  toastContainer.id = 'web-toast-container';
  toastContainer.style.cssText = `
    position: fixed !important;
    top: 1rem !important;
    right: 0 !important;
    left: 0 !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 0.5rem !important;
    align-items: center !important;
    transform: translateZ(1000px) !important;
    will-change: transform !important;
    isolation: isolate !important;
    margin: 0 auto !important;
    width: 100% !important;
    max-width: 32rem !important;
    padding: 0 1rem !important;
  `;

  // Ensure it's the last child of body for maximum stacking priority
  if (document.body.lastChild) {
    document.body.appendChild(toastContainer);
  } else {
    document.body.appendChild(toastContainer);
  }
}

/**
 * Show a web toast notification
 */
function showWebToast(options: ToastOptions): void {
  initWebToastContainer();
  if (!toastContainer) return;

  const { message, type = 'info', duration = 3000 } = options;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'web-toast pointer-events-auto';

  // Type-specific styling
  const typeStyles: Record<ToastType, string> = {
    success: 'bg-success text-success-content',
    error: 'bg-error text-error-content',
    warning: 'bg-warning text-warning-content',
    info: 'bg-info text-info-content',
  };

  // Type-specific icons
  const typeIcons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.style.cssText = `
    position: relative !important;
    z-index: 2147483647 !important;
    transform: translateZ(999px) !important;
    will-change: transform !important;
  `;

  toast.innerHTML = `
    <div class="${typeStyles[type]} rounded-lg px-4 py-3 max-w-md flex items-center gap-2 animate-fade-in" style="position: relative; z-index: 2147483647; box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.1); backdrop-filter: blur(10px);">
      <span class="text-lg font-bold">${typeIcons[type]}</span>
      <span class="flex-1">${escapeHtml(message)}</span>
    </div>
  `;

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-1rem); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fade-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-1rem); }
    }
    .animate-fade-in { animation: fade-in 0.2s ease-out; }
    .animate-fade-out { animation: fade-out 0.2s ease-in; }
  `;
  if (!document.getElementById('toast-animations')) {
    style.id = 'toast-animations';
    document.head.appendChild(style);
  }

  // Add to container
  toastContainer.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    const toastContent = toast.querySelector('div');
    if (toastContent) {
      toastContent.classList.remove('animate-fade-in');
      toastContent.classList.add('animate-fade-out');
    }

    setTimeout(() => {
      if (toast.parentNode === toastContainer && toastContainer) {
        toastContainer.removeChild(toast);
      }
    }, 200);
  }, duration);
}

/**
 * Show a native toast notification (iOS/Android)
 */
async function showNativeToast(options: ToastOptions): Promise<void> {
  const { message, duration = 3000, position = 'bottom' } = options;

  try {
    await CapacitorToast.show({
      text: message,
      duration: duration < 2000 ? 'short' : 'long',
      position,
    });
  } catch (error) {
    console.error('[Toast] Native toast failed:', error);
    // Fallback to web toast
    showWebToast(options);
  }
}

/**
 * Show a toast notification (automatically detects platform)
 *
 * @param message - Message to display
 * @param type - Type of toast (success, error, warning, info)
 * @param duration - Duration in milliseconds (default: 3000)
 * @param position - Position on screen (default: bottom)
 */
export async function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 3000,
  position: 'top' | 'center' | 'bottom' = 'bottom'
): Promise<void> {
  const options: ToastOptions = { message, type, duration, position };

  if (Capacitor.isNativePlatform()) {
    await showNativeToast(options);
  } else {
    showWebToast(options);
  }
}

/**
 * Convenience methods for specific toast types
 */
export const toast = {
  success: (message: string, duration?: number) => showToast(message, 'success', duration),
  error: (message: string, duration?: number) => showToast(message, 'error', duration),
  warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
  info: (message: string, duration?: number) => showToast(message, 'info', duration),
};

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
