// src/lib/googleMaps.ts
// Google Maps loader using the new v2.0 functional API
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Track initialization state
let optionsSet = false;
let loadPromise: Promise<typeof google> | null = null;
let isLoaded = false;
let loadError: Error | null = null;

/**
 * Initialize Google Maps API options (call once at app startup)
 * This must be called before any importLibrary calls
 */
function ensureOptionsSet(): void {
  if (optionsSet) return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    console.warn('Google Maps API key not configured');
  }

  setOptions({
    key: apiKey,
    v: 'weekly',
  });
  optionsSet = true;
}

/**
 * Load Google Maps with Places library
 * Uses the new v2.0 importLibrary API for on-demand loading
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (isLoaded && window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (loadError) {
    return Promise.reject(loadError);
  }

  if (!loadPromise) {
    ensureOptionsSet();

    // Import the places library (this triggers the API script load)
    loadPromise = importLibrary('places')
      .then(() => {
        isLoaded = true;
        loadError = null;
        return window.google;
      })
      .catch((error) => {
        loadError = error;
        loadPromise = null; // Allow retry

        // Provide helpful error messages for common issues
        if (error.message?.includes('RefererNotAllowedMapError')) {
          const helpfulError = new Error(
            'Google Maps API key not authorized for this domain. ' +
            'Please add this domain to the API key restrictions in Google Cloud Console. ' +
            'See docs/GOOGLE_MAPS_API_SETUP.md for instructions.'
          );
          (helpfulError as Error & { originalError?: Error }).originalError = error;
          throw helpfulError;
        }

        if (error.message?.includes('ApiNotActivatedMapError')) {
          const helpfulError = new Error(
            'Google Maps JavaScript API is not enabled. ' +
            'Please enable it in Google Cloud Console > APIs & Services > Library.'
          );
          (helpfulError as Error & { originalError?: Error }).originalError = error;
          throw helpfulError;
        }

        throw error;
      });
  }
  return loadPromise;
}

export function isGoogleMapsLoaded(): boolean {
  return isLoaded && window.google?.maps?.places !== undefined;
}

export default loadGoogleMaps;
