/**
 * Image Cache Service
 *
 * Caches images locally using Capacitor Filesystem for offline access.
 * Falls back to URL on web platform.
 *
 * Usage:
 * ```typescript
 * import { imageCache } from './imageCache';
 *
 * // Get cached image URL (downloads if not cached)
 * const localUrl = await imageCache.getImageUrl(remoteUrl);
 *
 * // Preload images for offline use
 * await imageCache.preloadImages([url1, url2, url3]);
 * ```
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const CACHE_DIR = 'image_cache';
const INDEX_FILE = 'cache_index.json';
const MAX_CACHE_SIZE_MB = 100; // Max cache size in MB
const MAX_CACHE_AGE_DAYS = 30; // Max age of cached images

interface CacheEntry {
  url: string;
  localPath: string;
  cachedAt: number;
  size: number;
  lastAccessedAt: number;
}

interface CacheIndex {
  entries: Record<string, CacheEntry>;
  totalSize: number;
}

class ImageCacheService {
  private platform: string;
  private cacheIndex: CacheIndex | null = null;
  private initialized = false;
  private pendingDownloads: Map<string, Promise<string>> = new Map();

  constructor() {
    this.platform = Capacitor.getPlatform();
  }

  /**
   * Initialize the image cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Skip on web platform
    if (this.platform === 'web') {
      this.initialized = true;
      return;
    }

    try {
      // Ensure cache directory exists
      try {
        await Filesystem.mkdir({
          path: CACHE_DIR,
          directory: Directory.Cache,
          recursive: true,
        });
      } catch {
        // Directory may already exist
      }

      // Load cache index
      await this.loadIndex();

      // Cleanup old entries
      await this.cleanupOldEntries();

      this.initialized = true;
      console.log('[ImageCache] Initialized');
    } catch (error) {
      console.error('[ImageCache] Failed to initialize:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Get image URL (returns local URL if cached, downloads if not)
   */
  async getImageUrl(remoteUrl: string): Promise<string> {
    // On web, always use remote URL
    if (this.platform === 'web') {
      return remoteUrl;
    }

    await this.initialize();

    // Check if already cached
    const cached = this.cacheIndex?.entries[this.hashUrl(remoteUrl)];
    if (cached) {
      // Update last accessed
      cached.lastAccessedAt = Date.now();
      this.saveIndex();

      // Return local URL
      return this.getLocalUrl(cached.localPath);
    }

    // Check if already downloading
    const pending = this.pendingDownloads.get(remoteUrl);
    if (pending) {
      return pending;
    }

    // Download and cache
    const downloadPromise = this.downloadAndCache(remoteUrl);
    this.pendingDownloads.set(remoteUrl, downloadPromise);

    try {
      return await downloadPromise;
    } finally {
      this.pendingDownloads.delete(remoteUrl);
    }
  }

  /**
   * Preload multiple images for offline use
   */
  async preloadImages(urls: string[]): Promise<void> {
    if (this.platform === 'web') return;

    await this.initialize();

    const uncached = urls.filter((url) => {
      const hash = this.hashUrl(url);
      return !this.cacheIndex?.entries[hash];
    });

    console.log('[ImageCache] Preloading ' + uncached.length + ' images...');

    // Download in parallel (max 3 at a time)
    const batchSize = 3;
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      await Promise.allSettled(batch.map((url) => this.downloadAndCache(url)));
    }

    console.log('[ImageCache] Preload complete');
  }

  /**
   * Check if image is cached
   */
  isCached(remoteUrl: string): boolean {
    if (this.platform === 'web') return false;

    const hash = this.hashUrl(remoteUrl);
    return !!this.cacheIndex?.entries[hash];
  }

  /**
   * Clear all cached images
   */
  async clear(): Promise<void> {
    if (this.platform === 'web') return;

    try {
      await Filesystem.rmdir({
        path: CACHE_DIR,
        directory: Directory.Cache,
        recursive: true,
      });

      this.cacheIndex = { entries: {}, totalSize: 0 };

      await Filesystem.mkdir({
        path: CACHE_DIR,
        directory: Directory.Cache,
        recursive: true,
      });

      console.log('[ImageCache] Cache cleared');
    } catch (error) {
      console.error('[ImageCache] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { count: number; sizeBytes: number; sizeMB: number } {
    const count = Object.keys(this.cacheIndex?.entries || {}).length;
    const sizeBytes = this.cacheIndex?.totalSize || 0;
    return {
      count,
      sizeBytes,
      sizeMB: Math.round(sizeBytes / (1024 * 1024) * 100) / 100,
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async downloadAndCache(remoteUrl: string): Promise<string> {
    try {
      // Fetch image
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch: ' + response.status);
      }

      const blob = await response.blob();
      const size = blob.size;

      // Check if we need to free space
      await this.ensureSpace(size);

      // Convert blob to base64
      const base64 = await this.blobToBase64(blob);

      // Generate filename
      const hash = this.hashUrl(remoteUrl);
      const ext = this.getExtension(remoteUrl);
      const filename = hash + '.' + ext;
      const localPath = CACHE_DIR + '/' + filename;

      // Write to filesystem
      await Filesystem.writeFile({
        path: localPath,
        data: base64,
        directory: Directory.Cache,
      });

      // Update index
      if (!this.cacheIndex) {
        this.cacheIndex = { entries: {}, totalSize: 0 };
      }

      this.cacheIndex.entries[hash] = {
        url: remoteUrl,
        localPath,
        cachedAt: Date.now(),
        size,
        lastAccessedAt: Date.now(),
      };
      this.cacheIndex.totalSize += size;

      await this.saveIndex();

      return this.getLocalUrl(localPath);
    } catch (error) {
      console.warn('[ImageCache] Failed to cache ' + remoteUrl + ':', error);
      // Fall back to remote URL
      return remoteUrl;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const result = await Filesystem.readFile({
        path: CACHE_DIR + '/' + INDEX_FILE,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      this.cacheIndex = JSON.parse(result.data as string);
    } catch {
      // Index doesn't exist, create new
      this.cacheIndex = { entries: {}, totalSize: 0 };
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.cacheIndex) return;

    try {
      await Filesystem.writeFile({
        path: CACHE_DIR + '/' + INDEX_FILE,
        data: JSON.stringify(this.cacheIndex),
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
    } catch (error) {
      console.warn('[ImageCache] Failed to save index:', error);
    }
  }

  private async cleanupOldEntries(): Promise<void> {
    if (!this.cacheIndex) return;

    const now = Date.now();
    const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
    const toDelete: string[] = [];

    for (const [hash, entry] of Object.entries(this.cacheIndex.entries)) {
      if (now - entry.cachedAt > maxAge) {
        toDelete.push(hash);
      }
    }

    for (const hash of toDelete) {
      await this.deleteEntry(hash);
    }

    if (toDelete.length > 0) {
      console.log('[ImageCache] Cleaned up ' + toDelete.length + ' old entries');
    }
  }

  private async ensureSpace(neededBytes: number): Promise<void> {
    if (!this.cacheIndex) return;

    const maxBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

    while (this.cacheIndex.totalSize + neededBytes > maxBytes) {
      // Find oldest entry by last access
      let oldestHash: string | null = null;
      let oldestTime = Infinity;

      for (const [hash, entry] of Object.entries(this.cacheIndex.entries)) {
        if (entry.lastAccessedAt < oldestTime) {
          oldestTime = entry.lastAccessedAt;
          oldestHash = hash;
        }
      }

      if (!oldestHash) break;

      await this.deleteEntry(oldestHash);
    }
  }

  private async deleteEntry(hash: string): Promise<void> {
    if (!this.cacheIndex) return;

    const entry = this.cacheIndex.entries[hash];
    if (!entry) return;

    try {
      await Filesystem.deleteFile({
        path: entry.localPath,
        directory: Directory.Cache,
      });
    } catch {
      // File may not exist
    }

    this.cacheIndex.totalSize -= entry.size;
    delete this.cacheIndex.entries[hash];
  }

  private getLocalUrl(localPath: string): string {
    // Get the full native file URL
    if (this.platform === 'ios') {
      return Capacitor.convertFileSrc(
        'file://' + Filesystem.getUri({ path: localPath, directory: Directory.Cache })
      );
    }
    // For Android and other platforms
    return Capacitor.convertFileSrc(localPath);
  }

  private hashUrl(url: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getExtension(url: string): string {
    const match = url.match(/\.(\w+)(?:\?|$)/);
    return match ? match[1] : 'jpg';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Singleton instance
export const imageCache = new ImageCacheService();
