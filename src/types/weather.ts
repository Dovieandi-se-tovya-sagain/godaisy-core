import type React from 'react';

// Shared weather & marine types

export type WeatherAnimationCondition =
  | 'marine_storm'
  | 'marine_choppy'
  | 'marine_calm'
  | 'storm'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'fog'
  | 'overcast'
  | 'cloudy'
  | 'clear';

export interface TideEvent {
  timeISO: string;
  type: 'HIGH' | 'LOW';
  heightM?: number | null;
}

export interface HourlyPoint {
  timeISO: string;
  tempC?: number;
  precipMm?: number;
  pop?: number; // probability of precipitation (0-1)
  windKts?: number;
  windDirection?: number;
  windGustKts?: number;
  waveM?: number | null;
  wavePeriodS?: number | null;
  waveDirectionDeg?: number | null;
  waterTempC?: number | null;
  swellHeightM?: number | null;
  swellPeriodS?: number | null;
  swellDirectionDeg?: number | null;
  uvi?: number;
  weatherCode?: number;
  weatherDescription?: string;
  icon?: string; // OpenWeather icon code like "01d"
  pressureHpa?: number; // NEW: per-hour pressure wired from OpenWeather hourly
  [key: string]: unknown;
}

export interface MarineHourlyPoint {
  timeISO: string;
  waveM?: number | null;
  wavePeriodS?: number | null;
  waveDirectionDeg?: number | null;
  waterTempC?: number | null;
  swellHeightM?: number | null;
  swellPeriodS?: number | null;
  swellDirectionDeg?: number | null;
  currentSpeedMS?: number | null;
  currentDirectionDeg?: number | null;
  windKts?: number; // unified (no null)
  windDirection?: number; // unified (no null)
  windGustKts?: number; // unified (no null)
  uvi?: number | null;
  // Added optional terrestrial overlays for UI uniformity
  tempC?: number;
  weatherCode?: number;
  weatherDescription?: string;
}

export interface DailyPoint {
  dateISO: string;
  minC?: number;
  maxC?: number;
  icon?: string;
  pop?: number;
  moonPhase?: number;
  moonriseISO?: string;
  moonsetISO?: string;
  sunriseISO?: string;
  sunsetISO?: string;
  dayLengthMinutes?: number;
  // extended optional fields used in UI
  precipMM?: number;
  summary?: string;
  windMS?: number;
  windDeg?: number;
  uvi?: number;
}

export interface AQIInfo { aqi?: number | null; pm25?: number; pm10?: number; source?: string }

export interface PollenInfo {
  tree?: string | number; 
  grass?: string | number; 
  weed?: string | number; 
  olive?: string | number;
  source?: string;
  alder_pollen?: string | number;
  birch_pollen?: string | number;
  ragweed_pollen?: string | number;
  mugwort_pollen?: string | number;
}

export interface SoilInfo { vwc?: number; label?: string }

export interface MoonInfo {
  phaseName?: string;
  phaseFraction?: number;
  illuminationPct?: number;
  phaseStage?: string; // 'waxing' or 'waning'
  daysUntilNextFullMoon?: number;
  daysUntilNextNewMoon?: number;
  sunriseISO?: string;
  sunsetISO?: string;
  moonriseISO?: string;
  moonsetISO?: string;
  dayLengthMinutes?: number;
  timezone?: string;
  source?: string;
  cachedAt?: string;
  expiresAt?: string;
  latBucket?: number;
  lonBucket?: number;
  localDate?: string;
  nextFullISO?: string;
  nextNewISO?: string;
}

export interface AirQualityFull {
  aqi?: number | null;
  components?: Record<string, number | null>;
  pm2_5?: number | null;
  pm10?: number | null;
  no2?: number | null;
  o3?: number | null;
  so2?: number | null;
  co?: number | null;
}

