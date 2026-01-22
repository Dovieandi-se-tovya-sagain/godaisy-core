import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '../supabase/serverClient';

type GeoPoint = {
  type?: string;
  coordinates?: [number, number];
};

export type IcesRectangleRow = {
  id: string;
  rectangle_code: string;
  center_lat: number;
  center_lon: number;
  lat_south?: number;
  lat_north?: number;
  lon_west?: number;
  lon_east?: number;
  region?: string | null;
  distance_to_shore_km?: number | null;
  coastal_sample_point?: GeoPoint | null;
};

export type AnchorSource = 'coastal_sample' | 'center';

export interface RectangleAnchor {
  id: string;
  rectangleCode: string;
  anchorLat: number;
  anchorLon: number;
  centerLat: number;
  centerLon: number;
  source: AnchorSource;
  region?: string;
  distanceToShoreKm?: number;
}

export interface RectangleAnchorResult {
  rectangle: IcesRectangleRow;
  anchor: RectangleAnchor;
  distanceKm: number;
}

const anchorCacheByCode = new Map<string, RectangleAnchor>();

const DEFAULT_LAT_WINDOW = 1.5; // degrees north/south
const DEFAULT_LON_WINDOW = 2.5; // degrees east/west

function parseGeoPoint(point: unknown): { lat: number; lon: number } | null {
  if (!point || typeof point !== 'object') return null;
  const maybePoint = point as GeoPoint;
  if (Array.isArray(maybePoint.coordinates) && maybePoint.coordinates.length === 2) {
    const [lon, lat] = maybePoint.coordinates;
    if (typeof lat === 'number' && typeof lon === 'number') {
      return { lat, lon };
    }
  }
  return null;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normaliseRectangle(row: IcesRectangleRow, anchorPoint: { lat: number; lon: number }, source: AnchorSource): RectangleAnchor {
  const region = row.region ?? undefined;
  const distanceToShoreKm = row.distance_to_shore_km != null ? Number(row.distance_to_shore_km) : undefined;

  const anchor: RectangleAnchor = {
    id: row.id,
    rectangleCode: row.rectangle_code,
    anchorLat: Number(anchorPoint.lat),
    anchorLon: Number(anchorPoint.lon),
    centerLat: Number(row.center_lat),
    centerLon: Number(row.center_lon),
    source,
    region,
    distanceToShoreKm,
  };

  anchorCacheByCode.set(anchor.rectangleCode, anchor);
  return anchor;
}

function extractAnchorPoint(row: IcesRectangleRow): { point: { lat: number; lon: number }; source: AnchorSource } {
  const parsed = parseGeoPoint(row.coastal_sample_point);
  if (parsed) {
    return { point: parsed, source: 'coastal_sample' };
  }

  return {
    point: { lat: Number(row.center_lat), lon: Number(row.center_lon) },
    source: 'center',
  };
}

export function getCachedAnchor(rectangleCode: string): RectangleAnchor | undefined {
  return anchorCacheByCode.get(rectangleCode);
}

export function resolveAnchorFromRectangle(row: IcesRectangleRow): RectangleAnchor {
  const cached = anchorCacheByCode.get(row.rectangle_code);
  if (cached) return cached;

  const { point, source } = extractAnchorPoint(row);
  return normaliseRectangle(row, point, source);
}

export function normalizeRectangleRow(rawRow: Record<string, unknown>): IcesRectangleRow {
  return {
    id: String(rawRow.id ?? ''),
    rectangle_code: String(rawRow.rectangle_code ?? ''),
    center_lat: Number(rawRow.center_lat),
    center_lon: Number(rawRow.center_lon),
    lat_south: rawRow.lat_south != null ? Number(rawRow.lat_south) : undefined,
    lat_north: rawRow.lat_north != null ? Number(rawRow.lat_north) : undefined,
    lon_west: rawRow.lon_west != null ? Number(rawRow.lon_west) : undefined,
    lon_east: rawRow.lon_east != null ? Number(rawRow.lon_east) : undefined,
    region: (rawRow.region as string | null | undefined) ?? null,
    distance_to_shore_km: rawRow.distance_to_shore_km != null ? Number(rawRow.distance_to_shore_km) : null,
    coastal_sample_point: (rawRow.coastal_sample_point as GeoPoint | null | undefined) ?? null,
  };
}

export function getRectangleDayKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export async function getRectangleAnchorForLocation(
  lat: number,
  lon: number,
  options: {
    supabaseClient?: SupabaseClient;
    latWindow?: number;
    lonWindow?: number;
    includeNonCoastal?: boolean;
  } = {}
): Promise<RectangleAnchorResult | null> {
  const supabase = options.supabaseClient ?? getSupabaseServerClient();
  const latWindow = options.latWindow ?? DEFAULT_LAT_WINDOW;
  const lonWindow = options.lonWindow ?? DEFAULT_LON_WINDOW;

  const query = supabase
    .from('ices_rectangles')
    .select(
      [
        'id',
        'rectangle_code',
        'center_lat',
        'center_lon',
        'lat_south',
        'lat_north',
        'lon_west',
        'lon_east',
        'region',
        'distance_to_shore_km',
        'coastal_sample_point',
      ].join(', ')
    )
    .gte('lat_south', lat - latWindow)
    .lte('lat_north', lat + latWindow)
    .gte('lon_west', lon - lonWindow)
    .lte('lon_east', lon + lonWindow)
    .limit(40);

  if (!options.includeNonCoastal) {
    query.eq('is_coastal', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[rectangleAnchors] Failed to load ICES rectangles:', error);
    return null;
  }

  const rows = (data ?? []) as unknown as IcesRectangleRow[];

  if (!rows.length) {
    return null;
  }

  let best: { row: IcesRectangleRow; distance: number; anchor: RectangleAnchor } | null = null;

  for (const rawRow of rows) {
    const row = normalizeRectangleRow(rawRow as Record<string, unknown>);

    const anchor = resolveAnchorFromRectangle(row);
    const distance = haversineDistanceKm(lat, lon, anchor.anchorLat, anchor.anchorLon);
    if (!best || distance < best.distance) {
      best = { row, distance, anchor };
    }
  }

  if (!best) {
    return null;
  }

  return {
    rectangle: best.row,
    anchor: best.anchor,
    distanceKm: best.distance,
  };
}

export function buildRectangleCacheKey(rectangleCode: string, dataType: 'marine' | 'tides' | 'bio', dayKey?: string): string {
  const keyDay = dayKey ?? getRectangleDayKey();
  return `rect:${rectangleCode}|${dataType}|${keyDay}`;
}
