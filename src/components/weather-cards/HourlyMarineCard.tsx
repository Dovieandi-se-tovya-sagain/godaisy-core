'use client';

import React from 'react';
import Image from 'next/image.js';
import BeaufortIcon from '../BeaufortIcon';
import WindDirectionIcon from '../WindDirectionIcon';
import { HourlyWithEventsItem, HourlyWithEventsHour, HourlyWithEventsTide, HourlyWithEventsSun } from '../../types/weather';

interface HourlyMarineCardProps {
  hourlyWithEvents: HourlyWithEventsItem[];
  aqiAssess: { overall?: number } | undefined;
  pollenAssess: { overall: number };
  pollenBadgeClass: string;
  hasMarine: boolean;
}

// Type guards
function isHour(item: HourlyWithEventsItem): item is HourlyWithEventsHour { return item.kind === 'hour'; }
function isTide(item: HourlyWithEventsItem): item is HourlyWithEventsTide { return item.kind === 'tide'; }
function isSun(item: HourlyWithEventsItem): item is HourlyWithEventsSun { return item.kind === 'sun'; }

// Helper functions (moved from main file)
const fmtTimeHM = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } catch {
    return '—';
  }
};

const degToCompassHourly = (deg?: number) => {
  if (deg == null) return '—';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(deg / 22.5) % 16];
};

const getAirQualityLevelDescription = (level: number): string => {
  if (level <= 1) return 'quality is great';
  if (level <= 2) return 'quality is OK';
  if (level <= 3) return 'Pollution levels are really bad';
  return 'Hazardous';
};

const getPollenLevelDescription = (level: number): string => {
  if (level <= 1) return 'level is low';
  if (level <= 2) return 'level is moderate';
  if (level <= 3) return 'level is high';
  return 'is very high';
};

// Determine if a time is during night using sunrise/sunset events; fallback to hour-of-day heuristic
const isNightAt = (timeISO: string, events: HourlyWithEventsItem[]): boolean => {
  try {
    const t = new Date(timeISO).getTime();
    const suns = events.filter(isSun).map(s => ({
      t: new Date(s.timeISO).getTime(),
      sub: s.sub,
    })).sort((a,b) => a.t - b.t);

    // Find the most recent sun event before time t
    let lastBefore: { t: number; sub: 'sunrise' | 'sunset' } | undefined;
    for (const s of suns) {
      if (s.t <= t) lastBefore = s;
      else break;
    }
    if (lastBefore) {
      return lastBefore.sub === 'sunset';
    }
    // If none before, use next events to infer
    const next = suns.find(s => s.t > t);
    if (next) {
      // If the next event is sunrise, we're currently in night; if next is sunset, we're in day
      return next.sub === 'sunrise';
    }
    // Fallback heuristic: 6-20h = day
    const hour = new Date(timeISO).getHours();
    return hour < 6 || hour >= 20;
  } catch {
    return false;
  }
};

