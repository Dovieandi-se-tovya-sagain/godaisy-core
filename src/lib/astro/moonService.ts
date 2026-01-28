import { Temporal } from '@js-temporal/polyfill';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '../supabase/serverClient';
import { round0dp } from '../utils/coordinates';
import { getMoonTimes, getTimes, getMoonIllumination } from 'suncalc';

export interface MoonSunData {
  latBucket: number;
  lonBucket: number;
  localDate: string;
  timezone: string;
  sunriseISO?: string;
  sunsetISO?: string;
  dayLengthMinutes?: number;
  moonriseISO?: string;
  moonsetISO?: string;
  moonTransitISO?: string; // Solunar Theory: moon overhead/underfoot time
  moonPhaseName?: string;
  moonPhaseFraction?: number;
  moonIlluminationPct?: number;
  moonPhaseStage?: string; // 'waxing' or 'waning'
  daysUntilNextFullMoon?: number;
  daysUntilNextNewMoon?: number;
  source: string;
  cachedAt: string;
  expiresAt: string;
}

interface MoonCacheRow {
  id: string;
  lat_bucket: number;
  lon_bucket: number;
  local_date: string;
  timezone: string;
  sunrise_iso: string | null;
  sunset_iso: string | null;
  day_length_minutes: number | null;
  moonrise_iso: string | null;
  moonset_iso: string | null;
  moon_transit_iso: string | null; // Solunar Theory: moon overhead/underfoot time
  moon_phase_name: string | null;
  moon_phase_fraction: number | null;
  moon_illumination_pct: number | null;
  moon_phase_stage: string | null;
  days_until_next_full_moon: number | null;
  days_until_next_new_moon: number | null;
  source: string | null;
  cached_at: string;
  expires_at: string;
  raw: Record<string, unknown> | null;
}

interface IpGeoAstronomyResponse {
  date?: string;
  timezone?: string;
  sunrise?: string;
  sunset?: string;
  day_length?: string;
  moonrise?: string;
  moonset?: string;
  moon_phase?: string;
  moon_illumination?: string | number;
  moon_illumination_percentage?: string | number; // Actual field name from API
  moonrise_next?: string;
  moonset_previous?: string;
  moon_age?: string | number;
  moon_angle?: number; // Can be used to calculate moon age if moon_age not available
  current_time?: string;
  [key: string]: unknown;
}

interface FetchParams {
  lat: number;
  lon: number;
  date?: string;
}

const DEFAULT_PROVIDER = 'ipgeolocation';
const COORD_PRECISION = 3; // 0.001° grid (~110m) matches weather cache precision
const COORD_FACTOR = 10 ** COORD_PRECISION;
const SYNODIC_MONTH_DAYS = 29.530588853;

let cacheDisabled = false;
let hasLoggedCacheDisable = false;

function isMissingCacheTable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code } = error as { code?: string };
  return code === 'PGRST205';
}

function logCacheDisabled(reason: string): void {
  if (!hasLoggedCacheDisable) {
    console.info(`[moon-cache] Disabled: ${reason}`);
    hasLoggedCacheDisable = true;
  }
}

function roundToGrid(value: number): number {
  return Number((Math.round(value * COORD_FACTOR) / COORD_FACTOR).toFixed(COORD_PRECISION));
}

function normalizeIllumination(raw?: string | number | null): number | undefined {
  if (raw == null) return undefined;
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (Number.isNaN(value)) return undefined;
  if (value > 1.5) {
    return Math.max(0, Math.min(100, value));
  }
  return Math.max(0, Math.min(100, value * 100));
}

