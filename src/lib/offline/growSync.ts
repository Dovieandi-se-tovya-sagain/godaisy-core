/**
 * Grow Daisy Offline Sync Layer
 *
 * Coordinates between offline SQLite database and remote API.
 * Implements offline-first pattern with background sync for Grow Daisy.
 * Uses persistent mutation queue for reliable offline-to-online sync.
 */

import { Network } from '@capacitor/network';
import { offlineDb, type Plant, type CalendarEntry } from './database';
import { api } from '../grow/api';
import { recordCacheHit } from '../performance/api-tracker';
import { mutationQueue, type Mutation } from './mutationQueue';

export interface GrowSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingChanges: number;
}

type SyncListener = (state: GrowSyncState) => void;

class GrowOfflineSyncManager {
  private state: GrowSyncState = {
    isOnline: true,
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: 0,
  };

  private listeners: Set<SyncListener> = new Set();
  private initialized = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await offlineDb.initialize();
    await mutationQueue.initialize();

    // Register mutation handlers
    this.registerMutationHandlers();

    const status = await Network.getStatus();
    this.state.isOnline = status.connected;

    Network.addListener('networkStatusChange', (newStatus) => {
      const wasOffline = !this.state.isOnline;
      this.state.isOnline = newStatus.connected;

      console.log('[GrowSync] Network:', newStatus.connected ? 'online' : 'offline');

      if (wasOffline && newStatus.connected) {
        this.syncPendingChanges();
      }

      this.notifyListeners();
    });

    // Subscribe to mutation queue changes
    mutationQueue.subscribe((queueState) => {
      this.state.pendingChanges = queueState.mutations.length;
      this.notifyListeners();
    });

    const lastSync = await offlineDb.meta.get('lastSyncAt');
    if (lastSync) {
      this.state.lastSyncAt = new Date(lastSync);
    }

    // Initial pending count from queue
    this.state.pendingChanges = mutationQueue.getPendingCount();

    this.syncInterval = setInterval(() => {
      if (this.state.isOnline && !this.state.isSyncing) {
        this.syncPendingChanges();
      }
    }, 5 * 60 * 1000);

