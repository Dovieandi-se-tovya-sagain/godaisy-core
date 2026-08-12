import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface as ReadlineInterface } from 'readline';
import * as path from 'path';
import {
  CopernicusProvider,
  CopernicusFetchOptions,
  CopernicusMarineBundle,
  CopernicusTimeseries,
} from './types';
import { getDatasetForCmemsRegion, getDatasetForRegion, type CopernicusDatasetConfig } from './regionRouter';

// ---------------------------------------------------------------------------
// Persistent Python worker (singleton)
// ---------------------------------------------------------------------------

interface WorkerRequest {
  id: string;
  action: 'subset' | 'ping' | 'shutdown';
  dataset_id?: string;
  variables?: string[];
  minimum_longitude?: number;
  maximum_longitude?: number;
  minimum_latitude?: number;
  maximum_latitude?: number;
  start_datetime?: string;
  end_datetime?: string;
  timeout_seconds?: number;
}

interface WorkerResponse {
  id: string;
  ok: boolean;
  data?: {
    datasetId: string;
    variables: string[];
    records: Array<{
      time: string;
      depth: number;
      lat: number;
      lon: number;
      variables: Record<string, number>;
    }>;
    source: string;
  };
  error?: string;
  error_type?: string;
  message?: string;
}

class CopernicusWorker {
  private static instance: CopernicusWorker | null = null;
  private static startingPromise: Promise<CopernicusWorker> | null = null;

  private process: ChildProcess;
  private rl: ReadlineInterface;
  private pending = new Map<string, {
    resolve: (resp: WorkerResponse) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private alive = true;
  private reqCounter = 0;

  private constructor(proc: ChildProcess, rl: ReadlineInterface) {
    this.process = proc;
    this.rl = rl;

    // Route every JSON line from stdout to the matching pending request
    this.rl.on('line', (line: string) => {
      let msg: WorkerResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        console.log(`[worker] non-JSON stdout: ${line}`);
        return;
      }
      const entry = this.pending.get(msg.id);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(msg.id);
        entry.resolve(msg);
      }
    });

