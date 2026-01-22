/**
 * Findr Offline Sync Service
 *
 * Coordinates between offline SQLite database and Findr API.
 * Implements offline-first pattern with background sync.
 *
 * Usage:
 * ```typescript
 * import { findrSync } from './findrSync';
 *
 * await findrSync.initialize();
 *
 * // Get species (from cache or server)
 * const species = await findrSync.getSpecies();
 *
 * // Get predictions (cached or fresh)
 * const predictions = await findrSync.getPredictions('31F1', '2025-01-15', 'en');
 * ```
 */

import { Network } from '@capacitor/network';
import { findrDb, type OfflineSpecies, type OfflinePrediction, type OfflineConditions } from './findrDatabase';

// Cache TTLs
const SPECIES_CACHE_TTL_HOURS = 24 * 7; // 1 week - species data rarely changes
const PREDICTIONS_CACHE_TTL_HOURS = 6;   // 6 hours - same as server
const CONDITIONS_CACHE_TTL_HOURS = 3;    // 3 hours

export interface FindrSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  speciesCachedAt: Date | null;
  speciesCount: number;
}

type SyncListener = (state: FindrSyncState) => void;

class FindrSyncManager {
  private state: FindrSyncState = {
    isOnline: true,
    isSyncing: false,
    speciesCachedAt: null,
    speciesCount: 0,
  };

  private listeners: Set<SyncListener> = new Set();
  private initialized = false;

  /**
   * Initialize the sync manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await findrDb.initialize();

    // Get network status
    const status = await Network.getStatus();
    this.state.isOnline = status.connected;

    // Listen for network changes
    Network.addListener('networkStatusChange', (newStatus) => {
      this.state.isOnline = newStatus.connected;
      console.log('[FindrSync] Network:', newStatus.connected ? 'online' : 'offline');
      this.notifyListeners();
    });

    // Load cached species info
    this.state.speciesCachedAt = await findrDb.species.getLastCachedAt();
    this.state.speciesCount = await findrDb.species.getCount();

    this.initialized = true;
    console.log('[FindrSync] Initialized, ' + this.state.speciesCount + ' species cached');
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current sync state
   */
  getState(): FindrSyncState {
    return { ...this.state };
  }

  // ============================================
  // SPECIES
  // ============================================

  /**
   * Get all species (from cache or server)
   */
  async getSpecies(forceRefresh = false): Promise<{ species: OfflineSpecies[]; fromCache: boolean }> {
    await this.initialize();

    // Check if cache is fresh
    const cacheAge = this.getCacheAgeHours(this.state.speciesCachedAt);
    const cacheIsFresh = !forceRefresh && cacheAge !== null && cacheAge < SPECIES_CACHE_TTL_HOURS;

    // Return from cache if fresh
    if (cacheIsFresh && this.state.speciesCount > 0) {
      const species = await findrDb.species.getAll();
      if (species.length > 0) {
        console.log('[FindrSync] Returning ' + species.length + ' species from cache');

        // Background refresh if online and cache is > 1 day old
        if (this.state.isOnline && cacheAge && cacheAge > 24) {
          this.refreshSpeciesInBackground();
        }

        return { species, fromCache: true };
      }
    }

    // Fetch from server if online
    if (this.state.isOnline) {
      try {
        const freshSpecies = await this.fetchSpeciesFromServer();
        await findrDb.species.upsertMany(freshSpecies);
        this.state.speciesCachedAt = new Date();
        this.state.speciesCount = freshSpecies.length;
        this.notifyListeners();
        return { species: freshSpecies, fromCache: false };
      } catch (error) {
        console.error('[FindrSync] Failed to fetch species:', error);
      }
    }

    // Fall back to cache even if stale
    const cachedSpecies = await findrDb.species.getAll();
    return { species: cachedSpecies, fromCache: true };
  }

  /**
   * Get species by code
   */
  async getSpeciesByCode(code: string): Promise<OfflineSpecies | null> {
    await this.initialize();

    // Try cache first
    const cached = await findrDb.species.getByCode(code);
    if (cached) return cached;

    // Fetch all species if cache is empty
    if (this.state.speciesCount === 0 && this.state.isOnline) {
      await this.getSpecies();
      return findrDb.species.getByCode(code);
    }

    return null;
  }

