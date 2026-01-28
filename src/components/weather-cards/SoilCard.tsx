import React, { useState } from 'react';
import { getSoilCondition } from '../../utils/getSoilCondition';

interface SoilCardProps {
  weather: {
    soil?: {
      temp0cm?: number;
      temp6cm?: number;
      temp18cm?: number;
      temp54cm?: number;
      moisture0to1?: number;
      moisture1to3?: number;
      moisture3to9?: number;
      moisture9to27?: number;
    };
    tempC?: number;
    humidity?: number;
    main?: {
      temp?: number;
      humidity?: number;
    };
  };
}

// SoilConditionsPanel component from main file
const SoilConditionsPanel: React.FC<{
  soil: {
    temp0cm?: number;
    temp6cm?: number;
    temp18cm?: number;
    temp54cm?: number;
    moisture0to1?: number;
    moisture1to3?: number;
    moisture3to9?: number;
    moisture9to27?: number;
  };
}> = ({ soil }) => {
  const depths = [0, 6, 18, 54] as const;
  const [depthIdx, setDepthIdx] = useState<0|1|2|3>(0);
  const depth = depths[depthIdx];
  const tempMap: Record<0|6|18|54, number | undefined> = {
    0: soil.temp0cm,
    6: soil.temp6cm,
    18: soil.temp18cm,
    54: soil.temp54cm,
  };
  // Open‑Meteo moisture layers are ranges (0–1, 1–3, 3–9, 9–27 cm), while
  // temperatures are at fixed depths (0, 6, 18, 54 cm). Map each temp depth
  // to the nearest moisture layer and surface the layer label when approximated.
  const moistureForDepth = (d: typeof depth): { value?: number; label?: string; approx: boolean } => {
    if (d === 0) return { value: soil.moisture0to1, label: '0–1 cm', approx: false };
    if (d === 6) return { value: soil.moisture3to9, label: '3–9 cm', approx: true };
    if (d === 18) return { value: soil.moisture9to27, label: '9–27 cm', approx: true };
    // No OM moisture layer around 54 cm; show deepest available as N/A.
    return { value: undefined, label: undefined, approx: false };
  };
  const t = tempMap[depth];
  const mInfo = moistureForDepth(depth);
  const m = mInfo.value;
  
  // Simplified advice for display in the new card format - only show 1-2 lines maximum
  const getSimplifiedAdvice = () => {
    if (t == null || m == null) return [] as string[];
    const tips: string[] = [];
    
    // Temperature-based advice
    if (t <= 0) {
      tips.push('🌡️ Plant activity nearly stops; frozen soil halts growth.');
    } else if (t <= 5) {
      tips.push('🌡️ Slow at these temperatures - root development in hardy plants only.');
    } else if (t <= 20) {
      tips.push('🌡️ Ideal for many spring crops: good root growth.');
    } else if (t <= 27) {
      tips.push('🌡️ Watch soil moisture as warming increases evaporation.');
      tips.push('🌡️ All depths: Good temperatures for many summer crops; rapid growth and nutrient absorption.');
    } else {
      tips.push('🌡️ Hot soil: growth may be reduced; use mulch and shade and water a lot.');
    }
    
    // Moisture-based advice
    if (m < 0.15) {
      tips.push('💧 Dry: soil retains some moisture; shallow-rooted plants may struggle.');
    } else if (m < 0.35) {
      tips.push('💧 Moderately moist: optimal for many temperate plants.');
    } else {
      tips.push('💧 Wet: adequate moisture; watch drainage to avoid root rot.');
    }
    
    return tips;
  };
  
  const simplifiedAdvice = getSimplifiedAdvice();
  
  return (
    <div>
      {/* Selected depth badge - moved above slider and left-aligned */}
      <div className="mb-3 flex justify-start">
        <div className="border border-white/20 px-4 py-2 rounded-full text-white bg-slate-800/20 inline-flex items-center justify-center">
          {depth === 0 ? 'Surface' : `${depth} cm`}
        </div>
      </div>
      
      {/* Depth slider with brown gradient and shovel emoji thumb */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={3}
          value={depthIdx}
          onChange={(e) => setDepthIdx(Number(e.target.value) as 0|1|2|3)}
          className="soil-brown-slider range range-xs w-full"
        />
        <div 
          className="shovel-emoji absolute pointer-events-none"
          style={{
            fontSize: '1.4rem',
            top: '-1.0rem',
            left: `calc(${depthIdx / 3 * 100}% - ${depthIdx === 0 ? '0rem' : depthIdx === 3 ? '1.4rem' : '0.7rem'})`,
            transform: 'rotate(315deg)',
          }}
        >
          🪏
        </div>
      </div>
      <div className="flex justify-between text-xs text-white/80 mt-1">
        <span>0 cm</span><span>6 cm</span><span>18 cm</span><span>54 cm</span>
      </div>
      
      {/* Main content area with temperature and moisture in same row */}
      <div className="mt-4">
        {/* Labels row */}
        <div className="flex justify-between">
          <span className="text-xs text-white/70">Temperature</span>
          <span className="text-xs text-white/70">Moisture</span>
        </div>
        
        {/* Values row */}
        <div className="flex justify-between">
          <span className="text-white text-xl font-medium flex items-center">
            <span className="mr-1">🌡️</span>
            {t != null ? `${Math.round(t)}°` : '—'}
          </span>
          <span className="text-white text-xl font-medium flex items-center">
            <span className="mr-1">💧</span>
            {m != null ? `${Math.round(m * 100)}%` : '—'}
          </span>
        </div>
      </div>
      
      {/* Simplified advice list */}
      {simplifiedAdvice.map((tip, idx) => (
        <div key={idx} className="text-white mt-2 text-sm flex gap-1.5 items-start">
          <span>{tip}</span>
        </div>
      ))}
      
      <style jsx>{`
        .soil-brown-slider::-webkit-slider-runnable-track {
          height: 0.5rem;
          border-radius: 9999px;
          background: linear-gradient(to right,
            #ead7bb 0%,
            #c8a27a 25%,
            #8b5e34 50%,
            #4a2f1b 75%,
            #18120f 100%
          );
        }
        .soil-brown-slider::-moz-range-track {
          height: 0.5rem;
          border-radius: 9999px;
          background: linear-gradient(to right,
            #ead7bb 0%,
            #c8a27a 25%,
            #8b5e34 50%,
            #4a2f1b 75%,
            #18120f 100%
          );
        }
        .soil-brown-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 0.5rem;
          height: 1rem;
          background: transparent;
          cursor: pointer;
          border: none;
          opacity: 0;
        }
        .soil-brown-slider::-moz-range-thumb {
          width: 0.5rem;
          height: 1rem;
          background: transparent;
          cursor: pointer;
          border: none;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};

export const SoilCard: React.FC<SoilCardProps> = ({
  weather
}) => {
  // Extract soil data from weather object
  const soil = {
    temp0cm: weather?.soil?.temp0cm,
    temp6cm: weather?.soil?.temp6cm,
    temp18cm: weather?.soil?.temp18cm,
    temp54cm: weather?.soil?.temp54cm,
    moisture0to1: weather?.soil?.moisture0to1,
    moisture1to3: weather?.soil?.moisture1to3,
    moisture3to9: weather?.soil?.moisture3to9,
    moisture9to27: weather?.soil?.moisture9to27,
  };

  // Check if we have any soil data
  const hasSoilData = Object.values(soil).some(v => v != null);
  
  // Get soil condition description if moisture data is available
  const soilCondition = soil.moisture0to1 != null ? getSoilCondition(soil.moisture0to1) : "Ground's nice and soft";

  // Fallback to basic conditions if no soil data available
  if (!hasSoilData) {
    const temp = weather?.tempC || weather?.main?.temp;
    const humidity = weather?.humidity || weather?.main?.humidity;

    return (
      <div className="card weather-card-bg text-base-content shadow-md rounded-xl overflow-hidden">
        <div className="card-body p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="card__header-title">Soil Conditions</h2>
          </div>
          <div className="text-sm text-white/90 mb-3">{soilCondition}</div>
          
          {/* Selected depth badge - above slider and left-aligned */}
          <div className="mb-3 flex justify-start">
            <div className="border border-white/20 px-4 py-2 rounded-full text-white bg-slate-800/20 inline-flex items-center justify-center">
              Surface
            </div>
          </div>
          
          <div className="relative">
            <input
              type="range"
              disabled
              className="soil-brown-slider range range-xs w-full"
              value={50}
            />
            <div 
              className="shovel-emoji absolute pointer-events-none"
              style={{
                fontSize: '1.4rem',
                top: '-1.0rem',
                left: 'calc(50% - 0.7rem)',
                transform: 'rotate(315deg)',
              }}
            >
              🪏
            </div>
          </div>
          <div className="flex justify-between text-xs text-white/80 mt-1">
            <span>0 cm</span><span>6 cm</span><span>18 cm</span><span>54 cm</span>
          </div>
          
          {/* Main content area with temperature and moisture in same row */}
          <div className="mt-4">
            {/* Labels row */}
            <div className="flex justify-between">
              <span className="text-xs text-white/70">Temperature</span>
              <span className="text-xs text-white/70">Moisture</span>
            </div>
            
            {/* Values row */}
            <div className="flex justify-between">
              <span className="text-white text-xl font-medium flex items-center">
                <span className="mr-1">🌡️</span>
                {temp != null ? `${Math.round(temp)}°` : '—'}
              </span>
              <span className="text-white text-xl font-medium flex items-center">
                <span className="mr-1">💧</span>
                {humidity != null ? `${humidity}%` : '—'}
              </span>
            </div>
          </div>
          
          <div className="text-white mt-4 text-sm flex gap-1.5 items-start">
            <span>🌡️ Watch soil moisture as warming increases evaporation.</span>
          </div>
          
          <div className="text-white mt-2 text-sm flex gap-1.5 items-start">
            <span>🌡️ All depths: Good for many summer crops; rapid growth and nutrient absorption.</span>
          </div>
          
          <div className="text-white mt-2 text-sm flex gap-1.5 items-start">
            <span>💧 Dry: soil retains some moisture; shallow-rooted plants may struggle.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card weather-card-bg text-base-content rounded-xl overflow-hidden shadow-md">
      <div className="card-body p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-medium text-white">Soil Conditions</h3>
        </div>
        <div className="text-sm text-white/90 mb-3">{soilCondition}</div>
        
        <SoilConditionsPanel soil={soil} />
      </div>
    </div>
  );
};