    // Forward worker stderr to console for observability
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) console.log(`[worker] ${text}`);
    });

    // Detect crashes
    proc.on('exit', (code: number | null) => {
      this.alive = false;
      console.log(`[worker] process exited with code ${code}`);
      // Clean up readline
      this.rl.removeAllListeners();
      this.rl.close();
      // Reject all pending requests
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error(`Worker exited (code ${code}) while request ${id} was pending`));
      }
      this.pending.clear();
      if (CopernicusWorker.instance === this) {
        CopernicusWorker.instance = null;
        CopernicusWorker.startingPromise = null;
      }
    });
  }

  /** Lazily spawn the worker and wait for it to signal readiness. */
  static getInstance(): Promise<CopernicusWorker> {
    if (CopernicusWorker.instance?.alive) {
      return Promise.resolve(CopernicusWorker.instance);
    }
    if (CopernicusWorker.startingPromise) {
      return CopernicusWorker.startingPromise;
    }

    CopernicusWorker.startingPromise = new Promise<CopernicusWorker>((resolve, reject) => {
      const workerScript = path.join(process.cwd(), 'scripts', 'ingestion', 'copernicus-worker.py');

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const proc = spawn(pythonCmd, [workerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          COPERNICUSMARINE_SERVICE_USERNAME: process.env.COPERNICUS_USERNAME || '',
          COPERNICUSMARINE_SERVICE_PASSWORD: process.env.COPERNICUS_PASSWORD || '',
        },
      });

      const rl = createInterface({ input: proc.stdout! });
      const worker = new CopernicusWorker(proc, rl);

      // Listen for the ready message
      const onLine = (line: string) => {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 'ready' && msg.ok) {
            clearTimeout(readyTimeout);
            rl.removeListener('line', onLine);
            CopernicusWorker.instance = worker;
            resolve(worker);
          }
        } catch {
          // ignore non-JSON during startup
        }
      };
      rl.on('line', onLine);

      // Wait for the ready signal (max 30s)
      const readyTimeout = setTimeout(() => {
        rl.removeListener('line', onLine);
        proc.kill();
        reject(new Error('Worker did not become ready within 30s'));
      }, 30_000);

      proc.on('error', (err: Error) => {
        clearTimeout(readyTimeout);
        reject(new Error(`Failed to spawn worker: ${err.message}`));
      });

      proc.on('exit', (code: number | null) => {
        clearTimeout(readyTimeout);
        if (!CopernicusWorker.instance) {
          reject(new Error(`Worker exited during startup (code ${code})`));
        }
      });
    });

    CopernicusWorker.startingPromise.catch(() => {
      CopernicusWorker.startingPromise = null;
    });

    return CopernicusWorker.startingPromise;
  }

  /** Send a JSON request and return the matching response. */
  sendRequest(req: WorkerRequest, timeoutMs: number): Promise<WorkerResponse> {
    if (!this.alive) {
      return Promise.reject(new Error('Worker is not alive'));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        reject(new Error(`Worker request ${req.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(req.id, { resolve, reject, timer });
      this.process.stdin!.write(JSON.stringify(req) + '\n');
    });
  }

  /** Gracefully shut down the worker. */
  static async shutdown(): Promise<void> {
    const worker = CopernicusWorker.instance;
    if (!worker?.alive) return;

    try {
      worker.process.stdin!.write(JSON.stringify({ id: 'shutdown', action: 'shutdown' }) + '\n');
      // Give it 5s to exit cleanly
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          worker.process.kill();
          resolve();
        }, 5_000);
        worker.process.on('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
    } catch {
      worker.process.kill();
    }
    CopernicusWorker.instance = null;
    CopernicusWorker.startingPromise = null;
  }

  nextId(): string {
    return `req-${++this.reqCounter}`;
  }
}

// Graceful cleanup on signals (best-effort, non-blocking)
process.on('SIGINT', () => { CopernicusWorker.shutdown(); });
process.on('SIGTERM', () => { CopernicusWorker.shutdown(); });

/** Shut down the persistent Python worker. Call this when ingestion is complete. */
export async function shutdownCopernicusWorker(): Promise<void> {
  await CopernicusWorker.shutdown();
}

// ---------------------------------------------------------------------------
// RealCopernicusProvider
// ---------------------------------------------------------------------------

/**
 * Real Copernicus Marine Service provider using a persistent Python worker.
 */
export class RealCopernicusProvider implements CopernicusProvider {
  private region?: string;
  private datasetConfig?: CopernicusDatasetConfig;

  // Circuit breaker for the BGC dataset family (bio, nutrients, carbonate,
  // PFT, plankton). When CMEMS's BGC worker is unavailable for a region,
  // every cell was independently retrying all 5 BGC datasets (2 date
  // fallbacks each, 90-120s worker timeout per attempt) — up to ~17 minutes
  // of pure timeout-waiting per cell, multiplied across hundreds of cells,
  // which is what caused multi-hour ingestion job hangs (see godaisy-core
  // incident: BAL/MED/GLO_AM/GLO_AP regions cancelled after hitting the
  // 6h GitHub Actions job timeout).
  //
  // The ingestion script processes cells in parallel batches (Promise.all,
  // BATCH_SIZE cells at a time, all sharing this cached provider instance —
  // see providerCache in ingest-copernicus-data.ts), so a strict
  // "consecutive failures" counter isn't safe: completion order across a
  // batch is nondeterministic, and a handful of unlucky early completions
  // could trip the breaker even while other in-flight cells in the same
  // batch go on to succeed. Instead this tracks a sliding window of the
  // most recent outcomes and opens the circuit only once a clear majority
  // within that window failed — tolerant of a few flukes, still responsive
  // once a region's BGC worker is genuinely down.
  private static readonly BGC_WINDOW_SIZE = 6;
  private static readonly BGC_FAILURE_THRESHOLD = 5; // 5 of last 6 → open
  private bgcRecentOutcomes: boolean[] = []; // true = had data, false = failed
  private bgcCircuitOpen = false;

  constructor(region?: string) {
    this.region = region;

    if (region) {
      // Try CMEMS region code first (IBI, NWS, BAL, MED, etc.)
      let config = getDatasetForCmemsRegion(region);

      // Fallback to ICES region name mapping
      if (!config) {
        config = getDatasetForRegion(region);
      }

      if (!config) {
        console.warn(`⚠️  No Copernicus dataset found for region: ${region}`);
      } else {
        this.datasetConfig = config;
        console.log(`   📍 Using ${config.region} regional model`);
      }
    }
  }

  async fetchBundle(options: CopernicusFetchOptions): Promise<CopernicusMarineBundle> {
    const { lat, lon, start, end: _end, skipIfNoTemp } = options;

    try {
      console.log(`   🌊 Fetching Copernicus data for (${lat}, ${lon})...`);

      // Use regional datasets if configured, otherwise fall back to global
      // Note: Global Ocean physics data is split into variable-specific datasets (temperature and salinity separate)
      const temperatureDataset = this.datasetConfig?.physics || 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m';
      const salinityDataset = this.datasetConfig?.salinity || 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m';
      const currentsDataset = this.datasetConfig?.currents || 'cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m';
      // Sea-bed temperature. Demersal species live at the bottom, so in a stratified
      // summer column the surface reading is not the water they occupy. This is always
      // requested as an extra variable on a call we already make, never as its own
      // fetch — which product carries it, and under which name, is routed per region
      // (see `bottomTemperature` in regionRouter). Requesting it from a product that
      // lacks it fails that whole call, so regions where it was not confirmed present
      // leave the config unset and simply keep the variable lists they had.
      //
      // The no-config case is not an edge case, it is the majority: getProvider passes
      // undefined for every GLO_AM / GLO_AP / GLO_AF cell (3,568 of the 7,649 in
      // grid_conditions_latest), so datasetConfig is unset and the hardcoded defaults
      // above apply — which ARE the GLO datasets. Route bottom temperature the same way
      // GLO does, or the largest group of cells silently gets nothing. A config that
      // exists but omits bottomTemperature is a deliberate "not available in this
      // region" and is left alone.
      const bottomTemp = this.datasetConfig
        ? this.datasetConfig.bottomTemperature
        : { source: 'mixedLayerDepth' as const, variable: 'tob' as const };
      const temperatureVariables = bottomTemp?.source === 'physics'
        ? ['thetao', bottomTemp.variable]
        : ['thetao'];
      const mldVariables = bottomTemp?.source === 'mixedLayerDepth'
        ? ['mlotst', bottomTemp.variable]
        : ['mlotst'];

      const bioDataset = this.datasetConfig?.biogeochemistry || 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m';
      // Pass [] to let CMEMS return all variables the dataset has.
      // Global bgc-bio only has o2+nppv; nutrients (no3,po4,si,fe) are in bgc-nut,
      // pH is in bgc-car. Regional bundled datasets include everything.
      const bioVariables: string[] = [];
      const transparencyDataset = this.datasetConfig?.transparency || 'cmems_obs-oc_glo_bgc-transp_my_l4-gapfree-multi-4km_P1D';
      const waveDataset = this.datasetConfig?.waves || 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i';

      // Progressive padding strategy for coastal locations
      // OPTIMIZED: Only try 1 padding value for probe, rely on global fallback
      // This reduces timeouts and improves reliability
      const paddings = [0.25]; // degrees (~28km) - single attempt before global fallback

      // Date fallback strategy: try earlier dates when data is unavailable
      // With twice-daily runs, going back more than 1 day is wasteful —
      // older data would already have been fetched by a previous run.
      // Dynamic data (currents/waves): max 1 day back
      const stableDateFallbacks = [0, 1]; // days back for stable data

      // Satellite optical products need a much wider window than model output.
      //
      // Kd490 comes from a daily L3 ocean-colour feed, and cloud decides whether
      // a given pixel has a retrieval that day. Probed 2026-08-10 against the
      // live datasets: the same 0.5-degree window swings from 0% to 95% valid
      // pixels depending on the day. One control cell in the NWS region holds a
      // stored value of 0.1203 yet returned 0 of 43,776 valid pixels when
      // re-requested.
      //
      // With only [0, 1] a cell needed today or yesterday to be clear over that
      // exact spot. A null never overwrites a stored value, so coverage is
      // cumulative: whether a cell has ever caught a clear day, not whether it
      // caught one today. That, not configuration, produced the coverage split
      // measured the same day at equal latitude:
      //
      //     copernicus-NWS  747 cells  99.6%     copernicus-GLO  223 cells  ~43%
      //     copernicus-BAL  413 cells  99.0%     copernicus-MED   89 cells  42.7%
      //
      // NWS and BAL have simply banked more clear days. The regions are not
      // configured differently in any way that matters -- MED is a correctly
      // configured regional 1km L3 product sitting at half of NWS.
      //
      // A week is well within this feed's normal latency, and each extra offset
      // only costs a request when the earlier ones found nothing: the loop
      // breaks on the first success, so a clear cell still costs exactly one.
      //
      // Deliberately NOT applied to the model fetches (temperature, MLD, BGC,
      // nutrients, carbonate, PFT, plankton, waves). Those are gridded model
      // output where a miss usually means land, not cloud, so retrying six more
      // days would multiply requests for no gain.
      const satelliteDateFallbacks = [0, 1, 2, 3, 5, 7];
      const dynamicDateFallbacks = [0, 1]; // days back for dynamic data
      let successfulDate: string = start;
      let daysBack = 0;

      let temperatureData: CopernicusTimeseries | null = null;
      let salinityData: CopernicusTimeseries | null = null;
      let currentsData: CopernicusTimeseries | null = null;
      let mldData: CopernicusTimeseries | null = null;
      let transparencyData: CopernicusTimeseries | null = null;
      let bioData: CopernicusTimeseries | null = null;
      let nutrientData: CopernicusTimeseries | null = null;
      let carbonateData: CopernicusTimeseries | null = null;
      let pftData: CopernicusTimeseries | null = null;
      let planktonData: CopernicusTimeseries | null = null;
      let waveData: CopernicusTimeseries | undefined;

      // Try temperature with date fallback THEN padding
      // Temperature is stable over several days
      for (const dayOffset of stableDateFallbacks) {
        if (temperatureData) break; // Stop if we found data

        // Calculate fallback date
        const fallbackDate = new Date(start);
        fallbackDate.setDate(fallbackDate.getDate() - dayOffset);
        const fallbackDateStr = fallbackDate.toISOString();

        for (const padding of paddings) {
          try {
            temperatureData = await this.fetchAndParse(
              temperatureDataset,
              temperatureVariables,  // thetao, plus `bottomT` where the product carries it
              lat, lon,
              fallbackDateStr, fallbackDateStr,
              padding
            );
            if (temperatureData && this.hasValidData(temperatureData)) {
              daysBack = dayOffset;
              successfulDate = fallbackDateStr;
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Temperature data found with ${padding}° padding (~${Math.round(padding * 111)}km)${ageNote}`);
              break;
            }
            temperatureData = null;
          } catch (err) {
            const isTimeout = err instanceof Error && err.message.includes('timeout');
            const errorType = isTimeout ? '⏱️  Timeout' : '❌ Error';
            const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                 padding === paddings[paddings.length - 1];
            if (isLastAttempt) {
              console.warn(`   ⚠️  No temperature data available after trying ${stableDateFallbacks.length} days × ${paddings.length} paddings (last: ${errorType})`);
            } else if (isTimeout && dayOffset === 0) {
              console.log(`   ⏱️  Timeout at ${padding}° padding, trying next...`);
            }
          }
        }
      }

      // Early exit: if temperature returned nothing and skipIfNoTemp is set,
      // this cell's center is likely on land — skip remaining ~10 API calls (~70s saved)
      if (!temperatureData && skipIfNoTemp) {
        console.log(`   ⏩ No temperature data — skipping remaining variables (land cell)`);
        return {
          physics: { datasetId: '', variables: [], records: [], source: 'copernicus' },
          generatedAt: new Date().toISOString(),
        };
      }

      // Try salinity with same date/padding as temperature
      if (temperatureData) {
        const successfulPadding = paddings.find(_p => temperatureData !== null) || paddings[0];
        try {
          salinityData = await this.fetchAndParse(
            salinityDataset,
            ['so'],
            lat, lon,
            successfulDate, successfulDate,
            successfulPadding
          );
          if (salinityData && this.hasValidData(salinityData)) {
            const ageNote = daysBack > 0 ? ` (${daysBack}d old)` : '';
            console.log(`   ✅ Salinity data found with ${successfulPadding}° padding${ageNote}`);
          }
        } catch (_err) {
          console.warn(`   ⚠️  No salinity data available`);
        }
      }

      // Try currents (max 1 day old) with same padding as temperature
      if (temperatureData) {
        const successfulPadding = paddings.find(_p => temperatureData !== null) || paddings[0];

        // Currents are dynamic - only try current date and 1 day back
        for (const dayOffset of dynamicDateFallbacks) {
          if (currentsData) break;

          const currentsDate = new Date(start);
          currentsDate.setDate(currentsDate.getDate() - dayOffset);
          const currentsDateStr = currentsDate.toISOString();

          try {
            currentsData = await this.fetchAndParse(
              currentsDataset,
              ['uo', 'vo'],
              lat, lon,
              currentsDateStr, currentsDateStr,
              successfulPadding
            );
            if (currentsData && this.hasValidData(currentsData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Currents data found with ${successfulPadding}° padding${ageNote}`);
            }
          } catch (_err) {
            if (dayOffset === dynamicDateFallbacks[dynamicDateFallbacks.length - 1]) {
              console.warn(`   ⚠️  No currents data available`);
            }
          }
        }
      }

      // Try mixed layer depth (mlotst) - 2D variable from separate physics dataset
      // MLD is stable over days (like BGC), so use stableDateFallbacks
      const mldDataset = this.datasetConfig?.mixedLayerDepth || 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m';
      // Narrowed to ['mlotst'] the first time a dataset rejects the bottom-temperature variable.
      // Held outside both loops so that discovery is made once per cell, rather than re-attempting
      // a request already known to be impossible on every remaining padding and date.
      let mldVarsInUse = mldVariables;
      for (const dayOffset of stableDateFallbacks) {
        if (mldData) break;

        const mldDate = new Date(start);
        mldDate.setDate(mldDate.getDate() - dayOffset);
        const mldDateStr = mldDate.toISOString();

        for (const padding of paddings) {
          try {
            mldData = await this.fetchAndParse(
              mldDataset,
              mldVarsInUse,  // mlotst, plus `tob` where a region routes bottom temperature here
              lat, lon,
              mldDateStr, mldDateStr,
              padding
            );
            if (mldData && this.hasValidData(mldData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ MLD (mixed layer depth) data found with ${padding}° padding${ageNote}`);
              break;
            }
            mldData = null;
          } catch (err) {
            // A dataset that does not carry the bottom-temperature variable must not cost us the
            // mixed layer depth as well.
            //
            // Both ride in ONE call, and copernicusmarine fails the entire subset when any requested
            // variable is absent. So before this branch, routing bottom temperature at a product
            // that turned out to lack `tob` would have taken MLD down with it — silently: every
            // error here is swallowed, no truth-check watches MLD, and it feeds only a display card.
            // NWS would have gone from 703 of 800 cells to zero with nothing to say so.
            //
            // The evidence says it should not fire: GLO_AP/AM/AF issue this exact call and return
            // MLD for 3,582 of 3,582 coastal cells, which is impossible if `tob` is missing from
            // the product. It exists because the cost of being wrong is asymmetric — dropping the
            // new variable loses nothing we had, dropping the call loses something we did.
            if (err instanceof Error &&
                err.message.startsWith('VARIABLE_NOT_FOUND:') &&
                mldVarsInUse.length > 1) {
              const dropped = mldVarsInUse.slice(1).join(', ');
              console.warn(`   ⚠️  ${mldDataset} has no '${dropped}' — retrying MLD without it`);
              mldVarsInUse = ['mlotst'];
              try {
                mldData = await this.fetchAndParse(
                  mldDataset,
                  mldVarsInUse,
                  lat, lon,
                  mldDateStr, mldDateStr,
                  padding
                );
                if (mldData && this.hasValidData(mldData)) {
                  const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
                  console.log(`   ✅ MLD found without '${dropped}' at ${padding}° padding${ageNote}`);
                  break;
                }
                mldData = null;
              } catch {
                // The narrowed request failed too. Remaining paddings and dates now use the shorter
                // list, so this cell falls back to the ordinary retry path.
              }
              continue;
            }
            const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                 padding === paddings[paddings.length - 1];
            if (isLastAttempt) {
              console.warn(`   ⚠️  No MLD (mixed layer depth) data available`);
            }
          }
        }
      }

      // Try transparency with date fallback (satellite data - stable, but gaps common)
      if (temperatureData) {
        const successfulPadding = paddings.find(_p => temperatureData !== null) || paddings[0];

        for (const dayOffset of satelliteDateFallbacks) {
          if (transparencyData) break;

          const transDate = new Date(start);
          transDate.setDate(transDate.getDate() - dayOffset);
          const transDateStr = transDate.toISOString();

          try {
            transparencyData = await this.fetchAndParse(
              transparencyDataset,
              ['KD490'],
              lat, lon,
              transDateStr, transDateStr,
              successfulPadding
            );
            if (transparencyData && this.hasValidData(transparencyData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Transparency data (kd490) found with ${successfulPadding}° padding${ageNote}`);
            }
          } catch (_err) {
            if (dayOffset === satelliteDateFallbacks[satelliteDateFallbacks.length - 1]) {
              console.warn(`   ⚠️  No transparency data available (satellite gaps after ${satelliteDateFallbacks.length} days)`);
            }
          }
        }
      }

      // Try biogeochemical with date fallback (BGC is stable over days)
      if (this.bgcCircuitOpen) {
        console.log(`   🔌 BGC circuit open — skipping bio fetch for this cell`);
      }
      for (const dayOffset of stableDateFallbacks) {
        if (bioData || this.bgcCircuitOpen) break;

        const bgcDate = new Date(start);
        bgcDate.setDate(bgcDate.getDate() - dayOffset);
        const bgcDateStr = bgcDate.toISOString();

        for (const padding of paddings) {
          try {
            bioData = await this.fetchAndParse(
              bioDataset,
              bioVariables,
              lat, lon,
              bgcDateStr, bgcDateStr,
              padding
            );
            if (bioData && this.hasValidData(bioData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ BGC data found with ${padding}° padding (~${Math.round(padding * 111)}km)${ageNote}`);
              break;
            }
            bioData = null;
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('VARIABLE_NOT_FOUND:')) {
              console.warn(`   ⚠️  Variable not found in BGC dataset — skipping`);
              break;
            }
            const isTimeout = err instanceof Error && err.message.includes('timeout');
            const errorType = isTimeout ? '⏱️  Timeout' : '❌ Error';
            const errorMsg = err instanceof Error ? err.message : String(err);
            const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                 padding === paddings[paddings.length - 1];
            if (isLastAttempt) {
              console.warn(`   ⚠️  No BGC data available after trying ${stableDateFallbacks.length} days × ${paddings.length} paddings (last: ${errorType})`);
              console.warn(`   📋 BGC Error details: ${errorMsg.substring(0, 200)}`);
            } else if (isTimeout && dayOffset === 0) {
              console.log(`   ⏱️  Timeout at ${padding}° padding, trying next...`);
            }
          }
        }
      }

      // Track BGC availability across cells for this region's run. Cells are
      // processed in parallel batches (see class-level comment above), so
      // this records each cell's own outcome into a sliding window rather
      // than assuming strict ordering — robust to concurrent completions.
      // If a clear majority of recent attempts had no BGC data, the CMEMS
      // BGC worker is almost certainly down for this region — stop burning
      // time retrying it and open the circuit for the rest of the run.
      if (!this.bgcCircuitOpen) {
        this.bgcRecentOutcomes.push(!!bioData);
        if (this.bgcRecentOutcomes.length > RealCopernicusProvider.BGC_WINDOW_SIZE) {
          this.bgcRecentOutcomes.shift();
        }
        const failuresInWindow = this.bgcRecentOutcomes.filter(had => !had).length;
        if (
          this.bgcRecentOutcomes.length >= RealCopernicusProvider.BGC_WINDOW_SIZE &&
          failuresInWindow >= RealCopernicusProvider.BGC_FAILURE_THRESHOLD
        ) {
          this.bgcCircuitOpen = true;
          console.warn(`   🔌 BGC circuit breaker tripped: ${failuresInWindow}/${this.bgcRecentOutcomes.length} of the last cells had no BGC data — skipping BGC (bio/nutrients/carbonate/PFT/plankton) for the rest of this run. Physics data is unaffected.`);
        }
      }

      // Try nutrients (no3, po4, si, fe) - separate dataset for split BGC models (GLO, NWS, MED)
      const nutrientDataset = this.datasetConfig?.nutrients;
      if (nutrientDataset && !this.bgcCircuitOpen) {
        for (const dayOffset of stableDateFallbacks) {
          if (nutrientData) break;

          const nutDate = new Date(start);
          nutDate.setDate(nutDate.getDate() - dayOffset);
          const nutDateStr = nutDate.toISOString();

          for (const padding of paddings) {
            try {
              nutrientData = await this.fetchAndParse(
                nutrientDataset,
                ['no3', 'po4', 'si', 'fe'],
                lat, lon,
                nutDateStr, nutDateStr,
                padding
              );
              if (nutrientData && this.hasValidData(nutrientData)) {
                const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
                console.log(`   ✅ Nutrient data (no3, po4, si, fe) found with ${padding}° padding${ageNote}`);
                break;
              }
              nutrientData = null;
            } catch (err) {
              if (err instanceof Error && err.message.startsWith('VARIABLE_NOT_FOUND:')) {
                console.warn(`   ⚠️  Variable not found in nutrients dataset — skipping`);
                break;
              }
              const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                   padding === paddings[paddings.length - 1];
              if (isLastAttempt) {
                console.warn(`   ⚠️  No nutrient data available`);
              }
            }
          }
        }
      }

      // Try carbonate chemistry (ph) - separate dataset for split BGC models (GLO, NWS, MED)
      const carbonateDataset = this.datasetConfig?.carbonateChemistry;
      if (carbonateDataset && !this.bgcCircuitOpen) {
        for (const dayOffset of stableDateFallbacks) {
          if (carbonateData) break;

          const carDate = new Date(start);
          carDate.setDate(carDate.getDate() - dayOffset);
          const carDateStr = carDate.toISOString();

          for (const padding of paddings) {
            try {
              carbonateData = await this.fetchAndParse(
                carbonateDataset,
                ['ph'],
                lat, lon,
                carDateStr, carDateStr,
                padding
              );
              if (carbonateData && this.hasValidData(carbonateData)) {
                const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
                console.log(`   ✅ Carbonate chemistry (pH) data found with ${padding}° padding${ageNote}`);
                break;
              }
              carbonateData = null;
            } catch (err) {
              if (err instanceof Error && err.message.startsWith('VARIABLE_NOT_FOUND:')) {
                console.warn(`   ⚠️  Variable not found in carbonate dataset — skipping`);
                break;
              }
              const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                   padding === paddings[paddings.length - 1];
              if (isLastAttempt) {
                console.warn(`   ⚠️  No carbonate chemistry data available`);
              }
            }
          }
        }
      }

      // Try PFT (phytoplankton carbon) - separate dataset from bgc-bio
      const pftDataset = this.datasetConfig?.planktonFunctionalTypes || 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m';
      for (const dayOffset of stableDateFallbacks) {
        if (pftData || this.bgcCircuitOpen) break;

        const pftDate = new Date(start);
        pftDate.setDate(pftDate.getDate() - dayOffset);
        const pftDateStr = pftDate.toISOString();

        for (const padding of paddings) {
          try {
            pftData = await this.fetchAndParse(
              pftDataset,
              ['phyc', 'chl'],
              lat, lon,
              pftDateStr, pftDateStr,
              padding
            );
            if (pftData && this.hasValidData(pftData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ PFT (phytoplankton) data found with ${padding}° padding${ageNote}`);
              break;
            }
            pftData = null;
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('VARIABLE_NOT_FOUND:')) {
              console.warn(`   ⚠️  Variable not found in PFT dataset — skipping`);
              break;
            }
            const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                 padding === paddings[paddings.length - 1];
            if (isLastAttempt) {
              console.warn(`   ⚠️  No PFT (phytoplankton) data available`);
            }
          }
        }
      }

      // Try plankton (zooplankton carbon) - separate dataset from bgc-bio
      const planktonDataset = this.datasetConfig?.zooplankton || 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m';
      for (const dayOffset of stableDateFallbacks) {
        if (planktonData || this.bgcCircuitOpen) break;

        const planktonDate = new Date(start);
        planktonDate.setDate(planktonDate.getDate() - dayOffset);
        const planktonDateStr = planktonDate.toISOString();

        for (const padding of paddings) {
          try {
            planktonData = await this.fetchAndParse(
              planktonDataset,
              ['zooc'],
              lat, lon,
              planktonDateStr, planktonDateStr,
              padding
            );
            if (planktonData && this.hasValidData(planktonData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Plankton (zooplankton) data found with ${padding}° padding${ageNote}`);
              break;
            }
            planktonData = null;
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('VARIABLE_NOT_FOUND:')) {
              console.warn(`   ⚠️  Variable not found in plankton dataset — skipping`);
              break;
            }
            const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                 padding === paddings[paddings.length - 1];
            if (isLastAttempt) {
              console.warn(`   ⚠️  No plankton (zooplankton) data available`);
            }
          }
        }
      }

      // Wave data is optional, try with date fallback (max 1 day old)
      for (const dayOffset of dynamicDateFallbacks) {
        if (waveData) break;

        const waveDate = new Date(start);
        waveDate.setDate(waveDate.getDate() - dayOffset);
        const waveDateStr = waveDate.toISOString();

        for (const padding of [0.25]) {
          try {
            waveData = await this.fetchAndParse(
              waveDataset,
              ['VHM0', 'VMDR', 'VTM02'],
              lat, lon,
              waveDateStr, waveDateStr,
              padding
            ) || undefined;
            if (waveData && this.hasValidData(waveData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Wave data found with ${padding}° padding${ageNote}`);
              break;
            }
            waveData = undefined;
          } catch (_err) {
            // Waves are optional, don't warn
          }
        }
      }

      // Merge temperature, salinity, and currents data into single physics timeseries
      let physicsData: CopernicusTimeseries | null = null;
      if (temperatureData) {
        physicsData = temperatureData;
        // Merge salinity variables into the temperature records
        if (salinityData && salinityData.records.length > 0) {
          physicsData.variables = [...physicsData.variables, ...salinityData.variables];
          // Merge variable data for each record
          physicsData.records.forEach((record, idx) => {
            if (salinityData.records[idx]) {
              record.variables = { ...record.variables, ...salinityData.records[idx].variables };
            }
          });
        }
        // Merge currents variables into the physics records
        if (currentsData && currentsData.records.length > 0) {
          physicsData.variables = [...physicsData.variables, ...currentsData.variables];
          // Merge variable data for each record
          physicsData.records.forEach((record, idx) => {
            if (currentsData.records[idx]) {
              record.variables = { ...record.variables, ...currentsData.records[idx].variables };
            }
          });
        }
        // Merge MLD (mlotst) into the physics records
        // mlotst is a 2D variable (no depth) so it only has surface records
        if (mldData && mldData.records.length > 0) {
          physicsData.variables = [...physicsData.variables, ...mldData.variables];
          physicsData.records.forEach((record, idx) => {
            if (mldData!.records[idx]) {
              record.variables = { ...record.variables, ...mldData!.records[idx].variables };
            }
          });
        }
      } else if (mldData && mldData.records.length > 0) {
        // No temperature data but MLD available - use MLD as physics base
        physicsData = mldData;
      }

      // Merge transparency (kd490) into biogeochemical data
      if (transparencyData && transparencyData.records.length > 0) {
        if (bioData) {
          // Merge into existing BGC data
          bioData.variables = [...bioData.variables, ...transparencyData.variables];
          bioData.records.forEach((record, idx) => {
            if (transparencyData.records[idx]) {
              record.variables = { ...record.variables, ...transparencyData.records[idx].variables };
            }
          });
        } else {
          // Use transparency as the BGC data if no other BGC data exists
          bioData = transparencyData;
        }
      }

      // Merge nutrient data (no3, po4, si, fe) into biogeochemical data
      if (nutrientData && nutrientData.records.length > 0) {
        if (bioData) {
          bioData.variables = [...bioData.variables, ...nutrientData.variables];
          bioData.records.forEach((record, idx) => {
            if (nutrientData!.records[idx]) {
              record.variables = { ...record.variables, ...nutrientData!.records[idx].variables };
            }
          });
        } else {
          bioData = nutrientData;
        }
      }

      // Merge carbonate chemistry (ph) into biogeochemical data
      if (carbonateData && carbonateData.records.length > 0) {
        if (bioData) {
          bioData.variables = [...bioData.variables, ...carbonateData.variables];
          bioData.records.forEach((record, idx) => {
            if (carbonateData!.records[idx]) {
              record.variables = { ...record.variables, ...carbonateData!.records[idx].variables };
            }
          });
        } else {
          bioData = carbonateData;
        }
      }

      // Merge PFT (phytoplankton carbon) into biogeochemical data
      if (pftData && pftData.records.length > 0) {
        if (bioData) {
          bioData.variables = [...bioData.variables, ...pftData.variables];
          bioData.records.forEach((record, idx) => {
            if (pftData!.records[idx]) {
              record.variables = { ...record.variables, ...pftData!.records[idx].variables };
            }
          });
        } else {
          bioData = pftData;
        }
      }

      // Merge plankton (zooplankton carbon) into biogeochemical data
      if (planktonData && planktonData.records.length > 0) {
        if (bioData) {
          bioData.variables = [...bioData.variables, ...planktonData.variables];
          bioData.records.forEach((record, idx) => {
            if (planktonData!.records[idx]) {
              record.variables = { ...record.variables, ...planktonData!.records[idx].variables };
            }
          });
        } else {
          bioData = planktonData;
        }
      }

      // Physics data is required, but BGC is optional
      if (!physicsData) {
        throw new Error('No valid physics data found');
      }

      return {
        physics: physicsData,
        biogeochemical: bioData || undefined,  // BGC is optional
        waves: waveData,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`   ❌ Error fetching Copernicus data:`, error);
      throw error;
    }
  }

  private hasValidData(timeseries: CopernicusTimeseries): boolean {
    // Check if we have at least one record with non-null data
    return timeseries.records.length > 0 &&
           timeseries.records.some(r =>
             Object.values(r.variables).some(v => v !== null && v !== undefined && !isNaN(v))
           );
  }

  /**
   * Send a subset request to the persistent Python worker and return the parsed result.
   */
  private async fetchAndParse(
    datasetId: string,
    variables: string[],
    lat: number,
    lon: number,
    start: string,
    end: string,
    padding: number
  ): Promise<CopernicusTimeseries> {
    const worker = await CopernicusWorker.getInstance();

    // Calculate bounding box
    const latMin = lat - padding;
    const latMax = lat + padding;
    const lonMin = lon - padding;
    const lonMax = lon + padding;

    // Format dates for Copernicus API (YYYY-MM-DD)
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    // CI environments need longer timeouts (cold STAC catalogue, auth, download)
    // 90s for initial probe, 120s for larger downloads
    const isProbe = padding <= 0.25;
    const pythonTimeout = isProbe ? 90 : 120; // seconds — passed to worker
    const nodeTimeout = (pythonTimeout + 10) * 1000; // ms — safety net (extra margin for parse + I/O)

    const reqId = worker.nextId();
    const request: WorkerRequest = {
      id: reqId,
      action: 'subset',
      dataset_id: datasetId,
      variables: variables.length > 0 ? variables : undefined,
      minimum_longitude: lonMin,
      maximum_longitude: lonMax,
      minimum_latitude: latMin,
      maximum_latitude: latMax,
      start_datetime: startDate,
      end_datetime: endDate,
      timeout_seconds: pythonTimeout,
    };

    const response = await worker.sendRequest(request, nodeTimeout);

    if (!response.ok) {
      const errMsg = response.error || 'Unknown worker error';
      if (response.error_type === 'timeout') {
        throw new Error(`timeout after ${pythonTimeout}s for ${datasetId}`);
      }
      if (response.error_type === 'variable_not_found') {
        throw new Error(`VARIABLE_NOT_FOUND: ${errMsg}`);
      }
      throw new Error(errMsg);
    }

    if (!response.data) {
      throw new Error('Worker returned ok but no data');
    }

    const data = response.data;
    console.log(`   ℹ️  Parsed ${data.records?.length || 0} records with ${data.variables?.length || 0} variables`);

    return {
      datasetId: data.datasetId,
      variables: data.variables,
      records: data.records,
      source: 'copernicus',
    };
  }
}
