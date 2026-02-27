#!/usr/bin/env tsx

/**
 * Copernicus Marine Data Ingestion Script
 *
 * Fetches comprehensive Copernicus marine data (CMEMS) for 0.25° coastal grid
 * cells and populates the findr_conditions_snapshots table.
 *
 * STRATEGY: Coastal 0.25° Grid Cells
 * - Uses rectangles_025deg_api table (global 0.25° grid, ~28 km cells)
 * - Filters to is_coastal = true (coastal cells only)
 * - Cell IDs use G025_ format (e.g. G025_N44W007)
 * - Expected success rate: 97-99%
 * - Covers all recreational fishing areas globally
 *
 * DATA COLLECTED:
 *
 * OCEAN DYNAMICS:
 * - current_speed_ms, current_direction_deg (ocean currents)
 * - current_east_ms, current_north_ms (velocity components)
 * - mixed_layer_depth_m (thermocline depth)
 * - sea_surface_height_m (upwelling indicator)
 *
 * WATER CLARITY:
 * - kd490 (light attenuation / water clarity)
 *
 * FOOD CHAIN:
 * - zooplankton_mmol_m3, phytoplankton_mmol_m3
 * - primary_production_mg_c_m3_day
 *
 * WAVES:
 * - wave_direction_deg, wave_period_s
 * - wind_sea_height_m, swell_height_m
 *
 * Usage:
 *   npx tsx scripts/ingestion/ingest-copernicus-data.ts
 *
 * Environment Variables:
 *   COPERNICUS_USERNAME - Copernicus Marine Service username (optional for now)
 *   COPERNICUS_PASSWORD - Copernicus Marine Service password (optional for now)
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   FINDR_CONDITIONS_LIMIT - Optional: limit number of grid cells to process
 *   FINDR_CONDITIONS_DELAY_MS - Optional: delay between grid cell requests (default 500ms)
 *   FINDR_CONDITIONS_FRESHNESS_HOURS - Optional: skip cells with data fresher than N hours (default 24)
 *   FINDR_CONDITIONS_BATCH_SIZE - Optional: process N grid cells in parallel (default 5)
 *   FINDR_CONDITIONS_FORCE_REFRESH - Optional: force refresh all cells, ignoring freshness (default false)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { MockCopernicusProvider } from '../../src/lib/copernicus/mockClient';
import { RealCopernicusProvider } from '../../src/lib/copernicus/realClient';
import { toCopernicusMarineData } from '../../src/lib/copernicus/transformers';
import type { CopernicusMarineSnapshot } from '../../src/lib/copernicus/types';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const LIMIT = process.env.FINDR_CONDITIONS_LIMIT ? parseInt(process.env.FINDR_CONDITIONS_LIMIT) : undefined;
const DELAY_MS = process.env.FINDR_CONDITIONS_DELAY_MS ? parseInt(process.env.FINDR_CONDITIONS_DELAY_MS) : 500;
const FRESHNESS_HOURS = process.env.FINDR_CONDITIONS_FRESHNESS_HOURS ? parseInt(process.env.FINDR_CONDITIONS_FRESHNESS_HOURS) : 24;
const BATCH_SIZE = process.env.FINDR_CONDITIONS_BATCH_SIZE ? parseInt(process.env.FINDR_CONDITIONS_BATCH_SIZE) : 5;
const FORCE_REFRESH = process.env.FINDR_CONDITIONS_FORCE_REFRESH === 'true';

// Validate credentials
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CMEMS Region Assignment ─────────────────────────────────────────────────
// Determines which regional Copernicus model to query for a given lat/lon.
// Regional models have higher resolution than GLOBAL; GLOBAL is the fallback.

function getCmemsRegion(region: string, lat: number, lon: number): string {
  const r = region.toLowerCase();

  // Baltic Sea
  if (
    r.includes('finnish') || r.includes('swedish baltic') ||
    r.includes('polish baltic') || r.includes('danish baltic') ||
    r.includes('baltic')
  ) return 'BAL';

  // Mediterranean Sea
  if (
    r.includes('mediterranean') || r.includes('adriatic') ||
    r.includes('italian') || r.includes('greek') ||
    r.includes('turkish mediterranean') || r.includes('croatian') ||
    r.includes('albanian') || r.includes('slovenian') ||
    r.includes('montenegrin') || r.includes('french mediterranean') ||
    r.includes('malta') || r.includes('cyprus') ||
    r.includes('sicily') || r.includes('sardinia') ||
    r.includes('corsica') || r.includes('mallorca') ||
    r.includes('menorca') || r.includes('ibiza') ||
    r.includes('crete') || r.includes('rhodes') ||
    r.includes('ionian') || r.includes('aegean')
  ) return 'MED';

  // Black Sea
  if (
    r.includes('black sea') || r.includes('bulgarian') ||
    r.includes('romanian') || r.includes('turkish black') ||
    r.includes('ukrainian') || r.includes('georgian') ||
    r.includes('crimea')
  ) return 'BLK';

  // Iberia-Biscay-Ireland (IBI)
  if (
    r.includes('portuguese') || r.includes('galician') ||
    r.includes('bay of biscay') || r.includes('biscay') ||
    r.includes('irish') || r.includes('ireland') ||
    r.includes('celtic sea') || r.includes('cornwall') ||
    r.includes('devon') || r.includes('bristol channel') ||
    r.includes('pembrokeshire') || r.includes('cardigan') ||
    r.includes('anglesey') || r.includes('wales') ||
    r.includes('merseyside') || r.includes('lancashire') ||
    r.includes('cumbria') || r.includes('hebrides') ||
    r.includes('west of scotland')
  ) return 'IBI';

  // Northwest European Shelf (NWS)
  if (
    r.includes('north sea') || r.includes('english channel') ||
    r.includes('channel') || r.includes('dutch') ||
    r.includes('danish') || r.includes('norwegian') ||
    r.includes('scottish') || r.includes('shetland') ||
    r.includes('orkney') || r.includes('dogger') ||
    r.includes('yorkshire') || r.includes('durham') ||
    r.includes('northumberland') || r.includes('lincolnshire') ||
    r.includes('norfolk') || r.includes('suffolk') ||
    r.includes('essex') || r.includes('kent') ||
    r.includes('sussex') || r.includes('hampshire') ||
    r.includes('dorset') || r.includes('thames') ||
    r.includes('belgian') || r.includes('german bight')
  ) return 'NWS';

  // Arctic
  if (
    r.includes('arctic') || r.includes('svalbard') ||
    r.includes('barents') || r.includes('greenland') ||
    lat > 66
  ) return 'ARC';

  // Geographic bounds fallback
  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) return 'MED';
  if (lat >= 53 && lat <= 66 && lon >= 10 && lon <= 30) return 'BAL';
  if (lat >= 48 && lat <= 63 && lon >= -12 && lon <= 13) return 'NWS';
  if (lat >= 36 && lat <= 54 && lon >= -20 && lon <= -5) return 'IBI';

  return 'GLO';
}

// Use real Copernicus client when credentials are available
const USE_MOCK = !process.env.COPERNICUS_USERNAME || !process.env.COPERNICUS_PASSWORD;

// Provider cache: reuse a single client per basin to avoid re-authentication
const providerCache = new Map<string, RealCopernicusProvider>();

function getProvider(region?: string): RealCopernicusProvider {
  const key = region || 'GLOBAL';
  if (!providerCache.has(key)) {
    console.log(`   🔧 Creating new provider for region: ${key}`);
    providerCache.set(key, new RealCopernicusProvider(region));
  }
  return providerCache.get(key)!;
}

interface GridCell {
  rectangle_code: string;  // G025_ cell ID (stored as rectangle_code in DB)
  center_lat: number;
  center_lon: number;
  region?: string;
  cmems_region?: string;   // Computed at runtime from lat/lon
  distance_to_shore_km?: number;
  is_coastal?: boolean;
}

interface CopernicusUpdateRow {
  rectangle_code: string;
  captured_at: string;
  // Ocean dynamics
  current_east_ms: number | null;
  current_north_ms: number | null;
  current_speed_ms: number | null;
  current_direction_deg: number | null;
  mixed_layer_depth_m: number | null;
  sea_surface_height_m: number | null;
  // Water clarity
  kd490: number | null;
  // Biogeochemical (bio-band scoring)
  chlorophyll_mg_m3: number | null;
  dissolved_oxygen_mg_l: number | null;
  salinity_psu: number | null;
  // Temperature
  sea_temp_c: number | null;
  // Nutrients
  nitrate_umol_l: number | null;
  phosphate_umol_l: number | null;
  // Food chain
  zooplankton_mmol_m3: number | null;
  phytoplankton_mmol_m3: number | null;
  primary_production_mg_c_m3_day: number | null;
  // Waves
  wave_direction_deg: number | null;
  wave_period_s: number | null;
  wind_sea_height_m: number | null;
  swell_height_m: number | null;
}

/**
 * Fetch Copernicus data for a specific location
 */
