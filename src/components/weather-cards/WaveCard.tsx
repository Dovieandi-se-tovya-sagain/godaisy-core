'use client';

import React, { useState, useEffect } from 'react';
import { getWaveDescription } from '../../utils/weatherLabels';
import { classifyCurrentStrength } from '../../utils/currentStrength';
import { TranslatedText } from '../translation/TranslatedFishCard';

interface WaveCardProps {
  waveHeightM?: number | null;
  wavePeriodS?: number | null;
  waveDir?: number | null;
  swellHeightM?: number | null;
  swellPeriodS?: number | null;
  swellDir?: number | null;
  windSpeedMS?: number | null;
  windDir?: number | null;
  seaTemp?: number | null; // Pass Stormglass SST (°C); displayed as-is (clamped 0–40°C)
  waveSeries?: Array<{height: number | null; time?: string}> | Array<number | null>;
  lat?: number;
  lon?: number;
  currentSpeedMS?: number | null;
  currentDirectionDeg?: number | null;
}

// Temporary fallback data for standalone component
const marineNow = {
  wave: { height: 1.2, period: 8, dir: 180 },
  wind: { speed: 20, dir: 190 },
  seaTemp: 18
};

// Helper functions (temporarily inline)
const formatTimeConsistent = (date: Date): string => {
  // Use LOCAL time for UI tooltips and labels
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const periodClass = (period: number): string => {
  if (period < 6) return 'badge-error';
  if (period < 10) return 'badge-warning'; 
  return 'badge-success';
};

const degToCompass = (deg: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(deg / 22.5) % 16];
};

// Type guard for wave series object items
function isWaveSeriesObj(item: unknown): item is { height: number | null; time?: string } {
  if (typeof item !== 'object' || item === null) return false;
  const maybe = item as { height?: unknown };
  return typeof maybe.height === 'number' || maybe.height === null;
}

