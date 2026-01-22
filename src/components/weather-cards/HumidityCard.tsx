import React from 'react';

interface HumidityCardProps {
  weather: {
    dewPointC?: number;
  };
  humidity: number | null; // relative humidity 0–100
}

// ——— Helpers ——————————————————————————————————————————————
function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

// Map humidity + dew point to a human comfort bucket
// 🌵 Dry / 🙂 Comfy / 💦 Sticky (+ neutral when ambiguous)
function getHumidityComfort(humidity: number | null, dewPointC?: number) {
  const rh = isFiniteNumber(humidity) ? humidity : null;
  const dp = isFiniteNumber(dewPointC) ? dewPointC : null;

  // Defaults
  let emoji: '🌵' | '🙂' | '💦' | '•' = '•';
  let label = 'Unknown';
  let desc = 'Humidity data unavailable';
  let tone: 'dry' | 'comfy' | 'sticky' | 'neutral' = 'neutral';

  if (rh == null && dp == null) return { emoji, label, desc, tone };

  // Primary by RH ranges (generally accepted):
  // Dry <35%, Comfy 40–60%, Sticky >65%
  if (rh != null) {
    if (rh < 35) { tone = 'dry'; }
    else if (rh > 65) { tone = 'sticky'; }
    else if (rh >= 40 && rh <= 60) { tone = 'comfy'; }
    else { tone = 'neutral'; }
  }

  // Adjust with dew point (optional but powerful)
  // dp <10°C → dry tendency; 10–18°C → comfy; >18°C → sticky/oppressive
  if (dp != null) {
    if (dp < 10 && tone === 'neutral') tone = 'dry';
    if (dp > 18 && tone !== 'dry') tone = 'sticky';
    if (dp >= 10 && dp <= 18 && tone === 'neutral') tone = 'comfy';
  }

  switch (tone) {
    case 'dry':
      emoji = '🌵';
      label = 'Dry';
      desc = 'Air feels dry; moisturise, hydrate.';
      break;
    case 'comfy':
      emoji = '🙂';
      label = 'Comfy';
      desc = 'Sweet spot for most people and activities.';
      break;
    case 'sticky':
      emoji = '💦';
      label = 'Sticky';
      desc = 'Muggy; sweat evaporation is poor.';
      break;
    default:
      emoji = '•';
      label = 'Moderate';
      desc = 'Neither dry nor humid; fairly normal.';
  }

  return { emoji, label, desc, tone };
}

function badgeClasses(tone: ReturnType<typeof getHumidityComfort>['tone']) {
  switch (tone) {
    case 'dry': return 'badge badge-info';
    case 'comfy': return 'badge badge-success';
    case 'sticky': return 'badge badge-warning';
    default: return 'badge';
  }
}

