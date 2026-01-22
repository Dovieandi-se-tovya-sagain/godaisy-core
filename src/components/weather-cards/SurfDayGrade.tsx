// SurfDayGrade.tsx
import React, { useState, useEffect, useRef } from "react";
import { DayMarine, gradeDay } from "../../utils/surfScoring";
import { getWaveDescription } from "../../utils/weatherLabels";
import { saveBeachOrientationOverride, getBeachOrientationOverride } from "../../utils/beachOrientationOverride";
import Image from "next/image";

// --- Persist skill selection in localStorage ---
const SKILL_STORAGE_KEY = "surfSkillOverride";

function loadSavedSkill(): "novice" | "intermediate" | "advanced" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(SKILL_STORAGE_KEY);
  return v === "novice" || v === "intermediate" || v === "advanced" ? v : null;
}

function saveSavedSkill(v: "novice" | "intermediate" | "advanced" | null) {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(SKILL_STORAGE_KEY, v);
  else window.localStorage.removeItem(SKILL_STORAGE_KEY);
}

type Props = {
  data: DayMarine; // includes hourly Stormglass marine + separate Stormglass tides + (optional) beachFacingDeg
  locationId?: string; // Optional locationId prop to identify the location - will fallback to default location if not provided
};

const colourFor = (light: "green" | "amber" | "red", isBeginnerFriendly = false) =>
  isBeginnerFriendly ? "badge-info text-white" : // Changed to white text for better contrast on blue background
  light === "green" ? "badge-success" : 
  light === "amber" ? "badge-warning" : 
  "badge-error";

// Modified text function that takes skill level into account
const textFor = (light: "green" | "amber" | "red", skill: "novice" | "intermediate" | "advanced" = "intermediate", waveHeight?: number) => {
  // For small waves that are still rideable (under 1m)
  const isSmallWaves = typeof waveHeight === 'number' && waveHeight < 1 && waveHeight >= 0.3;
  
  if (light === "green") {
    return "Good";
  } else if (light === "amber") {
    return "Fair";
  } else if (light === "red" && skill === "novice" && isSmallWaves) {
    return "Beginner friendly";
  } else {
    return "Poor";
  }
};

// Helper to check if conditions are beginner-friendly
const isBeginnerFriendly = (light: "green" | "amber" | "red", skill: "novice" | "intermediate" | "advanced" = "intermediate", waveHeight?: number) => {
  // Skip lengthy calculation if it's not a novice or not red
  if (light !== "red" || skill !== "novice") return false;
  
  // Check if wave height is in the beginner-friendly range
  return typeof waveHeight === 'number' && waveHeight < 1 && waveHeight >= 0.3;
};

// Local helper to get simple wind regime label relative to beach orientation
const getWindRegimeLabel = (beachFacingDeg?: number | null, windDirDeg?: number) => {
  if (typeof beachFacingDeg !== 'number' || typeof windDirDeg !== 'number') return null;
  const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const toSea = beachFacingDeg;
  const fromLand = (beachFacingDeg + 180) % 360;
  const dOn = angDiff(windDirDeg, toSea);
  const dOff = angDiff(windDirDeg, fromLand);
  if (dOff <= 45) return 'Offshore';
  if (dOn <= 45) return 'Onshore';
  return 'Cross-shore';
};

