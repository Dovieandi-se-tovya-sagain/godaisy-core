import { fetchWeatherApi } from 'openmeteo';
import { monitoredFetch, weatherMetrics } from '../monitoring/weatherMetrics';
import {
  round3dp as round3dpUtil,
  round1dp,
  createCacheKey,
  COORDINATE_PRECISION
} from '../utils/coordinates';
import { getSupabaseServerClient } from '../supabase/serverClient';

/**
 * Normalize and merge core weather fields (clouds, rain, snow, etc.) with fallback logic
 *
 * For land locations: OpenWeather > Open-Meteo > Stormglass
 * For marine locations: Stormglass > OpenWeather > Open-Meteo
 *
 * @param openWeatherData OpenWeather response (One Call or Day Summary)
 * @param openMeteoData Open-Meteo response
 * @param stormglassData Stormglass response
 * @param isMarine boolean (true for marine locations)
 * @returns Unified object: { clouds, rain, snow, snowDepth, ... }
 */
type Json = Record<string, unknown>;
type Source = Json | null | undefined;

/** Coordinate precision + grouping (free tier: 3 decimal places ≈ 110 m) */
const round3dp = round3dpUtil; // Use shared utility
const coordKey3dp = (lat: number, lon: number) => createCacheKey(lat, lon, COORDINATE_PRECISION.STANDARD);
const round4dp = (n: number) => Math.round(n * 1e4) / 1e4;

type Spot = { id: string; name: string; lat: number; lon: number };

type MetNoInstantDetails = {
  sea_surface_wave_height?: number;
  sea_surface_wave_from_direction?: number;
  sea_water_temperature?: number;
  sea_water_speed?: number;
  sea_water_to_direction?: number;
  wind_speed?: number;
  wind_from_direction?: number;
  air_pressure_at_sea_level?: number;
  air_temperature?: number;
  cloud_area_fraction?: number;
  relative_humidity?: number;
};

interface MetNoOceanTimeseriesEntry {
  time?: string;
  data?: {
    instant?: {
      details?: MetNoInstantDetails;
    };
  };
}

interface MetNoOceanForecastResponse {
  properties?: {
    timeseries?: MetNoOceanTimeseriesEntry[];
  };
}

interface MetNoLocationForecastResponse {
  properties?: {
    timeseries?: MetNoOceanTimeseriesEntry[];
  };
}

interface MetNoMarineSeriesHour {
  timeISO: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodSeconds: number | null;
  seaTemperatureC: number | null;
  windSpeedMS: number | null;
  windSpeedKts: number | null;
  windDirectionDeg: number | null;
  currentSpeedMS: number | null;
  currentDirectionDeg: number | null;
  airPressureHpa: number | null;
  cloudCoverPct: number | null;
}

interface MetNoMarineSeriesResult {
  hours: MetNoMarineSeriesHour[];
  firstHour: MetNoMarineSeriesHour;
}

type MetNoMarineOptions = MetNoFetchOptions & {
  startISO?: string;
  endISO?: string;
  maxHours?: number;
};

function groupAndLimitByCell<T extends { lat: number; lon: number }>(items: T[], maxCells = 3) {
  const byKey = new Map<string, { key: string; lat: number; lon: number; items: T[] }>();
  for (const it of items) {
    const key = coordKey3dp(it.lat, it.lon);
    if (!byKey.has(key)) byKey.set(key, { key, lat: round3dp(it.lat), lon: round3dp(it.lon), items: [] });
    byKey.get(key)!.items.push(it);
  }
  return [...byKey.values()].sort((a, b) => b.items.length - a.items.length).slice(0, maxCells);
}

const DEFAULT_METNO_AGENT = 'WotNow/1.0 (hello@wotnow.app)';

type MetNoFetchOptions = {
  signal?: AbortSignal;
  userAgent?: string;
};

function buildMetNoHeaders(options?: MetNoFetchOptions): Record<string, string> {
  const ua = options?.userAgent
    ?? process.env.METNO_USER_AGENT
    ?? process.env.NEXT_PUBLIC_METNO_USER_AGENT
    ?? DEFAULT_METNO_AGENT;
  return {
    'User-Agent': ua,
    Accept: 'application/json',
  };
}

async function fetchMetNoOceanForecast(
  lat: number,
  lon: number,
  options?: MetNoFetchOptions
): Promise<MetNoOceanForecastResponse | null> {
  const url = new URL('https://api.met.no/weatherapi/oceanforecast/2.0/complete');
  url.searchParams.set('lat', round4dp(lat).toFixed(4));
  url.searchParams.set('lon', round4dp(lon).toFixed(4));

  const span = weatherMetrics.start('metno', 'oceanforecast');

  try {
    const response = await fetch(url.toString(), {
      headers: buildMetNoHeaders(options),
      signal: options?.signal,
    });
    const statusCode = response.status;
    if (!response.ok) {
      span.failure(new Error(`HTTP ${statusCode}`), { status: statusCode });
      return null;
    }
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      span.failure(new Error('Invalid ocean forecast payload'), { status: statusCode });
      return null;
    }
    span.success({ status: statusCode });
    return data as MetNoOceanForecastResponse;
  } catch (error) {
    span.failure(error);
    console.warn('Met Norway ocean forecast fetch failed', error);
    return null;
  }
}

/**
 * Fetch weather forecast from Met.no API with database caching
 *
 * **PHASE 2.3 OPTIMIZATION: Database-backed cache for weather data**
 * - Weather forecasts are valid for ~1 hour (cache accordingly)
 * - Uses spatial bucketing at 4dp (~11m resolution for weather accuracy)
 * - Uses hourly time bucketing
 * - Eliminates 100-300ms external API latency on cache hit
 * - Expected cache hit rate: >85% for active fishing times
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param options Fetch options (signal, etc.)
 * @returns Met.no location forecast response
 */
async function fetchMetNoLocationForecast(
  lat: number,
  lon: number,
  options?: MetNoFetchOptions
): Promise<MetNoLocationForecastResponse | null> {
  // Round coordinates to 4dp for cache bucketing (~11m resolution)
  const latBucket = round4dp(lat);
  const lonBucket = round4dp(lon);

  // Truncate to current hour for cache bucketing
  const now = new Date();
  const forecastHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();

  try {
    // **PHASE 2.3: Check cache first**
    const supabase = getSupabaseServerClient();

    const { data: cachedData, error: cacheError } = await supabase
      .from('weather_cache')
      .select('forecast_data, expires_at')
      .eq('lat_bucket', latBucket)
      .eq('lon_bucket', lonBucket)
      .eq('forecast_hour', forecastHour)
      .gte('expires_at', new Date().toISOString()) // Not expired
      .order('cached_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cachedData) {
      console.log('[Met.no] Cache hit', {
        lat_bucket: latBucket,
        lon_bucket: lonBucket,
        forecast_hour: forecastHour,
        expires_at: cachedData.expires_at,
      });

      return cachedData.forecast_data as MetNoLocationForecastResponse;
    }

    // **Cache miss or error - fetch from Met.no API**
    console.log('[Met.no] Cache miss, fetching from API', {
      lat_bucket: latBucket,
      lon_bucket: lonBucket,
      forecast_hour: forecastHour,
      cache_error: cacheError?.message,
    });
  } catch (supabaseError) {
    // Non-fatal: if cache check fails, continue to API fetch
    console.warn('[Met.no] Cache check failed, falling back to API:', (supabaseError as Error).message);
  }

  // Fetch from Met.no API
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
  url.searchParams.set('lat', latBucket.toFixed(4));
  url.searchParams.set('lon', lonBucket.toFixed(4));

  const span = weatherMetrics.start('metno', 'locationforecast');

  try {
    const response = await fetch(url.toString(), {
      headers: buildMetNoHeaders(options),
      signal: options?.signal,
    });
    const statusCode = response.status;
    if (!response.ok) {
      span.failure(new Error(`HTTP ${statusCode}`), { status: statusCode });
      return null;
    }
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      span.failure(new Error('Invalid location forecast payload'), { status: statusCode });
      return null;
    }
    span.success({ status: statusCode });

    // **PHASE 2.3: Store in cache for future requests**
    try {
      const supabase = getSupabaseServerClient();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

      await supabase
        .from('weather_cache')
        .upsert(
          {
            lat_bucket: latBucket,
            lon_bucket: lonBucket,
            forecast_hour: forecastHour,
            forecast_data: data,
            expires_at: expiresAt,
          },
          {
            onConflict: 'lat_bucket,lon_bucket,forecast_hour',
          }
        );

      console.log('[Met.no] Cached API response', {
        lat_bucket: latBucket,
        lon_bucket: lonBucket,
        forecast_hour: forecastHour,
        expires_at: expiresAt,
      });
    } catch (cacheWriteError) {
      // Non-fatal: log and continue
      console.warn('[Met.no] Failed to cache response:', (cacheWriteError as Error).message);
    }

    return data as MetNoLocationForecastResponse;
  } catch (error) {
    span.failure(error);
    console.warn('Met Norway location forecast fetch failed', error);
    return null;
  }
}

const MS_TO_KTS = 1.94384;

function toKnots(speedMs: number | null | undefined): number | null {
  if (speedMs == null || !Number.isFinite(speedMs)) return null;
  const converted = speedMs * MS_TO_KTS;
  return Number.isFinite(converted) ? Number(converted.toFixed(1)) : null;
}

