// components/SceneLayers.tsx
import React from 'react';
import WeatherAnimationLayer, { UnifiedWeatherData } from './WeatherAnimationLayer';
import Image from 'next/image.js';

type SceneLayersProps = {
  /** Background image URL (your existing hero artwork) */
  imageUrl: string;
  /** Weather payload you already build */
  weather: UnifiedWeatherData;
  /** Auto bands or provide custom masks */
  mode?: 'bands' | 'masks';
  /** Optional custom masks (white = show, black = hide) */
  skyMaskUrl?: string;     // restrict clouds
  waterMaskUrl?: string;   // restrict waves
  /** Tuning */
  className?: string;
  cloudBandHeightPct?: number;  // default 55
  waveBandHeightPct?: number;   // default 42
  opacityOverrides?: Partial<{ clouds:number; waves:number; rain:number }>;
};

export default function SceneLayers({
  imageUrl,
  weather,
  mode = 'bands',
  skyMaskUrl,
  waterMaskUrl,
  className = '',
  cloudBandHeightPct = 55,
  waveBandHeightPct = 42,
  opacityOverrides = {}
}: SceneLayersProps) {
  const cloudMask = mode === 'masks' && skyMaskUrl
    ? { WebkitMaskImage: `url(${skyMaskUrl})`, maskImage: `url(${skyMaskUrl})`, WebkitMaskSize:'cover', maskSize:'cover' }
    : { WebkitMaskImage: `linear-gradient(to bottom, #000 0%, #000 ${cloudBandHeightPct}%, transparent ${cloudBandHeightPct+8}%)`,
        maskImage:        `linear-gradient(to bottom, #000 0%, #000 ${cloudBandHeightPct}%, transparent ${cloudBandHeightPct+8}%)` };

  const waveMask = mode === 'masks' && waterMaskUrl
    ? { WebkitMaskImage: `url(${waterMaskUrl})`, maskImage: `url(${waterMaskUrl})`, WebkitMaskSize:'cover', maskSize:'cover' }
    : { WebkitMaskImage: `linear-gradient(to top, #000 0%, #000 ${waveBandHeightPct}%, transparent ${waveBandHeightPct+10}%)`,
        maskImage:        `linear-gradient(to top, #000 0%, #000 ${waveBandHeightPct}%, transparent ${waveBandHeightPct+10}%)` };

  // Simple routing (same table as above)
  const ctx = {
    waves: (weather.isCoastal || weather.applyBeaufort) && weather.condition.startsWith('marine_'),
    rain:  ['rain','drizzle','storm','snow'].includes(weather.condition),
    clouds:['cloudy','overcast','fog','storm','snow','drizzle','rain'].includes(weather.condition) || (weather.cloudPct ?? 0) > 30
  };

  const cloudsOpacity = opacityOverrides.clouds ?? 0.45;
  const wavesOpacity  = opacityOverrides.waves  ?? (ctx.waves ? 0.65 : 0);
  const rainOpacity   = opacityOverrides.rain   ?? 1;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{contain:'paint'}}>
      {/* Base artwork */}
      <Image src={imageUrl} alt="" fill className="block object-cover select-none" sizes="100vw" priority />

      {/* TOP band – clouds */}
      {ctx.clouds && (
        <div className="absolute inset-0 pointer-events-none" style={{...cloudMask, opacity: cloudsOpacity, zIndex: 1}}>
          <WeatherAnimationLayer weather={{...weather, condition: 'cloudy'}} mode="advanced" />
        </div>
      )}

      {/* MID band – rain/snow (always under text) */}
      {ctx.rain && (
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: rainOpacity, zIndex: 2 }}>
          <WeatherAnimationLayer weather={weather} mode="advanced" />
        </div>
      )}

      {/* BOTTOM band – waves */}
      {ctx.waves && (
        <div className="absolute inset-0 pointer-events-none" style={{...waveMask, opacity: wavesOpacity, zIndex: 1}}>
          {/* Force marine_* to use your wave textures + Beaufort mapping */}
          <WeatherAnimationLayer weather={weather} mode="simple" />
        </div>
      )}

      {/* Your foreground content goes above this wrapper in the page */}
    </div>
  );
}
