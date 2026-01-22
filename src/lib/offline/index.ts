/**
 * Offline Storage Module
 *
 * Provides offline-first data storage and sync for mobile apps.
 */

// Database layers
export { offlineDb, type Plant, type CalendarEntry, type Species } from './database';
export { findrDb, type OfflineSpecies, type OfflinePrediction, type OfflineFavourite, type OfflineConditions } from './findrDatabase';

// Grow Daisy sync
export { growOfflineSync, type GrowSyncState } from './growSync';

// Findr sync (species, predictions, conditions)
export { findrSync, type FindrSyncState } from './findrSync';

// Mutation queue (persistent offline queue)
export { mutationQueue, type Mutation, type MutationType, type QueueState } from './mutationQueue';

// Image caching
export { imageCache } from './imageCache';

// Findr catch log sync (existing)
export { getSyncService, SyncService, type SyncResult } from './sync';
