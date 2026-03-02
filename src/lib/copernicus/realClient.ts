import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CopernicusProvider,
  CopernicusFetchOptions,
  CopernicusMarineBundle,
  CopernicusTimeseries,
} from './types';
import { getDatasetForCmemsRegion, getDatasetForRegion, type CopernicusDatasetConfig } from './regionRouter';

const execAsync = promisify(exec);

/**
 * Real Copernicus Marine Service provider using the CLI tool
 */
export class RealCopernicusProvider implements CopernicusProvider {
  private cliPath: string;
  private region?: string;
  private datasetConfig?: CopernicusDatasetConfig;

  constructor(region?: string) {
    // Assume copernicusmarine is in PATH (installed via pipx)
    this.cliPath = 'copernicusmarine';
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copernicus-'));

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
      let transparencyData: CopernicusTimeseries | null = null;
      let bioData: CopernicusTimeseries | null = null;
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
            const thetaoFile = path.join(tempDir, `thetao_${padding}_d${dayOffset}.nc`);
            await this.fetchDatasetWithPadding(
              temperatureDataset,
              ['thetao'],  // Explicitly request temperature variable
              lat,
              lon,
              fallbackDateStr,
              fallbackDateStr,
              thetaoFile,
              padding
            );
            temperatureData = await this.parseNetCDF(thetaoFile, 'physics');
            if (temperatureData && this.hasValidData(temperatureData)) {
              daysBack = dayOffset;
              successfulDate = fallbackDateStr;
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Temperature data found with ${padding}° padding (~${Math.round(padding * 111)}km)${ageNote}`);
              break;
            }
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
          const salinityFile = path.join(tempDir, `salinity_${successfulPadding}_d${daysBack}.nc`);
          await this.fetchDatasetWithPadding(
            salinityDataset,
            ['so'],  // Explicitly request salinity variable
            lat,
            lon,
            successfulDate,
            successfulDate,
            salinityFile,
            successfulPadding
          );
          salinityData = await this.parseNetCDF(salinityFile, 'physics');
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
            const currentsFile = path.join(tempDir, `currents_${successfulPadding}_d${dayOffset}.nc`);
            await this.fetchDatasetWithPadding(
              currentsDataset,
              ['uo', 'vo'],  // Eastward and northward currents
              lat,
              lon,
              currentsDateStr,
              currentsDateStr,
              currentsFile,
              successfulPadding
            );
            currentsData = await this.parseNetCDF(currentsFile, 'physics');
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

      // Try transparency with date fallback (satellite data - stable, but gaps common)
      if (temperatureData) {
        const successfulPadding = paddings.find(_p => temperatureData !== null) || paddings[0];

        for (const dayOffset of stableDateFallbacks) {
          if (transparencyData) break;

          const transDate = new Date(start);
          transDate.setDate(transDate.getDate() - dayOffset);
          const transDateStr = transDate.toISOString();

          try {
            const transparencyFile = path.join(tempDir, `transparency_${successfulPadding}_d${dayOffset}.nc`);
            await this.fetchDatasetWithPadding(
              transparencyDataset,
              ['KD490'],  // Satellite transparency variable (uppercase)
              lat,
              lon,
              transDateStr,
              transDateStr,
              transparencyFile,
              successfulPadding
            );
            transparencyData = await this.parseNetCDF(transparencyFile, 'biogeochemical');
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
            const bioFile = path.join(tempDir, `bio_${padding}_d${dayOffset}.nc`);
            await this.fetchDatasetWithPadding(
              bioDataset,
              [],  // Don't specify variables - let dataset return what it has (chlorophyll, oxygen, nutrients)
              lat,
              lon,
              bgcDateStr,
              bgcDateStr,
              bioFile,
              padding
            );
            bioData = await this.parseNetCDF(bioFile, 'biogeochemical');
            if (bioData && this.hasValidData(bioData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ BGC data found with ${padding}° padding (~${Math.round(padding * 111)}km)${ageNote}`);
              break;
            }
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

