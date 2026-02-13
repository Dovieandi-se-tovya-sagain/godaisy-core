import React from 'react';
import Image from 'next/image.js';
import BeaufortIcon from '../BeaufortIcon';
import WindDirectionIcon from '../WindDirectionIcon';

interface HourlyEvent {
  kind: 'hour' | 'sunrise' | 'sunset' | string;
  key: string;
  timeISO?: string;
  hour?: {
    label: string;
    temp: number;
    icon?: string | number;
    weatherCode?: number;
    description?: string;
    // Precipitation in mm for the hour
    precipMM?: number;
    // Optional alternative precipitation keys some sources use
    precip?: number;
    precipitation?: number;
    rainMM?: number;
    // Wind: prefer m/s internally
    windMS?: number;
    // Fallbacks if only km/h or knots are provided
    wind?: number; // km/h
    windKts?: number; // knots
    windDeg?: number;
    // Gusts
    gust?: number; // km/h
    gustMS?: number; // m/s
    gustKts?: number; // knots
    uvi?: number;
    // Optional per-hour environmental indicators
    pollenOverall?: number; // 1..4
    aqiOverall?: number; // 1..6
  };
}

interface AQIAssess {
  overall?: number;
}

interface PollenAssess {
  overall: number;
}

interface HourlyCardProps {
  hourlyWithEvents: HourlyEvent[];
  aqiAssess: AQIAssess;
  pollenAssess: PollenAssess;
  pollenBadgeClass: string;
}

// Helper functions
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

// Add: UV level description for tooltip text
const getUVLevelDescription = (uv: number): string => {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
};

// Compute UV icon asset path and text color (mirrors marine hourly card)
const uvIconPath = (uv?: number): string | null => {
  if (typeof uv !== 'number' || Number.isNaN(uv)) return null;
  const v = Math.min(11, Math.max(1, Math.round(uv)));
  const plus = uv >= 11 ? '-plus' : '';
  return `/weather-icons/design/fill/final/uv-index-${v}${plus}.svg`;
};

// New: AQI and Pollen icon paths
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

// Map weather codes/descriptions to actual SVG filenames
const getWeatherIconPath = (iconCode?: string | number, description?: string): string => {
  // OpenWeather icon mapping
  if (typeof iconCode === 'string') {
    // If it's already an OpenWeather icon code (like "01d", "10n", etc.)
    if (iconCode.match(/^\d{2}[dn]$/)) {
      return `/weather-icons/design/fill/final/${iconCode}.svg`;
    }
  }
  
  // Handle numeric weather codes (convert to OpenWeather icon codes)
  if (typeof iconCode === 'number') {
    // Thunderstorm
    if (iconCode >= 200 && iconCode < 300) return '/weather-icons/design/fill/final/11d.svg';
    // Drizzle  
    if (iconCode >= 300 && iconCode < 400) return '/weather-icons/design/fill/final/09d.svg';
    // Rain
    if (iconCode >= 500 && iconCode < 600) return '/weather-icons/design/fill/final/10d.svg';
    // Snow
    if (iconCode >= 600 && iconCode < 700) return '/weather-icons/design/fill/final/13d.svg';
    // Fog/Mist
    if (iconCode >= 700 && iconCode < 800) return '/weather-icons/design/fill/final/50d.svg';
    // Clear
    if (iconCode === 800) return '/weather-icons/design/fill/final/01d.svg';
    // Clouds
    if (iconCode === 801) return '/weather-icons/design/fill/final/02d.svg';
    if (iconCode === 802) return '/weather-icons/design/fill/final/03d.svg';
    if (iconCode >= 803) return '/weather-icons/design/fill/final/04d.svg';
  }
  
  // Handle string descriptions as fallback
  const desc = String(iconCode || description || '').toLowerCase();
  if (desc.includes('clear')) return '/weather-icons/design/fill/final/01d.svg';
  if (desc.includes('cloud')) return '/weather-icons/design/fill/final/04d.svg';
  if (desc.includes('rain')) return '/weather-icons/design/fill/final/10d.svg';
  if (desc.includes('snow')) return '/weather-icons/design/fill/final/13d.svg';
  if (desc.includes('thunder')) return '/weather-icons/design/fill/final/11d.svg';
  if (desc.includes('fog') || desc.includes('mist')) return '/weather-icons/design/fill/final/50d.svg';
  
  // Default fallback
  return '/weather-icons/design/fill/final/01d.svg';
};

