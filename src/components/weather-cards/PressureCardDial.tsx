import React, { useMemo } from "react";
import Image from "next/image";
import { WeatherBundle, HourlyPoint } from '../../types/weather';

/** Minimal One Call 3.0 types we care about */
type OneCallHourly = {
  dt: number;           // unix seconds
  pressure?: number;    // hPa (OpenWeather says "at sea level")
  sea_level?: number;   // sometimes present
  // ...other fields ignored
};

type PressurePoint = {
  time: string;
  mslp: number;
};

type OneCallResponse = {
  lat: number;
  lon: number;
  timezone?: string;
  current?: { dt: number; pressure?: number; sea_level?: number };
  hourly?: OneCallHourly[];
  // daily?: ...
};

/** Optional historical: same shape as hourly (array of past hours) */
type HistoricalHourly = OneCallHourly[];

export interface PressureFromOpenWeatherProps {
  /** One Call 3.0 response for the location (current+hourly forward) */
  onecall: OneCallResponse;
  /** Optional historical hourly (past hours) to enable a true −6h/−12h reference */
  historicalHourly?: HistoricalHourly; // already fetched upstream
  /** Title for the card */
  title?: string;
  /** Dial options forwarded to PressureCardDial */
  minHpa?: number;
  maxHpa?: number;
  showTicks?: boolean;
  showReferenceHand?: boolean;
  referenceWindowHours?: 6 | 12;
  trendHorizonHours?: 3 | 6 | 12;
  className?: string;
  /** Optional: provide a prebuilt pressure series (e.g., from Open-Meteo). If present, this is used instead of deriving from onecall. */
  series?: PressurePoint[];
}

// Add stable comparison helpers to avoid unnecessary re-renders
const pressureOf = (h?: { pressure?: number; sea_level?: number } | null) =>
  typeof h?.sea_level === 'number' ? h!.sea_level : (typeof h?.pressure === 'number' ? h!.pressure : undefined);

const oneCallKey = (oc?: OneCallResponse) => {
  if (!oc) return 'none';
  const curP = pressureOf(oc.current);
  const curDt = oc.current?.dt ?? 'na';
  const len = oc.hourly?.length ?? 0;
  const last = len ? oc.hourly![len - 1] : undefined;
  const lastDt = last?.dt ?? 'na';
  const lastP = pressureOf(last);
  return `lat:${oc.lat}|lon:${oc.lon}|cur:${curP}@${curDt}|n:${len}|last:${lastP}@${lastDt}`;
};

const seriesKey = (s?: PressurePoint[]) => {
  if (!Array.isArray(s) || s.length === 0) return 'none';
  const first = s[0];
  const last = s[s.length - 1];
  return `n:${s.length}|first:${first?.time}:${first?.mslp}|last:${last?.time}:${last?.mslp}`;
};

const dialPropsEqual = (prev: PressureFromOpenWeatherProps, next: PressureFromOpenWeatherProps) => {
  return (
    oneCallKey(prev.onecall) === oneCallKey(next.onecall) &&
    seriesKey(prev.series) === seriesKey(next.series) &&
    (prev.historicalHourly?.length ?? 0) === (next.historicalHourly?.length ?? 0) &&
    prev.title === next.title &&
    prev.minHpa === next.minHpa &&
    prev.maxHpa === next.maxHpa &&
    prev.showTicks === next.showTicks &&
    prev.showReferenceHand === next.showReferenceHand &&
    prev.referenceWindowHours === next.referenceWindowHours &&
    prev.trendHorizonHours === next.trendHorizonHours &&
    prev.className === next.className
  );
};

// Helper to find nearest point by time
function getNearestByTime(points: PressurePoint[], targetMs: number): PressurePoint | undefined {
  if (!points.length) return undefined;
  let best = points[0];
  let bestDiff = Math.abs(new Date(best.time).getTime() - targetMs);
  for (const pt of points) {
    const diff = Math.abs(new Date(pt.time).getTime() - targetMs);
    if (diff < bestDiff) {
      best = pt;
      bestDiff = diff;
    }
  }
  return best;
}

