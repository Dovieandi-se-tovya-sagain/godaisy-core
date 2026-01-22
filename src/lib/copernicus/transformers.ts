import {
  CopernicusMarineBundle,
  CopernicusMarineData,
  CopernicusMarineSnapshot,
  CopernicusTimeseriesRecord,
} from './types';

function groupByTime(records: CopernicusTimeseriesRecord[]): Map<string, CopernicusTimeseriesRecord[]> {
  const map = new Map<string, CopernicusTimeseriesRecord[]>();
  for (const record of records) {
    const bucket = map.get(record.time) ?? [];
    bucket.push(record);
    map.set(record.time, bucket);
  }
  return map;
}

function coalesceDepthProfile(
  physics: CopernicusTimeseriesRecord[] = [],
  biogeochemical: CopernicusTimeseriesRecord[] = []
) {
  const profile = new Map<number, { 
    temperature?: number; 
    salinity?: number; 
    dissolvedOxygen?: number; 
    chlorophyll?: number; 
    kd490?: number; 
    nitrate?: number; 
    phosphate?: number;
    currentEast?: number;
    currentNorth?: number;
    zooplankton?: number;
    phytoplankton?: number;
  }>();

  for (const record of physics) {
    const entry = profile.get(record.depth) ?? {};
    if (record.variables.thetao !== undefined) {
      entry.temperature = record.variables.thetao;
    }
    if (record.variables.so !== undefined) {
      entry.salinity = record.variables.so;
    }
    if (record.variables.uo !== undefined) {
      entry.currentEast = record.variables.uo;
    }
    if (record.variables.vo !== undefined) {
      entry.currentNorth = record.variables.vo;
    }
    profile.set(record.depth, entry);
  }

  for (const record of biogeochemical) {
    const entry = profile.get(record.depth) ?? {};
    if (record.variables.o2 !== undefined) {
      entry.dissolvedOxygen = record.variables.o2;
    }
    if (record.variables.chl !== undefined) {
      entry.chlorophyll = record.variables.chl;
    }
    if (record.variables.kd490 !== undefined) {
      entry.kd490 = record.variables.kd490;
    }
    if (record.variables.no3 !== undefined) {
      entry.nitrate = record.variables.no3;
    }
    if (record.variables.po4 !== undefined) {
      entry.phosphate = record.variables.po4;
    }
    if (record.variables.zooc !== undefined) {
      entry.zooplankton = record.variables.zooc;
    }
    if (record.variables.phyc !== undefined) {
      entry.phytoplankton = record.variables.phyc;
    }
    profile.set(record.depth, entry);
  }

  return Array.from(profile.entries())
    .map(([depth, values]) => ({ depth, ...values }))
    .sort((a, b) => a.depth - b.depth);
}

function selectSurfaceValue(records: CopernicusTimeseriesRecord[] | undefined, key: keyof CopernicusTimeseriesRecord['variables']) {
  if (!records?.length) return undefined;
  const surfaceCandidate = records.find((record) => record.depth <= 1);
  return surfaceCandidate?.variables[key];
}

export function toCopernicusMarineSnapshots(bundle: CopernicusMarineBundle): CopernicusMarineSnapshot[] {
  const physicsByTime = groupByTime(bundle.physics.records);
  const bioByTime = bundle.biogeochemical ? groupByTime(bundle.biogeochemical.records) : new Map<string, CopernicusTimeseriesRecord[]>();
  const waveByTime = bundle.waves ? groupByTime(bundle.waves.records) : new Map<string, CopernicusTimeseriesRecord[]>();

  const uniqueTimes = new Set<string>([
    ...physicsByTime.keys(),
    ...bioByTime.keys(),
    ...waveByTime.keys(),
  ]);

  return Array.from(uniqueTimes)
    .sort()
    .map((time) => {
      const physics = physicsByTime.get(time) ?? [];
      const bio = bioByTime.get(time) ?? [];
      const waves = waveByTime.get(time) ?? [];

      // Calculate current speed and direction from u/v components
      const uo = selectSurfaceValue(physics, 'uo');
      const vo = selectSurfaceValue(physics, 'vo');
      let currentSpeed: number | undefined;
      let currentDirection: number | undefined;
      
      if (uo !== undefined && vo !== undefined) {
        currentSpeed = Math.sqrt(uo * uo + vo * vo);
        // Convert from radians to degrees, 0° = East, 90° = North
        currentDirection = (Math.atan2(vo, uo) * 180 / Math.PI + 360) % 360;
      }

      const snapshot: CopernicusMarineSnapshot = {
        timestamp: time,
        
        // Core measurements
        temperatureSurface: selectSurfaceValue(physics, 'thetao'),
        salinitySurface: selectSurfaceValue(physics, 'so'),
        dissolvedOxygenSurface: selectSurfaceValue(bio, 'o2'),
        chlorophyllSurface: selectSurfaceValue(bio, 'chl'),
        kd490Surface: selectSurfaceValue(bio, 'kd490'),
        nitrateSurface: selectSurfaceValue(bio, 'no3'),
        phosphateSurface: selectSurfaceValue(bio, 'po4'),
        
        // Ocean dynamics - CRITICAL FOR FISHING
        currentEastSurface: uo,
        currentNorthSurface: vo,
        currentSpeedSurface: currentSpeed,
        currentDirectionSurface: currentDirection,
        mixedLayerDepth: selectSurfaceValue(physics, 'mlotst'),
        seaSurfaceHeight: selectSurfaceValue(physics, 'zos'),
        
        // Food chain indicators
        zooplanktonSurface: selectSurfaceValue(bio, 'zooc'),
        phytoplanktonSurface: selectSurfaceValue(bio, 'phyc'),
        primaryProductionSurface: selectSurfaceValue(bio, 'nppv'),
        
        // Wave details
        significantWaveHeight: selectSurfaceValue(waves, 'vhm0') ?? selectSurfaceValue(waves, 'swh'),
        waveDirection: selectSurfaceValue(waves, 'vmdr'),
        wavePeriod: selectSurfaceValue(waves, 'vtm10'),
        windSeaHeight: selectSurfaceValue(waves, 'vhm0_ww'),
        swellHeight: selectSurfaceValue(waves, 'vhm0_sw1'),
        
        depthProfile: coalesceDepthProfile(physics, bio),
      };

      return snapshot;
    });
}

export function toCopernicusMarineData(bundle: CopernicusMarineBundle): CopernicusMarineData {
  const snapshots = toCopernicusMarineSnapshots(bundle);
  const refRecord = bundle.physics.records[0] ?? bundle.biogeochemical?.records[0];

  return {
    location: {
      lat: refRecord?.lat ?? 0,
      lon: refRecord?.lon ?? 0,
    },
    snapshots,
    metadata: {
      datasets: [bundle.physics.datasetId, bundle.biogeochemical?.datasetId, bundle.waves?.datasetId].filter(Boolean) as string[],
      source: bundle.physics.source,
      generatedAt: bundle.generatedAt,
    },
  };
}
