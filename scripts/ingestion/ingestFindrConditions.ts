#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath });
dotenv.config();
import type { SupabaseClient } from '@supabase/supabase-js';
import { FALLBACK_RECTANGLE_OPTIONS } from '../../src/lib/findr/fallbackRectangles';
import {
  fetchStormglassMarine,
  fetchStormglassTides,
  fetchStormglassBio,
  fetchMetNoMarineSeries,
  fetchOpenMeteoMarineSeries,
  fetchOpenMeteoWeather,
  fetchWorldTides,
  type WorldTidesResponse,
} from '../../src/lib/services/weatherService';

interface UpsertRow {
  rectangle_code: string;
  captured_at: string;
  sea_temp_c: number | null;
  chlorophyll_mg_m3: number | null;
  dissolved_oxygen_mg_l: number | null;
  salinity_psu: number | null;
  nitrate_umol_l: number | null;
  phosphate_umol_l: number | null;
  wave_height_m: number | null;
  wind_speed_kts: number | null;
  wind_direction_deg: number | null;
  air_pressure_hpa: number | null;
  cloud_cover_pct: number | null;
  next_high_tide_iso: string | null;
  next_low_tide_iso: string | null;
  tide_phase: string | null;
  tide_flow_speed_ms: number | null;
  hourly_marine_json: unknown;
  daily_marine_json: unknown;
  source: string;
}

interface StormglassValue {
  sg?: number;
}

interface StormglassMarineHour {
  time: string;
  waveHeight?: number | StormglassValue;
  waveDirection?: number | StormglassValue;
  wavePeriod?: number | StormglassValue;
  swellHeight?: number | StormglassValue;
  swellDirection?: number | StormglassValue;
  swellPeriod?: number | StormglassValue;
  windSpeed?: number | StormglassValue;
  windDirection?: number | StormglassValue;
  gust?: number | StormglassValue;
  waterTemperature?: number | StormglassValue;
}

interface StormglassMarineResponse {
  hours: StormglassMarineHour[];
}

interface StormglassTidePoint {
  time: string;
  height: number;
  type: 'high' | 'low';
}

interface StormglassTideResponse {
  data: StormglassTidePoint[];
}

interface StormglassBioHour {
  time: string;
  chlorophyll?: number | StormglassValue;
  dissolvedOxygen?: number | StormglassValue;
  salinity?: number | StormglassValue;
  nitrate?: number | StormglassValue;
  phosphate?: number | StormglassValue;
  seaTemperature?: number | StormglassValue;
}

interface StormglassBioResponse {
  hours: StormglassBioHour[];
}

const MS_TO_KTS = 1.94384;
const FALLBACK_RECTANGLE_BY_CODE = new Map(
  FALLBACK_RECTANGLE_OPTIONS.map((option) => [option.code, option])
);
type MetProbeCandidate = { lat: number; lon: number; label: string };
type IngestSource = 'met' | 'openmeteo' | 'stormglass' | 'none';

// Helper to check if location is in US/North America for NOAA tides
function isNorthAmericanCoast(lat: number, lon: number): boolean {
  // US coasts, Canada, Mexico, Caribbean
  // Atlantic: 25°N-50°N, 100°W-60°W
  // Pacific: 25°N-60°N, 135°W-115°W
  // Gulf: 18°N-31°N, 98°W-80°W
  // Caribbean: 10°N-27°N, 90°W-60°W
  return (
    (lat >= 25 && lat <= 50 && lon >= -100 && lon <= -60) || // Atlantic
    (lat >= 25 && lat <= 60 && lon >= -135 && lon <= -115) || // Pacific
    (lat >= 18 && lat <= 31 && lon >= -98 && lon <= -80) || // Gulf
    (lat >= 10 && lat <= 27 && lon >= -90 && lon <= -60)    // Caribbean
  );
}

// Fetch NOAA tides for US/North American coasts (FREE)
async function fetchNOAATides(lat: number, lon: number): Promise<Array<{ time: string; type: string; height: number }> | null> {
  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 7);

    const url = new URL('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
    url.searchParams.set('product', 'predictions');
    url.searchParams.set('application', 'WotNow');
    url.searchParams.set('begin_date', now.toISOString().split('T')[0].replace(/-/g, ''));
    url.searchParams.set('end_date', endDate.toISOString().split('T')[0].replace(/-/g, ''));
    url.searchParams.set('datum', 'MLLW');
    url.searchParams.set('time_zone', 'gmt');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('interval', 'hilo');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat.toFixed(3)));
    url.searchParams.set('lon', String(lon.toFixed(3)));

    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { predictions?: Array<{ t: string; v: string; type: string }> };

    if (!data.predictions || data.predictions.length === 0) {
      return null;
    }

    return data.predictions.map((p: { t: string; v: string; type: string }) => ({
      time: p.t,
      type: p.type === 'H' ? 'high' : 'low',
      height: parseFloat(p.v)
    }));
  } catch (error) {
    console.warn('[NOAA] Tide fetch failed:', error);
    return null;
  }
}

