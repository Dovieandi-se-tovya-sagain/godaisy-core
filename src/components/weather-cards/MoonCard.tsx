import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import type { MoonInfo } from '../../types/weather';

export type MoonCardProps = {
  moon?: MoonInfo | null;
  today?: {
    moonPhase?: number;
    moonriseISO?: string;
    moonsetISO?: string;
    sunriseISO?: string;
    sunsetISO?: string;
    dayLengthMinutes?: number;
  };
};

const MoonNugget = dynamic(() => import('../MoonNugget').then(m => m.default), { ssr: false });

function nasaMoonImageForPhase(phase?: number): string {
  // Expect images placed in /public/moon/
  // new.jpg, waxing_crescent.jpg, first_quarter.jpg, waxing_gibbous.jpg,
  // full.jpg, waning_gibbous.jpg, third_quarter.jpg, waning_crescent.jpg
  if (phase == null) return '/moon/full.jpg';
  if (phase < 0.06 || phase > 0.94) return '/moon/new.jpg';
  if (phase < 0.19) return '/moon/waxing_crescent.jpg';
  if (phase < 0.31) return '/moon/first_quarter.jpg';
  if (phase < 0.44) return '/moon/waxing_gibbous.jpg';
  if (phase < 0.56) return '/moon/full.jpg';
  if (phase < 0.69) return '/moon/waning_gibbous.jpg';
  if (phase < 0.81) return '/moon/third_quarter.jpg';
  return '/moon/waning_crescent.jpg';
}

// Helper functions for moon calculations
function moonIconForPhase(phase?: number): string {
  if (phase == null) return '/weather-icons/design/fill/final/moon-full.svg';
  if (phase < 0.06 || phase > 0.94) return '/weather-icons/design/fill/final/moon-new.svg';
  if (phase < 0.19) return '/weather-icons/design/fill/final/moon-waxing-crescent.svg';
  if (phase < 0.31) return '/weather-icons/design/fill/final/moon-first-quarter.svg';
  if (phase < 0.44) return '/weather-icons/design/fill/final/moon-waxing-gibbous.svg';
  if (phase < 0.56) return '/weather-icons/design/fill/final/moon-full.svg';
  if (phase < 0.69) return '/weather-icons/design/fill/final/moon-waning-gibbous.svg';
  if (phase < 0.81) return '/weather-icons/design/fill/final/moon-last-quarter.svg';
  return '/weather-icons/design/fill/final/moon-waning-crescent.svg';
}

function calcIlluminationPct(phase?: number): number {
  if (phase == null) return 0;
  // Approximate illuminated fraction from phase (0=new, 0.5=full)
  const frac = (1 - Math.cos(2 * Math.PI * phase)) / 2; // 0..1
  return Math.round(frac * 100);
}

// SVG donut for illumination (avoids radial-progress distortion)
const IlluminationDonut: React.FC<{ pct: number; label?: string }> = ({ pct, label }) => {
  const p = Math.max(0, Math.min(100, pct));
  const r = 24; const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16 shrink-0">
      <circle cx="32" cy="32" r={r} className="stroke-base-300 fill-none" strokeWidth={8} />
      <circle
        cx="32" cy="32" r={r}
        className="fill-none stroke-success"
        strokeWidth={8}
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="fill-base-content font-semibold tabular-nums">{p}%</text>
      {label && (
        <text x="32" y="50" textAnchor="middle" className="fill-base-content/60 text-[10px]">{label}</text>
      )}
    </svg>
  );
};

