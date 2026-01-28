/**
 * Helper functions for approach scoring conditions
 *
 * Provides tide stage detection and time of day calculation
 * for use in scoreSpeciesApproach and related scoring functions.
 */

/**
 * Tide extreme data point from API
 */
export interface TideExtreme {
  time: string;      // ISO 8601 timestamp
  type: 'high' | 'low';
  height: number;    // meters
}

/**
 * Calculate tide stage from tide extreme data
 *
 * Returns one of:
 * - 'flooding': Rising tide (between low and high)
 * - 'ebbing': Falling tide (between high and low)
 * - 'high_slack': Near high tide (±30 minutes)
 * - 'low_slack': Near low tide (±30 minutes)
 *
 * @param extremes - Array of tide extremes from API
 * @param currentTime - Optional current time (defaults to now)
 * @returns Tide stage string
 *
 * @example
 * const tideData = [
 *   { time: '2025-11-20T10:30:00Z', type: 'high', height: 4.2 },
 *   { time: '2025-11-20T16:45:00Z', type: 'low', height: 0.8 }
 * ];
 * const stage = getTideStage(tideData);
 * // Returns: 'flooding' | 'ebbing' | 'high_slack' | 'low_slack'
 */
export function getTideStage(
  extremes: TideExtreme[] | null | undefined,
  currentTime?: Date
): 'flooding' | 'ebbing' | 'high_slack' | 'low_slack' | null {
  if (!extremes || extremes.length === 0) {
    return null;
  }

  const now = currentTime || new Date();

  // Find the previous and next tide extremes
  const sortedExtremes = [...extremes].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  let previousTide: TideExtreme | null = null;
  let nextTide: TideExtreme | null = null;

  for (let i = 0; i < sortedExtremes.length; i++) {
    const tide = sortedExtremes[i];
    const tideTime = new Date(tide.time);

    if (tideTime <= now) {
      previousTide = tide;
    } else if (tideTime > now && !nextTide) {
      nextTide = tide;
      break;
    }
  }

  // If no next tide, use the last available
  if (!nextTide && sortedExtremes.length > 0) {
    nextTide = sortedExtremes[sortedExtremes.length - 1];
  }

  // If no previous tide, use the first available
  if (!previousTide && sortedExtremes.length > 0) {
    previousTide = sortedExtremes[0];
  }

  if (!nextTide) {
    return null;
  }

  const timeToNextMs = new Date(nextTide.time).getTime() - now.getTime();
  const timeToNextMinutes = timeToNextMs / (1000 * 60);

  // Within 30 minutes of the next tide = slack water
  if (timeToNextMinutes <= 30 && timeToNextMinutes >= 0) {
    return nextTide.type === 'high' ? 'high_slack' : 'low_slack';
  }

  // If we have a previous tide, check if we just passed it (within 30 minutes)
  if (previousTide) {
    const timeSincePreviousMs = now.getTime() - new Date(previousTide.time).getTime();
    const timeSincePreviousMinutes = timeSincePreviousMs / (1000 * 60);

    if (timeSincePreviousMinutes <= 30 && timeSincePreviousMinutes >= 0) {
      return previousTide.type === 'high' ? 'high_slack' : 'low_slack';
    }
  }

  // Active tide flow
  // If next tide is high, we're flooding (rising)
  // If next tide is low, we're ebbing (falling)
  return nextTide.type === 'high' ? 'flooding' : 'ebbing';
}

/**
 * Calculate time of day from timezone and current time
 *
 * Returns one of:
 * - 'dawn': Sunrise period (5:00-7:00)
 * - 'day': Daytime (7:00-18:00)
 * - 'dusk': Sunset period (18:00-20:00)
 * - 'night': Nighttime (20:00-5:00)
 *
 * Note: Uses simple hour ranges. For precise sunrise/sunset times,
 * would need to integrate with a sun position library.
 *
 * @param timezone - IANA timezone string (e.g., 'Europe/London', 'America/New_York')
 * @param currentTime - Optional current time (defaults to now)
 * @returns Time of day string
 *
 * @example
 * const timeOfDay = getTimeOfDay('Europe/London');
 * // Returns: 'dawn' | 'day' | 'dusk' | 'night'
 */