function toFixedOrNull(value: number | null | undefined, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function withinRange(timestamp: number, start: number, end: number): boolean {
  if (!Number.isFinite(timestamp)) return false;
  if (Number.isFinite(start) && timestamp < start) return false;
  if (Number.isFinite(end) && timestamp > end) return false;
  return true;
}

async function fetchMetNoMarineSeries(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string,
  options?: MetNoMarineOptions
): Promise<MetNoMarineSeriesResult | null> {
  const startMs = Date.parse(startISO);
  const endMs = Date.parse(endISO);
  const maxHours = options?.maxHours ?? 24;

  const [ocean, location] = await Promise.all([
    fetchMetNoOceanForecast(lat, lon, options),
    fetchMetNoLocationForecast(lat, lon, options),
  ]);

  const oceanEntries = ocean?.properties?.timeseries ?? [];
  if (!oceanEntries.length) return null;

  const locEntries = location?.properties?.timeseries ?? [];
  const locationByTime = new Map<string, MetNoInstantDetails>();
  for (const entry of locEntries) {
    if (!entry?.time) continue;
    const ts = Date.parse(entry.time);
    if (!withinRange(ts, startMs, endMs)) continue;
    const details = entry?.data?.instant?.details;
    if (details) locationByTime.set(new Date(entry.time).toISOString(), details);
  }

  const hours: MetNoMarineSeriesHour[] = [];
  for (const entry of oceanEntries) {
    if (!entry?.time) continue;
    const ts = Date.parse(entry.time);
    if (!withinRange(ts, startMs, endMs)) continue;
    const details = entry?.data?.instant?.details ?? {};
    const timeISO = new Date(entry.time).toISOString();

    const waveHeight = typeof details.sea_surface_wave_height === 'number' ? details.sea_surface_wave_height : null;
    const waveDirection = typeof details.sea_surface_wave_from_direction === 'number' ? details.sea_surface_wave_from_direction : null;
    const wavePeriod = typeof (details as { sea_surface_wave_period?: number }).sea_surface_wave_period === 'number'
      ? (details as { sea_surface_wave_period: number }).sea_surface_wave_period
      : null;
    const seaTemp = typeof details.sea_water_temperature === 'number' ? details.sea_water_temperature : null;
    const currentSpeed = typeof details.sea_water_speed === 'number' ? details.sea_water_speed : null;
    const currentDirection = typeof details.sea_water_to_direction === 'number' ? details.sea_water_to_direction : null;

    const loc = locationByTime.get(timeISO);
    const windSpeedMs = loc && typeof loc.wind_speed === 'number' ? loc.wind_speed : null;
    const windDirectionDeg = loc && typeof loc.wind_from_direction === 'number' ? loc.wind_from_direction : null;
    const airPressure = loc && typeof loc.air_pressure_at_sea_level === 'number' ? loc.air_pressure_at_sea_level : null;
    const cloudCover = loc && typeof loc.cloud_area_fraction === 'number' ? loc.cloud_area_fraction : null;

    hours.push({
      timeISO,
      waveHeightM: toFixedOrNull(waveHeight, 2),
        waveDirectionDeg: toFixedOrNull(waveDirection, 0),
        wavePeriodSeconds: toFixedOrNull(wavePeriod, 1),
      seaTemperatureC: toFixedOrNull(seaTemp, 2),
      currentSpeedMS: currentSpeed,
      currentDirectionDeg: currentDirection,
      windSpeedMS: windSpeedMs,
      windSpeedKts: toKnots(windSpeedMs),
      windDirectionDeg: toFixedOrNull(windDirectionDeg, 0),
      airPressureHpa: toFixedOrNull(airPressure, 1),
      cloudCoverPct: toFixedOrNull(cloudCover, 0),
    });
  }

  if (!hours.length) return null;

  hours.sort((a, b) => a.timeISO.localeCompare(b.timeISO));
  const limited = hours.slice(0, Math.max(1, maxHours));
  const firstHour = limited[0];

  return {
    hours: limited,
    firstHour,
  };
}

// Open-Meteo marine endpoint does not expose 10 m wind variables; request only supported fields.
const OPEN_METEO_MARINE_VARS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'sea_level_height_msl',
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
] as const;

type OpenMeteoMarineVarId = (typeof OPEN_METEO_MARINE_VARS)[number];

interface OpenMeteoMarineSeriesHour {
  timeISO: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodSeconds: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  seaLevelMeters: number | null;
  seaTemperatureC: number | null;
  currentSpeedMS: number | null;
  currentDirectionDeg: number | null;
  windSpeedMS: number | null;
  windSpeedKts: number | null;
  windDirectionDeg: number | null;
}

interface OpenMeteoMarineSeriesResult {
  hours: OpenMeteoMarineSeriesHour[];
  firstHour: OpenMeteoMarineSeriesHour;
}

const toNullableNumber = (value: number | undefined): number | null => (Number.isFinite(value) ? Number(value) : null);

async function fetchOpenMeteoMarineSeries(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string,
  options?: { maxHours?: number }
): Promise<OpenMeteoMarineSeriesResult | null> {
  const maxHours = options?.maxHours ?? 24;
  const startMs = Date.parse(startISO);
  const endMs = Date.parse(endISO);

  const span = weatherMetrics.start('open-meteo', 'marine');

  try {
    const params: Record<string, unknown> = {
      latitude: lat,
      longitude: lon,
      hourly: OPEN_METEO_MARINE_VARS,
      current: OPEN_METEO_MARINE_VARS,
      timezone: 'UTC',
      wind_speed_unit: 'ms',
      timeformat: 'unixtime',
      past_days: 0,
      forecast_days: 7,
    };

    const responses = await fetchWeatherApi('https://marine-api.open-meteo.com/v1/marine', params);
    const response = responses?.[0];
    if (!response) {
      span.failure(new Error('Empty Open-Meteo marine response'));
      return null;
    }

    const hourly = response.hourly();
    if (!hourly) {
      span.failure(new Error('Open-Meteo marine response lacked hourly data'));
      return null;
    }

    const interval = hourly.interval();
    if (!Number.isFinite(interval) || interval <= 0) {
      span.failure(new Error('Invalid Open-Meteo marine interval'));
      return null;
    }

    const toArray = (index: number) => {
      const variable = hourly.variables(index);
      if (!variable) return [] as number[];
      const values = variable.valuesArray();
      return values ? Array.from(values) as number[] : [];
    };

    const data: Record<OpenMeteoMarineVarId, number[]> = OPEN_METEO_MARINE_VARS.reduce((acc, key, idx) => {
      acc[key] = toArray(idx);
      return acc;
    }, {} as Record<OpenMeteoMarineVarId, number[]>);

    const timeStart = Number(hourly.time());
    const timeEnd = Number(hourly.timeEnd());
    if (!Number.isFinite(timeStart) || !Number.isFinite(timeEnd)) {
      span.failure(new Error('Open-Meteo marine response missing time range'));
      return null;
    }

    const hours: OpenMeteoMarineSeriesHour[] = [];
    for (
      let unix = timeStart, idx = 0;
      unix < timeEnd && hours.length < maxHours;
      unix += interval, idx += 1
    ) {
      const timestampMs = unix * 1000;
      if (!Number.isFinite(timestampMs)) continue;
      if (timestampMs < startMs || timestampMs > endMs) continue;

      const pushNumber = (arrKey: OpenMeteoMarineVarId, digits: number | null) => {
        const arr = data[arrKey];
        const raw = arr?.[idx];
        if (!Number.isFinite(raw)) return null;
        if (digits == null) return Number(raw);
        return Number((raw as number).toFixed(digits));
      };

      const waveHeightM = pushNumber('wave_height', 2);
      const waveDirectionDeg = pushNumber('wave_direction', 0);
      const wavePeriodSeconds = pushNumber('wave_period', 1);
      const swellHeightM = pushNumber('swell_wave_height', 2);
      const swellDirectionDeg = pushNumber('swell_wave_direction', 0);
      const seaLevelMeters = pushNumber('sea_level_height_msl', 2);
      const seaTemperatureC = pushNumber('sea_surface_temperature', 2);
      const currentSpeedMS = pushNumber('ocean_current_velocity', 2);
      const currentDirectionDeg = pushNumber('ocean_current_direction', 0);
      const windSpeedMS: number | null = null;
      const windDirectionDeg: number | null = null;

      hours.push({
        timeISO: new Date(timestampMs).toISOString(),
        waveHeightM,
        waveDirectionDeg,
        wavePeriodSeconds,
        swellHeightM,
        swellDirectionDeg,
        seaLevelMeters,
        seaTemperatureC,
        currentSpeedMS,
        currentDirectionDeg,
        windSpeedMS,
        windSpeedKts: toKnots(windSpeedMS),
        windDirectionDeg,
      });
    }

    if (!hours.length) {
      span.failure(new Error('Open-Meteo marine response produced no hours'));
      return null;
    }

    hours.sort((a, b) => a.timeISO.localeCompare(b.timeISO));
    const limited = hours.slice(0, Math.max(1, maxHours));
    const firstHour = limited[0];

    const current = response.current();
    if (current) {
      const currentVars = OPEN_METEO_MARINE_VARS.map((_, idx) => current.variables(idx)?.value());

      const override = (key: OpenMeteoMarineVarId, digits: number | null) => {
        const value = toNullableNumber(currentVars[OPEN_METEO_MARINE_VARS.indexOf(key)] ?? undefined);
        if (value == null) return null;
        return digits == null ? value : Number(value.toFixed(digits));
      };

      firstHour.waveHeightM = override('wave_height', 2) ?? firstHour.waveHeightM;
      firstHour.waveDirectionDeg = override('wave_direction', 0) ?? firstHour.waveDirectionDeg;
      firstHour.wavePeriodSeconds = override('wave_period', 1) ?? firstHour.wavePeriodSeconds;
      firstHour.swellHeightM = override('swell_wave_height', 2) ?? firstHour.swellHeightM;
      firstHour.swellDirectionDeg = override('swell_wave_direction', 0) ?? firstHour.swellDirectionDeg;
      firstHour.seaLevelMeters = override('sea_level_height_msl', 2) ?? firstHour.seaLevelMeters;
      firstHour.seaTemperatureC = override('sea_surface_temperature', 2) ?? firstHour.seaTemperatureC;
      firstHour.currentSpeedMS = override('ocean_current_velocity', 2) ?? firstHour.currentSpeedMS;
      firstHour.currentDirectionDeg = override('ocean_current_direction', 0) ?? firstHour.currentDirectionDeg;
      firstHour.windSpeedKts = toKnots(firstHour.windSpeedMS);
    }

    span.success({ status: 200 });
    return { hours: limited, firstHour } satisfies OpenMeteoMarineSeriesResult;
  } catch (error) {
    span.failure(error);
    console.warn('Open-Meteo marine fetch failed', error);
    return null;
  }
}
/**
 * Fetch Stormglass marine data for many user spots while capping to 3 unique 3‑dp cells.
 * Reuses one cell's response for all member spots in that cell.
 */
