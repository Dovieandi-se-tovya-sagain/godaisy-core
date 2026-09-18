#!/usr/bin/env tsx

/**
 * Fix ICES Rectangle Data
 *
 * Two fixes:
 * 1. Populate/correct cmems_region for all rectangles based on lat/lon + region name
 * 2. Un-flag inland rectangles that are incorrectly marked as is_coastal_fishing_zone
 *
 * Usage:
 *   npx tsx scripts/ingestion/fix-rectangle-data.ts
 *   npx tsx scripts/ingestion/fix-rectangle-data.ts --dry-run   # preview only
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { cmemsRegionFromCoords } from '../../src/lib/copernicus/cmemsRegion';

// Try .env.local first, then .env.cli
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.cli') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CMEMS Region Assignment ─────────────────────────────────────────────────

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

  // Geographic bounds fallback — shared with the ingestion scripts, which is where the Black
  // Sea box was missing entirely. This copy matters less because its caller passes a real ICES
  // region name (`rect.region || ''`), so the name branches above usually fire first, but it
  // had the same hole.
  //
  // splitGlobal: false preserves this script's single 'GLO' value. The ingestion scripts want
  // the GLO_AM/GLO_AP/GLO_AF split their CI matrix schedules on; the values already stored by
  // this one are 'GLO', and changing that would be a data migration, not a refactor.
  return cmemsRegionFromCoords(lat, lon, { splitGlobal: false });
}

// ─── Inland Detection ────────────────────────────────────────────────────────
// Known inland bounding boxes where ICES rectangle centers fall on land
// These will never have Copernicus ocean data

function isLikelyInland(lat: number, lon: number, region: string): boolean {
  const r = region.toLowerCase();

  // Finnish inland (Gulf of Bothnia interior / lake regions)
  // Lat 60-64, Lon 24-30 is mostly inland Finland
  if (r.includes('finnish') && lon > 24 && lat > 60 && lat < 65) return true;

  // Turkish inland (Anatolian interior)
  if (r.includes('turkish') && !r.includes('black') && !r.includes('mediterranean') && lon > 30 && lat > 37 && lat < 42) return true;

  // Generic: if distance_to_shore_km > 50, it's probably inland or misclassified
  // (handled separately via the distance data)

  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          Fix ICES Rectangle Data (regions + coastal flags)       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — no changes will be written\n');
  }

  // Fetch all rectangles
  const { data: rectangles, error } = await supabase
    .from('ices_rectangles')
    .select('rectangle_code, region, center_lat, center_lon, cmems_region, is_coastal_fishing_zone, distance_to_shore_km')
    .order('rectangle_code');

  if (error || !rectangles) {
    console.error('❌ Failed to fetch rectangles:', error);
    process.exit(1);
  }

  console.log(`📥 Found ${rectangles.length} rectangles\n`);

  // Also fetch distance-to-shore data from staging table
  const { data: distanceData } = await supabase
    .from('ices_coastal_samples_staging')
    .select('rectangle_code, distance_to_shore_km, is_coastal');

  const distanceMap = new Map(
    distanceData?.map(d => [d.rectangle_code, d.distance_to_shore_km || 0]) || []
  );

  // ─── Fix 1: CMEMS regions ───
  console.log('🗺️  FIX 1: Populating/correcting cmems_region...\n');

  const regionChanges: Array<{ code: string; old: string | null; new_: string }> = [];
  const regionCounts = new Map<string, number>();

  for (const rect of rectangles) {
    const correctRegion = getCmemsRegion(rect.region || '', rect.center_lat, rect.center_lon);
    regionCounts.set(correctRegion, (regionCounts.get(correctRegion) || 0) + 1);

    if (rect.cmems_region !== correctRegion) {
      regionChanges.push({ code: rect.rectangle_code, old: rect.cmems_region, new_: correctRegion });
    }
  }

  // Show distribution
  console.log('📊 Region distribution:');
  for (const [region, count] of [...regionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${region.padEnd(4)} ${count.toString().padStart(4)} rectangles`);
  }
  console.log();

  if (regionChanges.length === 0) {
    console.log('✅ All cmems_region values are already correct\n');
  } else {
    console.log(`🔧 ${regionChanges.length} rectangles need cmems_region update:`);
    for (const c of regionChanges.slice(0, 20)) {
      console.log(`   ${c.code}: ${c.old || '(empty)'} → ${c.new_}`);
    }
    if (regionChanges.length > 20) {
      console.log(`   ... and ${regionChanges.length - 20} more`);
    }
    console.log();

    if (!DRY_RUN) {
      let updated = 0;
      for (const c of regionChanges) {
        const { error: updateErr } = await supabase
          .from('ices_rectangles')
          .update({ cmems_region: c.new_ })
          .eq('rectangle_code', c.code);
        if (!updateErr) updated++;
      }
      console.log(`✅ Updated ${updated}/${regionChanges.length} rectangles\n`);
    }
  }

  // ─── Fix 2: Un-flag inland rectangles ───
  console.log('🏔️  FIX 2: Checking for inland rectangles marked as coastal fishing zones...\n');

  const inlandFixes: Array<{ code: string; lat: number; lon: number; region: string; dist: number }> = [];

  for (const rect of rectangles) {
    if (!rect.is_coastal_fishing_zone) continue;

    const dist = distanceMap.get(rect.rectangle_code) ?? rect.distance_to_shore_km ?? 0;
    const inland = isLikelyInland(rect.center_lat, rect.center_lon, rect.region || '');

    // Flag if: explicitly inland OR distance > 50km (clearly not coastal fishing)
    if (inland || dist > 50) {
      inlandFixes.push({
        code: rect.rectangle_code,
        lat: rect.center_lat,
        lon: rect.center_lon,
        region: rect.region || '(unknown)',
        dist,
      });
    }
  }

  if (inlandFixes.length === 0) {
    console.log('✅ No inland rectangles found with is_coastal_fishing_zone = true\n');
  } else {
    console.log(`🔧 ${inlandFixes.length} inland rectangles to un-flag:`);
    for (const f of inlandFixes) {
      console.log(`   ${f.code}: (${f.lat}, ${f.lon}) dist=${f.dist}km region="${f.region}"`);
    }
    console.log();

    if (!DRY_RUN) {
      let fixed = 0;
      for (const f of inlandFixes) {
        const { error: fixErr } = await supabase
          .from('ices_rectangles')
          .update({ is_coastal_fishing_zone: false })
          .eq('rectangle_code', f.code);
        if (!fixErr) fixed++;
      }
      console.log(`✅ Un-flagged ${fixed}/${inlandFixes.length} inland rectangles\n`);
    }
  }

  // Summary
  const coastalCount = rectangles.filter(r => r.is_coastal_fishing_zone).length - inlandFixes.length;
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                           SUMMARY                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 cmems_region changes: ${regionChanges.length}`);
  console.log(`🏔️  Inland rectangles un-flagged: ${inlandFixes.length}`);
  console.log(`🎣 Remaining coastal fishing zones: ~${coastalCount}`);
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — re-run without --dry-run to apply changes`);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