function parseDayLength(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const hhmmss = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmmss) {
    const hours = Number.parseInt(hhmmss[1] ?? '0', 10);
    const minutes = Number.parseInt(hhmmss[2] ?? '0', 10);
    const seconds = Number.parseInt(hhmmss[3] ?? '0', 10);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }
  const tokens = trimmed.match(/(?:(\d{1,2})\s*h(?:ours?)?)?(?:\s*(\d{1,2})\s*m(?:in(?:utes?)?)?)?/i);
  if (tokens) {
    const hours = Number.parseInt(tokens[1] ?? '0', 10);
    const minutes = Number.parseInt(tokens[2] ?? '0', 10);
    if (!Number.isNaN(hours) || !Number.isNaN(minutes)) {
      return (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes);
    }
  }
  return undefined;
}

function parseMoonFraction(ageRaw?: string | number | null, illuminationPct?: number): number | undefined {
  const age = typeof ageRaw === 'number' ? ageRaw : Number.parseFloat(String(ageRaw ?? ''));
  if (!Number.isNaN(age) && age >= 0) {
    const frac = (age % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
    return Number.isFinite(frac) ? Number(frac.toFixed(4)) : undefined;
  }
  if (typeof illuminationPct === 'number') {
    const normalized = illuminationPct / 100;
    if (normalized <= 0.01) return 0;
    if (normalized >= 0.99) return 0.5;
    return Number(normalized.toFixed(4));
  }
  return undefined;
}

function getMoonPhaseStage(phaseFraction?: number): string | undefined {
  if (phaseFraction == null) return undefined;
  // 0 = new moon, 0.5 = full moon, 1 = new moon again
  // Waxing: 0 -> 0.5, Waning: 0.5 -> 1
  return phaseFraction < 0.5 ? 'waxing' : 'waning';
}

function calculateDaysUntilNextPhase(phaseFraction?: number): { daysUntilFullMoon?: number; daysUntilNewMoon?: number } {
  if (phaseFraction == null) return {};

  const currentDay = phaseFraction * SYNODIC_MONTH_DAYS;
  const fullMoonDay = SYNODIC_MONTH_DAYS / 2; // Day 14.76
  const newMoonDay = SYNODIC_MONTH_DAYS; // Day 29.53

  let daysUntilFullMoon: number;
  let daysUntilNewMoon: number;

  if (currentDay < fullMoonDay) {
    // Before full moon
    daysUntilFullMoon = fullMoonDay - currentDay;
    daysUntilNewMoon = newMoonDay - currentDay;
  } else {
    // After full moon
    daysUntilFullMoon = (SYNODIC_MONTH_DAYS - currentDay) + fullMoonDay;
    daysUntilNewMoon = newMoonDay - currentDay;
  }

  return {
    daysUntilFullMoon: Math.round(daysUntilFullMoon),
    daysUntilNewMoon: Math.round(daysUntilNewMoon)
  };
}

/**
 * Calculate moon transit time (upper culmination) for Solunar Theory
 * Transit ≈ midpoint between moonrise and moonset
 */
function calculateMoonTransit(moonriseISO?: string, moonsetISO?: string): string | undefined {
  if (!moonriseISO || !moonsetISO) {
    // If we only have one, estimate transit 6 hours after moonrise or 6 hours before moonset
    if (moonriseISO) {
      const moonrise = new Date(moonriseISO);
      moonrise.setHours(moonrise.getHours() + 6);
      return moonrise.toISOString();
    }
    if (moonsetISO) {
      const moonset = new Date(moonsetISO);
      moonset.setHours(moonset.getHours() - 6);
      return moonset.toISOString();
    }
    return undefined;
  }

  const moonrise = new Date(moonriseISO);
  const moonset = new Date(moonsetISO);

  // Handle case where moonset is before moonrise (crosses midnight)
  if (moonset < moonrise) {
    // Add 24 hours to moonset for calculation
    const adjustedMoonset = new Date(moonset);
    adjustedMoonset.setDate(adjustedMoonset.getDate() + 1);
    const transitTime = moonrise.getTime() + (adjustedMoonset.getTime() - moonrise.getTime()) / 2;
    return new Date(transitTime).toISOString();
  }

  // Calculate midpoint between moonrise and moonset
  const transitTime = moonrise.getTime() + (moonset.getTime() - moonrise.getTime()) / 2;
  return new Date(transitTime).toISOString();
}

function toZonedInstantISO(localDate: string, time: string | undefined, timeZone: string): string | undefined {
  if (!time) return undefined;
  const trimmed = time.trim();
  if (!trimmed || trimmed === '--:--') return undefined;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?$/i);
  if (!match) {
    return undefined;
  }
  let hour = Number.parseInt(match[1] ?? '0', 10);
  const minute = Number.parseInt(match[2] ?? '0', 10);
  const second = Number.parseInt(match[3] ?? '0', 10) || 0;
  const suffix = match[4]?.toLowerCase();
  if (suffix) {
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
  }
  try {
    const parts = localDate.split('-').map((segment) => Number.parseInt(segment, 10));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return undefined;
    }
    const [year, month, day] = parts;
    const zoned = Temporal.ZonedDateTime.from({
      timeZone,
      year,
      month,
      day,
      hour,
      minute,
      second,
    });
    return zoned.toInstant().toString();
  } catch {
    return undefined;
  }
}