      // Wave data is optional, try with date fallback (max 1 day old)
      for (const dayOffset of dynamicDateFallbacks) {
        if (waveData) break;

        const waveDate = new Date(start);
        waveDate.setDate(waveDate.getDate() - dayOffset);
        const waveDateStr = waveDate.toISOString();

        for (const padding of [0.25]) {
          try {
            const waveFile = path.join(tempDir, `waves_${padding}_d${dayOffset}.nc`);
            await this.fetchDatasetWithPadding(
              waveDataset,
              ['VHM0', 'VMDR', 'VTM02'],  // Request key wave variables
              lat,
              lon,
              waveDateStr,
              waveDateStr,
              waveFile,
              padding
            );
            waveData = await this.parseNetCDF(waveFile, 'waves');
            if (waveData && this.hasValidData(waveData)) {
              const ageNote = dayOffset > 0 ? ` (${dayOffset}d old)` : '';
              console.log(`   ✅ Wave data found with ${padding}° padding${ageNote}`);
              break;
            }
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
    } finally {
      // Clean up temp files
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private hasValidData(timeseries: CopernicusTimeseries): boolean {
    // Check if we have at least one record with non-null data
    return timeseries.records.length > 0 && 
           timeseries.records.some(r => 
             Object.values(r.variables).some(v => v !== null && v !== undefined && !isNaN(v))
           );
  }

  private async fetchDatasetWithPadding(
    datasetId: string,
    variables: string[],
    lat: number,
    lon: number,
    start: string,
    end: string,
    outputFile: string,
    padding: number
  ): Promise<void> {
    // Adjust coordinates with specified padding
    const latMin = lat - padding;
    const latMax = lat + padding;
    const lonMin = lon - padding;
    const lonMax = lon + padding;

    // Format dates for Copernicus API (YYYY-MM-DD)
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    // Build the CLI command with proper quoting
    // Each argument must be a separate element for proper shell escaping
    const cmdArgs = [
      'subset',
      '--dataset-id', datasetId,
    ];

    // Only add variable flags if variables are specified
    if (variables.length > 0) {
      variables.forEach(v => {
        cmdArgs.push('--variable', v);
      });
    }

    // Split output path into directory + filename (CLI requires them separate)
    const outputDir = path.dirname(outputFile);
    const outputName = path.basename(outputFile);

    cmdArgs.push(
      '--minimum-longitude', lonMin.toString(),
      '--maximum-longitude', lonMax.toString(),
      '--minimum-latitude', latMin.toString(),
      '--maximum-latitude', latMax.toString(),
      '--start-datetime', startDate,
      '--end-datetime', endDate,
      '--output-directory', outputDir,
      '--output-filename', outputName,
      '--overwrite',
      '--disable-progress-bar'
    );

    // Build command string with proper quoting for shell
    const cmd = `${this.cliPath} ${cmdArgs.map(arg =>
      arg.toString().includes(' ') ? `"${arg}"` : arg
    ).join(' ')}`;

    // CI environments need longer timeouts (cold STAC catalogue, auth, download)
    // 90s for initial probe, 120s for larger downloads
    const isProbe = padding <= 0.25;
    const timeoutMs = isProbe ? 90000 : 120000;

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: timeoutMs,
        killSignal: 'SIGTERM',
        env: {
          ...process.env,
          PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
          COPERNICUSMARINE_SERVICE_USERNAME: process.env.COPERNICUS_USERNAME,
          COPERNICUSMARINE_SERVICE_PASSWORD: process.env.COPERNICUS_PASSWORD,
        },
      });

      // copernicusmarine outputs progress/info to stderr — only error on actual failures
      if (stderr) {
        const stderrLower = stderr.toLowerCase();
        const hasError = stderrLower.includes('error') || stderrLower.includes('exception') || stderrLower.includes('traceback');
        const isJustInfo = stderrLower.includes('info') || stderrLower.includes('fetching') || stderrLower.includes('downloaded');
        if (hasError && !isJustInfo) {
          console.error(`   ⚠️  CLI stderr: ${stderr.substring(0, 300)}`);
          throw new Error(stderr.substring(0, 500));
        }
      }

      if (stdout) {
        console.log(`   ℹ️  CLI stdout: ${stdout.substring(0, 100)}`);
      }
    } catch (execError: unknown) {
      const errMsg = execError instanceof Error ? execError.message : String(execError);
      const isTimeout = errMsg.includes('SIGTERM') || errMsg.includes('timeout') || errMsg.includes('killed');
      if (isTimeout) {
        throw new Error(`timeout after ${timeoutMs / 1000}s for ${datasetId}`);
      }
      // Log the actual CLI error for debugging
      console.error(`   ❌ CLI failed for ${datasetId}: ${errMsg.substring(0, 300)}`);
      throw execError;
    }
  }