export async function fetchMarineForUserSpots(
  spots: Spot[],
  startISO: string,
  endISO: string,
  params?: string,
): Promise<{ cells: Array<{ key: string; lat: number; lon: number; spotIds: string[] }>; resultsBySpotId: Record<string, unknown | null> }>
{
  const apiKey = process.env.STORMGLASS_SECRET_KEY || '';
  if (!apiKey) throw new Error('Stormglass API key not configured');

  const cells = groupAndLimitByCell(spots, 3);

  // Fetch one response per cell (in parallel)
  const cellResults = await Promise.all(
    cells.map(async (c) => ({
      key: c.key,
      lat: c.lat,
      lon: c.lon,
      data: await fetchStormglassMarine(c.lat, c.lon, startISO, endISO, params, apiKey),
      spotIds: (c.items as Spot[]).map(s => s.id)
    }))
  );

  // Fan out to original spots
  const resultsBySpotId: Record<string, unknown | null> = {};
  for (const cr of cellResults) {
    for (const id of cr.spotIds) resultsBySpotId[id] = cr.data ?? null;
  }

  return {
    cells: cellResults.map(cr => ({ key: cr.key, lat: cr.lat, lon: cr.lon, spotIds: cr.spotIds })),
    resultsBySpotId
  };
}

function normalizeCoreWeatherFields(
  openWeatherData: Source,
  openMeteoData: Source,
  stormglassData: Source,
  isMarine: boolean
) {
  // Helper to pick first valid value from sources
  function pickField(fieldPaths: string[][], sources: Source[]) {
    for (let i = 0; i < fieldPaths.length; i++) {
      const value = fieldPaths[i].reduce((obj: unknown, key: string) => {
        if (obj && typeof obj === 'object' && key in obj) {
          return (obj as Record<string, unknown>)[key];
        }
        return undefined;
      }, sources[i]);
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  // Source order
  const sources: Source[] = isMarine
    ? [stormglassData, openWeatherData, openMeteoData]
    : [openWeatherData, openMeteoData, stormglassData];
  // Field paths for each source
  return {
    clouds: pickField([
      ['clouds'], // OpenWeather: %
      ['hourly', 'cloudcover'], // Open-Meteo: %
      ['cloudCover'] // Stormglass: % (if available)
    ], sources),
    rain: pickField([
      ['rain'], // OpenWeather: mm
      ['hourly', 'precipitation'], // Open-Meteo: mm
      ['precipitation'] // Stormglass: mm (if available)
    ], sources),
    snow: pickField([
      ['snow'], // OpenWeather: mm
      ['hourly', 'snowfall'], // Open-Meteo: cm
      ['snow'] // Stormglass: mm (if available)
    ], sources),
    snowDepth: pickField([
      [], // OpenWeather: not available
      ['hourly', 'snow_depth'], // Open-Meteo: cm
      [] // Stormglass: not available
    ], sources),
    // Add more fields as needed
  };
}

/**
 * Geographic region checks for waterfall optimization
 */
function isUSLocation(lat: number, lon: number): boolean {
  // Continental US, Alaska, Hawaii, and territories
  // Continental US: roughly 24.5°N-49°N, 125°W-66°W
  // Alaska: 51°N-71°N, 130°W-172°E
  // Hawaii: 18°N-23°N, 160°W-154°W
  return (
    // Continental US
    (lat >= 24.5 && lat <= 49 && lon >= -125 && lon <= -66) ||
    // Alaska
    (lat >= 51 && lat <= 71 && ((lon >= -180 && lon <= -130) || (lon >= 172 && lon <= 180))) ||
    // Hawaii
    (lat >= 18 && lat <= 23 && lon >= -160 && lon <= -154)
  );
}

function isEuropeanLocation(lat: number, lon: number): boolean {
  // Europe: roughly 35°N-71°N, 10°W-40°E
  // Covers most of Europe including UK, Scandinavia, Mediterranean
  return lat >= 35 && lat <= 71 && lon >= -10 && lon <= 40;
}

/**
 * Fetch weather data from NWS (National Weather Service) - US only, FREE
 * https://www.weather.gov/documentation/services-web-api
 */
async function fetchFromNWS(lat: number, lon: number): Promise<FullWeather | null> {
  try {
    // Step 1: Get grid point data
    const pointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const pointResponse = await monitoredFetch('nws', 'points', pointUrl);
    
    if (!pointResponse.ok) {
      console.log(`[NWS] Points API failed: ${pointResponse.status}`);
      return null;
    }
    
    const pointData = await pointResponse.json() as { properties?: { forecast?: string; forecastHourly?: string; forecastGridData?: string } };
    const forecastUrl = pointData?.properties?.forecast;
    const hourlyUrl = pointData?.properties?.forecastHourly;
    
    if (!forecastUrl) {
      console.log('[NWS] No forecast URL in response');
      return null;
    }
    
    // Step 2: Get forecast data
    const forecastResponse = await monitoredFetch('nws', 'forecast', forecastUrl);
    if (!forecastResponse.ok) {
      console.log(`[NWS] Forecast API failed: ${forecastResponse.status}`);
      return null;
    }
    
    const forecastData = await forecastResponse.json() as { properties?: { periods?: Array<{ 
      temperature?: number; 
      windSpeed?: string; 
      windDirection?: string;
      shortForecast?: string;
      icon?: string;
      startTime?: string;
      isDaytime?: boolean;
    }> } };
    
    // Step 3: Get hourly forecast
    let hourlyData = null;
    if (hourlyUrl) {
      try {
        const hourlyResponse = await monitoredFetch('nws', 'hourly', hourlyUrl);
        if (hourlyResponse.ok) {
          hourlyData = await hourlyResponse.json();
        }
      } catch (err) {
        console.warn('[NWS] Hourly forecast failed:', err);
      }
    }
    
    const periods = forecastData?.properties?.periods || [];
    if (periods.length === 0) {
      return null;
    }
    
    console.log(`✅ NWS: Weather data found (${periods.length} periods)`);
    
    // Transform NWS hourly data (also needs Fahrenheit to Celsius conversion)
    const hourlyPeriods = hourlyData?.properties?.periods || [];
    const transformedHourly = hourlyPeriods.map((hour: { temperature?: number; windSpeed?: string; [key: string]: unknown }) => ({
      ...hour,
      temperature: fahrenheitToCelsius(hour.temperature),
      windSpeed: hour.windSpeed, // Keep as string for now, will be parsed by parseWindSpeed if needed
    }));
    
    // Transform NWS data to our format (converting Fahrenheit to Celsius)
    return {
      source: 'nws',
      current: {
        temp: fahrenheitToCelsius(periods[0]?.temperature),
        weather: [{ description: periods[0]?.shortForecast, icon: periods[0]?.icon }],
        wind_speed: parseWindSpeed(periods[0]?.windSpeed),
        wind_deg: parseWindDirection(periods[0]?.windDirection),
      },
      daily: periods.slice(0, 7).map(period => ({
        dt: period.startTime ? new Date(period.startTime).getTime() / 1000 : undefined,
        temp: { day: fahrenheitToCelsius(period.temperature) },
        weather: [{ description: period.shortForecast, icon: period.icon }],
        wind_speed: parseWindSpeed(period.windSpeed),
        wind_deg: parseWindDirection(period.windDirection),
      })),
      hourly: transformedHourly,
      alerts: [], // NWS alerts would come from /alerts endpoint
    };
  } catch (error) {
    console.warn('[NWS] Error fetching weather:', error);
    return null;
  }
}

// Helper to parse NWS wind speed (e.g., "10 to 15 mph" -> m/s)
function parseWindSpeed(windSpeed?: string): number | undefined {
  if (!windSpeed) return undefined;
  const match = windSpeed.match(/(\d+)/);
  if (!match) return undefined;
  const mph = parseInt(match[1]);
  return mph * 0.44704; // Convert mph to m/s
}

// Helper to convert Fahrenheit to Celsius
function fahrenheitToCelsius(fahrenheit?: number): number | undefined {
  if (fahrenheit == null || !Number.isFinite(fahrenheit)) return undefined;
  return (fahrenheit - 32) * 5 / 9;
}

// Helper to parse NWS wind direction (e.g., "NW" -> degrees)
function parseWindDirection(direction?: string): number | undefined {
  if (!direction) return undefined;
  const directions: Record<string, number> = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
  };
  return directions[direction.toUpperCase()];
}

/**
 * Fetch weather data from Met.no (MET Norway) - Europe, FREE
 * https://api.met.no/weatherapi/locationforecast/2.0/documentation
 */
async function fetchFromMetNoWeather(lat: number, lon: number): Promise<FullWeather | null> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const response = await monitoredFetch('metno', 'locationforecast', url, {
      headers: { 'User-Agent': 'WotNow/1.0 (github.com/yourrepo)' }
    });
    
    if (!response.ok) {
      console.log(`[Met.no] Weather API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json() as { properties?: { timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: {
          air_temperature?: number;
          wind_speed?: number;
          wind_from_direction?: number;
          cloud_area_fraction?: number;
          relative_humidity?: number;
        }};
        next_1_hours?: { summary?: { symbol_code?: string } };
        next_6_hours?: { summary?: { symbol_code?: string } };
      };
    }> } };
    
    const timeseries = data?.properties?.timeseries || [];
    if (timeseries.length === 0) {
      return null;
    }

    // Log number of unique days in timeseries
    const uniqueDays = new Set(timeseries.map(entry => {
      if (!entry.time) return null;
      return entry.time.slice(0, 10);
    }).filter(Boolean));
    console.log(`✅ Met.no: Weather data found (${timeseries.length} hours, ${uniqueDays.size} unique days)`);

    const current = timeseries[0];
    return {
      source: 'metno',
      current: {
        temp: current?.data?.instant?.details?.air_temperature,
        wind_speed: current?.data?.instant?.details?.wind_speed,
        wind_deg: current?.data?.instant?.details?.wind_from_direction,
        humidity: current?.data?.instant?.details?.relative_humidity,
        clouds: current?.data?.instant?.details?.cloud_area_fraction,
        weather: [{
          description: current?.data?.next_1_hours?.summary?.symbol_code || 
                      current?.data?.next_6_hours?.summary?.symbol_code,
        }],
      },
      hourly: timeseries.slice(0, 48),
      daily: [], // Met.no doesn't provide daily aggregates
      alerts: [],
    };
  } catch (error) {
    console.warn('[Met.no] Error fetching weather:', error);
    return null;
  }
}

/**
 * Fetch weather data from Open-Meteo - Global, FREE
 * https://open-meteo.com/en/docs
 */
async function fetchFromOpenMeteoWeather(lat: number, lon: number): Promise<FullWeather | null> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code',
      hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max',
      timezone: 'auto',
    });
    
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const response = await monitoredFetch('openmeteo', 'forecast', url);
    
    if (!response.ok) {
      console.log(`[Open-Meteo] Weather API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json() as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
        weather_code?: number;
      };
      hourly?: { time?: string[]; temperature_2m?: number[] };
      daily?: { time?: string[]; temperature_2m_max?: number[] };
    };
    
    if (!data.current) {
      return null;
    }
    
    console.log(`✅ Open-Meteo: Weather data found`);
    
    return {
      source: 'openmeteo',
      current: {
        temp: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        wind_speed: data.current.wind_speed_10m,
        wind_deg: data.current.wind_direction_10m,
        weather: [{ description: `WMO ${data.current.weather_code}` }],
      },
      hourly: data.hourly ? [data.hourly as unknown] : [],
      daily: data.daily ? [data.daily as unknown] : [],
      alerts: [],
    };
  } catch (error) {
    console.warn('[Open-Meteo] Error fetching weather:', error);
    return null;
  }
}

