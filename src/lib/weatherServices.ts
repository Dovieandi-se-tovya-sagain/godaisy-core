/**
 * Unified Weather Services API
 * Re-exports all weather service functions from the services directory
 */

// Re-export all functions from weatherService.ts
export * from './services/weatherService';

// Export the most commonly used functions directly
export {
  getFullWeather,
  fetchOpenWeatherOneCall,
  fetchOpenWeatherForecast25,
  fetchOpenMeteoWeather,
  fetchStormglassTides,
  normalizeWeatherFeatures
} from './services/weatherService';
