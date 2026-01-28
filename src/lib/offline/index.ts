/**
 * Offline Storage Module
 *
 * Provides offline-first data storage and sync for mobile apps.
 *
 * NOTE: App-specific sync modules (growSync, findrSync, findrDatabase) are
 * commented out and should be imported directly in the respective app repos.
 */

// Database layers
export { offlineDb, type Plant, type CalendarEntry, type Species } from './database';
// export { findrDb, type OfflineSpecies, type OfflinePrediction, type OfflineFavourite, type OfflineConditions } from './findrDatabase'; // Findr-specific

// Grow Daisy sync - TODO: Move to growdaisy repo
// export { growOfflineSync, type GrowSyncState } from './growSync';

// Findr sync - TODO: Move to findr repo
// export { findrSync, type FindrSyncState } from './findrSync';

// Mutation queue (persistent offline queue)
export { mutationQueue, type Mutation, type MutationType, type QueueState } from './mutationQueue';

// Image caching
export { imageCache } from './imageCache';

// Findr catch log sync - TODO: Move to findr repo
// export { getSyncService, SyncService, type SyncResult } from './sync';