// Enhanced compass component with directional arrows and clear labels
const Compass: React.FC<{
  swellDir: number;
  swellMag: number;
  windDir: number;
  windMag: number;
}> = ({ swellDir, swellMag, windDir, windMag }) => {
  // Arrow component for displaying direction vectors
  const ArrowFromDirection = ({
    degrees, 
    thickness = 2, 
    length = 25, 
    color = 'white',
    label = ''
  }: {
    degrees: number; 
    thickness?: number; 
    length?: number; 
    color?: string;
    label?: string;
  }) => {
    // Calculate the center and points for an arrow coming FROM the given direction
    // (Arrow pointing toward the center, indicating wind/waves coming from that direction)
    const radians = (degrees - 90) * (Math.PI / 180); // -90 to start from north
    
    // Center point is 40,40
    const center = { x: 40, y: 40 };
    
    // Arrow starts from outside (tail) and points toward center (head)
    const tail = {
      x: center.x + Math.cos(radians) * length,
      y: center.y + Math.sin(radians) * length
    };
    
    // Arrow shaft extends from tail toward center, but not all the way
    const shaftEnd = {
      x: center.x + Math.cos(radians) * (length * 0.3), // Stop short of center
      y: center.y + Math.sin(radians) * (length * 0.3)
    };
    
    return (
      <g>
        <title>{`${label} coming from ${Math.round(degrees)}°`}</title>
        
        {/* Arrow shaft */}
        <line
          x1={tail.x}
          y1={tail.y}
          x2={shaftEnd.x}
          y2={shaftEnd.y}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        
        {/* Arrowhead at the center-facing end */}
        <polygon
          points={`
            ${shaftEnd.x},${shaftEnd.y} 
            ${shaftEnd.x + Math.cos(radians + Math.PI/2) * 4},${shaftEnd.y + Math.sin(radians + Math.PI/2) * 4}
            ${shaftEnd.x - Math.cos(radians) * 8},${shaftEnd.y - Math.sin(radians) * 8}
            ${shaftEnd.x + Math.cos(radians - Math.PI/2) * 4},${shaftEnd.y + Math.sin(radians - Math.PI/2) * 4}
          `}
          fill={color}
        />
      </g>
    );
  };

  // Simplified direction name (N, NE, E, etc)
  const swellDirName = degToCompass(swellDir);
  const windDirName = degToCompass(windDir);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-center mb-1 text-xs">
        <div className="font-medium">Wave & Wind Direction</div>
        <div className="opacity-80 font-semibold">Arrows point TO shore FROM sea/air</div>
      </div>
      <div className="relative w-28 h-28 mx-auto">
        <svg width="112" height="112" viewBox="0 0 80 80" className="absolute inset-0">
          {/* Compass circle */}
          <circle
            cx="40"
            cy="40"
            r="38"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
          
          {/* Cardinal directions - made bolder and more prominent */}
          <text x="40" y="10" textAnchor="middle" fontSize="12" fill="currentColor" opacity="1.0" fontWeight="bold">N</text>
          <text x="70" y="40" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.9" fontWeight="bold">E</text>
          <text x="40" y="72" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.9" fontWeight="bold">S</text>
          <text x="10" y="40" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.9" fontWeight="bold">W</text>
          
          {/* Intercardinal directions - kept lighter */}
          <text x="59" y="21" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">NE</text>
          <text x="59" y="61" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">SE</text>
          <text x="21" y="61" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">SW</text>
          <text x="21" y="21" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">NW</text>
          
          {/* Wind arrow (thinner) */}
          <ArrowFromDirection 
            degrees={windDir} 
            thickness={2} 
            length={36} 
            color="rgba(255,255,255,0.8)" 
            label="Wind"
          />
          
          {/* Wave/swell arrow (thicker) */}
          <ArrowFromDirection 
            degrees={swellDir} 
            thickness={4} 
            length={36} 
            color="rgba(59,130,246,0.9)" 
            label="Swell"
          />
        </svg>
      </div>
      <div className="flex flex-col w-full text-xs mt-2">
        <div className="flex justify-center gap-4 mb-2">
          <div className="flex items-center gap-1 opacity-80 bg-slate-800/30 px-3 py-1 rounded">
            <span style={{ display:'inline-block', width:12, height:2, background:'white', borderRadius:2 }} />
            <span>Wind: {windDirName} {Math.round(windDir)}° ({Math.round(windMag)} km/h)</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800/30 px-3 py-1 rounded">
            <span style={{ display:'inline-block', width:12, height:4, background:'rgb(59,130,246)', borderRadius:2 }} />
            <span>Swell: {swellDirName} {Math.round(swellDir)}° ({swellMag.toFixed(1)}m)</span>
          </div>
        </div>
        <div className="text-center opacity-70 text-[10px] bg-slate-800/25 py-1 rounded">
          <span>Example: &quot;NW&quot; means waves/wind coming <strong>from</strong> northwest <strong>toward</strong> shore</span>
        </div>
      </div>
    </div>
  );
};

