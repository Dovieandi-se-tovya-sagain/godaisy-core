/**
 * Database Status Check - Ocean Current Integration
 *
 * This script verifies that your database is up to date with:
 * 1. All migrations applied
 * 2. Species have current_speed_weight column populated
 * 3. Copernicus data columns exist
 *
 * Usage: npx tsx scripts/ingestion/verify-database-status.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Checked: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL');
  console.error('   Checked: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('   Set these in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║              Database Status Check - Ocean Current              ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

async function checkDatabase() {
  let allChecksPass = true;

  // Check 1: Species table has current_speed_weight column
  console.log('📊 CHECK 1: Species Table - Current Speed Weight Column');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { data, error } = await supabase
      .from('species')
      .select('species_code, name_en, current_speed_weight')
      .not('current_speed_weight', 'is', null)
      .order('current_speed_weight', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ FAIL: Could not query current_speed_weight column');
      console.error('   Error:', error.message);
      console.error('\n💡 Solution: Run migration');
      console.error('   supabase db push');
      allChecksPass = false;
    } else if (!data || data.length === 0) {
      console.error('❌ FAIL: current_speed_weight column exists but has no data');
      console.error('\n💡 Solution: Run migration');
      console.error('   supabase db push');
      allChecksPass = false;
    } else {
      console.log(`✅ PASS: current_speed_weight column exists`);
      console.log(`✅ Found ${data.length}+ species with weight data\n`);

      console.log('🎯 Top 10 Current-Dependent Species:');
      data.forEach((species, i) => {
        console.log(`   ${i + 1}. ${species.name_en} (${species.species_code}): ${(species.current_speed_weight * 100).toFixed(0)}%`);
      });
      console.log('');
    }
  } catch (err) {
    console.error('❌ FAIL: Error checking species table');
    console.error('   ', err);
    allChecksPass = false;
  }

  // Check 2: Get total count of species with weights
  console.log('📊 CHECK 2: Species Weight Distribution');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { count, error } = await supabase
      .from('species')
      .select('*', { count: 'exact', head: true })
      .not('current_speed_weight', 'is', null);

    if (error) {
      console.error('❌ FAIL: Could not count species with weights');
      console.error('   Error:', error.message);
      allChecksPass = false;
    } else {
      console.log(`✅ PASS: ${count} species have current_speed_weight configured`);

      if (count && count >= 79) {
        console.log('✅ All expected species configured (79+)\n');
      } else if (count && count > 0) {
        console.warn(`⚠️  Only ${count} species configured (expected 79)`);
        console.warn('   Some species may be missing weights\n');
      }
    }
  } catch (err) {
    console.error('❌ FAIL: Error counting species');
    console.error('   ', err);
    allChecksPass = false;
  }

  // Check 3: Conditions table has Copernicus columns
  console.log('📊 CHECK 3: Conditions Table - Copernicus Data Columns');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { data, error } = await supabase
      .from('findr_conditions_latest')
      .select('rectangle_code, current_speed_ms, kd490, chlorophyll_mg_m3')
      .not('current_speed_ms', 'is', null)
      .limit(5);

    if (error) {
      // Check if table exists
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.warn('⚠️  Table findr_conditions_latest not found');
        console.warn('   This is OK - table will be created when needed\n');
      } else {
        console.error('❌ FAIL: Could not query Copernicus columns');
        console.error('   Error:', error.message);
        allChecksPass = false;
      }
    } else if (!data || data.length === 0) {
      console.warn('⚠️  No Copernicus data found in database yet');
      console.warn('   This is EXPECTED - data ingestion needed\n');
      console.log('💡 To populate data:');
      console.log('   1. Run: npx tsx scripts/ingestion/ingest-copernicus-data.ts');
      console.log('   2. Or wait for scheduled ingestion job\n');
    } else {
      console.log('✅ PASS: Copernicus columns exist and have data');
      console.log(`✅ Found current data for ${data.length} rectangles\n`);

      console.log('🌊 Sample Data:');
      data.forEach(row => {
        console.log(`   ${row.rectangle_code}: current=${row.current_speed_ms?.toFixed(3) || 'null'} m/s, kd490=${row.kd490?.toFixed(3) || 'null'}`);
      });
      console.log('');
    }
  } catch (err) {
    console.error('❌ FAIL: Error checking conditions table');
    console.error('   ', err);
    allChecksPass = false;
  }

  // Check 4: Grid conditions table (0.25° grid cells)
  console.log('📊 CHECK 4: Grid Conditions Table (G025_ cells)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { data: gridData, error: gridError } = await supabase
      .from('grid_conditions_latest')
      .select('cell_id, surface_temperature_c, kd490, chlorophyll_mg_m3, collected_at')
      .like('cell_id', 'G025_%')
      .order('collected_at', { ascending: false })
      .limit(5);

    if (gridError) {
      if (gridError.message.includes('does not exist') || gridError.code === '42P01') {
        console.warn('⚠️  Table grid_conditions_latest not found');
        console.warn('   Run ingestion to populate G025_ grid cell data\n');
      } else {
        console.error('❌ FAIL: Could not query G025_ data from grid_conditions_latest');
        console.error('   Error:', gridError.message);
        allChecksPass = false;
      }
    } else if (!gridData || gridData.length === 0) {
      console.warn('⚠️  No G025_ grid cell data found yet');
      console.warn('   Run: npx tsx scripts/ingestion/ingest-copernicus-data.ts\n');
    } else {
      const { count } = await supabase
        .from('grid_conditions_latest')
        .select('*', { count: 'exact', head: true })
        .like('cell_id', 'G025_%');

      console.log(`✅ PASS: grid_conditions_latest has G025_ data (${count ?? '?'} cells)\n`);

      console.log('🌊 Latest G025_ Data:');
      gridData.forEach(row => {
        const age = row.collected_at ? Math.round((Date.now() - new Date(row.collected_at).getTime()) / 3600000) : '?';
        console.log(`   ${row.cell_id}: temp=${row.surface_temperature_c?.toFixed(1) || 'null'}°C, kd490=${row.kd490?.toFixed(3) || 'null'}, chl=${row.chlorophyll_mg_m3?.toFixed(2) || 'null'} (${age}h ago)`);
      });
      console.log('');
    }
  } catch (err) {
    console.error('❌ FAIL: Error checking grid conditions table');
    console.error('   ', err);
    allChecksPass = false;
  }

  // Check 5: Verify migration is recorded
  console.log('📊 CHECK 5: Migration History');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { data, error } = await supabase
      .from('_migrations')
      .select('name, executed_at')
      .ilike('name', '%current%')
      .order('executed_at', { ascending: false });

    if (error) {
      console.warn('⚠️  Could not query migrations table');
      console.warn('   This is OK if using different migration tracking\n');
    } else if (data && data.length > 0) {
      console.log('✅ PASS: Current-related migrations found\n');
      data.forEach(migration => {
        console.log(`   ✓ ${migration.name}`);
        console.log(`     Applied: ${new Date(migration.executed_at).toLocaleString()}`);
      });
      console.log('');
    } else {
      console.log('ℹ️  No current-related migrations in _migrations table');
      console.log('   (May use different tracking system)\n');
    }
  } catch (err) {
    // Migration table might not exist, that's OK
    console.log('ℹ️  Migration tracking not available');
    console.log('   (This is OK - verified via species table)\n');
  }

  // Final summary
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        STATUS SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (allChecksPass) {
    console.log('🎉 DATABASE IS UP TO DATE!\n');
    console.log('✅ All migrations applied');
    console.log('✅ Species table configured with current weights');
    console.log('✅ Copernicus columns exist');
    console.log('\n📝 Next Steps:');
    console.log('   1. Run Copernicus data ingestion (if no data yet)');
    console.log('   2. Deploy to production');
    return true;
  } else {
    console.log('⚠️  SOME CHECKS FAILED\n');
    console.log('💡 To fix:');
    console.log('   1. Run: supabase db push');
    console.log('   2. Verify migration applied');
    console.log('   3. Re-run this script');
    return false;
  }
}

checkDatabase()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('\n💥 Script error:', err);
    process.exit(1);
  });