export function getTimeOfDay(
  timezone?: string | null,
  currentTime?: Date
): 'dawn' | 'day' | 'dusk' | 'night' {
  const now = currentTime || new Date();

  // Get hour in specified timezone (or UTC if not provided)
  let hour: number;
  if (timezone) {
    try {
      const timeString = now.toLocaleString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: 'numeric',
      });
      hour = parseInt(timeString, 10);
    } catch (_error) {
      // Invalid timezone, fall back to UTC
      console.warn(`Invalid timezone: ${timezone}, falling back to UTC`);
      hour = now.getUTCHours();
    }
  } else {
    hour = now.getUTCHours();
  }

  // Simple hour-based classification
  // Dawn: 5am-7am
  // Day: 7am-6pm
  // Dusk: 6pm-8pm
  // Night: 8pm-5am
  if (hour >= 5 && hour < 7) {
    return 'dawn';
  } else if (hour >= 7 && hour < 18) {
    return 'day';
  } else if (hour >= 18 && hour < 20) {
    return 'dusk';
  } else {
    return 'night';
  }
}

/**
 * Get timezone from coordinates using heuristic rules
 *
 * This is a simple approximation. For production use, consider
 * integrating a timezone lookup library like 'geo-tz' or calling
 * a timezone API service.
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Approximate IANA timezone string
 *
 * @example
 * const tz = getTimezoneFromCoordinates(51.5, -0.1);
 * // Returns: 'Europe/London'
 */
export function getTimezoneFromCoordinates(lat: number, lon: number): string {
  // Simple heuristic based on longitude (very approximate!)
  // For production, use a proper timezone lookup library

  // Europe
  if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 40) {
    if (lon >= -10 && lon < 5) return 'Europe/London';
    if (lon >= 5 && lon < 15) return 'Europe/Paris';
    if (lon >= 15 && lon < 25) return 'Europe/Berlin';
    if (lon >= 25 && lon < 40) return 'Europe/Athens';
  }

  // US East Coast
  if (lat >= 25 && lat <= 48 && lon >= -85 && lon <= -65) {
    return 'America/New_York';
  }

  // US West Coast
  if (lat >= 32 && lat <= 49 && lon >= -125 && lon <= -115) {
    return 'America/Los_Angeles';
  }

  // Asia - Japan/Korea
  if (lat >= 30 && lat <= 45 && lon >= 125 && lon <= 145) {
    return 'Asia/Tokyo';
  }

  // Australia East Coast
  if (lat >= -38 && lat <= -10 && lon >= 145 && lon <= 155) {
    return 'Australia/Sydney';
  }

  // Atlantic (Iceland, Azores)
  if (lat >= 35 && lat <= 65 && lon >= -30 && lon <= -10) {
    return 'Atlantic/Azores';
  }

  // Default to UTC
  return 'UTC';
}

/**
 * Enhanced time of day calculation using coordinates
 *
 * Attempts to infer timezone from coordinates, then calculates time of day.
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @param currentTime - Optional current time (defaults to now)
 * @returns Time of day string
 *
 * @example
 * const timeOfDay = getTimeOfDayFromCoordinates(51.5, -0.1);
 * // Returns: 'dawn' | 'day' | 'dusk' | 'night' (based on London time)
 */
export function getTimeOfDayFromCoordinates(
  lat: number,
  lon: number,
  currentTime?: Date
): 'dawn' | 'day' | 'dusk' | 'night' {
  const timezone = getTimezoneFromCoordinates(lat, lon);
  return getTimeOfDay(timezone, currentTime);
}

/**
 * Convert old tide phase format to new format
 *
 * Maps the format used by useTideData hook to approach scoring format:
 * - 'rising' → 'flooding'
 * - 'falling' → 'ebbing'
 * - 'high_slack' → 'high_slack'
 * - 'low_slack' → 'low_slack'
 *
 * @param phase - Old format tide phase
 * @returns New format tide phase
 */
