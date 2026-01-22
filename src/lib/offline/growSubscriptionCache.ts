/**
 * Grow Daisy Subscription Cache (IndexedDB)
 *
 * Offline-first caching for Grow subscription status with 24-hour TTL.
 * Separate from Findr subscription cache.
 *
 * @module lib/offline/growSubscriptionCache
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GrowSubscriptionTier, GrowSubscriptionType } from '@/lib/grow/subscription';

export interface GrowSubscriptionCache {
  userId: string;
  tier: GrowSubscriptionTier;
  subscriptionType: GrowSubscriptionType | null;
  stripeSubscriptionId: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  cachedAt: number;
}

export interface GrowUsageCache {
  userId: string;
  month: string;
  plantIdCalls: number;
  pestDiseaseCalls: number;
  expertQuestionCalls: number;
  photoCount: number;
  cachedAt: number;
}

interface GrowSubscriptionCacheSchema extends DBSchema {
  subscriptions: {
    key: string; // user_id
    value: GrowSubscriptionCache;
  };
  usage: {
    key: string; // user_id
    value: GrowUsageCache;
  };
}

const DB_NAME = 'grow_subscription_cache';
const DB_VERSION = 1;
const SUBSCRIPTION_STORE = 'subscriptions';
const USAGE_STORE = 'usage';
const SUBSCRIPTION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const USAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes (usage changes more frequently)

let dbPromise: Promise<IDBPDatabase<GrowSubscriptionCacheSchema>> | null = null;

/**
 * Initialize or get the IndexedDB instance.
 */
async function getDB(): Promise<IDBPDatabase<GrowSubscriptionCacheSchema>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB only available in browser');
  }

  if (!dbPromise) {
    dbPromise = openDB<GrowSubscriptionCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SUBSCRIPTION_STORE)) {
          db.createObjectStore(SUBSCRIPTION_STORE, { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains(USAGE_STORE)) {
          db.createObjectStore(USAGE_STORE, { keyPath: 'userId' });
        }
      },
    });
  }
  return dbPromise;
}

// =============================================================================
// SUBSCRIPTION CACHE
// =============================================================================

/**
 * Get cached Grow subscription for a user.
 */
export async function getCachedGrowSubscription(userId: string): Promise<GrowSubscriptionCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get(SUBSCRIPTION_STORE, userId);

    if (!cached) return null;

    // Check if cache is stale
    if (Date.now() - cached.cachedAt > SUBSCRIPTION_TTL_MS) {
      await db.delete(SUBSCRIPTION_STORE, userId);
      return null;
    }

    return cached;
  } catch (error) {
    console.error('Error reading Grow subscription cache:', error);
    return null;
  }
}

/**
 * Update cached Grow subscription.
 */
export async function setCachedGrowSubscription(data: Omit<GrowSubscriptionCache, 'cachedAt'>): Promise<void> {
  try {
    const db = await getDB();
    await db.put(SUBSCRIPTION_STORE, {
      ...data,
      cachedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error writing Grow subscription cache:', error);
  }
}

/**
 * Clear cached Grow subscription.
 */
export async function clearCachedGrowSubscription(userId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(SUBSCRIPTION_STORE, userId);
  } catch (error) {
    console.error('Error clearing Grow subscription cache:', error);
  }
}

// =============================================================================
// USAGE CACHE
// =============================================================================

/**
 * Get cached usage for a user.
 */
export async function getCachedGrowUsage(userId: string): Promise<GrowUsageCache | null> {
  try {
    const db = await getDB();
    const cached = await db.get(USAGE_STORE, userId);

    if (!cached) return null;

    // Check if cache is stale
    if (Date.now() - cached.cachedAt > USAGE_TTL_MS) {
      await db.delete(USAGE_STORE, userId);
      return null;
    }

    // Check if month has changed
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (cached.month !== currentMonth) {
      await db.delete(USAGE_STORE, userId);
      return null;
    }

    return cached;
  } catch (error) {
    console.error('Error reading Grow usage cache:', error);
    return null;
  }
}

/**
 * Update cached usage.
 */
export async function setCachedGrowUsage(data: Omit<GrowUsageCache, 'cachedAt'>): Promise<void> {
  try {
    const db = await getDB();
    await db.put(USAGE_STORE, {
      ...data,
      cachedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error writing Grow usage cache:', error);
  }
}

/**
 * Clear cached usage.
 */
export async function clearCachedGrowUsage(userId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(USAGE_STORE, userId);
  } catch (error) {
    console.error('Error clearing Grow usage cache:', error);
  }
}

/**
 * Clear all Grow caches.
 */
export async function clearAllGrowCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(SUBSCRIPTION_STORE);
    await db.clear(USAGE_STORE);
  } catch (error) {
    console.error('Error clearing all Grow cache:', error);
  }
}
