/**
 * Ocean Current Analysis for Fishing Predictions
 * 
 * Calculates current speed/direction and their impact on fishing success.
 * Ocean currents are CRITICAL for:
 * - Scent trails (sharks, rays, bass)
 * - Drift fishing accuracy
 * - Fish positioning (face into current)
 * - Baitfish movement
 * - Food concentration zones
 */

export interface OceanCurrent {
  /** Eastward velocity component (m/s). Positive = eastward flow */
  eastward_ms: number;
  /** Northward velocity component (m/s). Positive = northward flow */
  northward_ms: number;
  /** Total current speed (m/s). Calculated: sqrt(u² + v²) */
  speed_ms: number;
  /** Current direction (degrees, 0-360). 0° = East, 90° = North */
  direction_deg: number;
}

export interface CurrentAnalysis {
  current: OceanCurrent;
  /** 0-1 score for current suitability. 1.0 = ideal feeding conditions */
  feeding_score: number;
  /** Human-readable current interpretation */
  interpretation: string;
  /** Fishing recommendations based on current */
  recommendations: string[];
}

/**
 * Calculate current speed and direction from u/v components
 * 
 * @param uo - Eastward velocity (m/s) from Copernicus
 * @param vo - Northward velocity (m/s) from Copernicus
 * @returns Ocean current with speed and direction
 */
export function calculateCurrent(uo: number, vo: number): OceanCurrent {
  const speed_ms = Math.sqrt(uo * uo + vo * vo);
  
  // Convert from radians to degrees
  // atan2(vo, uo) gives angle from east (0°) counterclockwise
  const direction_deg = (Math.atan2(vo, uo) * 180 / Math.PI + 360) % 360;
  
  return {
    eastward_ms: uo,
    northward_ms: vo,
    speed_ms,
    direction_deg,
  };
}

/**
 * Score current speed for fishing suitability
 * 
 * Optimal current speeds for feeding:
 * - < 0.1 m/s: Too still, fish not actively hunting
 * - 0.2-0.5 m/s: IDEAL - food moving, fish can hold position
 * - 0.5-1.0 m/s: Strong - active feeding but harder to fish
 * - > 1.0 m/s: Too fast - fish struggle to hold position
 * 
 * @param currentSpeed - Current speed in m/s
 * @returns Score from 0-1 (1.0 = perfect)
 */
export function currentFeedingScore(currentSpeed: number): number {
  if (currentSpeed < 0.1) {
    return 0.5; // Too still - reduced feeding activity
  }
  
  if (currentSpeed >= 0.1 && currentSpeed <= 0.5) {
    // IDEAL ZONE - food moving, scent trails active
    // Linear increase from 0.1 to 0.3 (perfect), then slight decrease to 0.5
    if (currentSpeed <= 0.3) {
      return 0.7 + (currentSpeed - 0.1) * 1.5; // 0.7 to 1.0
    }
    return 1.0 - (currentSpeed - 0.3) * 0.5; // 1.0 to 0.9
  }
  
  if (currentSpeed > 0.5 && currentSpeed <= 1.0) {
    // Strong current - still good but harder to fish
    return 0.7 - (currentSpeed - 0.5) * 0.6; // 0.7 to 0.4
  }
  
  // Very strong current - fish can't hold position well
  return Math.max(0.2, 0.4 - (currentSpeed - 1.0) * 0.2);
}

/**
 * Interpret current speed for anglers
 */
export function interpretCurrentSpeed(speed_ms: number): string {
  if (speed_ms < 0.1) return 'Very slow current';
  if (speed_ms < 0.2) return 'Slow current';
  if (speed_ms < 0.5) return 'Moderate current (ideal)';
  if (speed_ms < 1.0) return 'Strong current';
  if (speed_ms < 1.5) return 'Very strong current';
  return 'Extreme current';
}

/**
 * Get fishing recommendations based on current
 */
