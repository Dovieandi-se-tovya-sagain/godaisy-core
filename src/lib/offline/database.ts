/**
 * Offline Database Layer
 *
 * Uses Capacitor SQLite plugin for persistent offline storage.
 * Provides structured storage for user plants, planting calendar,
 * and species reference data.
 *
 * Usage:
 * ```typescript
 * import { offlineDb } from './database';
 *
 * // Initialize on app start
 * await offlineDb.initialize();
 *
 * // Store user plants
 * await offlineDb.plants.upsertMany(plants);
 *
 * // Get plants (works offline)
 * const plants = await offlineDb.plants.getAll();
 * ```
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'grow_offline';
const DB_VERSION = 1;

// Schema for offline tables
const SCHEMA = `
  -- User plants table
  CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    species_slug TEXT,
    variety TEXT,
    cultivar_id TEXT,
    quantity INTEGER DEFAULT 1,
    location TEXT,
    health TEXT DEFAULT 'good',
    planted_at TEXT,
    last_watered TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    is_dirty INTEGER DEFAULT 0
  );

  -- Planting calendar cache
  CREATE TABLE IF NOT EXISTS planting_calendar (
    id TEXT PRIMARY KEY,
    plant_slug TEXT NOT NULL,
    plant_name TEXT NOT NULL,
    action TEXT NOT NULL,
    start_month INTEGER,
    end_month INTEGER,
    start_day INTEGER,
    end_day INTEGER,
    priority TEXT,
    indoor_outdoor TEXT,
    notes TEXT,
    lat REAL,
    lon REAL,
    cached_at TEXT NOT NULL
  );

  -- Species reference data (ships with app)
  CREATE TABLE IF NOT EXISTS species (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scientific_name TEXT,
    category TEXT,
    frost_tolerance TEXT,
    min_temp_c INTEGER,
    sun_requirement TEXT,
    water_requirement TEXT,
    growth_habit TEXT,
    days_to_harvest_min INTEGER,
    days_to_harvest_max INTEGER,
    companion_plants TEXT,
    avoid_plants TEXT,
    description TEXT,
    care_tips TEXT
  );

  -- Sync metadata
  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  );

  -- Create indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_plants_species ON plants(species_slug);
  CREATE INDEX IF NOT EXISTS idx_plants_dirty ON plants(is_dirty);
  CREATE INDEX IF NOT EXISTS idx_calendar_plant ON planting_calendar(plant_slug);
  CREATE INDEX IF NOT EXISTS idx_calendar_location ON planting_calendar(lat, lon);
`;

class OfflineDatabase {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;
  private platform: string;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.platform = Capacitor.getPlatform();
  }

  /**
   * Initialize the database
   * Must be called before any other operations
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    // Skip on web platform (no native SQLite)
    if (this.platform === 'web') {
      console.log('[OfflineDB] Web platform - using fallback storage');
      this.initialized = true;
      return true;
    }

    try {
      // Check connection consistency (iOS specific)
      if (this.platform === 'ios') {
        await this.sqlite.checkConnectionsConsistency();
        const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;
        if (isConn) {
          this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
        }
      }

      if (!this.db) {
        this.db = await this.sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          DB_VERSION,
          false
        );
      }

      await this.db.open();

      // Run migrations
      await this.db.execute(SCHEMA);

      this.initialized = true;
      console.log('[OfflineDB] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[OfflineDB] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Check if running on native platform with SQLite support
   */
  isNative(): boolean {
    return this.platform !== 'web';
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.initialized && (this.db !== null || this.platform === 'web');
  }

  // ============================================
  // PLANTS OPERATIONS
  // ============================================

  plants = {
    /**
     * Get all plants from local database
     */
    getAll: async (): Promise<Plant[]> => {
      if (!this.isReady()) return [];

      if (this.platform === 'web') {
        return this.getFromLocalStorage<Plant[]>('plants') || [];
      }

      const result = await this.db!.query('SELECT * FROM plants ORDER BY name');
      return (result.values || []).map(this.rowToPlant);
    },

    /**
     * Get a single plant by ID
     */
    getById: async (id: string): Promise<Plant | null> => {
      if (!this.isReady()) return null;

      if (this.platform === 'web') {
        const plants = this.getFromLocalStorage<Plant[]>('plants') || [];
        return plants.find(p => p.id === id) || null;
      }

      const result = await this.db!.query('SELECT * FROM plants WHERE id = ?', [id]);
      return result.values?.[0] ? this.rowToPlant(result.values[0]) : null;
    },

    /**
     * Upsert a single plant
     */
    upsert: async (plant: Plant, markDirty = false): Promise<void> => {
      if (!this.isReady()) return;

      if (this.platform === 'web') {
        const plants = this.getFromLocalStorage<Plant[]>('plants') || [];
        const index = plants.findIndex(p => p.id === plant.id);
        if (index >= 0) {
          plants[index] = plant;
        } else {
          plants.push(plant);
        }
        this.setToLocalStorage('plants', plants);
        return;
      }

      const now = new Date().toISOString();
      await this.db!.run(
        `INSERT OR REPLACE INTO plants
         (id, name, type, species_slug, variety, cultivar_id, quantity, location,
          health, planted_at, last_watered, notes, created_at, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plant.id,
          plant.name,
          plant.type || null,
          plant.speciesSlug || null,
          plant.variety || null,
          plant.cultivarId || null,
          plant.quantity || 1,
          plant.location || null,
          plant.health || 'good',
          plant.planted?.toISOString() || null,
          plant.lastWatered?.toISOString() || null,
          plant.notes || null,
          plant.createdAt?.toISOString() || now,
          now,
          markDirty ? 1 : 0,
        ]
      );
    },

    /**
     * Upsert multiple plants
     */
    upsertMany: async (plants: Plant[]): Promise<void> => {
      if (!this.isReady() || plants.length === 0) return;

      if (this.platform === 'web') {
        this.setToLocalStorage('plants', plants);
        return;
      }

      // Use transaction for bulk insert
      const statements = plants.map(plant => ({
        statement: `INSERT OR REPLACE INTO plants
                    (id, name, type, species_slug, variety, cultivar_id, quantity, location,
                     health, planted_at, last_watered, notes, created_at, updated_at, synced_at, is_dirty)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        values: [
          plant.id,
          plant.name,
          plant.type || null,
          plant.speciesSlug || null,
          plant.variety || null,
          plant.cultivarId || null,
          plant.quantity || 1,
          plant.location || null,
          plant.health || 'good',
          plant.planted?.toISOString() || null,
          plant.lastWatered?.toISOString() || null,
          plant.notes || null,
          plant.createdAt?.toISOString() || new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      }));

      await this.db!.executeSet(statements);
    },

    /**
     * Delete a plant
     */
    delete: async (id: string): Promise<void> => {
      if (!this.isReady()) return;

      if (this.platform === 'web') {
        const plants = this.getFromLocalStorage<Plant[]>('plants') || [];
        this.setToLocalStorage('plants', plants.filter(p => p.id !== id));
        return;
      }

      await this.db!.run('DELETE FROM plants WHERE id = ?', [id]);
    },

    /**
     * Get plants that need to be synced
     */
    getDirty: async (): Promise<Plant[]> => {
      if (!this.isReady() || this.platform === 'web') return [];

      const result = await this.db!.query('SELECT * FROM plants WHERE is_dirty = 1');
      return (result.values || []).map(this.rowToPlant);
    },

    /**
     * Mark plants as synced
     */
    markSynced: async (ids: string[]): Promise<void> => {
      if (!this.isReady() || this.platform === 'web' || ids.length === 0) return;

      const placeholders = ids.map(() => '?').join(',');
      await this.db!.run(
        `UPDATE plants SET is_dirty = 0, synced_at = ? WHERE id IN (${placeholders})`,
        [new Date().toISOString(), ...ids]
      );
    },

    /**
     * Clear all plants
     */
    clear: async (): Promise<void> => {
      if (!this.isReady()) return;

      if (this.platform === 'web') {
        this.setToLocalStorage('plants', []);
        return;
      }

      await this.db!.run('DELETE FROM plants');
    },
  };

  // ============================================
  // PLANTING CALENDAR OPERATIONS
  // ============================================

  calendar = {
    /**
     * Get calendar entries for a location
     */
    getForLocation: async (lat: number, lon: number): Promise<CalendarEntry[]> => {
      if (!this.isReady()) return [];

      const cacheKey = `calendar:${lat.toFixed(2)}:${lon.toFixed(2)}`;

      if (this.platform === 'web') {
        return this.getFromLocalStorage<CalendarEntry[]>(cacheKey) || [];
      }

      // Round to 2 decimal places for location matching
      const result = await this.db!.query(
        `SELECT * FROM planting_calendar
         WHERE ROUND(lat, 2) = ROUND(?, 2) AND ROUND(lon, 2) = ROUND(?, 2)
         ORDER BY plant_name`,
        [lat, lon]
      );
      return (result.values || []).map(this.rowToCalendarEntry);
    },

    /**
     * Cache calendar entries for a location
     */
    cacheForLocation: async (lat: number, lon: number, entries: CalendarEntry[]): Promise<void> => {
      if (!this.isReady() || entries.length === 0) return;

      const cacheKey = `calendar:${lat.toFixed(2)}:${lon.toFixed(2)}`;

      if (this.platform === 'web') {
        this.setToLocalStorage(cacheKey, entries);
        return;
      }

      // Clear old entries for this location
      await this.db!.run(
        'DELETE FROM planting_calendar WHERE ROUND(lat, 2) = ROUND(?, 2) AND ROUND(lon, 2) = ROUND(?, 2)',
        [lat, lon]
      );

      // Insert new entries
      const now = new Date().toISOString();
      const statements = entries.map(entry => ({
        statement: `INSERT INTO planting_calendar
                    (id, plant_slug, plant_name, action, start_month, end_month, start_day, end_day,
                     priority, indoor_outdoor, notes, lat, lon, cached_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          entry.id || `${entry.plantSlug}-${entry.action}-${Date.now()}`,
          entry.plantSlug,
          entry.plantName,
          entry.action,
          entry.startMonth || null,
          entry.endMonth || null,
          entry.startDay || null,
          entry.endDay || null,
          entry.priority || null,
          entry.indoorOutdoor || null,
          entry.notes || null,
          lat,
          lon,
          now,
        ],
      }));

      await this.db!.executeSet(statements);
    },

    /**
     * Check if calendar is cached for location
     */
    isCached: async (lat: number, lon: number, maxAgeMs = 24 * 60 * 60 * 1000): Promise<boolean> => {
      if (!this.isReady()) return false;

      const cacheKey = `calendar:${lat.toFixed(2)}:${lon.toFixed(2)}`;

      if (this.platform === 'web') {
        const cached = this.getFromLocalStorage<CalendarEntry[]>(cacheKey);
        return cached !== null && cached.length > 0;
      }

      const result = await this.db!.query(
        `SELECT cached_at FROM planting_calendar
         WHERE ROUND(lat, 2) = ROUND(?, 2) AND ROUND(lon, 2) = ROUND(?, 2)
         LIMIT 1`,
        [lat, lon]
      );

      if (!result.values?.[0]) return false;

      const cachedAt = new Date(result.values[0].cached_at).getTime();
      return Date.now() - cachedAt < maxAgeMs;
    },
  };

  // ============================================
  // SPECIES REFERENCE DATA
  // ============================================

  species = {
    /**
     * Get all species
     */
    getAll: async (): Promise<Species[]> => {
      if (!this.isReady()) return [];

      if (this.platform === 'web') {
        return this.getFromLocalStorage<Species[]>('species') || [];
      }

      const result = await this.db!.query('SELECT * FROM species ORDER BY name');
      return (result.values || []).map(this.rowToSpecies);
    },

    /**
     * Get species by slug
     */
    getBySlug: async (slug: string): Promise<Species | null> => {
      if (!this.isReady()) return null;

      if (this.platform === 'web') {
        const species = this.getFromLocalStorage<Species[]>('species') || [];
        return species.find(s => s.slug === slug) || null;
      }

      const result = await this.db!.query('SELECT * FROM species WHERE slug = ?', [slug]);
      return result.values?.[0] ? this.rowToSpecies(result.values[0]) : null;
    },

    /**
     * Load species reference data (called during initial app setup)
     */
    loadReferenceData: async (speciesData: Species[]): Promise<void> => {
      if (!this.isReady() || speciesData.length === 0) return;

      if (this.platform === 'web') {
        this.setToLocalStorage('species', speciesData);
        return;
      }

      // Clear and reload
      await this.db!.run('DELETE FROM species');

      const statements = speciesData.map(species => ({
        statement: `INSERT INTO species
                    (slug, name, scientific_name, category, frost_tolerance, min_temp_c,
                     sun_requirement, water_requirement, growth_habit, days_to_harvest_min,
                     days_to_harvest_max, companion_plants, avoid_plants, description, care_tips)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          species.slug,
          species.name,
          species.scientificName || null,
          species.category || null,
          species.frostTolerance || null,
          species.minTempC || null,
          species.sunRequirement || null,
          species.waterRequirement || null,
          species.growthHabit || null,
          species.daysToHarvestMin || null,
          species.daysToHarvestMax || null,
          species.companionPlants ? JSON.stringify(species.companionPlants) : null,
          species.avoidPlants ? JSON.stringify(species.avoidPlants) : null,
          species.description || null,
          species.careTips || null,
        ],
      }));

      await this.db!.executeSet(statements);
    },
  };

  // ============================================
  // SYNC METADATA
  // ============================================

  meta = {
    get: async (key: string): Promise<string | null> => {
      if (!this.isReady()) return null;

      if (this.platform === 'web') {
        return localStorage.getItem(`grow:meta:${key}`);
      }

      const result = await this.db!.query('SELECT value FROM sync_meta WHERE key = ?', [key]);
      return result.values?.[0]?.value || null;
    },

    set: async (key: string, value: string): Promise<void> => {
      if (!this.isReady()) return;

      if (this.platform === 'web') {
        localStorage.setItem(`grow:meta:${key}`, value);
        return;
      }

      await this.db!.run(
        'INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, new Date().toISOString()]
      );
    },
  };

  // ============================================
  // HELPER METHODS
  // ============================================

  private rowToPlant = (row: Record<string, unknown>): Plant => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as string | undefined,
    speciesSlug: row.species_slug as string | undefined,
    variety: row.variety as string | undefined,
    cultivarId: row.cultivar_id as string | undefined,
    quantity: row.quantity as number | undefined,
    location: row.location as string | undefined,
    health: row.health as Plant['health'],
    planted: row.planted_at ? new Date(row.planted_at as string) : undefined,
    lastWatered: row.last_watered ? new Date(row.last_watered as string) : undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
  });

  private rowToCalendarEntry = (row: Record<string, unknown>): CalendarEntry => ({
    id: row.id as string,
    plantSlug: row.plant_slug as string,
    plantName: row.plant_name as string,
    action: row.action as string,
    startMonth: row.start_month as number | undefined,
    endMonth: row.end_month as number | undefined,
    startDay: row.start_day as number | undefined,
    endDay: row.end_day as number | undefined,
    priority: row.priority as string | undefined,
    indoorOutdoor: row.indoor_outdoor as string | undefined,
    notes: row.notes as string | undefined,
  });

  private rowToSpecies = (row: Record<string, unknown>): Species => ({
    slug: row.slug as string,
    name: row.name as string,
    scientificName: row.scientific_name as string | undefined,
    category: row.category as string | undefined,
    frostTolerance: row.frost_tolerance as string | undefined,
    minTempC: row.min_temp_c as number | undefined,
    sunRequirement: row.sun_requirement as string | undefined,
    waterRequirement: row.water_requirement as string | undefined,
    growthHabit: row.growth_habit as string | undefined,
    daysToHarvestMin: row.days_to_harvest_min as number | undefined,
    daysToHarvestMax: row.days_to_harvest_max as number | undefined,
    companionPlants: row.companion_plants ? JSON.parse(row.companion_plants as string) : undefined,
    avoidPlants: row.avoid_plants ? JSON.parse(row.avoid_plants as string) : undefined,
    description: row.description as string | undefined,
    careTips: row.care_tips as string | undefined,
  });

  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(`grow:offline:${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private setToLocalStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`grow:offline:${key}`, JSON.stringify(value));
    } catch {
      // Storage quota exceeded
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db && this.platform !== 'web') {
      await this.sqlite.closeConnection(DB_NAME, false);
      this.db = null;
    }
    this.initialized = false;
  }
}

// Types
export interface Plant {
  id: string;
  name: string;
  type?: string;
  speciesSlug?: string;
  variety?: string;
  cultivarId?: string;
  quantity?: number;
  location?: string;
  health?: 'excellent' | 'good' | 'fair' | 'poor';
  planted?: Date;
  lastWatered?: Date;
  notes?: string;
  createdAt?: Date;
}

export interface CalendarEntry {
  id?: string;
  plantSlug: string;
  plantName: string;
  action: string;
  startMonth?: number;
  endMonth?: number;
  startDay?: number;
  endDay?: number;
  priority?: string;
  indoorOutdoor?: string;
  notes?: string;
}

export interface Species {
  slug: string;
  name: string;
  scientificName?: string;
  category?: string;
  frostTolerance?: string;
  minTempC?: number;
  sunRequirement?: string;
  waterRequirement?: string;
  growthHabit?: string;
  daysToHarvestMin?: number;
  daysToHarvestMax?: number;
  companionPlants?: string[];
  avoidPlants?: string[];
  description?: string;
  careTips?: string;
}

// Singleton instance
export const offlineDb = new OfflineDatabase();
