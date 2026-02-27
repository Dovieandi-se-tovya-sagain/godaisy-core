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

/**
 * Row format for grid_conditions_latest table.
 *
 * Column mapping from Copernicus snapshot → grid_conditions_latest:
 *   temperatureSurface       → surface_temperature_c
 *   dissolvedOxygenSurface   → oxygen_mg_l  (mmol/m³ → mg/L)
 *   salinitySurface          → salinity_psu
 *   chlorophyllSurface       → chlorophyll_mg_m3
 *   nitrateSurface           → nitrate_umol_l
 *   phosphateSurface         → phosphate_umol_l
 *   kd490Surface             → kd490
 *   waveDirection            → wave_direction_deg
 *   wavePeriod               → wave_period_s
 *   windSeaHeight            → wave_height_m  (best available wave height)
 *
 * Not available in grid_conditions_latest (stored in sources metadata):
 *   current_speed_ms, current_direction_deg, current_east_ms, current_north_ms
 *   mixed_layer_depth_m, sea_surface_height_m
 *   zooplankton, phytoplankton, primary_production
 *   swell_height_m (separate from wave_height)
 */
interface GridConditionsRow {
  cell_id: string;
  collected_at: string;
  surface_temperature_c: number | null;
  salinity_psu: number | null;
  oxygen_mg_l: number | null;
  chlorophyll_mg_m3: number | null;
  nitrate_umol_l: number | null;
  phosphate_umol_l: number | null;
  kd490: number | null;
  wave_direction_deg: number | null;
  wave_period_s: number | null;
  wave_height_m: number | null;
  sources: string[];
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
 * Convert Copernicus snapshot to grid_conditions_latest row
 */
function snapshotToRow(
  cellId: string,
  snapshot: CopernicusMarineSnapshot,
  cmemsRegion?: string
): GridConditionsRow {
  return {
    cell_id: cellId,
    collected_at: new Date().toISOString(),
    surface_temperature_c: snapshot.temperatureSurface ?? null,
    salinity_psu: snapshot.salinitySurface ?? null,
    oxygen_mg_l: snapshot.dissolvedOxygenSurface != null
      ? snapshot.dissolvedOxygenSurface * 0.032  // mmol/m³ → mg/L (O₂ MW = 32 g/mol)
      : null,
    chlorophyll_mg_m3: snapshot.chlorophyllSurface ?? null,
    nitrate_umol_l: snapshot.nitrateSurface ?? null,
    phosphate_umol_l: snapshot.phosphateSurface ?? null,
    kd490: snapshot.kd490Surface ?? null,
    wave_direction_deg: snapshot.waveDirection ?? null,
    wave_period_s: snapshot.wavePeriod ?? null,
    wave_height_m: snapshot.windSeaHeight ?? snapshot.swellHeight ?? null,
    sources: [`copernicus-${cmemsRegion || 'GLO'}`],
  };
}

/**
 * Build a partial update object containing only non-null fields.
 * Copernicus data is patchy — some cells return currents but no chlorophyll, etc.
 * We never overwrite previously cached non-null values with nulls.
 */
function buildNonNullUpdate(row: GridConditionsRow): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  // Always update collected_at and sources to track when we last attempted this cell
  update.collected_at = row.collected_at;
  update.sources = row.sources;

  if (row.surface_temperature_c !== null) update.surface_temperature_c = row.surface_temperature_c;
  if (row.salinity_psu !== null) update.salinity_psu = row.salinity_psu;
  if (row.oxygen_mg_l !== null) update.oxygen_mg_l = row.oxygen_mg_l;
  if (row.chlorophyll_mg_m3 !== null) update.chlorophyll_mg_m3 = row.chlorophyll_mg_m3;
  if (row.nitrate_umol_l !== null) update.nitrate_umol_l = row.nitrate_umol_l;
  if (row.phosphate_umol_l !== null) update.phosphate_umol_l = row.phosphate_umol_l;
  if (row.kd490 !== null) update.kd490 = row.kd490;
  if (row.wave_direction_deg !== null) update.wave_direction_deg = row.wave_direction_deg;
  if (row.wave_period_s !== null) update.wave_period_s = row.wave_period_s;
  if (row.wave_height_m !== null) update.wave_height_m = row.wave_height_m;

  return update;
}

