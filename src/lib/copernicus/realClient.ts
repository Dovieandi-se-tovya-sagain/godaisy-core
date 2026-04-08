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
    const { lat, lon, start, end: _end } = options;

    try {
      console.log(`   🌊 Fetching Copernicus data for (${lat}, ${lon})...`);

      // Use regional datasets if configured, otherwise fall back to global
      // Note: Global Ocean physics data is split into variable-specific datasets (temperature and salinity separate)
      const temperatureDataset = this.datasetConfig?.physics || 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m';
      const salinityDataset = this.datasetConfig?.salinity || 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m';
      const currentsDataset = this.datasetConfig?.currents || 'cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m';
      const bioDataset = this.datasetConfig?.biogeochemistry || 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m';
      const transparencyDataset = this.datasetConfig?.transparency || 'cmems_obs-oc_glo_bgc-transp_my_l4-gapfree-multi-4km_P1D';
      const waveDataset = this.datasetConfig?.waves || 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i';

      // Progressive padding strategy for coastal locations
      // OPTIMIZED: Only try 1 padding value for probe, rely on global fallback
      // This reduces timeouts and improves reliability
      const paddings = [0.25]; // degrees (~28km) - single attempt before global fallback

      // Date fallback strategy: try earlier dates when data is unavailable
      // Stable data (temp/salinity/BGC/transparency): up to 3 days back
      // Dynamic data (currents/waves): max 1 day back
      const stableDateFallbacks = [0, 1, 2, 3]; // days back for stable data
      const dynamicDateFallbacks = [0, 1]; // days back for dynamic data
      let successfulDate: string = start;
      let daysBack = 0;

      let temperatureData: CopernicusTimeseries | null = null;
      let salinityData: CopernicusTimeseries | null = null;
      let currentsData: CopernicusTimeseries | null = null;
      let mldData: CopernicusTimeseries | null = null;
      let transparencyData: CopernicusTimeseries | null = null;
      let bioData: CopernicusTimeseries | null = null;
      let pftData: CopernicusTimeseries | null = null;
      let planktonData: CopernicusTimeseries | null = null;
      let ppData: CopernicusTimeseries | null = null;
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
              ['thetao'],
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
      for (const dayOffset of stableDateFallbacks) {
        if (mldData) break;

        const mldDate = new Date(start);
        mldDate.setDate(mldDate.getDate() - dayOffset);
        const mldDateStr = mldDate.toISOString();

        for (const padding of paddings) {
          try {
            mldData = await this.fetchAndParse(
              mldDataset,
              ['mlotst'],
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

        for (const dayOffset of stableDateFallbacks) {
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
            if (dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1]) {
              console.warn(`   ⚠️  No transparency data available (satellite gaps after ${stableDateFallbacks.length} days)`);
            }
          }
        }
      }

      // Try biogeochemical with date fallback (BGC is stable over days)
      for (const dayOffset of stableDateFallbacks) {
        if (bioData) break;

        const bgcDate = new Date(start);
        bgcDate.setDate(bgcDate.getDate() - dayOffset);
        const bgcDateStr = bgcDate.toISOString();

        for (const padding of paddings) {
          try {
            bioData = await this.fetchAndParse(
              bioDataset,
              ['chl', 'o2', 'no3', 'po4', 'fe', 'si', 'ph'],
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

      // Try PFT (phytoplankton carbon) - separate dataset from bgc-bio
      const pftDataset = this.datasetConfig?.planktonFunctionalTypes || 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m';
      for (const dayOffset of stableDateFallbacks) {
        if (pftData) break;

        const pftDate = new Date(start);
        pftDate.setDate(pftDate.getDate() - dayOffset);
        const pftDateStr = pftDate.toISOString();

        for (const padding of paddings) {
          try {
            pftData = await this.fetchAndParse(
              pftDataset,
              ['phyc'],
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
        if (planktonData) break;

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
            const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                 padding === paddings[paddings.length - 1];
            if (isLastAttempt) {
              console.warn(`   ⚠️  No plankton (zooplankton) data available`);
            }
          }
        }
      }

      // Try primary production (nppv) - separate dataset from bgc-bio in split BGC models (GLO, NWS, MED)
      // For bundled regional models (BAL, BLK, IBI, ARC), nppv comes from the main BGC fetch
      const ppDataset = this.datasetConfig?.primaryProduction;
      if (ppDataset) {
        for (const dayOffset of stableDateFallbacks) {
          if (ppData) break;

          const ppDate = new Date(start);
          ppDate.setDate(ppDate.getDate() - dayOffset);
          const ppDateStr = ppDate.toISOString();

          for (const padding of paddings) {
            try {
              ppData = await this.fetchAndParse(
                ppDataset,
                ['nppv'],
                lat, lon,
                ppDateStr, ppDateStr,
                padding
              );
              if (ppData && this.hasValidData(ppData)) {
                const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
                console.log(`   ✅ Primary production (nppv) data found with ${padding}° padding${ageNote}`);
                break;
              }
              ppData = null;
            } catch (err) {
              const isLastAttempt = dayOffset === stableDateFallbacks[stableDateFallbacks.length - 1] &&
                                   padding === paddings[paddings.length - 1];
              if (isLastAttempt) {
                console.warn(`   ⚠️  No primary production (nppv) data available`);
              }
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

      // Merge primary production (nppv) into biogeochemical data
      if (ppData && ppData.records.length > 0) {
        if (bioData) {
          bioData.variables = [...bioData.variables, ...ppData.variables];
          bioData.records.forEach((record, idx) => {
            if (ppData!.records[idx]) {
              record.variables = { ...record.variables, ...ppData!.records[idx].variables };
            }
          });
        } else {
          bioData = ppData;
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