  /**
   * Get species by slug
   */
  async getSpeciesBySlug(slug: string): Promise<OfflineSpecies | null> {
    await this.initialize();

    const cached = await findrDb.species.getBySlug(slug);
    if (cached) return cached;

    if (this.state.speciesCount === 0 && this.state.isOnline) {
      await this.getSpecies();
      return findrDb.species.getBySlug(slug);
    }

    return null;
  }

  /**
   * Refresh species in background
   */
  private async refreshSpeciesInBackground(): Promise<void> {
    if (this.state.isSyncing) return;

    try {
      console.log('[FindrSync] Background refresh of species...');
      const freshSpecies = await this.fetchSpeciesFromServer();
      await findrDb.species.upsertMany(freshSpecies);
      this.state.speciesCachedAt = new Date();
      this.state.speciesCount = freshSpecies.length;
      this.notifyListeners();
    } catch (error) {
      console.warn('[FindrSync] Background refresh failed:', error);
    }
  }

  /**
   * Fetch species from server API
   */
  private async fetchSpeciesFromServer(): Promise<OfflineSpecies[]> {
    const response = await fetch('/api/findr/species');
    if (!response.ok) {
      throw new Error('Failed to fetch species: ' + response.status);
    }

    const data = await response.json();
    return this.normalizeSpecies(data.species || []);
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  /**
   * Get predictions for a rectangle and date
   */
  async getPredictions(
    rectangleCode: string,
    date: string,
    language = 'en',
    forceRefresh = false
  ): Promise<{ predictions: OfflinePrediction[]; fromCache: boolean }> {
    await this.initialize();

    // Check cache first
    if (!forceRefresh) {
      const cached = await findrDb.predictions.getForRectangle(rectangleCode, date, language);
      if (cached.length > 0) {
        console.log('[FindrSync] Returning ' + cached.length + ' predictions from cache');
        return { predictions: cached, fromCache: true };
      }
    }

    // Fetch from server if online
    if (this.state.isOnline) {
      try {
        const fresh = await this.fetchPredictionsFromServer(rectangleCode, date, language);
        await findrDb.predictions.cache(rectangleCode, date, language, fresh, PREDICTIONS_CACHE_TTL_HOURS);
        return { predictions: fresh, fromCache: false };
      } catch (error) {
        console.error('[FindrSync] Failed to fetch predictions:', error);
      }
    }

    // Return empty if no cache and offline
    return { predictions: [], fromCache: false };
  }

  /**
   * Check if predictions are cached
   */
  async hasCachedPredictions(rectangleCode: string, date: string, language = 'en'): Promise<boolean> {
    await this.initialize();
    return findrDb.predictions.isCached(rectangleCode, date, language);
  }

  /**
   * Fetch predictions from server
   */
  private async fetchPredictionsFromServer(
    rectangleCode: string,
    date: string,
    language: string
  ): Promise<OfflinePrediction[]> {
    const response = await fetch('/api/findr/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rectangleCode, predictionDate: date, language }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch predictions: ' + response.status);
    }

    const data = await response.json();
    return this.normalizePredictions(rectangleCode, date, language, data.predictions || []);
  }

  // ============================================
  // CONDITIONS
  // ============================================

  /**
   * Get environmental conditions for a rectangle
   */
  async getConditions(rectangleCode: string, forceRefresh = false): Promise<OfflineConditions | null> {
    await this.initialize();

    // Check cache first
    if (!forceRefresh) {
      const cached = await findrDb.conditions.get(rectangleCode);
      if (cached) {
        return cached;
      }
    }

    // Fetch from server if online
    if (this.state.isOnline) {
      try {
        const fresh = await this.fetchConditionsFromServer(rectangleCode);
        if (fresh) {
          await findrDb.conditions.cache(fresh, CONDITIONS_CACHE_TTL_HOURS);
        }
        return fresh;
      } catch (error) {
        console.error('[FindrSync] Failed to fetch conditions:', error);
      }
    }

    return null;
  }