async function fetchCopernicusData(
  lat: number,
  lon: number,
  cmemsRegion?: string
): Promise<CopernicusMarineSnapshot | null> {
  try {
    if (USE_MOCK) {
      // Use mock data for testing
      const provider = new MockCopernicusProvider();
      const now = new Date();
      const bundle = await provider.fetchBundle({
        lat,
        lon,
        start: now.toISOString(),
        end: now.toISOString(),
      });

      const marineData = toCopernicusMarineData(bundle);
      return marineData.snapshots[0] ?? null;
    } else {
      // Use yesterday's date for ANFC data (current day minus 1)
      // ANFC products provide analysis/forecast data with ~1 day lag
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Try regional provider first if a region is specified
      if (cmemsRegion) {
        try {
          console.log(`   📍 Trying ${cmemsRegion} regional model...`);
          const provider = getProvider(cmemsRegion);
          const bundle = await provider.fetchBundle({
            lat,
            lon,
            start: yesterday.toISOString(),
            end: yesterday.toISOString(),
          });

          const marineData = toCopernicusMarineData(bundle);
          const snapshot = marineData.snapshots[0];

          if (snapshot && hasValidSnapshot(snapshot)) {
            console.log(`   ✅ Got data from ${cmemsRegion} regional model`);
            return snapshot;
          }

          console.warn(`   ⚠️  ${cmemsRegion} returned no valid data, falling back to GLOBAL`);
        } catch (err) {
          console.warn(`   ⚠️  ${cmemsRegion} failed, falling back to GLOBAL:`, err instanceof Error ? err.message : String(err));
        }
      }

      // Fallback to GLOBAL if regional failed or wasn't specified
      console.log(`   🌍 Trying GLOBAL model...`);
      const globalProvider = getProvider(undefined);
      const bundle = await globalProvider.fetchBundle({
        lat,
        lon,
        start: yesterday.toISOString(),
        end: yesterday.toISOString(),
      });

      const marineData = toCopernicusMarineData(bundle);
      const snapshot = marineData.snapshots[0];

      if (!snapshot || !hasValidSnapshot(snapshot)) {
        console.warn(`   ❌ No valid data from GLOBAL model for (${lat}, ${lon})`);
        return null;
      }

      console.log(`   ✅ Got data from GLOBAL model`);
      return snapshot;
    }
  } catch (error) {
    console.error(`   ❌ Failed to fetch Copernicus data for (${lat}, ${lon}):`, error);
    return null;
  }
}

