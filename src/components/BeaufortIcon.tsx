import React from 'react';
import Image from 'next/image.js';

interface BeaufortIconProps {
  windMS: number;
  size?: number;
  className?: string;
}

export default function BeaufortIcon({ windMS, size = 24, className = '' }: BeaufortIconProps) {
  // Convert m/s to Beaufort scale (0-12)
  const windKmh = windMS * 3.6;
  let beaufortNumber = 0;
  
  if (windKmh >= 118) beaufortNumber = 12;
  else if (windKmh >= 103) beaufortNumber = 11;
  else if (windKmh >= 89) beaufortNumber = 10;
  else if (windKmh >= 75) beaufortNumber = 9;
  else if (windKmh >= 62) beaufortNumber = 8;
  else if (windKmh >= 50) beaufortNumber = 7;
  else if (windKmh >= 39) beaufortNumber = 6;
  else if (windKmh >= 29) beaufortNumber = 5;
  else if (windKmh >= 20) beaufortNumber = 4;
  else if (windKmh >= 12) beaufortNumber = 3;
  else if (windKmh >= 6) beaufortNumber = 2;
  else if (windKmh >= 2) beaufortNumber = 1;

  // Use proper Beaufort wind icons
  const iconPath = `/weather-icons/design/fill/final/wind-beaufort-${beaufortNumber}.svg`;

  return (
    <Image
      src={iconPath}
      alt={`Beaufort ${beaufortNumber}`}
      width={size}
      height={size}
      className={className}
      title={`Beaufort ${beaufortNumber}`}
    />
  );
}
