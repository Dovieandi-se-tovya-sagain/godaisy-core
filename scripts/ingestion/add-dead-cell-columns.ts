#!/usr/bin/env tsx

/**
 * Migration: Add dead-cell tracking columns to grid_conditions_latest
 *
 * Two-phase migration:
 *   Phase 1 (manual): Run ALTER TABLE in Supabase SQL Editor to add columns
 *   Phase 2 (this script): Flag ~485 known dead cells via REST API
 *
 * Columns added:
 *   - ingestion_failures (integer, default 0) — consecutive failure count, reset on success
 *   - dead_since (timestamptz, nullable) — set when failures >= 20, null = alive
 *
 * Usage:
 *   1. Run the SQL below in Supabase SQL Editor (Dashboard → SQL Editor):
 *
 *      ALTER TABLE grid_conditions_latest
 *        ADD COLUMN IF NOT EXISTS ingestion_failures integer DEFAULT 0;
 *      ALTER TABLE grid_conditions_latest
 *        ADD COLUMN IF NOT EXISTS dead_since timestamptz;
 *
 *   2. Then run this script to flag known dead cells:
 *      npx tsx scripts/ingestion/add-dead-cell-columns.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔧 Migration: Flag dead cells in grid_conditions_latest\n');

  // Step 1: Verify columns exist by querying one row
  console.log('⏳ Checking that ingestion_failures and dead_since columns exist...');
  const { error: checkError } = await supabase
    .from('grid_conditions_latest')
    .select('ingestion_failures, dead_since')
    .limit(1);

  if (checkError) {
    console.error('❌ Columns not found. Please run this SQL in the Supabase SQL Editor first:\n');
    console.error('   ALTER TABLE grid_conditions_latest');
    console.error('     ADD COLUMN IF NOT EXISTS ingestion_failures integer DEFAULT 0;');
    console.error('   ALTER TABLE grid_conditions_latest');
    console.error('     ADD COLUMN IF NOT EXISTS dead_since timestamptz;\n');
    process.exit(1);
  }
  console.log('   ✅ Columns exist\n');

  // Step 2: Find dead cells — seed-only with all data NULL
  console.log('⏳ Finding dead cells (sources = ["seed"], all data NULL)...');
  const { data: deadCells, error: queryError } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id')
    .contains('sources', ['seed'])
    .is('surface_temperature_c', null)
    .is('salinity_psu', null)
    .is('wave_height_m', null)
    .is('chlorophyll_mg_m3', null)
    .lt('ingestion_failures', 20);

  if (queryError) {
    console.error('❌ Failed to query dead cells:', queryError.message);
    process.exit(1);
  }

  if (!deadCells || deadCells.length === 0) {
    console.log('   ✅ No unflagged dead cells found (already migrated?)');
  } else {
    console.log(`   Found ${deadCells.length} dead cells to flag\n`);

    // Step 3: Flag dead cells in batches
    const BATCH = 100;
    let flagged = 0;
    for (let i = 0; i < deadCells.length; i += BATCH) {
      const batch = deadCells.slice(i, i + BATCH);
      const cellIds = batch.map(c => c.cell_id);

      const { error: updateError } = await supabase
        .from('grid_conditions_latest')
        .update({
          ingestion_failures: 20,
          dead_since: new Date().toISOString(),
        })
        .in('cell_id', cellIds);

      if (updateError) {
        console.error(`   ❌ Batch update failed: ${updateError.message}`);
        process.exit(1);
      }

      flagged += cellIds.length;
      console.log(`   ✅ Flagged ${flagged}/${deadCells.length} cells`);
    }
  }

  // Step 4: Verify
  console.log('\n⏳ Verifying...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('grid_conditions_latest')
    .select('cell_id', { count: 'exact', head: true })
    .not('dead_since', 'is', null);

  if (verifyError) {
    console.log('   ⚠️  Could not verify:', verifyError.message);
  } else {
    console.log(`   ✅ ${verifyData?.length ?? 0} cells now flagged as dead`);
  }

  console.log('\n✅ Migration complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