async function readFromCache(
  client: SupabaseClient,
  latBucket: number,
  lonBucket: number,
  localDate?: string
): Promise<MoonCacheRow | null> {
  if (cacheDisabled) {
    return null;
  }

  let query = client
    .from('moon_cache')
    .select('*')
    .eq('lat_bucket', latBucket)
    .eq('lon_bucket', lonBucket);

  if (localDate) {
    query = query.eq('local_date', localDate);
  }

  const { data, error } = await query
    .order('local_date', { ascending: false })
    .order('cached_at', { ascending: false })
    .limit(1)
    .maybeSingle<MoonCacheRow>();

  if (error) {
    if (isMissingCacheTable(error)) {
      cacheDisabled = true;
      logCacheDisabled("Supabase table 'moon_cache' not found; skipping moon cache");
      return null;
    }

    console.warn('[moon-cache] Failed to read cache', error);
    return null;
  }
  if (!data) {
    return null;
  }
  const expiresAt = Date.parse(data.expires_at);
  if (!Number.isNaN(expiresAt) && expiresAt > Date.now()) {
    return data;
  }
  return null;
}

async function writeCache(
  client: SupabaseClient,
  latBucket: number,
  lonBucket: number,
  localDate: string,
  payload: MoonSunData,
  raw: Record<string, unknown> | null
): Promise<void> {
  if (cacheDisabled) {
    return;
  }

  const { error } = await client.from('moon_cache').upsert(
    {
      lat_bucket: latBucket,
      lon_bucket: lonBucket,
      local_date: localDate,
      timezone: payload.timezone,
      sunrise_iso: payload.sunriseISO ?? null,
      sunset_iso: payload.sunsetISO ?? null,
      day_length_minutes: payload.dayLengthMinutes ?? null,
      moonrise_iso: payload.moonriseISO ?? null,
      moonset_iso: payload.moonsetISO ?? null,
      moon_transit_iso: payload.moonTransitISO ?? null,
      moon_phase_name: payload.moonPhaseName ?? null,
      moon_phase_fraction: payload.moonPhaseFraction ?? null,
      moon_illumination_pct: payload.moonIlluminationPct ?? null,
      moon_phase_stage: payload.moonPhaseStage ?? null,
      days_until_next_full_moon: payload.daysUntilNextFullMoon ?? null,
      days_until_next_new_moon: payload.daysUntilNextNewMoon ?? null,
      source: payload.source,
      cached_at: payload.cachedAt,
      expires_at: payload.expiresAt,
      raw,
    },
    { onConflict: 'lat_bucket,lon_bucket,local_date' }
  );

  if (error) {
    if (isMissingCacheTable(error)) {
      cacheDisabled = true;
      logCacheDisabled("Supabase table 'moon_cache' not found; disabling moon cache writes");
      return;
    }

    console.warn('[moon-cache] Failed to persist cache', error);
  }
}