export interface PollenFull extends Record<string, number | undefined> {
  grass?: number; tree?: number; weed?: number; olive?: number;
  alder_pollen?: number; birch_pollen?: number; ragweed_pollen?: number; mugwort_pollen?: number;
}

export interface SoilSnapshot {
  temp0cm?: number; temp6cm?: number; temp18cm?: number; temp54cm?: number;
  moisture0to1?: number; moisture1to3?: number; moisture3to9?: number; moisture9to27?: number;
}

// Shape returned by /api/unified-weather (subset used client-side)
export interface UnifiedWeatherAPIResponse {
  description?: string;
  temperatureC?: number;
  feelsLikeC?: number;
  daily?: Array<{ dateISO: string; minC?: number; maxC?: number; pop?: number; icon?: string; moonPhase?: number; moonriseISO?: string; moonsetISO?: string; sunriseISO?: string; sunsetISO?: string; dayLengthMinutes?: number; precipMM?: number; summary?: string; windMS?: number; windDeg?: number; uvi?: number; }>;
  hourly?: Array<{ timeISO: string; tempC?: number; pop?: number; windMS?: number; windDeg?: number; precipMM?: number; icon?: string; weatherCode?: number; weatherDescription?: string; waveHeightM?: number | null; wavePeriodS?: number | null; uvi?: number; pressureHpa?: number; 
    // NEW snow-aware fields
    snowDepthCm?: number; snowfallRateMmH?: number; }>;
  marineHourly?: Array<{ timeISO: string; waveHeightM?: number | null; wavePeriodS?: number | null; waveDirectionDeg?: number | null; swellHeightM?: number | null; swellPeriodS?: number | null; swellDirectionDeg?: number | null; waterTempC?: number | null; windSpeedMS?: number | null; windDirectionDeg?: number | null; windGustMS?: number | null; currentSpeedMS?: number | null; currentDirectionDeg?: number | null; }>;
  tides?: Array<{ time: string; type: 'high'|'low'; height: number | null }>;
  seaTemp?: number | null;
  hasMarineData?: boolean;
  uvi?: number;
  airQuality?: AirQualityFull; 
  pollen?: PollenFull;
  // Optional: hourly pollen series (Open-Meteo raw hourly values)
  pollenHourly?: {
    time?: string[];
    grass_pollen?: number[];
    alder_pollen?: number[];
    birch_pollen?: number[];
    ragweed_pollen?: number[];
    mugwort_pollen?: number[];
    olive_pollen?: number[];
  };
  // Optional: hourly AQI series (Open-Meteo raw hourly values)
  aqiHourly?: {
    time?: string[];
    us_aqi?: number[];
    european_aqi?: number[];
    pm2_5?: number[];
    pm10?: number[];
    nitrogen_dioxide?: number[];
    ozone?: number[];
    sulphur_dioxide?: number[];
    carbon_monoxide?: number[];
  };
  cloudCoverPct?: number;
  cloudBaseM?: number | null;
  moon?: MoonInfo;
  soil?: SoilSnapshot;
  humidityPct?: number;
  humidity?: number;
  sunriseISO?: string;
  sunsetISO?: string;
  dayLengthMinutes?: number;
  windSpeedMS?: number;
  visibilityKm?: number;
  pressureHpa?: number;
  pressureTrend?: 'rising'|'falling'|'steady';
  dewPointC?: number;
  surfScore?: number;
}

