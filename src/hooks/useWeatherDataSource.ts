/**
 * useWeatherDataSource Hook
 *
 * React hook for accessing weather data with automatic source selection.
 * Prioritizes personal weather station data over forecasts.
 *
 * @module hooks/useWeatherDataSource
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  WeatherDataSource,
  UnifiedWeatherData,
  getBestWeatherSource,
  getUnifiedWeatherData,
  getDataSourceDescription,
  getAccuracyBadge,
} from '@/lib/grow/weatherDataSource';

interface UseWeatherDataSourceOptions {
  latitude?: number;
  longitude?: number;
  /** Auto-refresh interval in ms (default: 5 minutes) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh */
  autoRefresh?: boolean;
}

interface UseWeatherDataSourceReturn {
  /** The current data source being used */
  source: WeatherDataSource | null;
  /** Unified weather data from the best source */
  data: UnifiedWeatherData | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Human-readable description of the data source */
  sourceDescription: string;
  /** Badge info for UI display */
  accuracyBadge: ReturnType<typeof getAccuracyBadge> | null;
  /** Whether user has a personal weather station */
  hasPersonalStation: boolean;
  /** Whether personal station data includes soil sensors */
  hasSoilData: boolean;
  /** Manually refresh the data */
  refresh: () => Promise<void>;
}

export function useWeatherDataSource(
  options: UseWeatherDataSourceOptions = {}
): UseWeatherDataSourceReturn {
  const {
    latitude,
    longitude,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    autoRefresh = true,
  } = options;

  const [source, setSource] = useState<WeatherDataSource | null>(null);
  const [data, setData] = useState<UnifiedWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSource(null);
        setData(null);
        return;
      }

      const userId = session.user.id;

      // Get the best data source
      const bestSource = await getBestWeatherSource(supabase, userId);
      setSource(bestSource);

      // Get unified weather data
      const weatherData = await getUnifiedWeatherData(
        supabase,
        userId,
        latitude,
        longitude
      );
      setData(weatherData);
    } catch (err) {
      console.error('[useWeatherDataSource] Error:', err);
      setError('Failed to fetch weather data');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, latitude, longitude]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Derived values
  const hasPersonalStation = source?.type === 'personal_station';
  const hasSoilData = !!(
    data?.soil_temp_1_c !== undefined ||
    data?.soil_moisture_1_pct !== undefined
  );
  const sourceDescription = source ? getDataSourceDescription(source) : '';
  const accuracyBadge = source ? getAccuracyBadge(source) : null;

  return {
    source,
    data,
    isLoading,
    error,
    sourceDescription,
    accuracyBadge,
    hasPersonalStation,
    hasSoilData,
    refresh: fetchData,
  };
}
