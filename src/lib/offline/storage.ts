/**
 * Offline Storage Service
 *
 * High-level API for storing and retrieving fishing predictions, species data,
 * images, and catch logs in IndexedDB.
 *
 * Usage:
 * ```typescript
 * import { OfflineStorage } from '@/lib/offline/storage';
 *
 * const storage = new OfflineStorage();
 *
 * // Cache a prediction
 * await storage.cachePrediction({
 *   rectangleCode: '31F1',
 *   date: '2025-01-06',
 *   data: predictionResponse,
 * });
 *
 * // Retrieve cached prediction
 * const cached = await storage.getPrediction('31F1', '2025-01-06');
 * if (cached) {
 *   console.log('Data age:', Date.now() - cached.timestamp);
 *   console.log('Prediction:', cached.data);
 * }
 * ```
 */

import { getDB } from './db';

/**
 * Data freshness levels based on age
 */
export type FreshnessLevel = 'fresh' | 'recent' | 'stale' | 'very-stale';

/**
 * Cached prediction with metadata
 */
export interface CachedPrediction {
  rectangleCode: string;
  date: string;
  timestamp: number;
  data: unknown;
  freshness?: FreshnessLevel;
}

/**
 * Cached species with metadata
 */
export interface CachedSpecies {
  id: string;
  slug: string;
  name: string;
  nameScientific: string;
  guild: string;
  confidence?: number;
  localizedNames?: Record<string, string>;
  bio?: string;
  timestamp: number;
  data: unknown;
}

/**
 * Pending catch log for sync queue
 */
export interface PendingCatchLog {
  id: string;
  timestamp: number;
  data: {
    speciesId: string;
    rectangleCode: string;
    date: string;
    bait?: string;
    habitat?: string;
    photos?: Blob[];
    metadata?: Record<string, unknown>;
  };
  retryCount: number;
}

/**
 * Offline Storage Service
 */
export class OfflineStorage {
  /**
   * Calculate data freshness level based on age
   */
  private getFreshness(timestamp: number): FreshnessLevel {
    const ageMs = Date.now() - timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);

