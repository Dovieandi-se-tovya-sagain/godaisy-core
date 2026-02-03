import { useEffect, useState, useCallback, useRef } from 'react';
import { loadGoogleMapsAPI } from '../googleMapsLazy';

/**
 * Custom hook for Google Maps Places Autocomplete using the NEW API (2025)
 * Migrated from AutocompleteService (legacy) to AutocompleteSuggestion (new)
 *
 * As of March 1st, 2025, AutocompleteService is not available to new customers.
 * This hook uses the new AutocompleteSuggestion.fetchAutocompleteSuggestions() API.
 *
 * @see https://developers.google.com/maps/documentation/javascript/place-autocomplete-data
 */

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface UsePlacesAutocompleteOptions {
  debounce?: number;
  requestOptions?: {
    types?: string[];
    includedRegionCodes?: string[]; // Replaces componentRestrictions.country
    language?: string;
    region?: string;
  };
}

export interface UsePlacesAutocompleteReturn {
  ready: boolean;
  value: string;
  suggestions: {
    status: string;
    data: PlacePrediction[];
  };
  setValue: (value: string, shouldFetchData?: boolean) => void;
  clearSuggestions: () => void;
  errorMessage: string | null;
}

export function usePlacesAutocompleteNew(
  options: UsePlacesAutocompleteOptions = {}
): UsePlacesAutocompleteReturn {
  const { debounce = 300, requestOptions = {} } = options;

  const [ready, setReady] = useState(false);
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<{
    status: string;
    data: PlacePrediction[];
  }>({
    status: '',
    data: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Load Google Maps Places library dynamically using event-based pattern
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initService = async () => {
      try {
        console.log('🔄 Initializing Google Places AutocompleteSuggestion (new API)...');
        // Import the places library to get access to AutocompleteSuggestion
        await google.maps.importLibrary('places') as google.maps.PlacesLibrary;

        // Create a session token for billing optimization
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

        setReady(true);
        console.log('✅ Google Places AutocompleteSuggestion ready');
      } catch (error) {
        console.error('❌ Failed to load Google Maps Places library:', error);
        setReady(false);
      }
    };

    const handleGoogleMapsLoaded = () => {
      console.log('🎉 Received googleMapsLoaded event');
      initService();
    };

    const handleGoogleMapsError = () => {
      console.error('❌ Google Maps failed to load');
      setReady(false);
    };

    // Check if Google Maps is already loaded (fast page loads)
    if (window.google?.maps) {
      console.log('✅ Google Maps already loaded, initializing immediately');
      initService();
    } else {
      // Not loaded yet - proactively start loading AND listen for completion
      console.log('🚀 Proactively loading Google Maps API...');
      loadGoogleMapsAPI().catch(err => {
        console.error('Failed to load Google Maps for autocomplete:', err);
      });

      // Set up event listeners for when loading completes
      window.addEventListener('googleMapsLoaded', handleGoogleMapsLoaded);
      window.addEventListener('googleMapsLoadError', handleGoogleMapsError);

      // Cleanup listeners on unmount
      return () => {
        window.removeEventListener('googleMapsLoaded', handleGoogleMapsLoaded);
        window.removeEventListener('googleMapsLoadError', handleGoogleMapsError);
      };
    }
  }, []);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!ready || !input.trim()) {
        setSuggestions({ status: '', data: [] });
        return;
      }

      try {
        // Build request with new API format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const request: any = {
          input,
          sessionToken: sessionTokenRef.current ?? undefined,
        };

        // Map old 'types' to new 'includedPrimaryTypes' if provided
        if (requestOptions.types && requestOptions.types.length > 0) {
          // Filter for valid types - 'geocode' is a valid type in new API
          request.includedPrimaryTypes = requestOptions.types.filter(type =>
            type === 'geocode' || type === 'establishment' || type === 'address'
          );
        }

        // Add region codes if provided
        if (requestOptions.includedRegionCodes) {
          request.includedRegionCodes = requestOptions.includedRegionCodes;
        }

        // Add language and region if provided
        if (requestOptions.language) {
          request.language = requestOptions.language;
        }
        if (requestOptions.region) {
          request.region = requestOptions.region;
        }

        // Call the new API (it's a static method, not an instance method)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { suggestions: rawSuggestions } = await (google.maps.places.AutocompleteSuggestion as any).fetchAutocompleteSuggestions(request);

        if (rawSuggestions && rawSuggestions.length > 0) {
          // Transform new API response to match old API format for compatibility
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: PlacePrediction[] = rawSuggestions.map((suggestion: any) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) {
              return {
                place_id: '',
                description: '',
                structured_formatting: {
                  main_text: '',
                  secondary_text: '',
                },
              };
            }
            return {
              place_id: prediction.placeId || '',
              // Compose description from mainText and secondaryText
              description: prediction.text?.text ||
                `${prediction.mainText?.text || ''}${prediction.secondaryText?.text ? ', ' + prediction.secondaryText.text : ''}`,
              structured_formatting: {
                main_text: prediction.mainText?.text || '',
                secondary_text: prediction.secondaryText?.text || '',
              },
            };
          }).filter((p: PlacePrediction) => p.place_id); // Filter out empty predictions

          setSuggestions({
            status: 'OK',
            data,
          });
          setErrorMessage(null);
        } else {
          setSuggestions({
            status: 'ZERO_RESULTS',
            data: [],
          });
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('❌ AutocompleteSuggestion fetch error:', error);
        setSuggestions({
          status: 'ERROR',
          data: [],
        });
        setErrorMessage(error instanceof Error ? error.message : 'Autocomplete request failed');
      }
    },
    [ready, requestOptions]
  );

  const handleSetValue = useCallback(
    (newValue: string, shouldFetchData = true) => {
      setValue(newValue);

      if (!shouldFetchData) {
        return;
      }

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the fetch
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, debounce);
    },
    [debounce, fetchSuggestions]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions({ status: '', data: [] });

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Refresh session token for next session
    if (window.google?.maps?.places) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    ready,
    value,
    suggestions,
    setValue: handleSetValue,
    clearSuggestions,
    errorMessage,
  };
}

// Utility functions to match the old API
export async function getGeocode(args: { placeId?: string; address?: string }): Promise<google.maps.GeocoderResult[]> {
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(args, (results, status) => {
      if (status === 'OK' && results) {
        resolve(results);
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
}

export function getLatLng(result: google.maps.GeocoderResult): { lat: number; lng: number } {
  return {
    lat: result.geometry.location.lat(),
    lng: result.geometry.location.lng(),
  };
}
