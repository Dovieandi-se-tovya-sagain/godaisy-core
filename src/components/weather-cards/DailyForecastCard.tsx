// components/weather-cards/DailyForecastCard.tsx
// Daily forecast table component extracted from my-new-weather.tsx

import React from 'react';
import Image from 'next/image.js';

interface DailyForecastData {
  dateISO: string;
  icon?: string;
  minC?: number;
  maxC?: number;
  pop?: number; // probability of precipitation (0-1)
}

interface DailyForecastCardProps {
  daily?: DailyForecastData[];
  maxDays?: number;
  className?: string;
}

function getWeatherIconUrl(iconCode?: string) {
  const code = iconCode || 'na';
  const supported = new Set(['01d','01n','02d','02n','03d','03n','04d','04n','09d','09n','10d','10n','11d','11n','13d','13n','50d','50n']);
  return supported.has(code) ? `/weather-icons/design/fill/final/${code}.svg` : '/weather-icons/design/fill/final/na.svg';
}

export const DailyForecastCard: React.FC<DailyForecastCardProps> = ({ 
  daily = [], 
  maxDays = 8,
  className = ""
}) => {
  const forecastDays = daily.slice(0, maxDays);

  return (
    <div className={`card weather-card-bg text-base-content h-full ${className}`}>
      <div className="card-body">
        <h3 className="card__header-title">Next Few Days</h3>
        <div className="overflow-x-auto rounded-box bg-transparent">
          <table className="table table-compact bg-transparent">
            <tbody>
              {forecastDays.map((d, idx) => {
                const date = new Date(d.dateISO);
                const label = idx === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
                const iconUrl = getWeatherIconUrl(d.icon);
                
                return (
                  <tr key={d.dateISO} className="odd:bg-white/0 even:bg-white/5/30 hover:bg-white/10 transition-colors">
                    <td className="w-20 px-2 py-2 text-sm whitespace-nowrap">{label}</td>
                    <td className="w-8 px-2 py-2 text-center">
                      <div className="relative w-6 h-6 mx-auto">
                        <Image 
                          src={iconUrl} 
                          alt="Weather icon" 
                          fill 
                          sizes="24px"
                          style={{ objectFit: 'contain' }}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-info">Low {d.minC != null ? Math.round(d.minC) : '—'}°</span>
                        <span className="text-warning">High {d.maxC != null ? Math.round(d.maxC) : '—'}°</span>
                        <span className="badge badge-outline badge-xs">
                          {d.pop != null ? Math.round((d.pop || 0) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {forecastDays.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-sm opacity-70 py-4">
                    No forecast data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyForecastCard;
