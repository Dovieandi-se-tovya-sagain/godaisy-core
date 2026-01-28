/**
 * useLocalSignals Hook
 *
 * Fetches and manages local signals for a given location.
 * Includes signal dismissal and mute functionality.
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LocalSignal,
  LocalSignalResult,
  SignalPreferences,
  SignalType,
} from '../lib/grow/localSignals';

// =============================================================================
// TYPES
// =============================================================================

interface UseLocalSignalsOptions {
  lat?: number;
  lon?: number;
  location?: string;
  enabled?: boolean;
}

interface UseLocalSignalsReturn {
  signals: LocalSignal[];
  loading: boolean;
  error: Error | null;
  locationName?: string;
  generatedAt?: string;
  refetch: () => void;
  dismissSignal: (signalId: string, expiresAt: string) => Promise<void>;
  muteSignalType: (signalType: string) => Promise<void>;
  unmuteSignalType: (signalType: string) => Promise<void>;
  preferences: SignalPreferences | null;
  preferencesLoading: boolean;
}

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

const DISMISSED_SIGNALS_KEY = 'grow_dismissed_signals';

interface DismissedSignal {
  signalId: string;
  expiresAt: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDismissedSignals(): DismissedSignal[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(DISMISSED_SIGNALS_KEY);
    if (!stored) return [];
    const dismissed: DismissedSignal[] = JSON.parse(stored);
    // Filter out expired dismissals
    const now = new Date();
    return dismissed.filter((d) => new Date(d.expiresAt) > now);
  } catch {
    return [];
  }
}

function saveDismissedSignal(signalId: string, expiresAt: string): void {
  if (typeof window === 'undefined') return;
  try {
    const dismissed = getDismissedSignals();
    dismissed.push({ signalId, expiresAt });
    localStorage.setItem(DISMISSED_SIGNALS_KEY, JSON.stringify(dismissed));
  } catch {
    // Ignore storage errors
  }
}

function isDismissed(signalId: string): boolean {
  const dismissed = getDismissedSignals();
  return dismissed.some((d) => d.signalId === signalId);
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchLocalSignals(
  lat: number,
  lon: number,
  mutedSignals: SignalType[] = []
): Promise<LocalSignalResult> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
  });

  if (mutedSignals.length > 0) {
    params.set('muted', mutedSignals.join(','));
  }

  const response = await fetch(`/api/grow/signals?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch local signals');
  }
  return response.json();
}

async function fetchSignalPreferences(token: string): Promise<SignalPreferences> {
  const response = await fetch('/api/grow/signals/preferences', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Not authenticated - return default preferences
      return { muted: [], minSeverity: 'low' };
    }
    throw new Error('Failed to fetch signal preferences');
  }

  const data = await response.json();
  return {
    muted: data.mutedSignals || [],
    minSeverity: data.minSeverity || 'low',
  };
}

async function _updateSignalPreferences(
  token: string,
  preferences: Partial<SignalPreferences>
): Promise<SignalPreferences> {
  const response = await fetch('/api/grow/signals/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mutedSignals: preferences.muted,
      minSeverity: preferences.minSeverity,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update signal preferences');
  }

  const data = await response.json();
  return {
    muted: data.mutedSignals || [],
    minSeverity: data.minSeverity || 'low',
  };
}

async function toggleSignalTypeMute(
  token: string,
  signalType: SignalType,
  muted: boolean
): Promise<SignalType[]> {
  const response = await fetch('/api/grow/signals/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      signalType,
      muted,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle signal mute');
  }

  const data = await response.json();
  return data.mutedSignals || [];
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useLocalSignals(options: UseLocalSignalsOptions = {}): UseLocalSignalsReturn {
  const { lat, lon, location, enabled = true } = options;
  const queryClient = useQueryClient();
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token from Supabase session
  useEffect(() => {
    async function getToken() {
      try {
        // Dynamic import to avoid SSR issues
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { session } } = await supabase.auth.getSession();
        setAuthToken(session?.access_token || null);
      } catch {
        setAuthToken(null);
      }
    }
    getToken();
  }, []);

  // Fetch preferences (for authenticated users)
  const {
    data: preferences,
    isLoading: preferencesLoading,
  } = useQuery({
    queryKey: ['signalPreferences', authToken],
    queryFn: () => fetchSignalPreferences(authToken!),
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch local signals
  const hasLocation = !!(lat && lon) || !!location;
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['localSignals', lat, lon, location, preferences?.muted],
    queryFn: () => {
      if (lat && lon) {
        return fetchLocalSignals(lat, lon, preferences?.muted || []);
      }
      // If only location string provided, the API will geocode it
      const params = new URLSearchParams();
      if (location) params.set('location', location);
      if (preferences?.muted?.length) params.set('muted', preferences.muted.join(','));
      return fetch(`/api/grow/signals?${params}`).then((r) => r.json());
    },
    enabled: enabled && hasLocation,
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Filter out dismissed signals
  const filteredSignals = (data?.signals || []).filter(
    (signal: LocalSignal) => !isDismissed(signal.id)
  );

  // Dismiss signal mutation
  const dismissMutation = useMutation({
    mutationFn: async ({ signalId, expiresAt }: { signalId: string; expiresAt: string }) => {
      saveDismissedSignal(signalId, expiresAt);
      return { signalId, expiresAt };
    },
    onSuccess: () => {
      // Invalidate to trigger re-filter
      queryClient.invalidateQueries({ queryKey: ['localSignals'] });
    },
  });

  // Mute signal type mutation
  const muteMutation = useMutation({
    mutationFn: async (signalType: SignalType) => {
      if (!authToken) {
        // For unauthenticated users, store in localStorage
        const stored = localStorage.getItem('grow_muted_signals');
        const muted: SignalType[] = stored ? JSON.parse(stored) : [];
        if (!muted.includes(signalType)) {
          muted.push(signalType);
          localStorage.setItem('grow_muted_signals', JSON.stringify(muted));
        }
        return muted;
      }
      return toggleSignalTypeMute(authToken, signalType, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signalPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['localSignals'] });
    },
  });

  // Unmute signal type mutation
  const unmuteMutation = useMutation({
    mutationFn: async (signalType: SignalType) => {
      if (!authToken) {
        const stored = localStorage.getItem('grow_muted_signals');
        const muted: SignalType[] = stored ? JSON.parse(stored) : [];
        const updated = muted.filter((t) => t !== signalType);
        localStorage.setItem('grow_muted_signals', JSON.stringify(updated));
        return updated;
      }
      return toggleSignalTypeMute(authToken, signalType, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signalPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['localSignals'] });
    },
  });

  // Callbacks
  const dismissSignal = useCallback(
    async (signalId: string, expiresAt: string) => {
      await dismissMutation.mutateAsync({ signalId, expiresAt });
    },
    [dismissMutation]
  );

  const muteSignalType = useCallback(
    async (signalType: string) => {
      await muteMutation.mutateAsync(signalType as SignalType);
    },
    [muteMutation]
  );

  const unmuteSignalType = useCallback(
    async (signalType: string) => {
      await unmuteMutation.mutateAsync(signalType as SignalType);
    },
    [unmuteMutation]
  );

  return {
    signals: filteredSignals,
    loading: isLoading,
    error: error as Error | null,
    locationName: data?.location?.name,
    generatedAt: data?.generatedAt,
    refetch,
    dismissSignal,
    muteSignalType,
    unmuteSignalType,
    preferences: preferences || null,
    preferencesLoading,
  };
}
