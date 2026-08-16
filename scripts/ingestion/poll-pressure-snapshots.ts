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
  // No limit, and an explicit order. The previous `.limit(150)` had no ORDER BY,
  // so it took an arbitrary 150 of the 299 rows in ices_rectangles -- 129 after
  // dedup, leaving 170 rectangles with no pressure data at all, and free to
  // return a DIFFERENT 150 after any update or vacuum. Coverage was neither
  // complete nor stable, and nothing reported it.
  const { data: rectangles, error } = await supabase
    .from('ices_rectangles')
    .select('rectangle_code, center_lat, center_lon')
    .order('rectangle_code');

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

  // `.select()` matters: ON CONFLICT DO NOTHING ... RETURNING yields only the
  // rows actually inserted, so this returns rows WRITTEN rather than rows
  // SUBMITTED. Returning snapshots.length instead would report 3,096 on a run
  // that stored nothing because every row was a duplicate.
  const { data, error } = await supabase
    .from('pressure_snapshots')
    .upsert(
      snapshots,
      {
        onConflict: 'lat_rounded,lon_rounded,captured_at',
        ignoreDuplicates: true,
      }
    )
    .select('id');

  // Throw rather than return 0. Swallowing this is how the missing
  // pressure_snapshots table went unnoticed for ~3.5 months: every rectangle
  // logged "Inserted 0 snapshots" next to a tick and the job exited 0.
  if (error) {
    throw new Error(`upsert into pressure_snapshots failed: ${error.message}`);
  }

  return data?.length ?? 0;
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

  // Unreachable in practice -- getActiveRectangles throws on both the error and
  // empty-result paths, and the dedup loop always emits at least one entry for a
  // non-empty input. Kept as a throw rather than a `return`, so that if a future
  // change reinstates a soft empty return upstream it fails loudly instead of
  // silently resurrecting the exit-0-on-total-failure bug this file already had.
  if (rectangles.length === 0) {
    throw new Error('no rectangles to poll after deduplication');
  }

  let submittedCount = 0;   // rows sent to the upsert
  let writtenCount = 0;     // rows the upsert actually inserted
  let successCount = 0;
  let failCount = 0;
  // Furthest-ahead forecast time seen from MET across all rectangles. Used to
  // detect a frozen upstream: see the horizon check after the loop.
  let maxHorizon: number | null = null;

  // Process each rectangle with rate limiting (MET Norway recommends 20 req/sec max)
  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i];
    console.log(`[${i + 1}/${rectangles.length}] Processing ${rect.code} (${rect.lat}, ${rect.lon})`);

    try {
      // Fetch pressure data
      const snapshots = await fetchPressureData(rect.lat, rect.lon, rect.code);

      if (snapshots.length > 0) {
        // Track how far ahead MET's forecast reaches, before storing.
        for (const s of snapshots) {
          const t = Date.parse(s.captured_at);
          if (!Number.isNaN(t) && (maxHorizon === null || t > maxHorizon)) maxHorizon = t;
        }

        // Insert into database
        const inserted = await insertPressureSnapshots(snapshots);
        submittedCount += snapshots.length;
        writtenCount += inserted;
        successCount++;
        console.log(`   ✅ Stored ${inserted} new of ${snapshots.length} submitted`);
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

  const horizonHours = maxHorizon === null
    ? 0
    : (maxHorizon - Date.now()) / 3_600_000;

  console.log('\n=====================================');
  console.log(`   Rectangles processed: ${rectangles.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Snapshots submitted: ${submittedCount}`);
  console.log(`   Snapshots newly stored: ${writtenCount}`);
  console.log(`   Forecast horizon: ${horizonHours.toFixed(1)}h ahead`);

  // Nothing fetched at all. Exiting 0 here is what hid a missing table for
  // ~3.5 months.
  if (submittedCount === 0) {
    console.error('💥 Fetched 0 snapshots across all rectangles — treating as failure.');
    process.exitCode = 1;
    return;
  }

  // Isolated failures are tolerated -- MET Norway drops a point occasionally --
  // but the measured baseline is 0 failures in 129, twice consecutively, so a
  // rate this high is an outage rather than flakiness. Previously this was
  // `> length / 2`, which let exactly half the feed go dark and still exit 0.
  const failRate = failCount / rectangles.length;
  if (failRate > 0.1) {
    console.error(`💥 ${failCount} of ${rectangles.length} rectangles failed (${(failRate * 100).toFixed(0)}%) — treating as failure.`);
    process.exitCode = 1;
    return;
  }

  // A frozen upstream is invisible to the counts above: if MET serves an
  // unchanged window forever, every row is a duplicate, writtenCount is 0 and
  // submittedCount is healthy. Asserting on the forecast horizon catches it at
  // source. `writtenCount === 0` is NOT itself an error -- a re-run inside the
  // same hour legitimately stores nothing -- so the horizon is the real signal.
  const MIN_HORIZON_HOURS = 12;
  if (horizonHours < MIN_HORIZON_HOURS) {
    console.error(`💥 MET forecast reaches only ${horizonHours.toFixed(1)}h ahead (expected >= ${MIN_HORIZON_HOURS}h) — upstream looks frozen or stale.`);
    process.exitCode = 1;
    return;
  }

  if (writtenCount === 0) {
    console.warn('⚠️  No new rows stored — every snapshot was already present. Expected only for a re-run inside the same hour.');
  }

  await pruneOldSnapshots();

  console.log('✅ Pressure Polling Complete!');
}

/**
 * Drop snapshots older than the retention window.
 *
 * Trends need at most a 6h lookback; 7 days is generous margin. Without this the
 * table grows without bound -- roughly 129 points x 3 genuinely-new hours x 8
 * runs/day, on the order of 10^6 rows/year, none of it read after 6 hours.
 * Uses pressure_snapshots_captured_at_idx.
 *
 * A prune failure must not fail the run: the data is already stored and correct,
 * and a green feed matters more than a tidy one.
 */
async function pruneOldSnapshots(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from('pressure_snapshots')
    .delete()
    .lt('captured_at', cutoff)
    .select('id');

  if (error) {
    console.warn(`⚠️  Retention prune failed (non-fatal): ${error.message}`);
    return;
  }

  console.log(`   Pruned ${data?.length ?? 0} snapshots older than ${cutoff}`);
}

// Run the polling script
pollPressureSnapshots().catch(error => {
  console.error('💥 Pressure polling failed:', error);
  process.exit(1);
});