/**
 * Get comprehensive weather data for a location with intelligent waterfall
 * 
 * Waterfall Strategy:
 * - US locations: NWS (free) → Open-Meteo (free) → OpenWeather (paid) → Stormglass (paid)
 * - Europe: Met.no (free) → Open-Meteo (free) → OpenWeather (paid) → Stormglass (paid)
 * - Other: Open-Meteo (free) → OpenWeather (paid) → Stormglass (paid)
 * 
 * @param lat Latitude
 * @param lon Longitude
 * @returns Unified weather data object with current, hourly, and daily forecasts
 */
interface FullWeather {
  alerts?: unknown[];
  daily?: unknown[];
  source?: string;
  [key: string]: unknown;
}

async function getWeatherData(lat: number, lon: number): Promise<FullWeather> {
  // Try free sources first based on location
  let weatherData: FullWeather | null = null;
  
  // US locations: Try NWS first
  if (isUSLocation(lat, lon)) {
    console.log(`[Weather] US location detected (${lat.toFixed(2)}, ${lon.toFixed(2)}), trying NWS...`);
    weatherData = await fetchFromNWS(lat, lon);
    if (weatherData) {
      console.log('✅ [Weather] Using NWS (FREE)');
      // Get air quality from OpenWeather if available (cached 24h at 0dp)
      weatherData.airQuality = await getAirQualityWithCache(lat, lon);
      return weatherData;
    }
  }
  
  // European locations: Try Met.no first
  if (isEuropeanLocation(lat, lon)) {
    console.log(`[Weather] European location detected (${lat.toFixed(2)}, ${lon.toFixed(2)}), trying Met.no...`);
    weatherData = await fetchFromMetNoWeather(lat, lon);
    if (weatherData) {
      console.log('✅ [Weather] Using Met.no (FREE)');
      weatherData.airQuality = await getAirQualityWithCache(lat, lon);
      return weatherData;
    }
  }
  
  // Try Open-Meteo (global, free)
  console.log(`[Weather] Trying Open-Meteo (global)...`);
  weatherData = await fetchFromOpenMeteoWeather(lat, lon);
  if (weatherData) {
    console.log('✅ [Weather] Using Open-Meteo (FREE)');
    weatherData.airQuality = await getAirQualityWithCache(lat, lon);
    return weatherData;
  }
  
  // Fall back to OpenWeather (paid)
  const apiKey = process.env.OPENWEATHER_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_KEY;
  if (apiKey) {
    console.log('⚠️  [Weather] Falling back to OpenWeather (PAID)');
    try {
      weatherData = await getFullWeather({ 
        lat, 
        lon, 
        apiKey, 
        options: { units: 'metric' } 
      }) as FullWeather;
      
      weatherData.source = 'openweather';
      weatherData.airQuality = await getAirQualityWithCache(lat, lon);
      
      // Get weather alerts
      try {
        const alerts = await getWeatherAlerts({ lat, lon, apiKey });
        weatherData.alerts = alerts.length > 0 ? alerts : (weatherData.alerts || []);
      } catch (error) {
        console.warn('[Weather] Failed to fetch alerts:', error);
      }
      
      return weatherData;
    } catch (error) {
      console.error('[Weather] OpenWeather failed:', error);
    }
  }
  
  // Last resort: throw error
  throw new Error('No weather data available from any source');
}

/**
 * Air quality cache (24h, 0dp precision for cost savings)
 */
const airQualityCache = new Map<string, { data: unknown; expires: number }>();

async function getAirQualityWithCache(lat: number, lon: number): Promise<unknown> {
  const apiKey = process.env.OPENWEATHER_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_KEY;
  if (!apiKey) return null;
  
  // Use 0dp precision for air quality (changes slowly)
  const roundLat = Math.round(lat);
  const roundLon = Math.round(lon);
  const cacheKey = `aq_${roundLat}_${roundLon}`;
  
  // Check cache (24h TTL)
  const cached = airQualityCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`✅ Air quality cache hit (0dp: ${roundLat},${roundLon})`);
    return cached.data;
  }
  
  // Fetch from OpenWeather
  try {
    const data = await getAirPollution({ lat: roundLat, lon: roundLon, apiKey });
    airQualityCache.set(cacheKey, {
      data,
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    console.log(`📡 Air quality fetched from OpenWeather (0dp: ${roundLat},${roundLon})`);
    return data;
  } catch (error) {
    console.warn('[Weather] Failed to fetch air quality:', error);
    return null;
  }
}

/**
 * Fetch weather alerts from OpenWeather One Call 3.0 API
 * Returns array of alert objects (if present) for the given location.
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 * @param options Optional: units, exclude blocks
 * @returns Array of alerts (or empty array)
 *
 * Alert object fields:
 *   - sender_name: string (source of alert)
 *   - event: string (alert type)
 *   - start: UNIX timestamp (seconds)
 *   - end: UNIX timestamp (seconds)
 *   - description: string (detailed info)
 *   - tags: array of strings (categories)
 */
type WeatherOptions = {
  units?: 'metric' | 'imperial' | 'standard';
  exclude?: string;
  /** Optional flag for API routes to force fresh fetches (used by tests/debug tools) */
  bypassCache?: boolean;
};

async function getWeatherAlerts({ lat, lon, apiKey, options = {} }: { lat: number|string, lon: number|string, apiKey: string, options?: WeatherOptions }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: options?.units || 'metric',
    exclude: options?.exclude || '',
  });
  const url = `${OPENWEATHER_BASE_3}?${params.toString()}`;
  const note = JSON.stringify({ units: options?.units ?? 'metric', exclude: options?.exclude ?? '' });
  const response = await monitoredFetch('openweather', 'onecall3_alerts', url, undefined, note);
  const data: unknown = await response.json();
  if (!response.ok) throw { status: response.status, data };
  // Alerts are in data.alerts (array)
  return (data as { alerts?: unknown[] }).alerts || [];
}

/**
 * Fetch air pollution data from OpenWeather One Call 3.0 API
 * Returns air quality metrics for the given location.
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 * @returns Air pollution data object
 *
 * Air pollution object fields:
 *   - coord: { lon, lat }
 *   - list: Array of hourly objects:
 *       - dt: UNIX timestamp (seconds)
 *       - main: { aqi: number (1–5, 1=Good, 5=Very Poor) }
 *       - components: { co, no, no2, o3, so2, pm2_5, pm10, nh3 } (µg/m³)
 */
async function getAirPollution({ lat, lon, apiKey }: { lat: number|string, lon: number|string, apiKey: string }) {
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
  const response = await monitoredFetch('openweather', 'air_pollution', url);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}
/**
 * WotNow Unified Weather Service
 * ---------------------------------------
 * This module centralizes all weather, marine, air quality, pollen, soil, snow, and astronomy API integrations for the app.
 *
 * SOURCES:
 * - OpenWeather (https://openweathermap.org/api)
 *   • One Call 3.0: /onecall (current, minutely, hourly, daily, alerts, air pollution)
 *     - Fields: temp.day, temp.night, humidity (%), pressure (hPa), wind_speed (m/s), wind_deg (deg), weather (array: main, description, icon), clouds (%), pop (precip prob), rain/snow (mm), visibility (m)
 *     - Units: metric (default), imperial, standard
 *   • 2.5 Forecast: /forecast (legacy fallback, 3-hourly slices)
 *   • Timemachine: /onecall/timemachine (historical)
 *   • Day Summary: /onecall/day_summary (daily aggregation)
 *   • Overview: /onecall/overview (human-readable summary)
 *   • Weather Assistant: /weather-assistant (advice/summaries)
 *
 * - Open-Meteo (https://open-meteo.com/en/docs)
 *   • /v1/forecast: General weather, soil, snow, wind
 *     - Fields: temperature_2m (°C), precipitation (mm), windspeed_10m (m/s), soil_temperature_0cm (°C), soil_moisture_0_to_1cm (m³/m³), soil_moisture_1_to_3cm (m³/m³), snowfall (cm), snow_depth (cm), freezing_level_height (m)
 *   • /v1/air-quality: Air quality & pollen
 *     - Fields: alder_pollen, birch_pollen, grass_pollen, ragweed_pollen (unitless, model-dependent, relative exposure), pm2_5, pm10, o3, no2, so2, co (µg/m³), european_aqi, us_aqi (index)
 *
 * - Stormglass (https://docs.stormglass.io/)
 *   • /v2/marine/point: Marine forecast (waves, wind, water temp, etc.)
 *     - Fields: waveHeight (m), waveDirection (deg), windSpeed (m/s), windDirection (deg), waterTemperature (°C), etc.
 *   • /v2/tide/extremes/point: Tide extremes (high/low)
 *     - Fields: time (ISO), type (high/low), height (m)
 *   • /v2/astronomy/point: Astronomy (sunrise, sunset, moonrise, moonset, moon phase)
 *     - Fields: sunrise, sunset, moonrise, moonset (ISO), moonPhase (string)
 *   • /v2/bio/point: Biogeochemical (chlorophyll, dissolved oxygen, nutrients, salinity, SST)
 *     - Fields: chlorophyll (mg/m³), dissolvedOxygen (mg/L), nitrate/phosphate (mmol/m³ or µmol/L), salinity (PSU), sst (°C)
 *
 * UNITS & CONVENTIONS:
 * - Times: ISO strings, local time zone if available
 * - Temperature: °C (default), can be °F (imperial)
 * - Wind: m/s (OpenWeather, Stormglass), knots (app conversion), deg (direction)
 * - Precipitation: mm (OpenWeather, Open-Meteo), cm (Open-Meteo snow)
 * - Pressure: hPa
 * - Humidity: %
 * - Visibility: m
 * - Pollen: unitless, relative exposure
 * - Air quality: µg/m³ (pollutants), index (AQI)
 * - Soil moisture: m³/m³ (0–1)
 * - Snowfall/depth: mm/cm (check API)
 * - Marine bio: see Stormglass docs
 *
 * AGGREGATION POLICY:
 * - Daily: mean/max/min as appropriate (see API docs)
 * - Pollen: daily max
 * - AQI: daily max (worst hour)
 * - Soil: daily mean
 * - Snow: daily total/mean
 * - Marine bio: daily mean
 *
 * All fetch functions below return raw API responses. Merge and normalization should be handled in higher-level logic.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { lat, lon } = req.query;
  const apiKey = process.env.STORMGLASS_SECRET_KEY;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  const url = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lon}`;

  try {
    console.log('🌊 Fetching tide data from Stormglass');
    const response = await fetch(url, {
      headers: {
        'Authorization': `${apiKey}` // Fixed format
      }
    });
    
    if (!response.ok) {
      console.error('🌊 Tide API response not OK:', response.status);
      return res.status(response.status).json({ 
        error: 'Stormglass API error', 
        status: response.status 
      });
    }
    
    const data = await response.json();
    console.log('🌊 Tide data received', { count: data?.data?.length || 0 });

    if (data && Array.isArray(data.data)) {
      return res.status(200).json(data);
    } else {
      return res.status(500).json({ error: 'Invalid tide data from Stormglass', details: data });
    }
  } catch (err) {
    console.error('🌊 Tide fetch failed', err);
    return res.status(500).json({ error: 'Tide fetch failed', details: err });
  }
}


/**
 * OpenWeather API Service Module
 *
 * This module provides robust, typed functions for accessing OpenWeather's One Call 3.0 API endpoints.
 * It supports current, forecast, historical, daily summary, overview, and weather assistant features.
 *
 * See: https://openweathermap.org/api/one-call-3
 *
 * Endpoints supported:
 * - /onecall: Current, minutely, hourly, daily forecasts, alerts, air pollution
 * - /onecall/timemachine: Historical weather data for a given time
 * - /onecall/day_summary: Daily aggregated weather data
 * - /onecall/overview: Human-readable weather summary
 * - /weather-assistant: Weather advice and friendly summaries (web interface)
 *
 * All functions handle errors and return parsed JSON responses.
 */