function mapRowToPayload(row: MoonCacheRow): MoonSunData {
  return {
    latBucket: row.lat_bucket,
    lonBucket: row.lon_bucket,
    localDate: row.local_date,
    timezone: row.timezone,
    sunriseISO: row.sunrise_iso ?? undefined,
    sunsetISO: row.sunset_iso ?? undefined,
    dayLengthMinutes: row.day_length_minutes ?? undefined,
    moonriseISO: row.moonrise_iso ?? undefined,
    moonsetISO: row.moonset_iso ?? undefined,
    moonTransitISO: row.moon_transit_iso ?? undefined,
    moonPhaseName: row.moon_phase_name ?? undefined,
    moonPhaseFraction: row.moon_phase_fraction ?? undefined,
    moonIlluminationPct: row.moon_illumination_pct ?? undefined,
    moonPhaseStage: row.moon_phase_stage ?? undefined,
    daysUntilNextFullMoon: row.days_until_next_full_moon ?? undefined,
    daysUntilNextNewMoon: row.days_until_next_new_moon ?? undefined,
    source: row.source ?? DEFAULT_PROVIDER,
    cachedAt: row.cached_at,
    expiresAt: row.expires_at,
  };
}

function computeExpiryIso(localDate: string, timeZone: string): string {
  try {
    const date = Temporal.PlainDate.from(localDate);
    // Cache expires at midnight of the SAME day (transition to next day)
    // This ensures moon data refreshes daily at midnight
    const nextDay = date.add({ days: 1 });
    const nextMidnight = Temporal.ZonedDateTime.from(`${nextDay.toString()}T00:00:00[${timeZone}]`);
    return nextMidnight.toInstant().toString();
  } catch {
    const tomorrow = Temporal.Now.instant().add({ hours: 24 });
    return tomorrow.toString();
  }
}

/**
 * Fetch astronomy data from Open-Meteo (FREE, no API key required)
 * Primary data source for sun data; moon data comes from SunCalc
 */
