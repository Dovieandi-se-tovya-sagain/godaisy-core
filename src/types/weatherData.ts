// Define weather data types to avoid using 'any'

export interface WeatherData {
  clouds?: number;
  visibility?: number;
  wind_speed?: number;
  rain?: number;
  snow?: number;
  condition?: string;
  description?: string;
  nightDescription?: string;
  nightTemp?: number;
  daily?: DailyWeatherData[];
  hourly?: HourlyWeatherData[];
  current?: CurrentWeatherData;
}

export interface WeatherItem {
  dt: number;
  weather?: {
    id?: number;
    main?: string;
    description?: string;
    icon?: string;
  }[];
}

export interface CurrentWeatherData extends WeatherItem {
  temp: number;
  feels_like?: number;
  wind_speed: number;
  wind_deg?: number;
  clouds: number;
  visibility?: number;
  uvi?: number;
  humidity?: number;
}

export interface HourlyWeatherData extends WeatherItem {
  temp: number;
  feels_like?: number;
  wind_speed: number;
  wind_deg?: number;
  clouds: number;
  visibility?: number;
  pop?: number; // probability of precipitation
  rain?: {
    '1h'?: number;
  };
  snow?: {
    '1h'?: number;
  };
}

export interface DailyWeatherData extends WeatherItem {
  temp: {
    day?: number;
    min?: number;
    max?: number;
    night?: number;
    eve?: number;
    morn?: number;
  };
  feels_like?: {
    day?: number;
    night?: number;
    eve?: number;
    morn?: number;
  };
  wind_speed?: number;
  wind_deg?: number;
  clouds?: number;
  pop?: number; // probability of precipitation
  rain?: number;
  snow?: number;
}

export interface HourlyForClearSkies {
  time: string[];
  cloudcover: number[];
}
