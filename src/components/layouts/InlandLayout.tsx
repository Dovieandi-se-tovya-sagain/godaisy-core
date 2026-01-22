import React from 'react';
import { WeatherCardGrid } from '../weather-cards/WeatherCardGrid';
import NextFewDaysCard from '../weather-cards/NextFewDaysCard';
import { HourlyCard } from '../weather-cards/HourlyCard';
import type { WeatherBundle, HourlyWithEventsItem, HourlyWithEventsHour } from '../../types/weather';
import type { AirQualityAssessment } from '../../utils/airQualityUtils';

// Narrow shapes reused by WeatherCardGrid and local UI
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

// Weather shape accepted by this layout (subset of WeatherBundle plus optional root temps)
 type WeatherLike = Partial<WeatherBundle> & {
  // Some callers may pass temps at root; prefer header when available
  tempC?: number;
  feelsLike?: number;
};

interface InlandLayoutProps {
  weather: WeatherLike | null;
  today: TodaySubset;
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
  hourlyWithEvents: HourlyWithEventsItem[];
}

export const InlandLayout: React.FC<InlandLayoutProps> = ({
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
  hourlyWithEvents,
}) => {
  // Normalize values for HourlyCard (expects compact assessments)
  const aqiAssessForHourly = { overall: aqiAssess?.overall };
  const pollenAssessForHourly = { overall: Math.max(1, Math.min(4, typeof pollenIdx === 'number' ? pollenIdx : 1)) };

  // Map unified hourly events to HourlyCard's expected shape (hours only)
  const hourlyEvents = React.useMemo(() => (
    hourlyWithEvents
      .filter((it): it is HourlyWithEventsHour => it.kind === 'hour' && !!(it as HourlyWithEventsHour).hour)
      .map((it) => ({
        kind: 'hour' as const,
        key: it.key,
        timeISO: it.hour.timeISO,
        hour: {
          label: it.hour.label,
          temp: it.hour.temp,
          icon: it.hour.icon,
          weatherCode: it.hour.weatherCode,
          description: it.hour.description,
          precipMM: it.hour.precipMM,
          windMS: it.hour.windMS,
          wind: it.hour.wind,
          windDeg: it.hour.windDeg,
          gust: it.hour.gust,
          uvi: it.hour.uvi,
          pollenOverall: it.hour.pollenOverall,
          aqiOverall: it.hour.aqiOverall,
        },
      }))
  ), [hourlyWithEvents]);

  // Feels-like and actual temps (prefer header when present)
  const feelsLikeNow = typeof weather?.header?.feelsLikeC === 'number'
    ? weather.header.feelsLikeC
    : (typeof weather?.feelsLike === 'number' ? weather.feelsLike : undefined);
  const tempNow = typeof weather?.header?.tempC === 'number'
    ? weather.header.tempC
    : (typeof weather?.tempC === 'number' ? weather.tempC : undefined);

  return (
    <div>
      {/* Inland layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6 xl:gap-8 auto-rows-fr">
        {/* Row 1: Hourly */}
        <div className="flex flex-col h-full">
          <h2 className="text-sm opacity-70 mb-2">Hourly</h2>
          <HourlyCard
            hourlyWithEvents={hourlyEvents}
            aqiAssess={aqiAssessForHourly}
            pollenAssess={pollenAssessForHourly}
            pollenBadgeClass={pollenBadgeClass}
          />
        </div>

        {/* Feels Like */}
        <div className="card bg-black/35 backdrop-blur-sm text-base-content border border-white/10 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">Feels Like</h3>
            <div className="stats">
              <div className="stat">
                <div className="stat-title">Now</div>
                <div className="stat-value text-2xl">
                  {typeof feelsLikeNow === 'number' ? `${Math.round(feelsLikeNow)}°` : '—'}
                </div>
                <div className="stat-desc">
                  Actual {typeof tempNow === 'number' ? `${Math.round(tempNow)}°` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Next Few Days - 8-Day Forecast */}
        <NextFewDaysCard
          daily={weather?.daily || []}
          maxDays={8}
          isMarine={false}
        />
      </div>

      {/* 8-Day Forecast */}
      <div className="mt-4">
        <NextFewDaysCard
          daily={weather?.daily || []}
          maxDays={8}
          isMarine={false}
        />
      </div>

      {/* Shared cards for inland layout */}
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
