/**
 * Cookie utilities for persisting location data
 * Used to remember last chosen location even in incognito mode
 */

const COOKIE_NAME = 'findr_last_location';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export interface LastLocationCookie {
  rectangleCode: string;
  rectangleRegion: string;
  lat: number;
  lon: number;
  updatedAt: string;
}

/**
 * Check if cookies are enabled and available
 */
export function areCookiesAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const test = '__cookie_test__';
    document.cookie = `${test}=1; max-age=1`;
    const result = document.cookie.indexOf(test) !== -1;
    // Clean up test cookie
    document.cookie = `${test}=; max-age=0`;
    return result;
  } catch {
    return false;
  }
}

/**
 * Get the last location from cookie
 */
export function getLastLocationFromCookie(): LastLocationCookie | null {
  if (typeof document === 'undefined') return null;

  try {
    const cookies = document.cookie.split(';');
    const locationCookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAME}=`));

    if (!locationCookie) return null;

    const value = locationCookie.split('=')[1];
    if (!value) return null;

    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded) as LastLocationCookie;

    // Validate the parsed data
    if (
      typeof parsed.rectangleCode === 'string' &&
      typeof parsed.rectangleRegion === 'string' &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number' &&
      typeof parsed.updatedAt === 'string'
    ) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.warn('[Cookies] Failed to read last location cookie', error);
    return null;
  }
}

/**
 * Save the last location to cookie
 * Only saves if cookies are available (user hasn't blocked them)
 */
export function saveLastLocationToCookie(location: LastLocationCookie): boolean {
  if (typeof document === 'undefined') return false;
  if (!areCookiesAvailable()) return false;

  try {
    const value = encodeURIComponent(JSON.stringify(location));
    const maxAge = COOKIE_MAX_AGE;
    const sameSite = 'Lax'; // Allow cross-origin requests but protect against CSRF
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';

    document.cookie = `${COOKIE_NAME}=${value}; max-age=${maxAge}; path=/; SameSite=${sameSite}${secure}`;

    return true;
  } catch (error) {
    console.warn('[Cookies] Failed to save last location cookie', error);
    return false;
  }
}

/**
 * Clear the last location cookie
 */
export function clearLastLocationCookie(): void {
  if (typeof document === 'undefined') return;

  try {
    document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
  } catch (error) {
    console.warn('[Cookies] Failed to clear last location cookie', error);
  }
}
