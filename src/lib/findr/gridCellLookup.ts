// lib/findr/gridCellLookup.ts

/**
 * Grid Cell Lookup for US Waters and Global Coverage
 *
 * Approach: Uses 0.25-degree grid system compatible with database infrastructure
 *
 * Grid System:
 * - 0.25° resolution (~ 27.8 km at equator, ~19.7 km at 45°N)
 * - Cell IDs: "G025_N4075W07400" format (Grid 0.25deg, center lat×100, center lon×100)
 * - Compatible with rectangles_025deg, rectangles_unified, grid_conditions_latest tables
 *
 * Database Tables:
 * - rectangles_025deg_api: 65,884 global grid cells with PostGIS geometry
 * - rectangles_unified: Combines both ICES and 0.25° grid (66,168 rows)
 * - grid_conditions_latest: Environmental data (1,082 rows, growing)
 *
 * US Waters Coverage:
 * - Atlantic: 24°N-48°N, 80°W-60°W
 * - Pacific: 24°N-60°N, 155°W-115°W
 * - Gulf of Mexico: 18°N-31°N, 98°W-80°W
 *
 * Future Enhancement:
 * Full NOAA Statistical Areas implementation with polygon geometries
 * (See: ftp://ftp.nefsc.noaa.gov/pub/gis/Statistical_Areas_2010.shp)
 */

/**
 * Generate grid cell ID from coordinates in database-compatible format.
 * Format: "G025_N4375W00700" (Grid 0.25deg, lat_max×100, |lon_max|×100)
 *
 * The ID encodes the cell's upper-right boundary (lat_max, lon_max) × 100,
 * matching the convention in the grid_025deg database table.
 *
 * For a coordinate (lat, lon), the containing cell is:
 *   lat_min = floor(lat/0.25)*0.25,  lat_max = lat_min + 0.25
 *   lon_min = floor(lon/0.25)*0.25,  lon_max = lon_min + 0.25
 *
 * Examples:
 * - Bay of Biscay (43.6, -7.1) → G025_N4375W00700 (cell [43.50,43.75]×[-7.25,-7.00])
 */
function generateGridCellId(lat: number, lon: number): string {
  const latMax = Math.floor(lat / 0.25) * 0.25 + 0.25;
  const lonMax = Math.floor(lon / 0.25) * 0.25 + 0.25;

  const latHemisphere = latMax >= 0 ? 'N' : 'S';
  const lonHemisphere = lonMax >= 0 ? 'E' : 'W';

  const latHundredths = Math.round(Math.abs(latMax) * 100);
  const lonHundredths = Math.round(Math.abs(lonMax) * 100);

  return `G025_${latHemisphere}${String(latHundredths).padStart(4, '0')}${lonHemisphere}${String(lonHundredths).padStart(5, '0')}`;
}

/**
 * Determine region for a given coordinate
 * Order matters: check specific regions before broader ones
 */
export function getWaterRegion(lat: number, lon: number): string {
  // Gulf of Mexico (check first - more specific)
  if (lat >= 18 && lat <= 31 && lon >= -98 && lon <= -80) {
    return 'Gulf_of_Mexico';
  }

  // US Atlantic Coast (excluding Gulf)
  if (lat >= 24 && lat <= 48 && lon >= -80 && lon <= -60) {
    return 'US_Atlantic';
  }

  // US Pacific Coast
  if (lat >= 24 && lat <= 60 && lon >= -155 && lon <= -115) {
    return 'US_Pacific';
  }

  // European Waters (ICES zone)
  if (lat >= 36 && lat <= 72 && lon >= -44 && lon <= 68) {
    return 'European_Waters';
  }

  // Caribbean
  if (lat >= 10 && lat <= 28 && lon >= -90 && lon <= -60) {
    return 'Caribbean';
  }

  // Mediterranean
  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) {
    return 'Mediterranean';
  }

  // Global fallback
  return 'Global';
}

/**
 * Find nearest grid cell ID for a given latitude and longitude
 *
 * Returns a grid cell ID compatible with the database infrastructure
 * (rectangles_025deg, rectangles_unified, grid_conditions_latest tables).
 *
 * @param lat Latitude (-90 to 90)
 * @param lon Longitude (-180 to 180)
 * @returns Grid cell ID in format "G025_N4075W07400" (database-compatible)
 *
 * @example
 * findNearestGridCellId(40.7128, -74.0060) // Returns "G025_N4075W07400" (New York)
 * findNearestGridCellId(25.7617, -80.1918) // Returns "G025_N2575W08025" (Miami)
 */
/**
 * Parse a G025_ grid cell ID back to its center coordinates.
 * Inverse of generateGridCellId.
 *
 * Supports both new format (4+5 digits) and legacy format (2+3 digits).
 *
 * @param cellId Grid cell ID e.g. "G025_N4375W00750" or legacy "G025_N44W007"
 * @returns Center coordinates or null if the ID doesn't match
 *
 * @example
 * parseGridCellCenter('G025_N4375W00750') // Returns { lat: 43.75, lon: -7.50 }
 * parseGridCellCenter('G025_N4075W07400') // Returns { lat: 40.75, lon: -74.00 }
 */
export function parseGridCellCenter(cellId: string): { lat: number; lon: number } | null {
  // New format: 4-digit lat, 5-digit lon (center × 100)
  const newMatch = cellId.match(/^G025_([NS])(\d{4})([EW])(\d{5})$/i);
  if (newMatch) {
    const [, latH, latStr, lonH, lonStr] = newMatch;
    return {
      lat: (latH.toUpperCase() === 'N' ? 1 : -1) * (parseInt(latStr, 10) / 100),
      lon: (lonH.toUpperCase() === 'E' ? 1 : -1) * (parseInt(lonStr, 10) / 100),
    };
  }

  // Legacy format: 2-digit lat, 3-digit lon (integer degrees only)
  const oldMatch = cellId.match(/^G025_([NS])(\d{2})([EW])(\d{3})$/i);
  if (oldMatch) {
    const [, latH, latD, lonH, lonD] = oldMatch;
    return {
      lat: (latH.toUpperCase() === 'N' ? 1 : -1) * (parseInt(latD, 10) + 0.125),
      lon: (lonH.toUpperCase() === 'E' ? 1 : -1) * (parseInt(lonD, 10) + 0.125),
    };
  }

  return null;
}

export function findNearestGridCellId(lat: number, lon: number): string {
  // Validate coordinates
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
  }

  return generateGridCellId(lat, lon);
}
