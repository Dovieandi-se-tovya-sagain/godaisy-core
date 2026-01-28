// Create: components/weather-cards/WindCard.tsx
'use client';

import React from 'react';
import BeaufortIcon from '../BeaufortIcon';
import WindDirectionIcon from '../WindDirectionIcon';
import { getWindMessage } from '../../utils/weatherLabels';
import Image from 'next/image';
import { TranslatedText } from '../translation/TranslatedFishCard';

interface WindDataPoint {
  timeISO: string;
  windSpeedMS?: number;
  windSpeedKts?: number;
  windDirection?: number;
  windGustMS?: number;
  windGustKts?: number;
  // Marine-specific
  waveDirection?: number;
  // OpenWeather-style fallbacks
  wind_speed?: number;
  wind_deg?: number;
  wind_gust?: number;

  // Optional weather info for icon/precip in hourly preview
  icon?: string | number;
  weatherCode?: number;
  description?: string;
  precipMM?: number;
  precipMm?: number;
  precipitation?: number;
  rain?: number;
}

interface WindCardProps {
  weather?: {
    windSpeedMS?: number;
    windDirection?: number;
    windGustMS?: number;
    hourly?: WindDataPoint[];
    // OpenWeather-style fallbacks
    wind_speed?: number;
    wind_deg?: number;
    wind_gust?: number;
  };
  points?: WindDataPoint[];
  isMarine?: boolean;
  beachOrientation?: number; // Beach facing direction in degrees (0-360)
  className?: string;
}

// Convert degrees to compass direction
function degToCompass(deg?: number): string {
  if (deg === undefined) return '–';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(deg / 22.5) % 16];
}

// Calculate if wind is onshore/offshore for marine locations
function getWindDirection(windDeg?: number, beachOrientation?: number): 'onshore' | 'offshore' | 'cross' | 'unknown' {
  if (windDeg === undefined || beachOrientation === undefined) return 'unknown';
  
  // Calculate angle difference
  let diff = Math.abs(windDeg - beachOrientation);
  if (diff > 180) diff = 360 - diff;
  
  // Onshore: wind blowing towards the beach (within 45° of beach orientation)
  if (diff <= 45) return 'onshore';
  // Offshore: wind blowing away from beach (within 45° of opposite direction)
  if (diff >= 135) return 'offshore';
  // Cross-shore: wind blowing parallel to beach
  return 'cross';
}

// Get Beaufort scale description
function getBeaufortScale(windMS?: number): { scale: number; description: string } {
  if (!windMS) return { scale: 0, description: 'Calm' };
  
  if (windMS < 0.5) return { scale: 0, description: 'Calm' };
  if (windMS < 1.6) return { scale: 1, description: 'Light air' };
  if (windMS < 3.4) return { scale: 2, description: 'Light breeze' };
  if (windMS < 5.5) return { scale: 3, description: 'Gentle breeze' };
  if (windMS < 8.0) return { scale: 4, description: 'Moderate breeze' };
  if (windMS < 10.8) return { scale: 5, description: 'Fresh breeze' };
  if (windMS < 13.9) return { scale: 6, description: 'Strong breeze' };
  if (windMS < 17.2) return { scale: 7, description: 'High wind' };
  if (windMS < 20.8) return { scale: 8, description: 'Gale' };
  if (windMS < 24.5) return { scale: 9, description: 'Strong gale' };
  if (windMS < 28.5) return { scale: 10, description: 'Storm' };
  if (windMS < 32.7) return { scale: 11, description: 'Violent storm' };
  return { scale: 12, description: 'Hurricane' };
}

// Get badge color for wind direction (marine only)
function getDirectionBadgeClass(direction: 'onshore' | 'offshore' | 'cross' | 'unknown'): string {
  switch (direction) {
    case 'onshore': return 'badge-success';
    case 'offshore': return 'badge-error';
    case 'cross': return 'badge-warning';
    default: return 'badge-neutral';
  }
}

// Removed old, now-unused guards; use typed normalizers below.

type AllWindish = Partial<WindDataPoint> | Partial<NonNullable<WindCardProps['weather']>>;