// Uses global fetch (available in Next.js API routes and modern Node.js)

// API endpoint constants
const OPENWEATHER_BASE_3 = 'https://api.openweathermap.org/data/3.0/onecall'; // Current, forecast, alerts, air pollution
const OPENWEATHER_BASE_2_5 = 'https://api.openweathermap.org/data/2.5/forecast'; // Fallback for legacy 5-day forecast
const OPENWEATHER_BASE_TIMEMACHINE = 'https://api.openweathermap.org/data/3.0/onecall/timemachine'; // Historical data
const OPENWEATHER_BASE_DAYSUMMARY = 'https://api.openweathermap.org/data/3.0/onecall/day_summary'; // Daily aggregation
const OPENWEATHER_BASE_OVERVIEW = 'https://api.openweathermap.org/data/3.0/onecall/overview'; // Human-readable summary
const OPENWEATHER_WEATHER_ASSISTANT_WEB = 'https://openweathermap.org/weather-assistant'; // Weather assistant web interface
/**
 * Get current weather and forecast (up to 8 days, plus hourly/minutely/current/alerts/air pollution)
 * Docs: https://openweathermap.org/api/one-call-3#example
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 * @param options Optional: units, exclude blocks
 */
async function getCurrentAndForecast({ lat, lon, apiKey, options = {} }: { lat: number|string, lon: number|string, apiKey: string, options?: WeatherOptions }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: options?.units || 'metric',
    exclude: options?.exclude || '',
  });
  const url = `${OPENWEATHER_BASE_3}?${params.toString()}`;
  const note = JSON.stringify({ units: options?.units ?? 'metric', exclude: options?.exclude ?? '' });
  const response = await monitoredFetch('openweather', 'onecall3_current_forecast', url, undefined, note);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

/**
 * Get historical weather data for a given UNIX timestamp (dt)
 * Docs: https://openweathermap.org/api/one-call-3#history
 *
 * @param lat Latitude (decimal degrees)
 * @param lon Longitude (decimal degrees)
 * @param dt UNIX timestamp (seconds since epoch, UTC)
 * @param apiKey OpenWeather API key
 * @returns Raw OpenWeather Timemachine API response
 *
 * Response fields:
 *   - current: { temp (°C), humidity (%), pressure (hPa), wind_speed (m/s), wind_deg (deg), weather: [{ main, description, icon }], clouds (%), visibility (m), dt (timestamp) }
 *   - hourly: Array of hourly objects (same fields as current)
 *   - lat, lon: coordinates
 *   - timezone: string
 *   - timezone_offset: seconds
 *
 * Units: metric (default), can be changed via API key settings
 */
async function getHistoricalWeather({ lat, lon, dt, apiKey }: { lat: number|string, lon: number|string, dt: number|string, apiKey: string }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    dt: String(dt),
    appid: apiKey,
  });
  const url = `${OPENWEATHER_BASE_TIMEMACHINE}?${params.toString()}`;
  const note = JSON.stringify({ dt: Number(dt) });
  const response = await monitoredFetch('openweather', 'timemachine', url, undefined, note);
  const data = await response.json();
  // Fields: current.temp, current.humidity, current.pressure, current.wind_speed, current.wind_deg, current.weather[0].main/description/icon, current.clouds, current.visibility, current.dt
  //         hourly[]: same fields as current
  //         lat, lon, timezone, timezone_offset
  if (!response.ok) throw { status: response.status, data };
  return data;
}

/**
 * Get daily aggregated weather data for a specific date (YYYY-MM-DD)
 * Docs: https://openweathermap.org/api/one-call-3#aggregation
 *
 * @param lat Latitude (decimal degrees)
 * @param lon Longitude (decimal degrees)
 * @param date Date string (YYYY-MM-DD, local time)
 * @param apiKey OpenWeather API key
 * @returns Raw OpenWeather Day Summary API response
 *
 * Response fields:
 *   - date: string (YYYY-MM-DD)
 *   - sunrise, sunset: UNIX timestamps (seconds)
 *   - temp: { min, max, day, night, eve, morn } (°C)
 *   - feels_like: { day, night, eve, morn } (°C)
 *   - pressure (hPa), humidity (%), wind_speed (m/s), wind_deg (deg), wind_gust (m/s)
 *   - weather: [{ main, description, icon }]
 *   - clouds (%), pop (precip prob), rain (mm), snow (mm)
 *   - uvi (UV index)
 *   - moonrise, moonset, moon_phase
 *   - visibility (m)
 *   - dew_point (°C)
 *   - precipitation (mm)
 *   - alerts: array (if present)
 *
 * Units: metric (default), can be changed via API key settings
 */
async function getDailySummary({ lat, lon, date, apiKey }: { lat: number|string, lon: number|string, date: string, apiKey: string }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    date,
    appid: apiKey,
  });
  const url = `${OPENWEATHER_BASE_DAYSUMMARY}?${params.toString()}`;
  const note = JSON.stringify({ date });
  const response = await monitoredFetch('openweather', 'day_summary', url, undefined, note);
  const data = await response.json();
  // Field-level comments:
  // data.uvi: UV index (0–11+, daily max, unitless)
  // data.temp: { min, max, day, night, eve, morn } (°C)
  // data.pollen: not present (see Open-Meteo)
  // data.alerts: array of weather alerts
  if (!response.ok) throw { status: response.status, data };
  return data;
}

/**
 * Get weather overview (human-readable summary for current and forecast)
 * Docs: https://openweathermap.org/api/one-call-3#overview
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 */
async function getWeatherOverview({ lat, lon, apiKey }: { lat: number|string, lon: number|string, apiKey: string }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
  });
  const url = `${OPENWEATHER_BASE_OVERVIEW}?${params.toString()}`;
  const response = await monitoredFetch('openweather', 'overview', url);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

/**
 * Build weather assistant web interface URL (for human-friendly advice and summaries)
 * Docs: https://openweathermap.org/api/weather-assistant
 *
 * @param apiKey OpenWeather API key
 * @returns URL string
 */
function getWeatherAssistantWebUrl(apiKey: string) {
  return `${OPENWEATHER_WEATHER_ASSISTANT_WEB}?apikey=${apiKey}`;
}


/**
 * Options for OpenWeather API calls
 * - units: 'metric', 'imperial', etc.
 * - exclude: comma-separated blocks to exclude (e.g. 'minutely,hourly')
 */
// Note: WeatherOptions is defined earlier; avoid duplicate declaration

/**
 * Get One Call 3.0 data with fallback to 2.5 forecast API (legacy)
 * Returns unified structure for daily forecasts and city info.
 *
 * - If One Call 3.0 succeeds, returns up to 8 days of daily forecast, current, hourly, minutely, alerts, air pollution, etc.
 * - If fallback, returns 2.5 API data as-is.
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 * @param options Optional: units, exclude blocks
 */
