import React from "react";
import Image from "next/image";
import type { MarineHourlyPoint, TideEvent } from "../../types/weather";
import WindDirectionIcon from "../WindDirectionIcon";

// Helper function to get weather icon URL
function getWeatherIconUrl(iconCode?: string) {
  const code = iconCode || 'na';
  const supported = new Set(['01d','01n','02d','02n','03d','03n','04d','04n','09d','09n','10d','10n','11d','11n','13d','13n','50d','50n']);
  return supported.has(code) ? `/weather-icons/design/fill/final/${code}.svg` : '/weather-icons/design/fill/final/na.svg';
}

// Small helpers
const median = (arr: number[]): number | undefined => {
  if (!arr || arr.length === 0) return undefined;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const degToCompass = (deg?: number): string | undefined => {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return undefined;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round((deg % 360) / 22.5) % 16;
  return dirs[idx];
};
// Pick the first finite number from a list
const firstFinite = (...vals: Array<number | null | undefined>): number | undefined => {
  for (const v of vals) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
};
// Optional extension to support waveHeightM in some payloads
type MarineHourExt = MarineHourlyPoint & { waveHeightM?: number | null };

// Find the marine hour closest to local 12:00 for a given date
function nearestMarineForDate(dateISO: string, series: MarineHourlyPoint[] = []): MarineHourlyPoint | undefined {
  if (!dateISO || !series.length) return undefined;
  try {
    const localNoon = new Date(`${dateISO}T12:00:00`); // local noon
    const target = localNoon.getTime();
    let best: MarineHourlyPoint | undefined;
    let bestDiff = Infinity;
    for (const h of series) {
      const t = new Date(h.timeISO).getTime();
      const diff = Math.abs(t - target);
      if (diff < bestDiff) { bestDiff = diff; best = h; }
    }
    return best;
  } catch {
    return undefined;
  }
}

// NEW: helpers that ensure we pick an hour that actually has a wave height
function pickWaveHeight(h?: MarineHourlyPoint): number | undefined {
  if (!h) return undefined;
  return firstFinite(
    (h as MarineHourExt).waveHeightM ?? undefined, // prefer exact waveHeightM like hourly uses
    (h as MarineHourExt).swellHeightM ?? undefined,
    h.waveM ?? undefined,
  );
}
function pickWavePeriod(h?: MarineHourlyPoint): number | undefined {
  if (!h) return undefined;
  return firstFinite(
    (h as MarineHourExt).wavePeriodS ?? undefined,
    (h as MarineHourExt).swellPeriodS ?? undefined,
  );
}
function nearestMarineWithWaves(targetMs: number, series: MarineHourlyPoint[] = []): MarineHourlyPoint | undefined {
  let best: { h: MarineHourlyPoint; diff: number } | undefined;
  for (const h of series) {
    const t = new Date(h.timeISO).getTime();
    const ht = pickWaveHeight(h);
    if (typeof ht === 'number') {
      const diff = Math.abs(t - targetMs);
      if (!best || diff < best.diff) best = { h, diff };
    }
  }
  return best?.h;
}
function nextUpcomingWithWaves(series: MarineHourlyPoint[] = []): MarineHourlyPoint | undefined {
  const now = Date.now();
  const future = series
    .map(h => ({ h, t: new Date(h.timeISO).getTime(), ht: pickWaveHeight(h) }))
    .filter(x => Number.isFinite(x.t) && typeof x.ht === 'number')
    .sort((a,b) => a.t - b.t)
    .find(x => x.t >= now);
  return future?.h || nearestMarineWithWaves(now, series);
}

interface DailyForecast {
  dateISO: string;
  icon?: string;
  minC?: number;
  maxC?: number;
  pop?: number;
  precipMM?: number;
  summary?: string;
  windMS?: number;
  windDeg?: number;
  uvi?: number;
}

interface NextFewDaysCardProps {
  daily: DailyForecast[];
  maxDays?: number;
  className?: string;
  isMarine?: boolean; // Add marine mode support
  // NEW: marine/tide context for richer marine row
  marineHourly?: MarineHourlyPoint[];
  tide?: TideEvent[];
}

const NextFewDaysCard: React.FC<NextFewDaysCardProps> = ({ 
  daily, 
  maxDays = 8,
  className = "",
  isMarine = false,
  marineHourly = [],
  tide = [],
}) => {
  return (
    <div className={`card weather-card-bg-enhanced text-base-content ${className}`}>
      <div className="card-body">
        <h3 className="card__header-title">Next Few Days</h3>
        <div className="overflow-x-auto rounded-box bg-transparent text-[0.8rem]">
          <table
            className={`table table-compact bg-transparent text-[0.8rem] ${isMarine ? 'min-w-[720px] w-full' : 'w-full'}`}
          >
            <tbody>
              {(daily || []).slice(0, maxDays).map((d: DailyForecast, idx: number) => {
                const date = new Date(d.dateISO);
                const label = idx === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
                const iconUrl = getWeatherIconUrl(d.icon);
                const windKts = typeof d.windMS === 'number' ? Math.round(d.windMS * 1.94384) : undefined;
                const popPct = typeof d.pop === 'number' ? Math.round(d.pop * 100) : undefined;
                const hasPop = typeof popPct === 'number';
                const mm = typeof d.precipMM === 'number' ? d.precipMM : undefined;
                const mmRounded = typeof mm === 'number' ? Math.round(mm) : undefined; // round to nearest mm
                const showMM = typeof mmRounded === 'number';
                const showUV = !hasPop && !showMM && typeof d.uvi === 'number';
                const windKmh = typeof d.windMS === 'number' ? Math.round(d.windMS * 3.6) : undefined;

                // Marine wave height/period selection (match Hourly logic)
                const dayKey = String(d.dateISO).slice(0, 10);
                let chosen: MarineHourlyPoint | undefined;
                if (idx === 0) {
                  // Today → next upcoming hour that has a wave height
                  chosen = nextUpcomingWithWaves(marineHourly);
                } else {
                  // Future days → closest to local noon that has a wave height
                  const noonMs = new Date(`${dayKey}T12:00:00`).getTime();
                  chosen = nearestMarineWithWaves(noonMs, marineHourly) || nearestMarineForDate(dayKey, marineHourly);
                }

                let medHeight = pickWaveHeight(chosen);
                let medPeriod = pickWavePeriod(chosen);

                // Per-day median as secondary fallback
                if (medHeight === undefined || medPeriod === undefined) {
                  const dayStart = new Date(`${dayKey}T00:00:00`).getTime();
                  const dayEnd = new Date(`${dayKey}T23:59:59.999`).getTime();
                  const dayMarine = (marineHourly || []).filter(h => {
                    const t = new Date(h.timeISO).getTime();
                    return t >= dayStart && t <= dayEnd;
                  });
                  const heights = dayMarine
                    .map(h => pickWaveHeight(h))
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
                  const periods = dayMarine
                    .map(h => pickWavePeriod(h))
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
                  if (medHeight === undefined) medHeight = median(heights);
                  if (medPeriod === undefined) medPeriod = median(periods);
                }

                // Global series median as final fallback
                if ((medHeight === undefined || medPeriod === undefined) && (marineHourly?.length || 0) > 0) {
                  const allHeights = (marineHourly || [])
                    .map(h => pickWaveHeight(h))
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
                  const allPeriods = (marineHourly || [])
                    .map(h => pickWavePeriod(h))
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
                  if (medHeight === undefined) medHeight = median(allHeights);
                  if (medPeriod === undefined) medPeriod = median(allPeriods);
                }

                // Tide times for this date — match by local day to avoid TZ drift
                const dayStartLocal = new Date(`${dayKey}T00:00:00`);
                const dayEndLocal = new Date(`${dayKey}T23:59:59.999`);
                const dayTides = (tide || []).filter(t => {
                  const raw = (t as unknown as { timeISO?: string; time?: string }).timeISO || (t as unknown as { time?: string }).time || '';
                  const dt = new Date(raw);
                  return dt >= dayStartLocal && dt <= dayEndLocal;
                });
                const highs = dayTides.filter(t => String(t.type).toLowerCase() === 'high').map(t => new Date((t as unknown as { timeISO?: string; time?: string }).timeISO || (t as unknown as { time?: string }).time || ''));
                const lows = dayTides.filter(t => String(t.type).toLowerCase() === 'low').map(t => new Date((t as unknown as { timeISO?: string; time?: string }).timeISO || (t as unknown as { time?: string }).time || ''));
                highs.sort((a,b)=>a.getTime()-b.getTime());
                lows.sort((a,b)=>a.getTime()-b.getTime());
                const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const highStr = highs.length ? highs.slice(0, 2).map(fmt).join('/') : undefined;
                const lowStr = lows.length ? lows.slice(0, 2).map(fmt).join('/') : undefined;

                return (
                  <tr key={d.dateISO} className="odd:bg-white/0 even:bg-white/5/30 hover:bg-white/10 transition-colors">
                    {/* Day + icon */}
                    <td className="px-1.5 sm:px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-medium">{label}</span>
                        <Image 
                          src={iconUrl} 
                          alt="Weather icon" 
                          width={30} 
                          height={30} 
                          className="inline-block opacity-90" 
                        />
                      </div>
                    </td>

                    {/* Compact single-line segments */}
                    <td className="px-1.5 sm:px-2 py-2">
                      <div className={`grid items-center whitespace-nowrap ${isMarine ? 'gap-x-0.5 sm:gap-x-1 grid-cols-5' : 'gap-x-0.5 sm:gap-x-1 grid-cols-3'}`}>
                        {/* Min–Max temperature (col 1) */}
                        <span className="opacity-90">
                          {d.minC != null ? Math.round(d.minC) : '—'}°–{d.maxC != null ? Math.round(d.maxC) : '—'}°
                        </span>

                        {isMarine ? (
                          <>
                            {/* Wind (col 2) */}
                            <span className="inline-flex items-center gap-1">
                              {typeof d.windDeg === 'number' ? (
                                <WindDirectionIcon deg={d.windDeg} size={10} className="opacity-80" />
                              ) : (
                                <span className="opacity-60">—</span>
                              )}
                              <span>{windKts != null ? `${windKts}kt` : '—'}{typeof d.windDeg === 'number' ? ` ${degToCompass(d.windDeg) || ''}` : ''}</span>
                            </span>

                            {/* Waves (col 3) */}
                            <span className="inline-flex items-center gap-1 pl-0 sm:pl-0.5">
                              <Image src="/weather-icons/design/fill/final/wave-moving.svg" alt="Waves" width={10} height={10} className="opacity-70" />
                              <span>
                                {typeof medHeight === 'number' ? `${medHeight.toFixed(1)}m` : '—'}
                                {typeof medPeriod === 'number' ? ` (${Math.round(medPeriod)}s)` : ''}
                              </span>
                            </span>

                            {/* Precip column (col 4): swap amount <-> POP, or UV if no precip info */}
                            {(!hasPop && !showMM && showUV) ? (
                              <span className="inline-flex items-center gap-1 text-amber-300 pl-0 sm:pl-0.5">UV {Math.round(d.uvi as number)}</span>
                            ) : (
                              <label className="swap swap-rotate cursor-pointer text-sky-300 pl-0 sm:pl-0.5" title="Toggle rain amount / probability">
                                <input type="checkbox" aria-label="Toggle precipitation view (Amount/POP)" />
                                <span className="swap-off inline-flex items-center gap-0">
                                  <Image src="/weather-icons/design/fill/final/raindrop.svg" alt="Rain amount" width={30} height={30} className="opacity-80" />
                                  <span>{showMM ? `${mmRounded}mm` : '—'}</span>
                                </span>
                                <span className="swap-on inline-flex items-center gap-0">
                                  <Image src="/weather-icons/design/fill/final/raindrop-measure.svg" alt="Precipitation probability" width={30} height={30} className="opacity-80" />
                                  <span>{hasPop ? `${popPct}%` : '—'}</span>
                                </span>
                              </label>
                            )}

                            {/* Tides (col 5): swap High/Low, else placeholder */}
                            {highStr && lowStr ? (
                              <label className="swap swap-rotate cursor-pointer pl-0 sm:pl-0.5" title="Toggle High/Low tides">
                                <input type="checkbox" aria-label="Toggle tide view (High/Low)" />
                                <span className="swap-off inline-flex items-center gap-0">
                                  <Image src="/weather-icons/design/fill/final/tide-high.svg" alt="High tide" width={30} height={30} className="opacity-70" />
                                  <span>{highStr}</span>
                                </span>
                                <span className="swap-on inline-flex items-center gap-0">
                                  <Image src="/weather-icons/design/fill/final/tide-low.svg" alt="Low tide" width={30} height={30} className="opacity-70" />
                                  <span>{lowStr}</span>
                                </span>
                              </label>
                            ) : highStr ? (
                              <span className="inline-flex items-center gap-0 pl-0 sm:pl-0.5">
                                <Image src="/weather-icons/design/fill/final/tide-high.svg" alt="High tide" width={30} height={30} className="opacity-70" />
                                <span>{highStr}</span>
                              </span>
                            ) : lowStr ? (
                              <span className="inline-flex items-center gap-0 pl-0 sm:pl-0.5">
                                <Image src="/weather-icons/design/fill/final/tide-low.svg" alt="Low tide" width={30} height={30} className="opacity-70" />
                                <span>{lowStr}</span>
                              </span>
                            ) : (
                              <span className="opacity-60 pl-0 sm:pl-0.5">—</span>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Precip (col 2): swap amount <-> POP */}
                            <label className="swap swap-rotate cursor-pointer text-sky-300" title="Toggle precipitation view (Amount/POP)">
                              <input type="checkbox" aria-label="Toggle precipitation view (Amount/POP)" />
                              <span className="swap-off inline-flex items-center gap-0">
                                <Image src="/weather-icons/design/fill/final/raindrop.svg" alt="Rain amount" width={30} height={30} className="opacity-80" />
                                <span>{showMM ? `${mmRounded}mm` : '—'}</span>
                              </span>
                              <span className="swap-on inline-flex items-center gap-0">
                                <Image src="/weather-icons/design/fill/final/raindrop-measure.svg" alt="Precipitation probability" width={30} height={30} className="opacity-80" />
                                <span>{hasPop ? `${popPct}%` : '—'}</span>
                              </span>
                            </label>

                            {/* UV (col 3): show when available; else show wind direction */}
                            {showUV ? (
                              <span className="inline-flex items-center gap-1 text-amber-300">UV {Math.round(d.uvi as number)}</span>
                            ) : (
                              (typeof d.windDeg === 'number' || typeof d.windMS === 'number') ? (
                                <label className="swap swap-rotate cursor-pointer" title="Toggle wind direction / speed">
                                  <input type="checkbox" aria-label="Toggle wind direction / speed" />
                                  <span className="swap-off inline-flex items-center gap-1">
                                    {typeof d.windDeg === 'number' ? (
                                      <WindDirectionIcon deg={d.windDeg} size={20} className="opacity-80" />
                                    ) : null}
                                    <span>{typeof d.windDeg === 'number' ? (degToCompass(d.windDeg) || '—') : '—'}</span>
                                  </span>
                                  <span className="swap-on inline-flex items-center gap-0">
                                    <span>{typeof windKmh === 'number' ? `${windKmh}km/h` : '—'}</span>
                                  </span>
                                </label>
                              ) : (
                                <span className="opacity-60">—</span>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export { NextFewDaysCard };
export default NextFewDaysCard;
