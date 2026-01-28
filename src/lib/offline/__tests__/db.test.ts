/**
 * Tests for IndexedDB initialization and management
 *
 * Tests database creation, store initialization, data cleanup,
 * and error handling for the offline storage system.
 */

import { openDB, IDBPDatabase, deleteDB } from 'idb';
import {
  initDB,
  getDB,
  closeDB,
  clearAllData,
  getDatabaseSize,
  cleanupOldData,
  FindrOfflineDB,
} from '../db';

// Mock the idb library
jest.mock('idb', () => ({
  openDB: jest.fn(),
  deleteDB: jest.fn(),
}));

const mockOpenDB = openDB as jest.MockedFunction<typeof openDB>;
const mockDeleteDB = deleteDB as jest.MockedFunction<typeof deleteDB>;

describe('lib/offline/db', () => {
  let mockDB: jest.Mocked<IDBPDatabase<FindrOfflineDB>>;

  beforeEach(() => {
    // Reset module state between tests
    jest.resetModules();
    jest.clearAllMocks();

    // Create mock database instance
    mockDB = {
      close: jest.fn(),
      clear: jest.fn(),
      getAll: jest.fn(),
      getAllFromIndex: jest.fn(),
      delete: jest.fn(),
      objectStoreNames: {
        contains: jest.fn(),
      } as any,
    } as any;

    mockOpenDB.mockResolvedValue(mockDB);
  });

  afterEach(async () => {
    // Clean up after each test
    await closeDB();
  });

  describe('initDB', () => {
    it('should initialize database with correct name and version', async () => {
      await initDB();

      expect(mockOpenDB).toHaveBeenCalledWith(
        'findr-offline',
        1,
        expect.any(Object)
      );
    });

    it('should create all required object stores on first init', async () => {
      const mockCreateObjectStore = jest.fn().mockReturnValue({
        createIndex: jest.fn(),
      });

      const upgradeDB = {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(false),
        },
        createObjectStore: mockCreateObjectStore,
      };

      mockOpenDB.mockImplementation(async (name, version, options) => {
        if (options?.upgrade) {
          options.upgrade(upgradeDB as any, 0, 1, null as any);
        }
        return mockDB;
      });

      await initDB();

      // Verify all 6 stores are created
      expect(mockCreateObjectStore).toHaveBeenCalledWith('predictions', {
        keyPath: 'key',
      });
      expect(mockCreateObjectStore).toHaveBeenCalledWith('species', {
        keyPath: 'slug',
      });
      expect(mockCreateObjectStore).toHaveBeenCalledWith('images', {
        keyPath: 'slug',
      });
      expect(mockCreateObjectStore).toHaveBeenCalledWith('rectangles', {
        keyPath: 'code',
      });
      expect(mockCreateObjectStore).toHaveBeenCalledWith('catch-queue', {
        keyPath: 'id',
      });
      expect(mockCreateObjectStore).toHaveBeenCalledWith('favorites', {
        keyPath: 'speciesId',
      });
    });

    it('should create indexes for predictions store', async () => {
      const mockCreateIndex = jest.fn();
      const mockCreateObjectStore = jest.fn().mockReturnValue({
        createIndex: mockCreateIndex,
      });

      const upgradeDB = {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(false),
        },
        createObjectStore: mockCreateObjectStore,
      };

      mockOpenDB.mockImplementation(async (name, version, options) => {
        if (options?.upgrade) {
          options.upgrade(upgradeDB as any, 0, 1, null as any);
        }
        return mockDB;
      });

      await initDB();

      // Verify predictions indexes
      expect(mockCreateIndex).toHaveBeenCalledWith('by-rectangle', 'rectangleCode');
      expect(mockCreateIndex).toHaveBeenCalledWith('by-date', 'date');
      expect(mockCreateIndex).toHaveBeenCalledWith('by-timestamp', 'timestamp');
    });

    it('should return existing instance if already initialized', async () => {
      const db1 = await initDB();
      const db2 = await initDB();

      expect(db1).toBe(db2);
      expect(mockOpenDB).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database initialization failed');
      mockOpenDB.mockRejectedValue(error);

      await expect(initDB()).rejects.toThrow('Database initialization failed');
    });

    it('should skip creating stores that already exist', async () => {
      const mockCreateObjectStore = jest.fn();

      const upgradeDB = {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(true), // All stores exist
        },
        createObjectStore: mockCreateObjectStore,
      };

      mockOpenDB.mockImplementation(async (name, version, options) => {
        if (options?.upgrade) {
          options.upgrade(upgradeDB as any, 0, 1, null as any);
        }
        return mockDB;
      });

      await initDB();

      expect(mockCreateObjectStore).not.toHaveBeenCalled();
    });
  });

  describe('getDB', () => {
    it('should return existing database instance', async () => {
      await initDB();
      const db = await getDB();

      expect(db).toBe(mockDB);
      expect(mockOpenDB).toHaveBeenCalledTimes(1);
    });

    it('should initialize database if not already initialized', async () => {
      const db = await getDB();

      expect(db).toBe(mockDB);
      expect(mockOpenDB).toHaveBeenCalled();
    });
  });

  describe('closeDB', () => {
    it('should close database connection', async () => {
      await initDB();
      await closeDB();

      expect(mockDB.close).toHaveBeenCalled();
    });

    it('should reset database instance after closing', async () => {
      await initDB();
      await closeDB();

      // Next getDB should reinitialize
      await getDB();
      expect(mockOpenDB).toHaveBeenCalledTimes(2);
    });

    it('should handle closing when not initialized', async () => {
      await expect(closeDB()).resolves.not.toThrow();
    });
  });

  describe('clearAllData', () => {
    it('should clear all object stores', async () => {
      mockDB.clear.mockResolvedValue(undefined);

      await clearAllData();

      expect(mockDB.clear).toHaveBeenCalledWith('predictions');
      expect(mockDB.clear).toHaveBeenCalledWith('species');
      expect(mockDB.clear).toHaveBeenCalledWith('images');
      expect(mockDB.clear).toHaveBeenCalledWith('rectangles');
      expect(mockDB.clear).toHaveBeenCalledWith('catch-queue');
      expect(mockDB.clear).toHaveBeenCalledWith('favorites');
      expect(mockDB.clear).toHaveBeenCalledTimes(6);
    });

    it('should initialize database if not already initialized', async () => {
      mockDB.clear.mockResolvedValue(undefined);

      await clearAllData();

      expect(mockOpenDB).toHaveBeenCalled();
    });
  });

  describe('getDatabaseSize', () => {
    it('should calculate total size of all data', async () => {
      const mockPredictions = [
        {
          key: '31F1|2025-01-01',
          rectangleCode: '31F1',
          date: '2025-01-01',
          timestamp: Date.now(),
          data: { species: ['cod', 'haddock'] },
        },
      ];

      const mockSpecies = [
        {
          id: 'cod',
          slug: 'cod',
          name: 'Cod',
          nameScientific: 'Gadus morhua',
          guild: 'pelagic',
          timestamp: Date.now(),
          data: {},
        },
      ];

      const mockImages = [
        {
          slug: 'cod',
          blob: new Blob(['fake image data']),
          mimeType: 'image/jpeg',
          size: 1024,
          timestamp: Date.now(),
        },
      ];

      const mockRectangles = [
        {
          code: '31F1',
          anchorLat: 51.5,
          anchorLon: -5.0,
          timestamp: Date.now(),
          data: {},
        },
      ];

      const mockCatchQueue = [
        {
          id: 'catch-123',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-01',
            photos: [new Blob(['photo1'], { type: 'image/jpeg' })],
          },
          retryCount: 0,
        },
      ];

      const mockFavorites = [
        {
          speciesId: 'cod',
          timestamp: Date.now(),
          data: {},
        },
      ];

      mockDB.getAll.mockImplementation((storeName: string) => {
        switch (storeName) {
          case 'predictions':
            return Promise.resolve(mockPredictions as any);
          case 'species':
            return Promise.resolve(mockSpecies as any);
          case 'images':
            return Promise.resolve(mockImages as any);
          case 'rectangles':
            return Promise.resolve(mockRectangles as any);
          case 'catch-queue':
            return Promise.resolve(mockCatchQueue as any);
          case 'favorites':
            return Promise.resolve(mockFavorites as any);
          default:
            return Promise.resolve([]);
        }
      });

      const size = await getDatabaseSize();

      expect(size).toBeGreaterThan(0);
      expect(mockDB.getAll).toHaveBeenCalledWith('predictions');
      expect(mockDB.getAll).toHaveBeenCalledWith('species');
      expect(mockDB.getAll).toHaveBeenCalledWith('images');
      expect(mockDB.getAll).toHaveBeenCalledWith('rectangles');
      expect(mockDB.getAll).toHaveBeenCalledWith('catch-queue');
      expect(mockDB.getAll).toHaveBeenCalledWith('favorites');
    });

    it('should include photo blob sizes in catch queue', async () => {
      const photoBlobSize = 5000;
      const mockCatchQueue = [
        {
          id: 'catch-123',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-01',
            photos: [
              { size: photoBlobSize } as Blob,
              { size: photoBlobSize } as Blob,
            ],
          },
          retryCount: 0,
        },
      ];

      mockDB.getAll.mockImplementation((storeName: string) => {
        if (storeName === 'catch-queue') {
          return Promise.resolve(mockCatchQueue as any);
        }
        return Promise.resolve([]);
      });

      const size = await getDatabaseSize();

      // Should include both photo sizes
      expect(size).toBeGreaterThanOrEqual(photoBlobSize * 2);
    });

    it('should return 0 for empty database', async () => {
      mockDB.getAll.mockResolvedValue([]);

      const size = await getDatabaseSize();

      expect(size).toBe(0);
    });
  });

  describe('cleanupOldData', () => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

    it('should delete predictions older than max age', async () => {
      const oldPrediction = {
        key: '31F1|2025-01-01',
        rectangleCode: '31F1',
        date: '2025-01-01',
        timestamp: eightDaysAgo,
        data: {},
      };

      const recentPrediction = {
        key: '31F2|2025-01-08',
        rectangleCode: '31F2',
        date: '2025-01-08',
        timestamp: now - 1000,
        data: {},
      };

      mockDB.getAllFromIndex.mockImplementation((storeName, indexName) => {
        if (storeName === 'predictions' && indexName === 'by-timestamp') {
          return Promise.resolve([oldPrediction, recentPrediction] as any);
        }
        return Promise.resolve([]);
      });

      await cleanupOldData();

      expect(mockDB.delete).toHaveBeenCalledWith('predictions', '31F1|2025-01-01');
      expect(mockDB.delete).not.toHaveBeenCalledWith('predictions', '31F2|2025-01-08');
    });

    it('should delete images older than max age', async () => {
      const oldImage = {
        slug: 'old-species',
        timestamp: eightDaysAgo,
        blob: new Blob(),
        mimeType: 'image/jpeg',
        size: 1024,
      };

      const recentImage = {
        slug: 'recent-species',
        timestamp: now - 1000,
        blob: new Blob(),
        mimeType: 'image/jpeg',
        size: 1024,
      };

      mockDB.getAllFromIndex.mockImplementation((storeName, indexName) => {
        if (storeName === 'images' && indexName === 'by-timestamp') {
          return Promise.resolve([oldImage, recentImage] as any);
        }
        return Promise.resolve([]);
      });

      await cleanupOldData();

      expect(mockDB.delete).toHaveBeenCalledWith('images', 'old-species');
      expect(mockDB.delete).not.toHaveBeenCalledWith('images', 'recent-species');
    });

    it('should not delete species, rectangles, or favorites', async () => {
      mockDB.getAllFromIndex.mockResolvedValue([]);

      await cleanupOldData();

      // Should only query predictions and images
      expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('predictions', 'by-timestamp');
      expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('images', 'by-timestamp');
      expect(mockDB.getAllFromIndex).not.toHaveBeenCalledWith('species', expect.anything());
      expect(mockDB.getAllFromIndex).not.toHaveBeenCalledWith('rectangles', expect.anything());
      expect(mockDB.getAllFromIndex).not.toHaveBeenCalledWith('favorites', expect.anything());
    });

    it('should not delete catch queue entries', async () => {
      mockDB.getAllFromIndex.mockResolvedValue([]);

      await cleanupOldData();

      expect(mockDB.getAllFromIndex).not.toHaveBeenCalledWith('catch-queue', expect.anything());
    });

    it('should use custom max age parameter', async () => {
      const customMaxAge = 24 * 60 * 60 * 1000; // 1 day
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

      const prediction = {
        key: '31F1|2025-01-04',
        rectangleCode: '31F1',
        date: '2025-01-04',
        timestamp: twoDaysAgo,
        data: {},
      };

      mockDB.getAllFromIndex.mockImplementation((storeName, indexName) => {
        if (storeName === 'predictions' && indexName === 'by-timestamp') {
          return Promise.resolve([prediction] as any);
        }
        return Promise.resolve([]);
      });

      await cleanupOldData(customMaxAge);

      // Should delete because it's older than 1 day
      expect(mockDB.delete).toHaveBeenCalledWith('predictions', '31F1|2025-01-04');
    });

    it('should handle empty stores gracefully', async () => {
      mockDB.getAllFromIndex.mockResolvedValue([]);

      await expect(cleanupOldData()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle database quota exceeded errors', async () => {
      const quotaError = new Error('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';
      mockOpenDB.mockRejectedValue(quotaError);

      await expect(initDB()).rejects.toThrow('QuotaExceededError');
    });

    it('should handle database version conflicts', async () => {
      const versionError = new Error('VersionError');
      versionError.name = 'VersionError';
      mockOpenDB.mockRejectedValue(versionError);

      await expect(initDB()).rejects.toThrow('VersionError');
    });

    it('should handle IndexedDB not supported', async () => {
      const notSupportedError = new Error('IndexedDB not supported');
      mockOpenDB.mockRejectedValue(notSupportedError);

      await expect(initDB()).rejects.toThrow('IndexedDB not supported');
    });
  });

  describe('data integrity', () => {
    it('should maintain keyPath consistency for predictions', async () => {
      const mockCreateObjectStore = jest.fn().mockReturnValue({
        createIndex: jest.fn(),
      });

      const upgradeDB = {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(false),
        },
        createObjectStore: mockCreateObjectStore,
      };

      mockOpenDB.mockImplementation(async (name, version, options) => {
        if (options?.upgrade) {
          options.upgrade(upgradeDB as any, 0, 1, null as any);
        }
        return mockDB;
      });

      await initDB();

      // Predictions should use 'key' as keyPath
      expect(mockCreateObjectStore).toHaveBeenCalledWith('predictions', {
        keyPath: 'key',
      });
    });

    it('should maintain keyPath consistency for all stores', async () => {
      const mockCreateObjectStore = jest.fn().mockReturnValue({
        createIndex: jest.fn(),
      });

      const upgradeDB = {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(false),
        },
        createObjectStore: mockCreateObjectStore,
      };

      mockOpenDB.mockImplementation(async (name, version, options) => {
        if (options?.upgrade) {
          options.upgrade(upgradeDB as any, 0, 1, null as any);
        }
        return mockDB;
      });

      await initDB();

      // Verify keyPath for each store
      const calls = mockCreateObjectStore.mock.calls;
      const keyPaths: Record<string, string> = {};

      calls.forEach(([storeName, options]) => {
        keyPaths[storeName] = (options as any).keyPath;
      });

      expect(keyPaths).toEqual({
        predictions: 'key',
        species: 'slug',
        images: 'slug',
        rectangles: 'code',
        'catch-queue': 'id',
        favorites: 'speciesId',
      });
    });
  });
});
