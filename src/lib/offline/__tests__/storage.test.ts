/**
 * Tests for Offline Storage Service
 *
 * Tests CRUD operations for predictions, species, images, rectangles,
 * catch queue, and favorites with freshness tracking.
 */

import { IDBPDatabase } from 'idb';
import { OfflineStorage, getStorage, CachedPrediction, CachedSpecies, PendingCatchLog } from '../storage';
import { FindrOfflineDB } from '../db';

// Mock the db module
jest.mock('../db', () => ({
  getDB: jest.fn(),
  getDatabaseSize: jest.fn(),
  clearAllData: jest.fn(),
}));

import { getDB, getDatabaseSize, clearAllData } from '../db';

const mockGetDB = getDB as jest.MockedFunction<typeof getDB>;
const mockGetDatabaseSize = getDatabaseSize as jest.MockedFunction<typeof getDatabaseSize>;
const mockClearAllData = clearAllData as jest.MockedFunction<typeof clearAllData>;

describe('lib/offline/storage', () => {
  let storage: OfflineStorage;
  let mockDB: jest.Mocked<IDBPDatabase<FindrOfflineDB>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create new storage instance for each test
    storage = new OfflineStorage();

    // Create mock database
    mockDB = {
      put: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      getAllFromIndex: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockGetDB.mockResolvedValue(mockDB);
  });

  describe('getStorage', () => {
    it('should return singleton instance', () => {
      const instance1 = getStorage();
      const instance2 = getStorage();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(OfflineStorage);
    });
  });

  describe('Predictions', () => {
    describe('cachePrediction', () => {
      it('should cache prediction with correct key format', async () => {
        const prediction = {
          rectangleCode: '31F1',
          date: '2025-01-06',
          data: { species: ['cod', 'haddock'] },
        };

        await storage.cachePrediction(prediction);

        expect(mockDB.put).toHaveBeenCalledWith('predictions', {
          key: '31F1|2025-01-06',
          rectangleCode: '31F1',
          date: '2025-01-06',
          timestamp: expect.any(Number),
          data: prediction.data,
        });
      });

      it('should use current timestamp when caching', async () => {
        const beforeTime = Date.now();

        await storage.cachePrediction({
          rectangleCode: '31F1',
          date: '2025-01-06',
          data: {},
        });

        const afterTime = Date.now();
        const cachedData = mockDB.put.mock.calls[0][1] as any;

        expect(cachedData.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(cachedData.timestamp).toBeLessThanOrEqual(afterTime);
      });
    });

    describe('getPrediction', () => {
      it('should retrieve cached prediction', async () => {
        const cachedData = {
          key: '31F1|2025-01-06',
          rectangleCode: '31F1',
          date: '2025-01-06',
          timestamp: Date.now(),
          data: { species: ['cod'] },
        };

        mockDB.get.mockResolvedValue(cachedData);

        const result = await storage.getPrediction('31F1', '2025-01-06');

        expect(mockDB.get).toHaveBeenCalledWith('predictions', '31F1|2025-01-06');
        expect(result).toMatchObject(cachedData);
        expect(result?.freshness).toBeDefined();
      });

      it('should return null for non-existent prediction', async () => {
        mockDB.get.mockResolvedValue(undefined);

        const result = await storage.getPrediction('31F1', '2025-01-06');

        expect(result).toBeNull();
      });

      it('should calculate freshness correctly for fresh data (<3h)', async () => {
        const cachedData = {
          key: '31F1|2025-01-06',
          rectangleCode: '31F1',
          date: '2025-01-06',
          timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
          data: {},
        };

        mockDB.get.mockResolvedValue(cachedData);

        const result = await storage.getPrediction('31F1', '2025-01-06');

        expect(result?.freshness).toBe('fresh');
      });

      it('should calculate freshness correctly for recent data (3-12h)', async () => {
        const cachedData = {
          key: '31F1|2025-01-06',
          rectangleCode: '31F1',
          date: '2025-01-06',
          timestamp: Date.now() - 6 * 60 * 60 * 1000, // 6 hours ago
          data: {},
        };

        mockDB.get.mockResolvedValue(cachedData);

        const result = await storage.getPrediction('31F1', '2025-01-06');

        expect(result?.freshness).toBe('recent');
      });

      it('should calculate freshness correctly for stale data (12-24h)', async () => {
        const cachedData = {
          key: '31F1|2025-01-06',
          rectangleCode: '31F1',
          date: '2025-01-06',
          timestamp: Date.now() - 18 * 60 * 60 * 1000, // 18 hours ago
          data: {},
        };

        mockDB.get.mockResolvedValue(cachedData);

        const result = await storage.getPrediction('31F1', '2025-01-06');

        expect(result?.freshness).toBe('stale');
      });

      it('should calculate freshness correctly for very-stale data (>24h)', async () => {
        const cachedData = {
          key: '31F1|2025-01-06',
          rectangleCode: '31F1',
          date: '2025-01-06',
          timestamp: Date.now() - 30 * 60 * 60 * 1000, // 30 hours ago
          data: {},
        };

        mockDB.get.mockResolvedValue(cachedData);

        const result = await storage.getPrediction('31F1', '2025-01-06');

        expect(result?.freshness).toBe('very-stale');
      });
    });

    describe('getPredictionsForRectangle', () => {
      it('should retrieve all predictions for a rectangle', async () => {
        const predictions = [
          {
            key: '31F1|2025-01-05',
            rectangleCode: '31F1',
            date: '2025-01-05',
            timestamp: Date.now(),
            data: {},
          },
          {
            key: '31F1|2025-01-06',
            rectangleCode: '31F1',
            date: '2025-01-06',
            timestamp: Date.now(),
            data: {},
          },
        ];

        mockDB.getAllFromIndex.mockResolvedValue(predictions);

        const result = await storage.getPredictionsForRectangle('31F1');

        expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('predictions', 'by-rectangle', '31F1');
        expect(result).toHaveLength(2);
        expect(result[0].freshness).toBeDefined();
      });
    });

    describe('getPredictionsForDate', () => {
      it('should retrieve all predictions for a date', async () => {
        const predictions = [
          {
            key: '31F1|2025-01-06',
            rectangleCode: '31F1',
            date: '2025-01-06',
            timestamp: Date.now(),
            data: {},
          },
          {
            key: '31F2|2025-01-06',
            rectangleCode: '31F2',
            date: '2025-01-06',
            timestamp: Date.now(),
            data: {},
          },
        ];

        mockDB.getAllFromIndex.mockResolvedValue(predictions);

        const result = await storage.getPredictionsForDate('2025-01-06');

        expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('predictions', 'by-date', '2025-01-06');
        expect(result).toHaveLength(2);
      });
    });

    describe('deletePrediction', () => {
      it('should delete prediction with correct key', async () => {
        await storage.deletePrediction('31F1', '2025-01-06');

        expect(mockDB.delete).toHaveBeenCalledWith('predictions', '31F1|2025-01-06');
      });
    });
  });

  describe('Species', () => {
    describe('cacheSpecies', () => {
      it('should cache multiple species', async () => {
        const speciesList: CachedSpecies[] = [
          {
            id: '1',
            slug: 'cod',
            name: 'Cod',
            nameScientific: 'Gadus morhua',
            guild: 'pelagic',
            timestamp: 0,
            data: {},
          },
          {
            id: '2',
            slug: 'haddock',
            name: 'Haddock',
            nameScientific: 'Melanogrammus aeglefinus',
            guild: 'benthic',
            timestamp: 0,
            data: {},
          },
        ];

        await storage.cacheSpecies(speciesList);

        expect(mockDB.put).toHaveBeenCalledTimes(2);
        expect(mockDB.put).toHaveBeenCalledWith('species', expect.objectContaining({
          slug: 'cod',
          timestamp: expect.any(Number),
        }));
      });
    });

    describe('getSpecies', () => {
      it('should retrieve species by slug', async () => {
        const species = {
          id: '1',
          slug: 'cod',
          name: 'Cod',
          nameScientific: 'Gadus morhua',
          guild: 'pelagic',
          timestamp: Date.now(),
          data: {},
        };

        mockDB.get.mockResolvedValue(species);

        const result = await storage.getSpecies('cod');

        expect(mockDB.get).toHaveBeenCalledWith('species', 'cod');
        expect(result).toEqual(species);
      });

      it('should return null for non-existent species', async () => {
        mockDB.get.mockResolvedValue(undefined);

        const result = await storage.getSpecies('unknown');

        expect(result).toBeNull();
      });
    });

    describe('getAllSpecies', () => {
      it('should retrieve all cached species', async () => {
        const species = [
          { slug: 'cod', name: 'Cod' },
          { slug: 'haddock', name: 'Haddock' },
        ];

        mockDB.getAll.mockResolvedValue(species as any);

        const result = await storage.getAllSpecies();

        expect(mockDB.getAll).toHaveBeenCalledWith('species');
        expect(result).toEqual(species);
      });
    });

    describe('getSpeciesByGuild', () => {
      it('should retrieve species by guild', async () => {
        const pelagicSpecies = [
          { slug: 'cod', guild: 'pelagic' },
          { slug: 'mackerel', guild: 'pelagic' },
        ];

        mockDB.getAllFromIndex.mockResolvedValue(pelagicSpecies as any);

        const result = await storage.getSpeciesByGuild('pelagic');

        expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('species', 'by-guild', 'pelagic');
        expect(result).toEqual(pelagicSpecies);
      });
    });
  });

  describe('Images', () => {
    describe('cacheImage', () => {
      it('should cache image with metadata', async () => {
        const blob = new Blob(['fake image data'], { type: 'image/jpeg' });

        await storage.cacheImage('cod', blob, 'image/jpeg');

        expect(mockDB.put).toHaveBeenCalledWith('images', {
          slug: 'cod',
          blob,
          mimeType: 'image/jpeg',
          size: blob.size,
          timestamp: expect.any(Number),
        });
      });
    });

    describe('getImage', () => {
      it('should retrieve cached image', async () => {
        const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
        mockDB.get.mockResolvedValue({ slug: 'cod', blob, mimeType: 'image/jpeg', size: 100, timestamp: Date.now() });

        const result = await storage.getImage('cod');

        expect(mockDB.get).toHaveBeenCalledWith('images', 'cod');
        expect(result).toBe(blob);
      });

      it('should return null for non-existent image', async () => {
        mockDB.get.mockResolvedValue(undefined);

        const result = await storage.getImage('unknown');

        expect(result).toBeNull();
      });
    });

    describe('hasImage', () => {
      it('should return true if image exists', async () => {
        mockDB.get.mockResolvedValue({ slug: 'cod', blob: new Blob(), mimeType: 'image/jpeg', size: 100, timestamp: Date.now() });

        const result = await storage.hasImage('cod');

        expect(result).toBe(true);
      });

      it('should return false if image does not exist', async () => {
        mockDB.get.mockResolvedValue(undefined);

        const result = await storage.hasImage('unknown');

        expect(result).toBe(false);
      });
    });
  });

  describe('Rectangles', () => {
    describe('cacheRectangle', () => {
      it('should cache rectangle with timestamp', async () => {
        const rectangle = {
          code: '31F1',
          anchorLat: 51.5,
          anchorLon: -5.0,
          data: { name: 'Celtic Sea' },
        };

        await storage.cacheRectangle(rectangle);

        expect(mockDB.put).toHaveBeenCalledWith('rectangles', {
          ...rectangle,
          timestamp: expect.any(Number),
        });
      });
    });

    describe('getRectangle', () => {
      it('should retrieve rectangle by code', async () => {
        const rectangle = {
          code: '31F1',
          anchorLat: 51.5,
          anchorLon: -5.0,
          timestamp: Date.now(),
          data: {},
        };

        mockDB.get.mockResolvedValue(rectangle);

        const result = await storage.getRectangle('31F1');

        expect(mockDB.get).toHaveBeenCalledWith('rectangles', '31F1');
        expect(result).toEqual(rectangle);
      });

      it('should return null for non-existent rectangle', async () => {
        mockDB.get.mockResolvedValue(undefined);

        const result = await storage.getRectangle('UNKNOWN');

        expect(result).toBeNull();
      });
    });

    describe('getAllRectangles', () => {
      it('should retrieve all cached rectangles', async () => {
        const rectangles = [
          { code: '31F1', anchorLat: 51.5, anchorLon: -5.0, data: {} },
          { code: '31F2', anchorLat: 52.0, anchorLon: -4.5, data: {} },
        ];

        mockDB.getAll.mockResolvedValue(rectangles as any);

        const result = await storage.getAllRectangles();

        expect(mockDB.getAll).toHaveBeenCalledWith('rectangles');
        expect(result).toEqual(rectangles);
      });
    });
  });

  describe('Catch Queue', () => {
    describe('queueCatchLog', () => {
      it('should add catch log to queue with UUID', async () => {
        const log = {
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
            bait: 'lugworm',
          },
        };

        const id = await storage.queueCatchLog(log);

        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(mockDB.put).toHaveBeenCalledWith('catch-queue', {
          id,
          timestamp: expect.any(Number),
          retryCount: 0,
          data: log.data,
        });
      });

      it('should initialize retryCount to 0', async () => {
        await storage.queueCatchLog({
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
          },
        });

        const queuedLog = mockDB.put.mock.calls[0][1] as PendingCatchLog;
        expect(queuedLog.retryCount).toBe(0);
      });

      it('should preserve photo blobs in queue', async () => {
        const photo1 = new Blob(['photo1'], { type: 'image/jpeg' });
        const photo2 = new Blob(['photo2'], { type: 'image/jpeg' });

        await storage.queueCatchLog({
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
            photos: [photo1, photo2],
          },
        });

        const queuedLog = mockDB.put.mock.calls[0][1] as PendingCatchLog;
        expect(queuedLog.data.photos).toEqual([photo1, photo2]);
      });
    });

    describe('getPendingCatchLogs', () => {
      it('should retrieve all pending logs', async () => {
        const logs: PendingCatchLog[] = [
          {
            id: 'log-1',
            timestamp: Date.now(),
            data: {
              speciesId: 'cod',
              rectangleCode: '31F1',
              date: '2025-01-06',
            },
            retryCount: 0,
          },
          {
            id: 'log-2',
            timestamp: Date.now(),
            data: {
              speciesId: 'haddock',
              rectangleCode: '31F2',
              date: '2025-01-06',
            },
            retryCount: 1,
          },
        ];

        mockDB.getAll.mockResolvedValue(logs as any);

        const result = await storage.getPendingCatchLogs();

        expect(mockDB.getAll).toHaveBeenCalledWith('catch-queue');
        expect(result).toEqual(logs);
      });
    });

    describe('removeCatchLog', () => {
      it('should delete catch log by id', async () => {
        await storage.removeCatchLog('log-123');

        expect(mockDB.delete).toHaveBeenCalledWith('catch-queue', 'log-123');
      });
    });

    describe('updateCatchLogRetryCount', () => {
      it('should increment retry count', async () => {
        const log: PendingCatchLog = {
          id: 'log-123',
          timestamp: Date.now(),
          data: {
            speciesId: 'cod',
            rectangleCode: '31F1',
            date: '2025-01-06',
          },
          retryCount: 2,
        };

        mockDB.get.mockResolvedValue(log);

        await storage.updateCatchLogRetryCount('log-123');

        expect(mockDB.get).toHaveBeenCalledWith('catch-queue', 'log-123');
        expect(mockDB.put).toHaveBeenCalledWith('catch-queue', {
          ...log,
          retryCount: 3,
        });
      });

      it('should handle missing log gracefully', async () => {
        mockDB.get.mockResolvedValue(undefined);

        await expect(storage.updateCatchLogRetryCount('missing-log')).resolves.not.toThrow();
        expect(mockDB.put).not.toHaveBeenCalled();
      });
    });
  });

  describe('Favorites', () => {
    describe('cacheFavorites', () => {
      it('should cache multiple favorites', async () => {
        const favorites = [
          { speciesId: 'cod', data: { name: 'Cod' } },
          { speciesId: 'haddock', data: { name: 'Haddock' } },
        ];

        await storage.cacheFavorites(favorites);

        expect(mockDB.put).toHaveBeenCalledTimes(2);
        expect(mockDB.put).toHaveBeenCalledWith('favorites', {
          speciesId: 'cod',
          timestamp: expect.any(Number),
          data: favorites[0].data,
        });
      });
    });

    describe('getFavorites', () => {
      it('should retrieve all favorites', async () => {
        const favorites = [
          { speciesId: 'cod', data: {}, timestamp: Date.now() },
          { speciesId: 'haddock', data: {}, timestamp: Date.now() },
        ];

        mockDB.getAll.mockResolvedValue(favorites as any);

        const result = await storage.getFavorites();

        expect(mockDB.getAll).toHaveBeenCalledWith('favorites');
        expect(result).toEqual(favorites);
      });
    });

    describe('addFavorite', () => {
      it('should add single favorite', async () => {
        await storage.addFavorite('cod', { name: 'Cod' });

        expect(mockDB.put).toHaveBeenCalledWith('favorites', {
          speciesId: 'cod',
          timestamp: expect.any(Number),
          data: { name: 'Cod' },
        });
      });
    });

    describe('removeFavorite', () => {
      it('should delete favorite by species id', async () => {
        await storage.removeFavorite('cod');

        expect(mockDB.delete).toHaveBeenCalledWith('favorites', 'cod');
      });
    });

    describe('isFavorited', () => {
      it('should return true if species is favorited', async () => {
        mockDB.get.mockResolvedValue({ speciesId: 'cod', data: {}, timestamp: Date.now() });

        const result = await storage.isFavorited('cod');

        expect(result).toBe(true);
      });

      it('should return false if species is not favorited', async () => {
        mockDB.get.mockResolvedValue(undefined);

        const result = await storage.isFavorited('haddock');

        expect(result).toBe(false);
      });
    });
  });

  describe('Utility methods', () => {
    describe('getCacheSize', () => {
      it('should return database size', async () => {
        mockGetDatabaseSize.mockResolvedValue(1024000);

        const size = await storage.getCacheSize();

        expect(size).toBe(1024000);
        expect(mockGetDatabaseSize).toHaveBeenCalled();
      });
    });

    describe('clearAll', () => {
      it('should clear all data', async () => {
        mockClearAllData.mockResolvedValue(undefined);

        await storage.clearAll();

        expect(mockClearAllData).toHaveBeenCalled();
      });
    });
  });
});
