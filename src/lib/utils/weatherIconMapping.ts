/**
 * Weather Icon Mapping Utilities
 * Maps MET Norway symbol codes to OpenWeather-compatible icon codes
 * for use with NextFewDaysCard and other weather components.
 * 
 * MET Norway symbols: https://api.met.no/weatherapi/weathericon/2.0/documentation
 * OpenWeather icons: 01d (clear day), 02d (few clouds), 03d (scattered clouds), etc.
 */

/**
 * Map MET Norway symbol_code to OpenWeather icon code
 * 
 * @param metNoSymbol MET Norway symbol like "clearsky_day", "cloudy", "rain", etc.
 * @returns OpenWeather icon code like "01d", "03d", "10d" or undefined
 * 
 * @example
 * mapMetNoSymbolToIcon("clearsky_day") // "01d"
 * mapMetNoSymbolToIcon("rain") // "10d"
 * mapMetNoSymbolToIcon("cloudy") // "04d"
 */
export function mapMetNoSymbolToIcon(metNoSymbol?: string): string | undefined {
  if (!metNoSymbol) return undefined;

  // Extract day/night suffix (_day, _night, _polartwilight)
  const isDayVariant = metNoSymbol.includes('_day') || metNoSymbol.includes('_polartwilight');
  const isNightVariant = metNoSymbol.includes('_night');
  const suffix = isDayVariant ? 'd' : isNightVariant ? 'n' : 'd'; // default to day

  // Remove suffix to get base symbol
  const base = metNoSymbol.replace(/_day|_night|_polartwilight/g, '');

  // Map MET Norway base symbols to OpenWeather codes
  const mapping: Record<string, string> = {
    // Clear sky
    'clearsky': '01',
    
    // Partly cloudy
    'fair': '02',
    'partlycloudy': '02',
    
    // Cloudy
    'cloudy': '04',
    
    // Light rain/drizzle
    'lightrain': '09',
    'lightrainshowers': '09',
    'lightrainshowersandthunder': '11',
    
    // Rain
    'rain': '10',
    'rainshowers': '10',
    'rainshowersandthunder': '11',
    'heavyrain': '10',
    'heavyrainshowers': '10',
    'heavyrainshowersandthunder': '11',
    
    // Sleet
    'lightsleet': '13',
    'sleet': '13',
    'heavysleet': '13',
    'lightsleetshowers': '13',
    'sleetshowers': '13',
    'heavysleetshowers': '13',
    'lightsleetshowersandthunder': '11',
    'sleetshowersandthunder': '11',
    'heavysleetshowersandthunder': '11',
    
    // Snow
    'lightsnow': '13',
    'snow': '13',
    'heavysnow': '13',
    'lightsnowshowers': '13',
    'snowshowers': '13',
    'heavysnowshowers': '13',
    'lightsnowshowersandthunder': '11',
    'snowshowersandthunder': '11',
    'heavysnowshowersandthunder': '11',
    
    // Fog
    'fog': '50',
    
    // Special cases
    'rainandthunder': '11',
    'sleetandthunder': '11',
    'snowandthunder': '11',
    'lightrainandthunder': '11',
    'lightsleetandthunder': '11',
    'lightsnowandthunder': '11',
    'heavyrainandthunder': '11',
    'heavysleetandthunder': '11',
    'heavysnowandthunder': '11',
  };

  const code = mapping[base];
  return code ? `${code}${suffix}` : undefined;
}

/**
 * Get human-readable description from MET Norway symbol
 * 
 * @param metNoSymbol MET Norway symbol like "clearsky_day", "rain", etc.
 * @returns Description like "Clear sky", "Rain", "Cloudy"
 */
export function getMetNoSymbolDescription(metNoSymbol?: string): string | undefined {
  if (!metNoSymbol) return undefined;

  const base = metNoSymbol.replace(/_day|_night|_polartwilight/g, '');

  const descriptions: Record<string, string> = {
    'clearsky': 'Clear sky',
    'fair': 'Fair',
    'partlycloudy': 'Partly cloudy',
    'cloudy': 'Cloudy',
    'fog': 'Fog',
    'lightrain': 'Light rain',
    'rain': 'Rain',
    'heavyrain': 'Heavy rain',
    'lightrainshowers': 'Light rain showers',
    'rainshowers': 'Rain showers',
    'heavyrainshowers': 'Heavy rain showers',
    'lightsleet': 'Light sleet',
    'sleet': 'Sleet',
    'heavysleet': 'Heavy sleet',
    'lightsnow': 'Light snow',
    'snow': 'Snow',
    'heavysnow': 'Heavy snow',
    'lightsnowshowers': 'Light snow showers',
    'snowshowers': 'Snow showers',
    'heavysnowshowers': 'Heavy snow showers',
    'rainandthunder': 'Rain and thunder',
    'lightrainandthunder': 'Light rain and thunder',
    'heavyrainandthunder': 'Heavy rain and thunder',
    'sleetandthunder': 'Sleet and thunder',
    'snowandthunder': 'Snow and thunder',
    'lightrainshowersandthunder': 'Light rain showers and thunder',
    'rainshowersandthunder': 'Rain showers and thunder',
    'heavyrainshowersandthunder': 'Heavy rain showers and thunder',
    'lightsleetshowersandthunder': 'Light sleet showers and thunder',
    'sleetshowersandthunder': 'Sleet showers and thunder',
    'heavysleetshowersandthunder': 'Heavy sleet showers and thunder',
    'lightsnowshowersandthunder': 'Light snow showers and thunder',
    'snowshowersandthunder': 'Snow showers and thunder',
    'heavysnowshowersandthunder': 'Heavy snow showers and thunder',
  };

  return descriptions[base] || base.replace(/([A-Z])/g, ' $1').trim();
}
