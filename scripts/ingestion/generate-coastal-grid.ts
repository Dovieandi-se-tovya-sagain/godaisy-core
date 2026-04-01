#!/usr/bin/env tsx

/**
 * Generate True 0.25° Coastal Grid
 *
 * Downloads Natural Earth coastline data and identifies all 0.25° grid cells
 * whose nearest edge is within a threshold distance of coastline (default 5 km).
 * Inserts new cells into grid_025deg (FK parent) then seeds grid_conditions_latest.
 *
 * Usage:
 *   npx tsx scripts/ingestion/generate-coastal-grid.ts --dry-run             # count only
 *   npx tsx scripts/ingestion/generate-coastal-grid.ts --seed               # insert + cleanup
 *   npx tsx scripts/ingestion/generate-coastal-grid.ts --seed --skip-seed   # grid_025deg only
 *   npx tsx scripts/ingestion/generate-coastal-grid.ts --seed --no-cleanup  # add cells, keep old
 *   npx tsx scripts/ingestion/generate-coastal-grid.ts --seed --distance=10 # 10 km threshold
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// ─── Environment ─────────────────────────────────────────────────────────────

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.cli') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CLI Args ────────────────────────────────────────────────────────────────

const DO_SEED = process.argv.includes('--seed');
const SKIP_CONDITIONS = process.argv.includes('--skip-seed');
const NO_CLEANUP = process.argv.includes('--no-cleanup');
const distMatch = process.argv.find(a => a.startsWith('--distance='));
const DISTANCE_KM = distMatch ? parseFloat(distMatch.split('=')[1]) : 5;

const LAT_MIN_BOUND = -55;
const LAT_MAX_BOUND = 72;
const COASTLINE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson';
const CACHE_PATH = resolve(process.cwd(), '.cache', 'ne_10m_coastline.geojson');

// ─── Inlined Utilities ──────────────────────────────────────────────────────

/** Haversine distance in km (from conditionHelpers.ts) */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Generate cell ID from any point inside the cell (from gridCellLookup.ts) */
function generateGridCellId(lat: number, lon: number): string {
  const latMax = Math.floor(lat / 0.25) * 0.25 + 0.25;
  const lonMax = Math.floor(lon / 0.25) * 0.25 + 0.25;
  const latHemisphere = latMax >= 0 ? 'N' : 'S';
  const lonHemisphere = lonMax >= 0 ? 'E' : 'W';
  const latHundredths = Math.round(Math.abs(latMax) * 100);
  const lonHundredths = Math.round(Math.abs(lonMax) * 100);
  return `G025_${latHemisphere}${String(latHundredths).padStart(4, '0')}${lonHemisphere}${String(lonHundredths).padStart(5, '0')}`;
}

// ─── Coastline Data ──────────────────────────────────────────────────────────

interface Vertex {
  lat: number;
  lon: number;
}

type BucketMap = Map<string, Vertex[]>;

function bucketKey(lat: number, lon: number): string {
  return `${Math.floor(lat)},${Math.floor(lon)}`;
}

