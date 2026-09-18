#!/usr/bin/env tsx
/**
 * Asks whether what we believe about findr_conditions_snapshots is actually true.
 *
 * Ported from findr's scripts/ingestion-truth-check.ts, which watches
 * grid_conditions_latest. This one deliberately watches a DIFFERENT table --
 * running the same assertions twice from two repos would be duplication, and
 * duplication in this pipeline has already cost real money (both repos hammered
 * the same NOAA endpoints until 2026-08-10, when both jobs began failing with
 * 403/429). findr checks the grid; this checks the 324 ICES rectangles that
 * godaisy-core's MET Norway and Open-Meteo ingestion write, which nothing
 * checked at all.
 *
 * The checks are chosen for one property: they compare a belief against
 * evidence, rather than asserting a number someone once guessed.
 *
 * Two live defects motivated this file, both found by hand on 2026-08-11 and
 * both invisible to every check that existed:
 *
 *   Open-Meteo wrote wind_speed_kts as null for every rectangle it covered,
 *   every day, because the marine API carries no wind and the forecast value
 *   was fetched and discarded. 125 rectangles, silent.
 *
 *   next_high_tide_iso, next_low_tide_iso and tide_phase have been null in all
 *   7,000 rows since the table's first day, 2026-07-17, despite a three-tier
 *   WorldTides -> NOAA -> Stormglass waterfall that is supposed to fill them.
 *
 * Both are the same shape: a column that exists, that something is supposed to
 * fill, and that is quietly empty. Check 3 exists to make that shape loud.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type Level = 'pass' | 'warn' | 'fail';
const results: Array<{ level: Level; name: string; detail: string; why?: string }> = [];

function record(level: Level, name: string, detail: string, why?: string) {
  results.push({ level, name, detail, why });
}

/**
 * The fields worth asserting on. Not every column -- only the ones a prediction
 * actually reads, because a check nobody acts on is noise.
 */