async function getOneCallData({ lat, lon, apiKey, options = {} }: { lat: number|string, lon: number|string, apiKey: string, options?: WeatherOptions }) {
  if (lat === undefined || lat === null || lon === undefined || lon === null || !apiKey) {
    throw new Error('Missing parameters or API key');
  }
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: options?.units || 'metric',
    appid: apiKey,
    exclude: options?.exclude || '',
  });
  const url = `${OPENWEATHER_BASE_3}?${params.toString()}`;
  
  console.log('🌡️ OneCall Debug: Attempting One Call 3.0');
  console.log('  URL:', url.replace(apiKey, 'API_KEY'));
  
  try {
    const note = JSON.stringify({ units: options?.units ?? 'metric', exclude: options?.exclude ?? '' });
    const response = await monitoredFetch('openweather', 'onecall3', url, undefined, note);
    const data = await response.json();
    
    console.log('🌡️ OneCall Debug: One Call 3.0 Response');
    console.log('  Status:', response.status);
    console.log('  OK:', response.ok);
    
    if (!response.ok) {
      // Log specific error details for rate limiting
      if (response.status === 429) {
        console.log('⚠️ Rate limit exceeded - API key needs upgrade or wait for reset');
      }
      console.log('  Error data:', data);
      throw { status: response.status, data };
    }
    
    console.log('  Success! Has current:', !!data.current);
    console.log('  Has hourly:', !!data.hourly);
    console.log('  Has daily:', !!data.daily);
    
    return { source: 'onecall3', data };
  } catch (error) {
    const errObj = (error && typeof error === 'object') ? error as { status?: number } : {};
    const errorStatus = typeof errObj.status === 'number' ? errObj.status : undefined;
    if (errorStatus === 429) {
      console.log('❌ OneCall Debug: Rate limit exceeded (429) - falling back to 2.5');
    } else {
      console.log('❌ OneCall Debug: One Call 3.0 failed, falling back to 2.5');
      console.log('  Error:', error);
    }
    
    // Fallback to 2.5 API
    const url2 = `${OPENWEATHER_BASE_2_5}?lat=${lat}&lon=${lon}&units=${options?.units || 'metric'}&appid=${apiKey}`;
    console.log('  Fallback URL:', url2.replace(apiKey, 'API_KEY'));
    try {
      const data2 = await fetchOpenWeatherForecast25(Number(lat), Number(lon), apiKey, options);
      console.log('✅ OneCall Debug: 2.5 fallback successful');
      return { source: 'forecast2.5', data: data2 };
    } catch (fallbackError) {
      console.log('❌ 2.5 fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Transform One Call API daily data to a unified forecast structure (up to 8 days)
 * - Returns array of daily forecast objects compatible with legacy 2.5 API consumers
 */
type ForecastListItem = {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number; humidity: number; pressure: number; feels_like: number; temp_kf: number };
  weather: Array<{ id?: number; main?: string; description?: string; icon?: string }>;
  clouds: { all: number };
  wind: { speed: number; deg: number; gust: number };
  visibility: number;
  pop?: number;
  rain?: { '3h': number };
  snow?: { '3h': number };
  dt_txt: string;
  sys: { pod: string };
};

function transformDailyForecast(oneCallData: { daily?: unknown[] }): ForecastListItem[] {
  if (!oneCallData.daily) return [];
  type OneCallDay = {
    dt: number;
    temp?: { day?: number; min?: number; max?: number };
    humidity: number;
    pressure: number;
    feels_like?: { day?: number };
    weather: Array<{ id?: number; main?: string; description?: string; icon?: string }>;
    clouds: number;
    wind_speed: number;
    wind_deg: number;
    wind_gust?: number;
    pop?: number;
    rain?: number;
    snow?: number;
  };
  return oneCallData.daily.slice(0, 8)
    .filter((day: unknown) => {
      const oneCallDay = day as OneCallDay;
      // Filter out days with missing temperature data
      return oneCallDay.temp && typeof oneCallDay.temp.day === 'number';
    })
    .map((day: unknown) => {
      const oneCallDay = day as OneCallDay;
      const tempDay = oneCallDay.temp!.day!;
      const tempMin = oneCallDay.temp!.min ?? tempDay;
      const tempMax = oneCallDay.temp!.max ?? tempDay;
      const feelsLike = oneCallDay.feels_like?.day ?? tempDay;

      return {
        dt: oneCallDay.dt,
        main: {
          temp: tempDay,
          temp_min: tempMin,
          temp_max: tempMax,
          humidity: oneCallDay.humidity,
          pressure: oneCallDay.pressure,
          feels_like: feelsLike,
          temp_kf: 0
        },
    weather: oneCallDay.weather,
    clouds: { all: oneCallDay.clouds },
    wind: {
      speed: oneCallDay.wind_speed,
      deg: oneCallDay.wind_deg,
      gust: oneCallDay.wind_gust || 0
    },
    visibility: 10000,
    pop: oneCallDay.pop || 0,
    rain: oneCallDay.rain ? { "3h": oneCallDay.rain } : undefined,
    snow: oneCallDay.snow ? { "3h": oneCallDay.snow } : undefined,
    dt_txt: new Date(oneCallDay.dt * 1000).toISOString().replace('T', ' ').slice(0, 19),
    sys: { pod: "d" }
  };
  });
}

/**
 * Transform One Call API city/meta data to a unified city structure
 */
type CityMeta = { id: number; name: string; coord: { lat: number; lon: number }; country: string; population: number; timezone: number; sunrise: number; sunset: number };

function transformCity(oneCallData: unknown, lat: number|string, lon: number|string): CityMeta {
  return {
    id: 0,
    name: "Location",
    coord: { lat: parseFloat(String(lat)), lon: parseFloat(String(lon)) },
    country: "",
    population: 0,
    timezone: (oneCallData as { timezone_offset?: number }).timezone_offset || 0,
    sunrise: (oneCallData as { current?: { sunrise?: number } }).current?.sunrise || 0,
    sunset: (oneCallData as { current?: { sunset?: number } }).current?.sunset || 0
  };
}

/**
 * Get weather alerts for a location (OpenWeather One Call 3.0)
 * Alerts may include severe weather, warnings, advisories, etc.
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 * @returns Array of alert objects, or empty array if none
 *
 * Alert fields: sender_name, event, start, end, description, tags[]
 */
// This function is already defined above with a different signature
// export async function getWeatherAlerts(lat: number, lon: number, apiKey: string): Promise<any[]> {
//   const data = await fetchOpenWeatherOneCall(lat, lon, apiKey);
//   return data.alerts || [];
// }

/**
 * Get air pollution data for a location (OpenWeather Air Pollution API)
 * Docs: https://openweathermap.org/api/air-pollution
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 * @returns Array of air pollution objects (current, forecast, or historical)
 *
 * Fields: co, no, no2, o3, so2, pm2_5, pm10, nh3 (µg/m³), dt (timestamp)
 */
// This function is already defined above with a different signature
// export async function getAirPollution(lat: number, lon: number, apiKey: string): Promise<any[]> {
//   const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
//   const response = await fetch(url);
//   const data = await response.json();
//   // data.list: array of pollution objects
//   if (!response.ok) throw { status: response.status, data };
//   return data.list || [];
// }

/**
 * Get full weather data with fallback and unified structure
 * - Returns daily, current, hourly, minutely, alerts, air pollution, city info, etc.
 * - Fallbacks to 2.5 API if One Call 3.0 fails
 */
async function getFullWeather({ lat, lon, apiKey, options = {} }: { lat: number|string, lon: number|string, apiKey: string, options?: WeatherOptions }): Promise<FullWeather> {
  const result = await getOneCallData({ lat, lon, apiKey, options });
  if (result.source === 'onecall3') {
    const ret = {
      cod: "200",
      message: 0,
      cnt: result.data.daily?.length || 8,
      list: transformDailyForecast(result.data),
      city: transformCity(result.data, lat, lon),
      alerts: result.data.alerts || [],
      current: result.data.current || {},
      hourly: result.data.hourly || [],
      minutely: result.data.minutely || [],
      daily: result.data.daily || [], // Preserve original daily array for moon data
      source: 'onecall3',
    } as FullWeather;

    // If One Call payload lacks hourly (plan limits/exclude), supplement with 2.5 forecast
    try {
      const hourArr = Array.isArray((ret as { hourly?: unknown[] }).hourly) ? (ret as { hourly?: unknown[] }).hourly! : [];
      if (!hourArr.length) {
        const f25 = await fetchOpenWeatherForecast25(Number(lat), Number(lon), apiKey, options);
        if (f25 && Array.isArray((f25 as { list?: unknown[] }).list)) {
          (ret as Record<string, unknown>).list = (f25 as { list?: unknown[] }).list;
          // provide city meta if missing
          if (!(ret as { city?: unknown }).city && (f25 as { city?: unknown }).city) {
            (ret as Record<string, unknown>).city = (f25 as { city?: unknown }).city;
          }
        }
      }
    } catch (e) {
      console.warn('OpenWeather 2.5 supplement failed:', e);
    }

    return ret;
  } else {
    // Return 2.5 API data as-is
    return { ...result.data, source: 'forecast2.5' };
  }
}

// OpenWeather One Call 3.0
async function fetchOpenWeatherOneCall(lat: number, lon: number, apiKey: string, options?: WeatherOptions) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: options?.units || 'metric',
    exclude: options?.exclude || '',
  });
  const url = `${OPENWEATHER_BASE_3}?${params.toString()}`;
  const note = options
    ? JSON.stringify({ units: options.units ?? 'metric', exclude: options.exclude ?? '' })
    : undefined;
  const response = await monitoredFetch('openweather', 'onecall3', url, undefined, note);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

// OpenWeather 2.5 Forecast (fallback)
async function fetchOpenWeatherForecast25(lat: number, lon: number, apiKey: string, options?: WeatherOptions) {
  const url = `${OPENWEATHER_BASE_2_5}?lat=${lat}&lon=${lon}&units=${options?.units || 'metric'}&appid=${apiKey}`;
  const note = options ? JSON.stringify({ units: options.units ?? 'metric' }) : undefined;
  const response = await monitoredFetch('openweather', 'forecast2.5', url, undefined, note);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

// OpenWeather Timemachine
async function fetchOpenWeatherTimemachine(lat: number, lon: number, dt: number, apiKey: string) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    dt: String(dt),
    appid: apiKey,
  });
  const url = `${OPENWEATHER_BASE_TIMEMACHINE}?${params.toString()}`;
  const note = JSON.stringify({ dt });
  const response = await monitoredFetch('openweather', 'timemachine', url, undefined, note);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

// OpenWeather Day Summary
async function fetchOpenWeatherDaySummary(lat: number, lon: number, date: string, apiKey: string) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    date,
    appid: apiKey,
  });
  const url = `${OPENWEATHER_BASE_DAYSUMMARY}?${params.toString()}`;
  const note = JSON.stringify({ date });
  const response = await monitoredFetch('openweather', 'day_summary', url, undefined, note);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

// OpenWeather Overview
async function fetchOpenWeatherOverview(lat: number, lon: number, apiKey: string) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
  });
  const url = `${OPENWEATHER_BASE_OVERVIEW}?${params.toString()}`;
  const response = await monitoredFetch('openweather', 'overview', url);
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
}

// OpenWeather Assistant
function getOpenWeatherAssistantUrl(apiKey: string) {
  return `${OPENWEATHER_WEATHER_ASSISTANT_WEB}?apikey=${apiKey}`;
}


/**
 * Fetch general weather, soil, and snow data from Open-Meteo
 * @param lat Latitude
 * @param lon Longitude
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * 
 * ⚠️ CRITICAL: Open-Meteo has a 5-day forecast limit ⚠️
 * The time between startDate and endDate must not exceed 5 days or the API will return errors.
 * This limit is enforced in the unified-weather.ts API endpoint file, but be careful when
 * calling this function directly from other places.
 */
