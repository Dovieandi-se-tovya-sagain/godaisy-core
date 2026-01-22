import React from 'react';
import Image from 'next/image';
import { WeatherBundle } from '../../types/weather';

interface PressureCardProps {
  weather: Pick<WeatherBundle,'pressureHpa'|'pressureTrend'> | null | undefined;
  pressureTrend: string | null;
  pressure: number | null;
}

export const PressureCard: React.FC<PressureCardProps> = ({
  // weather (reserved for future detailed usage)
  pressureTrend,
  pressure
}) => {
  const getTrendIcon = (trend: string | null): string => {
    if (!trend) return '—';
    if (trend === 'rising') return '↗';
    if (trend === 'falling') return '↘';
    return '→';
  };

  const getTrendColor = (trend: string | null): string => {
    if (!trend) return 'text-base-content';
    if (trend === 'rising') return 'text-success';
    if (trend === 'falling') return 'text-error';
    return 'text-warning';
  };

  return (
    <div className="card weather-card-bg text-base-content">
      <div className="card-body">
        <h3 className="card-title flex items-center gap-2">
          <Image src="/weather-icons/design/fill/final/barometer.svg" alt="Pressure" width={20} height={20} className="w-5 h-5" />
          Pressure
        </h3>
        <div className="flex items-center gap-6">
          <div>
            <div className="text-2xl font-bold">
              {pressure != null ? `${Math.round(pressure)} hPa` : '—'}
            </div>
            <div className={`text-sm ${getTrendColor(pressureTrend)}`}>
              {getTrendIcon(pressureTrend)} {pressureTrend || 'Steady'}
            </div>
          </div>
          <div className="text-4xl opacity-50">
            {getTrendIcon(pressureTrend)}
          </div>
        </div>
        <div className="text-xs opacity-70 mt-2">
          {pressure != null && (
            <>
              {pressure > 1020 ? 'High pressure' : 
               pressure > 1000 ? 'Normal pressure' : 'Low pressure'}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
