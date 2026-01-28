import React from 'react';
import PollenWarning from './PollenWarning';
import AirQualityWarning from './AirQualityWarning';
import { PollenSummary } from '../utils/pollenUtils';
import { AirQualitySummary } from '../utils/airQualityUtils';
import Image from 'next/image';

interface EnvironmentalIndicatorsProps {
  pollen?: PollenSummary;
  airQuality?: AirQualitySummary;
  // New optional snow props
  snowDepthCm?: number;            // Show only when > 0
  snowfallRateMmH?: number;        // Show only when > 0
  mode?: 'compact' | 'full';
  className?: string;
}

/**
 * Combined environmental indicators component that displays pollen, air quality,
 * and compact snow indicators side by side with consistent spacing and design.
 */
export default function EnvironmentalIndicators({ 
  pollen, 
  airQuality, 
  snowDepthCm,
  snowfallRateMmH,
  mode = 'compact', 
  className = ''
}: EnvironmentalIndicatorsProps) {
  const hasPollenData = pollen && Object.values(pollen).some(value => value !== undefined && value > 0);
  const hasAirQualityData = airQuality && Object.values(airQuality).some(value => value !== undefined && value > 0);
  const hasSnowDepth = typeof snowDepthCm === 'number' && snowDepthCm > 0;
  const hasSnowfall = typeof snowfallRateMmH === 'number' && snowfallRateMmH > 0;
  
  // If no environmental data, don't render anything
  if (!hasPollenData && !hasAirQualityData && !hasSnowDepth && !hasSnowfall) {
    return null;
  }

  // For snow depth and snowfall, remove background/border and force white text
  const snowDepthPillClass = mode === 'compact'
    ? 'inline-flex items-center gap-1 rounded-full text-xs text-white'
    : 'inline-flex items-center gap-2 rounded-full text-sm text-white';

  return (
    <div 
      className={`environmental-indicators ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px', // Space between indicators
        flexWrap: 'wrap' // Allow wrapping on smaller screens
      }}
    >
      {hasPollenData && (
        <PollenWarning 
          pollen={pollen} 
          mode={mode}
        />
      )}
      {hasAirQualityData && (
        <AirQualityWarning 
          airQuality={airQuality} 
          mode={mode}
        />
      )}

      {hasSnowDepth && (
        // Render a pill with icon + numeric value in cm; transparent background, white text
        <span className={snowDepthPillClass} title={`Snow depth`}>
          <Image src="/weather-icons/design/fill/final/13n.svg" alt="Snow depth" width={16} height={16} />
          <span>{Math.round(snowDepthCm!)}cm</span>
        </span>
      )}
      {hasSnowfall && (
        // Render snowfall with same transparent style and white text (no lozenge)
        <span className={snowDepthPillClass} title={`Active snowfall`}>
          <Image src="/weather-icons/design/fill/final/overcast-snow.svg" alt="Snowfall" width={16} height={16} />
          <span>{Math.round(snowfallRateMmH! * 10) / 10}mm/h</span>
        </span>
      )}
    </div>
  );
}
