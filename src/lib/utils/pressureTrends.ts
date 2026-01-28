/**
 * Pressure Trend Calculation Utilities
 *
 * Used by polling scripts to calculate barometric pressure trends from MET Norway timeseries data.
 * Per MET Norway's recommendation, we cache pressure data at rounded coordinates (0 decimal places).
 *
 * Related: docs/PRESSURE_TREND_DATA_STRATEGY.md
 */

export interface PressureTrend {
  category: 'rising' | 'steady' | 'falling' | 'rapid_falling' | 'unknown';
  pressureNow: number | null;
  pressure3hAgo: number | null;
  pressure6hAgo: number | null;
  delta3h: number | null;
  delta6h: number | null;
  explanation: string;
}

export interface MetNoTimeseriesEntry {
  time: string;
  data: {
    instant: {
      details: {
        air_pressure_at_sea_level?: number;
      };
    };
  };
}

/**
 * Calculate pressure trend from MET Norway timeseries data
 *
 * @param timeseries - Array of MET Norway timeseries entries
 * @param targetTime - The time to calculate trend for (default: now)
 * @returns PressureTrend object with category, deltas, and explanation
 *
 * Trend Classification (per user specification):
 * - ≤ -5.0 hPa/3h: rapid_falling (severe drop, bite may stall)
 * - ≤ -2.0 hPa/3h: falling (reduced fish activity)
 * - ≥ +2.0 hPa/3h: rising (fish active)
 * - -2.0 to +2.0: steady (stable conditions)
 */
export function calculatePressureTrend(
  timeseries: MetNoTimeseriesEntry[],
  targetTime: Date = new Date()
): PressureTrend {
  if (!timeseries || timeseries.length === 0) {
    return {
      category: 'unknown',
      pressureNow: null,
      pressure3hAgo: null,
      pressure6hAgo: null,
      delta3h: null,
      delta6h: null,
      explanation: 'No timeseries data available'
    };
  }

  // Find closest entry to target time
  const now = timeseries.reduce((closest, entry) => {
    const entryTime = new Date(entry.time);
    const closestTime = new Date(closest.time);
    return Math.abs(entryTime.getTime() - targetTime.getTime()) <
           Math.abs(closestTime.getTime() - targetTime.getTime())
      ? entry
      : closest;
  });

  // Find entry closest to 3 hours ago
  const target3hAgo = new Date(targetTime.getTime() - 3 * 60 * 60 * 1000);
  const threeHoursAgo = timeseries.reduce((closest, entry) => {
    const entryTime = new Date(entry.time);
    const closestTime = new Date(closest.time);
    return Math.abs(entryTime.getTime() - target3hAgo.getTime()) <
           Math.abs(closestTime.getTime() - target3hAgo.getTime())
      ? entry
      : closest;
  });

  // Find entry closest to 6 hours ago
  const target6hAgo = new Date(targetTime.getTime() - 6 * 60 * 60 * 1000);
  const sixHoursAgo = timeseries.reduce((closest, entry) => {
    const entryTime = new Date(entry.time);
    const closestTime = new Date(closest.time);
    return Math.abs(entryTime.getTime() - target6hAgo.getTime()) <
           Math.abs(closestTime.getTime() - target6hAgo.getTime())
      ? entry
      : closest;
  });

  const pressureNow = now.data.instant.details.air_pressure_at_sea_level;
  const pressure3hAgo = threeHoursAgo.data.instant.details.air_pressure_at_sea_level;
  const pressure6hAgo = sixHoursAgo.data.instant.details.air_pressure_at_sea_level;

  if (pressureNow === undefined || pressure3hAgo === undefined) {
    return {
      category: 'unknown',
      pressureNow: pressureNow ?? null,
      pressure3hAgo: pressure3hAgo ?? null,
      pressure6hAgo: pressure6hAgo ?? null,
      delta3h: null,
      delta6h: null,
      explanation: 'Insufficient pressure data (missing current or 3h ago)'
    };
  }

  const delta3h = pressureNow - pressure3hAgo;
  const delta6h = pressure6hAgo !== undefined ? pressureNow - pressure6hAgo : null;

  // Categorize per user specification
  let category: PressureTrend['category'];
  let explanation: string;

  if (delta3h <= -5.0) {
    category = 'rapid_falling';
    explanation = `Pressure falling rapidly (${delta3h.toFixed(1)} hPa/3h) - bite may stall`;
  } else if (delta3h <= -2.0) {
    category = 'falling';
    explanation = `Pressure falling (${delta3h.toFixed(1)} hPa/3h) - reduced fish activity`;
  } else if (delta3h >= 2.0) {
    category = 'rising';
    explanation = `Pressure rising (+${delta3h.toFixed(1)} hPa/3h) - fish active`;
  } else {
    category = 'steady';
    explanation = `Pressure stable (${delta3h > 0 ? '+' : ''}${delta3h.toFixed(1)} hPa/3h)`;
  }

  return {
    category,
    pressureNow,
    pressure3hAgo,
    pressure6hAgo: pressure6hAgo ?? null,
    delta3h,
    delta6h,
    explanation
  };
}

/**
 * Round coordinates to match MET Norway's caching recommendation
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Rounded coordinates (0 decimal places)
 *
 * Examples:
 * - (51.234, -0.127) → (51, 0)
 * - (56.789, -4.567) → (57, -5)
 */
export function roundCoordinates(lat: number, lon: number): { lat: number; lon: number } {
  return {
    lat: Math.round(lat),
    lon: Math.round(lon)
  };
}

/**
 * Get unique rounded coordinates from a list of coordinates
 *
 * @param coordinates - Array of {lat, lon} objects
 * @returns Array of unique rounded coordinates
 */
export function getUniqueRoundedCoordinates(
  coordinates: Array<{ lat: number; lon: number }>
): Array<{ lat: number; lon: number }> {
  const uniqueSet = new Set<string>();
  const result: Array<{ lat: number; lon: number }> = [];

  for (const coord of coordinates) {
    const rounded = roundCoordinates(coord.lat, coord.lon);
    const key = `${rounded.lat},${rounded.lon}`;

    if (!uniqueSet.has(key)) {
      uniqueSet.add(key);
      result.push(rounded);
    }
  }

  return result;
}