// New: nearest point with a maximum allowed difference (ms). Returns undefined if too far.
function getNearestWithin(points: PressurePoint[], targetMs: number, maxDiffMs: number): PressurePoint | undefined {
  const nearest = getNearestByTime(points, targetMs);
  if (!nearest) return undefined;
  const diff = Math.abs(new Date(nearest.time).getTime() - targetMs);
  return diff <= maxDiffMs ? nearest : undefined;
}

// New helpers: index-based selection for hourly series
function nearestIndex(points: PressurePoint[], targetMs: number): number {
  if (!points.length) return -1;
  let bestIdx = 0;
  let bestDiff = Math.abs(new Date(points[0].time).getTime() - targetMs);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(new Date(points[i].time).getTime() - targetMs);
    if (d < bestDiff) { bestDiff = d; bestIdx = i; }
  }
  return bestIdx;
}

function isRoughlyHourly(points: PressurePoint[], startIdx: number): boolean {
  const lo = 30 * 60 * 1000;  // 30 min
  const hi = 90 * 60 * 1000;  // 90 min
  let checks = 0, ok = 0;
  for (let k = 0; k < 3; k++) {
    const i = startIdx + k;
    if (i + 1 >= points.length) break;
    const a = new Date(points[i].time).getTime();
    const b = new Date(points[i + 1].time).getTime();
    const diff = Math.abs(b - a);
    checks++;
    if (diff >= lo && diff <= hi) ok++;
  }
  return checks > 0 && ok >= 1; // at least one adjacent step looks hourly
}

// First index whose time is >= targetMs; returns -1 if none
function nextIndexAtOrAfter(points: PressurePoint[], targetMs: number): number {
  for (let i = 0; i < points.length; i++) {
    const ms = new Date(points[i].time).getTime();
    if (ms >= targetMs) return i;
  }
  return -1;
}

// Format a pressure delta as ±0 hPa, +7 hPa, -3 hPa, etc
const formatDelta = (n: number | null | undefined) => {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  const r = Math.round(n);
  if (Math.abs(r) === 0) return '±0 hPa';
  return `${r > 0 ? '+' : ''}${r} hPa`;
};

// Utility function to build the pressure series for the dial
function buildSeries(onecall?: OneCallResponse, historical?: HistoricalHourly): PressurePoint[] {
  if (!onecall) return [];
  const list: PressurePoint[] = [];
  if (Array.isArray(historical) && historical.length) {
    for (const h of historical) {
      const t = h.dt;
      const p = (typeof h.sea_level === "number" ? h.sea_level : h.pressure);
      if (!t || typeof p !== "number") continue;
      list.push({ time: new Date(t * 1000).toISOString(), mslp: p });
    }
  }
  if (onecall.current && onecall.current.dt) {
    const p = (typeof onecall.current.sea_level === "number" ? onecall.current.sea_level : onecall.current.pressure);
    if (typeof p === "number") {
      list.push({ time: new Date(onecall.current.dt * 1000).toISOString(), mslp: p });
    }
  }
  if (Array.isArray(onecall.hourly)) {
    for (const h of onecall.hourly) {
      const t = h.dt;
      const p = (typeof h.sea_level === "number" ? h.sea_level : h.pressure);
      if (!t || typeof p !== "number") continue;
      list.push({ time: new Date(t * 1000).toISOString(), mslp: p });
    }
  }
  return sortAndDedupe(list);
}

// New: Extract a full pressure curve directly from unified hourly (Open-Meteo supplemented)
export function extractPressureCurveFromHourly(hourly?: HourlyPoint[], currentPressure?: number): PressurePoint[] {
  const pts: PressurePoint[] = [];
  if (Array.isArray(hourly)) {
    for (const h of hourly) {
      const t = h.timeISO;
      const p = typeof h.pressureHpa === 'number' ? h.pressureHpa : undefined;
      if (!t || typeof p !== 'number') continue;
      const iso = (() => {
        // Ensure valid ISO string
        const d = new Date(t);
        return Number.isNaN(d.getTime()) ? String(t) : d.toISOString();
      })();
      pts.push({ time: iso, mslp: p });
    }
  }
  const sorted = sortAndDedupe(pts);

  // Only include a current reading if there are no hourly points,
  // or the closest hourly point is more than 90 minutes away from now.
  const now = Date.now();
  const NINETY_MIN_MS = 90 * 60 * 1000;
  const nearest = getNearestByTime(sorted, now);
  const nearestDiff = nearest ? Math.abs(new Date(nearest.time).getTime() - now) : Infinity;
  const shouldInjectNow = sorted.length === 0 || nearestDiff > NINETY_MIN_MS;

  if (shouldInjectNow && typeof currentPressure === 'number') {
    sorted.push({ time: new Date(now).toISOString(), mslp: currentPressure });
  }

  return sortAndDedupe(sorted);
}