async function fetchFromOpenMeteo(lat: number, lon: number, date: string): Promise<IpGeoAstronomyResponse | null> {
  try {
    // Round to 0dp for astronomy API calls (same precision as ipgeolocation)
    const rlat = round0dp(lat);
    const rlon = round0dp(lon);
    
    // Open-Meteo forecast API has sunrise/sunset
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(rlat));
    url.searchParams.set('longitude', String(rlon));
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '1');

    console.log(`📡 Open-Meteo forecast: lat=${rlat}, lon=${rlon}, date=${date}`);
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.log(`📊 Open-Meteo: Response ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      daily?: {
        time?: string[];
        sunrise?: string[];
        sunset?: string[];
      };
      timezone?: string;
    };
    
    if (!data.daily || !data.daily.time?.[0]) {
      console.log('📊 Open-Meteo: No daily data available');
      return null;
    }

    // Get moon data from SunCalc for this location and date
    const targetDate = new Date(data.daily.time[0] + 'T12:00:00Z');
    const moonTimes = getMoonTimes(targetDate, rlat, rlon);
    const moonIllum = getMoonIllumination(targetDate);

    // Convert Open-Meteo format + SunCalc moon data to IpGeoAstronomyResponse format
    const result: IpGeoAstronomyResponse = {
      date: data.daily.time[0],
      timezone: data.timezone || 'UTC',
      sunrise: data.daily.sunrise?.[0]?.substring(11, 16), // Extract HH:MM from ISO
      sunset: data.daily.sunset?.[0]?.substring(11, 16),
      moonrise: moonTimes.rise?.toISOString().substring(11, 16),
      moonset: moonTimes.set?.toISOString().substring(11, 16),
      moon_angle: moonIllum.phase * 360, // Convert 0-1 to degrees
      moon_illumination_percentage: moonIllum.fraction * 100, // Convert 0-1 to percentage
    };

    console.log('✅ Open-Meteo + SunCalc: Astronomy data found');
    return result;
  } catch (error) {
    console.error('❌ Open-Meteo error:', error);
    return null;
  }
}

/**
 * Calculate astronomy data using SunCalc library (FREE, local calculation)
 * Ultimate fallback when all APIs fail
 */
async function fetchFromSunCalc(lat: number, lon: number, date: string): Promise<IpGeoAstronomyResponse> {
  try {
    console.log(`🌙 SunCalc: Computing local astronomy for lat=${lat}, lon=${lon}`);
    
    const targetDate = new Date(date + 'T12:00:00Z'); // Use noon to avoid timezone issues
    const moonTimes = getMoonTimes(targetDate, lat, lon);
    const sunTimes = getTimes(targetDate, lat, lon);
    const moonIllum = getMoonIllumination(targetDate);

    const result: IpGeoAstronomyResponse = {
      date,
      timezone: 'UTC',
      sunrise: sunTimes.sunrise?.toISOString().substring(11, 16), // HH:MM format
      sunset: sunTimes.sunset?.toISOString().substring(11, 16),
      moonrise: moonTimes.rise?.toISOString().substring(11, 16),
      moonset: moonTimes.set?.toISOString().substring(11, 16),
      moon_angle: moonIllum.phase * 360, // Convert 0-1 to degrees
      moon_illumination_percentage: moonIllum.fraction * 100, // Convert 0-1 to percentage
    };

    console.log('✅ SunCalc: Local calculation complete');
    return result;
  } catch (error) {
    console.error('❌ SunCalc error:', error);
    // Return minimal data if calculation fails
    return {
      date,
      timezone: 'UTC',
    };
  }
}

async function requestAstronomyData({ lat, lon, date }: FetchParams): Promise<IpGeoAstronomyResponse> {
  const apiKey = process.env.MOON_API_KEY || process.env.IPGEOLOCATION_API_KEY;
  const apiUrl = process.env.MOON_API_URL || 'https://api.ipgeolocation.io/astronomy';

  if (!apiKey) {
    throw new Error('Moon data API key missing: set MOON_API_KEY or IPGEOLOCATION_API_KEY.');
  }

  // Round to 0dp (whole degrees ~111km) for astronomy data with 24h cache
  const rlat = round0dp(lat);
  const rlon = round0dp(lon);

  const params = new URLSearchParams({
    apiKey,
    lat: String(rlat),
    long: String(rlon),
  });
  if (date) {
    params.set('date', date);
  }

  const url = `${apiUrl}?${params.toString()}`;
  const response = await fetch(url, { method: 'GET' });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Moon data API error (${response.status}): ${text}`);
  }

  return (await response.json()) as IpGeoAstronomyResponse;
}