export async function fetchOpenMeteoWeather(lat: number, lon: number, startDate: string, endDate: string): Promise<unknown> {
  // Validate the date range doesn't exceed 5 days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays > 5) {
    throw new Error(`Open-Meteo API ERROR: Date range exceeds 5 days (${diffDays} days requested). Limit requests to 5 days or less.`);
  }
  
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('hourly', [
    'temperature_2m',
    'precipitation',
    'windspeed_10m',
    'soil_temperature_0cm',
    'soil_temperature_6cm',
    'soil_temperature_18cm',
    'soil_temperature_54cm',
    'soil_moisture_0_to_1cm',
    'soil_moisture_1_to_3cm',
    'soil_moisture_3_to_9cm',
    'soil_moisture_9_to_27cm',
    'snowfall',
    'snow_depth',
    'freezing_level_height',
    // Add pressure for reliable per-hour pressure series (hPa)
    'pressure_msl',
    // Add visibility for MET Norway supplement (meters)
    'visibility',
    // Add cloud cover for bite score calculations (percentage 0-100)
    'cloud_cover'
  ].join(','));
  try {
    const note = JSON.stringify({ start: startDate, end: endDate });
    const response = await monitoredFetch('open-meteo', 'forecast', url.toString(), undefined, note);
    const data = await response.json();
    if (!response.ok) throw { status: response.status, data };
    return data;
  } catch (err) {
    throw new Error('Open-Meteo weather fetch failed: ' + (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * Fetch air quality and pollen data from Open-Meteo
 * @param lat Latitude
 * @param lon Longitude
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * 
 * ⚠️ CRITICAL: Open-Meteo has a 5-day forecast limit ⚠️
 * The time between startDate and endDate must not exceed 5 days or the API will return errors.
 * This limit is enforced in the unified-weather.ts API endpoint file, but be careful when
 * calling this function directly from other places.
 */
async function fetchOpenMeteoAirPollen(lat: number, lon: number, startDate: string, endDate: string): Promise<unknown> {
  // Validate the date range doesn't exceed 5 days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays > 5) {
    throw new Error(`Open-Meteo API ERROR: Date range exceeds 5 days (${diffDays} days requested). Limit requests to 5 days or less.`);
  }
  
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  // Keep this list minimal and in parity with pages/api/weather-with-pollen.ts
  // Some regions or time windows may fail if too many metrics are requested
  // Note: Open-Meteo air quality API has specific parameter limitations
  url.searchParams.set('hourly', [
    // Pollen types (these are confirmed to work)
    'alder_pollen',
    'birch_pollen',
    'grass_pollen',
    'mugwort_pollen',
    'olive_pollen',
    'ragweed_pollen',
    // Air quality - individual pollutants and indices (correct Open-Meteo parameter names)
    'pm2_5',
    'pm10',
    'nitrogen_dioxide', // Open-Meteo uses 'nitrogen_dioxide' not 'no2'
    'ozone',           // Open-Meteo uses 'ozone' not 'o3'
    'sulphur_dioxide', // Open-Meteo uses 'sulphur_dioxide' not 'so2'
    'carbon_monoxide', // Open-Meteo uses 'carbon_monoxide' not 'co'
    'us_aqi',
    'european_aqi'
  ].join(','));
  try {
    const reqUrl = url.toString();
    const note = JSON.stringify({ start: startDate, end: endDate });
    const response = await monitoredFetch('open-meteo', 'air-quality', reqUrl, undefined, note);
    const data = await response.json();
    if (!response.ok) throw { status: response.status, statusText: response.statusText, data, url: reqUrl };
    return data;
  } catch (err: unknown) {
    // Surface detailed information for debugging
    if (err && typeof err === 'object' && 'status' in err) {
      const errorObj = err as { status: number; statusText: string; url: string; data: unknown };
      const details = {
        status: errorObj.status,
        statusText: errorObj.statusText,
        url: errorObj.url,
        data: errorObj.data,
      };
      throw new Error('Open-Meteo air/pollen fetch failed: ' + JSON.stringify(details));
    }
    throw new Error('Open-Meteo air/pollen fetch failed: ' + (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * Fetch marine data from Stormglass
 * @param lat Latitude
 * @param lon Longitude
 * @param startISO Start ISO datetime
 * @param endISO End ISO datetime
 * @param params Comma-separated variables
 * @param apiKey Stormglass API key
 */
async function fetchStormglassMarine(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string,
  params: string | undefined,
  apiKey: string
): Promise<unknown | null> {
  // local helpers (kept here to avoid cross-file refactors)
  const withTimeout = async <T>(p: Promise<T>, ms = 10000): Promise<T> =>
    await new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('timeout')), ms);
      p.then(v => { clearTimeout(id); resolve(v); })
       .catch(e => { clearTimeout(id); reject(e); });
    });
  const safeJson = async (res: Response) => { try { return await res.json(); } catch { return null; } };

  const url = new URL('https://api.stormglass.io/v2/weather/point');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lon));
  url.searchParams.set('start', startISO);
  url.searchParams.set('end', endISO);
  url.searchParams.set('params', params ?? [
    'waveHeight','waveDirection','wavePeriod',
    'swellHeight','swellDirection','swellPeriod',
    'windWaveHeight','windWaveDirection','windWavePeriod',
    'waterTemperature','currentSpeed','currentDirection',
    'windSpeed','windDirection','gust','visibility'
  ].join(','));

  const span = weatherMetrics.start(
    'stormglass',
    'marine',
    JSON.stringify({ start: startISO, end: endISO, params: params ?? 'default' })
  );

  try {
    const res = await withTimeout(fetch(url.toString(), { headers: { Authorization: apiKey } }), 10000);
    const statusCode = res.status;
    if (!res.ok) {
      span.failure(new Error(`HTTP ${statusCode}`), { status: statusCode });
      await safeJson(res); // consume body for reuse
      return null; // graceful failure
    }
    const payload = await safeJson(res);
    if (!payload) {
      span.failure(new Error('Empty Stormglass marine payload'), { status: statusCode });
      return null;
    }
    span.success({ status: statusCode });
    return payload;
  } catch (error) {
    span.failure(error);
    return null; // swallow errors and degrade politely
  }
}

/**
 * Fetch tide extremes from Stormglass
 * Uses 1dp rounding (~11km) to minimize paid API calls with 12h cache
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey Stormglass API key
 */
async function fetchStormglassTides(lat: number, lon: number, apiKey: string): Promise<unknown | null> {
  const withTimeout = async <T>(p: Promise<T>, ms = 10000): Promise<T> =>
    await new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('timeout')), ms);
      p.then(v => { clearTimeout(id); resolve(v); })
       .catch(e => { clearTimeout(id); reject(e); });
    });
  const safeJson = async (res: Response) => { try { return await res.json(); } catch { return null; } };

  // Round to 1dp (~11km) for Stormglass to reduce costs
  const rlat = round1dp(lat);
  const rlon = round1dp(lon);

  const url = new URL('https://api.stormglass.io/v2/tide/extremes/point');
  url.searchParams.set('lat', String(rlat));
  url.searchParams.set('lng', String(rlon));

  const span = weatherMetrics.start(
    'stormglass',
    'tides',
    JSON.stringify({ lat, lon })
  );

  try {
    const res = await withTimeout(fetch(url.toString(), { headers: { Authorization: apiKey } }), 10000);
    const statusCode = res.status;
    if (!res.ok) {
      span.failure(new Error(`HTTP ${statusCode}`), { status: statusCode });
      await safeJson(res);
      return null;
    }
    const data = await safeJson(res);
    if (!data || !Array.isArray(data.data)) {
      span.failure(new Error('Invalid Stormglass tide payload'), { status: statusCode });
      return null;
    }
    span.success({ status: statusCode });
    return data;
  } catch (error) {
    span.failure(error);
    return null;
  }
}
/**
 * Normalize and merge weather features (UVI, pollen, tides) into unified structure for frontend use
 *
 * @param openWeatherDaySummary OpenWeather daily summary response
 * @param openMeteoAirPollen Open-Meteo air/pollen response
 * @param stormglassTides Stormglass tides response
 * @returns Unified object: { uvi, pollen, tides }
 */
type NormalizedFeatures = {
  uvi: number | null;
  pollen: { alder: number; birch: number; grass: number; ragweed: number };
  tides: Array<{ time: string; type: 'high' | 'low'; height: number | null }>;
  marine?: Record<string, number | null>;
};

function normalizeWeatherFeatures(
  openWeatherDaySummary: unknown,
  openMeteoAirPollen: unknown,
  stormglassTides: unknown,
  stormglassMarine?: unknown
): NormalizedFeatures {
  const toNum = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Pollen: use daily max of hourly arrays; fall back to 0 if missing
  const hourly = (openMeteoAirPollen as { hourly?: Record<string, unknown> })?.hourly ?? {};
  const maxOr0 = (arr?: unknown[]) => Array.isArray(arr) && arr.length
    ? Math.max(...arr.map((x) => Number(x as number)).filter((n: number) => Number.isFinite(n)))
    : 0;

  // Tides: map safely; return empty array if none
  const tides = Array.isArray((stormglassTides as { data?: unknown[] })?.data)
    ? ((stormglassTides as { data?: unknown[] }).data as unknown[])
        .map((t: unknown) => {
          const tide = t as Record<string, unknown>;
          const typeStr = String(tide.type).toLowerCase();
          return {
            time: new Date(tide.time as string | number | Date).toISOString(),
            type: typeStr.includes('high') ? 'high' as const : 'low' as const,
            height: toNum(tide.height)
          };
        })
        .sort((a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time))
    : [];

  // Marine: only include if we have any wave data (waveHeight OR swellHeight OR windWaveHeight)
  let marine: Record<string, number | null> | undefined;
  const h = (stormglassMarine as { hours?: Array<Record<string, unknown>> })?.hours?.[0];
  if (h) {
    const sg = (k: string) => toNum(h?.[k] ? (h[k] as Record<string, unknown>)?.sg : undefined);
    const waveHeight = sg('waveHeight');
    const swellHeight = sg('swellHeight');
    const windWaveHeight = sg('windWaveHeight');

    // If none of the wave-related metrics are present, omit marine entirely
    const hasWave = waveHeight !== null || swellHeight !== null || windWaveHeight !== null;
    if (hasWave) {
      marine = {
        waveHeight,
        waveDirection: sg('waveDirection'),
        wavePeriod: sg('wavePeriod'),
        swellHeight,
        swellDirection: sg('swellDirection'),
        swellPeriod: sg('swellPeriod'),
        windWaveHeight,
        windWaveDirection: sg('windWaveDirection'),
        windWavePeriod: sg('windWavePeriod'),
        waterTemperature: sg('waterTemperature'),
        currentSpeed: sg('currentSpeed'),
        currentDirection: sg('currentDirection'),
        windSpeed: sg('windSpeed'),
        windDirection: sg('windDirection'),
        gust: sg('gust')
      };
    }
  }

  const result: NormalizedFeatures = {
    uvi: (openWeatherDaySummary as { uvi?: number })?.uvi ?? null,
    pollen: {
      alder: maxOr0(Array.isArray(hourly.alder_pollen) ? hourly.alder_pollen : undefined),
      birch: maxOr0(Array.isArray(hourly.birch_pollen) ? hourly.birch_pollen : undefined),
      grass: maxOr0(Array.isArray(hourly.grass_pollen) ? hourly.grass_pollen : undefined),
      ragweed: maxOr0(Array.isArray(hourly.ragweed_pollen) ? hourly.ragweed_pollen : undefined)
    },
    tides
  };

  if (marine) result.marine = marine; // only add when present

  return result;
}

