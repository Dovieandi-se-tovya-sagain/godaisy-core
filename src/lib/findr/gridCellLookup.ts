// lib/findr/gridCellLookup.ts

/**
 * Grid Cell Lookup for US Waters and Global Coverage
 *
 * Approach: Uses 0.25-degree grid system compatible with database infrastructure
 *
 * Grid System:
 * - 0.25° resolution (~ 27.8 km at equator, ~19.7 km at 45°N)
 * - Cell IDs: "G025_N41W074" format (Grid 0.25deg, North 41, West 074)
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
 * Snap coordinate to nearest 0.25-degree grid cell
 */
function snapToGrid(value: number, resolution: number = 0.25): number {
  return Math.round(value / resolution) * resolution;
}

/**
 * Generate grid cell ID from coordinates in database-compatible format
 * Format: "G025_N41W074" (Grid 0.25deg, North 41, West 074)
 *
 * Grid cell boundaries are aligned at 0.25° intervals.
 * The ID components represent:
 * - Latitude: ceil(lat_south) - the integer degree of the cell's southern edge
 * - Longitude: ceil(abs(lon_west)) - the integer degree of the cell's western edge
 *
 * Examples:
 * - New York (40.7128, -74.0060) → G025_N41W074 (cell bounds: [40.5-40.75, -74.25--74.0])
 * - Miami (25.7617, -80.1918) → G025_N26W081 (cell bounds: [25.5-25.75, -80.25--80.0])
 */
function generateGridCellId(lat: number, lon: number): string {
  // Snap to 0.25° grid to get cell center
  const gridLat = snapToGrid(lat, 0.25);
  const gridLon = snapToGrid(lon, 0.25);

  // Calculate cell bounds (each cell is 0.25° x 0.25°)
  const latSouth = gridLat - 0.125;
  const _latNorth = gridLat + 0.125;
  const lonWest = gridLon - 0.125;
  const _lonEast = gridLon + 0.125;

  // Determine hemisphere and integer degree
  // Latitude: Use ceil(lat_south) for the ID component
  const latHemisphere = gridLat >= 0 ? 'N' : 'S';
  const latDegree = Math.abs(Math.ceil(latSouth));

  // Longitude: Use ceil(abs(lon_west)) for the ID component
  const lonHemisphere = gridLon >= 0 ? 'E' : 'W';
  const lonDegree = Math.abs(Math.ceil(lonWest));

  // Format: G025_[N/S][LAT][E/W][LON]
  // Latitude is 2 digits, longitude is 3 digits with zero-padding
  return `G025_${latHemisphere}${String(latDegree).padStart(2, '0')}${lonHemisphere}${String(lonDegree).padStart(3, '0')}`;
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
 * @returns Grid cell ID in format "G025_N41W074" (database-compatible)
 *
 * @example
 * findNearestGridCellId(40.7128, -74.0060) // Returns "G025_N41W074" (New York)
 * findNearestGridCellId(25.7617, -80.1918) // Returns "G025_N26W081" (Miami)
 */
export function findNearestGridCellId(lat: number, lon: number): string {
  // Validate coordinates
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
  }

  // Generate grid cell ID using 0.25-degree resolution
  // Format: G025_N41W074 (compatible with database tables)
  return generateGridCellId(lat, lon);
}
