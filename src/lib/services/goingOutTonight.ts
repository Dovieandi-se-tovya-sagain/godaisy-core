export type TonightInputs = {
  tz: string;                         // e.g. 'Europe/Madrid'
  windowStartISO: string;             // start of “tonight” window
  windowEndISO: string;               // end of “tonight” window (e.g., midnight)
  // Weather
  precipProbMax?: number | null;      // 0..100 %
  precipIntensityMaxMm?: number | null; // mm/h
  thunderProbMax?: number | null;     // 0..100 %
  windGustMaxMps?: number | null;     // m/s
  windMeanMps?: number | null;        // m/s
  windPeakTimeISO?: string | null;    // when gust peaks
  tempEveC?: number | null;           // ~19–22h mean
  tempNightMinC?: number | null;      // min through the night
  humidityMeanPct?: number | null;    // %
  // Health/env
  airEuAqiMax?: number | null;        // EU AQI (0–100+)
  pollenSeverity?: 'none'|'low'|'moderate'|'high'|'very_high';
  // Marine (optional, auto-omitted inland)
  waveHeightMaxM?: number | null;
  tideWithinWindow?: { type:'high'|'low'; timeISO:string } | null;
};

const kmh = (mps?: number | null) => (typeof mps === 'number' ? Math.round(mps * 3.6) : null);
const hhmmLocal = (iso?: string | null, tz='UTC') =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour:'2-digit', minute:'2-digit' }).format(new Date(iso)) : null;

export function composeGoingOutTonight(i: TonightInputs, style: 'short'|'bullets' = 'short') {
  const bits: string[] = [];

  // Umbrella / rain
  const wet = (i.precipProbMax ?? 0) >= 40 || (i.precipIntensityMaxMm ?? 0) >= 1;
  if (wet) bits.push('Bring a brolly.');

  // Thunder
  if ((i.thunderProbMax ?? 0) >= 20) bits.push('Small chance of thunder—keep an eye on the sky.');

  // Wind (use gusts)
  const gustKmh = kmh(i.windGustMaxMps);
  const peakTime = hhmmLocal(i.windPeakTimeISO, i.tz);
  if (gustKmh != null) {
    if (gustKmh >= 70) bits.push(`Gales expected${peakTime ? ` around ${peakTime}` : ''}.`);
    else if (gustKmh >= 50) bits.push(`Strong winds${peakTime ? ` around ${peakTime}` : ''}.`);
  }

  // Temperature feels
  if (typeof i.tempEveC === 'number') {
    if (i.tempEveC <= 8) bits.push('Wrap up warm.');
    else if (i.tempEveC <= 14) bits.push('A warm layer will help.');
    else if (i.tempEveC >= 26) bits.push('It’ll feel warm even later on.');
    else if (i.tempEveC >= 20) bits.push('Light jacket should do.');
  }

  // Humidity nudge (hot & humid nights)
  if ((i.humidityMeanPct ?? 0) >= 80 && (i.tempEveC ?? 0) >= 24) bits.push('It may feel muggy.');

  // Air quality
  const aqi = i.airEuAqiMax;
  if (typeof aqi === 'number') {
    if (aqi > 80) bits.push('Air quality is very poor—avoid strenuous activity outdoors.');
    else if (aqi > 60) bits.push('Air quality is poor—take it easy if you’re sensitive.');
  }

  // Pollen
  if (i.pollenSeverity && i.pollenSeverity !== 'none' && i.pollenSeverity !== 'low') {
    bits.push('Pollen is up—pack antihistamines if you need them.');
  }

  // Marine (only if present)
  if (typeof i.waveHeightMaxM === 'number') {
    if (i.waveHeightMaxM >= 2.5) bits.push('Rough seas—take care near the shore.');
    else if (i.waveHeightMaxM >= 1.5) bits.push('Choppy along the coast.');
  }
  if (i.tideWithinWindow?.type === 'high') {
    const t = hhmmLocal(i.tideWithinWindow.timeISO, i.tz);
    if (t) bits.push(`High tide around ${t}.`);
  }

  // De-dup & tidy
  const line = bits
    .filter(Boolean)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter((s, idx, arr) => arr.indexOf(s) === idx);

  if (style === 'bullets') return line;

  // Short, conversational sentence or two
  if (!line.length) {
  const bits2: string[] = [];

  // If we have probabilities/intensity and they are low, call it dry
  if (typeof i.precipProbMax === 'number' && (i.precipProbMax < 30) && ((i.precipIntensityMaxMm ?? 0) < 1)) {
    bits2.push('mostly dry');
  }

  // If mean/gust winds are gentle, note it
  const meanKmh = kmh(i.windMeanMps);
  const gustKmh = kmh(i.windGustMaxMps);
  if ((meanKmh != null && meanKmh < 25) && (gustKmh == null || gustKmh < 50)) {
    bits2.push('light winds');
  }

  // If evening temperature is in a comfy band, add that
  if (typeof i.tempEveC === 'number' && i.tempEveC >= 15 && i.tempEveC <= 22) {
    bits2.push('comfortable temperatures');
  }

  const tail = bits2.length ? ` — ${bits2.join(', ')}.` : '.';
  return `Looks fine for a night out${tail}`;
}
  // Stitch the first two; prepend “If you’re going out tonight,” if we have weather hazards
  const hazards = wet || (gustKmh ?? 0) >= 50 || (aqi ?? 0) > 60;
  const lead = hazards ? `If you’re going out tonight, ` : '';
  const [first, second, ...rest] = line;
  const extra = rest.length ? ` ${rest.join(' ')}` : '';
  return `${lead}${first}${second ? ' ' + second : ''}.${extra ? ' ' + extra : ''}`;
}