// Map weather codes/descriptions to actual SVG filenames with day/night variants
const getWeatherIconPath = (iconCode?: string | number, description?: string, isNight?: boolean): string => {
  const variant = isNight ? 'n' : 'd';

  // OpenWeather icon mapping
  if (typeof iconCode === 'string') {
    // If it's already an OpenWeather icon code (like "01d", "10n", etc.)
    if (iconCode.match(/^\d{2}[dn]$/)) {
      const base = iconCode.slice(0, 2);
      return `/weather-icons/design/fill/final/${base}${variant}.svg`;
    }
  }
  
  // Handle numeric weather codes (convert to OpenWeather icon codes)
  if (typeof iconCode === 'number') {
    // Thunderstorm
    if (iconCode >= 200 && iconCode < 300) return `/weather-icons/design/fill/final/11${variant}.svg`;
    // Drizzle  
    if (iconCode >= 300 && iconCode < 400) return `/weather-icons/design/fill/final/09${variant}.svg`;
    // Rain
    if (iconCode >= 500 && iconCode < 600) return `/weather-icons/design/fill/final/10${variant}.svg`;
    // Snow
    if (iconCode >= 600 && iconCode < 700) return `/weather-icons/design/fill/final/13${variant}.svg`;
    // Fog/Mist
    if (iconCode >= 700 && iconCode < 800) return `/weather-icons/design/fill/final/50${variant}.svg`;
    // Clear
    if (iconCode === 800) return `/weather-icons/design/fill/final/01${variant}.svg`;
    // Clouds
    if (iconCode === 801) return `/weather-icons/design/fill/final/02${variant}.svg`;
    if (iconCode === 802) return `/weather-icons/design/fill/final/03${variant}.svg`;
    if (iconCode >= 803) return `/weather-icons/design/fill/final/04${variant}.svg`;
  }
  
  // Handle string descriptions as fallback
  const desc = String(iconCode || description || '').toLowerCase();
  if (desc.includes('clear')) return `/weather-icons/design/fill/final/01${variant}.svg`;
  if (desc.includes('cloud')) return `/weather-icons/design/fill/final/04${variant}.svg`;
  if (desc.includes('rain')) return `/weather-icons/design/fill/final/10${variant}.svg`;
  if (desc.includes('snow')) return `/weather-icons/design/fill/final/13${variant}.svg`;
  if (desc.includes('thunder')) return `/weather-icons/design/fill/final/11${variant}.svg`;
  if (desc.includes('fog') || desc.includes('mist')) return `/weather-icons/design/fill/final/50${variant}.svg`;
  
  // Default fallback
  return `/weather-icons/design/fill/final/01${variant}.svg`;
};