interface IngestRectangleResult {
  success: boolean;
  source: IngestSource;
  metProbeAttempts: number;
  metProbeSuccessLabel: string | null;
  lastProbeLabel: string | null;
}

interface CoverageDetailEntry {
  code: string;
  region: string;
  attempts: number;
  metProbeLabel: string | null;
}

interface CoverageDetails {
  metSuccess: CoverageDetailEntry[];
  openMeteo: CoverageDetailEntry[];
  stormglass: CoverageDetailEntry[];
  failures: CoverageDetailEntry[];
}

function summariseRegionCounts(entries: CoverageDetailEntry[]): Array<{ region: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const region = entry.region || 'Unknown';
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
}

function logRegionSummary(label: string, entries: CoverageDetailEntry[], limit = 10) {
  const summary = summariseRegionCounts(entries);
  if (!summary.length) return;
  console.info(`[conditions-ingest] ${label}:`);
  summary.slice(0, limit).forEach(({ region, count }) => {
    console.info(`  - ${region}: ${count}`);
  });
}

function logCodeSample(label: string, entries: CoverageDetailEntry[], limit = 15) {
  if (!entries.length) return;
  const sample = entries.slice(0, limit).map((entry) => entry.code).join(', ');
  const suffix = entries.length > limit ? '…' : '';
  console.info(`[conditions-ingest] ${label} (${entries.length}): ${sample}${suffix}`);
}

function clampLatitude(lat: number): number {
  if (!Number.isFinite(lat)) return lat;
  if (lat > 90) return 90;
  if (lat < -90) return -90;
  return Number(lat.toFixed(6));
}

function wrapLongitude(lon: number): number {
  if (!Number.isFinite(lon)) return lon;
  let wrapped = lon;
  while (wrapped <= -180) wrapped += 360;
  while (wrapped > 180) wrapped -= 360;
  return Number(wrapped.toFixed(6));
}