export default function SurfDayGrade({ data, locationId = "default-location" }: Props) {
  // State for user override
  const [orientationOverride, setOrientationOverride] = useState<number | null>(null);
  const [skillOverride, setSkillOverride] = useState<"novice" | "intermediate" | "advanced" | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);



  // Load any saved skill on mount
  useEffect(() => {
    const saved = loadSavedSkill();
    if (saved) setSkillOverride(saved);
  }, []);
  
  // Load any existing override on mount
  useEffect(() => {
    const savedOverride = getBeachOrientationOverride(locationId);
    setOrientationOverride(savedOverride);
  }, [locationId]);
  
  // Apply override if it exists
  const effectiveData = React.useMemo(() => {
    let updatedData = data;
    
    // Apply orientation override if it exists
    if (orientationOverride !== null) {
      updatedData = { ...updatedData, beachFacingDeg: orientationOverride };
    }
    
    // Apply skill level override if it exists
    if (skillOverride !== null) {
      updatedData = { ...updatedData, skill: skillOverride };
    }
    
    return updatedData;
  }, [data, orientationOverride, skillOverride]);
  
  // Modify gradeDay result to filter out night hours from best hour
  const day = React.useMemo(() => {
    const rawDayResult = gradeDay(effectiveData);
    
    // If the best hour is during nighttime (before 6 AM or after 8 PM), find the best daytime hour instead
    if (rawDayResult.bestHour) {
      const bestHourTime = new Date(rawDayResult.bestHour.ts);
      const hour = bestHourTime.getHours();
      const isNightHour = hour < 6 || hour >= 20;
      
      if (isNightHour) {
        // Find the best daytime hour instead
        const daytimeHours = rawDayResult.hours.filter(h => {
          const hourTime = new Date(h.ts);
          const hourNum = hourTime.getHours();
          return hourNum >= 6 && hourNum < 20; // Only consider hours between 6 AM and 8 PM
        });
        
        // Sort by light (green > amber > red) then by score
        const byLight = (l: "green" | "amber" | "red") => (l === "green" ? 2 : l === "amber" ? 1 : 0);
        const bestDaytimeHour = daytimeHours.length > 0 
          ? daytimeHours.sort((a, b) => byLight(b.light) - byLight(a.light) || b.score - a.score)[0] 
          : null;
        
        return {
          ...rawDayResult,
          bestHour: bestDaytimeHour
        };
      }
    }
    
    return rawDayResult;
  }, [effectiveData]);
  
  const best = day.bestHour;

  // Calculate average wave height once to avoid recalculations
  const avgWaveHeight = React.useMemo(() => {
    return effectiveData.hours.length > 0 
      ? effectiveData.hours.reduce((sum, h) => sum + h.primary.heightM, 0) / effectiveData.hours.length
      : undefined;
  }, [effectiveData.hours]);

  // Provide hours for carousel: prefer daytime hours, fall back to all hours if none, sort by timestamp, and be defensive
  const hoursForCarousel = React.useMemo(() => {
    const src = Array.isArray(day.hours) ? day.hours : [];
    if (src.length === 0) return [] as typeof day.hours;
    const daytime = src.filter(h => {
      const d = new Date(h.ts);
      const hr = Number.isFinite(d.getTime()) ? d.getHours() : 12; // default noon if bad date
      return hr >= 6 && hr < 20;
    });
    const list = (daytime.length ? daytime : src).slice().sort((a, b) => {
      const ta = typeof a.ts === 'number' ? a.ts : new Date(a.ts).getTime();
      const tb = typeof b.ts === 'number' ? b.ts : new Date(b.ts).getTime();
      return ta - tb;
    });
    return list;
  }, [day]);


  // Get badge text and color once to avoid recalculations
  const badgeInfo = React.useMemo(() => {
    return {
      color: colourFor(day.dayLight, isBeginnerFriendly(day.dayLight, effectiveData.skill, avgWaveHeight)),
      text: textFor(day.dayLight, effectiveData.skill, avgWaveHeight)
    };
  }, [day.dayLight, effectiveData.skill, avgWaveHeight]);

  // Debug: Log hour-by-hour grades to console
  React.useEffect(() => {
    console.log('Surf hour-by-hour grades:');
    day.hours.forEach(h => {
      const hourTime = new Date(h.ts);
      console.log(`${hourTime.toLocaleTimeString()}: ${h.light} (score: ${h.score})`);
    });
    
    // Log if there are mixed grades
    const uniqueLights = [...new Set(day.hours.map(h => h.light))];
    console.log('Unique grade types:', uniqueLights);
    console.log('Has mixed grades:', uniqueLights.length > 1);
  }, [day]);

  // Find the best hour data
  const bestHourData = best ? effectiveData.hours.find(h => h.ts === best.ts) : null;
  // Compute wind regime for best hour
  const bestRegimeLabel = bestHourData
    ? getWindRegimeLabel(
        typeof effectiveData.beachFacingDeg === 'number' ? effectiveData.beachFacingDeg : null,
        bestHourData?.wind?.directionDeg
      )
    : null;

  // Get wave description for best hour if available
  const getBestWaveDescription = () => {
    if (!best || !bestHourData) return "";
    return getWaveDescription(bestHourData.primary.heightM);
  };

  const waveDescription = getBestWaveDescription();
  
  // Determine which surf icon to use based on day light
  const surfIconSrc = 
    day.dayLight === "green" ? "/surf-green.svg" : 
    day.dayLight === "amber" ? "/surf-amber.svg" : "/surf-red.svg";
    
  // Handle orientation override change
  const handleOrientationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value === "" ? null : parseInt(e.target.value);
    setOrientationOverride(value);
    saveBeachOrientationOverride(locationId, value);
  };

  return (
    <div className="card weather-card-bg shadow-xl max-w-sm">
      <div className="card-body gap-3">
        <div className="flex items-center gap-3">
          <Image 
            src={surfIconSrc} 
            alt={`Surf conditions: ${textFor(day.dayLight)}`} 
            width={24} 
            height={24} 
          />
          <h2 className="card__header-title">Surf Outlook</h2>
          <div className={`badge ${badgeInfo.color} text-base-100`}>
            {badgeInfo.text}
          </div>
        </div>

        {best ? (
          <div className="border rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <div className="font-semibold">Best time</div>
                <div className="mt-1 inline-flex items-center rounded-full bg-black/10 bg-base-200/70 px-3 py-1 text-sm">
                  {new Date(best.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {bestRegimeLabel && (
                  <Image
                    src={bestRegimeLabel === 'Offshore'
                      ? '/weather-icons/design/fill/final/wind-offshore.svg'
                      : bestRegimeLabel === 'Onshore'
                        ? '/weather-icons/design/fill/final/wind-onshore.svg'
                        : '/weather-icons/design/fill/final/wind-cross.svg'}
                    alt={`${bestRegimeLabel} wind`}
                    width={80}
                    height={80}
                  />
                )}
                {bestHourData && bestHourData.primary && (
                  <div className="relative">
                    <Image 
                      src="/wave-period-icons/parametric-wave.svg"
                      alt="Wave visualization"
                      width={80}
                      height={80}
                      className="inline-block"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[14px] font-medium">
                      <span>{bestHourData.primary.heightM.toFixed(1)}m</span>
                      <span>{Math.round(bestHourData.primary.periodS)}s</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* <div className="text-sm opacity-80">
              {new Date(best.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div> */}
            
            {waveDescription && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Wave conditions:</span> {waveDescription}
              </div>
            )}
            
            <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
              {best.reasons.slice(0, 4).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="alert alert-info">No hourly data available.</div>
        )}

        {/* Hour-by-hour (always visible) */}
        <div className="mt-1">
          <div className="text-sm font-medium mb-1 flex items-center">
            Hour-by-hour
            {day.hours.length > 0 && (() => {
              const daytimeHours = day.hours.filter(h => {
                const hourTime = new Date(h.ts);
                const hour = hourTime.getHours();
                return hour >= 6 && hour < 20;
              });
              const uniqueLights = new Set(daytimeHours.map(h => h.light));
              return uniqueLights.size === 1 && (
                <span className="ml-2 text-xs opacity-70"></span>
              );
            })()}
          </div>

          {hoursForCarousel.length === 0 ? (
            <div className="text-xs opacity-70">No hourly breakdown available.</div>
          ) : (
            <div>

              <div
                ref={scrollerRef}
                className="overflow-x-auto no-scrollbar w-full px-6 pb-2 touch-pan-x overscroll-x-contain"
                style={{ scrollSnapType: 'none', WebkitOverflowScrolling: 'touch' }}
                onWheel={(e) => {
                  const el = scrollerRef.current;
                  if (!el) return;
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    el.scrollLeft += e.deltaY;
                    e.preventDefault();
                  }
                }}
              >
                <div className="flex gap-1.5 min-w-max">
                  {hoursForCarousel.map(h => {
                    const hourTime = new Date(h.ts);
                    const hourData = effectiveData.hours.find(hData => {
                      const a = typeof hData.ts === 'number' ? hData.ts : new Date(hData.ts).getTime();
                      const b = typeof h.ts === 'number' ? h.ts : new Date(h.ts).getTime();
                      return a === b;
                    });
                    const beginnerFriendly = isBeginnerFriendly(
                      h.light,
                      effectiveData.skill,
                      hourData?.primary?.heightM
                    );
                    const regimeLabel = getWindRegimeLabel(
                      typeof effectiveData.beachFacingDeg === 'number' ? effectiveData.beachFacingDeg : null,
                      hourData?.wind?.directionDeg
                    );
                    const isBest = best && h.ts === best.ts;

                    return (
                      <div key={h.ts} className={`border rounded-lg p-2 w-[110px] shrink-0 snap-start ${isBest ? 'ring ring-primary/60' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-xs">
                            {Number.isFinite(hourTime.getTime())
                              ? hourTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '--:--'}
                          </div>
                          <div className={`badge badge-xs ${colourFor(h.light, beginnerFriendly)} text-base-100`}>{textFor(h.light, effectiveData.skill, hourData?.primary?.heightM)}</div>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <Image src="/wave-period-icons/parametric-wave.svg" alt="" aria-hidden width={54} height={54} />
                          {hourData?.primary && (
                            <div className="flex flex-col text-[10px] font-medium text-left">
                              <span>{hourData.primary.heightM.toFixed(1)}m</span>
                              <span>{Math.round(hourData.primary.periodS)}s</span>
                            </div>
                          )}
                        </div>
                        {regimeLabel && (
                          <div className="mt-1 flex flex-col items-center justify-center text-[11px]">
                            {regimeLabel === 'Offshore' && (
                              <>
                                <Image src="/weather-icons/design/fill/final/wind-offshore.svg" alt="" aria-hidden width={80} height={80} />
                                <span className="mt-0.5">Offshore</span>
                              </>
                            )}
                            {regimeLabel === 'Onshore' && (
                              <>
                                <Image src="/weather-icons/design/fill/final/wind-onshore.svg" alt="" aria-hidden width={80} height={80} />
                                <span className="mt-0.5">Onshore</span>
                              </>
                            )}
                            {regimeLabel === 'Cross-shore' && (
                              <>
                                <Image src="/weather-icons/design/fill/final/wind.svg" alt="" aria-hidden width={80} height={80} />
                                <span className="mt-0.5">Cross-shore</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* More details (expander for the rest of the card) */}
        <details className="collapse collapse-arrow mt-2">
          <summary className="collapse-title text-sm font-medium">More details</summary>
          <div className="collapse-content">
            {/* Surf Advice Section */}
            <div className="mt-2">
              <h3 className={`font-medium text-sm mb-2 ${
                isBeginnerFriendly(day.dayLight, effectiveData.skill, avgWaveHeight) ? 
                  'text-info-content bg-info' :
                  day.dayLight === 'green' ? 'text-success-content bg-success' : 
                  day.dayLight === 'amber' ? 'text-warning-content bg-warning' : 
                  'text-error-content bg-error'
              } px-2 py-0.5 rounded inline-block`}>
                {isBeginnerFriendly(day.dayLight, effectiveData.skill, avgWaveHeight) ?
                  'Beginner-Friendly Surf' :
                  'Surf Advice'
                }
              </h3>
              <p className="text-sm">
                {day.dayLight === 'green' 
                  ? 'Good conditions for surfing! Check the best times above for optimal experience.'
                  : day.dayLight === 'amber'
                    ? 'Fair conditions with some challenges. Be careful and check the forecast details.'
                    : (() => {
                        if (avgWaveHeight !== undefined && avgWaveHeight >= 0.3 && avgWaveHeight < 1 && effectiveData.skill === 'novice') {
                          return 'Small waves today - perfect for beginners, bodyboards, and learning! Experienced surfers may want to check other spots.';
                        } else {
                          return 'Poor conditions today. Consider alternative activities or check back tomorrow.';
                        }
                      })()
                }
              </p>
              {best ? (
                <p className="text-sm mt-2">
                  <strong>Best time to go:</strong> {new Date(best.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {best.light === 'green' ? ' - excellent conditions!' : 
                   best.light === 'amber' ? ' - acceptable conditions' : 
                   isBeginnerFriendly(best.light, effectiveData.skill, bestHourData?.primary?.heightM) ? 
                    ' - good for beginners' : ' - challenging conditions'}
                </p>
              ) : (
                <p className="text-sm mt-2">
                  <strong>Best time to go:</strong> No suitable surfing hours found during daylight. Check back tomorrow or choose a different location.
                </p>
              )}
              
              <p className="text-xs mt-3 italic opacity-80">
                {effectiveData.skill === 'novice' && avgWaveHeight !== undefined && avgWaveHeight >= 0.3 && avgWaveHeight < 1 ?
                  'For novice surfers, we show small waves (0.3-1.0m) as beginner-friendly even when other conditions may not be ideal. More experienced surfers may prefer larger waves and better overall conditions.' :
                  'We blend wave size, period, wind strength, relative direction, and tide status into a simple traffic-light — with safety gates to keep intermediates out of dangerous surf. Advanced surfers can read the raw data. Hang tight and be safe!'
                }
              </p>
            </div>

            {/* Beach Orientation Selector */}
            <div className="mt-2 text-xs">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Beach Orientation:</span>
                  <select 
                    className="select select-xs select-bordered text-base-content" 
                    value={orientationOverride !== null ? orientationOverride : (data.beachFacingDeg ? Math.round(data.beachFacingDeg / 45) * 45 : '')}
                    onChange={handleOrientationChange}
                  >
                    <option value="" className="text-base-content">Auto-detect</option>
                    <option value="0" className="text-base-content">North (0°)</option>
                    <option value="45" className="text-base-content">Northeast (45°)</option>
                    <option value="315" className="text-base-content">Northwest (315°)</option>
                    <option value="90" className="text-base-content">East (90°)</option>
                    <option value="135" className="text-base-content">Southeast (135°)</option>
                    <option value="225" className="text-base-content">Southwest (225°)</option>
                    <option value="180" className="text-base-content">South (180°)</option>
                    <option value="270" className="text-base-content">West (270°)</option>
                    
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <div role="group" aria-label="Experience level" className="flex gap-1">
                    {([
                      { key: 'novice',       label: 'Novice' },
                      { key: 'intermediate', label: 'Intermediate' },
                      { key: 'advanced',     label: 'Advanced' },
                    ] as const).map(({ key, label }) => {
                      const current = (skillOverride ?? data.skill ?? 'intermediate');
                      const isActive = current === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setSkillOverride(key); saveSavedSkill(key); }}
                          className={`px-2 py-1 rounded-full border text-xs flex items-center gap-1 transition 
                            ${isActive ? 'border-base-content bg-base-200' : 'border-base-300 hover:border-base-content/60'}`}
                          aria-pressed={isActive}
                        >
                          {isActive && <span className="badge badge-xs"></span>}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {(orientationOverride !== null || skillOverride !== null) && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-info">
                    {orientationOverride !== null && skillOverride !== null 
                      ? 'Using custom orientation and experience level.' 
                      : orientationOverride !== null 
                        ? 'Using custom orientation.' 
                        : 'Using custom experience level.'}
                  </span>
                  <button 
                    className="btn btn-xs btn-ghost" 
                    onClick={() => {
                      if (orientationOverride !== null) {
                        setOrientationOverride(null);
                        saveBeachOrientationOverride(locationId, null);
                      }
                      if (skillOverride !== null) {
                        setSkillOverride(null);
                        saveSavedSkill(null);
                      }
                    }}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div className="text-xs opacity-70 mt-2">
              <p>Note: Uses stored beach orientation if available; falls back gracefully when unknown.</p>
              <p className="mt-1">To check beach orientation, use the map picker to precisely select your surf spot or set the beach orientation above to match your specific break.</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}