// Normalizers for marine hourly (typed)
type HourHour = HourlyWithEventsHour['hour'];
const msFrom = (h: HourHour): number => {
  if (typeof h.windMS === 'number') return h.windMS;
  if (typeof h.wind === 'number') return h.wind / 3.6; // km/h -> m/s
  return 0;
};
const kmhFrom = (h: HourHour): number => msFrom(h) * 3.6;
const ktsFrom = (h: HourHour): number => msFrom(h) * 1.94384;
const gustMsFrom = (h: HourHour): number | undefined => {
  if (typeof h.gust === 'number') return h.gust / 3.6; // km/h -> m/s
  return undefined;
};
const precipMmFrom = (h: HourHour): number => {
  const v = h.precipMM ?? 0;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

// Compute UV icon asset path and color class
const uvIconPath = (uv?: number): string | null => {
  if (typeof uv !== 'number' || Number.isNaN(uv)) return null;
  const v = Math.min(11, Math.max(1, Math.round(uv)));
  const plus = uv >= 11 ? '-plus' : '';
  return `/weather-icons/design/fill/final/uv-index-${v}${plus}.svg`;
};
const getUVLevelDescription = (uv: number): string => {
  if (!Number.isFinite(uv)) return '';
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very high';
  return 'Extreme';
};

// New: AQI and Pollen icon paths (match non-marine)
const aqiIconPath = (level?: number): string | null => {
  if (!level || Number.isNaN(level)) return null;
  const v = Math.min(6, Math.max(1, Math.round(level)));
  return `/weather-icons/design/fill/final/aqi-index-${v}.svg`;
};
const pollenIconPath = (level?: number): string | null => {
  if (typeof level !== 'number' || Number.isNaN(level)) return null;
  const v = Math.min(4, Math.max(1, Math.round(level)));
  return `/weather-icons/design/fill/final/pollen-index-${v}.svg`;
};

export const HourlyMarineCard: React.FC<HourlyMarineCardProps> = ({
  hourlyWithEvents,
  aqiAssess,
  pollenAssess,
  pollenBadgeClass: _pollenBadgeClass,
  hasMarine: _hasMarine,
}) => {
  return (
    <div className="flex flex-col">
      {/* <h2 className="text-sm opacity-70 mb-2 flex items-center gap-2">
        Hourly {hasMarine && (<span className="badge badge-info badge-outline badge-xs">Marine</span>)}
      </h2> */}
      <div className="card bg-transparent shadow-none h-full">
        <div className="card-body p-0 h-full">
          <div className="carousel rounded-box space-x-2 bg-transparent h-full">
            {hourlyWithEvents.map((it) => (
              <div className="carousel-item" key={it.key}>
                {isHour(it) ? (
                  <div className="card weather-card-bg-small text-white w-36 h-full">
                    <div className="card-body p-3 items-center text-center h-full flex flex-col justify-between">
                        {/* Hour label (timestamp) to match non-marine cards */}
                        <div className="text-[11px] opacity-70">
                          {fmtTimeHM(it.hour.timeISO)}
                        </div>
                        {/* Dynamic icon mapping with night/day variant */}
                        {(() => {
                          const night = isNightAt(it.hour.timeISO ?? '', hourlyWithEvents);
                          const iconSrc = getWeatherIconPath(it.hour.weatherCode ?? it.hour.icon, it.hour.description, night);
                          return (
                            <Image 
                              src={iconSrc} 
                              alt={it.hour.description || "Weather icon"} 
                              width={40} 
                              height={40} 
                              className="w-10 h-10 mx-auto my-1" 
                              unoptimized 
                            />
                          );
                        })()}
                        <div className="text-3xl font-bold leading-none">{it.hour.temp}°</div>
                        <div className="mt-1">
                          <div className="relative flex items-center justify-center">
                            <Image 
                              src="/weather-icons/design/fill/final/raindrops.svg" 
                              alt="Precipitation" 
                              width={56} 
                              height={56} 
                              className="w-14 h-14" 
                            />
                            <span className="absolute text-[12px] font-medium text-white">
                              {Math.ceil(precipMmFrom(it.hour))}mm
                            </span>
                          </div>
                        </div>
                        {/* Wind */}
                        <div className="mt-2 text-sm leading-snug text-white/90 w-full space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <BeaufortIcon windMS={msFrom(it.hour)} size={30} />
                            <WindDirectionIcon deg={it.hour.windDeg || 0} size={16} />
                            <span>{degToCompassHourly(it.hour.windDeg)}</span>
                          </div>
                          <div>
                            {Math.round(kmhFrom(it.hour))} km/h{(() => { const g = gustMsFrom(it.hour); return typeof g === 'number' ? ` (${Math.round(g * 3.6)})` : ''; })()}
                          </div>
                          <div>
                            {Math.round(ktsFrom(it.hour))} knots{(() => { const g = gustMsFrom(it.hour); return typeof g === 'number' ? ` (${Math.round(g * 1.94384)})` : ''; })()}
                          </div>
                          {/* Marine extras */}
                          <div className="flex items-center justify-center gap-1">
                            {(() => {
                              const period = typeof it.hour.wavePeriodS === 'number' ? it.hour.wavePeriodS : 10; // fallback to 10s
                              const pIcon = Math.max(1, Math.min(20, Math.round(period)));
                              const periodIconSrc = `/wave-period-icons/wave-period-${pIcon}s.svg`;
                              return (
                                <div className="tooltip" data-tip={`${period.toFixed(1)}s period`}>
                                  <Image 
                                    src={periodIconSrc} 
                                    alt={`${pIcon}s period`} 
                                    width={16} 
                                    height={16} 
                                    className="w-4 h-4" 
                                  />
                                </div>
                              );
                            })()}
                            <span>{typeof it.hour.waveHeightM === 'number' ? it.hour.waveHeightM.toFixed(1) : '—'} m</span>
                          </div>
                          {/* UV, AQI, and Pollen icons */}
                          <div className="flex flex-col items-center gap-0 mt-1">
                            {typeof it.hour.uvi === 'number' && (
                              <div className="flex items-center gap-1">
                                {(() => {
                                  const path = uvIconPath(it.hour.uvi);
                                  if (!path) return null;
                                  return (
                                    <div className="tooltip" data-tip={`UV ${getUVLevelDescription(it.hour.uvi)}`}>
                                      <Image 
                                        src={path}
                                        alt={`UV ${Math.round(it.hour.uvi)}`}
                                        width={54}
                                        height={54}
                                        className="w-[54px] h-[54px]"
                                      />
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {(() => {
                              const pollenLevel = typeof (it as HourlyWithEventsHour).hour?.pollenOverall === 'number' 
                                ? (it as HourlyWithEventsHour).hour.pollenOverall 
                                : (typeof pollenAssess?.overall === 'number' ? pollenAssess.overall : undefined);
                              const aqiPath = aqiIconPath(aqiAssess?.overall);
                              const pollenPath = pollenIconPath(pollenLevel);
                              const aqiDesc = getAirQualityLevelDescription(aqiAssess?.overall || 0);
                              const pollenDesc = typeof pollenLevel === 'number' ? getPollenLevelDescription(pollenLevel) : '';
                              if (aqiPath && pollenPath) {
                                return (
                                  <label className="swap swap-flip cursor-pointer leading-none" title="Toggle Air/Pollen">
                                    <input type="checkbox" />
                                    <span className="swap-off inline-flex">
                                      <div className="tooltip" data-tip={`Air ${aqiDesc}`}>
                                        <Image src={aqiPath} alt={`Air ${aqiDesc}`} width={54} height={54} className="w-[54px] h-[54px]" />
                                      </div>
                                    </span>
                                    <span className="swap-on inline-flex">
                                      <div className="tooltip" data-tip={`Pollen ${pollenDesc}`}>
                                        <Image src={pollenPath} alt={`Pollen ${pollenDesc}`} width={54} height={54} className="w-[54px] h-[54px]" />
                                      </div>
                                    </span>
                                  </label>
                                );
                              }
                              if (aqiPath) {
                                return (
                                  <div className="tooltip" data-tip={`Air ${aqiDesc}`}>
                                    <Image src={aqiPath} alt={`Air ${aqiDesc}`} width={54} height={54} className="w-[54px] h-[54px]" />
                                  </div>
                                );
                              }
                              if (pollenPath) {
                                return (
                                  <div className="tooltip" data-tip={`Pollen ${pollenDesc}`}>
                                    <Image src={pollenPath} alt={`Pollen ${pollenDesc}`} width={54} height={54} className="w-[54px] h-[54px]" />
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                ) : isTide(it) ? (
                  <div className="card weather-card-bg-small text-white w-32 h-full">
                    <div className="card-body p-1 items-center text-center h-full flex flex-col">
                      {it.sub === 'high' ? (
                        // High tide: icon at top
                        <>
                          <div className="flex-none">
                            <div className="text-[11px] opacity-70">{fmtTimeHM(it.timeISO)}</div>
                            <div className="text-sm font-semibold capitalize">{it.sub} tide</div>
                          </div>
                          <div className="flex-1 flex items-center justify-center">
                            <Image src="/weather-icons/design/fill/final/tide-high.svg" alt="" width={128} height={128} className="w-32 h-32" />
                          </div>
                          <div className="flex-none">
                            {typeof it.height === 'number' && (
                              <div className="text-xs opacity-90">{it.height.toFixed(2)} m</div>
                            )}
                          </div>
                        </>
                      ) : (
                        // Low tide: icon at bottom
                        <>
                          <div className="flex-none">
                            <div className="text-[11px] opacity-70">{fmtTimeHM(it.timeISO)}</div>
                            <div className="text-sm font-semibold capitalize">{it.sub} tide</div>
                          </div>
                          <div className="flex-1 flex items-end justify-center">
                            <Image src="/weather-icons/design/fill/final/tide-low.svg" alt="" width={128} height={128} className="w-32 h-32" />
                          </div>
                          <div className="flex-none">
                            {typeof it.height === 'number' && (
                              <div className="text-xs opacity-90">{it.height.toFixed(2)} m</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : isSun(it) ? (
                  <div className="card weather-card-bg-small text-white w-32 h-full">
                    <div className="card-body p-3 items-center text-center h-full flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] opacity-70">{fmtTimeHM((it as HourlyWithEventsSun).timeISO)}</div>
                        <Image 
                          src={(it as HourlyWithEventsSun).sub === 'sunrise' ? '/weather-icons/design/fill/final/sunrise.svg' : '/weather-icons/design/fill/final/sunset.svg'} 
                          alt={(it as HourlyWithEventsSun).sub || 'sun'} 
                          width={40} 
                          height={40} 
                          className="w-10 h-10 mx-auto my-2" 
                        />
                        <div className="text-sm font-semibold capitalize">{(it as HourlyWithEventsSun).sub}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