export const WaveCard: React.FC<WaveCardProps> = ({
  waveHeightM,
  wavePeriodS,
  waveDir,
  swellHeightM,
  swellPeriodS,
  swellDir,
  windSpeedMS,
  windDir,
  seaTemp,
  waveSeries,
  lat: _lat,
  lon: _lon,
  currentSpeedMS,
  currentDirectionDeg,
}) => {
  // Check if we have Stormglass-like marine data
  const hasMarineData = (
    typeof waveHeightM === 'number' ||
    typeof swellHeightM === 'number' ||
    (Array.isArray(waveSeries) && waveSeries.some(item => {
      if (typeof item === 'number') return Number.isFinite(item);
      if (item === null) return false;
      if (isWaveSeriesObj(item)) return typeof item.height === 'number' && Number.isFinite(item.height);
      return false;
    }))
  );

  // State to hold the displayed temperature, preventing flash from fallback to API data
  const [displayTemp, setDisplayTemp] = useState<number | null>(null);

  useEffect(() => {
    if (typeof seaTemp === 'number') {
      const validated = Math.max(0, Math.min(40, seaTemp));
      setDisplayTemp(validated);
    } else {
      setDisplayTemp(null);
    }
  }, [seaTemp]);

  // Hide the card entirely for inland locations (no marine data)
  if (!hasMarineData) return null;

  // Prefer primary swell metrics for surf alignment; fall back to significant wave state
  const baseHeightM = typeof swellHeightM === 'number' ? swellHeightM : (typeof waveHeightM === 'number' ? waveHeightM : marineNow.wave.height);
  const basePeriodS = typeof swellPeriodS === 'number' ? swellPeriodS : (typeof wavePeriodS === 'number' ? wavePeriodS : marineNow.wave.period);
  const baseDirDeg = typeof swellDir === 'number' ? swellDir : (typeof waveDir === 'number' ? waveDir : marineNow.wave.dir);
  const ws = typeof windSpeedMS === 'number' ? windSpeedMS : (marineNow.wind.speed / 3.6);
  const wdeg = typeof windDir === 'number' ? windDir : marineNow.wind.dir;
  const explanationSentence = getWaveDescription(baseHeightM);
  const currentSpeed = typeof currentSpeedMS === 'number' ? currentSpeedMS : null;
  const currentDir = typeof currentDirectionDeg === 'number' ? currentDirectionDeg : null;
  const currentStrengthLabel = currentSpeed != null ? classifyCurrentStrength(currentSpeed) : null;
  const currentDirectionLabel = currentDir != null ? `${degToCompass(currentDir)} (${Math.round(currentDir)}°)` : null;
  
  // Use parametric wave SVG with period and height values
  const parametricWaveIconSrc = '/wave-period-icons/parametric-wave.svg';
  
  // Water temperature badge colour based on precise temperature ranges
  const getSeaTempColor = (temp: number): string => {
    if (temp <= 5) return '#08306b';      // 0-5°C: Deep navy blue (Arctic cold)
    if (temp <= 10) return '#2171b5';     // 6-10°C: Medium blue (Very cold)
    if (temp <= 15) return '#41b6c4';     // 11-15°C: Teal-cyan (Chilly)
    if (temp <= 18) return '#a1dab4';     // 16-18°C: Light aqua (Cool, swimmable)
    if (temp <= 21) return '#ffffb2';     // 19-21°C: Warm yellow (Normal lower range)
    if (temp <= 24) return '#fecc5c';     // 22-24°C: Orange-gold (Normal upper range)
    if (temp <= 27) return '#fd8d3c';     // 25-27°C: Deep orange (Warm/hot)
    if (temp <= 30) return '#e31a1c';     // 28-30°C: Bright red (Very hot)
    return '#b10026';                     // 31°C+: Dark crimson (Extreme/tropical hot)
  };
  
  const tempBadgeStyle: React.CSSProperties = displayTemp !== null ? {
    backgroundColor: getSeaTempColor(displayTemp),
    color: displayTemp <= 21 ? '#000' : '#fff', // Dark text for lighter colors (up to yellow), white for darker colors
    border: 'none',
    fontWeight: 'bold'
  } : {};
  
  const series = Array.isArray(waveSeries) ? 
    waveSeries.map((item, i) => {
      if (typeof item === 'number' || item === null) {
        // Legacy format - generate approximate times
        const now = new Date();
        const time = new Date(now.getTime() + i * 60 * 60 * 1000); // Hourly intervals
        return { height: item, time: formatTimeConsistent(time) };
      }
      return item; // New format with time data
    }).filter(item => item.height !== null) as Array<{height: number; time: string}> : [];
  const maxH = series.length ? Math.max(...series.map(s => s.height)) : null;
  const chartMaxM = Math.max(1, Math.ceil((maxH ?? baseHeightM)));

  // Prepare wave data for table
  const waveData = [
    { id: 'p', kind: 'Wave', height: (typeof waveHeightM === 'number' ? waveHeightM : baseHeightM), period: (typeof wavePeriodS === 'number' ? wavePeriodS : basePeriodS), direction: (typeof waveDir === 'number' ? waveDir : baseDirDeg) },
    (typeof swellHeightM === 'number' && typeof swellPeriodS === 'number' && typeof swellDir === 'number') ? 
      { id: 's1', kind: 'Swell', height: swellHeightM, period: swellPeriodS, direction: swellDir } : null,
  ].filter(Boolean) as Array<{ id: string; kind: string; height: number; period: number; direction: number }>;

  return (
    <div className="card weather-card-bg text-base-content h-full">
      <div className="card-body p-4">
        <div className="card__header-title mb-2 flex flex-col items-start">
          <span><TranslatedText text="Waves" /></span>
          {explanationSentence && (
            <span className="text-sm font-normal opacity-80"><TranslatedText text={explanationSentence} /></span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-end gap-3">
            {/* Parametric wave SVG with period and height values */}
            <div className="w-16 h-16 relative">
              <object 
                type="image/svg+xml"
                data={parametricWaveIconSrc}
                className="w-full h-full object-contain"
                style={{ '--period': `${basePeriodS}s`, '--height-m': baseHeightM.toFixed(1) } as React.CSSProperties}
                aria-label={`${basePeriodS.toFixed(1)}s period, ${baseHeightM.toFixed(1)}m height wave`}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold">{baseHeightM.toFixed(1)} m</span>
              <span className="text-sm opacity-80">Waves every {Math.round(basePeriodS)} seconds</span>
            </div>
          </div>
        </div>
        <div className="mt-1">
          {displayTemp !== null ? (
            <span className="badge" style={tempBadgeStyle}>Sea {displayTemp.toFixed(1)}°C</span>
          ) : (
            <span className="badge badge-ghost">Sea temp unavailable</span>
          )}
        </div>

        {/* Wave Details moved to unexpanded card */}
        <div className="mt-3 bg-slate-800/25 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-2"><TranslatedText text="Wave Details" /></h4>
          <div className="flex flex-col gap-2">
            {waveData.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="font-medium">{s.kind}:</span>
                <span>{s.height.toFixed(1)}m</span>
                <span className={`badge badge-sm ${periodClass(s.period)}`}>
                  {s.period.toFixed(1)}s
                </span>
                <span className="opacity-70">
                  {degToCompass(s.direction)} ({Math.round(s.direction)}°)
                </span>
              </div>
            ))}
            {currentSpeed != null && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">Currents:</span>
                <span>{currentStrengthLabel?.toLowerCase().includes('current') ? currentStrengthLabel : `${currentStrengthLabel} current`}</span>
                <span className="opacity-70">({currentSpeed.toFixed(1)} m/s)</span>
                {currentDirectionLabel && (
                  <span className="opacity-70">{currentDirectionLabel}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <details className="collapse collapse-arrow mt-2">
          <summary className="collapse-title text-sm opacity-80">Details</summary>
          <div className="collapse-content">
            <div className="flex flex-col gap-3">
              {/* Direction compass row */}
              <div className="bg-slate-800/25 p-2 rounded-lg flex justify-center">
                <Compass 
                  swellDir={typeof swellDir === 'number' ? swellDir : baseDirDeg} 
                  swellMag={typeof swellHeightM === 'number' ? swellHeightM : baseHeightM} 
                  windDir={wdeg} 
                  windMag={(ws || 0) * 3.6} 
                />
              </div>
            </div>

            <div className="mt-3">
              <h4 className="text-sm mb-1">Next 18h wave height</h4>
              <div className="rounded-box bg-slate-800/32 backdrop-blur-sm p-3">
                <div className="relative h-16">
                  {/* 1m interval grid lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: chartMaxM }, (_, idx) => {
                      const m = idx + 1; // 1m..chartMaxM
                      const bottom = (m / chartMaxM) * 100;
                      return (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-base-100/20"
                          style={{ bottom: `${bottom}%` }}
                        >
                          <span className="absolute right-0 -translate-y-1/2 pr-1 text-[10px] opacity-60">{m}m</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bars */}
                  <div className="relative flex items-end gap-1 h-full">
                    {(series.length ? series.slice(0, 18) : Array.from({ length: 18 }, (_, i) => {
                      const now = new Date();
                      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
                      return { height: null, time: formatTimeConsistent(time) } as {height: number | null; time: string};
                    })).map((item, i) => {
                      const pct = item.height != null 
                        ? Math.max(6, Math.min(100, Math.round((item.height / chartMaxM) * 100)))
                        : 10;
                      // Format tooltip time as local time if ISO-like, otherwise use given label
                      const tipTime = (() => {
                        const t = item.time;
                        const d = new Date(t);
                        if (!Number.isNaN(d.getTime())) {
                          return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                        }
                        return t;
                      })();
                      return (
                        <div 
                          key={i} 
                          className="tooltip w-3 bg-base-content/40 rounded-t hover:bg-base-content/60 transition-colors" 
                          style={{ height: `${pct}%` }} 
                          data-tip={item.height !== null ? `${tipTime}: ${item.height.toFixed(1)}m` : `${tipTime}: No data`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs opacity-70">
                Forecast updated: {formatTimeConsistent(new Date())}
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