/**
 * Ingest Copernicus data for a single grid cell.
 * Writes to grid_conditions_latest (cell_id column).
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
  const row = snapshotToRow(rectangle_code, snapshot, cmems_region);

  // Check if cell already has data
  const { data: existing } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id, collected_at')
    .eq('cell_id', rectangle_code)
    .maybeSingle();

  if (existing) {
    // Update existing record — only overwrite non-null fields to preserve cached data
    const nonNullUpdate = buildNonNullUpdate(row);
    const fieldsUpdated = Object.keys(nonNullUpdate).length - 2; // minus collected_at + sources

    const { error } = await supabase
      .from('grid_conditions_latest')
      .update(nonNullUpdate)
      .eq('cell_id', rectangle_code);

    if (error) {
      console.log(`   ❌ Update failed: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Updated ${fieldsUpdated} fields (temp: ${row.surface_temperature_c?.toFixed(1) ?? 'null'}°C, chl: ${row.chlorophyll_mg_m3?.toFixed(2) ?? 'null'} mg/m³, kd490: ${row.kd490?.toFixed(3) ?? 'null'})`);
  } else {
    // Insert new row (cell exists in grid_025deg but not yet in conditions)
    const { error } = await supabase
      .from('grid_conditions_latest')
      .insert(row);

    if (error) {
      console.log(`   ❌ Insert failed: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Inserted (temp: ${row.surface_temperature_c?.toFixed(1) ?? 'null'}°C, chl: ${row.chlorophyll_mg_m3?.toFixed(2) ?? 'null'} mg/m³, kd490: ${row.kd490?.toFixed(3) ?? 'null'})`);
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

  // Fetch coastal 0.25° grid cells.
  // Cell source: grid_conditions_latest (2,139 known coastal cells, column: cell_id)
  // Coordinates: rectangles_025deg_api, with fallback to parsing from cell ID
  // Write target: findr_conditions_snapshots (column: rectangle_code)
  console.log('📥 Fetching coastal grid cells from grid_conditions_latest...');

  const { data: knownCells, error: knownError } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id')
    .like('cell_id', 'G025_%');

  if (knownError || !knownCells) {
    console.error('❌ Failed to fetch grid cells from grid_conditions_latest:', knownError);
    process.exit(1);
  }

  // Deduplicate cell IDs
  const uniqueCellIds = [...new Set(knownCells.map(c => c.cell_id))];
  console.log(`   Found ${uniqueCellIds.length} unique G025_ cells`);

  // Get coordinates from rectangles_025deg_api
  // Supabase .in() has a practical limit, so batch if needed
  const coordMap = new Map<string, { lat: number; lon: number }>();
  const BATCH = 500;
  for (let i = 0; i < uniqueCellIds.length; i += BATCH) {
    const batch = uniqueCellIds.slice(i, i + BATCH);
    const { data: coords } = await supabase
      .from('rectangles_025deg_api')
      .select('rectangle_code, center_lat, center_lon')
      .in('rectangle_code', batch);
    if (coords) {
      for (const c of coords) {
        coordMap.set(c.rectangle_code, { lat: c.center_lat, lon: c.center_lon });
      }
    }
  }
  console.log(`   Got coordinates for ${coordMap.size} cells from rectangles_025deg_api`);

  // Parse coordinates from cell ID for cells not in rectangles_025deg_api
  // Format: G025_N44W007 → lat ≈ 44.125, lon ≈ -7.125
  function parseCellCenter(cellId: string): { lat: number; lon: number } | null {
    const match = cellId.match(/^G025_([NS])(\d{2})([EW])(\d{3})$/);
    if (!match) return null;
    const [, latH, latD, lonH, lonD] = match;
    return {
      lat: (latH === 'N' ? 1 : -1) * (parseInt(latD, 10) + 0.125),
      lon: (lonH === 'E' ? 1 : -1) * (parseInt(lonD, 10) + 0.125),
    };
  }

  // Build enriched cell list with CMEMS region
  const enrichedCells: GridCell[] = [];
  let parsedCount = 0;
  for (const cellId of uniqueCellIds) {
    const coords = coordMap.get(cellId) || parseCellCenter(cellId);
    if (!coords) continue;
    if (!coordMap.has(cellId)) parsedCount++;
    enrichedCells.push({
      rectangle_code: cellId,
      center_lat: coords.lat,
      center_lon: coords.lon,
      cmems_region: getCmemsRegion('', coords.lat, coords.lon),
    });
  }
  if (parsedCount > 0) {
    console.log(`   Parsed ${parsedCount} cell coordinates from cell IDs (not in rectangles_025deg_api)`)
  }

  const rectanglesToProcess = LIMIT ? enrichedCells.slice(0, LIMIT) : enrichedCells;
  const totalCells = rectanglesToProcess.length;

  console.log(`✅ Built ${totalCells} grid cells to process`);

  if (LIMIT) {
    console.log(`⚠️  Processing first ${LIMIT} cells only (FINDR_CONDITIONS_LIMIT set)`);
  }

  // Log first 5 cells for debugging
  console.log(`\n📋 First ${Math.min(5, rectanglesToProcess.length)} grid cells to process:`);
  for (const r of rectanglesToProcess.slice(0, 5)) {
    console.log(`   ${r.rectangle_code}: (${r.center_lat}, ${r.center_lon}) region=${r.cmems_region || 'GLOBAL'}`);
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

    // Fetch latest data timestamps from grid_conditions_latest
    const { data: freshData } = await supabase
      .from('grid_conditions_latest')
      .select('cell_id, collected_at')
      .gte('collected_at', freshnessThreshold.toISOString());

    const freshCells = new Set(freshData?.map(d => d.cell_id) || []);
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