// Helper to derive wind speed and gust in m/s from any supported shape
function msFrom(obj?: AllWindish): number | undefined {
  if (!obj) return undefined;
  if (typeof obj.windSpeedMS === 'number') return obj.windSpeedMS;
  if (typeof obj.wind_speed === 'number') return obj.wind_speed; // OpenWeather style m/s
  if (typeof (obj as Partial<WindDataPoint>).windSpeedKts === 'number') return (obj as Partial<WindDataPoint>).windSpeedKts! / 1.94384; // kts -> m/s
  return undefined;
}
function gustMsFrom(obj?: AllWindish): number | undefined {
  if (!obj) return undefined;
  if (typeof obj.windGustMS === 'number') return obj.windGustMS;
  if (typeof obj.wind_gust === 'number') return obj.wind_gust; // OpenWeather style m/s
  if (typeof (obj as Partial<WindDataPoint>).windGustKts === 'number') return (obj as Partial<WindDataPoint>).windGustKts! / 1.94384; // kts -> m/s
  return undefined;
}

// Map weather codes/descriptions to icon asset path (kept in this file to avoid cross-import churn)
function getWeatherIconPath(iconCode?: string | number, description?: string): string {
  if (typeof iconCode === 'string') {
    if (iconCode.match(/^\d{2}[dn]$/)) {
      return `/weather-icons/design/fill/final/${iconCode}.svg`;
    }
  }
  if (typeof iconCode === 'number') {
    if (iconCode >= 200 && iconCode < 300) return '/weather-icons/design/fill/final/11d.svg';
    if (iconCode >= 300 && iconCode < 400) return '/weather-icons/design/fill/final/09d.svg';
    if (iconCode >= 500 && iconCode < 600) return '/weather-icons/design/fill/final/10d.svg';
    if (iconCode >= 600 && iconCode < 700) return '/weather-icons/design/fill/final/13d.svg';
    if (iconCode >= 700 && iconCode < 800) return '/weather-icons/design/fill/final/50d.svg';
    if (iconCode === 800) return '/weather-icons/design/fill/final/01d.svg';
    if (iconCode === 801) return '/weather-icons/design/fill/final/02d.svg';
    if (iconCode === 802) return '/weather-icons/design/fill/final/03d.svg';
    if (iconCode >= 803) return '/weather-icons/design/fill/final/04d.svg';
  }
  const desc = String(iconCode || description || '').toLowerCase();
  if (desc.includes('clear')) return '/weather-icons/design/fill/final/01d.svg';
  if (desc.includes('cloud')) return '/weather-icons/design/fill/final/04d.svg';
  if (desc.includes('rain')) return '/weather-icons/design/fill/final/10d.svg';
  if (desc.includes('snow')) return '/weather-icons/design/fill/final/13d.svg';
  if (desc.includes('thunder')) return '/weather-icons/design/fill/final/11d.svg';
  if (desc.includes('fog') || desc.includes('mist')) return '/weather-icons/design/fill/final/50d.svg';
  return '/weather-icons/design/fill/final/01d.svg';
}