export function getCurrentRecommendations(current: OceanCurrent): string[] {
  const recommendations: string[] = [];
  const speed = current.speed_ms;
  
  if (speed < 0.1) {
    recommendations.push('Slack water - try static baits or slow retrieves');
    recommendations.push('Fish may be less active - target structure');
  } else if (speed >= 0.1 && speed <= 0.5) {
    recommendations.push('Perfect current for active feeding!');
    recommendations.push('Drift fishing highly effective');
    recommendations.push('Fish will be facing into current');
    if (speed >= 0.2 && speed <= 0.3) {
      recommendations.push('⭐ OPTIMAL CONDITIONS - scent trails active');
    }
  } else if (speed > 0.5 && speed <= 1.0) {
    recommendations.push('Strong current - use heavier weights');
    recommendations.push('Fish current breaks and eddies');
    recommendations.push('Predators hunting in flow');
  } else {
    recommendations.push('Very strong current - challenging conditions');
    recommendations.push('Focus on slack water zones');
    recommendations.push('Wait for current to ease');
  }
  
  // Add directional advice
  const compassDirection = getCompassDirection(current.direction_deg);
  recommendations.push(`Current flowing ${compassDirection} (${Math.round(current.direction_deg)}°)`);
  
  return recommendations;
}

/**
 * Convert degrees to compass direction
 */
export function getCompassDirection(degrees: number): string {
  const directions = ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'];
  const index = Math.round(((degrees % 360) / 360) * 16) % 16;
  return directions[index];
}

/**
 * Complete current analysis for fishing
 * 
 * @param uo - Eastward velocity (m/s)
 * @param vo - Northward velocity (m/s)
 * @returns Full current analysis with recommendations
 */
export function analyzeCurrent(uo: number, vo: number): CurrentAnalysis {
  const current = calculateCurrent(uo, vo);
  const feeding_score = currentFeedingScore(current.speed_ms);
  const interpretation = interpretCurrentSpeed(current.speed_ms);
  const recommendations = getCurrentRecommendations(current);
  
  return {
    current,
    feeding_score,
    interpretation,
    recommendations,
  };
}

/**
 * Calculate drift distance for given current and time
 * Useful for drift fishing planning
 * 
 * @param currentSpeed - Current speed (m/s)
 * @param timeMinutes - Time in minutes
 * @returns Drift distance in meters
 */
export function calculateDriftDistance(currentSpeed: number, timeMinutes: number): number {
  return currentSpeed * timeMinutes * 60; // m/s * minutes * 60s/min
}

/**
 * Estimate scent trail reach
 * Stronger currents = longer scent trails = predators detect from farther away
 * 
 * @param currentSpeed - Current speed (m/s)
 * @returns Estimated scent trail reach in meters
 */
export function estimateScentTrailReach(currentSpeed: number): number {
  // Rough estimate: scent travels 10-50m in ideal currents
  if (currentSpeed < 0.1) return 10; // Minimal scent dispersal
  if (currentSpeed < 0.3) return 30; // Good scent trail
  if (currentSpeed < 0.5) return 50; // Excellent scent trail
  if (currentSpeed < 1.0) return 40; // Strong but turbulent
  return 20; // Too turbulent, scent dissipates quickly
}

/**
 * Check if current is favorable for specific hunting strategy
 */
export function isFavorableForStrategy(
  current: OceanCurrent,
  strategy: 'scent_hunter' | 'ambush_predator' | 'active_chaser' | 'bottom_feeder'
): boolean {
  const speed = current.speed_ms;
  
  switch (strategy) {
    case 'scent_hunter': // Sharks, rays, tope
      return speed >= 0.15 && speed <= 0.8; // Need current for scent trails
      
    case 'ambush_predator': // Bass, pike, groupers
      return speed >= 0.1 && speed <= 0.6; // Can hold position near current breaks
      
    case 'active_chaser': // Mackerel, tuna, bonito
      return speed >= 0.2 && speed <= 1.0; // Hunt in moving water
      
    case 'bottom_feeder': // Flatfish, rays (feeding mode)
      return speed <= 0.5; // Prefer calmer conditions on bottom
      
    default:
      return false;
  }
}

// Example usage and test data
export const EXAMPLE_CURRENTS = {
  slack: { uo: 0.05, vo: 0.03, description: 'Slack water - minimal current' },
  ideal: { uo: 0.15, vo: 0.25, description: 'Ideal current - perfect feeding' },
  strong: { uo: 0.45, vo: 0.60, description: 'Strong current - active hunting' },
  extreme: { uo: 0.80, vo: 1.20, description: 'Extreme current - challenging' },
};