function generateMetProbeCandidates(
  rectangle: TargetRectangle,
  primaryLat: number,
  primaryLon: number
): MetProbeCandidate[] {
  const seen = new Set<string>();
  const candidates: MetProbeCandidate[] = [];
  const baseCandidates: MetProbeCandidate[] = [];

  function registerCandidate(
    lat: number,
    lon: number,
    label: string,
    { base }: { base?: boolean } = {}
  ): MetProbeCandidate | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const normalizedLat = clampLatitude(lat);
    const normalizedLon = wrapLongitude(lon);
    const key = `${normalizedLat.toFixed(4)},${normalizedLon.toFixed(4)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const candidate: MetProbeCandidate = { lat: normalizedLat, lon: normalizedLon, label };
    candidates.push(candidate);
    if (base) {
      baseCandidates.push(candidate);
    }
    return candidate;
  }

  registerCandidate(primaryLat, primaryLon, 'primary', { base: true });

  if (rectangle.sampleLat != null && rectangle.sampleLon != null) {
    registerCandidate(rectangle.sampleLat, rectangle.sampleLon, 'coastal-sample', { base: true });
  }

  const centerLooksBlank = Math.abs(rectangle.centerLat) < 1e-4 && Math.abs(rectangle.centerLon) < 1e-4;
  if (!centerLooksBlank) {
    registerCandidate(rectangle.centerLat, rectangle.centerLon, 'center', { base: true });
  }

  const fallback = FALLBACK_RECTANGLE_BY_CODE.get(rectangle.code);
  if (fallback) {
    registerCandidate(fallback.centerLat, fallback.centerLon, 'fallback-center', { base: true });
  }

  if (SIMPLE_MET_PROBES) {
    return baseCandidates;
  }

  const cardinalDirections = [
    { dLat: 0, dLon: 1, label: 'east' },
    { dLat: 0, dLon: -1, label: 'west' },
    { dLat: 1, dLon: 0, label: 'north' },
    { dLat: -1, dLon: 0, label: 'south' },
  ];
  const diagonalDirections = [
    { dLat: 1, dLon: 1, label: 'northeast' },
    { dLat: 1, dLon: -1, label: 'northwest' },
    { dLat: -1, dLon: 1, label: 'southeast' },
    { dLat: -1, dLon: -1, label: 'southwest' },
  ];
  const radialSteps = [0.18];

  for (const baseCandidate of baseCandidates) {
    for (const step of radialSteps) {
      for (const dir of cardinalDirections) {
        registerCandidate(
          baseCandidate.lat + dir.dLat * step,
          baseCandidate.lon + dir.dLon * step,
          `${baseCandidate.label}:${dir.label}@${step.toFixed(2)}`
        );
      }
    }
  const diagonalStep = 0.26;
    for (const dir of diagonalDirections) {
      registerCandidate(
        baseCandidate.lat + dir.dLat * diagonalStep,
        baseCandidate.lon + dir.dLon * diagonalStep,
        `${baseCandidate.label}:${dir.label}@${diagonalStep.toFixed(2)}`
      );
    }
  }

  const wideLonSteps = [-0.75, -0.45, 0.45, 0.75];
  const wideLatSteps = [0, 0.25, -0.25];
  const wideLatOnlySteps = [0.45, -0.45];

  for (const baseCandidate of baseCandidates) {
    for (const lonStep of wideLonSteps) {
      for (const latStep of wideLatSteps) {
        registerCandidate(
          baseCandidate.lat + latStep,
          baseCandidate.lon + lonStep,
          `${baseCandidate.label}:wide@${lonStep.toFixed(2)}:${latStep.toFixed(2)}`
        );
      }
    }

    for (const latStep of wideLatOnlySteps) {
      registerCandidate(
        baseCandidate.lat + latStep,
        baseCandidate.lon,
        `${baseCandidate.label}:wide-lat@${latStep.toFixed(2)}`
      );
    }

    registerCandidate(
      baseCandidate.lat,
      baseCandidate.lon + 0.25,
      `${baseCandidate.label}:wide@0.25:0.00`
    );
    registerCandidate(
      baseCandidate.lat,
      baseCandidate.lon - 0.25,
      `${baseCandidate.label}:wide@-0.25:0.00`
    );
  }

  return candidates;
}
const RECTANGLES_TABLE = 'findr_rectangles';

function parseEnvBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const SIMPLE_MET_PROBES = parseEnvBoolean(process.env.FINDR_MET_SIMPLE_PROBES || process.env.FINDR_SIMPLE_PROBES);

function parseEnvNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export interface TargetRectangle {
  code: string;
  centerLat: number;
  centerLon: number;
  sampleLat?: number | null;
  sampleLon?: number | null;
}

function isMissingColumnError(error: any): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === '42703');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parsePointWkt(wkt: unknown): { lat: number; lon: number } | null {
  if (typeof wkt !== 'string') return null;
  const match = wkt.trim().match(/point\s*\(\s*([+-]?[0-9]*\.?[0-9]+)\s+([+-]?[0-9]*\.?[0-9]+)\s*\)/i);
  if (!match) return null;

  const lon = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}
export async function loadTargetRectangles(
  client: SupabaseClient<any>,
  limit?: number
): Promise<TargetRectangle[]> {
  const columnCandidates = [
    'rectangle_code, center_lat, center_lon, recommended_coastal_lat, recommended_coastal_lon, coastal_sample_lat, coastal_sample_lon, sample_wkt',
    'rectangle_code, center_lat, center_lon, coastal_sample_lat, coastal_sample_lon, sample_wkt',
    'rectangle_code, center_lat, center_lon, sample_wkt',
    'rectangle_code, center_lat, center_lon'
  ];

  for (const columns of columnCandidates) {
    let query = client
      .from(RECTANGLES_TABLE)
      .select(columns)
      .order('rectangle_code', { ascending: true });

    if (typeof limit === 'number' && Number.isFinite(limit)) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      console.error('[conditions-ingest] Failed to load rectangles from Supabase; falling back if possible.', error);
      break;
    }

    if (Array.isArray(data) && data.length) {
      return data.map((row) => {
        const record = row as unknown as Record<string, unknown>;
        const centerLat = toNumber(record.center_lat) ?? 0;
        const centerLon = toNumber(record.center_lon) ?? 0;

        const recommendedLat = toNumber(record.recommended_coastal_lat) ?? toNumber(record.coastal_sample_lat);
        const recommendedLon = toNumber(record.recommended_coastal_lon) ?? toNumber(record.coastal_sample_lon);
        const sampleFromWkt = parsePointWkt(record.sample_wkt);

        const sampleLat = recommendedLat ?? sampleFromWkt?.lat ?? null;
        const sampleLon = recommendedLon ?? sampleFromWkt?.lon ?? null;

        return {
          code: String(record.rectangle_code),
          centerLat,
          centerLon,
          sampleLat,
          sampleLon,
        } satisfies TargetRectangle;
      });
    }
  }

  console.warn('[conditions-ingest] Could not load rectangles from Supabase with enhanced columns; using fallback CSV list.');
  const fallback = typeof limit === 'number' && Number.isFinite(limit)
    ? FALLBACK_RECTANGLE_OPTIONS.slice(0, limit)
    : FALLBACK_RECTANGLE_OPTIONS;

  return fallback.map((option) => ({
    code: option.code,
    centerLat: option.centerLat,
    centerLon: option.centerLon,
    sampleLat: option.centerLat,
    sampleLon: option.centerLon,
  }));
}

function sgNumber(input: number | StormglassValue | undefined | null): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return input;
  if (typeof input === 'object' && typeof input.sg === 'number') return input.sg;
  return null;
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function toKnots(speedMs: number | null): number | null {
  if (speedMs == null) return null;
  const converted = speedMs * MS_TO_KTS;
  return Number.isFinite(converted) ? Number(converted.toFixed(1)) : null;
}

function toFixedOrNull(value: number | null, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function buildHourlySeries(hours: StormglassMarineHour[] | undefined): Array<{ time: string; waveHeightM: number | null; windSpeedKts: number | null; seaTemperatureC: number | null; tideMeters: number | null }> {
  if (!Array.isArray(hours)) return [];
  return hours.slice(0, 24).map((hour) => {
    const waveHeight = sgNumber(hour.waveHeight);
    const windSpeedMs = sgNumber(hour.windSpeed);
    const waterTemp = sgNumber(hour.waterTemperature);
    return {
      time: hour.time,
      waveHeightM: toFixedOrNull(waveHeight, 2),
      windSpeedKts: toKnots(windSpeedMs),
      seaTemperatureC: toFixedOrNull(waterTemp, 2),
      tideMeters: null,
    };
  });
}

function summariseDaily(hourly: ReturnType<typeof buildHourlySeries>) {
  const days = new Map<string, { waves: number[]; temps: number[]; winds: number[] }>();
  for (const entry of hourly) {
    const date = entry.time.slice(0, 10);
    if (!days.has(date)) {
      days.set(date, { waves: [], temps: [], winds: [] });
    }
    const bucket = days.get(date)!;
    if (typeof entry.waveHeightM === 'number') bucket.waves.push(entry.waveHeightM);
    if (typeof entry.seaTemperatureC === 'number') bucket.temps.push(entry.seaTemperatureC);
    if (typeof entry.windSpeedKts === 'number') bucket.winds.push(entry.windSpeedKts);
  }

  const formatter = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' });

  return [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, 7).map(([date, bucket]) => {
    const waveAvg = average(bucket.waves);
    const tempAvg = average(bucket.temps);
    const windAvg = average(bucket.winds);
    const dateObj = new Date(date + 'T00:00:00Z');
    const label = formatter.format(dateObj);

    let score = 75;
    if (typeof waveAvg === 'number') score -= waveAvg * 20;
    if (typeof windAvg === 'number' && windAvg > 15) score -= (windAvg - 15) * 2;
    if (typeof tempAvg === 'number' && (tempAvg < 8 || tempAvg > 24)) score -= 10;
    score = Math.max(5, Math.min(95, score));

    let summary = 'Balanced marine conditions expected.';
    if (waveAvg != null && waveAvg < 1 && windAvg != null && windAvg < 12) {
      summary = 'Calm seas and light winds—ideal for most fishing styles.';
    } else if (waveAvg != null && waveAvg > 1.8) {
      summary = 'Choppy water—plan cautiously and adjust tackle.';
    } else if (windAvg != null && windAvg > 18) {
      summary = 'Fresh breeze may limit light setups—seek sheltered spots.';
    }

    return {
      label,
      dateLabel: label,
      waveHeightM: waveAvg != null ? Number(waveAvg.toFixed(2)) : 0,
      seaTemperatureC: tempAvg != null ? Number(tempAvg.toFixed(2)) : 0,
      windSpeedKts: windAvg != null ? Number(windAvg.toFixed(1)) : 0,
      fishingScore: Math.round(score),
      summary,
    };
  });
}

type MetNoMarineSeries = Awaited<ReturnType<typeof fetchMetNoMarineSeries>>;

interface MetNoFallbackBundle {
  hourlySeries: ReturnType<typeof buildHourlySeries>;
  seaTemperatureC: number | null;
  waveHeightM: number | null;
  windSpeedKts: number | null;
  windDirectionDeg: number | null;
  airPressureHpa: number | null;
  cloudCoverPct: number | null;
}

interface OpenMeteoFallbackBundle {
  hourlySeries: ReturnType<typeof buildHourlySeries>;
  seaTemperatureC: number | null;
  waveHeightM: number | null;
  windSpeedKts: number | null;
  windDirectionDeg: number | null;
  seaLevelMeters: number | null;
  // Phase 1: Weather data from OpenMeteo forecast API (for European rectangles)
  airPressureHpa: number | null;
  cloudCoverPct: number | null;
}

async function buildMetNoMarineFallback(
  lat: number,
  lon: number,
  start: Date,
  end: Date
): Promise<MetNoFallbackBundle | null> {
  const roundedLat = Number(lat.toFixed(4));
  const roundedLon = Number(lon.toFixed(4));

  const metSeries: MetNoMarineSeries = await fetchMetNoMarineSeries(
    roundedLat,
    roundedLon,
    start.toISOString(),
    end.toISOString(),
    { maxHours: 24 }
  );

  if (!metSeries || !metSeries.hours.length) return null;

  const hourlySeries = metSeries.hours.map((hour) => ({
    time: hour.timeISO,
    waveHeightM: hour.waveHeightM,
    windSpeedKts: hour.windSpeedKts,
    seaTemperatureC: hour.seaTemperatureC,
    tideMeters: null,
  }));

  const firstHour = metSeries.firstHour ?? metSeries.hours[0];

  return {
    hourlySeries,
    seaTemperatureC: firstHour?.seaTemperatureC ?? null,
    waveHeightM: firstHour?.waveHeightM ?? null,
    windSpeedKts: firstHour?.windSpeedKts ?? null,
    windDirectionDeg: firstHour?.windDirectionDeg ?? null,
    airPressureHpa: firstHour?.airPressureHpa ?? null,
    cloudCoverPct: firstHour?.cloudCoverPct ?? null,
  };
}

async function buildOpenMeteoMarineFallback(
  lat: number,
  lon: number,
  start: Date,
  end: Date
): Promise<OpenMeteoFallbackBundle | null> {
  const series = await fetchOpenMeteoMarineSeries(
    Number(lat.toFixed(4)),
    Number(lon.toFixed(4)),
    start.toISOString(),
    end.toISOString(),
    { maxHours: 24 }
  );

  if (!series || !Array.isArray(series.hours) || !series.hours.length) return null;

  const toTide = (value: number | null): number | null => toFixedOrNull(value, 2);

  const hourlySeries = series.hours.map((hour) => {
    const windKts = hour.windSpeedKts ?? toKnots(hour.windSpeedMS);
    return {
      time: hour.timeISO,
      waveHeightM: toFixedOrNull(hour.waveHeightM, 2),
      windSpeedKts: windKts,
      seaTemperatureC: toFixedOrNull(hour.seaTemperatureC, 2),
      tideMeters: toTide(hour.seaLevelMeters),
    };
  });

  const firstHour = series.firstHour ?? series.hours[0];
  if (!firstHour) return null;

  const windSpeedKts = firstHour.windSpeedKts ?? toKnots(firstHour.windSpeedMS);

  // Phase 1: Fetch weather data (pressure, cloud cover) from OpenMeteo weather API
  // This supplements the marine data with atmospheric conditions for European rectangles
  let airPressureHpa: number | null = null;
  let cloudCoverPct: number | null = null;

  try {
    const startDate = start.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDate = end.toISOString().split('T')[0];

    const weatherData = await fetchOpenMeteoWeather(
      Number(lat.toFixed(4)),
      Number(lon.toFixed(4)),
      startDate,
      endDate
    ) as any;

    if (weatherData?.hourly) {
      const times = weatherData.hourly.time || [];
      const pressures = weatherData.hourly.pressure_msl || [];
      const cloudCovers = weatherData.hourly.cloud_cover || [];

      // Get first hour data (matching marine data first hour)
      if (times.length > 0 && pressures.length > 0) {
        const pressure = pressures[0];
        if (typeof pressure === 'number' && !isNaN(pressure)) {
          airPressureHpa = toFixedOrNull(pressure, 1);
        }
      }

      if (times.length > 0 && cloudCovers.length > 0) {
        const cloudCover = cloudCovers[0];
        if (typeof cloudCover === 'number' && !isNaN(cloudCover)) {
          cloudCoverPct = toFixedOrNull(cloudCover, 0);
        }
      }
    }
  } catch (error) {
    // Weather data is supplementary - don't fail if it's unavailable
    console.warn(`[OpenMeteo] Weather data fetch failed for ${lat.toFixed(4)},${lon.toFixed(4)}:`, error);
  }

  return {
    hourlySeries,
    seaTemperatureC: toFixedOrNull(firstHour.seaTemperatureC, 2),
    waveHeightM: toFixedOrNull(firstHour.waveHeightM, 2),
    windSpeedKts,
    windDirectionDeg: toFixedOrNull(firstHour.windDirectionDeg, 0),
    seaLevelMeters: toTide(firstHour.seaLevelMeters),
    airPressureHpa,
    cloudCoverPct,
  } satisfies OpenMeteoFallbackBundle;
}

export async function ingestRectangle(
  client: SupabaseClient<any>,
  rectangle: TargetRectangle,
  lat: number,
  lon: number,
  capturedAtISO: string,
  stormglassKey: string | undefined,
  options: { metOnly?: boolean } = {}
): Promise<IngestRectangleResult> {
  const rectangleCode = rectangle.code;
  const metOnly = Boolean(options.metOnly);
  const start = new Date(capturedAtISO);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const probeCandidates = generateMetProbeCandidates(
    rectangle,
    lat,
    lon
  );
  if (probeCandidates.length === 0) {
    probeCandidates.push({ lat, lon, label: 'primary-fallback' });
  }
  let metMarine: MetNoFallbackBundle | null = null;
  let metProbeAttempts = 0;
  let metProbeSuccessLabel: string | null = null;
  let lastProbeLabel: string | null = null;

  for (let index = 0; index < probeCandidates.length; index += 1) {
    const candidate = probeCandidates[index];
    metProbeAttempts += 1;
    lastProbeLabel = candidate.label;
    const attempt = await buildMetNoMarineFallback(candidate.lat, candidate.lon, start, end);
    if (attempt) {
      metMarine = attempt;
      metProbeSuccessLabel = candidate.label;
      if (index > 0) {
        console.info(
          `[conditions-ingest] MET recovered for ${rectangleCode} via ${candidate.label} probe @ ${candidate.lat.toFixed(4)},${candidate.lon.toFixed(4)}`
        );
      }
      break;
    }

    const message = `[conditions-ingest] MET void for ${rectangleCode} @ ${candidate.lat.toFixed(4)},${candidate.lon.toFixed(4)} (${candidate.label})`;
    if (index === 0) {
      console.warn(message);
    } else {
      console.info(message);
    }
  }

  let openMeteoMarine: OpenMeteoFallbackBundle | null = null;
  let dataSource: IngestSource = metMarine ? 'met' : 'none';

  if (!metMarine && !metOnly) {
    openMeteoMarine = await buildOpenMeteoMarineFallback(lat, lon, start, end);
    if (openMeteoMarine) {
      dataSource = 'openmeteo';
      console.info(`[conditions-ingest] Open-Meteo recovered marine data for ${rectangleCode}`);
    }
  }

  const hasStormglassKey = typeof stormglassKey === 'string' && stormglassKey.length > 0;
  const canUseStormglass = hasStormglassKey && !metOnly;

  let marineRaw: StormglassMarineResponse | null = null;
  if (!metMarine && !openMeteoMarine) {
    if (!canUseStormglass) {
      console.warn(
        `[conditions-ingest] No MET Norway or Open-Meteo marine data for rectangle ${rectangleCode} after ${metProbeAttempts} probes and Stormglass fallback disabled.`
      );
      return {
        success: false,
        source: 'none',
        metProbeAttempts,
        metProbeSuccessLabel: null,
        lastProbeLabel,
      } satisfies IngestRectangleResult;
    }

    console.warn(
      `[conditions-ingest] No MET Norway marine data for rectangle ${rectangleCode} after ${metProbeAttempts} probes; falling back to Stormglass.`
    );
    const sgKey = stormglassKey as string;
    marineRaw = await fetchStormglassMarine(lat, lon, start.toISOString(), end.toISOString(), undefined, sgKey) as StormglassMarineResponse | null;
    if (!marineRaw || !Array.isArray(marineRaw.hours) || marineRaw.hours.length === 0) {
      console.warn(`[conditions-ingest] No marine data for rectangle ${rectangleCode} (MET Norway + Open-Meteo + Stormglass fallback failed)`);
      return {
        success: false,
        source: 'none',
        metProbeAttempts,
        metProbeSuccessLabel: null,
        lastProbeLabel,
      } satisfies IngestRectangleResult;
    }
    dataSource = 'stormglass';
  }

  // Tide data: 3-tier waterfall (WorldTides → NOAA → Stormglass)
  let tideData: Array<{ time: string; type: string; height: number }> | null = null;
  let tideSource: 'worldtides' | 'noaa' | 'stormglass' | 'none' = 'none';

  // 1. Try WorldTides first (FREE, global coverage)
  const worldTidesData = await fetchWorldTides(lat, lon, 7);
  if (worldTidesData && worldTidesData.extremes && worldTidesData.extremes.length > 0) {
    tideData = worldTidesData.extremes.map(e => ({
      time: e.date,
      type: e.type.toLowerCase(),
      height: e.height
    }));
    tideSource = 'worldtides';
    console.info(`[${rectangleCode}] Using WorldTides for tides (FREE)`);
  }

  // 2. Try NOAA for US/North American coasts (FREE)
  if (!tideData && isNorthAmericanCoast(lat, lon)) {
    const noaaData = await fetchNOAATides(lat, lon);
    if (noaaData) {
      tideData = noaaData;
      tideSource = 'noaa';
      console.info(`[${rectangleCode}] Using NOAA for tides (FREE)`);
    }
  }

  // 3. Fall back to Stormglass only as last resort (PAID)
  let tidesRaw: StormglassTideResponse | null = null;
  if (!tideData && dataSource === 'stormglass' && stormglassKey) {
    const sgKey = stormglassKey;
    tidesRaw = await fetchStormglassTides(lat, lon, sgKey) as Promise<StormglassTideResponse | null>;
    if (tidesRaw && tidesRaw.data) {
      tideData = tidesRaw.data;
      tideSource = 'stormglass';
      console.info(`[${rectangleCode}] Using Stormglass for tides (PAID)`);
    }
  }

  // Fetch bio data from Stormglass if available
  let bioRaw: StormglassBioResponse | null = null;
  if (dataSource === 'stormglass' && stormglassKey) {
    bioRaw = await fetchStormglassBio(lat, lon, start.toISOString(), end.toISOString(), undefined, stormglassKey) as Promise<StormglassBioResponse | null>;
  }

  const hourlySeries = metMarine
    ? metMarine.hourlySeries
    : openMeteoMarine
      ? openMeteoMarine.hourlySeries
      : buildHourlySeries((marineRaw!.hours ?? []));

  const bioHour = dataSource === 'stormglass' ? bioRaw?.hours?.[0] : undefined;

  const seaTemp = metMarine?.seaTemperatureC
    ?? openMeteoMarine?.seaTemperatureC
    ?? toFixedOrNull(sgNumber(bioHour?.seaTemperature) ?? sgNumber(marineRaw?.hours?.[0]?.waterTemperature), 2);
  const chlorophyll = dataSource === 'stormglass' ? toFixedOrNull(sgNumber(bioHour?.chlorophyll), 2) : null;
  const dissolvedOxygen = dataSource === 'stormglass' ? toFixedOrNull(sgNumber(bioHour?.dissolvedOxygen), 2) : null;
  const salinity = dataSource === 'stormglass' ? toFixedOrNull(sgNumber(bioHour?.salinity), 2) : null;
  const nitrate = dataSource === 'stormglass' ? toFixedOrNull(sgNumber(bioHour?.nitrate), 2) : null;
  const phosphate = dataSource === 'stormglass' ? toFixedOrNull(sgNumber(bioHour?.phosphate), 2) : null;

  const waveHeight = metMarine?.waveHeightM
    ?? openMeteoMarine?.waveHeightM
    ?? toFixedOrNull(sgNumber(marineRaw?.hours?.[0]?.waveHeight), 2);
  const windSpeedKts = metMarine?.windSpeedKts
    ?? openMeteoMarine?.windSpeedKts
    ?? toKnots(sgNumber(marineRaw?.hours?.[0]?.windSpeed));
  const windDirectionDeg = metMarine?.windDirectionDeg
    ?? openMeteoMarine?.windDirectionDeg
    ?? toFixedOrNull(sgNumber(marineRaw?.hours?.[0]?.windDirection), 0);

  const nextHigh = tideData?.find((point) => String(point.type).toLowerCase().includes('high'))?.time ?? null;
  const nextLow = tideData?.find((point) => String(point.type).toLowerCase().includes('low'))?.time ?? null;

  // Calculate tide phase and flow speed using helper functions
  let tidePhase: string | null = null;
  let tideFlowSpeed: number | null = null;

  if (nextHigh && nextLow) {
    try {
      // Call calculate_tide_phase RPC function
      const { data: phaseData, error: phaseError } = await client.rpc('calculate_tide_phase', {
        p_current_time: capturedAtISO,
        p_next_high: nextHigh,
        p_next_low: nextLow
      });

      if (!phaseError && phaseData) {
        tidePhase = phaseData;
      }

      // Call calculate_tide_flow_speed RPC function
      const { data: flowData, error: flowError } = await client.rpc('calculate_tide_flow_speed', {
        p_current_time: capturedAtISO,
        p_next_high: nextHigh,
        p_next_low: nextLow
      });

      if (!flowError && flowData !== null && flowData !== undefined) {
        tideFlowSpeed = flowData;
      }
    } catch (error) {
      console.warn(`[${rectangleCode}] Tide calculation failed:`, error);
    }
  }

  // Phase 1: Air pressure and cloud cover (from MET Norway or OpenMeteo weather API)
  const airPressureHpa = metMarine?.airPressureHpa ?? openMeteoMarine?.airPressureHpa ?? null;
  const cloudCoverPct = metMarine?.cloudCoverPct ?? openMeteoMarine?.cloudCoverPct ?? null;

  const row: UpsertRow = {
    rectangle_code: rectangleCode,
    captured_at: capturedAtISO,
    sea_temp_c: seaTemp,
    chlorophyll_mg_m3: chlorophyll,
    dissolved_oxygen_mg_l: dissolvedOxygen,
    salinity_psu: salinity,
    nitrate_umol_l: nitrate,
    phosphate_umol_l: phosphate,
    wave_height_m: waveHeight,
    wind_speed_kts: windSpeedKts,
    wind_direction_deg: windDirectionDeg,
    air_pressure_hpa: airPressureHpa,
    cloud_cover_pct: cloudCoverPct,
    next_high_tide_iso: nextHigh,
    next_low_tide_iso: nextLow,
    tide_phase: tidePhase,
    tide_flow_speed_ms: tideFlowSpeed,
    hourly_marine_json: hourlySeries,
    daily_marine_json: summariseDaily(hourlySeries),
    source: dataSource === 'met'
      ? 'ingest:metno-primary'
      : dataSource === 'openmeteo'
        ? 'ingest:openmeteo'
        : 'ingest:stormglass',
  };

  const { error } = await client.from('findr_conditions_snapshots').upsert(row as any, {
    onConflict: 'rectangle_code,captured_at',
  });

  if (error) {
    console.error(`[conditions-ingest] Failed to upsert ${rectangleCode}`, error);
    return {
      success: false,
      source: 'none',
      metProbeAttempts,
      metProbeSuccessLabel,
      lastProbeLabel,
    } satisfies IngestRectangleResult;
  }

  console.info(`[conditions-ingest] Upserted ${rectangleCode} snapshot`);
  return {
    success: true,
  source: dataSource === 'met' ? 'met' : dataSource === 'openmeteo' ? 'openmeteo' : 'stormglass',
    metProbeAttempts,
    metProbeSuccessLabel,
    lastProbeLabel,
  } satisfies IngestRectangleResult;
}

export interface IngestRectanglesOptions {
  delayBetweenRequestsMs?: number;
  capturedAtISO?: string;
  metOnly?: boolean;
}

export async function ingestRectangles(
  client: SupabaseClient<any>,
  rectangles: TargetRectangle[],
  stormglassKey: string | undefined,
  options: IngestRectanglesOptions = {},
): Promise<{ successCount: number; capturedAtISO: string; detail: CoverageDetails }> {
  const delayMs = options.delayBetweenRequestsMs ?? 300;
  const capturedAt = options.capturedAtISO ?? new Date().toISOString();
  let successCount = 0;

  const metOnly = Boolean(options.metOnly);
  const detail: CoverageDetails = {
    metSuccess: [],
    openMeteo: [],
    stormglass: [],
    failures: [],
  };

  for (const rectangle of rectangles) {
    const fallbackRect = FALLBACK_RECTANGLE_BY_CODE.get(rectangle.code);
    let targetLat = rectangle.sampleLat ?? rectangle.centerLat;
    let targetLon = rectangle.sampleLon ?? rectangle.centerLon;

    const needsFallback =
      !Number.isFinite(targetLat)
      || !Number.isFinite(targetLon)
      || (Math.abs(targetLat) < 1e-4 && Math.abs(targetLon) < 1e-4);

    if (needsFallback && fallbackRect) {
      targetLat = fallbackRect.centerLat;
      targetLon = fallbackRect.centerLon;
    }

    // FALLBACK_RECTANGLE_BY_CODE only covers a hand-picked set of European
    // rectangle codes. If a rectangle's own coordinates are missing/blank AND
    // it isn't in that list (any US/global rectangle, for example), don't
    // silently ingest real weather data at (0, 0) — Null Island — under this
    // rectangle's real code. Skip it and count it as a failure instead.
    if (needsFallback && !fallbackRect) {
      console.warn(`[conditions-ingest] Skipping ${rectangle.code}: no usable coordinates and no fallback entry`);
      detail.failures.push({
        code: rectangle.code,
        region: 'Unknown',
        attempts: 0,
        metProbeLabel: null,
      });
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      continue;
    }

    const result = await ingestRectangle(
      client,
      rectangle,
      targetLat,
      targetLon,
      capturedAt,
      stormglassKey,
      { metOnly }
    );
    const region = fallbackRect?.region ?? 'Unknown';
    const entry: CoverageDetailEntry = {
      code: rectangle.code,
      region,
      attempts: result.metProbeAttempts,
      metProbeLabel: result.metProbeSuccessLabel ?? result.lastProbeLabel,
    };

    if (result.success) {
      successCount += 1;
      if (result.source === 'met') {
        detail.metSuccess.push(entry);
      } else if (result.source === 'openmeteo') {
        detail.openMeteo.push(entry);
      } else if (result.source === 'stormglass') {
        detail.stormglass.push(entry);
      }
    } else {
      detail.failures.push(entry);
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { successCount, capturedAtISO: capturedAt, detail };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const metOnly = parseEnvBoolean(process.env.FINDR_MET_ONLY);
  const stormglassKey = process.env.STORMGLASS_SECRET_KEY || process.env.STORMGLASS_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  if (!stormglassKey && !metOnly) {
    console.warn('Missing Stormglass key. Open-Meteo fallback will be used as the final provider; some rectangles may remain void.');
  }

  const client = createClient<any>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const limit = parseEnvNumber(process.env.FINDR_CONDITIONS_LIMIT);
  const rectangles = await loadTargetRectangles(client, limit);

  if (!rectangles.length) {
    console.error('[conditions-ingest] No rectangles available to ingest. Aborting.');
    process.exit(1);
  }

  const result = await ingestRectangles(client, rectangles, stormglassKey, {
    delayBetweenRequestsMs: Number(process.env.FINDR_CONDITIONS_DELAY_MS ?? 300),
    metOnly,
  });

  console.info(`[conditions-ingest] Completed: ${result.successCount}/${rectangles.length} snapshots stored (captured_at=${result.capturedAtISO})`);

  const { metSuccess, openMeteo: openMeteoEntries, stormglass: stormglassEntries, failures } = result.detail;
  console.info(
    `[conditions-ingest] Coverage summary — MET primary/extended: ${metSuccess.length}, Open-Meteo fallback: ${openMeteoEntries.length}, Stormglass fallback: ${stormglassEntries.length}, Unresolved MET voids: ${failures.length}`
  );

  const recoveredViaExtended = metSuccess.filter((entry) => entry.metProbeLabel && entry.metProbeLabel !== 'primary');
  if (recoveredViaExtended.length) {
    console.info(`[conditions-ingest] MET recovered via extended probes: ${recoveredViaExtended.length}`);
    logCodeSample('MET recoveries sample', recoveredViaExtended, 12);
  }

  if (openMeteoEntries.length) {
    logRegionSummary('Open-Meteo fallback concentration', openMeteoEntries);
    logCodeSample('Open-Meteo rectangles sample', openMeteoEntries, 12);
  }

  if (stormglassEntries.length) {
    logRegionSummary('Stormglass fallback concentration', stormglassEntries);
    logCodeSample('Stormglass-required rectangles sample', stormglassEntries, 12);
  }

  if (failures.length) {
    logRegionSummary('Outstanding MET voids', failures);
    logCodeSample('MET void rectangle sample', failures, 12);
  }

  // A run that ingests zero rectangles is a silent outage, not a partial success —
  // without this the process always exits 0, so the calling GitHub Actions workflow
  // (which has no separate coverage-check step) has no way to detect it ever failed.
  if (result.successCount === 0) {
    console.error(`[conditions-ingest] 0/${rectangles.length} rectangles succeeded. Treating as failure.`);
    process.exit(1);
  }
}

// Run main if this is the entry point (ES module compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unexpected error during conditions ingestion', error);
    process.exit(1);
  });
}
