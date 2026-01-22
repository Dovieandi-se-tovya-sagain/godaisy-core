/**
 * API helper functions for multi-location system
 * Handles conversion between database format and API format
 */

import type { SavedLocation, LocationSlot } from '../../types/multiLocation';

export interface DatabaseRow {
  user_id: string;
  locations: unknown;
  active_location_id: string | null;
  last_modified_slot: string | null;
  home_coordinates: unknown;
  home_region: string | null;
  home_place_name: string | null;
  home_location_name: string | null;
  preferred_rectangles: unknown;
  location_source: string | null;
  updated_at: string;
}

/**
 * Parse locations JSONB array from database
 */
export function parseLocationsArray(locationsJson: unknown): SavedLocation[] {
  if (!locationsJson || !Array.isArray(locationsJson)) {
    return [];
  }

  return locationsJson
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const loc = item as Record<string, unknown>;

      // Validate required fields
      if (
        typeof loc.id !== 'string' ||
        typeof loc.slot !== 'string' ||
        typeof loc.name !== 'string' ||
        typeof loc.lat !== 'number' ||
        typeof loc.lon !== 'number'
      ) {
        return null;
      }

      return {
        id: loc.id,
        slot: loc.slot as LocationSlot,
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        rectangleCode: typeof loc.rectangleCode === 'string' ? loc.rectangleCode : null,
        rectangleRegion: typeof loc.rectangleRegion === 'string' ? loc.rectangleRegion : null,
        accuracy: typeof loc.accuracy === 'number' ? loc.accuracy : null,
        source: (loc.source as 'manual' | 'gps' | 'ip') || 'manual',
        updatedAt: typeof loc.updatedAt === 'string' ? loc.updatedAt : new Date().toISOString(),
        usageCount: typeof loc.usageCount === 'number' ? loc.usageCount : 1,
        metadata: loc.metadata as Record<string, unknown> | undefined,
      } as SavedLocation;
    })
    .filter((loc): loc is SavedLocation => loc !== null);
}

/**
 * Get active location from database row
 * Returns the location marked as active, or the first location, or null
 */
export function getActiveLocation(row: DatabaseRow | null): SavedLocation | null {
  if (!row) return null;

  const locations = parseLocationsArray(row.locations);
  if (locations.length === 0) return null;

  // Find location matching active_location_id
  if (row.active_location_id) {
    const active = locations.find((loc) => loc.id === row.active_location_id);
    if (active) return active;
  }

  // Fallback: return first location
  return locations[0] ?? null;
}

/**
 * Convert database row to legacy UnifiedLocationRecord format
 * For backward compatibility with existing code
 */
export function toLegacyFormat(row: DatabaseRow | null) {
  if (!row) return null;

  // Try new locations array first
  const activeLocation = getActiveLocation(row);
  if (activeLocation) {
    return {
      lat: activeLocation.lat,
      lon: activeLocation.lon,
      rectangleCode: activeLocation.rectangleCode,
      rectangleRegion: activeLocation.rectangleRegion,
      rectangleLabel: activeLocation.name,
      source: activeLocation.source,
      accuracy: activeLocation.accuracy,
      updatedAt: activeLocation.updatedAt,
    };
  }

  // Fallback to old home_coordinates format
  const coordinates = row.home_coordinates as Record<string, unknown> | null;
  if (!coordinates) return null;

  return {
    lat: typeof coordinates.lat === 'number' ? coordinates.lat : null,
    lon: typeof coordinates.lon === 'number' ? coordinates.lon : null,
    rectangleCode:
      typeof coordinates.rectangleCode === 'string'
        ? coordinates.rectangleCode
        : Array.isArray(row.preferred_rectangles) && typeof row.preferred_rectangles[0] === 'string'
          ? row.preferred_rectangles[0]
          : null,
    rectangleRegion:
      typeof coordinates.rectangleRegion === 'string'
        ? coordinates.rectangleRegion
        : row.home_region ?? row.home_place_name ?? null,
    rectangleLabel:
      typeof coordinates.rectangleLabel === 'string'
        ? coordinates.rectangleLabel
        : row.home_location_name ?? null,
    accuracy: typeof coordinates.accuracy === 'number' ? coordinates.accuracy : null,
    source: (row.location_source as 'manual' | 'gps' | 'ip') || 'manual',
    updatedAt: coordinates.updatedAt as string ?? row.updated_at,
  };
}

/**
 * Build home_coordinates payload for backward compatibility
 * Keeps old columns in sync with new system
 */
export function buildLegacyHomeCoordinatesPayload(location: SavedLocation | null) {
  if (!location) return null;

  return {
    lat: location.lat,
    lon: location.lon,
    accuracy: location.accuracy,
    rectangleCode: location.rectangleCode,
    rectangleRegion: location.rectangleRegion,
    rectangleLabel: location.name,
    updatedAt: location.updatedAt,
  };
}