async function downloadCoastline(): Promise<Vertex[]> {
  // Try local cache first
  if (existsSync(CACHE_PATH)) {
    console.log(`   Using cached coastline: ${CACHE_PATH}`);
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    return extractVertices(JSON.parse(raw));
  }

  console.log(`   Downloading ${COASTLINE_URL} ...`);
  const res = await fetch(COASTLINE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();

  // Cache for re-runs
  const cacheDir = resolve(process.cwd(), '.cache');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  writeFileSync(CACHE_PATH, text);
  console.log(`   Cached to ${CACHE_PATH}`);

  return extractVertices(JSON.parse(text));
}

function extractVertices(geojson: any): Vertex[] {
  const vertices: Vertex[] = [];
  let featuresUsed = 0;
  let featuresSkipped = 0;

  for (const feature of geojson.features) {
    // scalerank <= 1: continents + major islands (Britain, Japan, NZ, etc.)
    if (feature.properties?.scalerank > 1) {
      featuresSkipped++;
      continue;
    }
    featuresUsed++;

    const coords: number[][] =
      feature.geometry.type === 'MultiLineString'
        ? feature.geometry.coordinates.flat()
        : feature.geometry.coordinates;

    for (const coord of coords) {
      const [lon, lat] = coord; // GeoJSON is [lon, lat]
      if (lat < LAT_MIN_BOUND || lat >= LAT_MAX_BOUND) continue;
      vertices.push({ lat, lon });
    }
  }

  console.log(`   Features: ${featuresUsed} used, ${featuresSkipped} skipped (scalerank > 1)`);
  console.log(`   Vertices extracted: ${vertices.length}`);
  return vertices;
}

function buildBucketIndex(vertices: Vertex[]): BucketMap {
  const buckets: BucketMap = new Map();
  for (const v of vertices) {
    const key = bucketKey(v.lat, v.lon);
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    arr.push(v);
  }
  console.log(`   Bucket index: ${buckets.size} unique 1° buckets`);
  return buckets;
}

// ─── Coastal Proximity Check ─────────────────────────────────────────────────

/**
 * Check if a cell's nearest edge is within thresholdKm of any coastline vertex.
 * Uses "clamp vertex to cell bounds" approach — if the vertex is inside the cell,
 * the clamped point equals the vertex and distance is 0 (always coastal).
 */
function isCellCoastal(
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  buckets: BucketMap,
  thresholdKm: number,
): boolean {
  const cellCenterLat = latMin + 0.125;
  const cellCenterLon = lonMin + 0.125;
  const latFloor = Math.floor(cellCenterLat);
  const lonFloor = Math.floor(cellCenterLon);

  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const key = `${latFloor + dLat},${lonFloor + dLon}`;
      const verts = buckets.get(key);
      if (!verts) continue;

      for (const v of verts) {
        // Clamp vertex to cell rectangle — nearest point on edge
        const clampedLat = Math.max(latMin, Math.min(latMax, v.lat));
        const clampedLon = Math.max(lonMin, Math.min(lonMax, v.lon));
        const dist = calculateDistanceKm(clampedLat, clampedLon, v.lat, v.lon);
        if (dist <= thresholdKm) return true;
      }
    }
  }
  return false;
}

// ─── Cell Generation ─────────────────────────────────────────────────────────

