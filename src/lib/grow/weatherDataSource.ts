/**
 * Weather Data Source Priority System
 *
 * Determines the best available weather data source and provides
 * unified access to weather conditions regardless of source.
 *
 * Priority Order (highest to lowest):
 * 1. Personal Weather Station - Most accurate (at your exact location)
 * 2. Generic Weather Forecast - Covers larger area (less accurate)
 *
 * @module lib/grow/weatherDataSource
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type WeatherDataSourceType = 'personal_station' | 'forecast';

export interface WeatherDataSource {
  type: WeatherDataSourceType;
  name: string;
  description: string;
  accuracy: 'high' | 'medium' | 'low';
  integrationId?: string;
  stationName?: string;
  lastSync?: string;
}

export interface UnifiedWeatherData {
  source: WeatherDataSource;
  temperature_c?: number;
  humidity_percent?: number;
  pressure_mb?: number;
  wind_speed_mps?: number;
  wind_direction_deg?: number;
  wind_gust_mps?: number;
  rain_mm_hour?: number;
  rain_mm_day?: number;
  uv_index?: number;
  solar_radiation_wm2?: number;
  dew_point_c?: number;
  feels_like_c?: number;
  // Soil data (only from personal stations with sensors)
  soil_temp_1_c?: number;
  soil_temp_2_c?: number;
  soil_temp_3_c?: number;
  soil_temp_4_c?: number;
  soil_moisture_1_pct?: number;
  soil_moisture_2_pct?: number;
  soil_moisture_3_pct?: number;
  soil_moisture_4_pct?: number;
  // Metadata
  recorded_at?: string;
  is_stale?: boolean; // True if data is older than 1 hour
}

// =============================================================================
// DATA SOURCE DESCRIPTIONS
// =============================================================================

const SOURCE_INFO: Record<WeatherDataSourceType, Omit<WeatherDataSource, 'integrationId' | 'stationName' | 'lastSync'>> = {
  personal_station: {
    type: 'personal_station',
    name: 'Your Weather Station',
    description: 'Real-time data from your garden',
    accuracy: 'high',
  },
  forecast: {
    type: 'forecast',
    name: 'Weather Forecast',
    description: 'Regional forecast data',
    accuracy: 'medium',
  },
};

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get the best available weather data source for a user
 */
export async function getBestWeatherSource(
  supabase: SupabaseClient,
  userId: string
): Promise<WeatherDataSource> {
  // Check for personal weather station
  const { data: stationIntegration } = await supabase
    .from('grow_user_integrations')
    .select('id, device_name, last_sync_at, integration_type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('integration_type', ['tempest', 'ambient_weather', 'netatmo', 'ecowitt', 'weatherlink'])
    .order('last_sync_at', { ascending: false })
    .limit(1)
    .single();

  if (stationIntegration) {
    return {
      ...SOURCE_INFO.personal_station,
      integrationId: stationIntegration.id,
      stationName: stationIntegration.device_name,
      lastSync: stationIntegration.last_sync_at,
    };
  }

  // Fall back to forecast
  return SOURCE_INFO.forecast;
}

/**
 * Get unified weather data from the best available source
 */
export async function getUnifiedWeatherData(
  supabase: SupabaseClient,
  userId: string,
  latitude?: number,
  longitude?: number
): Promise<UnifiedWeatherData | null> {
  const source = await getBestWeatherSource(supabase, userId);

  if (source.type === 'personal_station' && source.integrationId) {
    // Get latest data from personal weather station
    const { data: stationData, error } = await supabase
      .from('grow_weather_station_data')
      .select('*')
      .eq('integration_id', source.integrationId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !stationData) {
      // Station has no data yet, fall back to forecast
      return getWeatherFromForecast(supabase, latitude, longitude);
    }

    // Check if data is stale (older than 1 hour)
    const recordedAt = new Date(stationData.recorded_at);
    const isStale = Date.now() - recordedAt.getTime() > 60 * 60 * 1000;

    return {
      source,
      temperature_c: stationData.temperature_c,
      humidity_percent: stationData.humidity_percent,
      pressure_mb: stationData.pressure_mb,
      wind_speed_mps: stationData.wind_speed_mps,
      wind_direction_deg: stationData.wind_direction_deg,
      wind_gust_mps: stationData.wind_gust_mps,
      rain_mm_hour: stationData.rain_mm_hour,
      rain_mm_day: stationData.rain_mm_day,
      uv_index: stationData.uv_index,
      solar_radiation_wm2: stationData.solar_radiation_wm2,
      dew_point_c: stationData.dew_point_c,
      feels_like_c: stationData.feels_like_c,
      // Soil data
      soil_temp_1_c: stationData.soil_temp_1_c,
      soil_temp_2_c: stationData.soil_temp_2_c,
      soil_temp_3_c: stationData.soil_temp_3_c,
      soil_temp_4_c: stationData.soil_temp_4_c,
      soil_moisture_1_pct: stationData.soil_moisture_1_pct,
      soil_moisture_2_pct: stationData.soil_moisture_2_pct,
      soil_moisture_3_pct: stationData.soil_moisture_3_pct,
      soil_moisture_4_pct: stationData.soil_moisture_4_pct,
      recorded_at: stationData.recorded_at,
      is_stale: isStale,
    };
  }

  // Use forecast data
  return getWeatherFromForecast(supabase, latitude, longitude);
}

/**
 * Get weather data from forecast (fallback)
 * Note: This returns null as forecast data should be fetched via the main weather API.
 * The latitude/longitude params are reserved for future direct forecast integration.
 */
async function getWeatherFromForecast(
  _supabase: SupabaseClient,
  _latitude?: number,
  _longitude?: number
): Promise<UnifiedWeatherData | null> {
  // This would integrate with your existing weather API
  // For now, return null to indicate forecast should be fetched separately
  return null;
}

/**
 * Check if user has any weather integrations
 */
export async function hasWeatherIntegration(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('grow_user_integrations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('integration_type', ['tempest', 'ambient_weather', 'netatmo', 'ecowitt', 'weatherlink']);

  return (count ?? 0) > 0;
}

/**
 * Check if user has soil sensor data available
 */
export async function hasSoilSensors(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: integrations } = await supabase
    .from('grow_user_integrations')
    .select('metadata')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('integration_type', ['ambient_weather', 'ecowitt', 'weatherlink']);

  if (!integrations || integrations.length === 0) return false;

  return integrations.some(
    i => (i.metadata as Record<string, unknown>)?.has_soil_sensors === true
  );
}

/**
 * Get a human-readable description of the current data source
 */
export function getDataSourceDescription(source: WeatherDataSource): string {
  if (source.type === 'personal_station') {
    return `Using real-time data from ${source.stationName || 'your weather station'}`;
  }
  return 'Using regional weather forecast';
}

/**
 * Get accuracy badge info for UI display
 */
export function getAccuracyBadge(source: WeatherDataSource): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (source.accuracy) {
    case 'high':
      return {
        label: 'Your Garden',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-100',
      };
    case 'medium':
      return {
        label: 'Regional',
        color: 'text-amber-700',
        bgColor: 'bg-amber-100',
      };
    case 'low':
      return {
        label: 'Approximate',
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
      };
  }
}
