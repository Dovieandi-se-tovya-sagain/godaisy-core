import React from 'react';
import Image from 'next/image';

interface SunriseSunsetCardProps {
  weather: {
    sunriseISO?: string;
    sunsetISO?: string;
  };
}

export const SunriseSunsetCard: React.FC<SunriseSunsetCardProps> = ({
  weather
}) => {
  const formatTime = (isoString: string | null | undefined): string => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '—';
    }
  };

  const getDayLength = (sunriseISO: string | null | undefined, sunsetISO: string | null | undefined): string => {
    if (!sunriseISO || !sunsetISO) return '—';
    try {
      const diffMs = new Date(sunsetISO).getTime() - new Date(sunriseISO).getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return '—';
    }
  };

  return (
    <div className="card weather-card-bg text-base-content">
      <div className="card-body">
        <h3 className="card__header-title flex items-center gap-2">
          <Image src="/weather-icons/design/fill/final/sunrise.svg" alt="Sun" width={24} height={24} className="w-12 h-12" />
          Sun Times
        </h3>
        
        {/* Big icons side by side */}
        <div className="flex items-center justify-center gap-6 my-2 flex-wrap">
          <div className="flex flex-col items-center w-20">
            <Image
              src="/weather-icons/design/fill/final/sunrise.svg"
              alt="Sunrise"
              width={64}
              height={64}
              className="w-12 h-12 mx-auto mb-1"
            />
            <div className="text-base font-semibold leading-tight">{formatTime(weather?.sunriseISO)}</div>
            <div className="text-xs opacity-70 leading-tight">Sunrise</div>
          </div>

          <div className="flex flex-col items-center w-20">
            <Image
              src="/weather-icons/design/fill/final/sunset.svg"
              alt="Sunset"
              width={64}
              height={64}
              className="w-12 h-12 mx-auto mb-1"
            />
            <div className="text-base font-semibold leading-tight">{formatTime(weather?.sunsetISO)}</div>
            <div className="text-xs opacity-70 leading-tight">Sunset</div>
          </div>

          <div className="flex flex-col items-center w-20">
            <Image
              src="/weather-icons/design/fill/final/horizon.svg"
              alt="Day length"
              width={64}
              height={64}
              className="w-12 h-12 mx-auto mb-1"
            />
            <div className="text-base font-medium leading-tight">{getDayLength(weather?.sunriseISO, weather?.sunsetISO)}</div>
            <div className="text-xs opacity-70 leading-tight">Day length</div>
          </div>
        </div>
      </div>
    </div>
  );
};
