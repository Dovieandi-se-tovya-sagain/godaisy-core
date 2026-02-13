import React from 'react';
import Image from 'next/image.js';

// Helper to get pollen icon based on index value
const getPollenIcon = (index: number): string => {
  if (index <= 1) return '/weather-icons/design/fill/final/pollen-index-1.svg'; // Low
  if (index <= 2) return '/weather-icons/design/fill/final/pollen-index-2.svg'; // Moderate 
  if (index <= 3) return '/weather-icons/design/fill/final/pollen-index-3.svg'; // High
  return '/weather-icons/design/fill/final/pollen-index-4.svg'; // Very High
};

interface PollenCardProps {
  pollenAssess: {
    description?: string;
    advice?: string;
  };
  pollenIdx: number;
  pollenBadgeClass?: string; // Made optional since we're not using it
  pollenToday: {
    grass_pollen?: string;
    tree_pollen?: string;
    alder_pollen?: string;
    birch_pollen?: string;
    weed_pollen?: string;
    ragweed_pollen?: string;
    mugwort_pollen?: string;
    olive_pollen?: string;
  };
}

export const PollenCard: React.FC<PollenCardProps> = ({
  pollenAssess,
  pollenIdx,
  pollenToday = {} // Provide default empty object
}) => {
  // Determine pollen risk level based on index
  const getPollenRiskLevel = (index: number): string => {
    if (index <= 1) return 'Low';
    if (index <= 3) return 'Moderate';
    if (index <= 4) return 'High';
    return 'Very High';
  };

  // Helper to get pollen level color from string or numeric value
  const getPollenLevelColor = (level: string | number): string => {
    if (!level && level !== 0) return '#9ca3af'; // Default gray
    
    // Handle numeric values (Open-Meteo API format)
    if (typeof level === 'number') {
      if (level <= 0.5) return '#4ade80'; // Green - Very Low
      if (level <= 1.0) return '#4ade80'; // Green - Low
      if (level <= 2.0) return '#facc15'; // Yellow - Moderate
      if (level <= 4.0) return '#fb923c'; // Orange - High
      return '#ef4444'; // Red - Very High
    }
    
    // Handle string descriptions (legacy format)
    const levelStr = String(level).toLowerCase();
    if (levelStr.includes('low')) return '#4ade80'; // Green
    if (levelStr.includes('moderate')) return '#facc15'; // Yellow
    if (levelStr.includes('high') && !levelStr.includes('very')) return '#fb923c'; // Orange
    if (levelStr.includes('very high')) return '#ef4444'; // Red
    return '#9ca3af'; // Default gray
  };

  // Helper to get position on scale from string level or numeric value
  const getPollenLevelPosition = (level: string | number): number => {
    if (!level && level !== 0) return 0;
    
    // Handle numeric values (Open-Meteo API format)
    if (typeof level === 'number') {
      if (level <= 0.5) return 15;   // Very Low
      if (level <= 1.0) return 30;   // Low  
      if (level <= 2.0) return 50;   // Moderate
      if (level <= 4.0) return 75;   // High
      return 90;                     // Very High
    }
    
    // Handle string descriptions (legacy format)
    const levelStr = String(level).toLowerCase();
    if (levelStr.includes('none')) return 0;
    if (levelStr.includes('low')) return 15;
    if (levelStr.includes('moderate')) return 40;
    if (levelStr.includes('high') && !levelStr.includes('very')) return 70;
    if (levelStr.includes('very high')) return 90;
    if (levelStr.includes('extreme')) return 95;
    return 0;
  };

  const pollenRiskLevel = getPollenRiskLevel(pollenIdx);

// Helper to get gradient background - version used by the PollenBar component
  const getPollenGradient = () => {
    return `linear-gradient(to right, 
      #4ade80 0%, 
      #4ade80 10%, 
      #8cdf7e 10%, 
      #c9e97c 20%, 
      #facc15 30%, 
      #fabb15 40%, 
      #f9aa15 50%, 
      #fb923c 60%, 
      #f67a34 70%, 
      #f4622c 80%, 
      #ef4444 90%, 
      #ef4444 100%
    )`;
  };

// Helper to get pollen descriptions in Go Daisy tone
const getPollenDescription = (level: string): string => {
  switch(level) {
    case 'Low':
      return '🌿 Hardly any pollen about – most people won’t notice.';
    case 'Moderate':
      return '🌼 A fair bit of pollen – sensitive folks may start sneezing.';
    case 'High':
      return '🌾 Lots of pollen in the air – allergy sufferers take care.';
    case 'Very High':
      return '🌻 Pollen peak – expect strong symptoms, best to limit time outdoors.';
    default:
      return '';
  }
};

// Helper component for rendering pollen bars with numeric index
const PollenBarNumeric: React.FC<{
  index: number;
  size?: 'sm' | 'md';
}> = ({ index, size = 'sm' }) => {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  const markerSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const markerTop = size === 'sm' ? '-4px' : '-8px';
  const markerBorder = size === 'sm' ? 'border' : 'border-2';
  
  // Calculate position on the scale (0-5) with proper label alignment
  const pollenScalePosition = (idx: number): number => {
    // Map to the actual label positions: 0, 1, 3, 4, 5
    // 0 = 0%, 1 = 25%, 3 = 50%, 4 = 75%, 5 = 100%
    if (idx <= 1) return (idx / 1) * 25; // 0-1 maps to 0-25%
    if (idx <= 3) return 25 + ((idx - 1) / 2) * 25; // 1-3 maps to 25-50%
    if (idx <= 4) return 50 + ((idx - 3) / 1) * 25; // 3-4 maps to 50-75%
    return 75 + Math.min(25, ((idx - 4) / 1) * 25); // 4-5 maps to 75-100%
  };

  return (
    <div className="relative">
      <div className={`w-full ${height} rounded-full overflow-hidden`}>
        <div 
          className="h-full w-full"
          style={{ background: getPollenGradient() }}
        />
      </div>
      <div 
        className="absolute pointer-events-none"
        style={{
          top: markerTop,
          left: `calc(${pollenScalePosition(index)}% - 4px)`,
        }}
      >
        <div 
          className={`${markerSize} bg-white rounded-full ${markerBorder} shadow-sm`}
          style={{ borderColor: getPollenLevelColor(getPollenRiskLevel(index)) }}
        />
      </div>
    </div>
  );
};

// Helper component for rendering pollen bars with string or numeric levels
const PollenBar: React.FC<{
  level?: string | number;
  size?: 'sm' | 'md';
}> = ({ level, size = 'sm' }) => {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  const markerSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const markerTop = size === 'sm' ? '-4px' : '-8px';
  const markerBorder = size === 'sm' ? 'border' : 'border-2';

  return (
    <div className="relative">
      <div className={`w-full ${height} rounded-full overflow-hidden`}>
        <div 
          className="h-full w-full"
          style={{ background: getPollenGradient() }}
        />
      </div>
      <div 
        className="absolute pointer-events-none"
        style={{
          top: markerTop,
          left: `calc(${level ? getPollenLevelPosition(level) : 0}% - 4px)`,
        }}
      >
        <div 
          className={`${markerSize} bg-white rounded-full ${markerBorder} shadow-sm`}
          style={{ borderColor: level ? getPollenLevelColor(level) : '#9ca3af' }}
        />
      </div>
    </div>
  );
};

  return (
    <div className="card weather-card-bg text-base-content">
      <div className="card-body p-4">
        <div className="flex justify-between items-center">
          <h3 className="card__header-title flex items-center gap-2">
            <Image 
              src="/weather-icons/design/fill/final/pollen.svg" 
              alt="Pollen" 
              width={20}
              height={20}
              className="w-12 h-12" 
            />
            Pollen
          </h3>
          <Image 
            src={getPollenIcon(pollenIdx)} 
            alt={`Pollen ${pollenIdx} - ${pollenRiskLevel}`} 
            width={80}
            height={80}
            className="w-20 h-20" 
          />
        </div>
        
        <div className="my-2">
          <p className="text-sm opacity-80">
            {pollenRiskLevel}: {getPollenDescription(pollenRiskLevel)}
          </p>
        </div>
        
        {/* Pollen Scale bar with marker */}
        <div className="mt-3 mb-1">
          <PollenBarNumeric index={pollenIdx} size="md" />
          
          {/* Scale labels */}
          <div className="flex justify-between text-xs opacity-80 mt-1">
            <span>0</span>
            <span>1</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
          </div>
        </div>

        <div className="text-xs opacity-70 mt-3 mb-2">
          {pollenAssess?.advice && (
            <div className="mb-2">{pollenAssess.advice}</div>
          )}
        </div>
        
        {/* Collapsible detailed pollen types section */}
        <details className="collapse collapse-arrow bg-slate-800/25 rounded-lg">
          <summary className="collapse-title text-sm py-2">Pollen Types</summary>
          <div className="collapse-content">
            {/* Grass Pollen */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Image 
                  src="/weather-icons/design/fill/final/pollen-grass.svg" 
                  alt="Grass Pollen" 
                  width={16}
                  height={16}
                  className="w-4 h-4" 
                />
                <span className="font-medium">Grass Pollen</span>
                <span className="text-xs opacity-80">{pollenToday?.grass_pollen || '—'}</span>
              </div>
              <PollenBar level={pollenToday?.grass_pollen} size="sm" />
            </div>
            
            {/* Tree Pollen */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Image 
                  src="/weather-icons/design/fill/final/pollen-tree.svg" 
                  alt="Tree Pollen" 
                  width={16}
                  height={16}
                  className="w-4 h-4" 
                />
                <span className="font-medium">Tree Pollen</span>
                <span className="text-xs opacity-80">{pollenToday?.tree_pollen || '—'}</span>
              </div>
              <PollenBar level={pollenToday?.tree_pollen} size="sm" />
              
              {/* Specific tree pollen types when available */}
              {(pollenToday?.alder_pollen || pollenToday?.birch_pollen) && (
                <div className="pl-5 mt-1 text-xs">
                  {pollenToday?.alder_pollen && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="opacity-80">Alder:</span>
                      <span className="font-medium">{pollenToday.alder_pollen}</span>
                    </div>
                  )}
                  {pollenToday?.birch_pollen && (
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Birch:</span>
                      <span className="font-medium">{pollenToday.birch_pollen}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Individual tree pollen types are now shown in Tree Pollen section */}
            
            {/* Weed Pollen */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Image 
                  src="/weather-icons/design/fill/final/pollen.svg" 
                  alt="Weed Pollen" 
                  width={16}
                  height={16}
                  className="w-4 h-4" 
                />
                <span className="font-medium">Weed Pollen</span>
                <span className="text-xs opacity-80">{pollenToday?.weed_pollen || '—'}</span>
              </div>
              <PollenBar level={pollenToday?.weed_pollen} size="sm" />
              
              {/* Specific weed pollen types when available */}
              {(pollenToday?.ragweed_pollen || pollenToday?.mugwort_pollen) && (
                <div className="pl-5 mt-1 text-xs">
                  {pollenToday?.ragweed_pollen && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="opacity-80">Ragweed:</span>
                      <span className="font-medium">{pollenToday.ragweed_pollen}</span>
                    </div>
                  )}
                  {pollenToday?.mugwort_pollen && (
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Mugwort:</span>
                      <span className="font-medium">{pollenToday.mugwort_pollen}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Olive Pollen */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Image 
                  src="/weather-icons/design/fill/final/pollen-olive.svg" 
                  alt="Olive Pollen" 
                  width={16}
                  height={16}
                  className="w-4 h-4" 
                />
                <span className="font-medium">Olive Pollen</span>
                <span className="text-xs opacity-80">{pollenToday?.olive_pollen || '—'}</span>
              </div>
              <PollenBar level={pollenToday?.olive_pollen} size="sm" />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
