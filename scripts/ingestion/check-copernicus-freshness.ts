#!/usr/bin/env tsx

/**
 * Copernicus Data Freshness Check
 *
 * The Copernicus ingestion workflow (findr-copernicus-ingest.yml) only alerts
 * when its own job reports `failure` or `cancelled`. That misses the exact
 * failure mode that caused BGC data (salinity, chlorophyll, oxygen, nitrate,
 * phosphate) to silently drop to 0% coverage for days in early Aug 2026:
 * the per-region BGC circuit breaker (see src/lib/copernicus/realClient.ts)
 * trips after 3 consecutive empty responses and skips BGC for the rest of
 * that run — which makes the job report `success` even when CMEMS's BGC
 * worker is completely down.
 *
 * This script checks the actual data in `grid_conditions_latest` instead of
 * trusting the job's self-reported status: how many cells were updated in
 * the trailing window, and what fraction of those have non-null physics
 * (surface_temperature_c) and BGC (chlorophyll_mg_m3) values.
 *
 * BGC indicator: chlorophyll_mg_m3, not salinity_psu. salinity_psu is
 * sourced from the *physics* dataset (variable `so`) in this pipeline, not
 * the BGC one — the circuit breaker this check exists to catch only affects
 * BGC fetches, so salinity coverage can stay high through a pure-BGC outage
 * and completely miss it. chlorophyll_mg_m3 is genuinely BGC-only.
 *
 * KNOWN LIMITATION: ingestGridCell's buildNonNullUpdate() (see
 * ingest-copernicus-data.ts) always bumps collected_at/sources on every
 * attempt, but only overwrites a numeric column `if (value !== null)` —
 * deliberately, so a cell that returns currents but not chlorophyll on a
 * given run doesn't lose its last-known chlorophyll reading. That means a
 * cell with a real chlorophyll value from days ago, whose BGC fetch has
 * been silently failing ever since, still reads as "fresh AND has
 * chlorophyll" here: collected_at moves forward every run, chlorophyll_mg_m3
 * never gets nulled out. This check reliably catches a NEW or WIDESPREAD
 * BGC outage (chlorophyll coverage across many cells drops together,
 * dragging the aggregate percentage below threshold) — it will NOT reliably
 * catch a slow, cell-by-cell BGC die-off that started before this script's
 * lookback window and hasn't yet dragged the aggregate below threshold. A
 * fully correct fix needs a separate per-field last-changed timestamp in
 * the schema; out of scope here.
 *
 * Usage:
 *   npx tsx scripts/ingestion/check-copernicus-freshness.ts
 *
 * Environment Variables:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL       - required
 *   SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY      - required
 *   FRESHNESS_WINDOW_HOURS   (default 24)         - trailing window to check
 *   MIN_FRESH_CELLS          (default 800)        - min cells updated in window
 *   MIN_PHYSICS_COVERAGE_PCT (default 85)         - min % of fresh cells with surface_temperature_c
 *   MIN_BGC_COVERAGE_PCT     (default 40)         - min % of fresh cells with chlorophyll_mg_m3
 *
 * Exit code: 0 if all thresholds pass, 1 if any fails OR any threshold env
 * var is set but not a valid number (previously: an invalid value silently
 * became NaN, every comparison against NaN is false, and the script always
 * exited 0 regardless of actual data — the exact "looks like it passed but
 * didn't actually check anything" failure mode this whole script exists to
 * avoid elsewhere).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

function parseThreshold(envVar: string, defaultValue: number): number {
  const raw = process.env[envVar];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.error(`❌ ${envVar} is set to an invalid number: "${raw}"`);
    process.exit(1);
  }
  return parsed;
}

const FRESHNESS_WINDOW_HOURS = parseThreshold('FRESHNESS_WINDOW_HOURS', 24);
const MIN_FRESH_CELLS = parseThreshold('MIN_FRESH_CELLS', 800);
const MIN_PHYSICS_COVERAGE_PCT = parseThreshold('MIN_PHYSICS_COVERAGE_PCT', 85);
const MIN_BGC_COVERAGE_PCT = parseThreshold('MIN_BGC_COVERAGE_PCT', 40);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type Row = {
  salinity_psu: number | null;
  chlorophyll_mg_m3: number | null;
  surface_temperature_c: number | null;
};

async function fetchFreshRows(): Promise<Row[]> {
  const since = new Date(Date.now() - FRESHNESS_WINDOW_HOURS * 3600_000).toISOString();
  const rows: Row[] = [];
  const pageSize = 1000;
  let from = 0;

  // Paginate — grid_conditions_latest can hold several thousand rows and
  // PostgREST caps a single response at 1000 by default.
  for (;;) {
    const { data, error } = await supabase
      .from('grid_conditions_latest')
      .select('salinity_psu, chlorophyll_mg_m3, surface_temperature_c')
      .gt('collected_at', since)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              Copernicus Data Freshness Check                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`Window: trailing ${FRESHNESS_WINDOW_HOURS}h`);
  console.log(`Thresholds: >=${MIN_FRESH_CELLS} fresh cells, >=${MIN_PHYSICS_COVERAGE_PCT}% physics coverage, >=${MIN_BGC_COVERAGE_PCT}% BGC (chlorophyll) coverage\n`);

  const rows = await fetchFreshRows();
  const freshCells = rows.length;
  const physicsCount = rows.filter(r => r.surface_temperature_c !== null).length;
  const salinityCount = rows.filter(r => r.salinity_psu !== null).length;
  const chlorophyllCount = rows.filter(r => r.chlorophyll_mg_m3 !== null).length;

  const pct = (n: number) => (freshCells === 0 ? 0 : (n / freshCells) * 100);
  const physicsPct = pct(physicsCount);
  const salinityPct = pct(salinityCount);
  const chlorophyllPct = pct(chlorophyllCount);

  console.log('📊 RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Cells updated in trailing ${FRESHNESS_WINDOW_HOURS}h: ${freshCells}`);
  console.log(`  Physics (surface_temperature_c): ${physicsCount} (${physicsPct.toFixed(1)}%)`);
  console.log(`  Salinity (salinity_psu, physics-sourced — informational only): ${salinityCount} (${salinityPct.toFixed(1)}%)`);
  console.log(`  Chlorophyll (chlorophyll_mg_m3, BGC-sourced — gates the check): ${chlorophyllCount} (${chlorophyllPct.toFixed(1)}%)\n`);

  const failures: string[] = [];
  if (freshCells < MIN_FRESH_CELLS) {
    failures.push(`Only ${freshCells} cells updated in the trailing ${FRESHNESS_WINDOW_HOURS}h (expected >= ${MIN_FRESH_CELLS}). Ingestion may not be running at all.`);
  }
  if (physicsPct < MIN_PHYSICS_COVERAGE_PCT) {
    failures.push(`Physics coverage is ${physicsPct.toFixed(1)}% of fresh cells (expected >= ${MIN_PHYSICS_COVERAGE_PCT}%). This affects temperature/salinity/currents, not just BGC — likely a broader CMEMS or credentials outage.`);
  }
  if (chlorophyllPct < MIN_BGC_COVERAGE_PCT) {
    failures.push(`BGC (chlorophyll) coverage is ${chlorophyllPct.toFixed(1)}% of fresh cells (expected >= ${MIN_BGC_COVERAGE_PCT}%). This is the exact failure mode from the Aug 2026 outage: the circuit breaker in realClient.ts trips silently and the ingestion job still reports success. (Note: this check can miss a slow, already-in-progress BGC die-off — see the KNOWN LIMITATION comment at the top of this script.)`);
  }

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        STATUS SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (failures.length === 0) {
    console.log('✅ Copernicus data is fresh and BGC coverage looks healthy.\n');
    process.exit(0);
  }

  console.log('❌ FRESHNESS CHECK FAILED\n');
  failures.forEach(f => console.log(`  - ${f}`));
  console.log('');
  process.exit(1);
}

main().catch(err => {
  console.error('\n💥 Script error:', err);
  process.exit(1);
});
