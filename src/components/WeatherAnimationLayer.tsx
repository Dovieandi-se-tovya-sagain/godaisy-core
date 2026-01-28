// components/WeatherAnimationLayer.tsx
// British English. DaisyUI-friendly background layer that maps live weather → CSS layers.
// Uses utils/weatherBackground.ts (clouds/waves) and your windwave.css classes.
// This component is weather-aware but does NOT fetch; pass in unified fields from your data layer.

import React, { useMemo } from 'react';
import { pickBackgroundClasses, type Condition } from '../utils/weatherBackground';

// Local unified weather shape to support a single `weather` prop without circular imports
export interface UnifiedWeatherData {
  condition: Condition | 'clear' | 'cloudy' | 'overcast' | 'drizzle' | 'rain' | 'storm' | 'snow' | 'fog' | 'marine_calm' | 'marine_choppy' | 'marine_storm';
  temperatureC?: number;
  windSpeedMS?: number;
  windDirectionDeg?: number;
  humidity?: number;
  visibilityKM?: number;
  precipitationMMph?: number;
  isCoastal?: boolean;
  applyBeaufort?: boolean;
  localTimeISO?: string;
  cloudPct?: number;
  waveHeightM?: number;
}

// Props accepted by WeatherAnimationLayer
export interface WeatherBackplateProps {
  weather?: UnifiedWeatherData;
  condition?: Condition;
  cloudPct?: number;
  waveHeightM?: number;
  windSpeedMS?: number;
  isMarine?: boolean;
  applyBeaufortToInland?: boolean;
  showPrecipOverlay?: boolean;
  mode?: string; // accepted for backward-compat; unused
  className?: string;
  children?: React.ReactNode;
  ambient?: number; // 0..1 multiplier for animation brightness
  blurPx?: number;  // optional blur applied to background layers
  opacity?: number; // 0..1 master opacity for background layers
  cloudVariantOverride?: 'none' | 'light' | 'dark' | 'overcast'; // force specific cloud variant
  // Solar times (ISO strings) to sync diurnal colour cycle
  sunriseISO?: string;
  sunsetISO?: string;
}

// Allow strongly-typed access to custom CSS vars used by this component
// Extend CSSProperties with specific custom properties we set dynamically
// (keeps TS happy without using any-casts everywhere)

type CSSVarKeys =
  | '--wa-anim-ambient'
  | '--wa-anim-blur'
  | '--wa-anim-opacity'
  | '--wa-atmo-end'
  | '--wa-attenuate-start'
  | '--rain-angle'
  | '--rain-density'
  | '--rain-speed';

type StyleVars = React.CSSProperties & Partial<Record<CSSVarKeys, string | number>>;

// SVG waves with simple horizontal looping animation
function WaveSVG({
  amplitude = 18,
  wavelength = 180,
  baseline = 220,
  colorTop = 'rgba(0,120,200,0.55)',
  colorMid = 'rgba(0,120,200,0.35)',
  colorBot = 'rgba(0,120,200,0.15)',
  speedSec = 14,
}: {
  amplitude?: number;
  wavelength?: number;
  baseline?: number;
  colorTop?: string;
  colorMid?: string;
  colorBot?: string;
  speedSec?: number;
}) {
  // Build a smooth wave path across 1200px using cubic curves
  const buildPath = (phase: number) => {
    const width = 1200;
    const steps = Math.ceil(width / wavelength);
    let d = `M ${-phase} ${baseline}`;
    for (let i = 0; i <= steps + 2; i++) {
      const x = i * wavelength - phase;
      const cp1x = x + wavelength * 0.25;
      const cp2x = x + wavelength * 0.75;
      const y1 = baseline - amplitude;
      const y2 = baseline + amplitude;
      d += ` C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x + wavelength} ${baseline}`;
    }
    // Close to bottom of viewBox to create a filled shape
    d += ` L ${width * 2} 300 L -${width} 300 Z`;
    return d;
  };

  const pathTop = buildPath(0);
  const pathMid = buildPath(wavelength / 2);
  const pathBot = buildPath(wavelength);
  const duration = `${Math.max(6, Math.min(40, speedSec))}s`;

  return (
    <svg className="absolute inset-0" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorTop} />
          <stop offset="60%" stopColor={colorMid} />
          <stop offset="100%" stopColor={colorBot} />
        </linearGradient>
      </defs>

      <g className="wa-wave-layer" style={{ animationDuration: duration }}>
        <path d={pathBot} fill="url(#waveGrad)" />
        <path d={pathMid} fill="url(#waveGrad)" />
        <path d={pathTop} fill="url(#waveGrad)" />
      </g>
      {/* duplicate group for seamless loop */}
      <g className="wa-wave-layer" style={{ animationDuration: duration, transform: 'translateX(1200px)' }}>
        <path d={pathBot} fill="url(#waveGrad)" />
        <path d={pathMid} fill="url(#waveGrad)" />
        <path d={pathTop} fill="url(#waveGrad)" />
      </g>
    </svg>
  );
}