  private async parseNetCDF(
    filePath: string,
    _dataType: 'physics' | 'biogeochemical' | 'waves'
  ): Promise<CopernicusTimeseries> {
    // Use Python with xarray to parse NetCDF
    const pythonScript = `
import xarray as xr
import json
import sys

def is_valid_value(val, var_name):
    """
    Filter out fill values and physically impossible values.
    CMEMS datasets use various fill values: 9999, 9.96921e+36, -32767, etc.
    """
    if val is None:
        return False

    import numpy as np

    # Check for NaN and infinite values
    if np.isnan(val) or np.isinf(val):
        return False

    # Common fill value patterns
    abs_val = abs(val)
    if abs_val > 9000:  # e.g., 9999, 9345, 15442, 9.96921e+36
        return False
    if abs_val > 1000 and abs_val < 10000:  # e.g., 9999, -32767
        return False

    # Variable-specific validation (physically plausible ranges)
    var_lower = var_name.lower()

    # Temperature variables (thetao, to, sst, etc.)
    if 'temp' in var_lower or 'thetao' in var_lower or 'to' in var_lower or 'sst' in var_lower:
        if val < -5 or val > 50:  # °C
            return False

    # Salinity variables (so, sal, salinity, etc.)
    if 'sal' in var_lower or 'so' in var_lower:
        if val < 0 or val > 50:  # PSU
            return False

    # Chlorophyll (chl, chlorophyll, chla)
    if 'chl' in var_lower:
        if val < 0 or val > 100:  # mg/m³
            return False

    # Light attenuation coefficient (kd490, kd, attenuation)
    if 'kd' in var_lower or 'atten' in var_lower:
        if val < 0 or val > 10:  # m⁻¹
            return False

    # Oxygen (o2, oxygen, dissolved_oxygen)
    if 'o2' in var_lower or 'oxygen' in var_lower:
        if val < 0 or val > 500:  # mmol/m³
            return False

    # Nitrate (no3, nitrate)
    if 'no3' in var_lower or 'nitrate' in var_lower:
        if val < 0 or val > 100:  # mmol/m³
            return False

    # Phosphate (po4, phosphate)
    if 'po4' in var_lower or 'phosphate' in var_lower:
        if val < 0 or val > 20:  # mmol/m³
            return False

    # Currents (uo, vo, velocity)
    if any(x in var_lower for x in ['uo', 'vo', 'velocity', 'current']):
        if abs_val > 10:  # m/s (10 m/s = 20 knots, extreme)
            return False

    # Wave height (VHM0, wave_height)
    if 'vhm' in var_lower or 'wave' in var_lower and 'height' in var_lower:
        if val < 0 or val > 30:  # meters
            return False

    # Wave period (VTM, period)
    if 'vtm' in var_lower or 'period' in var_lower:
        if val < 0 or val > 30:  # seconds
            return False

    return True

try:
    ds = xr.open_dataset('${filePath}')

    # Extract all variables
    records = []

    # Get dimensions
    times = ds.time.values if 'time' in ds.dims else []
    depths = ds.depth.values if 'depth' in ds.dims else [0]
    lats = ds.latitude.values if 'latitude' in ds.dims else ds.lat.values
    lons = ds.longitude.values if 'longitude' in ds.dims else ds.lon.values

    # Convert to Python lists
    import numpy as np
    times = [str(t) for t in times]
    depths = [float(d) for d in depths]

    # Filter depths to only keep 0m, 5m, and 10m (within 1m tolerance)
    target_depths = [0, 5, 10]
    filtered_depths = []
    for target in target_depths:
        # Find closest depth to target
        closest = min(depths, key=lambda d: abs(d - target)) if depths else None
        if closest is not None and abs(closest - target) <= 1.5:  # Within 1.5m tolerance
            if closest not in filtered_depths:  # Avoid duplicates
                filtered_depths.append(closest)
    depths = filtered_depths if filtered_depths else [0]  # Fallback to surface if no matches

    lat = float(lats[0] if len(lats.shape) == 1 else lats[0, 0])
    lon = float(lons[0] if len(lons.shape) == 1 else lons[0, 0])

    # Get variable names (exclude coordinates)
    var_names = [v for v in ds.data_vars if v not in ['latitude', 'longitude', 'lat', 'lon', 'time', 'depth']]

    # Extract data for each time/depth combination
    for time_idx, time in enumerate(times):
        for depth_idx, depth in enumerate(depths):
            variables = {}
            for var in var_names:
                try:
                    if 'depth' in ds[var].dims:
                        val = ds[var].isel(time=time_idx, depth=depth_idx).values
                    else:
                        val = ds[var].isel(time=time_idx).values

                    # Handle various array shapes - spatial grids need aggregation
                    if hasattr(val, 'shape') and len(val.shape) >= 2:
                        # Spatial grid (lat x lon) - take mean of non-NaN values
                        val = np.nanmean(val)
                    elif hasattr(val, 'item'):
                        val = val.item()
                    elif hasattr(val, '__len__') and len(val) > 0:
                        val = float(val[0])

                    # Validate value (filter fill values and implausible data)
                    if is_valid_value(val, var):
                        # Normalize variable name to lowercase for consistent transformer mapping
                        variables[var.lower()] = float(val)
                except Exception as e:
                    pass

            if variables:  # Only add if we have data
                records.append({
                    'time': time,
                    'depth': depth,
                    'lat': lat,
                    'lon': lon,
                    'variables': variables
                })

    result = {
        'datasetId': ds.attrs.get('id', 'unknown'),
        'variables': var_names,
        'records': records,
        'source': 'copernicus'
    }

    print(json.dumps(result))

except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    const pythonFile = path.join(path.dirname(filePath), 'parse.py');
    fs.writeFileSync(pythonFile, pythonScript);

    try {
      const { stdout, stderr } = await execAsync(`python3 ${pythonFile}`, {
        env: {
          ...process.env,
          PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
          // Pass Copernicus credentials to CLI (using new naming convention)
          COPERNICUSMARINE_SERVICE_USERNAME: process.env.COPERNICUS_USERNAME,
          COPERNICUSMARINE_SERVICE_PASSWORD: process.env.COPERNICUS_PASSWORD,
        },
      });

      // Only treat stderr as error if it contains actual error JSON
      // RuntimeWarnings from numpy (e.g., "Mean of empty slice") are normal and should be ignored
      if (stderr && stderr.includes('"error"')) {
        try {
          const errorData = JSON.parse(stderr);
          if (errorData.error) {
            throw new Error(`Failed to parse NetCDF: ${errorData.error}`);
          }
        } catch (_parseErr) {
          // If we can't parse as JSON, it's probably just warnings - ignore
        }
      }

      if (!stdout || stdout.trim() === '') {
        throw new Error('Parser returned no output');
      }

      const result = JSON.parse(stdout);
      console.log(`   ℹ️  Parsed ${result.records?.length || 0} records with ${result.variables?.length || 0} variables`);
      return result as CopernicusTimeseries;
    } finally {
      fs.unlinkSync(pythonFile);
    }
  }
}