// ——— SVG utilities for the classic hygrometer dial ————————————
const GAUGE_START = -120; // degrees
const GAUGE_END = 120;    // degrees (240° sweep)

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const a = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(p0: number, p1: number, r: number) {
  // p0/p1 are 0–100 percentages along the dial
  const a0 = GAUGE_START + (p0 / 100) * (GAUGE_END - GAUGE_START);
  const a1 = GAUGE_START + (p1 / 100) * (GAUGE_END - GAUGE_START);
  const start = polarToCartesian(60, 60, r, a0);
  const end = polarToCartesian(60, 60, r, a1);
  const largeArc = (a1 - a0) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function angleForValue(v: number) {
  const clamped = Math.max(0, Math.min(100, v));
  return GAUGE_START + (clamped / 100) * (GAUGE_END - GAUGE_START);
}

type Tone = ReturnType<typeof getHumidityComfort>['tone'];

const HygrometerDial: React.FC<{ value: number; label: string; tone: Tone }> = ({ value, label, tone }) => {
  const angle = angleForValue(value);
  const toneToText = (t: Tone) => {
    switch (t) {
      case 'dry': return 'text-info';
      case 'comfy': return 'text-success';
      case 'sticky': return 'text-warning';
      default: return 'text-base-content/50';
    }
  };
  const toneClass = toneToText(tone);

  return (
    <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 drop-shadow-sm">
      <defs>
        {/* soft inner shadow for the dial face */}
        <filter id="dialShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Dial face with subtle bezel */}
      <circle cx={60} cy={60} r={42} className="fill-base-100/70" filter="url(#dialShadow)" />
      <circle cx={60} cy={60} r={42} className="fill-none stroke-base-300/60" strokeWidth={1} />
      <circle cx={60} cy={60} r={41} className="fill-none stroke-base-100/80" strokeWidth={1} />

      {/* Background track (thin, neutral) */}
      <path d={arcPath(0, 100, 44)} className="stroke-base-300/40" strokeWidth={6} strokeLinecap="butt" fill="none" />

      {/* Classic zones: straight caps, slightly narrower for finesse */}
      <path d={arcPath(0, 33, 44)}    className="stroke-info opacity-90"    strokeWidth={6} strokeLinecap="butt" fill="none" />
      <path d={arcPath(40, 60, 44)}   className="stroke-success opacity-90" strokeWidth={6} strokeLinecap="butt" fill="none" />
      <path d={arcPath(67, 100, 44)}  className="stroke-warning opacity-90" strokeWidth={6} strokeLinecap="butt" fill="none" />

      {/* Graded transitions between rim zones */}
      {/* Dry→Comfy blend (info, low opacity) */}
      <path d={arcPath(33, 40, 44)} className="stroke-info opacity-35" strokeWidth={6} strokeLinecap="butt" fill="none" />
      {/* Dry→Comfy blend (success, low opacity) */}
      <path d={arcPath(33, 40, 44)} className="stroke-success opacity-35" strokeWidth={6} strokeLinecap="butt" fill="none" />
      {/* Comfy→Sticky blend (success, low opacity) */}
      <path d={arcPath(60, 67, 44)} className="stroke-success opacity-35" strokeWidth={6} strokeLinecap="butt" fill="none" />
      {/* Comfy→Sticky blend (warning, low opacity) */}
      <path d={arcPath(60, 67, 44)} className="stroke-warning opacity-35" strokeWidth={6} strokeLinecap="butt" fill="none" />

      {/* Crisp separators at zone boundaries (etched look) */}
      {([33,40,60,67] as const).map((p,i)=>{
        const a = angleForValue(p);
        const o = polarToCartesian(60,60,44,a);
        const i1 = polarToCartesian(60,60,38.5,a);
        return (
          <g key={i}>
            <line x1={o.x} y1={o.y} x2={i1.x} y2={i1.y} className="stroke-base-100" strokeWidth={2.2} strokeLinecap="butt" />
            <line x1={o.x} y1={o.y} x2={i1.x} y2={i1.y} className="stroke-base-300/70" strokeWidth={1} strokeLinecap="butt" />
          </g>
        );
      })}

      {/* Ticks: fine minor (10%), clearer major (20%) */}
      {Array.from({ length: 11 }, (_, i) => i * 10).map(p => {
        const a = angleForValue(p);
        const outer = polarToCartesian(60, 60, 46, a);
        const inner = polarToCartesian(60, 60, 46 - (p % 20 === 0 ? 7 : 4), a);
        const cls = p % 20 === 0 ? 'stroke-base-content/70' : 'stroke-base-content/35';
        const sw  = p % 20 === 0 ? 2 : 1.25;
        return (
          <line key={p} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                className={cls} strokeWidth={sw} strokeLinecap="round" />
        );
      })}

      {/* Needle (rounded tip + small counterweight) */}
      {(() => {
        const tip = polarToCartesian(60, 60, 38, angle);
        const tail = polarToCartesian(60, 60, 18, angle + 180);
        return (
          <>
            <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y}
                  className="stroke-base-content" strokeWidth={3} strokeLinecap="round" />
            <circle cx={tail.x} cy={tail.y} r={2.2} className="fill-base-content/70" />
            <circle cx={60} cy={60} r={3.6} className="fill-base-content" />
          </>
        );
      })()}

      {/* Thin accent arc up to value */}
      <path d={arcPath(0, value, 52)} className={`${toneClass.replace('text-','stroke-')} opacity-70`} strokeWidth={1.6} strokeLinecap="round" fill="none" />

      {/* Centre readout */}
      <text x={60} y={88} textAnchor="middle" className="fill-base-content font-semibold tracking-tight tabular-nums">{label}</text>
      <text x={60} y={97} textAnchor="middle" className="fill-base-content/60 text-[10px]">RH</text>
    </svg>
  );
};

// ——— Component ——————————————————————————————————————————————
export const HumidityCard: React.FC<HumidityCardProps> = ({ weather, humidity }) => {
  const dp = isFiniteNumber(weather?.dewPointC) ? weather!.dewPointC : undefined;
  const rh = isFiniteNumber(humidity) ? Math.max(0, Math.min(100, Number(humidity))) : null;
  const comfort = getHumidityComfort(rh, dp);
  const badgeColour = badgeClasses(comfort.tone);

  const rhDisplay = rh != null ? `${Math.round(rh)}%` : '—';
  const dpDisplay = dp != null ? `${Math.round(dp)}°` : '—';
  const title = rh != null ? `Relative humidity ${rhDisplay}` : 'Relative humidity unavailable';

  return (
    <div className="card weather-card-bg text-base-content" aria-label="Humidity card">
      <div className="card-body">
        <div className="flex items-center justify-between gap-3">
          <h3 className="card__header-title">Humidity</h3>
          <div className={`flex items-center gap-2 ${badgeColour}`} title={comfort.desc} aria-label={`Comfort: ${comfort.label}`}>
            <span aria-hidden>{comfort.emoji}</span>
            <span className="uppercase tracking-wide text-xs">{comfort.label}</span>
          </div>
        </div>

        <div className="flex items-center md:gap-6 gap-3">
          {/* Classic hygrometer dial */}
          <HygrometerDial value={rh ?? 0} label={rhDisplay} tone={comfort.tone} />

          <div className="text-sm opacity-80 space-y-1" aria-label={title}>
            <div> Dew point <span className="font-semibold">{dpDisplay}</span></div>
            <div className="opacity-80">
              <span className="font-medium">{comfort.label}</span> — {comfort.desc}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-3 text-xs opacity-70">
          <span className="inline-flex items-center gap-1"><span>🌵</span> <span className="text-info">Dry</span></span>
          <span className="inline-flex items-center gap-1"><span>🙂</span> <span className="text-success">Comfy</span></span>
          <span className="inline-flex items-center gap-1"><span>💦</span> <span className="text-warning">Sticky</span></span>
        </div>
      </div>
    </div>
  );
};