export const WindCard: React.FC<WindCardProps> = ({
  weather,
  points = [],
  isMarine = false,
  beachOrientation,
  className = ""
}) => {
  // Use current wind data from weather or first point
  const currentWind = weather || points[0];
  const windDirection = currentWind?.windDirection ?? currentWind?.wind_deg;

  // Normalize sustained and gust speeds to m/s from possible sources (m/s, kts)
  const windSpeedMS = (() => {
    // Prefer explicit current object
    let v = msFrom(currentWind);
    // Fallback to first point if missing
    if (v == null) v = msFrom(points?.[0]);
    // Fallback to first hourly weather item
    if (v == null) v = msFrom(weather?.hourly?.[0]);
    return typeof v === 'number' ? v : 0;
  })();
  const windGustMS = (() => {
    // Prefer explicit current object
    let g = gustMsFrom(currentWind);
    // Fallbacks if not provided on current
    if (g == null) g = gustMsFrom(points?.[0]);
    if (g == null) g = gustMsFrom(weather?.hourly?.[0]);
    return typeof g === 'number' ? g : undefined;
  })();

  const speedKts = windSpeedMS * 1.94384;
  const speedKmH = windSpeedMS * 3.6;

  // Determine if we truly have coastal (Stormglass) data; if not, force land mode
  const hasStormglassData = (
    (Array.isArray(points) && points.some((p: WindDataPoint) => typeof p?.waveDirection === 'number' || typeof p?.windSpeedKts === 'number' || typeof p?.windGustKts === 'number'))
    || (Array.isArray(weather?.hourly) && weather!.hourly!.some((p: WindDataPoint) => typeof p?.waveDirection === 'number' || typeof p?.windSpeedKts === 'number' || typeof p?.windGustKts === 'number'))
  );
  const isCoastal = Boolean(isMarine && hasStormglassData);

  // Compute chip text with optional gusts (only when gust > wind; small tolerance)
  const primarySpeed = isCoastal ? speedKts : speedKmH;
  const gustPrimary = typeof windGustMS === 'number' ? windGustMS * (isCoastal ? 1.94384 : 3.6) : undefined;
  const roundedPrimary = Math.round(primarySpeed);
  const roundedGustPrimary = typeof gustPrimary === 'number' ? Math.round(gustPrimary) : undefined;
  const showGust = typeof windGustMS === 'number'
    && (
      // raw m/s shows a meaningful delta
      windGustMS > windSpeedMS + 0.1
      // or rounded primary unit shows gust strictly greater than sustained
      || (typeof roundedGustPrimary === 'number' && roundedGustPrimary > roundedPrimary)
    );
  const headerChipText = isCoastal
    ? `${roundedPrimary}kt${showGust ? ` gusting ${roundedGustPrimary}` : ''}`
    : `${roundedPrimary}km/h${showGust ? ` gusting ${roundedGustPrimary}` : ''}`;

  // Compute next-12h max gust using available hourly points (points preferred, then weather.hourly)
  const next12Points: AllWindish[] = (Array.isArray(points) && points.length ? points : (weather?.hourly ?? [])).slice(0, 12);
  const maxGustNext12MS = (() => {
    let max: number | undefined;
    for (const p of next12Points) {
      const g = gustMsFrom(p);
      if (typeof g === 'number') {
        max = typeof max === 'number' ? Math.max(max, g) : g;
      }
    }
    return max;
  })();
  const maxGustNext12Primary = typeof maxGustNext12MS === 'number' ? maxGustNext12MS * (isCoastal ? 1.94384 : 3.6) : undefined;
  const roundedMaxGustNext12Primary = typeof maxGustNext12Primary === 'number' ? Math.round(maxGustNext12Primary) : undefined;
  const showMaxGustNext12 = typeof maxGustNext12MS === 'number'
    && (
      maxGustNext12MS > windSpeedMS + 0.1
      || (typeof roundedMaxGustNext12Primary === 'number' && roundedMaxGustNext12Primary > roundedPrimary)
    );

  const beaufort = getBeaufortScale(windSpeedMS);
  const compassDir = degToCompass(windDirection);
  
  // Marine-specific calculations
  const windDir = isCoastal ? getWindDirection(windDirection, beachOrientation) : null;
  const directionBadge = windDir ? getDirectionBadgeClass(windDir) : null;

  // Build wind message (land vs marine)
  const windDirectionsToday: number[] = (() => {
    const list: number[] = [];
    const pushIfNum = (v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) list.push(((v % 360) + 360) % 360); };
    if (Array.isArray(points)) {
      for (const p of points) pushIfNum(p?.windDirection ?? p?.wind_deg);
    }
    if (Array.isArray(weather?.hourly)) {
      for (const p of weather!.hourly!) pushIfNum(p?.windDirection ?? p?.wind_deg);
    }
    return list;
  })();

  const windMessage = getWindMessage({
    windSpeed: typeof windSpeedMS === 'number' ? windSpeedMS : undefined,
    gustSpeed: typeof windGustMS === 'number' ? windGustMS : undefined,
    windDirection: typeof windDirection === 'number' ? windDirection : undefined,
    windDirectionsToday: windDirectionsToday.length ? windDirectionsToday : undefined,
    beachOrientation: typeof beachOrientation === 'number' ? beachOrientation : undefined,
    context: isCoastal ? 'marine' : 'land',
  });

  return (
    <div className={`card weather-card-bg shadow ${className}`}>
      <div className="card-body">
        <div className="flex items-start justify-between">
          <h3 className="card__header-title"><TranslatedText text="Wind" /></h3>
          <div className="flex flex-col items-end gap-1">
            <span className="badge badge-outline">
              {headerChipText}
            </span>
            {isCoastal && windDir && windDir !== 'unknown' && (
              <span className={`badge badge-sm ${directionBadge}`}>
                {windDir}
              </span>
            )}
          </div>
        </div>
        
        <p className="opacity-70">
          {windMessage ? <TranslatedText text={windMessage} /> : '—'}
        </p>

        {/* Current Wind Display */}
        <div className="mt-4 space-y-3">
          {/* Wind Speed & Direction */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Wind Direction Arrow (shared component to avoid from/to confusion) */}
              {windDirection !== undefined && (
                <WindDirectionIcon deg={windDirection || 0} size={40} />
              )}
              <div>
                <div className="font-semibold">{compassDir}</div>
                <div className="text-sm opacity-70">{windDirection}°</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-semibold">
                {isCoastal ? `${Math.round(speedKts)} kt` : `${Math.round(speedKmH)} km/h`}
              </div>
              <div className="text-sm opacity-70">
                {isCoastal 
                  ? `${Math.round(speedKmH)} km/h`
                  : `${Math.round(windSpeedMS)} m/s`}
              </div>
            </div>
          </div>

          {/* Beaufort Scale with full description */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Replace F# chip with large Beaufort icon */}
              <BeaufortIcon windMS={windSpeedMS} size={48} className="mr-2" />
              <span className="text-sm"><TranslatedText text={beaufort.description} /></span>
            </div>
            {showGust && (
              <div className="text-sm opacity-70">
                {/* Gusts shown in primary unit; inland also shows m/s secondary */}
                {isCoastal
                  ? `Gusts: ${Math.round((windGustMS as number) * 1.94384)} kt (${Math.round((windGustMS as number) * 3.6)} km/h)`
                  : `Gusts: ${Math.round((windGustMS as number) * 3.6)} km/h (${Math.round(windGustMS as number)} m/s)`}
              </div>
            )}
          </div>

          {/* Next-12h max gust (derived from hourly) */}
          {showMaxGustNext12 && (
            <div className="text-sm opacity-70">
              {isCoastal
                ? `Next 12h max gust: ${roundedMaxGustNext12Primary} kt (${Math.round((maxGustNext12MS as number) * 3.6)} km/h)`
                : `Next 12h max gust: ${roundedMaxGustNext12Primary} km/h (${Math.round(maxGustNext12MS as number)} m/s)`}
            </div>
          )}

          {/* Marine-specific info */}
          {isCoastal && beachOrientation !== undefined && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70">Beach orientation:</span>
                <span>{degToCompass(beachOrientation)} ({beachOrientation}°)</span>
              </div>
              {windDir !== 'unknown' && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="opacity-70">Wind effect:</span>
                  <span className="capitalize">{windDir} wind</span>
                </div>
              )}
            </div>
          )}

          {/* Hourly Preview */}
          {points.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-sm opacity-70 mb-2">Next 24 hours</div>
              <div className="flex gap-2 overflow-x-auto">
                {points.slice(0, 24).map((point: WindDataPoint, i: number) => {
                   const time = new Date(point.timeISO).toLocaleTimeString('en-GB', { 
                     hour: '2-digit', 
                     minute: '2-digit' 
                   });
                  // Variant-aware speed display
                  const kts = (() => {
                    const ms = point.windSpeedMS ?? point.wind_speed;
                    if (typeof point.windSpeedKts === 'number') return point.windSpeedKts;
                    if (typeof ms === 'number') return ms * 1.94384;
                    return 0;
                  })();
                  const kmh = (() => {
                    if (typeof point.windSpeedMS === 'number') return point.windSpeedMS * 3.6;
                    if (typeof point.wind_speed === 'number') return point.wind_speed * 3.6;
                    if (typeof point.windSpeedKts === 'number') return point.windSpeedKts * 1.852;
                    return 0;
                  })();
                  const display = isCoastal ? `${Math.round(kts)} kt` : `${Math.round(kmh)} km/h`;

                  // Try to enrich with matching weather.hourly if fields missing
                  const match = weather?.hourly?.find?.((h: WindDataPoint) => h.timeISO === point.timeISO);
                  const iconCandidate = point.icon ?? point.weatherCode ?? match?.icon ?? match?.weatherCode;
                  const descCandidate = point.description ?? match?.description;

                  // Weather icon & precipitation
                  const iconSrc = getWeatherIconPath(iconCandidate, descCandidate);
                  const _precip = (() => {
                    const v = point.precipMM ?? point.precipMm ?? point.rain ?? point.precipitation ?? match?.precipMM ?? match?.precipMm ?? match?.rain ?? match?.precipitation;
                    return typeof v === 'number' ? v : 0;
                  })();
                 
                   return (
                     <div key={i} className="flex flex-col items-center min-w-fit px-2 py-1 rounded text-xs bg-black/10 text-white">
                       <Image 
                         src={iconSrc}
                         alt={typeof descCandidate === 'string' ? descCandidate : 'Weather'}
                         width={24}
                         height={24}
                         className="w-6 h-6 mb-1"
                         unoptimized
                       />
                       <div className="opacity-70">{time}</div>
                       <div className="font-mono">{display}</div>
                       <div className="opacity-70">{degToCompass(point.windDirection ?? point.wind_deg)}</div>
                       
                     </div>
                   );
                 })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WindCard;