function buildPayload(
  data: IpGeoAstronomyResponse,
  latBucket: number,
  lonBucket: number
): MoonSunData {
  const localDate = data.date ?? Temporal.Now.instant().toZonedDateTimeISO('UTC').toPlainDate().toString();
  const timezone = data.timezone ?? 'UTC';
  // Try both field names for illumination
  const illuminationPct = normalizeIllumination(data.moon_illumination_percentage ?? data.moon_illumination);
  // Calculate moon age from moon_angle if moon_age not available
  const moonAge = data.moon_age ?? (data.moon_angle != null ? (data.moon_angle / 360) * SYNODIC_MONTH_DAYS : undefined);
  const moonPhaseFraction = parseMoonFraction(moonAge, illuminationPct);
  const sunriseISO = toZonedInstantISO(localDate, data.sunrise as string | undefined, timezone);
  const sunsetISO = toZonedInstantISO(localDate, data.sunset as string | undefined, timezone);
  const moonriseISO = toZonedInstantISO(localDate, data.moonrise as string | undefined, timezone) ??
    toZonedInstantISO(localDate, (data as Record<string, unknown>)['moonrise_next'] as string | undefined, timezone);
  const moonsetISO = toZonedInstantISO(localDate, data.moonset as string | undefined, timezone) ??
    toZonedInstantISO(localDate, (data as Record<string, unknown>)['moonset_previous'] as string | undefined, timezone);
  
  const moonPhaseStage = getMoonPhaseStage(moonPhaseFraction);
  const { daysUntilFullMoon, daysUntilNewMoon } = calculateDaysUntilNextPhase(moonPhaseFraction);
  const moonTransitISO = calculateMoonTransit(moonriseISO, moonsetISO);

  return {
    latBucket,
    lonBucket,
    localDate,
    timezone,
    sunriseISO,
    sunsetISO,
    dayLengthMinutes: parseDayLength(data.day_length as string | undefined),
    moonriseISO,
    moonsetISO,
    moonTransitISO,
    moonPhaseName: data.moon_phase as string | undefined,
    moonPhaseFraction,
    moonIlluminationPct: illuminationPct,
    moonPhaseStage,
    daysUntilNextFullMoon: daysUntilFullMoon,
    daysUntilNextNewMoon: daysUntilNewMoon,
    source: DEFAULT_PROVIDER,
    cachedAt: Temporal.Now.instant().toString(),
    expiresAt: computeExpiryIso(localDate, timezone),
  };
}

export async function getMoonSunData(params: FetchParams): Promise<MoonSunData> {
  const supabase = getSupabaseServerClient();
  const latBucket = roundToGrid(params.lat);
  const lonBucket = roundToGrid(params.lon);

  const previewDate = params.date ?? Temporal.Now.instant().toZonedDateTimeISO('UTC').toPlainDate().toString();
  
  // 1. Try cache first (with 0dp bucketing from Task 3)
  const cachedRow = await readFromCache(supabase, latBucket, lonBucket, previewDate);
  if (cachedRow) {
    console.log(`✅ Astronomy cache hit for ${latBucket},${lonBucket}`);
    return mapRowToPayload(cachedRow);
  }

  console.log('🔄 Astronomy cache miss - trying data sources in order...');
  let live: IpGeoAstronomyResponse | null = null;
  let source = 'unknown';

  // 2. Try Open-Meteo (FREE, no API key required)
  live = await fetchFromOpenMeteo(params.lat, params.lon, previewDate);
  if (live) {
    source = 'openmeteo';
  }

  // 3. Try ipgeolocation.io (PAID, only if API key exists and Open-Meteo failed)
  if (!live) {
    const hasApiKey = !!(process.env.MOON_API_KEY || process.env.IPGEOLOCATION_API_KEY);
    if (hasApiKey) {
      console.log('⚠️  Open-Meteo unavailable, trying ipgeolocation.io (PAID)');
      try {
        live = await requestAstronomyData(params);
        source = 'ipgeolocation-paid';
      } catch (error) {
        console.error('❌ ipgeolocation.io error:', error);
      }
    } else {
      console.log('📊 No paid API key configured, skipping ipgeolocation.io');
    }
  }

  // 4. Fallback to SunCalc (FREE, local calculation - always works)
  if (!live) {
    console.log('📊 All APIs unavailable, using SunCalc local calculation');
    live = await fetchFromSunCalc(params.lat, params.lon, previewDate);
    source = 'suncalc';
  }

  const localDate = live.date ?? previewDate;
  const payload = buildPayload(live, latBucket, lonBucket);
  
  // Update payload source to track which provider was used
  payload.source = source;
  
  await writeCache(supabase, latBucket, lonBucket, localDate, payload, live as Record<string, unknown> | null);
  
  console.log(`✅ Astronomy data fetched from ${source}`);
  return payload;
}