export function convertTidePhase(
  phase: 'rising' | 'falling' | 'high_slack' | 'low_slack' | null | undefined
): 'flooding' | 'ebbing' | 'high_slack' | 'low_slack' | null {
  if (!phase) return null;

  const mapping: Record<string, 'flooding' | 'ebbing' | 'high_slack' | 'low_slack'> = {
    'rising': 'flooding',
    'falling': 'ebbing',
    'high_slack': 'high_slack',
    'low_slack': 'low_slack',
  };

  return mapping[phase] || null;
}

// ============================================================================
// Email-related condition helpers (for daily digest and weekly forecast)
// ============================================================================

import type { NearbyTackleShop } from './emailTemplates';

/** Type for environmental conditions from database */
export interface EnvironmentalConditions {
  sea_temp_c: number | null;
  salinity_psu: number | null;
  air_pressure_hpa: number | null;
  wave_height_m: number | null;
  kd490: number | null;
  cloud_cover_pct: number | null;
  chlorophyll_mg_m3: number | null;
  current_speed_ms: number | null;
  wind_speed_kts?: number | null;
  next_high_tide_iso?: string | null;
  next_low_tide_iso?: string | null;
  pressure_trend_category?: string | null;
  captured_at: string | null;
}

/** Type for moon data from database */
export interface MoonData {
  moon_phase_name: string | null;
  moon_illumination_pct: number | null;
  sunrise_iso?: string | null;
  sunset_iso?: string | null;
  moonrise_iso?: string | null;
  moonset_iso?: string | null;
  moon_transit_iso?: string | null;
}

/** Overall fishing conditions rating */
export type OverallRating = 'exceptional' | 'good' | 'fair' | 'challenging';

/** Water clarity rating */
export type WaterClarity = 'excellent' | 'good' | 'moderate' | 'poor';

/** Pressure trend */
export type PressureTrend = 'rising' | 'falling' | 'stable';

/** Tide pattern based on moon phase */
export type TidePattern = 'spring' | 'neap';

/** Daily verdict type */
export type DailyVerdict = 'go' | 'good' | 'skip';

/**
 * Calculate water clarity from kd490 (light attenuation coefficient)
 */
export function calculateWaterClarity(kd490: number | null): WaterClarity {
  if (kd490 === null) return 'moderate';
  if (kd490 < 0.1) return 'excellent';
  if (kd490 < 0.2) return 'good';
  if (kd490 < 0.5) return 'moderate';
  return 'poor';
}

/**
 * Calculate pressure trend from category
 */
export function calculatePressureTrend(
  pressureTrendCategory?: string | null
): PressureTrend {
  if (pressureTrendCategory) {
    if (pressureTrendCategory.includes('rising')) return 'rising';
    if (pressureTrendCategory.includes('falling')) return 'falling';
  }
  return 'stable';
}

/**
 * Determine tide pattern from moon phase (spring tides around new/full moon)
 */
export function getTidePatternFromMoon(moonPhase: string | null): TidePattern {
  if (!moonPhase) return 'neap';
  const lower = moonPhase.toLowerCase();
  if (lower.includes('new') || lower.includes('full')) return 'spring';
  return 'neap';
}

/**
 * Calculate overall fishing conditions rating
 */
export function calculateOverallRating(
  env: EnvironmentalConditions | null,
  moon: MoonData | null
): OverallRating {
  if (!env) return 'fair';

  let score = 50;

  if (env.wave_height_m !== null) {
    if (env.wave_height_m < 1) score += 10;
    else if (env.wave_height_m < 2) score += 5;
    else if (env.wave_height_m > 3) score -= 15;
  }

  if (env.air_pressure_hpa !== null) {
    if (env.air_pressure_hpa >= 1010 && env.air_pressure_hpa <= 1020) score += 10;
    else if (env.air_pressure_hpa < 1000 || env.air_pressure_hpa > 1030) score -= 10;
  }

  const clarity = calculateWaterClarity(env.kd490);
  if (clarity === 'excellent' || clarity === 'good') score += 10;
  else if (clarity === 'poor') score -= 10;

  if (moon?.moon_phase_name) {
    const pattern = getTidePatternFromMoon(moon.moon_phase_name);
    if (pattern === 'spring') score += 5;
  }

  if (score >= 70) return 'exceptional';
  if (score >= 55) return 'good';
  if (score >= 40) return 'fair';
  return 'challenging';
}

