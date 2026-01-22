/**
 * Subscription Status Cache (IndexedDB)
 *
 * Offline-first caching for subscription status with 24-hour TTL.
 * Reduces database queries and provides instant feedback on subscription state.
 *
 * @module lib/offline/subscriptionCache
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SubscriptionCacheSchema extends DBSchema {
  subscriptions: {
    key: string; // user_id
    value: {
      userId: string;
      subscriptionStatus: 'free' | 'premium';
      paymentPlatform: 'web' | 'ios' | 'android';
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      subscriptionStartDate?: string | null;
      subscriptionEndDate?: string | null;
      trialEndsAt?: string | null;
      cachedAt: number; // Timestamp
    };
  };
}

const DB_NAME = 'findr_subscription_cache';
const DB_VERSION = 1;
const STORE_NAME = 'subscriptions';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let dbPromise: Promise<IDBPDatabase<SubscriptionCacheSchema>> | null = null;

/**
 * Initialize or get the IndexedDB instance.
 */
async function getDB(): Promise<IDBPDatabase<SubscriptionCacheSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SubscriptionCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get cached subscription status for a user.
 *
 * Returns null if:
 * - No cache exists
 * - Cache is stale (older than 24h)
 *
 * @param userId - User ID to look up
 * @returns Cached subscription data or null
 */
export async function getCachedSubscription(userId: string) {
  try {
    const db = await getDB();
    const cached = await db.get(STORE_NAME, userId);

    if (!cached) {
      return null;
    }

    // Check if cache is stale
    const age = Date.now() - cached.cachedAt;
    if (age > CACHE_TTL_MS) {
      // Clean up stale cache
      await db.delete(STORE_NAME, userId);
      return null;
    }

    return cached;
  } catch (error) {
    console.error('Error reading subscription cache:', error);
    return null;
  }
}

/**
 * Update cached subscription status for a user.
 *
 * @param data - Subscription data to cache
 */
export async function setCachedSubscription(data: {
  userId: string;
  subscriptionStatus: 'free' | 'premium';
  paymentPlatform: 'web' | 'ios' | 'android';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  trialEndsAt?: string | null;
}) {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, {
      ...data,
      cachedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error writing subscription cache:', error);
  }
}

/**
 * Clear cached subscription for a user.
 *
 * @param userId - User ID to clear
 */
export async function clearCachedSubscription(userId: string) {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, userId);
  } catch (error) {
    console.error('Error clearing subscription cache:', error);
  }
}

/**
 * Clear all cached subscriptions (useful for testing/debugging).
 */
export async function clearAllSubscriptionCache() {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Error clearing all subscription cache:', error);
  }
}
