import React from 'react';
import Image from 'next/image';

interface VisibilityCardProps {
  visibilityKm: number | null;
}

export const VisibilityCard: React.FC<VisibilityCardProps> = ({
  visibilityKm
}) => {
  const getVisibilityDescription = (visKm: number | null): string => {
    if (visKm == null) return 'Unable to determine visibility';
    if (visKm >= 10) return 'Crystal clear — you can see for miles';
    if (visKm >= 7) return 'Very clear — distant objects are visible';
    if (visKm >= 5) return 'Good visibility — clear horizon';
    if (visKm >= 3) return 'Moderate visibility — some haze';
    if (visKm >= 2) return 'Hazy view — the world feels a bit blurry';
    if (visKm >= 1) return 'Poor visibility — distant objects are obscured';
    return 'Very poor visibility — foggy conditions';
  };

  // Calculate the position on a logarithmic scale (for the bar)
  const logScalePosition = (visKm: number | null): number => {
    if (visKm == null) return 0;
    // Log scale transformation: ln(x+1)/ln(11) gives us 0-1 range for 0-10km
    const position = Math.log(visKm + 1) / Math.log(11);
    return Math.min(1, Math.max(0, position)) * 100;
  };

  return (
    <div className="card weather-card-bg text-white rounded-xl overflow-hidden border border-white/10 shadow-lg">
      <div className="card-body p-4">
        <div className="flex justify-between items-center">
          <h3 className="card__header-title text-lg font-medium flex items-center gap-2">
            <Image 
              src="/weather-icons/design/fill/final/visibility.svg" 
              alt="Visibility" 
              width={20} 
              height={20} 
              className="w-5 h-5" 
            />
            Visibility
          </h3>
          {visibilityKm != null && (
            <div className="badge badge-lg badge-primary text-white font-medium">
              {visibilityKm} km
            </div>
          )}
        </div>
        
        <div className="my-3">
          <p className="text-sm text-white/90">
            {getVisibilityDescription(visibilityKm)}
          </p>
        </div>
        
        {/* Log scale visibility bar */}
        <div className="mt-3 mb-1">
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-white/60 to-white/80 h-full rounded-full"
              style={{ width: `${logScalePosition(visibilityKm)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/70 mt-1">
            <span>0</span>
            <span>0-10 km (log scale)</span>
            <span>10</span>
          </div>
        </div>
      </div>
    </div>
  );
};