const TRACKED_FIELDS = [
  'sea_temp_c',
  'wave_height_m',
  'wind_speed_kts',
  'wind_direction_deg',
  'air_pressure_hpa',
  'cloud_cover_pct',
  'next_high_tide_iso',
  'tide_phase',
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

interface TodayRow {
  rectangle_code: string;
  source: string | null;
  captured_at: string;
  [key: string]: unknown;
}

/**
 * Computed once, at start, and reused.
 *
 * Calling new Date() per use means a run straddling midnight UTC can query one
 * snapshot_day and threshold against the next — the check would then report on
 * a day that had barely begun and call an empty table a failure. The scheduled
 * run is at 09:00 so it is not near the boundary today, but a cron time is a
 * setting someone changes, and this is a fixed cost of one line.
 */
const TODAY = new Date().toISOString().split('T')[0];

async function loadToday(): Promise<TodayRow[]> {
  const { data, error } = await supabase
    .from('findr_conditions_snapshots')
    .select(['rectangle_code', 'source', 'captured_at', ...TRACKED_FIELDS].join(','))
    .eq('snapshot_day', TODAY);

  if (error) throw new Error(`Could not load today's snapshots: ${error.message}`);
  return (data ?? []) as unknown as TodayRow[];
}

/**
 * 1. Did today's ingestion write anything at all?
 *
 * The failure this catches: a run that completes, reports success and stores
 * nothing. On 2026-08-11 the MET job did exactly that for weeks -- it exited
 * non-zero, which is the only reason anyone noticed. A run that failed silently
 * would have looked identical from outside.
 */
function checkRowsWritten(rows: TodayRow[]) {
  record(
    rows.length === 0 ? 'fail' : rows.length < 100 ? 'warn' : 'pass',
    'rows written today',
    `${rows.length} rectangles have a row for ${TODAY}`,
    rows.length === 0
      ? 'nothing has been written today — the ingestion is not running, whatever the workflow says'
      : rows.length < 100
        ? 'far below the ~270 rectangles a healthy day produces'
        : undefined
  );
}

/**
 * 2. Per-source field coverage.
 *
 * Not "did data arrive" but "did each source deliver the fields it delivers".
 * A source that writes N rectangles and fills a field on none of them is the
 * exact signature of the Open-Meteo wind gap: the write succeeded, the row
 * exists, and one column is quietly empty.
 *
 * Deliberately reported rather than thresholded per source. Which source owns
 * which field is a fact about code that changes; encoding it here would make
 * this file wrong the first time a provider moves, and a stale check is worse
 * than none. Check 3 does the failing.
 */
function checkPerSourceCoverage(rows: TodayRow[]) {
  const bySource = new Map<string, TodayRow[]>();
  for (const row of rows) {
    const key = row.source ?? '(null)';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(row);
  }

  for (const [source, sourceRows] of [...bySource.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const filled = TRACKED_FIELDS.map((field) => {
      const n = sourceRows.filter((r) => r[field] !== null && r[field] !== undefined).length;
      return `${field.replace(/_(c|m|kts|deg|hpa|pct|iso)$/, '')} ${n}/${sourceRows.length}`;
    });
    record('pass', `coverage: ${source}`, filled.join(', '));
  }
}

/**
 * 3. Columns that are never filled.
 *
 * The check that would have caught both live defects, and the reason this file
 * exists. It asks the only question that distinguishes "empty today" from
 * "never worked": has this column EVER held a value?
 *
 * A column null in every row the table has ever had is not a gap in today's
 * run. It is a feature that has never once functioned, and the longer it sits
 * the more it looks like intentional absence. Tides have been null in all 7,000
 * rows since 2026-07-17 and nobody knew.
 *
 * "Ever populated but empty today" is a regression and warns. "Never populated"
 * fails, because there is no reading of it that is fine.
 */
async function checkNeverPopulated(rows: TodayRow[]) {
  for (const field of TRACKED_FIELDS) {
    const filledToday = rows.filter((r) => r[field] !== null && r[field] !== undefined).length;

    if (filledToday > 0) {
      record('pass', `field alive: ${field}`, `${filledToday} rectangles carry it today`);
      continue;
    }

    // Empty today. Has it ever held anything? One row is enough to answer.
    const { data, error } = await supabase
      .from('findr_conditions_snapshots')
      .select('snapshot_day')
      .not(field, 'is', null)
      .order('snapshot_day', { ascending: false })
      .limit(1);

    if (error) {
      record('warn', `field alive: ${field}`, `could not check history: ${error.message}`);
      continue;
    }

    if (!data || data.length === 0) {
      record(
        'fail',
        `field alive: ${field}`,
        'never populated, in any row, ever',
        'this column has never held a value — whatever is meant to fill it has never worked, ' +
          'and an empty column looks identical to a field nobody wanted'
      );
    } else {
      record(
        'warn',
        `field alive: ${field}`,
        `empty today; last seen ${data[0].snapshot_day}`,
        'populated before but not today — a source stopped delivering it'
      );
    }
  }
}

/**
 * 4. Physically implausible readings.
 *
 * Catches the fake-value class at the point it appears. Ranges are generous on
 * purpose: a check that fires on real data is worse than no check, and this
 * project has already had a 36 °C Persian Gulf reading flagged as impossible
 * when the Gulf genuinely runs 35-37 °C in August.
 */
function checkImplausible(rows: TodayRow[]) {
  const bad = {
    temp: rows.filter((r) => typeof r.sea_temp_c === 'number' && (r.sea_temp_c < -2.5 || r.sea_temp_c > 40)).length,
    zeroTemp: rows.filter((r) => r.sea_temp_c === 0).length,
    wind: rows.filter((r) => typeof r.wind_speed_kts === 'number' && (r.wind_speed_kts < 0 || r.wind_speed_kts > 120)).length,
    wave: rows.filter((r) => typeof r.wave_height_m === 'number' && (r.wave_height_m < 0 || r.wave_height_m > 25)).length,
    dir: rows.filter((r) => typeof r.wind_direction_deg === 'number' && (r.wind_direction_deg < 0 || r.wind_direction_deg > 360)).length,
  };
  const total = bad.temp + bad.zeroTemp + bad.wind + bad.wave + bad.dir;

  record(
    total === 0 ? 'pass' : 'fail',
    'physically plausible',
    `${bad.zeroTemp} exact-zero temps, ${bad.temp} temp out of range, ${bad.wind} wind out of range, ` +
      `${bad.wave} wave out of range, ${bad.dir} bearing out of range`,
    total > 0
      ? 'a masked or defaulted value stored as a real reading is worse than a missing one — ' +
        'exactly 0.0 °C is the classic signature, real seawater reports about -1.8 when freezing'
      : undefined
  );
}

/**
 * 5. Wind speed sanity in aggregate.
 *
 * Unit errors do not produce impossible values, they produce plausible ones.
 * km/h read as m/s overstates wind by 3.6x and every individual reading still
 * looks like weather. The mean across a whole day of European water is the
 * cheapest thing that would notice: it sits near 10 kn, and a 3.6x error puts
 * it near 40 without any single value tripping check 4.
 */
function checkWindMagnitude(rows: TodayRow[]) {
  const winds = rows.map((r) => r.wind_speed_kts).filter((v): v is number => typeof v === 'number');
  if (!winds.length) {
    record('warn', 'wind magnitude', 'no wind readings today to judge');
    return;
  }
  const mean = winds.reduce((a, b) => a + b, 0) / winds.length;
  const suspicious = mean > 35 || mean < 1;
  record(
    suspicious ? 'warn' : 'pass',
    'wind magnitude',
    `mean ${mean.toFixed(1)} kn across ${winds.length} rectangles`,
    suspicious
      ? 'a whole-day European mean this far from ~10 kn suggests a unit conversion, not weather ' +
        '(km/h read as m/s overstates by 3.6x and every single value still looks plausible)'
      : undefined
  );
}

async function main() {
  console.log('Ingestion truth check — findr_conditions_snapshots\n');

  const rows = await loadToday();

  checkRowsWritten(rows);
  checkPerSourceCoverage(rows);
  await checkNeverPopulated(rows);
  checkImplausible(rows);
  checkWindMagnitude(rows);

  const icon = { pass: '✅', warn: '⚠️ ', fail: '❌' };
  for (const r of results) {
    console.log(`  ${icon[r.level]} ${r.name.padEnd(34)} ${r.detail}`);
    if (r.why) console.log(`        ${r.why}`);
  }

  const fails = results.filter((r) => r.level === 'fail').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log(`\n${results.length - fails - warns}/${results.length} passing, ${warns} warning, ${fails} failing`);

  // Warnings do not fail the build. A source being legitimately slow is not a
  // defect, and a check that cries wolf trains everyone to ignore red — which
  // is how the tide waterfall stayed broken for a month in plain sight.
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
