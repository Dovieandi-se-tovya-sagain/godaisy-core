/**
 * Calculate water clarity index from Copernicus CMEMS data
 * 
 * Water clarity directly impacts sight-feeding fish success rates.
 * Plaice, Mackerel, Pollack, Wrasse, and other visual hunters benefit from clear water.
 * 
 * Primary metric: kd490 (diffuse attenuation coefficient at 490nm)
 * Fallback: Chlorophyll-a (proxy for turbidity from plankton blooms)
 */

export interface WaterClarityData {
  clarity_index: number;      // 0-1 scale (0=turbid, 1=clear)
  kd490?: number;              // Primary metric (1/m)
  chlorophyll_mg_m3?: number;  // Fallback/secondary (mg/m³)
  method: 'kd490' | 'chlorophyll' | 'combined' | 'unavailable';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate clarity index from kd490 (PRIMARY METHOD)
 * 
 * kd490 measures how quickly light attenuates through water:
 * - < 0.1 = very clear (offshore, deep water)
 * - 0.1-0.2 = clear
 * - 0.2-0.4 = moderate clarity
 * - > 0.4 = turbid/murky (coastal, estuaries, algae blooms)
 * 
 * @param kd490 - Diffuse attenuation coefficient at 490nm (1/m)
 * @returns Clarity index 0-1
 */
export function clarityFromKd490(kd490: number): number {
  // Linear scale: 0 kd490 = 1.0 clarity, 0.4 kd490 = 0.0 clarity
  return Math.max(0, Math.min(1, 1 - kd490 / 0.4));
}

/**
 * Calculate clarity from chlorophyll-a (FALLBACK METHOD)
 * 
 * High chlorophyll = plankton bloom = reduced clarity
 * - < 0.5 mg/m³ = oligotrophic (very clear, blue water)
 * - 0.5-1.5 = mesotrophic (moderate clarity)
 * - 1.5-3.0 = eutrophic (reduced clarity, green water)
 * - > 3.0 = bloom conditions (murky)
 * 
 * @param chl - Chlorophyll-a concentration (mg/m³)
 * @returns Clarity index 0-1
 */
export function clarityFromChlorophyll(chl: number): number {
  // Linear scale: 0 chl = 1.0 clarity, 3.0 chl = 0.0 clarity
  return Math.max(0, Math.min(1, 1 - chl / 3.0));
}

/**
 * Combined clarity calculation (BEST ACCURACY)
 * 
 * Uses both kd490 and chlorophyll when available.
 * Weighted 70% kd490 (direct measure) + 30% chlorophyll (bloom indicator)
 * 
 * @param kd490 - Diffuse attenuation coefficient (1/m)
 * @param chl - Chlorophyll-a concentration (mg/m³)
 * @returns Clarity index 0-1
 */
export function combinedClarity(kd490: number, chl: number): number {
  const kd_clarity = clarityFromKd490(kd490);
  const chl_clarity = clarityFromChlorophyll(chl);
  
  // Weight kd490 more heavily (direct optical measurement)
  return 0.7 * kd_clarity + 0.3 * chl_clarity;
}

/**
 * Main clarity calculation with automatic method selection
 * 
 * Priority:
 * 1. Both kd490 + chlorophyll → combined method (best)
 * 2. Only kd490 → direct method (good)
 * 3. Only chlorophyll → proxy method (acceptable)
 * 4. Neither → return null
 * 
 * @param kd490 - Optional kd490 value (1/m)
 * @param chlorophyll - Optional chlorophyll-a value (mg/m³)
 * @returns Water clarity data object
 */
export function calculateWaterClarity(
  kd490?: number | null,
  chlorophyll?: number | null
): WaterClarityData | null {
  // Case 1: Both available (BEST)
  if (kd490 != null && chlorophyll != null) {
    return {
      clarity_index: combinedClarity(kd490, chlorophyll),
      kd490,
      chlorophyll_mg_m3: chlorophyll,
      method: 'combined',
      confidence: 'high'
    };
  }
  
  // Case 2: Only kd490 (GOOD)
  if (kd490 != null) {
    return {
      clarity_index: clarityFromKd490(kd490),
      kd490,
      method: 'kd490',
      confidence: 'high'
    };
  }
  
  // Case 3: Only chlorophyll (ACCEPTABLE)
  if (chlorophyll != null) {
    return {
      clarity_index: clarityFromChlorophyll(chlorophyll),
      chlorophyll_mg_m3: chlorophyll,
      method: 'chlorophyll',
      confidence: 'medium'
    };
  }
  
  // Case 4: No data available
  return null;
}

/**
 * Interpret clarity index for user-facing display
 * 
 * @param clarity_index - Clarity value 0-1
 * @returns Human-readable description
 */
export function interpretClarity(clarity_index: number): {
  label: string;
  description: string;
  fishingImpact: string;
} {
  if (clarity_index >= 0.8) {
    return {
      label: 'Crystal Clear',
      description: 'Excellent visibility',
      fishingImpact: '+18% for sight feeders (Plaice, Mackerel, Bass)'
    };
  } else if (clarity_index >= 0.6) {
    return {
      label: 'Clear',
      description: 'Good visibility',
      fishingImpact: '+10% for sight feeders'
    };
  } else if (clarity_index >= 0.4) {
    return {
      label: 'Moderate',
      description: 'Fair visibility',
      fishingImpact: 'Neutral - normal conditions'
    };
  } else if (clarity_index >= 0.2) {
    return {
      label: 'Murky',
      description: 'Poor visibility',
      fishingImpact: '-10% for sight feeders, scent feeders unaffected'
    };
  } else {
    return {
      label: 'Very Murky',
      description: 'Very poor visibility',
      fishingImpact: '-18% for sight feeders, switch to Cod/Flounder'
    };
  }
}

/**
 * Convert chlorophyll to water clarity index for stealth calculation (0-100 scale)
 *
 * Used by the stealth indicator to adjust light penetration based on water turbidity.
 *
 * @param chlorophyll - Chlorophyll-a concentration (mg/m³)
 * @returns Water clarity index 0-100 (0 = very murky, 100 = crystal clear), or null if no data
 */
export function chlorophyllToWaterClarityIndex(chlorophyll?: number | null): number | null {
  if (typeof chlorophyll !== 'number' || !Number.isFinite(chlorophyll)) {
    return null;
  }

  // Convert 0-1 clarity index to 0-100 scale
  const clarityIndex01 = clarityFromChlorophyll(chlorophyll);
  return Math.round(clarityIndex01 * 100);
}

/**
 * Example usage:
 *
 * ```typescript
 * // From Copernicus data
 * const kd490 = 0.15;  // From biogeochemical dataset
 * const chlorophyll = 1.2;  // Already fetched
 *
 * const clarity = calculateWaterClarity(kd490, chlorophyll);
 * // Result: { clarity_index: 0.65, kd490: 0.15, chlorophyll_mg_m3: 1.2, method: 'combined', confidence: 'high' }
 *
 * const interpretation = interpretClarity(clarity.clarity_index);
 * // Result: { label: 'Clear', description: 'Good visibility', fishingImpact: '+10% for sight feeders' }
 *
 * // Use in bite score calculation
 * const conditions = {
 *   water_clarity_m: clarity.clarity_index,
 *   // ... other conditions
 * };
 *
 * // For stealth calculation
 * const waterClarityIndex = chlorophyllToWaterClarityIndex(chlorophyll);
 * // Result: 60 (on 0-100 scale for stealth)
 * ```
 */