export interface WeatherBundle {
  header: {
    condition: string;
    tempC: number;
    feelsLikeC: number;
    highC?: number;
    lowC?: number;
    minis: { label: string; value?: string | number; icon?: React.ReactNode }[]; // icon now ReactNode
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  visibilityKm?: number;
  pressureHpa?: number;
  pressureTrend?: 'rising' | 'falling' | 'steady';
  humidityPct?: number;
  sunriseISO?: string;
  sunsetISO?: string;
  dayLengthMinutes?: number;
  uvi?: number;
  aqi?: AQIInfo;
  airQuality?: AQIInfo | AirQualityFull; // widened to allow full structure
  pollen?: PollenInfo;
  // Optional: hourly pollen series (pass-through for per-hour icon rendering)
  pollenHourly?: {
    time?: string[];
    grass_pollen?: number[];
    alder_pollen?: number[];
    birch_pollen?: number[];
    ragweed_pollen?: number[];
    mugwort_pollen?: number[];
    olive_pollen?: number[];
  };
  // Optional: hourly AQI series (pass-through for per-hour icon rendering)
  aqiHourly?: {
    time?: string[];
    us_aqi?: number[];
    european_aqi?: number[];
    pm2_5?: number[];
    pm10?: number[];
    nitrogen_dioxide?: number[];
    ozone?: number[];
    sulphur_dioxide?: number[];
    carbon_monoxide?: number[];
  };
  cloudCoverPct?: number;
  cloudBaseM?: number | null;
  moon?: MoonInfo;
  soil?: SoilInfo | SoilSnapshot; // allow full snapshot
  dewPointC?: number;
  marineHourly?: MarineHourlyPoint[];
  tide?: TideEvent[];
  surfScore?: number;
  seaTemp?: number | null;
  hasMarineData?: boolean;
}

export function mergeMarineWind(base: HourlyPoint[], marine: MarineHourlyPoint[]): MarineHourlyPoint[] {
  type HourlyWithMeta = HourlyPoint & { weatherCode?: number; weatherDescription?: string };
  return marine.map(m => {
    const mt = new Date(m.timeISO).getTime();
    let best: HourlyWithMeta | undefined; let bestDiff = Infinity;
    for (const b of base) {
      const diff = Math.abs(new Date(b.timeISO).getTime() - mt);
      if (diff < bestDiff) { bestDiff = diff; best = b as HourlyWithMeta; }
    }
    if (best && bestDiff <= 45 * 60 * 1000) {
      const windKts = typeof best.windKts === 'number' ? best.windKts : undefined;
      const windDirection = typeof best.windDirection === 'number' ? best.windDirection : undefined;
      const windGustKts = typeof best.windGustKts === 'number' ? best.windGustKts : undefined;
      return {
        ...m,
        windKts,
        windDirection,
        windGustKts,
        tempC: typeof best.tempC === 'number' ? best.tempC : m.tempC,
        weatherCode: typeof best.weatherCode === 'number' ? best.weatherCode : m.weatherCode,
        weatherDescription: typeof best.weatherDescription === 'string' ? best.weatherDescription : m.weatherDescription,
      } as MarineHourlyPoint;
    }
    return m;
  });
}

export interface HourlyWithEventsHour {
  kind: 'hour';
  key: string;
  hour: {
    label: string;
    temp: number; // °C rounded
    icon?: string | number;
    weatherCode?: number;
    description?: string;
    precipMM?: number;
    windMS?: number; // m/s
    wind?: number; // km/h (UI convenience)
    windDeg?: number; // degrees
    gust?: number; // km/h
    waveHeightM?: number | null;
    wavePeriodS?: number | null;
    uvi?: number;
    waterTempC?: number | null;
    // Optional: per-hour pollen overall level (1..4+)
    pollenOverall?: number;
    // Optional: per-hour AQI overall (1..6)
    aqiOverall?: number;
    // Optional: original ISO time of this hour (used for day/night icon variants, tooltips, etc.)
    timeISO?: string;
  };
}

export interface HourlyWithEventsTide {
  kind: 'tide';
  key: string;
  timeISO: string;
  sub: 'high' | 'low';
  height?: number | null;
}

export interface HourlyWithEventsSun {
  kind: 'sun';
  key: string;
  timeISO: string;
  sub: 'sunrise' | 'sunset';
}

export type HourlyWithEventsItem =
  | HourlyWithEventsHour
  | HourlyWithEventsTide
  | HourlyWithEventsSun