/**
 * Fetch astronomy data from Stormglass
 * @param lat Latitude
 * @param lon Longitude
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param apiKey Stormglass API key
 */
async function fetchStormglassAstronomy(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string,
  apiKey: string
): Promise<unknown | null> {
  const withTimeout = async <T>(p: Promise<T>, ms = 10000): Promise<T> =>
    await new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('timeout')), ms);
      p.then(v => { clearTimeout(id); resolve(v); })
       .catch(e => { clearTimeout(id); reject(e); });
    });
  const safeJson = async (res: Response) => { try { return await res.json(); } catch { return null; } };

  const url = new URL('https://api.stormglass.io/v2/astronomy/point');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lon));
  url.searchParams.set('start', startISO);
  url.searchParams.set('end', endISO);

  const span = weatherMetrics.start(
    'stormglass',
    'astronomy',
    JSON.stringify({ start: startISO, end: endISO })
  );

  try {
    const res = await withTimeout(fetch(url.toString(), { headers: { Authorization: apiKey } }), 10000);
    const statusCode = res.status;
    if (!res.ok) {
      span.failure(new Error(`HTTP ${statusCode}`), { status: statusCode });
      await safeJson(res);
      return null;
    }
    const payload = await safeJson(res);
    if (!payload) {
      span.failure(new Error('Empty Stormglass astronomy payload'), { status: statusCode });
      return null;
    }
    span.success({ status: statusCode });
    return payload;
  } catch (error) {
    span.failure(error);
    return null;
  }
}

/**
 * Fetch biogeochemical data from Stormglass
 * @param lat Latitude
 * @param lon Longitude
 * @param startISO Start ISO datetime
 * @param endISO End ISO datetime
 * @param params Comma-separated variables
 * @param apiKey Stormglass API key
 */
async function fetchStormglassBio(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string,
  params: string | undefined,
  apiKey: string
): Promise<unknown | null> {
  const withTimeout = async <T>(p: Promise<T>, ms = 10000): Promise<T> =>
    await new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('timeout')), ms);
      p.then(v => { clearTimeout(id); resolve(v); })
       .catch(e => { clearTimeout(id); reject(e); });
    });
  const safeJson = async (res: Response) => { try { return await res.json(); } catch { return null; } };

  const url = new URL('https://api.stormglass.io/v2/bio/point');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lon));
  url.searchParams.set('start', startISO);
  url.searchParams.set('end', endISO);
  url.searchParams.set('params', params ?? [
    'chlorophyll','dissolvedOxygen','nitrate','phosphate','salinity','sst'
  ].join(','));

  const span = weatherMetrics.start(
    'stormglass',
    'bio',
    JSON.stringify({ start: startISO, end: endISO, params: params ?? 'default' })
  );

  try {
    const res = await withTimeout(fetch(url.toString(), { headers: { Authorization: apiKey } }), 10000);
    const statusCode = res.status;
    if (!res.ok) {
      span.failure(new Error(`HTTP ${statusCode}`), { status: statusCode });
      await safeJson(res);
      return null;
    }
    const payload = await safeJson(res);
    if (!payload) {
      span.failure(new Error('Empty Stormglass bio payload'), { status: statusCode });
      return null;
    }
    span.success({ status: statusCode });
    return payload;
  } catch (error) {
    span.failure(error);
    return null;
  }
}

// ESM named exports for Next.js runtime
export {
  normalizeCoreWeatherFields,
  getWeatherData,
  getWeatherAlerts,
  getAirPollution,
  handler,
  getCurrentAndForecast,
  getHistoricalWeather,
  getDailySummary,
  getWeatherOverview,
  getWeatherAssistantWebUrl,
  getOneCallData,
  transformDailyForecast,
  transformCity,
  getFullWeather,
  fetchOpenWeatherOneCall,
  fetchOpenWeatherForecast25,
  fetchOpenWeatherTimemachine,
  fetchOpenWeatherDaySummary,
  fetchOpenWeatherOverview,
  getOpenWeatherAssistantUrl,
  fetchOpenMeteoAirPollen,
  fetchOpenMeteoMarineSeries,
  fetchMetNoOceanForecast,
  fetchMetNoLocationForecast,
  fetchMetNoMarineSeries,
  fetchStormglassMarine,
  fetchStormglassTides,
  normalizeWeatherFeatures,
  fetchStormglassAstronomy,
  fetchStormglassBio
};

// ============================================================================
// WorldTides API
// ============================================================================
// Tides are astronomically predictable and change very slowly:
// - Tide times shift by only ~50 minutes per day
// - Predictions are stable for weeks ahead
// - Nearby locations (within ~11km) have identical tide times
// ✅ Safe to cache aggressively: 24 hours, 1dp location precision

export interface WorldTidesExtreme {
  dt: number; // Unix timestamp
  date: string; // ISO 8601 date
  height: number; // Height in meters
  type: 'High' | 'Low';
}

export interface WorldTidesResponse {
  status?: number;
  extremes: WorldTidesExtreme[];
  responseTime?: number;
  copyright?: string;
  stationDistance?: number;
  datum?: string; // Tide datum (e.g., 'CD' = Chart Datum)
}

/**
 * Fetch tide extremes (high/low) from WorldTides API with database caching
 *
 * **PHASE 2.1 OPTIMIZATION: Database-backed cache for tide data**
 * - Tides are predictable and change slowly (cache for 24 hours)
 * - Uses spatial bucketing at 3dp (~110m resolution)
 * - Eliminates 680-1686ms external API latency on cache hit
 * - Expected cache hit rate: >90% for common fishing locations
 *
 * @param lat Latitude
 * @param lon Longitude
 * @param days Number of days to fetch (default 7)
 * @returns WorldTides response with extremes array
 */
async function fetchWorldTides(
  lat: number,
  lon: number,
  days: number = 7
): Promise<WorldTidesResponse | null> {
  const WORLDTIDES_API_KEY = process.env.WORLDTIDES_API_KEY;

  if (!WORLDTIDES_API_KEY) {
    console.warn('[WorldTides] API key not configured');
    return null;
  }

  // Round coordinates to 3dp for cache bucketing (~110m resolution)
  const latBucket = round3dp(lat);
  const lonBucket = round3dp(lon);
  const startDate = new Date().toISOString().split('T')[0]; // Today's date (YYYY-MM-DD)

  try {
    // **PHASE 2.1: Check cache first**
    const supabase = getSupabaseServerClient();

    const { data: cachedData, error: cacheError } = await supabase
      .from('tide_cache')
      .select('extremes, datum, expires_at')
      .eq('lat_bucket', latBucket)
      .eq('lon_bucket', lonBucket)
      .eq('start_date', startDate)
      .eq('days', days)
      .gte('expires_at', new Date().toISOString()) // Not expired
      .order('cached_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cachedData) {
      console.log('[WorldTides] Cache hit', {
        lat_bucket: latBucket,
        lon_bucket: lonBucket,
        start_date: startDate,
        expires_at: cachedData.expires_at,
      });

      return {
        extremes: cachedData.extremes as WorldTidesExtreme[],
        datum: cachedData.datum || 'CD',
      };
    }

    // **Cache miss or error - fetch from WorldTides API**
    console.log('[WorldTides] Cache miss, fetching from API', {
      lat_bucket: latBucket,
      lon_bucket: lonBucket,
      start_date: startDate,
      cache_error: cacheError?.message,
    });

    // Use full-precision coordinates for API call
    const url = new URL('https://www.worldtides.info/api/v3');
    url.searchParams.set('extremes', '');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    // Use start/length for best practice and test compatibility
    const now = Math.floor(Date.now() / 1000); // Unix timestamp (seconds)
    url.searchParams.set('start', String(now));
    url.searchParams.set('length', String(days * 86400));
    url.searchParams.set('datum', 'CD');
    url.searchParams.set('localtime', '');
    url.searchParams.set('key', WORLDTIDES_API_KEY);

    const response = await monitoredFetch(
      'worldtides',
      'extremes',
      url.toString(),
      {
        headers: {
          'User-Agent': 'WotNow/1.0',
        },
      },
      JSON.stringify({ days })
    );

    if (!response.ok) {
      console.error(`[WorldTides] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as WorldTidesResponse;

    if (!data.extremes || data.extremes.length === 0) {
      console.warn('[WorldTides] No tide extremes returned');
      return null;
    }

    // **PHASE 2.1: Store in cache for future requests**
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

      await supabase
        .from('tide_cache')
        .upsert(
          {
            lat_bucket: latBucket,
            lon_bucket: lonBucket,
            start_date: startDate,
            days,
            extremes: data.extremes,
            datum: data.datum || 'CD',
            expires_at: expiresAt,
          },
          {
            onConflict: 'lat_bucket,lon_bucket,start_date',
          }
        );

      console.log('[WorldTides] Cached API response', {
        lat_bucket: latBucket,
        lon_bucket: lonBucket,
        start_date: startDate,
        expires_at: expiresAt,
        extremes_count: data.extremes.length,
      });
    } catch (cacheWriteError) {
      // Non-fatal: log and continue
      console.warn('[WorldTides] Failed to cache response:', (cacheWriteError as Error).message);
    }

    return data;
  } catch (error) {
    console.error('[WorldTides] Fetch failed:', error);
    return null;
  }
}

export {
  fetchWorldTides,
};
