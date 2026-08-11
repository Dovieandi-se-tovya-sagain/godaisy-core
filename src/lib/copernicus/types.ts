export type CopernicusDataSource = 'mock' | 'copernicus';

export interface CopernicusRecordVariables {
  // Physics variables
  thetao?: number; // sea water potential temperature (°C)
  so?: number; // sea water salinity (PSU)
  uo?: number; // eastward sea water velocity (m/s) - OCEAN CURRENTS
  vo?: number; // northward sea water velocity (m/s) - OCEAN CURRENTS
  mlotst?: number; // ocean mixed layer thickness (m) - THERMOCLINE DEPTH
  zos?: number; // sea surface height above geoid (m) - UPWELLING INDICATOR
  bottomT?: number; // sea water potential temperature at sea floor (°C)
  tob?: number; // same field, as the GLO combined product names it
  
  // Biogeochemical variables
  o2?: number; // dissolved oxygen (mmol/m³)
  chl?: number; // chlorophyll-a concentration (mg/m³)
  kd490?: number; // diffuse attenuation coefficient at 490nm (1/m) - WATER CLARITY
  no3?: number; // nitrate (mmol/m³)
  po4?: number; // phosphate (mmol/m³)
  zooc?: number; // zooplankton carbon (mmol/m³) - FOOD CHAIN
  phyc?: number; // phytoplankton carbon (mmol/m³) - PRIMARY PRODUCTION
  nppv?: number; // net primary production (mg C/m³/day)
  ph?: number; // pH (dimensionless)
  fe?: number; // dissolved iron (mmol/m³)
  si?: number; // silicate (mmol/m³)
  
  // Wave variables
  vhm0?: number; // significant wave height (m)
  swh?: number; // alias for wave height if present
  vmdr?: number; // mean wave direction (degrees)
  vtm10?: number; // mean wave period (seconds)
  vhm0_ww?: number; // wind sea significant wave height (m)
  vhm0_sw1?: number; // primary swell significant wave height (m)
  
  [variable: string]: number | undefined;
}

export interface CopernicusTimeseriesRecord {
  time: string; // ISO8601
  depth: number; // metres, positive downward
  lat: number;
  lon: number;
  variables: CopernicusRecordVariables;
}

export interface CopernicusTimeseries {
  datasetId: string;
  variables: string[];
  records: CopernicusTimeseriesRecord[];
  source: CopernicusDataSource;
}

export interface CopernicusMarineBundle {
  physics: CopernicusTimeseries;
  biogeochemical?: CopernicusTimeseries;
  waves?: CopernicusTimeseries;
  generatedAt: string;
}

export interface CopernicusDepthProfilePoint {
  depth: number;
  temperature?: number;
  salinity?: number;
  dissolvedOxygen?: number;
  chlorophyll?: number;
  kd490?: number; // water clarity (diffuse attenuation)
  nitrate?: number;
  phosphate?: number;
  currentEast?: number; // eastward velocity (uo)
  currentNorth?: number; // northward velocity (vo)
  zooplankton?: number; // zooplankton carbon
  phytoplankton?: number; // phytoplankton carbon
}

export interface CopernicusMarineSnapshot {
  timestamp: string;
  
  // Surface measurements
  temperatureSurface?: number;
  // Sea-bed temperature. Demersal species live at the bottom, so in a stratified
  // summer water column the surface reading says nothing about the water they
  // actually occupy — off the Cantabrian coast on 2026-08-06 the surface was
  // 21.5 C while the bottom was 13.1 C, the difference between "far too warm for
  // hake" and "squarely in its 8-16 C optimum".
  temperatureBottom?: number;
  salinitySurface?: number;
  dissolvedOxygenSurface?: number;
  chlorophyllSurface?: number;
  kd490Surface?: number; // WATER CLARITY - key for sight-feeding fish
  nitrateSurface?: number;
  phosphateSurface?: number;
  
  // Ocean dynamics - CRITICAL FOR FISHING
  currentEastSurface?: number; // eastward velocity (m/s)
  currentNorthSurface?: number; // northward velocity (m/s)
  currentSpeedSurface?: number; // calculated: sqrt(uo² + vo²)
  currentDirectionSurface?: number; // calculated: atan2(vo, uo) in degrees
  mixedLayerDepth?: number; // thermocline depth (m)
  seaSurfaceHeight?: number; // upwelling/downwelling indicator (m)
  
  // Food chain indicators
  zooplanktonSurface?: number; // direct food source
  phytoplanktonSurface?: number; // base of food chain
  primaryProductionSurface?: number; // ecosystem productivity
  
  // Wave details
  significantWaveHeight?: number;
  waveDirection?: number; // mean wave direction (degrees)
  wavePeriod?: number; // mean wave period (seconds)
  windSeaHeight?: number; // local wind-generated waves
  swellHeight?: number; // ocean swell
  
  depthProfile: CopernicusDepthProfilePoint[];
}

export interface CopernicusMarineData {
  location: {
    lat: number;
    lon: number;
  };
  snapshots: CopernicusMarineSnapshot[];
  metadata: {
    datasets: string[];
    source: CopernicusDataSource;
    generatedAt: string;
    notes?: string[];
  };
}

export interface CopernicusFetchOptions {
  lat: number;
  lon: number;
  start: string; // ISO timeframe
  end: string;
  depthLevels?: number[];
  /** If true, skip all remaining variable fetches when temperature returns no data.
   *  Coastal cells whose center is on land return NaN for ALL variables —
   *  this avoids ~10 wasted API calls (~70s) per dead cell. */
  skipIfNoTemp?: boolean;
}

export interface CopernicusProvider {
  fetchBundle(options: CopernicusFetchOptions): Promise<CopernicusMarineBundle>;
}