    this.initialized = true;
    console.log('[GrowSync] Initialized with ' + this.state.pendingChanges + ' pending mutations');
  }

  /**
   * Register handlers for each mutation type
   */
  private registerMutationHandlers(): void {
    mutationQueue.registerHandler('CREATE_PLANT', async (mutation: Mutation) => {
      const payload = mutation.payload as Omit<Plant, 'id' | 'createdAt'>;
      try {
        const response = await api.addPlant({
          name: payload.name,
          type: payload.type,
          species_slug: payload.speciesSlug,
          variety: payload.variety,
          cultivar_id: payload.cultivarId,
          quantity: payload.quantity,
          location: payload.location,
          health: payload.health,
          planted_at: payload.planted?.toString(),
          notes: payload.notes,
        });

        // Update local database with server ID
        if (mutation.localId) {
          await offlineDb.plants.delete(mutation.localId);
          await offlineDb.plants.upsert({
            ...(payload as unknown as Plant),
            id: response.plant.id,
          });
        }

        return { success: true, serverId: response.plant.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create plant' };
      }
    });

    mutationQueue.registerHandler('UPDATE_PLANT', async (mutation: Mutation) => {
      const payload = mutation.payload as unknown as Plant;
      try {
        await api.updatePlant(payload.id, {
          name: payload.name,
          type: payload.type,
          species_slug: payload.speciesSlug,
          variety: payload.variety,
          cultivar_id: payload.cultivarId,
          quantity: payload.quantity,
          location: payload.location,
          health: payload.health,
          planted_at: payload.planted?.toString(),
          notes: payload.notes,
        });

        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update plant' };
      }
    });

    mutationQueue.registerHandler('DELETE_PLANT', async (mutation: Mutation) => {
      const { id } = mutation.payload as { id: string };
      try {
        await api.deletePlant(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete plant' };
      }
    });

    mutationQueue.registerHandler('LOG_WATERING', async (mutation: Mutation) => {
      const { plantId, timestamp } = mutation.payload as { plantId: string; timestamp: number };
      try {
        await api.updatePlant(plantId, {
          last_watered: new Date(timestamp).toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to log watering' };
      }
    });

    mutationQueue.registerHandler('UPDATE_HEALTH', async (mutation: Mutation) => {
      const { plantId, health } = mutation.payload as { plantId: string; health: string };
      try {
        await api.updatePlant(plantId, { health });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update health' };
      }
    });
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  getState(): GrowSyncState {
    return { ...this.state };
  }

  async getPlants(): Promise<{ plants: Plant[]; fromCache: boolean }> {
    const localPlants = await offlineDb.plants.getAll();

    if (localPlants.length > 0) {
      recordCacheHit('user-plants', 600);

      if (this.state.isOnline) {
        this.syncPlantsInBackground();
      }

      return { plants: localPlants, fromCache: true };
    }

    if (this.state.isOnline) {
      try {
        const response = await api.getUserPlants();
        const plants = this.normalizeApiPlants(response.plants || []);
        await offlineDb.plants.upsertMany(plants);
        return { plants, fromCache: false };
      } catch (error) {
        console.error('[GrowSync] Failed to fetch plants:', error);
        return { plants: [], fromCache: false };
      }
    }

    return { plants: [], fromCache: false };
  }

  async addPlant(plantData: Omit<Plant, 'id' | 'createdAt'>): Promise<Plant> {
    const localId = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const plant: Plant = {
      ...plantData,
      id: localId,
      createdAt: new Date(),
    };

    // Save to local database immediately (optimistic update)
    await offlineDb.plants.upsert(plant, true);

    // Queue mutation for server sync
    await mutationQueue.enqueue({
      type: 'CREATE_PLANT',
      payload: plantData as unknown as Record<string, unknown>,
      timestamp: Date.now(),
      localId,
    });

    // Try to sync immediately if online
    if (this.state.isOnline) {
      this.syncPendingChanges();
    }

    return plant;
  }

  async updatePlant(plant: Plant): Promise<void> {
    // Save to local database immediately (optimistic update)
    await offlineDb.plants.upsert(plant, true);

    // Don't queue updates for local-only plants (not yet synced)
    if (!plant.id.startsWith('local-')) {
      await mutationQueue.enqueue({
        type: 'UPDATE_PLANT',
        payload: plant as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });
    }

    // Try to sync immediately if online
    if (this.state.isOnline) {
      this.syncPendingChanges();
    }
  }

  async deletePlant(id: string): Promise<void> {
    // Delete from local database immediately
    await offlineDb.plants.delete(id);

    // If it's a local-only plant, no need to sync to server
    if (id.startsWith('local-')) {
      // Remove any pending create mutations for this plant
      const createMutations = mutationQueue.getMutationsByType('CREATE_PLANT');
      for (const mutation of createMutations) {
        if (mutation.localId === id) {
          await mutationQueue.dequeue(mutation.id);
        }
      }
      return;
    }

    // Queue deletion for server sync
    await mutationQueue.enqueue({
      type: 'DELETE_PLANT',
      payload: { id },
      timestamp: Date.now(),
    });

    // Try to sync immediately if online
    if (this.state.isOnline) {
      this.syncPendingChanges();
    }
  }

  /**
   * Log watering with offline support
   */
  async logWatering(plantId: string): Promise<void> {
    const timestamp = Date.now();

    // Update local database
    const plants = await offlineDb.plants.getAll();
    const plant = plants.find((p) => p.id === plantId);
    if (plant) {
      plant.lastWatered = new Date(timestamp);
      await offlineDb.plants.upsert(plant, true);
    }

    // Queue for sync (unless local-only plant)
    if (!plantId.startsWith('local-')) {
      await mutationQueue.enqueue({
        type: 'LOG_WATERING',
        payload: { plantId, timestamp },
        timestamp,
      });
    }

    if (this.state.isOnline) {
      this.syncPendingChanges();
    }
  }

  /**
   * Update plant health with offline support
   */
  async updatePlantHealth(plantId: string, health: Plant['health']): Promise<void> {
    // Update local database
    const plants = await offlineDb.plants.getAll();
    const plant = plants.find((p) => p.id === plantId);
    if (plant) {
      plant.health = health;
      await offlineDb.plants.upsert(plant, true);
    }

    // Queue for sync (unless local-only plant)
    if (!plantId.startsWith('local-')) {
      await mutationQueue.enqueue({
        type: 'UPDATE_HEALTH',
        payload: { plantId, health },
        timestamp: Date.now(),
      });
    }

    if (this.state.isOnline) {
      this.syncPendingChanges();
    }
  }

  private async syncPlantsInBackground(): Promise<void> {
    if (this.state.isSyncing) return;

    try {
      const response = await api.getUserPlants();
      const serverPlants = this.normalizeApiPlants(response.plants || []);
      await offlineDb.plants.upsertMany(serverPlants);
      console.log('[GrowSync] Synced ' + serverPlants.length + ' plants from server');
    } catch (error) {
      console.warn('[GrowSync] Background sync failed:', error);
    }
  }

  async getPlantingCalendar(lat: number, lon: number): Promise<{ entries: CalendarEntry[]; fromCache: boolean }> {
    const isCached = await offlineDb.calendar.isCached(lat, lon);

    if (isCached) {
      const entries = await offlineDb.calendar.getForLocation(lat, lon);
      recordCacheHit('planting-calendar', 3600);

      if (this.state.isOnline) {
        this.refreshCalendarInBackground(lat, lon);
      }

      return { entries, fromCache: true };
    }

    if (this.state.isOnline) {
      try {
        const response = await api.getPlantingCalendar(lat, lon);
        const entries = this.normalizeCalendarEntries(response.windows || []);
        await offlineDb.calendar.cacheForLocation(lat, lon, entries);
        return { entries, fromCache: false };
      } catch (error) {
        console.error('[GrowSync] Failed to fetch calendar:', error);
      }
    }

    return { entries: [], fromCache: false };
  }

  private async refreshCalendarInBackground(lat: number, lon: number): Promise<void> {
    try {
      const response = await api.getPlantingCalendar(lat, lon);
      const entries = this.normalizeCalendarEntries(response.windows || []);
      await offlineDb.calendar.cacheForLocation(lat, lon, entries);
    } catch (error) {
      console.warn('[GrowSync] Calendar refresh failed:', error);
    }
  }

  async syncPendingChanges(): Promise<void> {
    if (!this.state.isOnline || this.state.isSyncing) return;

    const pendingCount = mutationQueue.getPendingCount();
    if (pendingCount === 0) {
      return;
    }

    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      console.log('[GrowSync] Processing ' + pendingCount + ' queued mutations...');

      const result = await mutationQueue.processQueue();

      this.state.lastSyncAt = new Date();
      await offlineDb.meta.set('lastSyncAt', this.state.lastSyncAt.toISOString());

      console.log('[GrowSync] Sync complete: ' + result.processed + ' succeeded, ' + result.failed + ' failed');
    } catch (error) {
      console.error('[GrowSync] Sync failed:', error);
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  async forceSync(): Promise<void> {
    if (!this.state.isOnline) {
      console.warn('[GrowSync] Cannot sync while offline');
      return;
    }

    await this.syncPendingChanges();
    await this.syncPlantsInBackground();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeApiPlants(plants: any[]): Plant[] {
    return plants.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      speciesSlug: p.species_slug || p.speciesSlug,
      variety: p.variety,
      cultivarId: p.cultivar_id || p.cultivarId,
      quantity: p.quantity,
      location: p.location,
      health: p.health || 'good',
      planted: p.planted_at ? new Date(p.planted_at) : p.planted ? new Date(p.planted) : undefined,
      lastWatered: p.last_watered ? new Date(p.last_watered) : undefined,
      notes: p.notes,
      createdAt: p.created_at ? new Date(p.created_at) : new Date(),
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeCalendarEntries(entries: any[]): CalendarEntry[] {
    return entries.map((e) => ({
      id: e.id || (e.plant_slug || e.plantSlug) + '-' + e.action + '-' + Date.now(),
      plantSlug: e.plant_slug || e.plantSlug,
      plantName: e.plant_name || e.plantName || e.name,
      action: e.action || e.task_type || 'plant',
      startMonth: e.start_month || e.startMonth,
      endMonth: e.end_month || e.endMonth,
      startDay: e.start_day || e.startDay,
      endDay: e.end_day || e.endDay,
      priority: e.priority,
      indoorOutdoor: e.indoor_outdoor || e.indoorOutdoor,
      notes: e.notes,
    }));
  }

  async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    await offlineDb.close();
  }
}

export const growOfflineSync = new GrowOfflineSyncManager();