/**
 * Check if snapshot has at least some valid data
 */
function hasValidSnapshot(snapshot: CopernicusMarineSnapshot): boolean {
  const hasCurrents = snapshot.currentSpeedSurface !== undefined && snapshot.currentSpeedSurface !== null;
  const hasClarity = snapshot.kd490Surface !== undefined && snapshot.kd490Surface !== null;
  const hasNutrients = snapshot.zooplanktonSurface !== undefined && snapshot.zooplanktonSurface !== null;
  const hasTemp = snapshot.temperatureSurface !== undefined && snapshot.temperatureSurface !== null;

  return hasCurrents || hasClarity || hasNutrients || hasTemp;
}

/**
 * Convert Copernicus snapshot to database row
 */
function snapshotToRow(
  rectangleCode: string,
  snapshot: CopernicusMarineSnapshot
): CopernicusUpdateRow {
  const capturedAt = new Date().toISOString();

  return {
    rectangle_code: rectangleCode,
    captured_at: capturedAt,
    // Ocean dynamics
    current_east_ms: snapshot.currentEastSurface ?? null,
    current_north_ms: snapshot.currentNorthSurface ?? null,
    current_speed_ms: snapshot.currentSpeedSurface ?? null,
    current_direction_deg: snapshot.currentDirectionSurface ?? null,
    mixed_layer_depth_m: snapshot.mixedLayerDepth ?? null,
    sea_surface_height_m: snapshot.seaSurfaceHeight ?? null,
    // Water clarity
    kd490: snapshot.kd490Surface ?? null,
    // Biogeochemical (bio-band scoring)
    chlorophyll_mg_m3: snapshot.chlorophyllSurface ?? null,
    dissolved_oxygen_mg_l: snapshot.dissolvedOxygenSurface != null
      ? snapshot.dissolvedOxygenSurface * 0.032  // mmol/m³ → mg/L (O₂ MW = 32 g/mol)
      : null,
    salinity_psu: snapshot.salinitySurface ?? null,
    // Temperature
    sea_temp_c: snapshot.temperatureSurface ?? null,
    // Nutrients
    nitrate_umol_l: snapshot.nitrateSurface ?? null,
    phosphate_umol_l: snapshot.phosphateSurface ?? null,
    // Food chain
    zooplankton_mmol_m3: snapshot.zooplanktonSurface ?? null,
    phytoplankton_mmol_m3: snapshot.phytoplanktonSurface ?? null,
    primary_production_mg_c_m3_day: snapshot.primaryProductionSurface ?? null,
    // Waves
    wave_direction_deg: snapshot.waveDirection ?? null,
    wave_period_s: snapshot.wavePeriod ?? null,
    wind_sea_height_m: snapshot.windSeaHeight ?? null,
    swell_height_m: snapshot.swellHeight ?? null,
  };
}

