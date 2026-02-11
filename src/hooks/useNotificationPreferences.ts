import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client';
import type { NotificationPreferences, UpdatePreferencesRequest } from '../pages/api/findr/notification-preferences';

/**
 * Fetch notification preferences from the API
 */
async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/findr/notification-preferences', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch notification preferences');
  }

  return response.json();
}

/**
 * Update notification preferences via the API
 */
async function updateNotificationPreferences(
  updates: UpdatePreferencesRequest
): Promise<NotificationPreferences> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/findr/notification-preferences', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update notification preferences');
  }

  return response.json();
}

/**
 * Hook for managing user notification preferences
 *
 * @returns Query object with preferences data and mutation for updates
 *
 * @example
 * ```tsx
 * const { data: preferences, isLoading, updatePreferences } = useNotificationPreferences();
 *
 * // Toggle hot bite alerts
 * updatePreferences.mutate({
 *   hot_bite_alerts_enabled: !preferences?.hot_bite_alerts_enabled
 * });
 *
 * // Enable daily email
 * updatePreferences.mutate({
 *   daily_email_enabled: true,
 *   daily_email_time: '08:00:00'
 * });
 * ```
 */
export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  // Fetch preferences
  const query = useQuery<NotificationPreferences>({
    queryKey: ['notificationPreferences'],
    queryFn: fetchNotificationPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: true, // Will fetch on mount
  });

  // Update preferences mutation
  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      // Update the cache with the new data
      queryClient.setQueryData(['notificationPreferences'], data);
    },
    onError: (error) => {
      console.error('[useNotificationPreferences] Update failed:', error);
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isAuthenticated: !query.isError, // If query succeeds, user is authenticated
    updatePreferences: mutation,
    refetch: query.refetch,
  };
}

/**
 * Type guard to check if preferences are loaded
 */
export function hasPreferences(
  preferences: NotificationPreferences | undefined
): preferences is NotificationPreferences {
  return preferences !== undefined;
}