/**
 * Convert overall rating to numeric score
 */
export function ratingToScore(rating: OverallRating): number {
  switch (rating) {
    case 'exceptional': return 90;
    case 'good': return 75;
    case 'fair': return 55;
    case 'challenging': return 30;
  }
}

/**
 * Calculate verdict score (0-100) combining species confidence and environmental rating
 */
export function calculateVerdictScore(
  bestConfidence: number,
  environmentalRating: OverallRating
): number {
  const envScore = ratingToScore(environmentalRating);
  return Math.round((bestConfidence * 0.5) + (envScore * 0.5));
}

/**
 * Determine verdict based on score
 */
export function getVerdict(score: number): DailyVerdict {
  if (score >= 80) return 'go';
  if (score >= 60) return 'good';
  return 'skip';
}

/**
 * Generate a one-line verdict reason
 */
export function generateVerdictReason(
  topSpeciesName: string,
  topConfidence: number,
  pressureTrend: PressureTrend,
  environmentalRating: OverallRating
): string {
  const confidenceStr = `${Math.round(topConfidence)}% ${topSpeciesName}`;

  if (environmentalRating === 'exceptional') {
    if (pressureTrend === 'rising') {
      return `${confidenceStr} + rising pressure = perfect conditions`;
    }
    return `${confidenceStr} in exceptional conditions`;
  }

  if (environmentalRating === 'good') {
    if (pressureTrend === 'rising') {
      return `${confidenceStr} with rising pressure`;
    }
    return `${confidenceStr} in good conditions`;
  }

  if (environmentalRating === 'fair') {
    return `${confidenceStr} - conditions are reasonable`;
  }

  return `${confidenceStr} - conditions are challenging`;
}

/**
 * Generate conditions summary text
 */
export function generateEmailConditionsSummary(
  env: EnvironmentalConditions | null,
  moon: MoonData | null,
  rating: OverallRating
): string {
  const parts: string[] = [];

  if (rating === 'exceptional') {
    parts.push('Outstanding conditions for fishing today!');
  } else if (rating === 'good') {
    parts.push('Good conditions expected today.');
  } else if (rating === 'fair') {
    parts.push('Reasonable conditions with some limitations.');
  } else {
    parts.push('Challenging conditions - pick your moments carefully.');
  }

  if (env?.wave_height_m != null && env.wave_height_m < 1.5) {
    parts.push('Calm seas expected.');
  } else if (env?.wave_height_m != null && env.wave_height_m > 2.5) {
    parts.push('Rough seas - shore fishing may be affected.');
  }

  if (moon?.moon_phase_name) {
    const pattern = getTidePatternFromMoon(moon.moon_phase_name);
    if (pattern === 'spring') {
      parts.push('Spring tides bring stronger water movement.');
    }
  }

  return parts.join(' ');
}

/** Google Places API response types */
interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
}

interface GooglePlacesResponse {
  results: GooglePlaceResult[];
  status: string;
}

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format distance for display
 */
