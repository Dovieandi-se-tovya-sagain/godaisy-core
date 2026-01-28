/**
 * Unit conversion utilities for weather data
 * Ensures consistent conversions across all API integrations
 */

// ============================================================================
// TEMPERATURE CONVERSIONS
// ============================================================================

/**
 * Convert Fahrenheit to Celsius
 * @param f Temperature in Fahrenheit
 * @returns Temperature in Celsius, or undefined if input is undefined
 * @example fahrenheitToCelsius(32) // 0
 * @example fahrenheitToCelsius(212) // 100
 */
export const fahrenheitToCelsius = (f: number | undefined): number | undefined => {
  return typeof f === 'number' ? (f - 32) * (5 / 9) : undefined;
};

/**
 * Convert Celsius to Fahrenheit
 * @param c Temperature in Celsius
 * @returns Temperature in Fahrenheit, or undefined if input is undefined
 * @example celsiusToFahrenheit(0) // 32
 * @example celsiusToFahrenheit(100) // 212
 */
export const celsiusToFahrenheit = (c: number | undefined): number | undefined => {
  return typeof c === 'number' ? (c * 9 / 5) + 32 : undefined;
};

// ============================================================================
// WIND SPEED CONVERSIONS
// ============================================================================

/**
 * Convert miles per hour to meters per second
 * Handles both numeric and string inputs (e.g., "10 to 15 mph")
 * @param mph Wind speed in mph (number or string)
 * @returns Wind speed in m/s, or undefined if invalid
 * @example mphToMs(10) // 4.4704
 * @example mphToMs("10 to 15 mph") // 4.4704 (uses first number)
 */
export const mphToMs = (mph: number | string | undefined): number | undefined => {
  if (typeof mph === 'string') {
    const match = mph.match(/([\d.]+)/);
    return match ? Number(match[1]) * CONVERSIONS.MPH_TO_MS : undefined;
  }
  if (typeof mph === 'number') return mph * CONVERSIONS.MPH_TO_MS;
  return undefined;
};

/**
 * Convert meters per second to knots
 * @param ms Wind speed in m/s
 * @returns Wind speed in knots (rounded to 1 decimal), or null if invalid
 * @example msToKnots(10) // 19.4
 */
export const msToKnots = (ms: number | undefined | null): number | null => {
  if (ms == null || !Number.isFinite(ms)) return null;
  const converted = ms * CONVERSIONS.MS_TO_KTS;
  return Number.isFinite(converted) ? Number(converted.toFixed(1)) : null;
};

/**
 * Convert knots to meters per second
 * @param knots Wind speed in knots
 * @returns Wind speed in m/s, or undefined if invalid
 * @example knotsToMs(10) // 5.144
 */
export const knotsToMs = (knots: number | undefined): number | undefined => {
  return typeof knots === 'number' ? knots / CONVERSIONS.MS_TO_KTS : undefined;
};

// ============================================================================
// WIND DIRECTION CONVERSIONS
// ============================================================================

/**
 * Convert compass direction to degrees
 * @param direction Compass direction (N, NE, E, SE, S, SW, W, NW, etc.)
 * @returns Degrees (0-359, 0=North), or undefined if invalid
 * @example compassToDegrees('N') // 0
 * @example compassToDegrees('E') // 90
 * @example compassToDegrees('SW') // 225
 */
export const compassToDegrees = (direction: string | undefined): number | undefined => {
  if (!direction) return undefined;
  const directions: Record<string, number> = {
    'N': 0,
    'NNE': 22.5,
    'NE': 45,
    'ENE': 67.5,
    'E': 90,
    'ESE': 112.5,
    'SE': 135,
    'SSE': 157.5,
    'S': 180,
    'SSW': 202.5,
    'SW': 225,
    'WSW': 247.5,
    'W': 270,
    'WNW': 292.5,
    'NW': 315,
    'NNW': 337.5,
  };
  return directions[direction.toUpperCase()];
};

/**
 * Convert degrees to nearest compass direction
 * @param degrees Direction in degrees (0-359, 0=North)
 * @returns Compass direction (N, NE, E, etc.), or undefined if invalid
 * @example degreesToCompass(0) // 'N'
 * @example degreesToCompass(90) // 'E'
 * @example degreesToCompass(225) // 'SW'
 */
export const degreesToCompass = (degrees: number | undefined): string | undefined => {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return undefined;
  
  // Normalize to 0-360 range
  const normalized = ((degrees % 360) + 360) % 360;
  
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
};

// ============================================================================
// DISTANCE/LENGTH CONVERSIONS
// ============================================================================

/**
 * Convert meters to kilometers
 * @param meters Distance in meters
 * @returns Distance in kilometers, or undefined if invalid
 * @example metersToKm(1000) // 1
 */
export const metersToKm = (meters: number | undefined): number | undefined => {
  return typeof meters === 'number' ? meters / 1000 : undefined;
};

