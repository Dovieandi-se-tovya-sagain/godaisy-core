/**
 * Global SST in one request, replacing the per-region 100-cell fetches.
 *
 * WHY THIS EXISTS
 *
 * ingest-noaa-data.yml called the ingest-conditions edge function once per
 * region -- California, Florida, New York, Gulf on the schedule, at 100 grid
 * cells each. That is ~400 cells per run out of 7,649, all of them North
 * American coast, and each cell costs its own ERDDAP round trip.
 *
 * Measured against ERDDAP on 2026-08-09, response time is essentially flat with
 * respect to how much data you ask for, because the cost is server-side
 * queueing rather than transfer:
 *
 *     single point        77.0s   (and it returned 503)
 *     40 x 100 deg box    78.4s      64,561 points
 *     WHOLE GLOBE         81.9s   1,036,800 points   44.9 MB
 *
 * So one request covers every cell the grid has, worldwide, for less than the
 * cost of a handful of single-point lookups. Measured end to end in findr:
 * 16.6s for the fetch, 28.8s for the whole run including a retry.
 *
 * It also removes the cause of the throttling rather than working around it.
 * NOAA returned 403 to every request from two separate repositories on
 * 2026-08-10; cutting request count by three orders of magnitude is what stops
 * that recurring.
 *
 * WHY THE COORDINATES LINE UP EXACTLY
 *
 * OISST is a 0.25-degree grid centred on x.125/x.375/x.625/x.875, and
 * grid_025deg cells are 0.25 degrees with centres on the same eighths. Every
 * cell centre is therefore an exact OISST grid point -- no nearest-neighbour
 * search, no interpolation, no tolerance. Verified in findr: 2,152 of 2,191
 * cells (98.2%) reproduced the per-cell value identically, and every difference
 * traced to the old path having stored an earlier observation date.
 *
 * NOTE ON THE DATASET
 *
 * This uses ncdcOisst21Agg_LonPM180 (0.25 deg) rather than the
 * noaacwBLENDEDsstDaily the edge function uses. That is deliberate: BLENDED is
 * a 5 km product, so a whole-globe request would be ~26 million points, and
 * bulk fetching only works because OISST's resolution matches our grid exactly.
 * The trade is recency -- OISST ran 17 days behind on 2026-08-10 -- so if
 * BLENDED is materially fresher, the honest answer is boxes-with-stride on
 * BLENDED rather than points. Worth measuring once NOAA stops refusing us.
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

const ERDDAP_BASE_URL = 'https://coastwatch.pfeg.noaa.gov/erddap';
const DATASET_ID = 'ncdcOisst21Agg_LonPM180';
const VARIABLE = 'sst';

// Gives NOAA someone to contact rather than something to ban. We are a heavy
// user of a free public research server.
const USER_AGENT =
  'fishfindr.eu marine data ingest (+https://fishfindr.eu; contact: damian@flyglobalmusic.com)';

/**
 * Retry on the transient failures this server produces under load. 502/503 mean
 * "busy, come back", and with only a handful of requests in the whole run there
 * is no risk of a retry storm -- whereas without this a single flaky response
 * kills a job that is otherwise 15 seconds of work. Observed: the .das call
 * 503'd on one attempt and succeeded moments later.
 *
 * Uses the runtime's own fetch rather than axios. This repository does not
 * depend on axios and it is not in the lockfile, so importing it would fail
 * `npm ci` and the job would die at module load before making a single request.
 * Node 20 has fetch, AbortSignal.timeout and web streams built in.
 */
async function fetchWithRetry(url: string, timeoutMs: number, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;

      const retryable = response.status === 502 || response.status === 503 || response.status === 429;
      if (!retryable || i === attempts - 1) {
        throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      // A timeout or network failure is worth one more try; a thrown non-retryable
      // HTTP error above is not, and is rethrown on the final attempt below.
      if (i === attempts - 1) throw error;
    }
    const waitMs = 5000 * Math.pow(2, i); // 5s, 10s, 20s
    console.warn(`   ⏳ ${String(lastError).slice(0, 80)} — retrying in ${waitMs / 1000}s (${i + 1}/${attempts - 1})`);
    await new Promise(r => setTimeout(r, waitMs));
  }
  throw lastError;
}

