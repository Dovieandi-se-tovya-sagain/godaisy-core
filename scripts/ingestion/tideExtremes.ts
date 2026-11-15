/**
 * Pick the next high and low water after a moment from a series of tide
 * extremes.
 *
 * The ingestion used to take the *first* high and low in the series. Every
 * tide source starts its series before now: WorldTides from 14 h before UTC
 * midnight since b37d1b5 (2026-09-23), so the turn just gone is in it; NOAA
 * from UTC midnight. So the stored "next" tides were in the past.
 * Measured 2026-11-16 on findr_conditions_snapshots: 0% of rows since
 * 2026-09-28 had a next high/low after their own captured_at (about 35%
 * before b37d1b5), on average 20–35 h behind. tide_phase and
 * tide_flow_speed_ms were computed from those times, so they were wrong too.
 */

export interface TideExtremePoint {
  time: string;
  type: string;
  /** Unix ms, when the source gives it directly (WorldTides `dt`). */
  epochMs?: number;
}

const NAIVE_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

/**
 * A tide time as Unix ms, or NaN. NOAA's `t` is "YYYY-MM-DD HH:mm" in GMT
 * (we request time_zone=gmt) with no zone marker, which Date.parse would read
 * as the machine's local time; it is parsed as UTC instead.
 */
export function tideTimeMs(point: TideExtremePoint): number {
  if (typeof point.epochMs === 'number' && Number.isFinite(point.epochMs)) return point.epochMs;
  const raw = String(point.time ?? '').trim();
  if (NAIVE_UTC.test(raw)) {
    const iso = `${raw.replace(' ', 'T')}${raw.length === 16 ? ':00' : ''}Z`;
    return Date.parse(iso);
  }
  return Date.parse(raw);
}

function kind(point: TideExtremePoint): 'high' | 'low' | null {
  const t = String(point.type ?? '').toLowerCase();
  if (t.includes('high')) return 'high';
  if (t.includes('low')) return 'low';
  return null;
}

/**
 * The first high and the first low strictly after `afterMs`, as the source's
 * own time strings (unchanged, so the stored format does not change). Null
 * when the series has none after that moment or the time is unreadable.
 */
export function pickNextExtremes(
  points: TideExtremePoint[] | null | undefined,
  afterMs: number,
): { nextHigh: string | null; nextLow: string | null } {
  let high: { ms: number; time: string } | null = null;
  let low: { ms: number; time: string } | null = null;
  for (const p of points ?? []) {
    const k = kind(p);
    if (!k) continue;
    const ms = tideTimeMs(p);
    if (!Number.isFinite(ms) || ms <= afterMs) continue;
    if (k === 'high' && (!high || ms < high.ms)) high = { ms, time: p.time };
    if (k === 'low' && (!low || ms < low.ms)) low = { ms, time: p.time };
  }
  return { nextHigh: high?.time ?? null, nextLow: low?.time ?? null };
}
