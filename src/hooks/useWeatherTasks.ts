/**
 * useWeatherTasks Hook
 *
 * Fetches weather-based task recommendations from the weather task engine.
 * Returns alerts, watering recommendations, and planting windows.
 *
 * Features:
 * - Auto-refetches when user's location changes
 * - Handles auth state changes
 * - Proper error handling and loading states
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface WeatherAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  forecastDate: string;
  forecastValue: number;
  affectedPlantIds: string[];
  suggestedAction: string;
}

export interface WateringRecommendation {
  shouldWater: boolean;
  reason: string;
  nextWateringDate: string;
  adjustmentFactor: number;
  details: string[];
}

export interface PlantingWindow {
  plantSlug: string;
  canPlantNow: boolean;
  reason: string;
  soilTempRequired: number;
  currentSoilTemp: number;
  daysUntilReady?: number;
}

export interface TaskAdjustment {
  taskType: string;
  originalUrgency: string;
  newUrgency: string;
  reason: string;
  suggestedDate?: string;
}

export interface WeatherTasksData {
  alerts: WeatherAlert[];
  wateringRecommendation: WateringRecommendation;
  plantingWindows: PlantingWindow[];
  taskAdjustments: TaskAdjustment[];
  forecast: Array<{
    date: string;
    tempMin: number;
    tempMax: number;
    humidity: number;
    precipitation: number;
    precipProbability: number;
  }>;
  soil: {
    temperature6cm: number;
    moisture1to3cm: number;
  };
  plantCount: number;
  generatedAt: string;
}

interface UseWeatherTasksResult {
  data: WeatherTasksData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Whether the user has a location set */
  hasLocation: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