/** Ask the dataset its most recent available time. */
async function discoverLatestAvailableTime(): Promise<Date | null> {
  const response = await fetchWithRetry(`${ERDDAP_BASE_URL}/griddap/${DATASET_ID}.das`, 60000);
  const match = (await response.text()).match(
    /\btime\s*\{[^}]*?actual_range\s+[\d.eE+-]+,\s*([\d.eE+-]+)/
  );
  if (!match) return null;
  const epochSeconds = parseFloat(match[1]);
  return isFinite(epochSeconds) ? new Date(epochSeconds * 1000) : null;
}

/** Exact key for a 0.25-degree grid point. Three decimals covers x.125 etc. */
function key(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

interface GridCell {
  cell_id: string;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const compare = args.includes('--compare');

  console.log('🌊 NOAA OISST — global bulk fetch\n');
  if (!write) console.log('⚠️  Dry run. Pass --write to update the database.\n');

  // 1. Which cells do we actually want? Building this first means the 45 MB
  //    stream can be discarded as it arrives, keeping only the ~7,600 points
  //    we care about instead of holding a million in memory.
  const { data: allCells, error: gridError } = await supabase
    .from('grid_025deg')
    .select('cell_id, lat_min, lat_max, lon_min, lon_max');

  if (gridError || !allCells) {
    console.error('❌ Could not load grid cells:', gridError);
    process.exit(1);
  }

  const wanted = new Map<string, string>(); // grid-point key -> cell_id
  for (const c of allCells as GridCell[]) {
    const centerLat = (c.lat_min + c.lat_max) / 2;
    const centerLon = (c.lon_min + c.lon_max) / 2;
    wanted.set(key(centerLat, centerLon), c.cell_id);
  }
  console.log(`📍 ${wanted.size} grid cells to fill\n`);

  // 2. One request for the entire globe.
  const latest = await discoverLatestAvailableTime();
  if (!latest) {
    console.error('❌ Could not determine the dataset\'s latest time');
    process.exit(1);
  }
  const t = latest.toISOString();
  const ageDays = (Date.now() - latest.getTime()) / 86400000;
  console.log(`🔎 Dataset latest time: ${t}  (${ageDays.toFixed(1)} days old)`);

  // Same rule and threshold as the ingest-conditions staleness guard, so the
  // two paths cannot disagree about what counts as a usable observation. This
  // is what stops a frozen dataset being ingested as current -- the failure
  // that had erdMH1chlamday writing 2022 values eight times a day.
  const MAX_OBSERVATION_AGE_DAYS = 90;
  if (ageDays > MAX_OBSERVATION_AGE_DAYS) {
    console.error(
      `❌ The dataset's newest observation is ${ageDays.toFixed(0)} days old, beyond the ` +
      `${MAX_OBSERVATION_AGE_DAYS}-day limit. Refusing to write it as current; the dataset has ` +
      `most likely stalled or been retired. Nothing written.`
    );
    process.exit(1);
  }

  if (ageDays > 30) {
    // The freshness view nulls readings past 30 days, so a source this far
    // behind would be ingested and then hidden -- worth saying out loud.
    console.warn('⚠️  Older than the 30-day freshness window; these readings will not be served.');
  }

  const url =
    `${ERDDAP_BASE_URL}/griddap/${DATASET_ID}.csv` +
    `?${VARIABLE}[(${t}):1:(${t})][(0.0):1:(0.0)][(-90):1:(90)][(-180):1:(180)]`;

  console.log('🌐 Fetching the global grid in one request...');
  const started = Date.now();

  const response = await fetchWithRetry(url, 300000);
  if (!response.body) throw new Error('ERDDAP returned no response body');

  const values = new Map<string, number>(); // cell_id -> sst
  let rows = 0;
  let masked = 0;
  let bytes = 0;

  // Stream and split by line as bytes arrive. The full response is ~45 MB and
  // only ~7,600 of its 1,036,800 points are wanted, so nothing is buffered
  // beyond the current line.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let lineNo = 0;

  const consume = (line: string) => {
    bytes += line.length + 1;
    lineNo++;
    if (lineNo <= 2) return; // header row, then units row
    if (!line) return;

    // time,zlev,latitude,longitude,sst
    const parts = line.split(',');
    if (parts.length < 5) return;
    rows++;

    const cellId = wanted.get(key(Number(parts[2]), Number(parts[3])));
    if (!cellId) return; // a point we have no cell for — most of the globe

    const raw = parts[4];
    // ERDDAP writes a masked pixel as an empty field or NaN. Number('') is 0,
    // which is exactly how 705 cells came to report 0 C as a real reading
    // (fixed 90abfc6). Check the text before converting, never after.
    if (raw === '' || raw === 'NaN' || raw === undefined) {
      masked++;
      return;
    }
    const v = Number(raw);
    if (!isFinite(v)) {
      masked++;
      return;
    }
    values.set(cellId, v);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = pending.indexOf('\n')) >= 0) {
      consume(pending.slice(0, nl).replace(/\r$/, ''));
      pending = pending.slice(nl + 1);
    }
  }
  if (pending) consume(pending.replace(/\r$/, ''));

  const elapsed = (Date.now() - started) / 1000;
  console.log(
    `✅ ${(bytes / 1048576).toFixed(1)} MB, ${rows.toLocaleString()} grid points in ${elapsed.toFixed(1)}s`
  );
  console.log(`   Matched ${values.size} of ${wanted.size} cells (${masked} masked/land)\n`);

  const unmatched = wanted.size - values.size - masked;
  if (unmatched > 0) {
    // Not a rounding curiosity: it would mean cell centres that are not OISST
    // grid points, i.e. the exact-key assumption is wrong somewhere.
    console.warn(`⚠️  ${unmatched} cells matched no grid point at all — check the coordinate assumption.`);
  }

  // 3. Compare against what the per-cell path already wrote.
  if (compare) {
    console.log('🔬 Comparing with the values currently in the table...');
    // Segmented by source, because comparing against Copernicus tells us
    // nothing about whether the bulk fetch is correct -- it is a different
    // instrument on a different date. The question this answers is narrow and
    // is the one that matters: where the per-cell OISST path already wrote a
    // value, does the bulk path reproduce it exactly? If the coordinate
    // assumption is wrong, that number will not be 100%.
    const ids = [...values.keys()];
    const stat = {
      oisst: { n: 0, same: 0, worst: 0, cell: '' },
      other: { n: 0, same: 0, worst: 0, cell: '' },
    };
    for (let i = 0; i < ids.length; i += 500) {
      const { data: existing } = await supabase
        .from('grid_conditions_latest')
        .select('cell_id, surface_temperature_c, sources')
        .in('cell_id', ids.slice(i, i + 500));
      for (const row of existing ?? []) {
        const old = row.surface_temperature_c as number | null;
        if (old === null) continue;
        const fresh = values.get(row.cell_id as string)!;
        const isOwn = ((row.sources as string[] | null) ?? []).some(s => s.startsWith(DATASET_ID));
        const b = isOwn ? stat.oisst : stat.other;
        b.n++;
        const d = Math.abs(old - fresh);
        if (d < 0.01) b.same++;
        else if (d > b.worst) { b.worst = d; b.cell = row.cell_id as string; }
      }
    }
    const pct = (b: { n: number; same: number }) => (b.n ? ((100 * b.same) / b.n).toFixed(1) : 'n/a');
    console.log(`   vs per-cell OISST: ${stat.oisst.same}/${stat.oisst.n} identical (${pct(stat.oisst)}%)` +
      (stat.oisst.worst ? `, worst ${stat.oisst.worst.toFixed(3)} C at ${stat.oisst.cell}` : ''));
    console.log(`   vs other sources : ${stat.other.same}/${stat.other.n} identical (${pct(stat.other)}%)` +
      (stat.other.worst ? `, worst ${stat.other.worst.toFixed(3)} C at ${stat.other.cell}` : ''));
    console.log('   (only the first line is a correctness check; the second is two different instruments)\n');
  }

  if (!write) {
    const sample = [...values.entries()].slice(0, 5);
    console.log('Sample:', sample.map(([id, v]) => `${id}=${v.toFixed(2)}C`).join('  '));
    console.log('\nDry run — nothing written.');
    return;
  }

  // 4. Do not overwrite a fresher reading from a better source.
  //
  // grid_conditions_latest is fed by two pipelines. Copernicus GLO_AP covers
  // ~4,700 cells at higher resolution and near-current dates; OISST is 25 km and
  // currently 17 days behind. Upserting OISST blindly would replace yesterday's
  // 29.7 C at a Yellow Sea cell with a 17-day-old 18.9 C and call it an update
  // -- a silent downgrade of thousands of cells, visible to nobody, in exactly
  // the way the fake zeros were.
  //
  // So OISST only writes where it is genuinely an improvement: the cell has no
  // reading, or its reading is older than this observation, or it came from
  // OISST itself (a routine refresh). Skips are counted and reported.
  console.log('🛡️  Checking which cells OISST would actually improve...');
  const candidateIds = [...values.keys()];
  const existingById = new Map<string, { collectedAt: string | null; sources: string[] | null }>();
  for (let i = 0; i < candidateIds.length; i += 500) {
    const { data: rows } = await supabase
      .from('grid_conditions_latest')
      .select('cell_id, collected_at, sources')
      .in('cell_id', candidateIds.slice(i, i + 500));
    for (const r of rows ?? []) {
      existingById.set(r.cell_id as string, {
        collectedAt: (r.collected_at as string | null) ?? null,
        sources: (r.sources as string[] | null) ?? null,
      });
    }
  }

  const observationMs = latest.getTime();
  let skippedFresher = 0;
  const writable = [...values.entries()].filter(([cell_id]) => {
    const e = existingById.get(cell_id);
    if (!e || !e.collectedAt) return true;
    const isOwn = (e.sources ?? []).some(s => s.startsWith(DATASET_ID));
    if (isOwn) return true;
    if (new Date(e.collectedAt).getTime() < observationMs) return true;
    skippedFresher++;
    return false;
  });

  console.log(
    `   ${writable.length} to write, ${skippedFresher} left alone (a fresher reading from another source)\n`
  );

  // Same shape as the per-cell path: collected_at is the OBSERVATION time, and
  // updated_at must be set explicitly or the column default only fires on
  // INSERT and freezes at first write.
  console.log('💾 Writing...');
  const now = new Date().toISOString();
  const payload = writable.map(([cell_id, sst]) => ({
    cell_id,
    collected_at: t,
    surface_temperature_c: sst,
    sources: [`${DATASET_ID}.${VARIABLE}`],
    quality: 'high',
    updated_at: now,
  }));

  let written = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const batch = payload.slice(i, i + 500);
    const { error } = await supabase
      .from('grid_conditions_latest')
      .upsert(batch, { onConflict: 'cell_id' });
    if (error) {
      console.error(`❌ Upsert failed at ${i}:`, error.message);
      process.exit(1);
    }
    written += batch.length;
  }
  console.log(`✅ ${written} cells written in ${((Date.now() - started) / 1000).toFixed(1)}s total`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
