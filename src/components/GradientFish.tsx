import React from 'react';
import { Fish } from 'lucide-react';

/**
 * GradientFish Component
 * 
 * A beautiful fallback fish icon with ocean gradient colors
 * Used when species images are not available
 */

interface GradientFishProps {
  size?: number;
  className?: string;
}

export function GradientFish({ size = 96, className = '' }: GradientFishProps) {
  return (
    <>
      {/* SVG gradient definition - only rendered once per page */}
      <svg aria-hidden className="absolute w-0 h-0 overflow-hidden pointer-events-none">
        <defs>
          <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0077ff">
              <animate attributeName="stop-color" values="#0077ff;#00ffaa;#0077ff" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#00ffaa">
              <animate attributeName="stop-color" values="#00ffaa;#0077ff;#00ffaa" dur="6s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
      </svg>
      
      {/* Fish icon with gradient stroke */}
      <Fish 
        size={size} 
        stroke="url(#oceanGradient)" 
        strokeWidth={0.5}
        className={className}
      />
    </>
  );
}
