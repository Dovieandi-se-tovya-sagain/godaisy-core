import React, { useMemo } from 'react';
import Image from 'next/image';

/**
 * PrecipNext24hCard
 * Thin-column horizontal scroll (carousel style) of next 24h precipitation (hourly array).
 * Expects hours sorted ascending by time.
 */
export interface PrecipHour {
  timeISO: string;
  pop?: number;        // 0..1
  precipMm?: number;   // mm
  icon?: string;       // openweather icon code or full path
  weatherCode?: number;
  weatherDescription?: string;
}

interface Props {
  hours: PrecipHour[]; // at least 24 entries (will slice)
  title?: string;
}

// Supported base icon codes (same set as NextFewDaysCard)
const SUPPORTED_ICON_CODES = new Set([
  '01d','01n','02d','02n','03d','03n','04d','04n','09d','09n','10d','10n','11d','11n','13d','13n','50d','50n'
]);

const iconUrl = (icon?: string) => {
  if (!icon) return '/weather-icons/design/fill/final/na.svg';
  // If already an absolute path just return it
  if (icon.startsWith('/')) return icon;
  // Normalised OpenWeather-like code -> our design set
  return SUPPORTED_ICON_CODES.has(icon)
    ? `/weather-icons/design/fill/final/${icon}.svg`
    : '/weather-icons/design/fill/final/na.svg';
};

const formatTime = (iso: string, idx: number): string => {
  if (idx === 0) return 'Now';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false });
  } catch {
    return '';
  }
};

export const PrecipNext24hCard: React.FC<Props> = ({ hours, title: _title = 'Next 24 hours' }) => {
  const slice = useMemo(() => hours.slice(0, 24), [hours]);

  return (
    <div className="card weather-card-bg text-base-content">
      <div className="card-body p-4">
        <h3 className="card__header-title text-sm font-semibold mb-2">Hourly Rain Forecast</h3>
        <div className="overflow-x-auto no-scrollbar">
          {slice.length === 0 ? (
            <div className="text-xs opacity-70 py-4">No hourly precipitation data available.</div>
          ) : (
            <div className="flex gap-3 min-w-max">
              {slice.map((h, i) => {
                const popPct = h.pop != null ? Math.round(h.pop * 100) : 0;
                const showPop = popPct > 0;
                const precip = h.precipMm != null ? h.precipMm : 0;
                return (
                  <div key={h.timeISO + i} className="flex flex-col items-center text-xs w-12 shrink-0">
                    <span className="opacity-70 mb-1">{formatTime(h.timeISO, i)}</span>
                    <div className="w-8 h-8 relative mb-1">
                      <Image
                        src={iconUrl(h.icon)}
                        alt={h.weatherDescription || 'wx'}
                        fill
                        sizes="32px"
                        className="object-contain drop-shadow"
                      />
                    </div>
                    {showPop ? (
                      <span className="text-[10px] font-medium text-sky-300 mb-0.5">{popPct}%</span>
                    ) : (
                      <span className="text-[10px] opacity-30 mb-0.5">—</span>
                    )}
                    <span className="text-[10px] font-medium">
                      {precip > 0 ? `${precip % 1 === 0 ? precip.toFixed(0) : precip.toFixed(1)}mm` : '0mm'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrecipNext24hCard;
