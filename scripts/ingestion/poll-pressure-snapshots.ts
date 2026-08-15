#!/usr/bin/env tsx
/**
 * Pressure Snapshot Polling Script for Phase 2
 *
 * Purpose: Populate pressure_snapshots table with time-series pressure data
 *          to enable pressure trend calculations for bite score predictions.
 *
 * How It Works:
 * 1. Queries ICES rectangles that have recent predictions or user activity
 * 2. For each active rectangle, rounds coordinates to reduce API calls (0 decimals)
 * 3. Fetches MET Norway Locationforecast API for current + 3h + 6h ago pressure
 * 4. Inserts snapshots into pressure_snapshots table with proper timestamps
 *
 * Data Collection:
 * - API: MET Norway Locationforecast 2.0 (free, no auth required)
 * - Fields: air_pressure_at_sea_level (hPa)
 * - Resolution: Rounded coordinates (lat=40, lon=-9 instead of 39.5, -9.0)
 * - Retention: Data needed for 6h lookback period
 *
 * Usage:
 *   tsx scripts/poll-pressure-snapshots.ts
 *
 * Environment Variables Required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * GitHub Action Schedule:
 *   Run every 3 hours (8x daily) to maintain 6h trend coverage
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// MET Norway API configuration
const MET_API_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const USER_AGENT = 'Findr/1.0 (fishing predictions app)'; // MET Norway requires identifying your app

interface PressureSnapshot {
  lat_rounded: number;
  lon_rounded: number;
  captured_at: string;
  pressure_hpa: number;
}

/**
 * Round coordinates to reduce API calls and match pressure_snapshots schema
 */
function roundCoordinates(lat: number, lon: number): { lat: number; lon: number } {
  return {
    lat: Math.round(lat),
    lon: Math.round(lon),
  };
}

/**
 * Fetch pressure data from MET Norway Locationforecast API
 * Returns array of pressure snapshots at different times
 */
async function fetchPressureData(
  lat: number,
  lon: number,
  rectangleCode: string
): Promise<PressureSnapshot[]> {
  const rounded = roundCoordinates(lat, lon);
  const url = `${MET_API_BASE}?lat=${rounded.lat}&lon=${rounded.lon}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`MET API responded with ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const timeseries = data.properties?.timeseries || [];

    if (timeseries.length === 0) {
      console.warn(`⚠️  No timeseries data returned for ${rectangleCode} (${rounded.lat}, ${rounded.lon})`);
      return [];
    }

    // Extract pressure snapshots from timeseries
    const snapshots: PressureSnapshot[] = [];

    for (const entry of timeseries) {
      const timestamp = new Date(entry.time);
      const pressure = entry.data?.instant?.details?.air_pressure_at_sea_level;

      if (typeof pressure === 'number' && !isNaN(pressure)) {
        snapshots.push({
          lat_rounded: rounded.lat,
          lon_rounded: rounded.lon,
          captured_at: timestamp.toISOString(),
          pressure_hpa: pressure,
        });
      }
    }

    // Limit to first 24 hours of data (reasonable coverage)
    return snapshots.slice(0, 24);
  } catch (error) {
    console.error(`❌ Error fetching pressure for ${rectangleCode}:`, error);
    return [];
  }
}

/**
 * Get active ICES rectangles that need pressure data
 * Strategy: Use rectangles with recent grid_conditions data (indicates active areas)
 */