function sortAndDedupe(list: PressurePoint[]): PressurePoint[] {
  // sort + dedupe on ISO time
  const sorted = list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const deduped: PressurePoint[] = [];
  let lastKey = "";
  for (const pt of sorted) {
    const key = typeof pt.time === "string" ? pt.time : (pt.time as Date).toISOString();
    if (key !== lastKey) {
      deduped.push(pt);
      lastKey = key;
    }
  }
  return deduped;
}

// Implementation renamed and wrapped with React.memo below
const PressureCardDialImpl: React.FC<PressureFromOpenWeatherProps> = ({
  onecall,
  historicalHourly,
  title = "Pressure",
  minHpa = 960,
  maxHpa = 1040,
  showTicks: _showTicks = true,
  showReferenceHand: _showReferenceHand = true,
  referenceWindowHours = 6,
  trendHorizonHours = 6,
  className = "",
  series,
}) => {
  const history = useMemo(() => {
    if (Array.isArray(series) && series.length) return sortAndDedupe(series);
    return buildSeries(onecall, historicalHourly);
  }, [onecall, historicalHourly, series]);

  // Use index-aligned selection with a forward-looking anchor when possible
  const nowMs = Date.now();
  const NINETY_MIN_MS = 90 * 60 * 1000;
  let currentPoint: PressurePoint | undefined;
  let inNhPoint: PressurePoint | undefined;
  let trendLabelHours: number = trendHorizonHours;
  let anchorIdx = -1;

  if (history.length) {
    const idxNearest = nearestIndex(history, nowMs);
    const idxNext = nextIndexAtOrAfter(history, nowMs);
    anchorIdx = idxNext !== -1 ? idxNext : idxNearest;
    const hourlyLike = anchorIdx >= 0 && isRoughlyHourly(history, anchorIdx);

    if (hourlyLike && anchorIdx >= 0) {
      currentPoint = history[anchorIdx];
      const idxH = anchorIdx + trendHorizonHours;
      if (idxH < history.length) {
        inNhPoint = history[idxH];
      } else if (anchorIdx + 1 < history.length) {
        // Fallback: immediate next step for direction
        inNhPoint = history[anchorIdx + 1];
        trendLabelHours = 1;
      }
    }

    if (!currentPoint || !inNhPoint) {
      // Fallback: time-based nearest with tolerance
      currentPoint = getNearestWithin(history, nowMs, NINETY_MIN_MS);
      inNhPoint = getNearestWithin(history, nowMs + trendHorizonHours * 3600_000, NINETY_MIN_MS);
      if (!(currentPoint && inNhPoint)) {
        // Final fallback: next slot and the one after (≈1h trend)
        const baseIdx = idxNext !== -1 ? idxNext : idxNearest;
        if (baseIdx >= 0) {
          const a = history[baseIdx];
          const b = history[baseIdx + 1];
          if (a && b) {
            currentPoint = a;
            inNhPoint = b;
            trendLabelHours = 1;
          }
        }
      }
    }
  }

  // Calculate trend
  let trend: "rising" | "falling" | "steady" = "steady";
  let deltaHpa: number | null = null;

  if (currentPoint && inNhPoint) {
    deltaHpa = inNhPoint.mslp - currentPoint.mslp;
    if (deltaHpa > 1) trend = 'rising';
    else if (deltaHpa < -1) trend = 'falling';
    else trend = 'steady';
  }

  // Dev-only: instrument inputs actually used by the dial (history + now/+3h/+6h)
  if (process.env.NODE_ENV === 'development') {
    // @ts-expect-error window key for minimal spam
    const lastKey: string | undefined = typeof window !== 'undefined' ? window.__pressureDialImplKey : undefined;
    const key = `${history.length}|${currentPoint?.time}|${inNhPoint?.time}|${minHpa}|${maxHpa}`;
    if (typeof window !== 'undefined' && lastKey !== key) {
      const sample = history.slice(0, 8);
      const findNearest = (targetMs: number) => getNearestByTime(history, targetMs);
      const snapNow = findNearest(nowMs);
      const snap6h = findNearest(nowMs + 6 * 3600_000);
      const snap12h = findNearest(nowMs + 12 * 3600_000);
      console.debug('[PressureCardDialImpl] history len:', history.length, 'sample[0..7]:', sample);
      console.debug('[PressureCardDialImpl] now/6h/12h:', { now: snapNow, plus6h: snap6h, plus12h: snap12h });
      // @ts-expect-error store key
      window.__pressureDialImplKey = key;
    }
  }

  // Map pressure -> dial angle helpers
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const pctFor = (p: number) => clamp((p - minHpa) / (maxHpa - minHpa), 0, 1);
  const angleOffsetDeg = -90; // rotate dial scale exactly 90° left
  const angleFor = (p: number) => pctFor(p) * 180 - 90 + angleOffsetDeg; // -90..+90 then offset

  // Select rhyme based on trend
  const trendRhyme = (() => {
    if (deltaHpa === null) return '';
    if (trend === 'falling') return '“When the glass falls, beware squalls.”';
    if (trend === 'steady') return '“Glass stands steady—weather holds ready.”';
    // default to a fair-weather line for rising/high situations
    return '“High glass and steady—make your plans ready.”';
  })();

  // Pick a true time-based reference (closest to now - N hours)
  const referenceByTime = (() => {
    if (!history.length) return undefined;
    const target = Date.now() - referenceWindowHours * 3600_000;
    let best: PressurePoint | undefined = history[0];
    let bestDiff = Math.abs(new Date(history[0].time).getTime() - target);
    for (const h of history) {
      const d = Math.abs(new Date(h.time).getTime() - target);
      if (d <= bestDiff) { best = h; bestDiff = d; }
    }
    return best;
  })();

  const reference = referenceByTime;

  // Dial angle calculation uses nearest-to-now
  const pressure = currentPoint?.mslp ?? null;
  const _percent = pressure != null
    ? Math.max(0, Math.min(1, (pressure - minHpa) / (maxHpa - minHpa)))
    : 0.5;

  // SVG dial rendering
  return (
    <div className={`card weather-card-bg text-base-content ${className}`}>
      <div className="card-body py-3">
        <h3 className="card__header-title flex items-center gap-2">
          <Image src="/weather-icons/design/fill/final/barometer.svg" alt="Barometer" width={32} height={32} className="w-8 h-8" />
          {title}
        </h3>
        {trendRhyme && (
          <div className="text-xs md:text-sm opacity-70 text-center mt-0.5">{trendRhyme}</div>
        )}
        <div className="flex flex-col items-center">
          <svg width={200} height={140} viewBox="0 0 240 160" className="mx-auto" role="img" aria-labelledby="pressureDialTitle pressureDialDesc">
            <title id="pressureDialTitle">Barometric pressure</title>
            <desc id="pressureDialDesc">Current pressure {pressure != null ? `${Math.round(pressure)} hPa` : 'unknown'}; trend {deltaHpa !== null ? `${trend} ${formatDelta(deltaHpa)}` : 'unknown'}.</desc>
            <defs>
              <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* dial face */}
            <circle cx={120} cy={120} r={64} className="fill-base-100/70" filter="url(#innerShadow)" />
            <circle cx={120} cy={120} r={64} className="fill-none stroke-base-300/60" strokeWidth={1} />

            <g transform={`rotate(${angleOffsetDeg} 120 120)`}>
              {/* background semicircle track */}
              <path d={`M 56 120 A 64 64 0 0 1 184 120`} className="stroke-base-300/50" strokeWidth={8} strokeLinecap="butt" fill="none" />

              {/* ticks every 5 hPa, majors every 10 hPa */}
              {_showTicks && Array.from({length: Math.floor((maxHpa - minHpa)/5)+1}, (_,i)=> minHpa + i*5).map((p) => {
                const ang = angleFor(p) * Math.PI/180 - (angleOffsetDeg * Math.PI/180); // cancel offset inside group
                const outerR = 66; // just outside the face
                const innerR = p % 10 === 0 ? 58 : 61;
                const x1 = 120 + outerR * Math.cos(ang);
                const y1 = 120 + outerR * Math.sin(ang);
                const x2 = 120 + innerR * Math.cos(ang);
                const y2 = 120 + innerR * Math.sin(ang);
                const sw = p % 10 === 0 ? 2 : 1.25;
                const cls = p % 10 === 0 ? 'stroke-base-content/70' : 'stroke-base-content/40';
                return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} strokeWidth={sw} strokeLinecap="round" />
              })}

              {/* neat labels every 20 hPa */}
              {_showTicks && (() => {
                const start = Math.ceil(minHpa / 20) * 20;
                const end = Math.floor(maxHpa / 20) * 20;
                const labels: number[] = [];
                for (let p = start; p <= end; p += 20) labels.push(p);
                return labels.map((p, idx) => {
                  const ang = angleFor(p) * Math.PI/180 - (angleOffsetDeg * Math.PI/180);
                  const r = 50; // a touch further out for clarity
                  const x = 120 + r * Math.cos(ang);
                  const y = 120 + r * Math.sin(ang) + 3; // slight vertical nudge
                  return (
                    <text key={idx}
                          x={x} y={y} textAnchor="middle"
                          transform={`rotate(90 ${x} ${y})`}
                          className="fill-base-content/80 text-[10px] tabular-nums tracking-tight">
                      {p}
                    </text>
                  );
                });
              })()}
            </g>

            {/* reference hand (dashed) */}
            {_showReferenceHand && reference && (
              (() => {
                const ang = angleFor(reference.mslp) * Math.PI/180;
                const x = 120 + 54 * Math.cos(ang);
                const y = 120 + 54 * Math.sin(ang);
                return <line x1={120} y1={120} x2={x} y2={y} className="stroke-info" strokeDasharray="3 3" strokeWidth={2} strokeLinecap="round" />
              })()
            )}

            {/* main needle */}
            {pressure != null && (() => {
              const ang = angleFor(pressure) * Math.PI/180;
              const x = 120 + 60 * Math.cos(ang);
              const y = 120 + 60 * Math.sin(ang);
              const tx = 120 + 20 * Math.cos(ang + Math.PI);
              const ty = 120 + 20 * Math.sin(ang + Math.PI);
              return (
                <g>
                  <line x1={tx} y1={ty} x2={x} y2={y} className="stroke-warning" strokeWidth={3} strokeLinecap="round" />
                  <circle cx={tx} cy={ty} r={2} className="fill-warning/70" />
                  <circle cx={120} cy={120} r={4} className="fill-base-content" />
                </g>
              );
            })()}
          </svg>
          <div className="text-2xl font-bold mt-0.5 tabular-nums">
            {pressure != null ? `${Math.round(pressure)} hPa` : "—"}
          </div>
          {(() => {
            const sixHoursMs = nowMs + 6 * 3600_000;
            const twelveHoursMs = nowMs + 12 * 3600_000;

            // +6h point
            let in6hPoint: PressurePoint | undefined;
            if (anchorIdx >= 0 && isRoughlyHourly(history, anchorIdx)) {
              const idx6 = anchorIdx + 6;
              in6hPoint = idx6 < history.length ? history[idx6] : undefined;
            } else {
              in6hPoint = getNearestWithin(history, sixHoursMs, NINETY_MIN_MS);
            }

            // +12h point
            let in12hPoint: PressurePoint | undefined;
            if (anchorIdx >= 0 && isRoughlyHourly(history, anchorIdx)) {
              const idx12 = anchorIdx + 12;
              in12hPoint = idx12 < history.length ? history[idx12] : undefined;
            } else {
              in12hPoint = getNearestWithin(history, twelveHoursMs, NINETY_MIN_MS);
            }

            if (!currentPoint) return null;

            const d6 = in6hPoint ? in6hPoint.mslp - currentPoint.mslp : null;
            const d12 = in12hPoint ? in12hPoint.mslp - currentPoint.mslp : null;

            return (
              <div className="text-xs opacity-80 mt-0.5 flex items-center justify-center gap-4">
                {deltaHpa !== null && (
                  <span>
                    Trend ({trendLabelHours}h): {trend.charAt(0).toUpperCase() + trend.slice(1)} (
                    <span className="tabular-nums">{formatDelta(deltaHpa)}</span>)
                  </span>
                )}
                {in6hPoint && (
                  <span>
                    In 6h: <span className="tabular-nums">{Math.round(in6hPoint.mslp)} hPa</span>
                    {d6 !== null && <> (<span className="tabular-nums">{formatDelta(d6)}</span>)</>}
                  </span>
                )}
                {in12hPoint && (
                  <span>
                    In 12h: <span className="tabular-nums">{Math.round(in12hPoint.mslp)} hPa</span>
                    {d12 !== null && <> (<span className="tabular-nums">{formatDelta(d12)}</span>)</>}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const PressureCardDial = React.memo(PressureCardDialImpl, dialPropsEqual);

export { PressureCardDial };
export default PressureCardDial;
// Back-compat alias (old name some files may import):
export { PressureCardDial as PressureFromOpenWeather };
// Re-export the PressurePoint type for convenience:
export type { PressurePoint };

/** Simple wrapper for PressureCardDial with weather prop directly */
interface SimplePressureCardDialProps {
  weather: Pick<WeatherBundle,'pressureHpa'|'hourly'> | null | undefined;
  lat: number;
  title?: string;
  minHpa?: number;
  maxHpa?: number;
  showTicks?: boolean;
  showReferenceHand?: boolean;
  referenceWindowHours?: 6 | 12;
  trendHorizonHours?: 3 | 6 | 12;
  className?: string;
}

// Equality check to prevent re-renders unless the pressure inputs actually change
const simplePropsEqual = (prev: SimplePressureCardDialProps, next: SimplePressureCardDialProps) => {
  const prevLen = prev.weather?.hourly?.length ?? 0;
  const nextLen = next.weather?.hourly?.length ?? 0;
  const prevFirst = prevLen ? prev.weather!.hourly![0]?.timeISO : 'na';
  const nextFirst = nextLen ? next.weather!.hourly![0]?.timeISO : 'na';
  const prevLast = prevLen ? prev.weather!.hourly![prevLen - 1]?.timeISO : 'na';
  const nextLast = nextLen ? next.weather!.hourly![nextLen - 1]?.timeISO : 'na';
  return (
    prev.lat === next.lat &&
    prev.weather?.pressureHpa === next.weather?.pressureHpa &&
    prevLen === nextLen &&
    prevFirst === nextFirst &&
    prevLast === nextLast &&
    prev.title === next.title &&
    prev.minHpa === next.minHpa &&
    prev.maxHpa === next.maxHpa &&
    prev.showTicks === next.showTicks &&
    prev.showReferenceHand === next.showReferenceHand &&
    prev.referenceWindowHours === next.referenceWindowHours &&
    prev.trendHorizonHours === next.trendHorizonHours &&
    prev.className === next.className
  );
};

const SimplePressureCardDialImpl: React.FC<SimplePressureCardDialProps> = ({
  weather,
  lat,
  title = "Pressure",
  minHpa = 960,
  maxHpa = 1040,
  showTicks = true,
  showReferenceHand = true,
  referenceWindowHours = 6,
  trendHorizonHours = 6,
  className = ""
}) => {
  // Prefer Open-Meteo supplemented hourly pressure curve directly
  const series = useMemo(() => extractPressureCurveFromHourly(weather?.hourly, weather?.pressureHpa), [weather?.hourly, weather?.pressureHpa]);

  // Fallback: construct a minimal OneCall-like structure for compatibility if series is empty
  const onecallData = useMemo(() => {
    if (!weather) return null;
    return {
      lat: lat,
      lon: 0,
      current: {
        dt: Math.floor(Date.now() / 1000),
        pressure: weather.pressureHpa,
        sea_level: weather.pressureHpa
      },
      // Wire hourly pressure from OpenWeather (via unified weather): use per-hour pressureHpa when present
      hourly: (weather.hourly || []).map((hour: HourlyPoint) => {
        const p = typeof hour.pressureHpa === 'number' ? hour.pressureHpa : weather.pressureHpa;
        return {
          dt: Math.floor(new Date(hour.timeISO).getTime() / 1000),
          pressure: p,
          sea_level: p
        } as OneCallHourly;
      })
    };
  }, [weather, lat]);

  // Dev-only targeted instrumentation when key inputs change
  if (process.env.NODE_ENV === 'development') {
    const key = `${lat}|${weather?.pressureHpa}|${weather?.hourly?.length}|${series.length}`;
    // @ts-expect-error attach on window for quick dev diffing
    if (typeof window !== 'undefined' && window.__pressureDialKey !== key) {
      console.debug('[SimplePressureCardDial] props changed:', { lat, pressure: weather?.pressureHpa, hourlyLen: weather?.hourly?.length, seriesLen: series.length });
      // Extra: dump first 8 hourly pressures and now/+6h/+12h snapshot used by the dial
      if (Array.isArray(series) && series.length) {
        const sample = series.slice(0, 8);
        const findNearest = (targetMs: number) => getNearestByTime(series, targetMs);
        const now = Date.now();
        const snapNow = findNearest(now);
        const snap6h = findNearest(now + 6 * 3600_000);
        const snap12h = findNearest(now + 12 * 3600_000);
        console.debug('[SimplePressureCardDial] series pressure sample (first 8):', sample);
        console.debug('[SimplePressureCardDial] now/6h/12h pressures:', { now: snapNow, plus6h: snap6h, plus12h: snap12h });
      } else if (onecallData?.hourly && Array.isArray(onecallData.hourly)) {
        const sample = onecallData.hourly.slice(0, 8).map((h) => ({
          timeISO: new Date(h.dt * 1000).toISOString(),
          pressureHpa: typeof h.sea_level === 'number' ? h.sea_level : h.pressure
        }));
        const findNearest = (targetMs: number) => {
          let best: { timeISO: string; pressureHpa?: number } | null = null;
          let bestDiff = Infinity;
          for (const h of onecallData.hourly!) {
            const ms = h.dt * 1000;
            const p = typeof h.sea_level === 'number' ? h.sea_level : h.pressure;
            const diff = Math.abs(ms - targetMs);
            if (diff < bestDiff) { bestDiff = diff; best = { timeISO: new Date(ms).toISOString(), pressureHpa: p }; }
          }
          return best;
        };
        const now = Date.now();
        const snapNow = findNearest(now);
        const snap6h = findNearest(now + 6 * 3600_000);
        const snap12h = findNearest(now + 12 * 3600_000);
        console.debug('[SimplePressureCardDial] hourly pressure sample (first 8):', sample);
        console.debug('[SimplePressureCardDial] now/6h/12h pressures:', { now: snapNow, plus6h: snap6h, plus12h: snap12h });
      }
      // @ts-expect-error store last key
      window.__pressureDialKey = key;
    }
  }

  if (!onecallData && series.length === 0) {
    return (
      <div className={`card weather-card-bg text-base-content ${className}`}>
        <div className="card-body">
          <h3 className="card-title">{title}</h3>
          <div className="text-center py-4">No pressure data available</div>
        </div>
      </div>
    );
  }

  return (
    <PressureCardDial
      onecall={onecallData || { lat, lon: 0, current: { dt: Math.floor(Date.now()/1000), pressure: weather?.pressureHpa, sea_level: weather?.pressureHpa }, hourly: [] }}
      title={title}
      minHpa={minHpa}
      maxHpa={maxHpa}
      showTicks={showTicks}
      showReferenceHand={showReferenceHand}
      referenceWindowHours={referenceWindowHours}
      trendHorizonHours={trendHorizonHours}
      className={className}
      series={series}
    />
  );
};

export const SimplePressureCardDial = React.memo(SimplePressureCardDialImpl, simplePropsEqual);