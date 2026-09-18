#!/usr/bin/env tsx

/**
 * Trim grid_conditions_latest & grid_025deg to population-density-matched tiers.
 *
 * Reduces cell counts so every CMEMS region fits within the 6-hour GitHub
 * Actions timeout (~240 cells/hr ≈ 1,400 cells/job).
 *
 * Usage:
 *   npx tsx scripts/ingestion/trim-grid-density.ts              # DRY RUN (report only)
 *   npx tsx scripts/ingestion/trim-grid-density.ts --apply       # delete cells for real
 *   npx tsx scripts/ingestion/trim-grid-density.ts --apply --skip-grid  # conditions only
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { cmemsRegionFromCoords } from '../../src/lib/copernicus/cmemsRegion';

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

const DO_APPLY = process.argv.includes('--apply');
const SKIP_GRID = process.argv.includes('--skip-grid');

// ─── Cell ID Parsing ─────────────────────────────────────────────────────────

function parseCellCenter(cellId: string): { lat: number; lon: number } | null {
  const m = cellId.match(/^G025_([NS])(\d{4})([EW])(\d{5})$/);
  if (!m) return null;
  const latMax = parseInt(m[2], 10) / 100;
  const lonMax = parseInt(m[4], 10) / 100;
  const lat = (m[1] === 'S' ? -latMax : latMax) - 0.125;
  const lon = (m[3] === 'W' ? -lonMax : lonMax) - 0.125;
  return { lat, lon };
}

// ─── Deterministic Hash (consistent across runs) ────────────────────────────

function hashCellId(cellId: string): number {
  let h = 0;
  for (let i = 0; i < cellId.length; i++) {
    h = ((h << 5) - h + cellId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) / 2147483647;
}

// ─── CMEMS Region Assignment ────────────────────────────────────────────────
// Now genuinely shared with ingest-copernicus-data.ts rather than hand-copied. The header here
// used to claim the two matched; they had diverged — this copy carried a Black Sea box placed
// after MED (so mostly shadowed), and the ingest copy carried none at all.

const getCmemsRegion = (lat: number, lon: number): string => cmemsRegionFromCoords(lat, lon);

// ─── Sub-region Classification ──────────────────────────────────────────────

function getSubRegion(lat: number, lon: number, region: string): string {
  if (region === 'GLO_AP') {
    if (lat >= 30 && lat <= 46 && lon >= 128 && lon <= 146) return 'Japan';
    if (lat >= 33 && lat <= 39 && lon >= 124 && lon <= 130) return 'S.Korea';
    if (lat >= 18 && lat <= 42 && lon >= 105 && lon <= 125) return 'China';
    if (lat >= 5 && lat <= 20 && lon >= 117 && lon <= 127) return 'Philippines';
    if (lat >= 8 && lat <= 24 && lon >= 100 && lon <= 110) return 'Vietnam';
    if (lat >= -8 && lat <= 8 && lon >= 95 && lon <= 120) return 'Malaysia/Indonesia(W)';
    if (lat >= -45 && lat <= -33 && lon >= 148 && lon <= 155) return 'SE Australia';
    if (lat >= -44 && lat <= -40 && lon >= 144 && lon <= 149) return 'Tasmania';
    if (lat >= -28 && lat <= -10 && lon >= 142 && lon <= 155) return 'NE Australia';
    if (lat >= -35 && lat <= -20 && lon >= 112 && lon <= 136) return 'S/W Australia';
    if (lat >= -35 && lat <= -31 && lon >= 114 && lon <= 116) return 'Perth';
    if (lat >= -20 && lat <= -10 && lon >= 128 && lon <= 142) return 'N Australia';
    if (lat >= -48 && lat <= -34 && lon >= 165 && lon <= 179) return 'New Zealand';
    if (lat >= 40 && lat <= 66 && lon >= 130 && lon <= 180) return 'Russia Pacific';
    if (lat >= -10 && lat <= 5 && lon >= 120 && lon <= 160) return 'Indonesia(E)/PNG';
    return 'Pacific other';
  }

  if (region === 'GLO_AF') {
    if (lat >= 12 && lat <= 30 && lon >= 32 && lon <= 44) return 'Red Sea';
    if (lat >= 23 && lat <= 31 && lon >= 44 && lon <= 57) return 'Persian Gulf';
    if (lat >= 36 && lat <= 42 && lon >= 26 && lon <= 42) return 'Turkey/BS east';
    if (lat >= 28 && lat <= 36 && lon >= -10 && lon <= -1) return 'Morocco';
    if (lat >= 5 && lat <= 15 && lon >= -18 && lon <= 0) return 'W Africa';
    if (lat >= -5 && lat <= 5 && lon >= -12 && lon <= 12) return 'W Africa equatorial';
    if (lat >= -35 && lat <= -22 && lon >= 15 && lon <= 35) return 'South Africa';
    if (lat >= -12 && lat <= 0 && lon >= 38 && lon <= 52) return 'E Africa (Moz/Tz)';
    if (lat >= 0 && lat <= 12 && lon >= 40 && lon <= 52) return 'E Africa (Kenya/Somalia)';
    if (lat >= -26 && lat <= -12 && lon >= 30 && lon <= 52) return 'Madagascar';
    if (lat >= 8 && lat <= 23 && lon >= 68 && lon <= 78) return 'India west';
    if (lat >= 5 && lat <= 22 && lon >= 78 && lon <= 90) return 'India east/Sri Lanka';
    if (lat >= 22 && lat <= 28 && lon >= 60 && lon <= 70) return 'Pakistan/NW India';
    if (lat >= 12 && lat <= 28 && lon >= 56 && lon <= 68) return 'Arabian Sea';
    if (lat >= 36 && lat <= 48 && lon >= 46 && lon <= 55) return 'Caspian';
    if (lat >= 10 && lat <= 40 && lon >= -25 && lon <= -10) return 'Atlantic islands';
    return 'AF other';
  }

  if (region === 'GLO_AM') {
    if (lat >= 25 && lat <= 45 && lon >= -82 && lon <= -65) return 'US East';
    if (lat >= 25 && lat <= 31 && lon >= -98 && lon <= -82) return 'US Gulf';
    if (lat >= 32 && lat <= 49 && lon >= -130 && lon <= -117) return 'US/CA Pacific';
    if (lat >= 10 && lat <= 28 && lon >= -90 && lon <= -58) return 'Caribbean';
    if (lat >= 18 && lat <= 22 && lon >= -161 && lon <= -154) return 'Hawaii';
    if (lat >= -25 && lat <= 0 && lon >= -50 && lon <= -34) return 'Brazil populated';
    if (lat >= 7 && lat <= 20 && lon >= -92 && lon <= -77) return 'Central America';
    if (lat >= 43 && lat <= 52 && lon >= -68 && lon <= -52) return 'Canada Atlantic';
    if (lat >= -56 && lat <= -25 && lon >= -80 && lon <= -60) return 'S America south';
    if (lat >= 52 && lat <= 66 && lon >= -180 && lon <= -50) return 'Canada far north';
    return 'AM other';
  }

  if (region === 'ARC') {
    if (lat >= 66 && lat <= 72 && lon >= 5 && lon <= 32) return 'N.Norway';
    if (lat >= 63 && lat <= 67 && lon >= -25 && lon <= -12) return 'Iceland';
    return 'ARC other';
  }

  return region;
}

// ─── Density Tiers (population-matched) ─────────────────────────────────────

const DENSITY_TIERS: Record<string, number> = {
  // GLO_AP — Asia-Pacific
  'Japan': 1.0, 'S.Korea': 1.0, 'SE Australia': 1.0, 'Perth': 1.0,
  'Tasmania': 0.5,
  'China': 0.33, 'New Zealand': 0.33,
  'Philippines': 0.2, 'Vietnam': 0.2, 'NE Australia': 0.2,
  'Malaysia/Indonesia(W)': 0.125,
  'Russia Pacific': 0, 'Indonesia(E)/PNG': 0, 'S/W Australia': 0,
  'N Australia': 0, 'Pacific other': 0,

  // GLO_AF — Africa, Middle East, Indian Ocean
  'South Africa': 1.0, 'Persian Gulf': 1.0,
  'Red Sea': 0.5, 'W Africa': 0.5, 'India west': 0.5,
  'India east/Sri Lanka': 0.33,
  'Turkey/BS east': 0.25, 'Morocco': 0.25, 'Arabian Sea': 0.25, 'Pakistan/NW India': 0.25,
  'E Africa (Moz/Tz)': 0.125, 'E Africa (Kenya/Somalia)': 0.125,
  'W Africa equatorial': 0.125, 'Atlantic islands': 0.125, 'Caspian': 0.125,
  'Madagascar': 0, 'AF other': 0,

  // GLO_AM — Americas
  'US East': 1.0, 'US Gulf': 1.0, 'US/CA Pacific': 1.0,
  'Caribbean': 0.5, 'Hawaii': 0.5,
  'Brazil populated': 0.2, 'Central America': 0.2,
  'Canada Atlantic': 0.125,
  'S America south': 0, 'Canada far north': 0, 'AM other': 0,

  // ARC — Arctic
  'N.Norway': 1.0, 'Iceland': 1.0,
  'ARC other': 0,
};

// European regions always kept (not in density map = always keep)

// ─── Batch Delete (from generate-coastal-grid.ts) ───────────────────────────

async function deleteCellsBatched(table: string, cellIds: string[]): Promise<number> {
  const BATCH_SIZE = 200;
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

// ─── Paginated Fetch ────────────────────────────────────────────────────────

async function fetchAllCellIds(table: string): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('cell_id')
      .like('cell_id', 'G025_%')
      .range(offset, offset + limit - 1);

    if (error) { console.error(`Fetch ${table} error:`, error.message); break; }
    if (!data || data.length === 0) break;
    ids.push(...data.map((r: { cell_id: string }) => r.cell_id));
    offset += limit;
  }
  return ids;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n┌────────────────────────────────────────────┐`);
  console.log(`│  Trim Grid Density — ${DO_APPLY ? 'APPLY MODE' : 'DRY RUN (add --apply)'}  │`);
  console.log(`└────────────────────────────────────────────┘\n`);

  // 1. Fetch all cells from grid_conditions_latest
  console.log('Fetching cells from grid_conditions_latest...');
  const conditionsCells = await fetchAllCellIds('grid_conditions_latest');
  console.log(`  Found ${conditionsCells.length} G025_ cells\n`);

  // 2. Classify each cell
  const toRemove: string[] = [];
  const toKeep: string[] = [];
  const regionStats: Record<string, { total: number; keep: number; remove: number }> = {};

  for (const cellId of conditionsCells) {
    const coords = parseCellCenter(cellId);
    if (!coords) { toKeep.push(cellId); continue; }

    const region = getCmemsRegion(coords.lat, coords.lon);

    if (!regionStats[region]) regionStats[region] = { total: 0, keep: 0, remove: 0 };
    regionStats[region].total++;

    // European regions always kept
    if (['MED', 'BLK', 'BAL', 'NWS', 'IBI'].includes(region)) {
      regionStats[region].keep++;
      toKeep.push(cellId);
      continue;
    }

    const subRegion = getSubRegion(coords.lat, coords.lon, region);
    const tier = DENSITY_TIERS[subRegion] ?? 0;

    if (tier >= 1.0) {
      regionStats[region].keep++;
      toKeep.push(cellId);
    } else if (tier <= 0) {
      regionStats[region].remove++;
      toRemove.push(cellId);
    } else {
      if (hashCellId(cellId) < tier) {
        regionStats[region].keep++;
        toKeep.push(cellId);
      } else {
        regionStats[region].remove++;
        toRemove.push(cellId);
      }
    }
  }

  // 3. Report
  const CELLS_PER_HOUR = 240;
  const regionOrder = ['IBI', 'BLK', 'BAL', 'NWS', 'MED', 'ARC', 'GLO_AM', 'GLO_AP', 'GLO_AF'];

  console.log('Per-region breakdown:');
  console.log('  Region     Total   Keep  Remove  Est.Time');
  console.log('  ────────   ─────  ─────  ──────  ────────');
  for (const r of regionOrder) {
    const s = regionStats[r];
    if (!s) continue;
    const hours = (s.keep / CELLS_PER_HOUR).toFixed(1);
    const flag = s.keep > 1400 ? ' ⚠ OVER 6h' : '';
    console.log(
      `  ${r.padEnd(10)} ${String(s.total).padStart(5)}  ${String(s.keep).padStart(5)}  ${String(s.remove).padStart(6)}  ~${hours}h${flag}`
    );
  }

  console.log(`\n  TOTAL      ${conditionsCells.length}  ${toKeep.length}  ${toRemove.length}`);

  if (toRemove.length === 0) {
    console.log('\nNo cells to remove. Done.');
    return;
  }

  if (!DO_APPLY) {
    console.log('\n  DRY RUN — no changes made. Add --apply to execute.\n');
    return;
  }

  // 4. Delete from grid_conditions_latest (FK child 1)
  console.log(`\n── Step 1: Removing ${toRemove.length} cells from grid_conditions_latest ──`);
  const conditionsDeleted = await deleteCellsBatched('grid_conditions_latest', toRemove);
  console.log(`   Deleted: ${conditionsDeleted}\n`);

  if (!SKIP_GRID) {
    // 5. Fetch grid_025deg cells to see which of our removed cells exist there
    console.log('── Step 2: Checking grid_025deg for matching cells ──');
    const gridCells = new Set(await fetchAllCellIds('grid_025deg'));
    const gridToRemove = toRemove.filter(id => gridCells.has(id));
    console.log(`   Found ${gridToRemove.length} of ${toRemove.length} in grid_025deg`);

    if (gridToRemove.length > 0) {
      // 6. Delete from xref (FK child 2)
      console.log(`\n── Step 3: Removing xref entries from grid_025deg_ices_xref ──`);
      const xrefDeleted = await deleteCellsBatched('grid_025deg_ices_xref', gridToRemove);
      console.log(`   Deleted: ${xrefDeleted}`);

      // 7. Delete from grid_025deg (FK parent)
      console.log(`\n── Step 4: Removing ${gridToRemove.length} cells from grid_025deg ──`);
      const gridDeleted = await deleteCellsBatched('grid_025deg', gridToRemove);
      console.log(`   Deleted: ${gridDeleted}`);
    }
  }

  // 8. Verify final counts
  console.log('\n── Verification ──');
  const { count: finalConditions } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id', { count: 'exact', head: true })
    .like('cell_id', 'G025_%');

  const { count: finalGrid } = await supabase
    .from('grid_025deg')
    .select('cell_id', { count: 'exact', head: true });

  console.log(`   grid_conditions_latest G025_ cells: ${finalConditions}`);
  console.log(`   grid_025deg total cells:            ${finalGrid}`);
  console.log('\nDone!\n');
}

main().catch(console.error);
