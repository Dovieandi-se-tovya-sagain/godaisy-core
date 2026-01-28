/**
 * Coordinate Rounding Utilities
 * 
 * Standardized coordinate precision for cache efficiency and cost optimization.
 * Different APIs and data types use different precision levels based on:
 * - Data resolution (how precise the underlying data is)
 * - Cache duration (longer cache = less precision needed)
 * - Cost considerations (paid APIs get less precision)
 */

/**
 * Precision levels for different use cases:
 * 
 * 0dp (1°):     ~111km - Moon/sun data (changes very slowly, 24h cache)
 * 1dp (0.1°):   ~11km  - Stormglass paid API (12h cache, minimize calls)
 * 2dp (0.01°):  ~1.1km - Environmental data (pollen, air quality)
 * 3dp (0.001°): ~110m  - Most weather/marine APIs (standard precision)
 * 4dp (0.0001°): ~11m  - MET Norway recommendation (high precision)
 */

export const COORDINATE_PRECISION = {
  /** 0 decimal places (~111km) - Astronomy data, 24h cache */
  ASTRONOMY: 0,
  
  /** 1 decimal place (~11km) - Stormglass paid API, 12h cache */
  STORMGLASS: 1,
  
  /** 2 decimal places (~1.1km) - Environmental/regional data */
  ENVIRONMENTAL: 2,
  
  /** 3 decimal places (~110m) - Standard for most free APIs */
  STANDARD: 3,
  
  /** 4 decimal places (~11m) - MET Norway high precision */
  HIGH_PRECISION: 4,
} as const;

/**
 * Round a number to N decimal places
 */
export function roundNdp(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Round to 0 decimal places (~111km precision)
 * Use for: Astronomy data (moon/sun) with 24h cache
 */
export function round0dp(num: number): number {
  return Math.round(num);
}

/**
 * Round to 1 decimal place (~11km precision)
 * Use for: Stormglass paid API with 12h cache
 */
export function round1dp(num: number): number {
  return Math.round(num * 10) / 10;
}

/**
 * Round to 2 decimal places (~1.1km precision)
 * Use for: Environmental data (pollen, air quality)
 */
export function round2dp(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Round to 3 decimal places (~110m precision)
 * Use for: Most weather/marine APIs (standard)
 */
export function round3dp(num: number): number {
  return Math.round(num * 1000) / 1000;
}

/**
 * Round to 4 decimal places (~11m precision)
 * Use for: MET Norway high-precision forecasts
 */
export function round4dp(num: number): number {
  return Math.round(num * 10000) / 10000;
}

/**
 * Round coordinates for a specific API/data type
 */
export function roundForApi(
  lat: number,
  lon: number,
  apiType: 'astronomy' | 'stormglass' | 'environmental' | 'standard' | 'high-precision'
): { lat: number; lon: number; precision: number } {
  let precision: number;
  
  switch (apiType) {
    case 'astronomy':
      precision = COORDINATE_PRECISION.ASTRONOMY;
      break;
    case 'stormglass':
      precision = COORDINATE_PRECISION.STORMGLASS;
      break;
    case 'environmental':
      precision = COORDINATE_PRECISION.ENVIRONMENTAL;
      break;
    case 'high-precision':
      precision = COORDINATE_PRECISION.HIGH_PRECISION;
      break;
    case 'standard':
    default:
      precision = COORDINATE_PRECISION.STANDARD;
  }
  
  return {
    lat: roundNdp(lat, precision),
    lon: roundNdp(lon, precision),
    precision,
  };
}

/**
 * Create a cache key from rounded coordinates
 */
export function createCacheKey(
  lat: number,
  lon: number,
  precision: number,
  prefix?: string
): string {
  const roundedLat = roundNdp(lat, precision);
  const roundedLon = roundNdp(lon, precision);
  const key = `${roundedLat.toFixed(precision)},${roundedLon.toFixed(precision)}`;
  return prefix ? `${prefix}:${key}` : key;
}

/**
 * Cache duration recommendations based on precision
 */
export const CACHE_DURATION_MS = {
  /** 24 hours - Astronomy data (0dp) */
  ASTRONOMY: 24 * 60 * 60 * 1000,
  
  /** 12 hours - Stormglass paid API (1dp) */
  STORMGLASS: 12 * 60 * 60 * 1000,
  
  /** 6 hours - Environmental data (2dp) */
  ENVIRONMENTAL: 6 * 60 * 60 * 1000,
  
  /** 3 hours - Standard weather (3dp) */
  STANDARD: 3 * 60 * 60 * 1000,
  
  /** 1 hour - High precision (4dp) */
  HIGH_PRECISION: 1 * 60 * 60 * 1000,
} as const;

/**
 * Get recommended cache duration for a precision level
 */
export function getCacheDuration(precision: number): number {
  switch (precision) {
    case 0: return CACHE_DURATION_MS.ASTRONOMY;
    case 1: return CACHE_DURATION_MS.STORMGLASS;
    case 2: return CACHE_DURATION_MS.ENVIRONMENTAL;
    case 3: return CACHE_DURATION_MS.STANDARD;
    case 4: return CACHE_DURATION_MS.HIGH_PRECISION;
    default: return CACHE_DURATION_MS.STANDARD;
  }
}
