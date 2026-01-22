/**
 * Capacitor App Initialization
 *
 * Handles splash screen hiding, offline sync initialization, and
 * background fetch setup for native iOS/Android apps.
 */

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { initDeepLinkHandler } from './deepLinkHandler';

const isNative = Capacitor.isNativePlatform();

interface InitOptions {
  /** Minimum time to show splash (ms) */
  minSplashTime?: number;
  /** Whether to initialize Grow sync */
  initGrowSync?: boolean;
  /** Whether to initialize background sync */
  initBackgroundSync?: boolean;
  /** Whether to preload images */
  preloadImages?: boolean;
  /** Image URLs to preload */
  imageUrls?: string[];
}

/**
 * Initialize the app and hide splash screen when ready
 */
export async function initializeApp(options: InitOptions = {}): Promise<void> {
  const {
    minSplashTime = 500,
    initGrowSync = true,
    initBackgroundSync = true,
    preloadImages = false,
    imageUrls = [],
  } = options;

  const startTime = Date.now();

  try {
    console.log('[AppInit] Starting initialization...');

    // Initialize deep link handler first (synchronous, doesn't delay splash)
    if (isNative) {
      initDeepLinkHandler();
    }

    // Run initialization tasks in parallel
    const tasks: Promise<void>[] = [];

    // Initialize Grow Daisy sync if enabled
    if (initGrowSync && isNative) {
      tasks.push(initGrowDaisySync());
    }

    // Initialize background sync if enabled
    if (initBackgroundSync && isNative) {
      tasks.push(initBackgroundSyncService());
    }

    // Preload images if enabled
    if (preloadImages && imageUrls.length > 0 && isNative) {
      tasks.push(preloadImageCache(imageUrls));
    }

    // Wait for all tasks
    await Promise.allSettled(tasks);

    // Ensure minimum splash time for smooth UX
    const elapsed = Date.now() - startTime;
    const remaining = minSplashTime - elapsed;
    if (remaining > 0) {
      await delay(remaining);
    }

    console.log('[AppInit] Initialization complete in ' + (Date.now() - startTime) + 'ms');
  } catch (error) {
    console.error('[AppInit] Error during initialization:', error);
  } finally {
    // Always hide splash screen
    await hideSplashScreen();
  }
}

/**
 * Initialize Grow Daisy offline sync
 */
async function initGrowDaisySync(): Promise<void> {
  try {
    const { growOfflineSync } = await import('@/lib/offline/growSync');
    await growOfflineSync.initialize();
    console.log('[AppInit] Grow Daisy sync initialized');
  } catch (error) {
    console.warn('[AppInit] Failed to initialize Grow sync:', error);
  }
}

/**
 * Initialize background sync service
 */
async function initBackgroundSyncService(): Promise<void> {
  try {
    const { initGrowBackgroundSync } = await import('@/lib/capacitor/backgroundSync');
    await initGrowBackgroundSync();
    console.log('[AppInit] Background sync initialized');
  } catch (error) {
    console.warn('[AppInit] Failed to initialize background sync:', error);
  }
}

/**
 * Preload images into cache
 */
async function preloadImageCache(urls: string[]): Promise<void> {
  try {
    const { imageCache } = await import('@/lib/offline/imageCache');
    await imageCache.initialize();
    await imageCache.preloadImages(urls);
    console.log('[AppInit] Preloaded ' + urls.length + ' images');
  } catch (error) {
    console.warn('[AppInit] Failed to preload images:', error);
  }
}

/**
 * Hide the splash screen with a fade animation
 */
export async function hideSplashScreen(): Promise<void> {
  if (!isNative) return;

  try {
    await SplashScreen.hide({
      fadeOutDuration: 300,
    });
    console.log('[AppInit] Splash screen hidden');
  } catch (error) {
    console.warn('[AppInit] Failed to hide splash screen:', error);
  }
}

/**
 * Show the splash screen (useful for reloads/transitions)
 */
export async function showSplashScreen(): Promise<void> {
  if (!isNative) return;

  try {
    await SplashScreen.show({
      fadeInDuration: 200,
      autoHide: false,
    });
  } catch (error) {
    console.warn('[AppInit] Failed to show splash screen:', error);
  }
}

/**
 * Check if running on native platform
 */
export function isNativePlatform(): boolean {
  return isNative;
}

/**
 * Get current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

// Helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
