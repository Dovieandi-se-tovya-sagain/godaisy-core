/**
 * Lazy-load Google Maps API on demand using the v2.0 functional API
 *
 * This avoids blocking initial page render with Google Maps script.
 * The API is only loaded when CoastalLocationDialog opens for the first time.
 */

import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Get API key at module level so Next.js can inline it at build time
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let optionsSet = false;
let loadPromise: Promise<void> | null = null;
let isLoaded = false;

/**
 * Ensure API options are set (call once before any library import)
 */
function ensureOptionsSet(): void {
  if (optionsSet) return;

  setOptions({
    key: GOOGLE_MAPS_API_KEY,
    v: 'weekly',
  });
  optionsSet = true;
}

export function loadGoogleMapsAPI(): Promise<void> {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in browser environment'));
  }

  // Already loaded
  if (isLoaded && window.google?.maps) {
    console.log('✅ Google Maps already loaded');
    return Promise.resolve();
  }

  // Already loading
  if (loadPromise) {
    console.log('🔄 Google Maps already loading, returning existing promise');
    return loadPromise;
  }

  // Start loading
  console.log('🔍 Google Maps API key check:', GOOGLE_MAPS_API_KEY ? 'Found' : 'Missing');

  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key') {
    console.error('❌ Google Maps API key missing or not configured');
    console.error('Key value:', GOOGLE_MAPS_API_KEY || '(empty)');
    return Promise.reject(new Error('Google Maps API key is not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local'));
  }

  console.log('🔄 Lazy loading Google Maps API with v2.0 loader...');

  // Set options before importing any library
  ensureOptionsSet();

  // Import places library (this triggers the API script load)
  loadPromise = importLibrary('places')
    .then(() => {
      isLoaded = true;
      console.log('✅ Google Maps API loaded successfully');

      // Dispatch event to notify hooks that Google Maps is ready
      window.dispatchEvent(new Event('googleMapsLoaded'));
    })
    .catch((err) => {
      console.error('❌ Error loading Google Maps:', err);
      loadPromise = null; // Reset so user can retry

      // Dispatch error event
      window.dispatchEvent(new Event('googleMapsLoadError'));
      throw err;
    });

  return loadPromise;
}

export function isGoogleMapsReady(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return isLoaded && window.google?.maps !== undefined;
}