/**
 * Convert kilometers to meters
 * @param km Distance in kilometers
 * @returns Distance in meters, or undefined if invalid
 * @example kmToMeters(1) // 1000
 */
export const kmToMeters = (km: number | undefined): number | undefined => {
  return typeof km === 'number' ? km * 1000 : undefined;
};

/**
 * Convert miles to kilometers
 * @param miles Distance in miles
 * @returns Distance in kilometers, or undefined if invalid
 * @example milesToKm(1) // 1.60934
 */
export const milesToKm = (miles: number | undefined): number | undefined => {
  return typeof miles === 'number' ? miles * 1.60934 : undefined;
};

/**
 * Convert kilometers to miles
 * @param km Distance in kilometers
 * @returns Distance in miles, or undefined if invalid
 * @example kmToMiles(1.60934) // 1
 */
export const kmToMiles = (km: number | undefined): number | undefined => {
  return typeof km === 'number' ? km / 1.60934 : undefined;
};

// ============================================================================
// PRESSURE CONVERSIONS
// ============================================================================

/**
 * Convert inches of mercury to hectopascals (millibars)
 * @param inHg Pressure in inHg
 * @returns Pressure in hPa, or undefined if invalid
 * @example inHgToHPa(30) // 1015.9
 */
export const inHgToHPa = (inHg: number | undefined): number | undefined => {
  return typeof inHg === 'number' ? inHg * 33.8639 : undefined;
};

/**
 * Convert hectopascals (millibars) to inches of mercury
 * @param hPa Pressure in hPa/mb
 * @returns Pressure in inHg, or undefined if invalid
 * @example hPaToInHg(1013.25) // 29.92
 */
export const hPaToInHg = (hPa: number | undefined): number | undefined => {
  return typeof hPa === 'number' ? hPa / 33.8639 : undefined;
};

// ============================================================================
// PRECIPITATION CONVERSIONS
// ============================================================================

/**
 * Convert inches to millimeters
 * @param inches Precipitation in inches
 * @returns Precipitation in mm, or undefined if invalid
 * @example inchesToMm(1) // 25.4
 */
export const inchesToMm = (inches: number | undefined): number | undefined => {
  return typeof inches === 'number' ? inches * 25.4 : undefined;
};

/**
 * Convert millimeters to inches
 * @param mm Precipitation in millimeters
 * @returns Precipitation in inches, or undefined if invalid
 * @example mmToInches(25.4) // 1
 */
export const mmToInches = (mm: number | undefined): number | undefined => {
  return typeof mm === 'number' ? mm / 25.4 : undefined;
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Conversion constants used throughout the weather application
 */
export const CONVERSIONS = {
  /** Miles per hour to meters per second */
  MPH_TO_MS: 0.44704,
  /** Meters per second to knots */
  MS_TO_KTS: 1.94384,
  /** Fahrenheit to Celsius multiplier */
  F_TO_C_MULTIPLIER: 5 / 9,
  /** Fahrenheit to Celsius offset */
  F_TO_C_OFFSET: 32,
  /** Inches of mercury to hectopascals */
  INHG_TO_HPA: 33.8639,
  /** Inches to millimeters */
  INCHES_TO_MM: 25.4,
  /** Miles to kilometers */
  MILES_TO_KM: 1.60934,
} as const;

// ============================================================================
// STANDARD UNITS DOCUMENTATION
// ============================================================================

/**
 * STANDARD UNITS USED THROUGHOUT THE APPLICATION
 * 
 * All weather data should be normalized to these units:
 * 
 * - Temperature: °C (Celsius)
 * - Wind Speed: m/s (meters per second)
 * - Wind Direction: degrees (0-359, 0=North)
 * - Pressure: hPa (hectopascals / millibars)
 * - Precipitation: mm (millimeters)
 * - Distance/Visibility: km (kilometers)
 * - Wave Height: m (meters)
 * - Current Speed: m/s (with optional conversion to knots for display)
 * - Coordinates: decimal degrees
 * 
 * CONVERSION GUIDE:
 * 
 * Temperature:
 *   - Use fahrenheitToCelsius() for US NWS/NOAA data
 *   - Met.no, Open-Meteo already in Celsius
 *   - OpenWeather: request units=metric
 * 
 * Wind Speed:
 *   - Use mphToMs() for US NWS/NOAA data
 *   - Met.no, Open-Meteo already in m/s
 *   - OpenWeather: request units=metric
 *   - Optional: Use msToKnots() for marine display
 * 
 * Wind Direction:
 *   - Use compassToDegrees() for US NWS/NOAA compass directions
 *   - Most APIs already provide degrees
 *   - Optional: Use degreesToCompass() for user-friendly display
 * 
 * Pressure:
 *   - Use inHgToHPa() if source provides inHg
 *   - Most APIs already provide hPa/mb
 * 
 * Precipitation:
 *   - Use inchesToMm() if source provides inches
 *   - Most APIs already provide mm
 * 
 * Distance:
 *   - Use milesToKm() for US visibility data
 *   - Most APIs already provide km or m
 */
