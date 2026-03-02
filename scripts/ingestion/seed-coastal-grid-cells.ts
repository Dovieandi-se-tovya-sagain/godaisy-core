#!/usr/bin/env tsx

/**
 * Seed Coastal Grid Cells
 *
 * Populates grid_conditions_latest with cells from grid_025deg that don't
 * already have an entry. Ensures the Copernicus ingestion pipeline discovers
 * and processes every valid coastal cell.
 *
 * grid_025deg is the FK reference table — every cell_id there is a valid
 * target for grid_conditions_latest.
 *
 * Usage:
 *   npx tsx scripts/ingestion/seed-coastal-grid-cells.ts                     # report only
 *   npx tsx scripts/ingestion/seed-coastal-grid-cells.ts --seed              # seed European + Med coastal cells
 *   npx tsx scripts/ingestion/seed-coastal-grid-cells.ts --seed --all        # seed ALL cells (50k+)
 *   npx tsx scripts/ingestion/seed-coastal-grid-cells.ts --seed --limit=100  # seed first 100
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.cli') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const DO_SEED = process.argv.includes('--seed');
const SEED_ALL = process.argv.includes('--all');
const LIMIT_MATCH = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_MATCH ? parseInt(LIMIT_MATCH.split('=')[1]) : undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Geographic Coastal Filter ──────────────────────────────────────────────
// Defines bounding boxes for known fishing/coastal regions.
// Cells outside these bounds are likely open ocean or inland.
// The Copernicus API will also reject inland cells (no ocean data),
// but pre-filtering avoids wasting ingestion time.

interface BBox {
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

const COASTAL_REGIONS: BBox[] = [
  // ─── Europe ───
  { name: 'North Sea & English Channel', latMin: 48, latMax: 62, lonMin: -6, lonMax: 13 },
  { name: 'Norwegian Coast',             latMin: 57, latMax: 72, lonMin: 4, lonMax: 32 },
  { name: 'Baltic Sea',                  latMin: 53, latMax: 66, lonMin: 9, lonMax: 30 },
  { name: 'Bay of Biscay',              latMin: 43, latMax: 48, lonMin: -10, lonMax: 0 },
  { name: 'Iberian Atlantic',           latMin: 36, latMax: 44, lonMin: -12, lonMax: -5 },
  { name: 'Irish & Celtic Sea',         latMin: 48, latMax: 58, lonMin: -12, lonMax: -5 },
  { name: 'W Scotland & Hebrides',      latMin: 55, latMax: 60, lonMin: -12, lonMax: -4 },
  { name: 'Mediterranean',              latMin: 30, latMax: 46, lonMin: -6, lonMax: 36 },
  { name: 'Black Sea',                  latMin: 40, latMax: 47, lonMin: 27, lonMax: 42 },
  { name: 'Canary Islands',             latMin: 27, latMax: 30, lonMin: -19, lonMax: -13 },
  { name: 'Iceland',                    latMin: 63, latMax: 67, lonMin: -25, lonMax: -12 },

  // ─── Atlantic Americas ───
  { name: 'US East Coast',              latMin: 24, latMax: 46, lonMin: -82, lonMax: -64 },
  { name: 'US Gulf Coast',              latMin: 24, latMax: 31, lonMin: -98, lonMax: -80 },
  { name: 'US West Coast',              latMin: 32, latMax: 49, lonMin: -126, lonMax: -117 },
  { name: 'Caribbean',                  latMin: 10, latMax: 24, lonMin: -90, lonMax: -59 },
  { name: 'Brazil Coast',               latMin: -34, latMax: 5, lonMin: -52, lonMax: -34 },

  // ─── Africa ───
  { name: 'West Africa',                latMin: 4, latMax: 20, lonMin: -20, lonMax: -10 },
  { name: 'South Africa',               latMin: -36, latMax: -26, lonMin: 15, lonMax: 35 },
  { name: 'East Africa',                latMin: -12, latMax: 4, lonMin: 39, lonMax: 51 },

  // ─── Asia-Pacific ───
  { name: 'Japan',                      latMin: 24, latMax: 46, lonMin: 124, lonMax: 147 },
  { name: 'SE Asia',                    latMin: -10, latMax: 20, lonMin: 95, lonMax: 125 },
  { name: 'India',                      latMin: 5, latMax: 24, lonMin: 68, lonMax: 90 },
  { name: 'Persian Gulf',               latMin: 23, latMax: 31, lonMin: 47, lonMax: 57 },

  // ─── Oceania ───
  { name: 'Australia',                  latMin: -44, latMax: -10, lonMin: 112, lonMax: 155 },
  { name: 'New Zealand',                latMin: -48, latMax: -34, lonMin: 166, lonMax: 179 },
];

function isInCoastalRegion(lat: number, lon: number): string | null {
  for (const r of COASTAL_REGIONS) {
    if (lat >= r.latMin && lat <= r.latMax && lon >= r.lonMin && lon <= r.lonMax) {
      return r.name;
    }
  }
  return null;
}

function getSimpleRegion(lat: number, lon: number): string {
  return isInCoastalRegion(lat, lon) || (lat > 66 ? 'Arctic' : 'Open Ocean');
}

function parseCellCenter(cellId: string): { lat: number; lon: number } | null {
  const match = cellId.match(/^G025_([NS])(\d{2})([EW])(\d{3})$/);
  if (!match) return null;
  const [, latH, latD, lonH, lonD] = match;
  return {
    lat: (latH === 'N' ? 1 : -1) * (parseInt(latD, 10) + 0.125),
    lon: (lonH === 'E' ? 1 : -1) * (parseInt(lonD, 10) + 0.125),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('========================================================');
  console.log('  Seed Coastal Grid Cells → grid_conditions_latest');
  console.log('========================================================\n');

  // Step 1: Fetch all cell IDs from grid_025deg (FK reference table)
  console.log('1. Fetching cells from grid_025deg...');

  // Paginate to get all cells (Supabase has row limits)
  const allRefCellIds: string[] = [];
  const PAGE_SIZE = 10000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('grid_025deg')
      .select('cell_id')
      .like('cell_id', 'G025_%')
      .order('cell_id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (offset === 0) {
        console.error('   Failed to query grid_025deg:', error.message);
        process.exit(1);
      }
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRefCellIds.push(...data.map(c => c.cell_id));
      offset += data.length;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }

  console.log(`   Found ${allRefCellIds.length} total cells in grid_025deg`);

  // Step 2: Fetch existing cells from grid_conditions_latest
  console.log('\n2. Fetching existing cells from grid_conditions_latest...');
  const existingIds: string[] = [];
  offset = 0;
  hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('grid_conditions_latest')
      .select('cell_id')
      .like('cell_id', 'G025_%')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) break;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      existingIds.push(...data.map(c => c.cell_id));
      offset += data.length;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }

  const existingSet = new Set(existingIds);
  console.log(`   Found ${existingSet.size} existing cells`);

  // Step 3: Find missing cells
  const allMissing = allRefCellIds.filter(id => !existingSet.has(id));
  console.log(`\n3. Gap analysis:`);
  console.log(`   grid_025deg:              ${allRefCellIds.length} cells`);
  console.log(`   grid_conditions_latest:   ${existingSet.size} cells`);
  console.log(`   Missing:                  ${allMissing.length} cells`);

  // Step 4: Filter to coastal regions (unless --all)
  let targetCells: string[];
  if (SEED_ALL) {
    targetCells = allMissing;
    console.log(`\n4. --all flag: targeting ALL ${targetCells.length} missing cells`);
  } else {
    targetCells = allMissing.filter(id => {
      const coords = parseCellCenter(id);
      return coords && isInCoastalRegion(coords.lat, coords.lon) !== null;
    });
    console.log(`\n4. Coastal filter applied: ${targetCells.length} cells in known fishing regions`);
    console.log(`   (${allMissing.length - targetCells.length} cells filtered out — open ocean/Arctic/inland)`);
  }

  // Step 5: Show geographic distribution
  console.log('\n5. Geographic distribution of target cells:');
  const regionCounts = new Map<string, number>();
  for (const cellId of targetCells) {
    const coords = parseCellCenter(cellId);
    if (coords) {
      const region = getSimpleRegion(coords.lat, coords.lon);
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    }
  }
  for (const [region, count] of [...regionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${region.padEnd(30)} ${count.toString().padStart(6)} cells`);
  }

  // Also show existing distribution
  console.log('\n   Already seeded (for comparison):');
  const existingRegions = new Map<string, number>();
  for (const cellId of existingIds) {
    const coords = parseCellCenter(cellId);
    if (coords) {
      const region = getSimpleRegion(coords.lat, coords.lon);
      existingRegions.set(region, (existingRegions.get(region) || 0) + 1);
    }
  }
  for (const [region, count] of [...existingRegions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${region.padEnd(30)} ${count.toString().padStart(6)} cells`);
  }

  if (targetCells.length === 0) {
    console.log('\n   No cells to seed.');
    return;
  }

  // Show sample cells
  console.log(`\n   Sample target cells (first 10):`);
  for (const cellId of targetCells.slice(0, 10)) {
    const coords = parseCellCenter(cellId);
    if (coords) {
      const region = isInCoastalRegion(coords.lat, coords.lon) || 'Other';
      console.log(`   ${cellId}: (${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}) — ${region}`);
    }
  }

  if (!DO_SEED) {
    console.log('\n   DRY RUN — no changes made.');
    console.log('   Run with --seed to insert cells.');
    console.log('   Run with --seed --all to seed ALL cells (including open ocean).');
    console.log('   Run with --seed --limit=100 to seed first 100 only.');
    return;
  }

  // Step 6: Seed missing cells
  const toSeed = LIMIT ? targetCells.slice(0, LIMIT) : targetCells;
  console.log(`\n6. Seeding ${toSeed.length} cells into grid_conditions_latest...`);

  const BATCH_SIZE = 500;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < toSeed.length; i += BATCH_SIZE) {
    const batch = toSeed.slice(i, i + BATCH_SIZE);
    const rows = batch.map(cellId => ({
      cell_id: cellId,
      collected_at: '1970-01-01T00:00:00.000Z', // epoch 0 — marks as "never collected"
      sources: ['seed'],
    }));

    const { error: insertError } = await supabase
      .from('grid_conditions_latest')
      .insert(rows);

    if (insertError) {
      console.error(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: Failed — ${insertError.message}`);
      // Try one-by-one for this batch to find problematic cells
      for (const row of rows) {
        const { error: singleErr } = await supabase
          .from('grid_conditions_latest')
          .insert(row);
        if (singleErr) {
          failed++;
          if (failed <= 10) {
            console.error(`     ${row.cell_id}: ${singleErr.message}`);
          }
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
      console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: Inserted ${batch.length} cells (total: ${inserted})`);
    }
  }

  console.log(`\n   Done: ${inserted} inserted, ${failed} failed`);

  // Verify final count
  const { count } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id', { count: 'exact', head: true })
    .like('cell_id', 'G025_%');

  console.log(`   Total cells in grid_conditions_latest: ${count}`);
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
