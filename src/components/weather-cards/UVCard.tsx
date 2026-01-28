import React from 'react';
import Image from 'next/image';

export interface UVCardProps {  // exported for external typing
  weather: {
    uvi?: number;
    sunriseISO?: string;
    sunsetISO?: string;
  };
  today: {
    uvi?: number;
  };
  uvRingClass?: string; // Made optional since we're not using it anymore
}

export const UVCard: React.FC<UVCardProps> = ({ weather, today }) => {
  const uvNow = weather?.uvi != null ? Math.round(weather.uvi) : null;
  const uvPeak = today?.uvi != null ? Math.round(today.uvi) : null;
  
  // Check if it's nighttime by comparing the current time with sunrise and sunset
  const isNightTime = React.useMemo(() => {
    const now = new Date();
    const sunrise = weather?.sunriseISO ? new Date(weather.sunriseISO) : null;
    const sunset = weather?.sunsetISO ? new Date(weather.sunsetISO) : null;
    
    if (!sunrise || !sunset) return false;
    
    // It's night if current time is before sunrise or after sunset
    return now < sunrise || now > sunset;
  }, [weather?.sunriseISO, weather?.sunsetISO]);

  // Determine UV risk level and description based on UV index
  const getUVRiskLevel = (uvi: number | null): string => {
    if (uvi == null) return 'Unknown';
    if (uvi <= 2) return 'Low';
    if (uvi <= 5) return 'Moderate';
    if (uvi <= 7) return 'High';
    if (uvi <= 10) return 'Very High';
    return 'Extreme';
  };

  const getUVDescription = (uvi: number | null, isNight: boolean): string => {
    if (isNight) return '🧛‍♀️ Party all night'; // Night-time vampire message
    if (uvi == null) return 'Unable to determine UV index';
    if (uvi <= 2) return 'Minimal risk from sun exposure';
    if (uvi <= 5) return '🧴 Moderate risk - use sun protection';
    if (uvi <= 7) return '🥵 High risk - take extra precautions';
    if (uvi <= 10) return '⚠️ Very high risk - minimize sun exposure';
    return '☢️ Extreme risk - avoid sun exposure when possible';
  };

  // Get color based on UV index or nighttime
  const getUVColor = (uvi: number | null, isNight: boolean): string => {
    if (isNight) return '#000000'; // Black for night-time
    if (uvi == null) return 'gray';
    if (uvi <= 2) return '#4ade80'; // Green
    if (uvi <= 5) return '#facc15'; // Yellow
    if (uvi <= 7) return '#fb923c'; // Orange
    if (uvi <= 10) return '#ef4444'; // Red
    return '#a855f7'; // Purple
  };

  // Calculate position on the scale with proper label alignment
  const uvScalePosition = (uvi: number | null): number => {
    if (uvi == null) return 0;
    // Map to the actual label positions: 0, 3, 6, 8, 11+
    // 0 = 0%, 3 = 25%, 6 = 50%, 8 = 75%, 11+ = 100%
    if (uvi <= 3) return (uvi / 3) * 25; // 0-3 maps to 0-25%
    if (uvi <= 6) return 25 + ((uvi - 3) / 3) * 25; // 3-6 maps to 25-50%
    if (uvi <= 8) return 50 + ((uvi - 6) / 2) * 25; // 6-8 maps to 50-75%
    return 75 + Math.min(25, ((uvi - 8) / 3) * 25); // 8-11+ maps to 75-100%
  };

  const uvColor = getUVColor(uvNow, isNightTime);
  const uvRiskLevel = isNightTime ? "Nighttime" : getUVRiskLevel(uvNow);
  const uvDescription = getUVDescription(uvNow, isNightTime);

  return (
    <div className="card weather-card-bg text-base-content">
      <div className="card-body p-4">
        <div className="flex justify-between items-center">
          <h3 className="card__header-title flex items-center gap-2">
            <Image 
              src="/weather-icons/design/fill/final/uv-index.svg" 
              alt="UV" 
              width={20} 
              height={20} 
              className="w-12 h-12" 
            />
            UV Index
          </h3>
          {uvNow != null && (
            <div className="flex items-center">
              {isNightTime ? (
                <div 
                  className="flex items-center justify-center w-16 h-16 rounded-full"
                  style={{ backgroundColor: '#000000' }}
                >
                  <span className="text-white text-2xl">🧛‍♀️</span>
                </div>
              ) : (
                <Image 
                  src={`/weather-icons/design/fill/final/uv-index-${Math.min(11, Math.max(1, uvNow))}${uvNow >= 11 ? '-plus' : ''}.svg`} 
                  alt={`UV Index ${uvNow}`} 
                  width={64} 
                  height={64} 
                  className="w-16 h-16" 
                />
              )}
            </div>
          )}
        </div>
        
        <div className="my-3">
          <p className="text-sm opacity-80">
            {!isNightTime && uvDescription}
          </p>
        </div>
        
        {/* UV Scale bar with markers */}
        <div className="mt-3 mb-1">
          <div className="relative">
            {/* Background gradient scale */}
            <div className="w-full h-2 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full w-full"
                style={{ 
                  background: `linear-gradient(to right, 
                    #4ade80 0%, 
                    #facc15 18.2%, 
                    #fb923c 45.5%, 
                    #ef4444 63.6%, 
                    #a855f7 91%, 
                    #a855f7 100%
                  )`
                }}
              />
            </div>
            
            {/* Current UV marker */}
            {uvNow != null && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '-8px',
                  left: `calc(${uvScalePosition(uvNow)}% - 8px)`,
                }}
              >
                <div 
                  className="w-4 h-4 bg-white rounded-full border-2 shadow-md"
                  style={{ borderColor: uvColor }}
                />
              </div>
            )}
            
            {/* Peak UV marker (smaller, slightly transparent) */}
            {uvPeak != null && uvPeak !== uvNow && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '-6px',
                  left: `calc(${uvScalePosition(uvPeak)}% - 6px)`,
                }}
              >
                <div 
                  className="w-3 h-3 bg-white rounded-full border opacity-70 shadow-sm"
                  style={{ borderColor: getUVColor(uvPeak, isNightTime) }}
                />
              </div>
            )}
          </div>
          
          {/* Scale labels */}
          <div className="flex justify-between text-xs opacity-80 mt-1">
            <span>0</span>
            <span>3</span>
            <span>6</span>
            <span>8</span>
            <span>11+</span>
          </div>
        </div>

        <div className="flex justify-between text-sm opacity-80 mt-2">
          {isNightTime ? (
            <div>Current: <span className="font-semibold">0 (Nighttime)</span></div>
          ) : (
            <div>Current: <span className="font-semibold">{uvNow != null ? uvNow : '—'}</span> ({uvRiskLevel})</div>
          )}
          <div>Peak today: <span className="font-semibold">{uvPeak != null ? uvPeak : '—'}</span></div>
        </div>
      </div>
    </div>
  );
};
