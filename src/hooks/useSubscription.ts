/**
 * Subscription Status Hook
 *
 * React hook for managing user subscription state with:
 * - Offline-first caching (IndexedDB, 24h TTL)
 * - Real-time updates via Supabase postgres_changes
 * - Automatic cache refresh on subscription changes
 *
 * @module hooks/useSubscription
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  getCachedSubscription,
  setCachedSubscription,
} from '@/lib/offline/subscriptionCache';

export interface SubscriptionStatus {
  userId: string;
  subscriptionStatus: 'free' | 'premium';
  paymentPlatform: 'web' | 'ios' | 'android';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  trialEndsAt?: string | null;
}

export interface UseSubscriptionState {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isPremium: boolean;
  isTrial: boolean;
}

/**
 * Hook to manage and monitor user subscription status.
 *
 * Features:
 * - Reads from cache first (instant UI feedback)
 * - Fetches fresh data from Supabase
 * - Subscribes to real-time updates (only for current user)
 * - Updates cache automatically on changes
 *
 * @param userId - User ID to fetch subscription for (optional, uses auth session if not provided)
 * @returns Subscription state with loading, error, and helper flags
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { subscription, isPremium, isLoading } = useSubscription();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isPremium) return <UpgradePrompt />;
 *   return <PremiumFeature />;
 * }
 * ```
 */
export function useSubscription(userId?: string): UseSubscriptionState {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const supabase = createClient();

  /**
   * Fetch subscription data from Supabase.
   */
  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user if userId not provided
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user');
        }
        targetUserId = user.id;
      }

      // Try cache first
      const cached = await getCachedSubscription(targetUserId);
      if (cached) {
        setSubscription(cached);
        setIsLoading(false);
      }

      // Fetch fresh data
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('subscription_status, payment_platform, stripe_customer_id, stripe_subscription_id, subscription_start_date, subscription_end_date, trial_ends_at')
        .eq('id', targetUserId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
      }

      if (!data) {
        throw new Error('No profile found');
      }

      const subscriptionData: SubscriptionStatus = {
        userId: targetUserId,
        subscriptionStatus: data.subscription_status as 'free' | 'premium',
        paymentPlatform: data.payment_platform as 'web' | 'ios' | 'android',
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        subscriptionStartDate: data.subscription_start_date,
        subscriptionEndDate: data.subscription_end_date,
        trialEndsAt: data.trial_ends_at,
      };

      // Update state and cache
      setSubscription(subscriptionData);
      await setCachedSubscription(subscriptionData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error fetching subscription');
      setError(error);
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  /**
   * Set up real-time subscription to profile changes.
   *
   * CRITICAL FIX: Filters by user ID to avoid updating state for ALL users' profile changes.
   */
  useEffect(() => {
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      // Fetch initial data
      await fetchSubscription();

      // Get user ID for realtime filter
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return;
        }
        targetUserId = user.id;
      }

      // Subscribe to profile changes (ONLY for this user)
      const channel = supabase
        .channel('subscription-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${targetUserId}`, // ✅ CRITICAL: Only listen to this user's updates
          },
          async (payload) => {
            // Double-check it's the right user (defense in depth)
            if (payload.new.id !== targetUserId) {
              return;
            }

            if (!isMounted) return;

            // Update state with new subscription data
            const newData: SubscriptionStatus = {
              userId: targetUserId,
              subscriptionStatus: payload.new.subscription_status as 'free' | 'premium',
              paymentPlatform: payload.new.payment_platform as 'web' | 'ios' | 'android',
              stripeCustomerId: payload.new.stripe_customer_id,
              stripeSubscriptionId: payload.new.stripe_subscription_id,
              subscriptionStartDate: payload.new.subscription_start_date,
              subscriptionEndDate: payload.new.subscription_end_date,
              trialEndsAt: payload.new.trial_ends_at,
            };

            setSubscription(newData);
            await setCachedSubscription(newData);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
    };
  }, [userId, fetchSubscription, supabase]);

  // Helper flags
  const isPremium = subscription?.subscriptionStatus === 'premium';
  const isTrial = isPremium && subscription?.trialEndsAt
    ? new Date(subscription.trialEndsAt) > new Date()
    : false;

  return {
    subscription,
    isLoading,
    error,
    refetch: fetchSubscription,
    isPremium,
    isTrial,
  };
}