/**
 * Describe the clearest sky time from Open‑Meteo hourly cloud cover.
 * Pass the hourly block you already fetch (must include `time[]` and `cloudcover[]`).
 * Optionally restrict to a window and apply a small smoothing to avoid spiky minutes.
 */
export function describeClearestSkiesFromHourly(
  hourly: { time?: string[]; cloudcover?: number[] },
  tz: string,
  opts?: { windowStartISO?: string; windowEndISO?: string; smooth?: number; goodPct?: number; okPct?: number }
): string | null {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const ccRaw = Array.isArray(hourly?.cloudcover) ? hourly.cloudcover.map(Number) : [];
  if (!times.length || !ccRaw.length || times.length !== ccRaw.length) return null;

  // Restrict to a window if provided
  let idxs = times.map((_, i) => i);
  const startMs = opts?.windowStartISO ? Date.parse(opts.windowStartISO) : Number.NEGATIVE_INFINITY;
  const endMs = opts?.windowEndISO ? Date.parse(opts.windowEndISO) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(startMs) || Number.isFinite(endMs)) {
    idxs = idxs.filter(i => {
      const ms = Date.parse(times[i]);
      return Number.isFinite(ms) && ms >= (Number.isFinite(startMs) ? startMs : ms) && ms <= (Number.isFinite(endMs) ? endMs : ms);
    });
  }
  if (!idxs.length) return null;

  // Smooth with a small rolling mean (default 3 points)
  const w = Math.max(1, Math.floor(opts?.smooth ?? 3));
  const half = Math.floor((w - 1) / 2);
  const smoothed: number[] = [];
  for (const i of idxs) {
    const a = Math.max(0, i - half);
    const b = Math.min(ccRaw.length - 1, i + half);
    const slice = ccRaw.slice(a, b + 1).filter(Number.isFinite) as number[];
    smoothed.push(slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : ccRaw[i]);
  }

  // Find the minimum cloud cover within the (possibly smoothed) series
  let localMinIdx = 0;
  let localMinVal = smoothed[0];
  for (let j = 1; j < smoothed.length; j++) {
    if (smoothed[j] < localMinVal) { localMinVal = smoothed[j]; localMinIdx = j; }
  }
  const bestGlobalIdx = idxs[localMinIdx];
  const bestISO = times[bestGlobalIdx];
  const hhmm = hhmmLocal(bestISO, tz) || '—';

  // Phrase thresholds (tweakable)
  const good = opts?.goodPct ?? 30; // % cloud cover regarded as "clearish"
  const ok   = opts?.okPct   ?? 60; // "breaks in cloud"
  if (localMinVal <= good) return `Skies will be clearest around ${hhmm}.`;
  if (localMinVal <= ok)   return `Best break in the cloud near ${hhmm}.`;
  return `Cloud breaks look limited; your best chance is around ${hhmm}.`;
}

// NOTE: This module exports only the hook. Page components live under pages/.