export function formatDistanceDisplay(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

/**
 * Fetch nearby tackle shops using Google Places API
 */
export async function fetchNearbyTackleShops(
  lat: number,
  lon: number,
  limit: number = 3
): Promise<NearbyTackleShop[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[ConditionHelpers] Google Maps API key not configured');
    return [];
  }

  try {
    const allResults: NearbyTackleShop[] = [];
    const seenPlaceIds = new Set<string>();
    const searchQueries = ['tackle shop', 'fishing bait'];

    for (const query of searchQueries) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.set('location', `${lat},${lon}`);
      url.searchParams.set('radius', '25000');
      url.searchParams.set('keyword', query);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) continue;

      const data: GooglePlacesResponse = await response.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') continue;

      for (const place of (data.results || [])) {
        if (seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);

        const distance = calculateDistanceKm(lat, lon, place.geometry.location.lat, place.geometry.location.lng);

        allResults.push({
          name: place.name,
          address: place.vicinity || place.formatted_address || '',
          distance: formatDistanceDisplay(distance),
          rating: place.rating,
          totalRatings: place.user_ratings_total,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`,
        });
      }
    }

    allResults.sort((a, b) => {
      const distA = parseFloat(a.distance.replace(/[^\d.]/g, '') || '999');
      const distB = parseFloat(b.distance.replace(/[^\d.]/g, '') || '999');
      return distA - distB;
    });

    return allResults.slice(0, limit);
  } catch (error) {
    console.error('[ConditionHelpers] Error fetching tackle shops:', error);
    return [];
  }
}

/**
 * Parse ISO time string to display format (e.g., "7:15 AM")
 */
export function formatTimeDisplay(isoTime: string | null | undefined): string | null {
  if (!isoTime) return null;
  try {
    const date = new Date(isoTime);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return null;
  }
}

/**
 * Get hour from ISO time string (0-23)
 */
export function getHourFromIso(isoTime: string | null | undefined): number | null {
  if (!isoTime) return null;
  try {
    const date = new Date(isoTime);
    if (isNaN(date.getTime())) return null;
    return date.getHours();
  } catch {
    return null;
  }
}

/**
 * Check if a given hour is within a time window
 */
export function isWithinTimeWindow(hour: number, targetHour: number | null, windowHours: number = 1): boolean {
  if (targetHour === null) return false;
  const diff = Math.abs(hour - targetHour);
  return diff <= windowHours || diff >= (24 - windowHours);
}

// ============================================================================
// Optimal Fishing Window Calculation
// ============================================================================

import type { OptimalWindow } from './emailTemplates';

interface OptimalWindowInput {
  sunriseIso?: string | null;
  sunsetIso?: string | null;
  highTideIso?: string | null;
  lowTideIso?: string | null;
  moonTransitIso?: string | null;
  moonIllumination?: number | null;
  speciesTidePreference?: 'flood' | 'ebb' | 'slack' | null;
  speciesTimePreference?: 'dawn' | 'dusk' | 'day' | 'night' | null;
}

interface HourScore {
  hour: number;
  score: number;
  reasons: string[];
}

/**
 * Score each hour of the day based on fishing conditions
 * Returns array of hour scores from 5 AM to 10 PM
 */
function scoreHoursOfDay(input: OptimalWindowInput): HourScore[] {
  const sunriseHour = getHourFromIso(input.sunriseIso);
  const sunsetHour = getHourFromIso(input.sunsetIso);
  const highTideHour = getHourFromIso(input.highTideIso);
  const lowTideHour = getHourFromIso(input.lowTideIso);
  const moonTransitHour = getHourFromIso(input.moonTransitIso);
  const moonIllumination = input.moonIllumination ?? 50;

  const scores: HourScore[] = [];

  // Score hours from 5 AM to 10 PM (hours 5-22)
  for (let hour = 5; hour <= 22; hour++) {
    let score = 0;
    const reasons: string[] = [];

    // Dawn bonus (±1 hour of sunrise)
    if (sunriseHour !== null && isWithinTimeWindow(hour, sunriseHour, 1)) {
      score += 25;
      reasons.push('dawn');
    }

    // Dusk bonus (±1 hour of sunset)
    if (sunsetHour !== null && isWithinTimeWindow(hour, sunsetHour, 1)) {
      score += 20;
      reasons.push('dusk');
    }

    // Solunar major period (±1 hour of moon transit)
    if (moonTransitHour !== null && isWithinTimeWindow(hour, moonTransitHour, 1)) {
      score += 30;
      reasons.push('solunar major');
      // Moon illumination amplifier
      if (moonIllumination > 80) score += 5;
      else if (moonIllumination > 50) score += 3;
    }

    // Tide stage alignment
    if (highTideHour !== null && lowTideHour !== null) {
      // Determine if this hour is flooding, ebbing, or slack
      const isNearHighTide = Math.abs(hour - highTideHour) <= 0.5;
      const isNearLowTide = Math.abs(hour - lowTideHour) <= 0.5;

      if (isNearHighTide || isNearLowTide) {
        // Slack water
        if (input.speciesTidePreference === 'slack') {
          score += 15;
          reasons.push('slack tide');
        }
      } else {
        // Determine flooding vs ebbing
        let isFlooding = false;
        if (highTideHour > lowTideHour) {
          isFlooding = hour >= lowTideHour && hour < highTideHour;
        } else {
          isFlooding = hour < highTideHour || hour >= lowTideHour;
        }

        if (isFlooding && input.speciesTidePreference === 'flood') {
          score += 20;
          reasons.push('flood tide');
        } else if (!isFlooding && input.speciesTidePreference === 'ebb') {
          score += 20;
          reasons.push('ebb tide');
        } else if (isFlooding) {
          score += 10; // General bonus for moving water
          reasons.push('rising tide');
        }
      }
    }

    // Species time preference bonus
    if (input.speciesTimePreference === 'dawn' && sunriseHour !== null) {
      if (isWithinTimeWindow(hour, sunriseHour, 2)) {
        score += 10;
      }
    } else if (input.speciesTimePreference === 'dusk' && sunsetHour !== null) {
      if (isWithinTimeWindow(hour, sunsetHour, 2)) {
        score += 10;
      }
    } else if (input.speciesTimePreference === 'night') {
      if (hour >= 20 || hour < 6) {
        score += 10;
      }
    }

    scores.push({ hour, score, reasons });
  }

  return scores;
}

/**
 * Find the best 3-hour contiguous window
 */
function findBestWindow(scores: HourScore[]): { startHour: number; endHour: number; totalScore: number; peakReasons: string[] } {
  let bestStart = 5;
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (let i = 0; i <= scores.length - 3; i++) {
    const windowScore = scores[i].score + scores[i + 1].score + scores[i + 2].score;
    if (windowScore > bestScore) {
      bestScore = windowScore;
      bestStart = scores[i].hour;
      // Collect unique reasons from the window
      const allReasons = [...scores[i].reasons, ...scores[i + 1].reasons, ...scores[i + 2].reasons];
      bestReasons = [...new Set(allReasons)];
    }
  }

  return {
    startHour: bestStart,
    endHour: bestStart + 3,
    totalScore: bestScore,
    peakReasons: bestReasons,
  };
}

/**
 * Format hour to display string (e.g., "6:30 AM")
 */
function formatHourDisplay(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
}

/**
 * Generate human-readable reason string
 */
function generateWindowReason(reasons: string[]): string {
  if (reasons.length === 0) return 'Best available window';

  const priorityOrder = ['dawn', 'dusk', 'solunar major', 'flood tide', 'ebb tide', 'slack tide', 'rising tide'];
  const sortedReasons = reasons.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  if (sortedReasons.length === 1) {
    return capitalizeFirst(sortedReasons[0]) + ' window';
  }

  if (sortedReasons.includes('dawn') && sortedReasons.some(r => r.includes('tide'))) {
    return 'Dawn + tide alignment';
  }

  if (sortedReasons.includes('dusk') && sortedReasons.some(r => r.includes('tide'))) {
    return 'Dusk + tide alignment';
  }

  if (sortedReasons.includes('solunar major')) {
    return 'Peak solunar activity';
  }

  return sortedReasons.slice(0, 2).map(capitalizeFirst).join(' + ');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Calculate optimal fishing window for the day
 * Uses solunar theory, tide times, and sunrise/sunset
 */
export function calculateOptimalWindow(input: OptimalWindowInput): OptimalWindow {
  const scores = scoreHoursOfDay(input);
  const best = findBestWindow(scores);

  return {
    start: formatHourDisplay(best.startHour),
    end: formatHourDisplay(best.endHour),
    duration: '3 hours',
    reason: generateWindowReason(best.peakReasons),
    highTide: formatTimeDisplay(input.highTideIso) ?? undefined,
    lowTide: formatTimeDisplay(input.lowTideIso) ?? undefined,
    sunrise: formatTimeDisplay(input.sunriseIso) ?? undefined,
    sunset: formatTimeDisplay(input.sunsetIso) ?? undefined,
  };
}