  /**
   * Fetch conditions from server
   */
  private async fetchConditionsFromServer(rectangleCode: string): Promise<OfflineConditions | null> {
    const response = await fetch(`/api/findr/conditions?rectangle=${rectangleCode}`);
    if (!response.ok) {
      throw new Error('Failed to fetch conditions: ' + response.status);
    }

    const data = await response.json();
    if (!data.conditions) return null;

    return {
      rectangleCode,
      seaTempC: data.conditions.sea_temp_c,
      salinityPsu: data.conditions.salinity_psu,
      waterClarity: data.conditions.water_clarity,
      waveHeight: data.conditions.wave_height,
      currentSpeed: data.conditions.current_speed,
      currentDirection: data.conditions.current_direction,
    };
  }

  // ============================================
  // FAVOURITES (handled by existing hook, but can sync)
  // ============================================

  /**
   * Sync favourites from localStorage to SQLite
   */
  async syncFavouritesFromLocalStorage(): Promise<void> {
    const stored = localStorage.getItem('findrFavorites');
    if (!stored) return;

    try {
      const codes: string[] = JSON.parse(stored);
      for (const code of codes) {
        await findrDb.favourites.add(code, false);
      }
      console.log('[FindrSync] Synced ' + codes.length + ' favourites from localStorage');
    } catch (error) {
      console.error('[FindrSync] Failed to sync favourites:', error);
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private getCacheAgeHours(cachedAt: Date | null): number | null {
    if (!cachedAt) return null;
    return (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeSpecies(species: any[]): OfflineSpecies[] {
    return species.map((s) => ({
      id: s.id,
      speciesCode: s.species_code || s.speciesCode,
      slug: s.slug,
      scientificName: s.scientific_name || s.scientificName,
      nameEn: s.name_en || s.nameEn || s.name,
      nameFr: s.name_fr || s.nameFr,
      nameEs: s.name_es || s.nameEs,
      nameDe: s.name_de || s.nameDe,
      nameIt: s.name_it || s.nameIt,
      namePt: s.name_pt || s.namePt,
      playfulBio: s.playful_bio_en || s.playfulBio,
      funFact: s.fun_fact || s.funFact,
      eatingQuality: s.eating_quality || s.eatingQuality,
      conservationStatus: s.conservation_status || s.conservationStatus,
      guild: s.guild,
      minDepth: s.min_depth || s.minDepth,
      maxDepth: s.max_depth || s.maxDepth,
      tempOptC: s.temp_opt_c || s.tempOptC,
      aliases: s.aliases,
      advice: s.advice,
      bestTimes: s.best_times || s.bestTimes,
      recommendedBaits: s.recommended_baits || s.recommendedBaits,
      speciesBadges: s.species_badges || s.speciesBadges,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizePredictions(rectangleCode: string, date: string, language: string, predictions: any[]): OfflinePrediction[] {
    return predictions.map((p) => ({
      id: `${rectangleCode}-${date}-${p.species_code || p.speciesCode}`,
      rectangleCode,
      predictionDate: date,
      language,
      speciesCode: p.species_code || p.speciesCode || p.species_id,
      confidence: p.confidence_percent ?? p.confidence ?? 0,
      biteScore: p.bite_score || p.biteScore,
      tempScore: p.temp_score || p.tempScore,
      tideScore: p.tide_score || p.tideScore,
      lightScore: p.light_score || p.lightScore,
      lunarScore: p.lunar_score || p.lunarScore,
      habitatBonus: p.habitat_bonus || p.habitatBonus,
      rationale: p.rationale,
      bestTimes: p.best_times || p.bestTimes,
    }));
  }

  /**
   * Force refresh all cached data
   */
  async forceRefreshAll(): Promise<void> {
    if (!this.state.isOnline) {
      console.warn('[FindrSync] Cannot refresh while offline');
      return;
    }

    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      await this.getSpecies(true);
      await findrDb.predictions.clearExpired();
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Cleanup expired data
   */
  async cleanup(): Promise<void> {
    await findrDb.predictions.clearExpired();
  }
}

// Singleton instance
export const findrSync = new FindrSyncManager();