interface CoastalCell {
  cellId: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

function generateCoastalCells(buckets: BucketMap, thresholdKm: number): CoastalCell[] {
  const cells: CoastalCell[] = [];
  const totalLatSteps = Math.round((LAT_MAX_BOUND - LAT_MIN_BOUND) / 0.25);
  let stepCount = 0;

  for (let latMin = LAT_MIN_BOUND; latMin < LAT_MAX_BOUND; latMin += 0.25) {
    stepCount++;
    for (let lonMin = -180; lonMin < 180; lonMin += 0.25) {
      const latMax = latMin + 0.25;
      const lonMax = lonMin + 0.25;

      if (isCellCoastal(latMin, latMax, lonMin, lonMax, buckets, thresholdKm)) {
        const centerLat = latMin + 0.125;
        const centerLon = lonMin + 0.125;
        cells.push({
          cellId: generateGridCellId(centerLat, centerLon),
          latMin,
          latMax,
          lonMin,
          lonMax,
        });
      }
    }

    if (stepCount % 20 === 0 || stepCount === totalLatSteps) {
      process.stdout.write(
        `\r   Scanned ${stepCount}/${totalLatSteps} lat bands, ${cells.length} coastal cells found`,
      );
    }
  }
  console.log(''); // newline after progress
  return cells;
}

// ─── Database Operations ─────────────────────────────────────────────────────

async function fetchExistingCellIds(table: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE_SIZE = 10000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('cell_id')
      .like('cell_id', 'G025_%')
      .order('cell_id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (offset === 0) throw new Error(`Failed to query ${table}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) ids.add(row.cell_id);
    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  return ids;
}

async function insertGridCells(cells: CoastalCell[]): Promise<number> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < cells.length; i += BATCH_SIZE) {
    const batch = cells.slice(i, i + BATCH_SIZE);
    const rows = batch.map(c => {
      // row_ix/col_ix: integer grid indices from origin (-90, -180)
      const row_ix = Math.round((c.latMin - (-90)) / 0.25);
      const col_ix = Math.round((c.lonMin - (-180)) / 0.25);
      return {
        cell_id: c.cellId,
        lat_min: c.latMin,
        lat_max: c.latMax,
        lon_min: c.lonMin,
        lon_max: c.lonMax,
        row_ix,
        col_ix,
        geom: JSON.stringify({
          type: 'Polygon',
          crs: { type: 'name', properties: { name: 'EPSG:4326' } },
          coordinates: [[
            [c.lonMin, c.latMin],
            [c.lonMax, c.latMin],
            [c.lonMax, c.latMax],
            [c.lonMin, c.latMax],
            [c.lonMin, c.latMin],
          ]],
        }),
        centroid: JSON.stringify({
          type: 'Point',
          crs: { type: 'name', properties: { name: 'EPSG:4326' } },
          coordinates: [c.lonMin + 0.125, c.latMin + 0.125],
        }),
      };
    });

    const { error } = await supabase.from('grid_025deg').upsert(rows, { onConflict: 'cell_id' });

    if (error) {
      console.error(`\n   grid_025deg batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      // One-by-one fallback
      for (const row of rows) {
        const { error: singleErr } = await supabase
          .from('grid_025deg')
          .upsert(row, { onConflict: 'cell_id' });
        if (singleErr) {
          failed++;
          if (failed <= 10) console.error(`     ${row.cell_id}: ${singleErr.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= cells.length) {
      process.stdout.write(`\r   grid_025deg: ${inserted} inserted, ${failed} failed`);
    }
  }
  console.log('');
  return inserted;
}

async function insertSeedRows(cellIds: string[]): Promise<number> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < cellIds.length; i += BATCH_SIZE) {
    const batch = cellIds.slice(i, i + BATCH_SIZE);
    const rows = batch.map(cellId => ({
      cell_id: cellId,
      collected_at: '1970-01-01T00:00:00.000Z',
      sources: ['seed'],
    }));

    const { error } = await supabase.from('grid_conditions_latest').insert(rows);

    if (error) {
      console.error(
        `\n   grid_conditions_latest batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`,
      );
      for (const row of rows) {
        const { error: singleErr } = await supabase
          .from('grid_conditions_latest')
          .insert(row);
        if (singleErr) {
          failed++;
          if (failed <= 5) console.error(`     ${row.cell_id}: ${singleErr.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= cellIds.length) {
      process.stdout.write(`\r   grid_conditions_latest: ${inserted} inserted, ${failed} failed`);
    }
  }
  console.log('');
  return inserted;
}

// ─── Cleanup: Remove Non-Coastal Cells ───────────────────────────────────────

/**
 * Delete cells from a table in batches using .in() filter.
 * Returns count of deleted rows.
 */
async function deleteCellsBatched(table: string, cellIds: string[]): Promise<number> {
  const BATCH_SIZE = 200; // Supabase .in() has practical limits
  let deleted = 0;
  let errors = 0;

  for (let i = 0; i < cellIds.length; i += BATCH_SIZE) {
    const batch = cellIds.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in('cell_id', batch);

    if (error) {
      errors++;
      if (errors <= 3) console.error(`\n   ${table} delete batch error: ${error.message}`);
      // One-by-one fallback
      for (const id of batch) {
        const { error: singleErr } = await supabase
          .from(table)
          .delete()
          .eq('cell_id', id);
        if (!singleErr) deleted++;
      }
    } else {
      deleted += count ?? batch.length;
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= cellIds.length) {
      process.stdout.write(`\r   ${table}: ${deleted} deleted so far`);
    }
  }
  console.log('');
  return deleted;
}

/**
 * Remove all G025_ cells from DB that are NOT in the coastal set.
 * FK structure (tree, not chain):
 *       grid_025deg (parent PK)
 *           ↑           ↑
 *   grid_conditions   grid_025deg_ices_xref
 *     _latest           (FK child 2)
 *   (FK child 1)
 *
 * Delete BOTH children before parent.
 */
async function cleanupNonCoastalCells(
  coastalIds: Set<string>,
  existingGrid: Set<string>,
  existingConditions: Set<string>,
): Promise<{ gridDeleted: number; conditionsDeleted: number; xrefDeleted: number }> {
  // Find cells to remove
  const gridToRemove = [...existingGrid].filter(id => !coastalIds.has(id));
  const conditionsToRemove = [...existingConditions].filter(id => !coastalIds.has(id));

  console.log(`   Cells to remove from grid_025deg:            ${gridToRemove.length}`);
  console.log(`   Cells to remove from grid_conditions_latest: ${conditionsToRemove.length}`);

  if (gridToRemove.length === 0 && conditionsToRemove.length === 0) {
    return { gridDeleted: 0, conditionsDeleted: 0, xrefDeleted: 0 };
  }

  // Step A: Delete FK children from grid_conditions_latest first
  let conditionsDeleted = 0;
  if (conditionsToRemove.length > 0) {
    console.log(`\n   A. Removing ${conditionsToRemove.length} from grid_conditions_latest...`);
    conditionsDeleted = await deleteCellsBatched('grid_conditions_latest', conditionsToRemove);
  }

  // Step B: Delete FK children from grid_025deg_ices_xref
  let xrefDeleted = 0;
  if (gridToRemove.length > 0) {
    console.log(`\n   B. Removing xref entries from grid_025deg_ices_xref...`);
    xrefDeleted = await deleteCellsBatched('grid_025deg_ices_xref', gridToRemove);
  }

  // Step C: Delete from grid_025deg (FK parent)
  let gridDeleted = 0;
  if (gridToRemove.length > 0) {
    console.log(`\n   C. Removing ${gridToRemove.length} from grid_025deg...`);
    gridDeleted = await deleteCellsBatched('grid_025deg', gridToRemove);
  }

  return { gridDeleted, conditionsDeleted, xrefDeleted };
}

// ─── Spot Checks ─────────────────────────────────────────────────────────────

function printSpotChecks(cells: CoastalCell[]) {
  const ukCells = cells.filter(
    c => c.latMin >= 49 && c.latMax <= 61 && c.lonMin >= -11 && c.lonMax <= 3,
  );
  const japaneseCells = cells.filter(
    c => c.latMin >= 30 && c.latMax <= 46 && c.lonMin >= 128 && c.lonMax <= 146,
  );
  const midPacific = cells.filter(
    c => c.lonMin >= -170 && c.lonMax <= -150 && c.latMin >= -5 && c.latMax <= 5,
  );
  const midAtlantic = cells.filter(
    c => c.lonMin >= -35 && c.lonMax <= -25 && c.latMin >= 25 && c.latMax <= 35,
  );

  console.log(`\n   Spot checks:`);
  console.log(`     UK coast:         ${ukCells.length} cells`);
  console.log(`     Japan coast:      ${japaneseCells.length} cells`);
  console.log(`     Mid-Pacific:      ${midPacific.length} cells (expect ~0)`);
  console.log(`     Mid-Atlantic:     ${midAtlantic.length} cells (expect ~0)`);

  if (ukCells.length > 0) {
    console.log(`     UK sample: ${ukCells.slice(0, 3).map(c => c.cellId).join(', ')}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('========================================================');
  console.log('  Generate True 0.25° Coastal Grid');
  console.log('========================================================');
  console.log(`  Distance threshold: ${DISTANCE_KM} km (nearest cell edge)`);
  console.log(`  Latitude band: ${LAT_MIN_BOUND}° to ${LAT_MAX_BOUND}°`);
  console.log(`  Mode: ${DO_SEED ? 'INSERT' : 'DRY RUN'}`);
  if (SKIP_CONDITIONS) console.log('  Skipping grid_conditions_latest seed rows');
  if (NO_CLEANUP) console.log('  Cleanup disabled (--no-cleanup)');
  else console.log('  Cleanup: will remove non-coastal cells from DB');
  console.log('');

  // Step 1: Download coastline
  console.log('1. Loading coastline data...');
  const vertices = await downloadCoastline();

  // Step 2: Build spatial index
  console.log('\n2. Building spatial index...');
  const buckets = buildBucketIndex(vertices);

  // Step 3: Find coastal cells
  console.log(`\n3. Scanning candidate cells (${DISTANCE_KM} km threshold)...`);
  const coastalCells = generateCoastalCells(buckets, DISTANCE_KM);
  console.log(`   Total coastal cells identified: ${coastalCells.length}`);
  printSpotChecks(coastalCells);

  // Step 4: Compare with existing DB
  console.log('\n4. Fetching existing cells from database...');
  const existingGrid = await fetchExistingCellIds('grid_025deg');
  const existingConditions = await fetchExistingCellIds('grid_conditions_latest');
  console.log(`   grid_025deg:            ${existingGrid.size} existing cells`);
  console.log(`   grid_conditions_latest: ${existingConditions.size} existing cells`);

  const coastalIdSet = new Set(coastalCells.map(c => c.cellId));
  const newGridCells = coastalCells.filter(c => !existingGrid.has(c.cellId));
  const newSeedIds = coastalCells
    .filter(c => !existingConditions.has(c.cellId))
    .map(c => c.cellId);

  // Cleanup analysis
  const gridToRemoveCount = [...existingGrid].filter(id => !coastalIdSet.has(id)).length;
  const conditionsToRemoveCount = [...existingConditions].filter(id => !coastalIdSet.has(id)).length;

  console.log(`\n   New for grid_025deg:            ${newGridCells.length}`);
  console.log(`   New for grid_conditions_latest: ${newSeedIds.length}`);
  if (!NO_CLEANUP) {
    console.log(`   To REMOVE from grid_025deg:            ${gridToRemoveCount}`);
    console.log(`   To REMOVE from grid_conditions_latest: ${conditionsToRemoveCount}`);
    console.log(`\n   Net grid_025deg:            ${existingGrid.size - gridToRemoveCount + newGridCells.length} (was ${existingGrid.size})`);
    console.log(`   Net grid_conditions_latest: ${existingConditions.size - conditionsToRemoveCount + newSeedIds.length} (was ${existingConditions.size})`);
  }

  if (!DO_SEED) {
    console.log('\n   DRY RUN — no database changes made.');
    console.log('   Run with --seed to insert and clean up.');
    console.log('   Run with --seed --no-cleanup to insert without removing old cells.');
    return;
  }

  // Orphan detection (cells in conditions but not in grid_025deg)
  const orphans = [...existingConditions].filter(id => !existingGrid.has(id));
  if (orphans.length > 0) {
    console.log(`\n   WARNING: ${orphans.length} orphan cells in grid_conditions_latest (no grid_025deg parent)`);
    console.log(`   Sample: ${orphans.slice(0, 5).join(', ')}`);
  }

  // Step 5: Insert into grid_025deg FIRST (additive, safe — if script crashes, no data lost)
  if (newGridCells.length > 0) {
    console.log(`\n5. Inserting ${newGridCells.length} cells into grid_025deg...`);
    const gridInserted = await insertGridCells(newGridCells);
    console.log(`   Inserted: ${gridInserted}`);
  } else {
    console.log('\n5. No new cells for grid_025deg — skipping.');
  }

  // Step 6: Insert seed rows into grid_conditions_latest (additive, safe)
  if (!SKIP_CONDITIONS && newSeedIds.length > 0) {
    console.log(`\n6. Seeding ${newSeedIds.length} cells into grid_conditions_latest...`);
    const seedInserted = await insertSeedRows(newSeedIds);
    console.log(`   Inserted: ${seedInserted}`);
  } else if (SKIP_CONDITIONS) {
    console.log('\n6. --skip-seed: skipping grid_conditions_latest.');
  } else {
    console.log('\n6. No new cells for grid_conditions_latest — skipping.');
  }

  // Step 7: Clean up non-coastal cells LAST (destructive — new data already safe in DB)
  if (!NO_CLEANUP && (gridToRemoveCount > 0 || conditionsToRemoveCount > 0)) {
    console.log(`\n7. Cleaning up non-coastal cells...`);
    const { gridDeleted, conditionsDeleted, xrefDeleted } = await cleanupNonCoastalCells(
      coastalIdSet,
      existingGrid,
      existingConditions,
    );
    console.log(`\n   Cleanup complete:`);
    console.log(`     grid_conditions_latest: ${conditionsDeleted} removed`);
    console.log(`     grid_025deg_ices_xref:  ${xrefDeleted} removed`);
    console.log(`     grid_025deg:            ${gridDeleted} removed`);
  } else if (NO_CLEANUP) {
    console.log('\n7. Cleanup disabled (--no-cleanup) — skipping.');
  } else {
    console.log('\n7. No non-coastal cells to remove — skipping.');
  }

  // Step 8: Verify
  console.log('\n8. Verification...');
  const { count: gridCount } = await supabase
    .from('grid_025deg')
    .select('cell_id', { count: 'exact', head: true })
    .like('cell_id', 'G025_%');

  const { count: condCount } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id', { count: 'exact', head: true })
    .like('cell_id', 'G025_%');

  console.log(`   grid_025deg total:            ${gridCount}`);
  console.log(`   grid_conditions_latest total: ${condCount}`);
  console.log('\n========================================================');
  console.log('  Done.');
  console.log('========================================================');
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
