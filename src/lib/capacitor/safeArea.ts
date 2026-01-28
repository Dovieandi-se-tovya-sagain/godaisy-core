/**
 * Safe Area Plugin Integration
 *
 * Uses capacitor-plugin-safe-area to get actual pixel values for safe area insets.
 * This is more reliable than CSS env() variables in WebView contexts.
 *
 * The plugin sets CSS custom properties that can be used as fallbacks:
 * - --safe-area-inset-top
 * - --safe-area-inset-bottom
 * - --safe-area-inset-left
 * - --safe-area-inset-right
 */

import { isNative } from './platform';

let initialized = false;
let cleanupListener: (() => void) | null = null;

/**
 * Apply safe area insets as CSS custom properties
 */
function applyInsets(insets: { top: number; bottom: number; left: number; right: number }) {
  const root = document.documentElement;
  root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
  root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
  root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
  root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);

  console.log('[SafeArea] Applied insets:', insets);
}

/**
 * Initialize safe area handling
 *
 * On native platforms, uses capacitor-plugin-safe-area for accurate values.
 * On web, falls back to CSS env() variables (set as 0 so CSS env() takes over).
 */
export async function initSafeArea(): Promise<void> {
  if (initialized) {
    console.log('[SafeArea] Already initialized');
    return;
  }

  if (!isNative()) {
    // On web, set variables to 0 so CSS env() fallback is used
    console.log('[SafeArea] Web platform - using CSS env() fallback');
    applyInsets({ top: 0, bottom: 0, left: 0, right: 0 });
    initialized = true;
    return;
  }

  try {
    const { SafeArea } = await import('capacitor-plugin-safe-area');

    // Get initial insets
    const { insets } = await SafeArea.getSafeAreaInsets();
    applyInsets(insets);

    // Listen for changes (orientation, keyboard, etc.)
    const listener = await SafeArea.addListener('safeAreaChanged', (data) => {
      console.log('[SafeArea] Insets changed:', data.insets);
      applyInsets(data.insets);
    });

    cleanupListener = () => listener.remove();
    initialized = true;
    console.log('[SafeArea] Initialized successfully');
  } catch (error) {
    console.warn('[SafeArea] Failed to initialize plugin, using CSS env() fallback:', error);
    // Set to 0 so CSS env() fallback is used
    applyInsets({ top: 0, bottom: 0, left: 0, right: 0 });
    initialized = true;
  }
}

/**
 * Get current safe area insets
 */
export async function getSafeAreaInsets(): Promise<{ top: number; bottom: number; left: number; right: number }> {
  if (!isNative()) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  try {
    const { SafeArea } = await import('capacitor-plugin-safe-area');
    const { insets } = await SafeArea.getSafeAreaInsets();
    return insets;
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

/**
 * Cleanup safe area listener
 */
export function cleanupSafeArea(): void {
  if (cleanupListener) {
    cleanupListener();
    cleanupListener = null;
  }
  initialized = false;
}