export const MoonCard: React.FC<MoonCardProps> = ({
  moon,
  today = {}
}) => {
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const formatTime = (iso?: string): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return '—';
    }
  };

  const phaseFraction = moon?.phaseFraction ?? today?.moonPhase;
  const moonriseISO = moon?.moonriseISO ?? today?.moonriseISO;
  const moonsetISO = moon?.moonsetISO ?? today?.moonsetISO;
  const sunriseISO = moon?.sunriseISO ?? today?.sunriseISO;
  const sunsetISO = moon?.sunsetISO ?? today?.sunsetISO;
  const dayLengthMinutes = moon?.dayLengthMinutes ?? today?.dayLengthMinutes;

  const getNightLength = (moonrise?: string, moonset?: string): string => {
    if (!moonrise || !moonset) return '—';
    try {
      const rise = new Date(moonrise);
      const set = new Date(moonset);
      let diffMs = set.getTime() - rise.getTime();
      
      // Handle case where moonset is next day
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000; // Add 24 hours
      }
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return '—';
    }
  };

  const getMoonPhaseName = (phase?: number): string => {
    if (phase == null) return '—';
    if (phase < 0.06 || phase > 0.94) return 'New';
    if (phase < 0.19) return 'Waxing crescent';
    if (phase < 0.31) return 'First quarter';
    if (phase < 0.44) return 'Waxing gibbous';
    if (phase < 0.56) return 'Full';
    if (phase < 0.69) return 'Waning gibbous';
    if (phase < 0.81) return 'Last quarter';
    return 'Waning crescent';
  };

  const inferredPhaseName = getMoonPhaseName(phaseFraction);
  const phaseName = moon?.phaseName ?? inferredPhaseName;
  const phaseStage = moon?.phaseStage;
  const daysUntilFullMoon = moon?.daysUntilNextFullMoon;
  const daysUntilNewMoon = moon?.daysUntilNextNewMoon;
  const illumPct = typeof moon?.illuminationPct === 'number'
    ? Math.round(moon.illuminationPct)
    : calcIlluminationPct(phaseFraction);

  return (
    <div className="card weather-card-bg text-base-content">
      <div className="card-body">
        <h3 className="card__header-title flex items-center gap-2">
          <Image 
            src={moonIconForPhase(phaseFraction)} 
            alt="Moon Phase" 
            width={60} 
            height={60} 
            className="w-12 h-12" 
          />
          {phaseName && phaseName !== '—' ? `${phaseName} Moon` : 'Moon'}
          {phaseStage && <span className="text-sm opacity-70 capitalize">({phaseStage})</span>}
        </h3>
        
        {/* Big icons side by side */}
        <div className="flex items-center justify-center gap-8 my-4">
          <div className="text-center">
            <Image 
              src="/weather-icons/design/fill/final/moonrise.svg" 
              alt="Moonrise" 
              width={64} 
              height={64} 
              className="w-12 h-12 mx-auto mb-2" 
            />
            <div className="text-lg font-bold">{formatTime(moonriseISO)}</div>
            <div className="text-sm opacity-70">Moonrise</div>
          </div>
          
          <div className="text-center">
            <Image 
              src="/weather-icons/design/fill/final/moonset.svg" 
              alt="Moonset" 
              width={64} 
              height={64} 
              className="w-12 h-12 mx-auto mb-2" 
            />
            <div className="text-lg font-bold">{formatTime(moonsetISO)}</div>
            <div className="text-sm opacity-70">Moonset</div>
          </div>
        </div>

        <div className={`collapse mt-2 ${detailsOpen ? 'collapse-open' : ''}`}>
          <div
            className="collapse-title p-0 text-sm opacity-70 flex items-center justify-between cursor-pointer select-none"
            role="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen(o => !o)}
          >
            <span>More details</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {detailsOpen && (
            <div className="collapse-content p-0 mt-2">
              {/* Extended: NASA image + illumination */}
              <div className="flex items-center gap-4 mb-3">
                <div className="relative">
                  <Image
                    src={nasaMoonImageForPhase(phaseFraction)}
                    alt={phaseName}
                    width={200}
                    height={200}
                    className="w-32 h-32 md:w-40 md:h-40 object-cover mask mask-circle shadow-md"
                    priority
                  />
                </div>
                <IlluminationDonut pct={illumPct} label="Illuminated" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <div className="opacity-60 text-[11px] uppercase tracking-wide">Sunrise</div>
                  <div className="font-semibold">{formatTime(sunriseISO)}</div>
                </div>
                <div>
                  <div className="opacity-60 text-[11px] uppercase tracking-wide">Sunset</div>
                  <div className="font-semibold">{formatTime(sunsetISO)}</div>
                </div>
                <div>
                  <div className="opacity-60 text-[11px] uppercase tracking-wide">Moonrise</div>
                  <div className="font-semibold">{formatTime(moonriseISO)}</div>
                </div>
                <div>
                  <div className="opacity-60 text-[11px] uppercase tracking-wide">Moonset</div>
                  <div className="font-semibold">{formatTime(moonsetISO)}</div>
                </div>
                <div className="col-span-2">
                  <div className="opacity-60 text-[11px] uppercase tracking-wide">Day length</div>
                  <div className="font-semibold">
                    {typeof dayLengthMinutes === 'number'
                      ? `${Math.floor(dayLengthMinutes / 60)}h ${dayLengthMinutes % 60}m`
                      : '—'}
                  </div>
                </div>
                {(daysUntilFullMoon != null || daysUntilNewMoon != null) && (
                  <>
                    {daysUntilFullMoon != null && (
                      <div>
                        <div className="opacity-60 text-[11px] uppercase tracking-wide">Next Full Moon</div>
                        <div className="font-semibold">
                          {daysUntilFullMoon === 0 ? 'Today' : daysUntilFullMoon === 1 ? 'Tomorrow' : `${daysUntilFullMoon} days`}
                        </div>
                      </div>
                    )}
                    {daysUntilNewMoon != null && (
                      <div>
                        <div className="opacity-60 text-[11px] uppercase tracking-wide">Next New Moon</div>
                        <div className="font-semibold">
                          {daysUntilNewMoon === 0 ? 'Today' : daysUntilNewMoon === 1 ? 'Tomorrow' : `${daysUntilNewMoon} days`}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="text-sm leading-relaxed text-base-content/90 px-0 py-0 [&_*]:!bg-transparent [&_*]:!shadow-none [&_*]:!backdrop-blur-0 [&_*]:!border-0 [&_.badge]:hidden [&_.chip]:hidden [&_span.rounded-full]:hidden">
                <div className="font-medium mb-2">Moon folklore — <span className="capitalize">{(phaseName || '').toLowerCase()}</span></div>
                <MoonNugget />
              </div>
            </div>
          )}
        </div>

        <div className="divider my-2 md:hidden"></div>
        
        <div className="flex justify-between items-center md:hidden">
          <div className="text-center">
            <div className="text-sm opacity-70">Moon visible</div>
            <div className="text-lg font-semibold">{getNightLength(moonriseISO, moonsetISO)}</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm opacity-70">Phase</div>
            <div className="text-lg font-semibold">{phaseName}</div>
          </div>
        </div>

        {/* Big phase icon + donut */}
        <div className="flex items-center justify-center gap-6 mt-4 md:hidden">
          <div className="relative">
            <Image
              src={nasaMoonImageForPhase(phaseFraction)}
              alt={phaseName}
              width={200}
              height={200}
              className="w-36 h-36 md:w-44 md:h-44 object-cover mask mask-circle shadow-md"
              priority
            />
          </div>
          <IlluminationDonut pct={illumPct} label="Illuminated" />
        </div>

        <div className="mt-1 text-[10px] opacity-60 text-right md:hidden">Imagery: NASA SVS (public domain)</div>
      </div>
    </div>
  );
};
