/**
 * Findr Offline Database
 *
 * SQLite storage for fish species data, predictions, and favourites.
 * Enables offline-first experience for the Findr fishing app.
 *
 * Usage:
 * ```typescript
 * import { findrDb } from './findrDatabase';
 *
 * await findrDb.initialize();
 * const species = await findrDb.species.getAll();
 * const predictions = await findrDb.predictions.getForRectangle('31F1');
 * ```
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'findr_offline';
const DB_VERSION = 1;

// Schema for Findr offline database
const SCHEMA = `
  -- Species reference data (cached from server)
  CREATE TABLE IF NOT EXISTS species (
    id TEXT PRIMARY KEY,
    species_code TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE,
    scientific_name TEXT,
    name_en TEXT NOT NULL,
    name_fr TEXT,
    name_es TEXT,
    name_de TEXT,
    name_it TEXT,
    name_pt TEXT,
    playful_bio_en TEXT,
    fun_fact TEXT,
    eating_quality INTEGER,
    conservation_status TEXT,
    guild TEXT,
    min_depth INTEGER,
    max_depth INTEGER,
    temp_opt_c TEXT,
    aliases TEXT,
    advice TEXT,
    best_times TEXT,
    recommended_baits TEXT,
    species_badges TEXT,
    cached_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- User favourites (synced with server)
  CREATE TABLE IF NOT EXISTS favourites (
    id TEXT PRIMARY KEY,
    species_code TEXT NOT NULL,
    notifications_enabled INTEGER DEFAULT 0,
    notification_threshold INTEGER DEFAULT 70,
    added_at TEXT NOT NULL,
    synced_at TEXT,
    is_dirty INTEGER DEFAULT 0,
    FOREIGN KEY (species_code) REFERENCES species(species_code)
  );

  -- Cached predictions (by rectangle + date)
  CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    rectangle_code TEXT NOT NULL,
    prediction_date TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    species_code TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    bite_score INTEGER,
    temp_score INTEGER,
    tide_score INTEGER,
    light_score INTEGER,
    lunar_score INTEGER,
    habitat_bonus INTEGER,
    rationale TEXT,
    best_times TEXT,
    cached_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    UNIQUE(rectangle_code, prediction_date, language, species_code)
  );

  -- Environmental conditions cache
  CREATE TABLE IF NOT EXISTS conditions (
    rectangle_code TEXT PRIMARY KEY,
    sea_temp_c REAL,
    salinity_psu REAL,
    water_clarity REAL,
    wave_height REAL,
    current_speed REAL,
    current_direction REAL,
    cached_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  -- Metadata for sync state
  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_species_code ON species(species_code);
  CREATE INDEX IF NOT EXISTS idx_species_slug ON species(slug);
  CREATE INDEX IF NOT EXISTS idx_predictions_rect_date ON predictions(rectangle_code, prediction_date);
  CREATE INDEX IF NOT EXISTS idx_favourites_species ON favourites(species_code);
`;

// Types
export interface OfflineSpecies {
  id: string;
  speciesCode: string;
  slug?: string;
  scientificName?: string;
  nameEn: string;
  nameFr?: string;
  nameEs?: string;
  nameDe?: string;
  nameIt?: string;
  namePt?: string;
  playfulBio?: string;
  funFact?: string;
  eatingQuality?: number;
  conservationStatus?: string;
  guild?: string;
  minDepth?: number;
  maxDepth?: number;
  tempOptC?: number[];
  aliases?: string[];
  advice?: Record<string, unknown>;
  bestTimes?: string[];
  recommendedBaits?: string[];
  speciesBadges?: string[];
}

export interface OfflinePrediction {
  id: string;
  rectangleCode: string;
  predictionDate: string;
  language: string;
  speciesCode: string;
  confidence: number;
  biteScore?: number;
  tempScore?: number;
  tideScore?: number;
  lightScore?: number;
  lunarScore?: number;
  habitatBonus?: number;
  rationale?: string;
  bestTimes?: string[];
}

export interface OfflineFavourite {
  id: string;
  speciesCode: string;
  notificationsEnabled: boolean;
  notificationThreshold: number;
  addedAt: Date;
}

export interface OfflineConditions {
  rectangleCode: string;
  seaTempC?: number;
  salinityPsu?: number;
  waterClarity?: number;
  waveHeight?: number;
  currentSpeed?: number;
  currentDirection?: number;
}

class FindrOfflineDatabase {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private platform: string;
  private initialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.platform = Capacitor.getPlatform();
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Web platform - use localStorage fallback
    if (this.platform === 'web') {
      console.log('[FindrDB] Using localStorage fallback for web');
      this.initialized = true;
      return;
    }

    try {
      // Check connection consistency (iOS requirement)
      const retCC = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

      if (retCC.result && isConn) {
        this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.db = await this.sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          DB_VERSION,
          false
        );
      }

      await this.db.open();

      // Execute schema
      await this.db.execute(SCHEMA);

      this.initialized = true;
      console.log('[FindrDB] Initialized successfully');
    } catch (error) {
      console.error('[FindrDB] Failed to initialize:', error);
      // Fall back to localStorage on error
      this.platform = 'web';
      this.initialized = true;
    }
  }

  /**
   * Check if running on native platform with SQLite
   */
  isNative(): boolean {
    return this.platform !== 'web' && this.db !== null;
  }

  // ============================================
  // SPECIES OPERATIONS
  // ============================================

  species = {
    getAll: async (): Promise<OfflineSpecies[]> => {
      if (!this.isNative()) {
        return this.webFallback.getSpecies();
      }

      const result = await this.db!.query('SELECT * FROM species ORDER BY name_en');
      return (result.values || []).map(this.mapSpeciesRow);
    },

    getByCode: async (code: string): Promise<OfflineSpecies | null> => {
      if (!this.isNative()) {
        const all = await this.webFallback.getSpecies();
        return all.find(s => s.speciesCode === code) || null;
      }

      const result = await this.db!.query(
        'SELECT * FROM species WHERE species_code = ?',
        [code]
      );
      return result.values?.[0] ? this.mapSpeciesRow(result.values[0]) : null;
    },

    getBySlug: async (slug: string): Promise<OfflineSpecies | null> => {
      if (!this.isNative()) {
        const all = await this.webFallback.getSpecies();
        return all.find(s => s.slug === slug) || null;
      }

      const result = await this.db!.query(
        'SELECT * FROM species WHERE slug = ?',
        [slug]
      );
      return result.values?.[0] ? this.mapSpeciesRow(result.values[0]) : null;
    },

    upsertMany: async (species: OfflineSpecies[]): Promise<void> => {
      if (!this.isNative()) {
        return this.webFallback.setSpecies(species);
      }

      const now = new Date().toISOString();
      const statements = species.map(s => ({
        statement: `
          INSERT OR REPLACE INTO species (
            id, species_code, slug, scientific_name, name_en, name_fr, name_es, name_de, name_it, name_pt,
            playful_bio_en, fun_fact, eating_quality, conservation_status, guild,
            min_depth, max_depth, temp_opt_c, aliases, advice,
            best_times, recommended_baits, species_badges, cached_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          s.id, s.speciesCode, s.slug, s.scientificName, s.nameEn, s.nameFr, s.nameEs, s.nameDe, s.nameIt, s.namePt,
          s.playfulBio, s.funFact, s.eatingQuality, s.conservationStatus, s.guild,
          s.minDepth, s.maxDepth, JSON.stringify(s.tempOptC || []),
          JSON.stringify(s.aliases || []), JSON.stringify(s.advice || {}),
          JSON.stringify(s.bestTimes || []), JSON.stringify(s.recommendedBaits || []), JSON.stringify(s.speciesBadges || []),
          now, now
        ]
      }));

      await this.db!.executeSet(statements);
      console.log('[FindrDB] Cached ' + species.length + ' species');
    },

    getCount: async (): Promise<number> => {
      if (!this.isNative()) {
        return (await this.webFallback.getSpecies()).length;
      }

      const result = await this.db!.query('SELECT COUNT(*) as count FROM species');
      return result.values?.[0]?.count || 0;
    },

    getLastCachedAt: async (): Promise<Date | null> => {
      if (!this.isNative()) {
        const meta = localStorage.getItem('findr_species_cached_at');
        return meta ? new Date(meta) : null;
      }

      const result = await this.db!.query(
        'SELECT MAX(cached_at) as last_cached FROM species'
      );
      return result.values?.[0]?.last_cached ? new Date(result.values[0].last_cached) : null;
    }
  };

  // ============================================
  // PREDICTIONS OPERATIONS
  // ============================================

  predictions = {
    getForRectangle: async (rectangleCode: string, date: string, language = 'en'): Promise<OfflinePrediction[]> => {
      if (!this.isNative()) {
        return this.webFallback.getPredictions(rectangleCode, date, language);
      }

      const now = new Date().toISOString();
      const result = await this.db!.query(
        `SELECT * FROM predictions
         WHERE rectangle_code = ? AND prediction_date = ? AND language = ? AND expires_at > ?
         ORDER BY confidence DESC`,
        [rectangleCode, date, language, now]
      );
      return (result.values || []).map(this.mapPredictionRow);
    },

    cache: async (rectangleCode: string, date: string, language: string, predictions: OfflinePrediction[], ttlHours = 6): Promise<void> => {
      if (!this.isNative()) {
        return this.webFallback.setPredictions(rectangleCode, date, language, predictions);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
      const cachedAt = now.toISOString();

      // Clear old predictions for this rectangle/date/language
      await this.db!.run(
        'DELETE FROM predictions WHERE rectangle_code = ? AND prediction_date = ? AND language = ?',
        [rectangleCode, date, language]
      );

      const statements = predictions.map(p => ({
        statement: `
          INSERT INTO predictions (
            id, rectangle_code, prediction_date, language, species_code, confidence,
            bite_score, temp_score, tide_score, light_score, lunar_score, habitat_bonus,
            rationale, best_times, cached_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          p.id || `${rectangleCode}-${date}-${p.speciesCode}`,
          rectangleCode, date, language, p.speciesCode, p.confidence,
          p.biteScore, p.tempScore, p.tideScore, p.lightScore, p.lunarScore, p.habitatBonus,
          p.rationale, JSON.stringify(p.bestTimes || []), cachedAt, expiresAt
        ]
      }));

      if (statements.length > 0) {
        await this.db!.executeSet(statements);
      }
      console.log('[FindrDB] Cached ' + predictions.length + ' predictions for ' + rectangleCode);
    },

    isCached: async (rectangleCode: string, date: string, language = 'en'): Promise<boolean> => {
      if (!this.isNative()) {
        const cached = await this.webFallback.getPredictions(rectangleCode, date, language);
        return cached.length > 0;
      }

      const now = new Date().toISOString();
      const result = await this.db!.query(
        `SELECT COUNT(*) as count FROM predictions
         WHERE rectangle_code = ? AND prediction_date = ? AND language = ? AND expires_at > ?`,
        [rectangleCode, date, language, now]
      );
      return (result.values?.[0]?.count || 0) > 0;
    },

    clearExpired: async (): Promise<void> => {
      if (!this.isNative()) return;

      const now = new Date().toISOString();
      await this.db!.run('DELETE FROM predictions WHERE expires_at < ?', [now]);
    }
  };

  // ============================================
  // FAVOURITES OPERATIONS
  // ============================================

  favourites = {
    getAll: async (): Promise<OfflineFavourite[]> => {
      if (!this.isNative()) {
        return this.webFallback.getFavourites();
      }

      const result = await this.db!.query('SELECT * FROM favourites ORDER BY added_at DESC');
      return (result.values || []).map(this.mapFavouriteRow);
    },

    add: async (speciesCode: string, isDirty = true): Promise<void> => {
      if (!this.isNative()) {
        return this.webFallback.addFavourite(speciesCode);
      }

      const id = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();

      await this.db!.run(
        `INSERT OR IGNORE INTO favourites (id, species_code, added_at, is_dirty) VALUES (?, ?, ?, ?)`,
        [id, speciesCode, now, isDirty ? 1 : 0]
      );
    },

    remove: async (speciesCode: string): Promise<void> => {
      if (!this.isNative()) {
        return this.webFallback.removeFavourite(speciesCode);
      }

      await this.db!.run('DELETE FROM favourites WHERE species_code = ?', [speciesCode]);
    },

    has: async (speciesCode: string): Promise<boolean> => {
      if (!this.isNative()) {
        const all = await this.webFallback.getFavourites();
        return all.some(f => f.speciesCode === speciesCode);
      }

      const result = await this.db!.query(
        'SELECT COUNT(*) as count FROM favourites WHERE species_code = ?',
        [speciesCode]
      );
      return (result.values?.[0]?.count || 0) > 0;
    },

    getDirty: async (): Promise<OfflineFavourite[]> => {
      if (!this.isNative()) return [];

      const result = await this.db!.query('SELECT * FROM favourites WHERE is_dirty = 1');
      return (result.values || []).map(this.mapFavouriteRow);
    },

    markSynced: async (speciesCodes: string[]): Promise<void> => {
      if (!this.isNative() || speciesCodes.length === 0) return;

      const placeholders = speciesCodes.map(() => '?').join(',');
      const now = new Date().toISOString();
      await this.db!.run(
        `UPDATE favourites SET is_dirty = 0, synced_at = ? WHERE species_code IN (${placeholders})`,
        [now, ...speciesCodes]
      );
    }
  };

  // ============================================
  // CONDITIONS OPERATIONS
  // ============================================

  conditions = {
    get: async (rectangleCode: string): Promise<OfflineConditions | null> => {
      if (!this.isNative()) {
        return this.webFallback.getConditions(rectangleCode);
      }

      const now = new Date().toISOString();
      const result = await this.db!.query(
        'SELECT * FROM conditions WHERE rectangle_code = ? AND expires_at > ?',
        [rectangleCode, now]
      );
      return result.values?.[0] ? this.mapConditionsRow(result.values[0]) : null;
    },

    cache: async (conditions: OfflineConditions, ttlHours = 3): Promise<void> => {
      if (!this.isNative()) {
        return this.webFallback.setConditions(conditions);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

      await this.db!.run(
        `INSERT OR REPLACE INTO conditions (
          rectangle_code, sea_temp_c, salinity_psu, water_clarity,
          wave_height, current_speed, current_direction, cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conditions.rectangleCode, conditions.seaTempC, conditions.salinityPsu,
          conditions.waterClarity, conditions.waveHeight, conditions.currentSpeed,
          conditions.currentDirection, now.toISOString(), expiresAt
        ]
      );
    }
  };

  // ============================================
  // META OPERATIONS
  // ============================================

  meta = {
    get: async (key: string): Promise<string | null> => {
      if (!this.isNative()) {
        return localStorage.getItem(`findr_meta_${key}`);
      }

      const result = await this.db!.query('SELECT value FROM sync_meta WHERE key = ?', [key]);
      return result.values?.[0]?.value || null;
    },

    set: async (key: string, value: string): Promise<void> => {
      if (!this.isNative()) {
        localStorage.setItem(`findr_meta_${key}`, value);
        return;
      }

      await this.db!.run(
        'INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
        [key, value]
      );
    }
  };

  // ============================================
  // DATABASE MANAGEMENT
  // ============================================

  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite.closeConnection(DB_NAME, false);
      this.db = null;
    }
  }

  async clear(): Promise<void> {
    if (!this.isNative()) {
      localStorage.removeItem('findr_species');
      localStorage.removeItem('findr_predictions');
      localStorage.removeItem('findr_favourites');
      localStorage.removeItem('findr_conditions');
      return;
    }

    await this.db!.execute('DELETE FROM species');
    await this.db!.execute('DELETE FROM predictions');
    await this.db!.execute('DELETE FROM favourites');
    await this.db!.execute('DELETE FROM conditions');
    await this.db!.execute('DELETE FROM sync_meta');
  }

  // ============================================
  // ROW MAPPERS
  // ============================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSpeciesRow = (row: any): OfflineSpecies => ({
    id: row.id,
    speciesCode: row.species_code,
    slug: row.slug,
    scientificName: row.scientific_name,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    nameEs: row.name_es,
    nameDe: row.name_de,
    nameIt: row.name_it,
    namePt: row.name_pt,
    playfulBio: row.playful_bio_en,
    funFact: row.fun_fact,
    eatingQuality: row.eating_quality,
    conservationStatus: row.conservation_status,
    guild: row.guild,
    minDepth: row.min_depth,
    maxDepth: row.max_depth,
    tempOptC: row.temp_opt_c ? JSON.parse(row.temp_opt_c) : [],
    aliases: row.aliases ? JSON.parse(row.aliases) : [],
    advice: row.advice ? JSON.parse(row.advice) : {},
    bestTimes: row.best_times ? JSON.parse(row.best_times) : [],
    recommendedBaits: row.recommended_baits ? JSON.parse(row.recommended_baits) : [],
    speciesBadges: row.species_badges ? JSON.parse(row.species_badges) : [],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapPredictionRow = (row: any): OfflinePrediction => ({
    id: row.id,
    rectangleCode: row.rectangle_code,
    predictionDate: row.prediction_date,
    language: row.language,
    speciesCode: row.species_code,
    confidence: row.confidence,
    biteScore: row.bite_score,
    tempScore: row.temp_score,
    tideScore: row.tide_score,
    lightScore: row.light_score,
    lunarScore: row.lunar_score,
    habitatBonus: row.habitat_bonus,
    rationale: row.rationale,
    bestTimes: row.best_times ? JSON.parse(row.best_times) : [],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapFavouriteRow = (row: any): OfflineFavourite => ({
    id: row.id,
    speciesCode: row.species_code,
    notificationsEnabled: row.notifications_enabled === 1,
    notificationThreshold: row.notification_threshold,
    addedAt: new Date(row.added_at),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapConditionsRow = (row: any): OfflineConditions => ({
    rectangleCode: row.rectangle_code,
    seaTempC: row.sea_temp_c,
    salinityPsu: row.salinity_psu,
    waterClarity: row.water_clarity,
    waveHeight: row.wave_height,
    currentSpeed: row.current_speed,
    currentDirection: row.current_direction,
  });

  // ============================================
  // WEB FALLBACK (localStorage)
  // ============================================

  private webFallback = {
    getSpecies: (): OfflineSpecies[] => {
      const data = localStorage.getItem('findr_species');
      return data ? JSON.parse(data) : [];
    },

    setSpecies: (species: OfflineSpecies[]): void => {
      localStorage.setItem('findr_species', JSON.stringify(species));
      localStorage.setItem('findr_species_cached_at', new Date().toISOString());
    },

    getPredictions: (rectangleCode: string, date: string, language: string): OfflinePrediction[] => {
      const key = `findr_predictions_${rectangleCode}_${date}_${language}`;
      const data = localStorage.getItem(key);
      if (!data) return [];

      const parsed = JSON.parse(data);
      if (new Date(parsed.expiresAt) < new Date()) {
        localStorage.removeItem(key);
        return [];
      }
      return parsed.predictions;
    },

    setPredictions: (rectangleCode: string, date: string, language: string, predictions: OfflinePrediction[]): void => {
      const key = `findr_predictions_${rectangleCode}_${date}_${language}`;
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(key, JSON.stringify({ predictions, expiresAt }));
    },

    getFavourites: (): OfflineFavourite[] => {
      const data = localStorage.getItem('findr_favourites');
      return data ? JSON.parse(data) : [];
    },

    addFavourite: (speciesCode: string): void => {
      const favourites = this.webFallback.getFavourites();
      if (!favourites.some(f => f.speciesCode === speciesCode)) {
        favourites.push({
          id: Date.now().toString(),
          speciesCode,
          notificationsEnabled: false,
          notificationThreshold: 70,
          addedAt: new Date(),
        });
        localStorage.setItem('findr_favourites', JSON.stringify(favourites));
      }
    },

    removeFavourite: (speciesCode: string): void => {
      const favourites = this.webFallback.getFavourites().filter(f => f.speciesCode !== speciesCode);
      localStorage.setItem('findr_favourites', JSON.stringify(favourites));
    },

    getConditions: (rectangleCode: string): OfflineConditions | null => {
      const key = `findr_conditions_${rectangleCode}`;
      const data = localStorage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      if (new Date(parsed.expiresAt) < new Date()) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.conditions;
    },

    setConditions: (conditions: OfflineConditions): void => {
      const key = `findr_conditions_${conditions.rectangleCode}`;
      const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(key, JSON.stringify({ conditions, expiresAt }));
    },
  };
}

// Singleton instance
export const findrDb = new FindrOfflineDatabase();