export function useWeatherTasks(): UseWeatherTasksResult {
  const [data, setData] = useState<WeatherTasksData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [locationKey, setLocationKey] = useState<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Store userId in ref for realtime callback
  const userIdRef = useRef<string | null>(null);

  // Stable supabase client - useMemo ensures we don't recreate on every render
  const supabase = useMemo(() => createClient(), []);

  // Update ref when userId changes
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Check for authenticated user and their location
  useEffect(() => {
    isMounted.current = true;

    const checkUserAndLocation = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          console.error('[useWeatherTasks] Auth error:', authError);
          return;
        }

        if (!isMounted.current) return;

        setUserId(user?.id || null);
        userIdRef.current = user?.id || null;

        // Get user's location to use as a cache key
        if (user?.id) {
          const { data: prefs, error: prefsError } = await supabase
            .from('grow_user_preferences')
            .select('latitude, longitude')
            .eq('user_id', user.id)
            .single();

          if (prefsError && prefsError.code !== 'PGRST116') {
            // PGRST116 = no rows returned (user has no prefs yet)
            console.error('[useWeatherTasks] Prefs error:', prefsError);
          }

          if (!isMounted.current) return;

          if (prefs?.latitude && prefs?.longitude) {
            const newKey = `${prefs.latitude.toFixed(2)},${prefs.longitude.toFixed(2)}`;
            setLocationKey(newKey);
          } else {
            setLocationKey(null);
          }
        }
      } catch (err) {
        console.error('[useWeatherTasks] Error checking user:', err);
      }
    };

    checkUserAndLocation();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted.current) return;

      const newUserId = session?.user?.id || null;
      setUserId(newUserId);
      userIdRef.current = newUserId;

      if (!newUserId) {
        setLocationKey(null);
        setData(null);
        setError(null);
      }
    });

    // Listen for location preference changes - filter by current user
    const channelName = `grow_prefs_${Date.now()}`; // Unique channel name
    const prefsChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'grow_user_preferences',
        },
        (payload) => {
          if (!isMounted.current) return;

          const newPrefs = payload.new as { latitude?: number; longitude?: number; user_id?: string };

          // Only process if this is for the current user
          if (newPrefs.user_id !== userIdRef.current) {
            return;
          }

          if (newPrefs.latitude && newPrefs.longitude) {
            const newKey = `${newPrefs.latitude.toFixed(2)},${newPrefs.longitude.toFixed(2)}`;
            setLocationKey(prevKey => {
              // Only update if actually changed
              if (prevKey !== newKey) {
                console.log('[useWeatherTasks] Location changed, will refetch');
                return newKey;
              }
              return prevKey;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[useWeatherTasks] Realtime channel error');
        }
      });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      supabase.removeChannel(prefsChannel);
    };
  }, [supabase]);

  // Use ref to track loading state for the callback
  const isLoadingRef = useRef(false);

  const fetchWeatherTasks = useCallback(async () => {
    if (!userId) {
      setData(null);
      return;
    }

    // Don't fetch if already loading (prevent duplicate requests)
    if (isLoadingRef.current) {
      console.log('[useWeatherTasks] Skipping fetch - already loading');
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated - no access token');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch('/api/grow/weather-tasks', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!isMounted.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Session expired - please refresh the page');
        } else if (response.status === 400) {
          throw new Error(errorData.message || 'Please set your garden location in settings');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again later');
        }

        throw new Error(errorData.message || errorData.error || 'Failed to fetch weather tasks');
      }

      const result = await response.json();

      if (!isMounted.current) return;

      if (result.success) {
        setData({
          alerts: result.result?.alerts || [],
          wateringRecommendation: result.result?.wateringRecommendation || {
            shouldWater: false,
            reason: 'No data available',
            nextWateringDate: new Date().toISOString().split('T')[0],
            adjustmentFactor: 1.0,
            details: [],
          },
          plantingWindows: result.result?.plantingWindows || [],
          taskAdjustments: result.result?.taskAdjustments || [],
          forecast: result.forecast || [],
          soil: result.soil || { temperature6cm: 0, moisture1to3cm: 0 },
          plantCount: result.plantCount || 0,
          generatedAt: result.generatedAt || new Date().toISOString(),
        });
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      if (!isMounted.current) return;

      // Handle abort errors (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out - please try again');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load weather tasks';
        setError(message);
      }
      console.error('[useWeatherTasks] Error:', err);
    } finally {
      isLoadingRef.current = false;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) {
      fetchWeatherTasks();
    }
  }, [userId, locationKey, fetchWeatherTasks]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchWeatherTasks,
    hasLocation: locationKey !== null,
    isAuthenticated: userId !== null,
  };
}

/**
 * Get the icon name for an alert type
 */
export function getAlertIcon(type: string): string {
  const icons: Record<string, string> = {
    frost: 'snowflake',
    heat: 'thermometer-sun',
    wind: 'wind',
    storm: 'cloud-lightning',
    late_blight: 'bug',
    powdery_mildew: 'cloud-fog',
    botrytis: 'cloud-fog',
    aphids: 'bug',
    slugs: 'snail',
    wind_desiccation: 'wind',
    drought: 'sun',
    rain: 'cloud-rain',
  };
  return icons[type] || 'alert-triangle';
}

/**
 * Get the color class for an alert severity
 */
export function getAlertColor(severity: 'info' | 'warning' | 'critical'): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-900',
        icon: 'text-red-600',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-900',
        icon: 'text-amber-600',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        icon: 'text-blue-600',
      };
  }
}

/**
 * Categorize alerts by type
 */
export function categorizeAlerts(alerts: WeatherAlert[]): {
  weather: WeatherAlert[];
  pestDisease: WeatherAlert[];
} {
  const weatherTypes = ['frost', 'heat', 'wind', 'storm', 'drought', 'rain', 'wind_desiccation'];
  const pestDiseaseTypes = ['late_blight', 'powdery_mildew', 'botrytis', 'aphids', 'slugs'];

  return {
    weather: alerts.filter(a => weatherTypes.includes(a.type)),
    pestDisease: alerts.filter(a => pestDiseaseTypes.includes(a.type)),
  };
}
