#!/usr/bin/env tsx
/**
 * Test script for chlorophyll data ingestion from NOAA ERDDAP erdMH1chlamday dataset
 *
 * Usage:
 *   npx tsx scripts/ingestion/test-chlorophyll-ingestion.ts --california --limit=10
 *   npx tsx scripts/ingestion/test-chlorophyll-ingestion.ts --florida --limit=10
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

// Define regional bounding boxes (same as temperature ingestion)
const bbox: [number, number, number, number] | null = args.includes('--california')
? [-125, 32, -120, 42] // California coast
: args.includes('--florida')
? [-82, 24, -80, 31] // Florida coast
: args.includes('--newyork')
? [-74.5, 40, -71, 42] // New York / Long Island
: args.includes('--gulf')
? [-98, 24, -80, 31] // Gulf of Mexico
: args.includes('--pacific-nw')
? [-125, 42, -122, 49] // Pacific Northwest
: args.includes('--hawaii')
? [-160, 18, -154, 23] // Hawaii
: args.includes('--alaska')
? [-170, 50, -130, 70] // Alaska coast
: args.includes('--canada-west')
? [-135, 48, -120, 60] // Canada West Coast (BC)
: args.includes('--canada-east')
? [-70, 42, -52, 55] // Canada East Coast (Atlantic provinces)
: null;

const regionName = args.includes('--california')
? 'California'
: args.includes('--florida')
? 'Florida'
: args.includes('--newyork')
? 'New York'
: args.includes('--gulf')
? 'Gulf of Mexico'
: args.includes('--pacific-nw')
? 'Pacific Northwest'
: args.includes('--hawaii')
? 'Hawaii'
: args.includes('--alaska')
? 'Alaska'
: args.includes('--canada-west')
? 'Canada West Coast'
: args.includes('--canada-east')
? 'Canada East Coast'
: 'Custom';

if (!bbox) {
  console.error('❌ Please specify a region: --california, --florida, --newyork, --gulf, --pacific-nw, --hawaii, --alaska, --canada-west, or --canada-east');
  process.exit(1);
}

console.log('Region:', regionName);
console.log('Provider: CHLOROPHYLL (erdMH1chlamday)');
console.log('Max cells:', limit);
console.log('');

async function main() {
  console.log('🌊 Calling ingest-conditions Edge Function with CHLOROPHYLL provider\n');

  const payload = {
    bbox,
    providers: ['CHLOROPHYLL'],
    vars: ['chlorophyll_mg_m3'],
    limit,
  };

  console.log('Options:', JSON.stringify(payload, null, 2), '\n');

  const { data, error } = await supabase.functions.invoke('ingest-conditions', {
    body: payload,
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Success! Chlorophyll ingested cells:', data.upserted, '\n');
  console.log('Results:', JSON.stringify(data, null, 2));
  console.log('');

  // Check a sample cell to see if chlorophyll was populated
  if (data.upserted > 0) {
    console.log('\n📊 Checking sample grid cell for chlorophyll data...\n');

    const { data: sample, error: sampleError } = await supabase
      .from('grid_conditions_latest')
      .select('cell_id, chlorophyll_mg_m3, collected_at, sources')
      .contains('sources', ['erdMH1chlamday.chlorophyll'])
      .limit(1)
      .single();

    if (sampleError) {
      console.error('❌ Could not fetch sample:', sampleError);
    } else {
      console.log('Sample cell:', sample.cell_id);
      console.log('Chlorophyll:', sample.chlorophyll_mg_m3, 'mg/m³');
      console.log('Collected at:', sample.collected_at);
      console.log('Sources:', sample.sources);
    }
  }
}

main().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
