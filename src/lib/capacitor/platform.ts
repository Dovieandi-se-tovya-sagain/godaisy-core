 /**
   * Platform Detection Utility
   *
   * Provides type-safe platform detection for Capacitor native apps
   *
   * Features:
   * - Detects iOS, Android, or web platform
   * - Type-safe checks for native capabilities
   * - SSR-safe (returns 'web' during server-side rendering)
   *
   * Usage:
   * ```typescript
   * import { getPlatform, isNative, isIOS, isAndroid, isWeb } from './platform';
   *
   * if (isNative()) {
   *   // Use native API
   * } else {
   *   // Use web fallback
   * }
   *
   * const platform = getPlatform(); // 'ios' | 'android' | 'web'
   * ```
   */

  // Capacitor is imported dynamically to avoid SSR issues
  // The @capacitor/core package accesses window at module load time

  export type Platform = 'ios' | 'android' | 'web';

  // Helper to get Capacitor instance (lazy-loaded)
  const getCapacitor = () => {
    if (typeof window === 'undefined') return null;
    try {
      const { Capacitor } = require('@capacitor/core');
      return Capacitor;
    } catch {
      return null;
    }
  };

  /**
   * Get the current platform
   * Returns 'web' during SSR
   */
  export const getPlatform = (): Platform => {
    const Capacitor = getCapacitor();
    if (!Capacitor) return 'web';
    return Capacitor.getPlatform() as Platform;
  };

  /**
   * Check if running as native app (iOS or Android)
   */
  export const isNative = (): boolean => {
    const Capacitor = getCapacitor();
    if (!Capacitor) return false;
    return Capacitor.isNativePlatform();
  };

  /**
   * Check if running on iOS
   */
  export const isIOS = (): boolean => {
    return getPlatform() === 'ios';
  };

  /**
   * Check if running on Android
   */
  export const isAndroid = (): boolean => {
    return getPlatform() === 'android';
  };

  /**
   * Check if running in web browser (not native)
   */
  export const isWeb = (): boolean => {
    return getPlatform() === 'web';
  };

  /**
   * Check if a specific Capacitor plugin is available
   * Useful for progressive enhancement
   */
  export const isPluginAvailable = (pluginName: string): boolean => {
    const Capacitor = getCapacitor();
    if (!Capacitor) return false;
    try {
      return Capacitor.isPluginAvailable(pluginName);
    } catch {
      return false;
    }
  };

  /**
   * Get platform-specific configuration
   * Returns platform name and user agent for debugging
   */
  export const getPlatformInfo = () => {
    if (typeof window === 'undefined') {
      return {
        platform: 'web' as Platform,
        isNative: false,
        userAgent: 'server',
      };
    }

    return {
      platform: getPlatform(),
      isNative: isNative(),
      userAgent: navigator.userAgent,
    };
  };