// Normalizers
const kmhFrom = (h: NonNullable<HourlyEvent['hour']>): number => {
  if (typeof h.windMS === 'number') return h.windMS * 3.6;
  if (typeof h.wind === 'number') return h.wind;
  if (typeof h.windKts === 'number') return h.windKts * 1.852;
  return 0;
};
const gustKmhFrom = (h: NonNullable<HourlyEvent['hour']>): number | undefined => {
  if (typeof h.gustMS === 'number') return h.gustMS * 3.6;
  if (typeof h.gust === 'number') return h.gust;
  if (typeof h.gustKts === 'number') return h.gustKts * 1.852;
  return undefined;
};
const precipMmFrom = (h: NonNullable<HourlyEvent['hour']>): number => {
  const v = h.precipMM ?? h.precipitation ?? h.precip ?? h.rainMM ?? 0;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

export const HourlyCard: React.FC<HourlyCardProps> = ({
  hourlyWithEvents,
  aqiAssess,
  pollenAssess,
  pollenBadgeClass: _pollenBadgeClass,
}) => {
  return (
    <div className="flex flex-col">
      {/* <h2 className="text-sm opacity-70 mb-2 flex items-center gap-2">
        Hourly
      </h2> */}
      <div className="card bg-transparent shadow-none h-full">
        <div className="card-body p-0 h-full">
          <div className="carousel rounded-box space-x-2 bg-transparent h-full">
            {hourlyWithEvents.map((it) => (
              <div className="carousel-item" key={it.key}>
                {it.kind === 'hour' && it.hour ? (
                  <div className="card weather-card-bg-small text-white w-36 h-full">
                    <div className="card-body p-3 items-center text-center h-full flex flex-col justify-between">
                      <div className="w-full">
                        <div className="text-xs opacity-70">{it.hour.label}</div>
                        <Image 
                          src={getWeatherIconPath(it.hour.icon || it.hour.weatherCode, it.hour.description)} 
                          alt={it.hour.description || "Weather icon"} 
                          width={40} 
                          height={40} 
                          className="w-10 h-10 mx-auto my-1" 
                          unoptimized 
                        />
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
                        {/* Wind - normalized to km/h */}
                        <div className="mt-2 text-sm leading-snug text-white/90 w-full space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <BeaufortIcon windMS={it.hour.windMS || (typeof it.hour.wind === 'number' ? it.hour.wind / 3.6 : 0)} size={30} />
                            <WindDirectionIcon deg={it.hour.windDeg || 0} size={16} />
                            <span>{degToCompassHourly(it.hour.windDeg)}</span>
                          </div>
                          <div>
                            {Math.round(kmhFrom(it.hour))} km/h{typeof gustKmhFrom(it.hour) === 'number' ? ` (${Math.round(gustKmhFrom(it.hour)!) } )` : ''}
                          </div>
                          {/* Air Quality, UV icon, and Pollen */}
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
                              // Prefer per-hour values if provided
                              const aqiLevel = typeof it.hour?.aqiOverall === 'number' ? it.hour.aqiOverall : aqiAssess?.overall;
                              const pollenLevel = typeof it.hour?.pollenOverall === 'number' ? it.hour.pollenOverall : pollenAssess?.overall;
                              const aqiPath = aqiIconPath(aqiLevel);
                              const pollenPath = pollenIconPath(pollenLevel);
                              const aqiDesc = getAirQualityLevelDescription(aqiLevel || 0);
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
                  </div>
                ) : it.kind === 'sunrise' || it.kind === 'sunset' ? (
                  <div className="card weather-card-bg-small text-white w-32 h-full">
                    <div className="card-body p-3 items-center text-center h-full flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] opacity-70">{fmtTimeHM(it.timeISO)}</div>
                        <Image 
                          src={it.kind === 'sunrise' ? '/weather-icons/design/fill/final/sunrise.svg' : '/weather-icons/design/fill/final/sunset.svg'} 
                          alt={it.kind} 
                          width={40} 
                          height={40} 
                          className="w-10 h-10 mx-auto my-2" 
                        />
                        <div className="text-sm font-semibold capitalize">{it.kind}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Other event types
                  <div className="card weather-card-bg-small text-white w-32 h-full">
                    <div className="card-body p-3 items-center text-center h-full flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] opacity-70">{fmtTimeHM(it.timeISO)}</div>
                        <div className="text-sm font-semibold">{it.kind}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HourlyCard;
