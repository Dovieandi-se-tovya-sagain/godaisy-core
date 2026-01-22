/**
 * IndexedDB Schema and Initialization
 *
 * Defines the database structure for offline storage of fishing predictions,
 * species data, images, and pending catch logs.
 *
 * Database: findr-offline
 * Version: 1
 *
 * Stores:
 * - predictions: Cached fishing predictions with rectangle code and date keys
 * - species: Species reference data (names, preferences, images)
 * - images: Cached species images as Blobs
 * - rectangles: ICES rectangle geometry and metadata
 * - catch-queue: Pending catch logs to sync when online
 * - favorites: Cached user favorite species
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('OfflineDB');

/**
 * Database schema interface
 */
export interface FindrOfflineDB extends DBSchema {
  // Cached fishing predictions
  predictions: {
    key: string; // Format: "rectangleCode|YYYY-MM-DD"
    value: {
      key: string; // keyPath - must be included in value
      rectangleCode: string;
      date: string;
      timestamp: number; // When cached
      data: unknown; // Full prediction response
    };
    indexes: {
      'by-rectangle': string;
      'by-date': string;
      'by-timestamp': number;
    };
  };

  // Species reference data
  species: {
    key: string; // Species slug
    value: {
      id: string;
      slug: string;
      name: string;
      nameScientific: string;
      guild: string;
      confidence?: number;
      localizedNames?: Record<string, string>;
      bio?: string;
      timestamp: number; // When cached
      data: unknown; // Full species data
    };
    indexes: {
      'by-guild': string;
      'by-timestamp': number;
    };
  };

  // Cached species images
  images: {
    key: string; // Species slug
    value: {
      slug: string;
      blob: Blob;
      mimeType: string;
      size: number;
      timestamp: number; // When cached
    };
    indexes: {
      'by-timestamp': number;
    };
  };

  // ICES rectangle reference data
  rectangles: {
    key: string; // Rectangle code (e.g., "31F1")
    value: {
      code: string;
      anchorLat: number;
      anchorLon: number;
      timestamp: number; // When cached
      data: unknown; // Full rectangle data
    };
    indexes: {
      'by-timestamp': number;
    };
  };

  // Pending catch logs (offline queue)
  'catch-queue': {
    key: string; // UUID
    value: {
      id: string;
      timestamp: number; // When created
      data: {
        speciesId: string;
        rectangleCode: string;
        date: string;
        bait?: string;
        habitat?: string;
        photos?: Blob[]; // Photo blobs
        metadata?: Record<string, unknown>;
      };
      retryCount: number;
    };
    indexes: {
      'by-timestamp': number;
    };
  };

  // Cached user favorites
  favorites: {
    key: string; // Species ID
    value: {
      speciesId: string;
      timestamp: number; // When cached
      data: unknown; // Full favorite data
    };
    indexes: {
      'by-timestamp': number;
    };
  };
}

/**
 * Database instance singleton
 */
let dbInstance: IDBPDatabase<FindrOfflineDB> | null = null;

/**
 * Initialize the IndexedDB database
 * Creates all object stores and indexes if they don't exist
 */
export async function initDB(): Promise<IDBPDatabase<FindrOfflineDB>> {
  // Return existing instance if already initialized
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB<FindrOfflineDB>('findr-offline', 1, {
      upgrade(db) {
        // Predictions store
        if (!db.objectStoreNames.contains('predictions')) {
          const predictionsStore = db.createObjectStore('predictions', { keyPath: 'key' });
          predictionsStore.createIndex('by-rectangle', 'rectangleCode');
          predictionsStore.createIndex('by-date', 'date');
          predictionsStore.createIndex('by-timestamp', 'timestamp');
        }

        // Species store
        if (!db.objectStoreNames.contains('species')) {
          const speciesStore = db.createObjectStore('species', { keyPath: 'slug' });
          speciesStore.createIndex('by-guild', 'guild');
          speciesStore.createIndex('by-timestamp', 'timestamp');
        }

        // Images store
        if (!db.objectStoreNames.contains('images')) {
          const imagesStore = db.createObjectStore('images', { keyPath: 'slug' });
          imagesStore.createIndex('by-timestamp', 'timestamp');
        }

        // Rectangles store
        if (!db.objectStoreNames.contains('rectangles')) {
          const rectanglesStore = db.createObjectStore('rectangles', { keyPath: 'code' });
          rectanglesStore.createIndex('by-timestamp', 'timestamp');
        }

        // Catch queue store
        if (!db.objectStoreNames.contains('catch-queue')) {
          const catchQueueStore = db.createObjectStore('catch-queue', { keyPath: 'id' });
          catchQueueStore.createIndex('by-timestamp', 'timestamp');
        }

        // Favorites store
        if (!db.objectStoreNames.contains('favorites')) {
          const favoritesStore = db.createObjectStore('favorites', { keyPath: 'speciesId' });
          favoritesStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });

    return dbInstance;
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw error;
  }
}

/**
 * Get the database instance
 * Initializes if not already initialized
 */
export async function getDB(): Promise<IDBPDatabase<FindrOfflineDB>> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Clear all data from the database (for testing/debugging)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const storeNames = [
    'predictions',
    'species',
    'images',
    'rectangles',
    'catch-queue',
    'favorites',
  ] as const;

  for (const storeName of storeNames) {
    await db.clear(storeName);
  }
}

/**
 * Get the total size of all stored data (approximate)
 */
export async function getDatabaseSize(): Promise<number> {
  const db = await getDB();
  let totalSize = 0;

  // Count predictions
  const predictions = await db.getAll('predictions');
  totalSize += predictions.reduce((sum, p) => sum + JSON.stringify(p).length, 0);

  // Count species
  const species = await db.getAll('species');
  totalSize += species.reduce((sum, s) => sum + JSON.stringify(s).length, 0);

  // Count images
  const images = await db.getAll('images');
  totalSize += images.reduce((sum, i) => sum + (i.size || 0), 0);

  // Count rectangles
  const rectangles = await db.getAll('rectangles');
  totalSize += rectangles.reduce((sum, r) => sum + JSON.stringify(r).length, 0);

  // Count catch queue
  const catchQueue = await db.getAll('catch-queue');
  totalSize += catchQueue.reduce((sum, c) => {
    let size = JSON.stringify(c).length;
    if (c.data.photos) {
      size += c.data.photos.reduce((photoSum, photo) => photoSum + photo.size, 0);
    }
    return sum + size;
  }, 0);

  // Count favorites
  const favorites = await db.getAll('favorites');
  totalSize += favorites.reduce((sum, f) => sum + JSON.stringify(f).length, 0);

  return totalSize;
}

/**
 * Clean up old data based on age
 * @param maxAgeMs - Maximum age in milliseconds (default: 7 days)
 */
export async function cleanupOldData(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const cutoffTime = Date.now() - maxAgeMs;

  // Clean old predictions
  const oldPredictions = await db.getAllFromIndex('predictions', 'by-timestamp');
  for (const prediction of oldPredictions) {
    if (prediction.timestamp < cutoffTime) {
      const key = `${prediction.rectangleCode}|${prediction.date}`;
      await db.delete('predictions', key);
    }
  }

  // Clean old images
  const oldImages = await db.getAllFromIndex('images', 'by-timestamp');
  for (const image of oldImages) {
    if (image.timestamp < cutoffTime) {
      await db.delete('images', image.slug);
    }
  }

  // Don't clean species, rectangles, or favorites - these are reference data
  // Don't clean catch queue - these need to be synced, not deleted
}
