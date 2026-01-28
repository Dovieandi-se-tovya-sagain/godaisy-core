import React from 'react';
import { UVCard } from './UVCard';
import { AirQualityCard } from './AirQualityCard';
import { PollenCard } from './PollenCard';
import { VisibilityCard } from './VisibilityCard';
import { HumidityCard } from './HumidityCard';
import { PressureCard } from './PressureCard';
import { SoilCard } from './SoilCard';
import { SunriseSunsetCard } from './SunriseSunsetCard';
import { MoonCard } from './MoonCard';
import { WeatherBundle } from '../../types/weather';
import { AirQualityAssessment } from '../../utils/airQualityUtils';

// Narrow shapes for dependent cards (avoid leaking full bundle where not needed)
interface TodaySubset {
  uvi?: number;
  moonPhase?: number;
  moonriseISO?: string;
  moonsetISO?: string;
  sunriseISO?: string;
  sunsetISO?: string;
  dayLengthMinutes?: number;
}

interface PollenAssessmentLite { description?: string; advice?: string }

interface PollenTodayDetail {
  grass_pollen?: string; tree_pollen?: string; weed_pollen?: string; olive_pollen?: string;
  alder_pollen?: string; birch_pollen?: string; ragweed_pollen?: string; mugwort_pollen?: string;
}

interface WeatherCardGridProps {
  weather: Pick<WeatherBundle,
    'uvi' | 'sunriseISO' | 'sunsetISO' | 'airQuality' | 'pollen' | 'visibilityKm' | 'humidityPct' | 'pressureHpa' | 'pressureTrend' | 'soil' | 'dewPointC' | 'moon'
  > | null;
  today: TodaySubset;
  uvRingClass: string; // retained (may style UVCard)
  aqiAssess: AirQualityAssessment | null;
  pollenAssess: PollenAssessmentLite | null;
  pollenIdx: number;
  pollenBadgeClass: string; // still forwarded for styling if needed
  pollenToday: PollenTodayDetail;
  visibilityKm: number | null;
  humidity: number | null;
  pressureTrend: string | null;
  pressure: number | null;
  className?: string;
}

export const WeatherCardGrid: React.FC<WeatherCardGridProps> = ({
  weather,
  today,
  uvRingClass,
  aqiAssess,
  pollenAssess,
  pollenIdx,
  pollenBadgeClass,
  pollenToday,
  visibilityKm,
  humidity,
  pressureTrend,
  pressure,
  className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 xl:gap-8 mt-4 lg:mt-6 xl:mt-8"
}) => {
  const asNumber = (value: number | null | undefined): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  const rawAirQuality = weather?.airQuality;
  const airQualityWeather: {
    airQuality?: {
      aqi?: number;
      pm2_5?: number;
      pm10?: number;
      no2?: number;
      o3?: number;
      so2?: number;
      co?: number;
      components?: Record<string, number | undefined>;
    };
  } = rawAirQuality
    ? {
        airQuality: {
          aqi: asNumber((rawAirQuality as { aqi?: number | null }).aqi),
          pm2_5: asNumber(
            (rawAirQuality as { pm2_5?: number | null }).pm2_5 ??
              (rawAirQuality as { pm25?: number | null }).pm25
          ),
          pm10: asNumber((rawAirQuality as { pm10?: number | null }).pm10),
          no2: asNumber((rawAirQuality as { no2?: number | null }).no2),
          o3: asNumber((rawAirQuality as { o3?: number | null }).o3),
          so2: asNumber((rawAirQuality as { so2?: number | null }).so2),
          co: asNumber((rawAirQuality as { co?: number | null }).co),
          components: (() => {
            const components = (rawAirQuality as { components?: Record<string, number | null> }).components;
            if (!components) return undefined;
            const normalized: Record<string, number | undefined> = {};
            for (const [key, value] of Object.entries(components)) {
              const numeric = asNumber(value);
              if (numeric !== undefined) normalized[key] = numeric;
            }
            return Object.keys(normalized).length ? normalized : undefined;
          })(),
        },
      }
    : {};

  const soilForCard = (() => {
    const soil = weather?.soil;
    if (!soil) return undefined;
    if (
      'moisture0to1' in soil ||
      'moisture1to3' in soil ||
      'moisture3to9' in soil ||
      'moisture9to27' in soil ||
      'temp0cm' in soil ||
      'temp6cm' in soil ||
      'temp18cm' in soil ||
      'temp54cm' in soil
    ) {
      return soil as {
        temp0cm?: number;
        temp6cm?: number;
        temp18cm?: number;
        temp54cm?: number;
        moisture0to1?: number;
        moisture1to3?: number;
        moisture3to9?: number;
        moisture9to27?: number;
      };
    }
    if ('vwc' in soil) {
      const vwc = (soil as { vwc?: number | null }).vwc;
      return typeof vwc === 'number' ? { moisture0to1: vwc } : undefined;
    }
    return undefined;
  })();

  return (
    <div className={className}>
      <UVCard weather={weather || {}} uvRingClass={uvRingClass} today={today} />
      <AirQualityCard weather={airQualityWeather} aqiAssess={aqiAssess} />
      <PollenCard 
        pollenAssess={pollenAssess || {}} 
        pollenIdx={pollenIdx} 
        pollenBadgeClass={pollenBadgeClass} 
        pollenToday={pollenToday || {}} 
      />
      <VisibilityCard visibilityKm={visibilityKm} />
      <HumidityCard weather={{ dewPointC: weather?.dewPointC }} humidity={humidity} />
      <PressureCard 
        weather={weather ? { pressureHpa: weather.pressureHpa, pressureTrend: weather.pressureTrend } : null} 
        pressureTrend={pressureTrend} 
        pressure={pressure} 
      />
      <SoilCard weather={soilForCard ? { soil: soilForCard } : {}} />
      <SunriseSunsetCard weather={{ sunriseISO: weather?.sunriseISO, sunsetISO: weather?.sunsetISO }} />
      <MoonCard moon={weather?.moon} today={today} />
    </div>
  );
};