/**
 * Build a partial update object containing only non-null fields.
 * Copernicus data is patchy — some cells return currents but no chlorophyll, etc.
 * We never overwrite previously cached non-null values with nulls.
 */
function buildNonNullUpdate(row: CopernicusUpdateRow): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  // Always update captured_at to track when we last attempted this cell
  update.captured_at = row.captured_at;

  if (row.current_east_ms !== null) update.current_east_ms = row.current_east_ms;
  if (row.current_north_ms !== null) update.current_north_ms = row.current_north_ms;
  if (row.current_speed_ms !== null) update.current_speed_ms = row.current_speed_ms;
  if (row.current_direction_deg !== null) update.current_direction_deg = row.current_direction_deg;
  if (row.mixed_layer_depth_m !== null) update.mixed_layer_depth_m = row.mixed_layer_depth_m;
  if (row.sea_surface_height_m !== null) update.sea_surface_height_m = row.sea_surface_height_m;
  if (row.kd490 !== null) update.kd490 = row.kd490;
  if (row.chlorophyll_mg_m3 !== null) update.chlorophyll_mg_m3 = row.chlorophyll_mg_m3;
  if (row.dissolved_oxygen_mg_l !== null) update.dissolved_oxygen_mg_l = row.dissolved_oxygen_mg_l;
  if (row.salinity_psu !== null) update.salinity_psu = row.salinity_psu;
  if (row.sea_temp_c !== null) update.sea_temp_c = row.sea_temp_c;
  if (row.nitrate_umol_l !== null) update.nitrate_umol_l = row.nitrate_umol_l;
  if (row.phosphate_umol_l !== null) update.phosphate_umol_l = row.phosphate_umol_l;
  if (row.zooplankton_mmol_m3 !== null) update.zooplankton_mmol_m3 = row.zooplankton_mmol_m3;
  if (row.phytoplankton_mmol_m3 !== null) update.phytoplankton_mmol_m3 = row.phytoplankton_mmol_m3;
  if (row.primary_production_mg_c_m3_day !== null) update.primary_production_mg_c_m3_day = row.primary_production_mg_c_m3_day;
  if (row.wave_direction_deg !== null) update.wave_direction_deg = row.wave_direction_deg;
  if (row.wave_period_s !== null) update.wave_period_s = row.wave_period_s;
  if (row.wind_sea_height_m !== null) update.wind_sea_height_m = row.wind_sea_height_m;
  if (row.swell_height_m !== null) update.swell_height_m = row.swell_height_m;

  return update;
}