async function getActiveRectangles(): Promise<Array<{ code: string; lat: number; lon: number }>> {
  // Simple approach: Get all ICES rectangles and poll them
  // Since we're rounding coordinates, we'll deduplicate by rounded coords
  const { data: rectangles, error } = await supabase
    .from('ices_rectangles')
    .select('rectangle_code, center_lat, center_lon')
    .limit(150); // Limit to top 150 rectangles

  // Same reasoning as insertPressureSnapshots: an empty return here is
  // indistinguishable from "nothing to do", and main() treats that as success.
  if (error) {
    throw new Error(`could not read ices_rectangles: ${error.message}`);
  }

  if (!rectangles || rectangles.length === 0) {
    throw new Error('ices_rectangles returned no rows — cannot poll anything');
  }

  // Deduplicate by rounded coordinates (since MET API calls will be rounded anyway)
  const seen = new Set<string>();
  const uniqueRectangles: Array<{ code: string; lat: number; lon: number }> = [];

  for (const rect of rectangles) {
    const rounded = roundCoordinates(rect.center_lat, rect.center_lon);
    const key = `${rounded.lat},${rounded.lon}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueRectangles.push({
        code: rect.rectangle_code,
        lat: rect.center_lat,
        lon: rect.center_lon,
      });
    }
  }

  return uniqueRectangles;
}

/**
 * Insert pressure snapshots into database
 */
async function insertPressureSnapshots(snapshots: PressureSnapshot[]): Promise<number> {
  if (snapshots.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from('pressure_snapshots')
    .upsert(
      snapshots,
      {
        onConflict: 'lat_rounded,lon_rounded,captured_at',
        ignoreDuplicates: true,
      }
    );

  // Throw rather than return 0. Swallowing this is how the missing
  // pressure_snapshots table went unnoticed for ~3.5 months: every rectangle
  // logged "Inserted 0 snapshots" next to a tick and the job exited 0.
  if (error) {
    throw new Error(`upsert into pressure_snapshots failed: ${error.message}`);
  }

  return snapshots.length;
}

/**
 * Main polling function
 */
async function pollPressureSnapshots() {
  console.log('🌡️  Pressure Snapshot Polling Started');
  console.log('=====================================\n');

  // Get active rectangles
  console.log('📍 Fetching active ICES rectangles...');
  const rectangles = await getActiveRectangles();
  console.log(`   Found ${rectangles.length} active rectangles\n`);

  if (rectangles.length === 0) {
    console.log('ℹ️  No active rectangles found. Exiting.');
    return;
  }

  let totalSnapshots = 0;
  let successCount = 0;
  let failCount = 0;

  // Process each rectangle with rate limiting (MET Norway recommends 20 req/sec max)
  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i];
    console.log(`[${i + 1}/${rectangles.length}] Processing ${rect.code} (${rect.lat}, ${rect.lon})`);

    try {
      // Fetch pressure data
      const snapshots = await fetchPressureData(rect.lat, rect.lon, rect.code);

      if (snapshots.length > 0) {
        // Insert into database
        const inserted = await insertPressureSnapshots(snapshots);
        totalSnapshots += inserted;
        successCount++;
        console.log(`   ✅ Inserted ${inserted} snapshots`);
      } else {
        failCount++;
        console.log(`   ⚠️  No pressure data available`);
      }

      // Rate limiting: 50ms delay between requests (20 req/sec)
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      failCount++;
      console.error(`   ❌ Error processing ${rect.code}:`, error);
    }
  }

  console.log('\n=====================================');
  console.log(`   Rectangles processed: ${rectangles.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total snapshots inserted: ${totalSnapshots}`);

  // A run that stored nothing is a failed run, however cleanly each rectangle
  // reported. Exiting 0 here is what hid a missing table for ~3.5 months.
  // Isolated rectangle failures are tolerated -- MET Norway drops a point
  // occasionally -- but a majority failing means the feed is down, not flaky.
  if (totalSnapshots === 0) {
    console.error('💥 Stored 0 snapshots across all rectangles — treating as failure.');
    process.exitCode = 1;
    return;
  }

  if (failCount > rectangles.length / 2) {
    console.error(`💥 ${failCount} of ${rectangles.length} rectangles failed — treating as failure.`);
    process.exitCode = 1;
    return;
  }

  console.log('✅ Pressure Polling Complete!');
}

// Run the polling script
pollPressureSnapshots().catch(error => {
  console.error('💥 Pressure polling failed:', error);
  process.exit(1);
});