    if (ageHours < 3) return 'fresh';
    if (ageHours < 12) return 'recent';
    if (ageHours < 24) return 'stale';
    return 'very-stale';
  }

  /**
   * Cache a fishing prediction
   */
  async cachePrediction(prediction: {
    rectangleCode: string;
    date: string;
    data: unknown;
  }): Promise<void> {
    const db = await getDB();
    const key = `${prediction.rectangleCode}|${prediction.date}`;

    await db.put('predictions', {
      key,
      rectangleCode: prediction.rectangleCode,
      date: prediction.date,
      timestamp: Date.now(),
      data: prediction.data,
    });
  }

  /**
   * Retrieve a cached prediction
   */
  async getPrediction(
    rectangleCode: string,
    date: string
  ): Promise<CachedPrediction | null> {
    const db = await getDB();
    const key = `${rectangleCode}|${date}`;

    const cached = await db.get('predictions', key);
    if (!cached) return null;

    return {
      ...cached,
      freshness: this.getFreshness(cached.timestamp),
    };
  }

  /**
   * Get all predictions for a rectangle (any date)
   */
  async getPredictionsForRectangle(rectangleCode: string): Promise<CachedPrediction[]> {
    const db = await getDB();
    const predictions = await db.getAllFromIndex('predictions', 'by-rectangle', rectangleCode);

    return predictions.map((p) => ({
      ...p,
      freshness: this.getFreshness(p.timestamp),
    }));
  }

  /**
   * Get all predictions for a date (any rectangle)
   */
  async getPredictionsForDate(date: string): Promise<CachedPrediction[]> {
    const db = await getDB();
    const predictions = await db.getAllFromIndex('predictions', 'by-date', date);

    return predictions.map((p) => ({
      ...p,
      freshness: this.getFreshness(p.timestamp),
    }));
  }

  /**
   * Delete a cached prediction
   */
  async deletePrediction(rectangleCode: string, date: string): Promise<void> {
    const db = await getDB();
    const key = `${rectangleCode}|${date}`;
    await db.delete('predictions', key);
  }

  /**
   * Cache species data
   */
  async cacheSpecies(speciesList: CachedSpecies[]): Promise<void> {
    const db = await getDB();

    for (const species of speciesList) {
      await db.put('species', {
        ...species,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get a single species by slug
   */
  async getSpecies(slug: string): Promise<CachedSpecies | null> {
    const db = await getDB();
    return (await db.get('species', slug)) || null;
  }

  /**
   * Get all cached species
   */
  async getAllSpecies(): Promise<CachedSpecies[]> {
    const db = await getDB();
    return db.getAll('species');
  }

  /**
   * Get species by guild
   */
  async getSpeciesByGuild(guild: string): Promise<CachedSpecies[]> {
    const db = await getDB();
    return db.getAllFromIndex('species', 'by-guild', guild);
  }

  /**
   * Cache a species image
   */
  async cacheImage(slug: string, blob: Blob, mimeType: string): Promise<void> {
    const db = await getDB();

    await db.put('images', {
      slug,
      blob,
      mimeType,
      size: blob.size,
      timestamp: Date.now(),
    });
  }

  /**
   * Get a cached species image
   */
  async getImage(slug: string): Promise<Blob | null> {
    const db = await getDB();
    const image = await db.get('images', slug);
    return image?.blob || null;
  }

  /**
   * Check if an image is cached
   */
  async hasImage(slug: string): Promise<boolean> {
    const db = await getDB();
    const image = await db.get('images', slug);
    return !!image;
  }

  /**
   * Cache rectangle data
   */
  async cacheRectangle(rectangle: {
    code: string;
    anchorLat: number;
    anchorLon: number;
    data: unknown;
  }): Promise<void> {
    const db = await getDB();

    await db.put('rectangles', {
      ...rectangle,
      timestamp: Date.now(),
    });
  }

  /**
   * Get a cached rectangle
   */
  async getRectangle(code: string): Promise<{
    code: string;
    anchorLat: number;
    anchorLon: number;
    data: unknown;
  } | null> {
    const db = await getDB();
    return (await db.get('rectangles', code)) || null;
  }

  /**
   * Get all cached rectangles
   */
  async getAllRectangles(): Promise<Array<{
    code: string;
    anchorLat: number;
    anchorLon: number;
    data: unknown;
  }>> {
    const db = await getDB();
    return db.getAll('rectangles');
  }

  /**
   * Add a catch log to the sync queue
   */
  async queueCatchLog(log: Omit<PendingCatchLog, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const db = await getDB();
    const id = crypto.randomUUID();

    const pendingLog: PendingCatchLog = {
      id,
      timestamp: Date.now(),
      retryCount: 0,
      data: log.data,
    };

    await db.put('catch-queue', pendingLog);
    return id;
  }

  /**
   * Get all pending catch logs
   */
  async getPendingCatchLogs(): Promise<PendingCatchLog[]> {
    const db = await getDB();
    return db.getAll('catch-queue');
  }

  /**
   * Remove a catch log from the queue (after successful sync)
   */
  async removeCatchLog(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('catch-queue', id);
  }

  /**
   * Update retry count for a catch log
   */
  async updateCatchLogRetryCount(id: string): Promise<void> {
    const db = await getDB();
    const log = await db.get('catch-queue', id);
    if (log) {
      log.retryCount += 1;
      await db.put('catch-queue', log);
    }
  }

  /**
   * Cache user favorites
   */
  async cacheFavorites(favorites: Array<{ speciesId: string; data: unknown }>): Promise<void> {
    const db = await getDB();

    for (const favorite of favorites) {
      await db.put('favorites', {
        speciesId: favorite.speciesId,
        timestamp: Date.now(),
        data: favorite.data,
      });
    }
  }

  /**
   * Get all cached favorites
   */
  async getFavorites(): Promise<Array<{ speciesId: string; data: unknown }>> {
    const db = await getDB();
    return db.getAll('favorites');
  }

  /**
   * Add a favorite
   */
  async addFavorite(speciesId: string, data: unknown): Promise<void> {
    const db = await getDB();
    await db.put('favorites', {
      speciesId,
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Remove a favorite
   */
  async removeFavorite(speciesId: string): Promise<void> {
    const db = await getDB();
    await db.delete('favorites', speciesId);
  }

  /**
   * Check if a species is favorited
   */
  async isFavorited(speciesId: string): Promise<boolean> {
    const db = await getDB();
    const favorite = await db.get('favorites', speciesId);
    return !!favorite;
  }

  /**
   * Get total cache size (approximate)
   */
  async getCacheSize(): Promise<number> {
    const { getDatabaseSize } = await import('./db');
    return getDatabaseSize();
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    const { clearAllData } = await import('./db');
    await clearAllData();
  }
}

/**
 * Singleton instance
 */
let storageInstance: OfflineStorage | null = null;

/**
 * Get the storage service instance
 */
export function getStorage(): OfflineStorage {
  if (!storageInstance) {
    storageInstance = new OfflineStorage();
  }
  return storageInstance;
}