export default function WeatherAnimationLayer(props: WeatherBackplateProps) {
  const {
    weather,
    condition: condProp,
    cloudPct: cloudProp,
    waveHeightM: waveProp,
    windSpeedMS: windProp,
    isMarine: marineProp,
    applyBeaufortToInland: inlandProp,
    showPrecipOverlay = true,
    className = '',
    children,
    ambient,
    blurPx,
    opacity,
    cloudVariantOverride,
    // Optional: pass real solar times to sync diurnal cycle
    sunriseISO,
    sunsetISO,
  } = props;

  // Derive effective inputs from unified object or individual props
  const condition = (weather?.condition ?? condProp ?? 'clear') as Condition;
  const cloudPct = weather?.cloudPct ?? cloudProp ?? 0;
  const waveHeightM = weather?.waveHeightM ?? waveProp;
  const windSpeedMS = weather?.windSpeedMS ?? windProp;
  const isMarine = weather?.isCoastal ?? marineProp ?? false;
  const applyBeaufortToInland = weather?.applyBeaufort ?? inlandProp ?? false;

  // Derive an effective condition from cloud cover when not precip/fog.
  // - >=70% → overcast, >=40% → cloudy, else clear (light/wispy 20–39% handled at render stage)
  // - Precip/fog/storm conditions are preserved as-is.
  const effectiveCondition = useMemo<Condition>(() => {
    const keptConditions: ReadonlySet<Condition> = new Set<Condition>([
      'storm', 'marine_storm', 'rain', 'drizzle', 'snow', 'fog'
    ]);
    if (keptConditions.has(condition)) return condition;
    if (cloudPct >= 70) return 'overcast';
    if (cloudPct >= 40) return 'cloudy';
    return 'clear';
  }, [condition, cloudPct]);

  // Decide which CSS classes to render (clouds/waves)
  const bg = useMemo(() => pickBackgroundClasses({
    condition: effectiveCondition,
    cloudPct,
    waveHeightM,
    windSpeedMS,
    isMarine,
    applyBeaufortToInland,
  }), [effectiveCondition, cloudPct, waveHeightM, windSpeedMS, isMarine, applyBeaufortToInland]);

  // Optional gentle precip layer purely in CSS (no particles)
  const wantsCssPrecip =
    showPrecipOverlay && (condition === 'drizzle' || condition === 'rain' || condition === 'snow' || condition === 'storm' || condition === 'marine_storm');

  // Check if we want lightning for storm conditions
  const wantsLightning = 
    showPrecipOverlay && (condition === 'storm' || condition === 'marine_storm');

  // For storms, we want both rain and lightning
  const precipType = (condition === 'storm' || condition === 'marine_storm') ? 'rain' : 
                     condition === 'snow' ? 'snow' : 'rain';

  // Calculate rain intensity based on weather data
  const precipMM = weather?.precipitationMMph || 0;
  const windMS = weather?.windSpeedMS || windSpeedMS || 0;
  
  // Rain density: light (8 drops), moderate (12 drops), heavy (20 drops), storm (30 drops)
  const rainDensity = precipMM > 10 ? 30 : precipMM > 5 ? 20 : precipMM > 1 ? 12 : 8;
  
  // Rain speed: affected by precipitation intensity and wind
  const baseSpeed = 0.8; // base animation duration
  const speedMultiplier = Math.max(0.3, 1 - (precipMM * 0.05) - (windMS * 0.02));
  const rainSpeed = baseSpeed * speedMultiplier;
  
  // Wind angle: stronger wind creates more diagonal rain
  const windAngle = Math.min(25, 8 + (windMS * 0.8)); // 8-25 degrees based on wind

  // Select appropriate cloud type and background based on weather conditions
  const getAtmosphericEffects = () => {
    let cloudClass = '';
    let backgroundClass = '';
    
    // First, determine base cloud class from weather condition
    switch (effectiveCondition) {
      case 'storm':
      case 'marine_storm':
        cloudClass = 'wa-clouds-dark';      // Dark storm clouds (brightness: 0.4)
        backgroundClass = 'wa-storm-bg';
        break;
      case 'rain':
        cloudClass = 'wa-clouds-overcast';  // Heavy overcast (brightness: 0.65)
        backgroundClass = 'wa-rain-bg';
        break;
      case 'snow':
        cloudClass = 'wa-clouds-dark';      // Dark heavy clouds for snow (brightness: 0.4)
        backgroundClass = 'wa-overcast-bg';
        break;
      case 'overcast':
        cloudClass = 'wa-clouds-overcast';  // Medium/Heavy overcast
        backgroundClass = 'wa-overcast-bg';
        break;
      case 'drizzle':
        cloudClass = 'wa-clouds-light';     // Light wispy clouds (brightness: 0.9)
        backgroundClass = 'wa-drizzle-bg';
        break;
      case 'fog':
        cloudClass = 'wa-clouds-light';     // Light wispy clouds (brightness: 0.9)
        backgroundClass = 'wa-overcast-bg';
        break;
      case 'cloudy':
        cloudClass = 'wa-clouds';           // Standard clouds (brightness: 1.0)
        backgroundClass = '';
        break;
      case 'clear':
      default:
        // Light/wispy clouds for low cloud cover (20–39%) unless overridden by precip/fog/storm
        if (cloudPct >= 20 && cloudPct < 40) {
          cloudClass = 'wa-clouds-light';
          backgroundClass = 'wa-clear';
        } else {
          cloudClass = 'wa-clouds-sunny';   // Clear-sky sunny texture
          backgroundClass = 'wa-clear';
        }
        break;
    }
    
    // Override cloud class if specified
    if (cloudVariantOverride) {
      if (cloudVariantOverride === 'none') {
        // "Natural / No Filter" should still show the clear-sky Sunny texture
        cloudClass = 'wa-clouds-sunny';
      } else {
        cloudClass = `wa-clouds-${cloudVariantOverride}`;
      }
    }
    
    return { cloudClass, backgroundClass };
  };

  const atmospheric = getAtmosphericEffects();

  // Inline CSS variables allow per-instance tuning while remaining theme-aware
  const styleVars: StyleVars = {};
  if (typeof ambient === 'number') styleVars['--wa-anim-ambient'] = String(ambient);
  if (typeof blurPx === 'number') styleVars['--wa-anim-blur'] = `${blurPx}px`;
  if (typeof opacity === 'number') styleVars['--wa-anim-opacity'] = String(opacity);

  // Compute dynamic keyframes aligning 0..100% to 24h day starting at local midnight.
  // We place dawn/sunrise/sunset/night stops based on provided times.
  const diurnalStyleTagId = 'wa-diurnal-style';
  const diurnalAnimationName = 'wa-diurnal-runtime';
  const diurnalCss = React.useMemo(() => {
    if (typeof document === 'undefined') return '';
    const sr = sunriseISO ? new Date(sunriseISO) : null;
    const ss = sunsetISO ? new Date(sunsetISO) : null;
    if (!sr || !ss || isNaN(sr.getTime()) || isNaN(ss.getTime())) return '';

    // Build percentages in the 24h day for dawn(−45m), sunrise, day plateau midpoint, sunset, night start(+90m)
    const midnight = new Date(sr); midnight.setHours(0,0,0,0);
    const dayMs = 24 * 3600_000;
    const pct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - midnight.getTime()) / dayMs) * 100));
    const minutes = (base: Date, deltaMin: number) => new Date(base.getTime() + deltaMin * 60_000);
    const dawn = minutes(sr, -45);
    const postSunset = minutes(ss, 90);
    const dayMidPct = (pct(sr) + pct(ss)) / 2;
    const kf = [
      { p: 0,    f: 'brightness(0.65) saturate(0.7) hue-rotate(-15deg)' },
      { p: pct(dawn), f: 'brightness(0.8) saturate(0.85) hue-rotate(-10deg)' },
      { p: pct(sr),   f: 'brightness(1) saturate(1) hue-rotate(0deg)' },
      { p: dayMidPct, f: 'brightness(1) saturate(1) hue-rotate(0deg)' },
      { p: pct(ss),   f: 'brightness(0.8) saturate(0.8) hue-rotate(12deg)' },
      { p: pct(postSunset), f: 'brightness(0.55) saturate(0.65) hue-rotate(-25deg)' },
      { p: 100,  f: 'brightness(0.65) saturate(0.7) hue-rotate(-15deg)' },
    ].sort((a,b)=>a.p-b.p);

    const stops = kf.map(s => `${s.p.toFixed(3)}% { filter: ${s.f}; }`).join('\n');
    return `@keyframes ${diurnalAnimationName} {\n${stops}\n}`;
  }, [sunriseISO, sunsetISO]);

  // Inject/replace the runtime keyframes so the animation name exists in the document
  React.useEffect(() => {
    if (!diurnalCss) return;
    let tag = document.getElementById(diurnalStyleTagId) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = diurnalStyleTagId;
      document.head.appendChild(tag);
    }
    tag.textContent = diurnalCss;
  }, [diurnalCss]);

  // Compute animation offset so it reflects current time of day on mount
  const diurnalDelaySec = React.useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(0,0,0,0);
    const elapsed = (now.getTime() - midnight.getTime()) / 1000; // seconds since midnight
    // Use negative delay to jump into animation timeline
    return Math.max(0, Math.min(86400, elapsed));
  }, []);

  // Determine if it's currently night to optionally widen masks and dim further
  const isNight = React.useMemo(() => {
    if (!sunriseISO || !sunsetISO) return false;
    const now = new Date();
    const sr = new Date(sunriseISO);
    const ss = new Date(sunsetISO);
    if (isNaN(sr.getTime()) || isNaN(ss.getTime())) return false;
    return now < sr || now > ss;
  }, [sunriseISO, sunsetISO]);

  // Widen background tint coverage at night (page-wide look)
  if (isNight) {
    styleVars['--wa-atmo-end'] = '100%';
    styleVars['--wa-attenuate-start'] = '80%';
  }

  // Respect visibility: always show a base sky texture, even in clear conditions
  const showCloudsEffective = Boolean(atmospheric.cloudClass);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`} style={styleVars}>
      {/* Page-wide diurnal filter wrapper for all animated background layers */}
      <div aria-hidden style={diurnalCss ? { animation: `${diurnalAnimationName} 86400s linear infinite`, animationDelay: `-${diurnalDelaySec}s`, width: '100%', height: '100%', position: 'absolute', inset: 0 } : { position: 'absolute', inset: 0 }}>
        {/* Atmospheric background tint for weather conditions */}
        {atmospheric.backgroundClass && (
          <div className={`wa-bg ${atmospheric.backgroundClass}`} aria-hidden />
        )}

        {/* Enhanced cloud layers based on weather condition (respect override visibility) */}
        {showCloudsEffective && atmospheric.cloudClass && (
          <div className={`wa-bg ${atmospheric.cloudClass} wa-lit`} aria-hidden />
        )}

        {bg.showWaves && (
          <div className="wa-bg wa-waves-svg wa-lit" aria-hidden>
            <WaveSVG
              amplitude={Math.max(12, Math.min(36, (weather?.waveHeightM ?? waveHeightM ?? 0.8) * 18))}
              wavelength={160}
              baseline={230}
              speedSec={Math.max(8, 30 - Math.round((weather?.windSpeedMS ?? windSpeedMS ?? 4) * 2))}
            />
          </div>
        )}

        {/* Optional CSS-only precip hint */}
        {wantsCssPrecip && precipType === 'rain' && (
          <div 
            className="wa-bg wa-rain wa-lit" 
            aria-hidden
            style={{
              '--rain-angle': `${windAngle}deg`,
              '--rain-density': rainDensity,
              '--rain-speed': `${rainSpeed}s`,
            } as React.CSSProperties}
          >
            {/* Generate dynamic number of raindrops based on intensity */}
            {Array.from({ length: rainDensity }, (_, i) => (
              <div
                key={i}
                className="wa-rain-drop"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * -rainSpeed}s`,
                  animationDuration: `${rainSpeed + (Math.random() * 0.3)}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Snow effect (unchanged) */}
        {wantsCssPrecip && precipType === 'snow' && (
          <div className="wa-bg wa-snow wa-lit" aria-hidden />
        )}

        {/* Optional lightning flash for storms */}
        {wantsLightning && (
          <div className="wa-lightning" aria-hidden />
        )}

        {/* Optional puddle effects for rain/storms */}
        {(precipType === 'rain') && (
          <div className="wa-puddles" aria-hidden />
        )}
      </div>

      {/* Contrast gradient behind text to safeguard readability in all themes */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-base-100/70 via-base-100/30 to-transparent" />

      {/* Foreground content */}
      <div className="relative z-[1]">
        {children}
      </div>
    </div>
  );
 }

/* =========================
   Usage examples
   =========================

import WeatherAnimationLayer from './WeatherAnimationLayer';
import { setBeaufortResolver } from '../lib/utils/weatherBackground';
import { getBeaufortNumber } from '../lib/utils/beaufort';

// Wire your own Beaufort converter once (e.g. _app.tsx)
setBeaufortResolver(getBeaufortNumber);

// In a header/hero:
<WeatherAnimationLayer
  condition={weather.condition as any}          // 'cloudy' | 'overcast' | 'drizzle' | 'rain' | 'storm' | 'snow' | 'fog' | 'clear' | 'marine_*'
  cloudPct={weather.cloudPct}
  waveHeightM={weather.waveHeightM}
  windSpeedMS={weather.windSpeedMS}
  isMarine={isMarineLocation}
  applyBeaufortToInland={activity.applyBeaufortToInland === true}
  showPrecipOverlay
  className="h-64"
>
  <div className="p-4">
    <h1 className="text-3xl font-semibold">Today in {locationName}</h1>
    <p className="opacity-70">{Math.round(weather.temperatureC)}°, {(weather.condition as string).replace('_',' ')}</p>
  </div>
</WeatherAnimationLayer>

Notes:
- CSS classes (wa-clouds.*, wa-waves.*, wa-rain, wa-snow, wa-bg, wa-lit) come from your windwave.css.
- DaisyUI theme controls colours; this layer stays subtle via opacity + blur.
- Reduced-motion users are respected by your CSS @media rule (animations disabled).
*/

/* =========================
   Remaining Tasks (short)
   =========================
1) Ensure windwave.css is loaded globally (has .wa-bg, .wa-lit, .wa-clouds.*, .wa-waves.*, keyframes).
2) Map your unified weather data → props above (condition, cloudPct, waveHeightM, windSpeedMS, isMarine).
3) Call setBeaufortResolver(getBeaufortNumber) once during app boot (e.g. _app.tsx).
4) Optionally tune per-instance with props: ambient/blurPx/opacity/showPrecipOverlay.
5) Later: if you want WebGL fog/clouds or particle rain, we can extend this same component.
*/