/**
 * Ingest Copernicus data for a single grid cell
 */
async function ingestGridCell(cell: GridCell): Promise<boolean> {
  const { rectangle_code, center_lat, center_lon, cmems_region } = cell;

  // Validate coordinates
  if (center_lat == null || center_lon == null) {
    console.log(`📍 ${rectangle_code}: ⚠️  Invalid coordinates (null)`);
    return false;
  }
  console.log(`📍 ${rectangle_code}: (${center_lat.toFixed(2)}, ${center_lon.toFixed(2)})`);

  // Fetch Copernicus data
  const snapshot = await fetchCopernicusData(center_lat, center_lon, cmems_region);

  if (!snapshot) {
    console.log(`   ❌ No Copernicus data available`);
    return false;
  }

  // Convert to database row
  const row = snapshotToRow(rectangle_code, snapshot);

  // Get the latest record for this cell
  const { data: latestRecord } = await supabase
    .from('findr_conditions_snapshots')
    .select('id, captured_at')
    .eq('rectangle_code', rectangle_code)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (latestRecord) {
    // Update existing record — only overwrite non-null fields to preserve cached data
    const nonNullUpdate = buildNonNullUpdate(row);
    const fieldsUpdated = Object.keys(nonNullUpdate).length - 1; // minus captured_at

    const { error } = await supabase
      .from('findr_conditions_snapshots')
      .update(nonNullUpdate)
      .eq('id', latestRecord.id);

    if (error) {
      console.log(`   ❌ Update failed: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Updated ${fieldsUpdated} fields (current: ${row.current_speed_ms?.toFixed(2) ?? 'null'} m/s, temp: ${row.sea_temp_c?.toFixed(1) ?? 'null'}°C, chl: ${row.chlorophyll_mg_m3?.toFixed(2) ?? 'null'} mg/m³)`);
  } else {
    // No existing record, insert full snapshot (nulls are fine for first insert)
    const { error } = await supabase
      .from('findr_conditions_snapshots')
      .insert(row);

    if (error) {
      console.log(`   ❌ Insert failed: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Inserted (current: ${row.current_speed_ms?.toFixed(2) ?? 'null'} m/s, temp: ${row.sea_temp_c?.toFixed(1) ?? 'null'}°C, chl: ${row.chlorophyll_mg_m3?.toFixed(2) ?? 'null'} mg/m³)`);
  }

  return true;
}

/**
 * Main ingestion process
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         Copernicus Marine Data Ingestion - OCEAN CURRENT        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (USE_MOCK) {
    console.log('⚠️  Using MOCK data (Copernicus credentials not provided)');
    console.log('   Set COPERNICUS_USERNAME and COPERNICUS_PASSWORD for real data\n');
  } else {
    console.log('✅ Using REAL Copernicus Marine Service API\n');
  }

  // Fetch coastal 0.25° grid cells from rectangles_025deg_api
  console.log('📥 Fetching coastal grid cells (0.25° grid, is_coastal = true)...');

  const { data: rawCells, error } = await supabase
    .from('rectangles_025deg_api')
    .select('rectangle_code, center_lat, center_lon, region, distance_to_shore_km, is_coastal')
    .eq('is_coastal', true)
    .order('rectangle_code');

  if (error || !rawCells) {
    console.error('❌ Failed to fetch grid cells:', error);
    process.exit(1);
  }

  // Compute CMEMS region for each cell and sort closest-to-shore first.
  // Closest-first ensures the best fishing cells get processed even if the run
  // is limited or times out. Furthest-from-shore cells are lowest priority.
  const enrichedCells: GridCell[] = rawCells
    .map(r => ({
      ...r,
      distance_to_shore_km: r.distance_to_shore_km || 0,
      cmems_region: getCmemsRegion(r.region || '', r.center_lat, r.center_lon),
    }))
    .sort((a, b) => (a.distance_to_shore_km || 0) - (b.distance_to_shore_km || 0));

  const rectanglesToProcess = LIMIT ? enrichedCells.slice(0, LIMIT) : enrichedCells;
  const totalCells = rectanglesToProcess.length;
  const offshoreCount = rectanglesToProcess.filter(r => (r.distance_to_shore_km || 0) > 10).length;
  const nearshoreCount = rectanglesToProcess.filter(r => (r.distance_to_shore_km || 0) >= 5 && (r.distance_to_shore_km || 0) <= 10).length;
  const coastalCount = rectanglesToProcess.filter(r => (r.distance_to_shore_km || 0) < 5).length;

  console.log(`✅ Found ${rawCells.length} coastal grid cells`);
  console.log(`✅ Processing ${totalCells} cells:`);
  console.log(`   ${offshoreCount} offshore (10-30km)`);
  console.log(`   ${nearshoreCount} nearshore (5-10km)`);
  console.log(`   ${coastalCount} coastal (<5km)`);

  if (LIMIT) {
    console.log(`⚠️  Processing first ${LIMIT} cells only (FINDR_CONDITIONS_LIMIT set)`);
  }

  // Log first 5 cells for debugging
  console.log(`\n📋 First ${Math.min(5, rectanglesToProcess.length)} grid cells to process:`);
  for (const r of rectanglesToProcess.slice(0, 5)) {
    console.log(`   ${r.rectangle_code}: (${r.center_lat}, ${r.center_lon}) dist=${r.distance_to_shore_km}km region=${r.cmems_region || 'GLOBAL'}`);
  }
  console.log('');

  // Group cells by CMEMS region for better provider reuse
  const cellsByRegion = new Map<string, GridCell[]>();
  for (const cell of rectanglesToProcess) {
    const region = cell.cmems_region || 'GLOBAL';
    if (!cellsByRegion.has(region)) {
      cellsByRegion.set(region, []);
    }
    cellsByRegion.get(region)!.push(cell);
  }

  console.log(`📦 Grouped into ${cellsByRegion.size} regions:\n`);
  for (const [region, cells] of cellsByRegion.entries()) {
    console.log(`   ${region}: ${cells.length} cells`);
  }
  console.log('');

  // Filter out cells with fresh data (incremental ingestion)
  let cellsToIngest = rectanglesToProcess;
  let skippedCount = 0;

  if (!FORCE_REFRESH) {
    console.log(`🔍 Checking data freshness (threshold: ${FRESHNESS_HOURS}h)...\n`);

    const freshnessThreshold = new Date();
    freshnessThreshold.setHours(freshnessThreshold.getHours() - FRESHNESS_HOURS);

    // Fetch latest data timestamps for all grid cells
    const { data: freshData } = await supabase
      .from('grid_conditions_latest')
      .select('rectangle_code, captured_at')
      .gte('captured_at', freshnessThreshold.toISOString());

    const freshCells = new Set(freshData?.map(d => d.rectangle_code) || []);
    cellsToIngest = rectanglesToProcess.filter(r => !freshCells.has(r.rectangle_code));
    skippedCount = rectanglesToProcess.length - cellsToIngest.length;

    console.log(`✅ ${skippedCount} cells have fresh data (<${FRESHNESS_HOURS}h old)`);
    console.log(`📥 ${cellsToIngest.length} cells need updates\n`);
  } else {
    console.log(`⚠️  FORCE_REFRESH enabled - processing all cells\n`);
  }

  // Regroup cells by region after freshness filtering
  const cellsByRegionFiltered = new Map<string, GridCell[]>();
  for (const cell of cellsToIngest) {
    const region = cell.cmems_region || 'GLOBAL';
    if (!cellsByRegionFiltered.has(region)) {
      cellsByRegionFiltered.set(region, []);
    }
    cellsByRegionFiltered.get(region)!.push(cell);
  }

  // Process cells region by region with parallelization
  let successCount = 0;
  let failCount = 0;
  let processedCount = 0;
  const startTime = Date.now();
  const totalToProcess = cellsToIngest.length;

  for (const [region, cells] of cellsByRegionFiltered.entries()) {
    console.log(`\n🌊 Processing ${cells.length} cells in ${region} region (batch size: ${BATCH_SIZE})...\n`);

    // Process in batches for parallelization
    for (let i = 0; i < cells.length; i += BATCH_SIZE) {
      const batch = cells.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(cell => ingestGridCell(cell))
      );

      // Count successes and failures
      results.forEach(success => {
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      });

      processedCount += batch.length;

      // Progress indicator every 10 cells
      if (processedCount % 10 === 0 || processedCount === totalToProcess) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (processedCount / (Date.now() - startTime) * 1000).toFixed(1);
        console.log(`\n📊 Progress: ${processedCount}/${totalToProcess} (${rate} cells/sec, ${elapsed}s elapsed)\n`);
      }

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < cells.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  const avgRate = totalToProcess > 0 ? (totalToProcess / (Date.now() - startTime) * 1000).toFixed(2) : '0.00';

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                      INGESTION COMPLETE                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Success: ${successCount}/${totalToProcess} grid cells processed`);
  console.log(`❌ Failed: ${failCount}/${totalToProcess} grid cells`);
  console.log(`⏭️  Skipped: ${skippedCount} cells (fresh data <${FRESHNESS_HOURS}h old)`);
  console.log(`📊 Success rate: ${totalToProcess > 0 ? ((successCount / totalToProcess) * 100).toFixed(1) : '0.0'}% (97-99% expected)`);
  console.log(`⏱️  Total time: ${totalTime}s (${avgRate} cells/sec)`);
  console.log(`\n🎯 0.25° Grid Strategy:`);
  console.log(`   ✅ ${totalCells} coastal grid cells (is_coastal = true)`);
  console.log(`   ✅ Global coverage (G025_ cell IDs)`);
  console.log(`   ✅ Non-null merge: cached data preserved when Copernicus returns partial results`);
  console.log(`   ✅ 24h freshness window minimizes redundant API calls`);
  console.log(`\n💡 Next Steps:`);
  console.log(`   1. Verify data: npx tsx scripts/ingestion/verify-database-status.ts`);
  console.log(`   2. Check grid_conditions_latest in Supabase for G025_ entries`);

  if (USE_MOCK) {
    console.log(`\n⚠️  IMPORTANT: Currently using MOCK data`);
    console.log(`   For production, provide real Copernicus credentials:`);
    console.log(`   - COPERNICUS_USERNAME=your-username`);
    console.log(`   - COPERNICUS_PASSWORD=your-password`);
  }
}

// Run
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
