/**
 * All windSpeed fields are in m/s (meters per second) throughout the pipeline.
 * Only convert to knots or km/h for display/UI.
 */
export interface MarineHour {
  time: string;
  waveHeight?: { noaa?: number };
  waterTemperature?: { noaa?: number };
  swellHeight?: { noaa?: number };
  swellPeriod?: { noaa?: number };
  windSpeed?: { noaa?: number }; // m/s
  windDirection?: { noaa?: number };
  windGust?: { noaa?: number };
  swellDirection?: { noaa?: number };
  visibility?: { noaa?: number };
  precipitation?: { noaa?: number };
  currentSpeed?: { noaa?: number };
  currentDirection?: { noaa?: number };
  // Extensible: undocumented provider keys may appear.
  [key: string]: unknown;
}
// ...add any other fields you use


export interface WeatherForecastDay {
  date: number;
  temperature: number;
  tempMax?: number;
  tempMin?: number;
  condition?: string;
  description?: string;
  icon?: string;
  rain?: number;
  /** Wind speed in m/s (meters per second) - standard internal unit */
  wind_speed?: number;
  /** Gust speed in m/s (meters per second) - standard internal unit */
  gust_speed?: number;
  wind_direction?: number; 
  clouds?: number;
  humidity?: number;
  visibility?: number;
  pressure?: number;
  
  // Marine-specific properties when available
  waterTemperature?: number;
  waveHeight?: number;
  swellHeight?: number;
  swellPeriod?: number;
  
  // Pollen data
  pollen?: {
    grass?: number;
    tree?: number;
    weed?: number;
  };

  // Air quality data
  airQuality?: {
    overall?: number;    // Overall AQI
    pm2_5?: number;      // PM2.5 particulate matter
    pm10?: number;       // PM10 particulate matter  
    no2?: number;        // Nitrogen dioxide
    o3?: number;         // Ozone
    so2?: number;        // Sulfur dioxide
    co?: number;         // Carbon monoxide
  };

  // Optional snow inputs surfaced by APIs/UI
  snowDepthCm?: number;       // cm
  snowfallRateMmH?: number;   // mm/h

  marine?: MarineHour[];
}



