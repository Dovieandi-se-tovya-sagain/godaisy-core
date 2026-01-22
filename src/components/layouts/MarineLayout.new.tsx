import React from 'react';
import { WeatherCardGrid } from '../weather-cards/WeatherCardGrid';
import { WaveCard } from '../weather-cards/WaveCard';
import type { WeatherBundle } from '../../types/weather';
import type { AirQualityAssessment } from '../../utils/airQualityUtils';

// Local flexible provider value type for Stormglass-like sources
type ProviderValue = { noaa?: number; sg?: number; meto?: number };

// Local marine hour type allowing multiple providers
interface MarineHourLike {
  time: string; // ISO
  waveHeight?: ProviderValue;
  waterTemperature?: ProviderValue;
  swellHeight?: ProviderValue;
  swellPeriod?: ProviderValue;
  windSpeed?: ProviderValue; // m/s
  windDirection?: ProviderValue;
  windGust?: ProviderValue;
  swellDirection?: ProviderValue;
  [key: string]: unknown;
}

// Narrow shape for pieces of weather used by this layout
interface WeatherLike extends Partial<WeatherBundle> {
  lat?: number;
  lon?: number;
  windSpeedMS?: number;
  windGustMS?: number;
  windDeg?: number;
  marine?: {
    windSpeed?: number;
    windDirection?: number;
    waterTemperature?: number;
    waveHeight?: number;
    wavePeriod?: number;
    waveDirection?: number;
    swellHeight?: number;
    swellPeriod?: number;
    swellDirection?: number;
  } | null;
  hourly?: Array<{ timeISO: string; waveHeightM?: number | null; swellHeightM?: number | null }>;
}

// Replicated subset used by WeatherCardGrid
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
interface PollenTodayDetail { grass_pollen?: string; tree_pollen?: string; weed_pollen?: string; olive_pollen?: string; alder_pollen?: string; birch_pollen?: string; ragweed_pollen?: string; mugwort_pollen?: string }

interface MarineLayoutProps {
  weather: WeatherLike | null;
  today: TodaySubset;
  hasMarine: boolean;
  hourlyWithEvents: unknown[]; // not rendered in this simplified layout
  uvRingClass: string;
  aqiAssess: AirQualityAssessment | null;
  pollenAssess: PollenAssessmentLite | null;
  pollenIdx: number;
  pollenBadgeClass: string;
  pollenToday: PollenTodayDetail;
  visibilityKm: number | null;
  humidity: number | null;
  pressureTrend: string | null;
  pressure: number | null;
  marineHours: MarineHourLike[];
  currentMarine: MarineHourLike | null;
}

export const MarineLayout: React.FC<MarineLayoutProps> = ({
  weather,
  today,
  hasMarine,
  hourlyWithEvents: _hourlyWithEvents,
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
  marineHours,
  currentMarine,
}) => {
  return (
    <div>
      {/* Marine layout with hourly, wind/tides, waves */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6 xl:gap-8 items-start">
        
        {/* LEFT — Hourly (full column height) */}
        <div className="flex flex-col">
          <h2 className="text-sm opacity-70 mb-2 flex items-center gap-2">
            Hourly {hasMarine && (<span className="badge badge-info badge-outline badge-xs">Marine</span>)}
          </h2>
          <div className="card bg-transparent shadow-none h-full">
            <div className="card-body p-0 h-full">
              <div className="carousel rounded-box space-x-2 bg-transparent h-full">
                {/* Placeholder for hourly cards */}
                <div className="text-center p-4 opacity-70">
                  Hourly forecast will be rendered here...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE — Wind/Tides */}
        <div className="grid grid-rows-2 gap-4">
          {/* Wind Card */}
          <div className="card bg-black/35 backdrop-blur-sm text-base-content border border-white/10 shadow-sm h-full">
            <div className="card-body">
              <h3 className="card-title flex items-center gap-2">
                Wind
                <span className="badge badge-primary">Marine</span>
              </h3>
              <div className="stats">
                <div className="stat">
                  <div className="stat-title">Speed</div>
                  <div className="stat-value text-xl">
                    {weather?.windSpeedMS != null ? `${Math.round(weather.windSpeedMS * 3.6)} km/h` : '—'}
                  </div>
                  <div className="stat-desc">
                    {weather?.windGustMS != null ? `Gusts ${Math.round(weather.windGustMS * 3.6)}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tides Card */}
          <div className="card bg-black/35 backdrop-blur-sm text-base-content border border-white/10 shadow-sm h-full">
            <div className="card-body">
              <h3 className="card-title flex items-center gap-2">
                Tides
                <span className="badge badge-info">Live</span>
              </h3>
              <div className="text-center p-4 opacity-70">
                Tide chart and timing will be rendered here...
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Waves */}
        <div>
          <WaveCard
            waveHeightM={(currentMarine?.waveHeight?.noaa as number | undefined) ?? (weather?.marine?.waveHeight as number | undefined)}
            wavePeriodS={(currentMarine?.swellPeriod?.noaa as number | undefined) ?? (weather?.marine?.wavePeriod as number | undefined)}
            waveDir={(currentMarine?.swellDirection?.noaa as number | undefined) ?? (weather?.marine?.waveDirection as number | undefined)}
            swellHeightM={(currentMarine?.swellHeight?.noaa as number | undefined) ?? (weather?.marine?.swellHeight as number | undefined)}
            swellPeriodS={(currentMarine?.swellPeriod?.noaa as number | undefined) ?? (weather?.marine?.swellPeriod as number | undefined)}
            swellDir={(currentMarine?.swellDirection?.noaa as number | undefined) ?? (weather?.marine?.swellDirection as number | undefined)}
            windSpeedMS={(weather?.marine?.windSpeed as number | undefined) ?? (weather?.windSpeedMS as number | undefined)}
            windDir={(weather?.marine?.windDirection as number | undefined) ?? (weather?.windDeg as number | undefined)}
            seaTemp={(currentMarine?.waterTemperature?.sg as number | undefined) ?? 
                     (currentMarine?.waterTemperature?.meto as number | undefined) ?? 
                     (currentMarine?.waterTemperature?.noaa as number | undefined) ?? 
                     (weather?.marine?.waterTemperature as number | undefined)}
            lat={weather?.lat}
            lon={weather?.lon}
            waveSeries={(marineHours.length ? 
              marineHours.map((m, i) => {
                const now = new Date();
                const time = new Date(now.getTime() + i * 60 * 60 * 1000);
                return {
                  height: typeof m?.swellHeight?.noaa === 'number' ? m.swellHeight.noaa : (
                    typeof m?.waveHeight?.noaa === 'number' ? m.waveHeight.noaa : null
                  ),
                  time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
              }) : 
              (weather?.hourly || []).map((h, i: number) => {
                const now = new Date();
                const time = new Date(now.getTime() + i * 60 * 60 * 1000);
                return {
                  height: typeof h.swellHeightM === 'number' ? h.swellHeightM : (
                    typeof h.waveHeightM === 'number' ? h.waveHeightM : null
                  ),
                  time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
              })
            )}
          />
        </div>
      </div>

      {/* Shared cards for marine layout */}
      <WeatherCardGrid
        weather={weather}
        today={today}
        uvRingClass={uvRingClass}
        aqiAssess={aqiAssess}
        pollenAssess={pollenAssess}
        pollenIdx={pollenIdx}
        pollenBadgeClass={pollenBadgeClass}
        pollenToday={pollenToday}
        visibilityKm={visibilityKm}
        humidity={humidity}
        pressureTrend={pressureTrend}
        pressure={pressure}
      />
    </div>
  );
};
