import React, { useState, useCallback, useRef } from 'react';

// Simple debounce implementation
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Type for location suggestions
interface LocationSuggestion {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  state?: string;
  local_names?: Record<string, string>;
}

// Nominatim response minimal shape
interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
}

function isNominatimResultArray(data: unknown): data is NominatimResult[] {
  return Array.isArray(data) && data.every((item) => {
    return typeof item === 'object' && item !== null && 'lat' in item && 'lon' in item;
  });
}

// Alternative implementation that doesn't rely on deprecated Google Places APIs
const ModernLocationSearch: React.FC<{
  onSelect: (location: { name: string; lat: number; lon: number }) => void;
  homeLocation?: { lat: number; lon: number };
  placeholder?: string;
  onInputFocus?: () => void;
}> = ({ onSelect, placeholder = "Search for location", onInputFocus }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use OpenWeather Geocoding API with fallback to OpenStreetMap Nominatim
  const searchLocations = useCallback((searchQuery: string) => {
    const debouncedSearch = debounce(async () => {
      if (!searchQuery.trim() || searchQuery.length < 4) {
        setSuggestions([]);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      const fetchNominatim = async () => {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5`;
        const resp = await fetch(nominatimUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        if (!resp.ok) throw new Error(`Nominatim failed: ${resp.status}`);
        const data: unknown = await resp.json();
        const transformed: LocationSuggestion[] = isNominatimResultArray(data)
          ? data.map((item) => {
              const lat = Number(item.lat);
              const lon = Number(item.lon);
              const name = item.display_name || item.name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
              return { name, lat, lon };
            })
          : [];
        setSuggestions(transformed);
      };

      try {
        const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_KEY;
        if (!apiKey) {
          // Fallback immediately if no key configured
          await fetchNominatim();
          return;
        }

        // Use OpenWeather Geocoding API for location search
        const response = await fetch(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchQuery)}&limit=5&appid=${apiKey}`,
          {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          }
        );

        if (!response.ok) {
          // Try fallback when OW fails (e.g., 401 or 429)
          await fetchNominatim();
          return;
        }

        const data: unknown = await response.json();
        
        // Transform to consistent format
        const transformedSuggestions: LocationSuggestion[] = Array.isArray(data) ? data.map((item) => {
          // OpenWeather returns numbers already
          const anyItem = item as { name?: string; lat?: number; lon?: number; country?: string; state?: string };
          const lat = Number(anyItem.lat);
          const lon = Number(anyItem.lon);
          let displayName = anyItem.name ?? '';
          if (anyItem.state && anyItem.state !== anyItem.name) displayName += displayName ? `, ${anyItem.state}` : anyItem.state;
          if (anyItem.country) displayName += displayName ? `, ${anyItem.country}` : anyItem.country;
          return { name: displayName || `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
        }) : [];

        setSuggestions(transformedSuggestions);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        try {
          // Final fallback
          await fetchNominatim();
        } catch (fallbackErr) {
          console.error('Location search error:', err, fallbackErr);
          setError('Search temporarily unavailable. Please try again.');
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 500);
    
    debouncedSearch();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    searchLocations(value);
  };

  const handleSelect = (suggestion: LocationSuggestion) => {
    onSelect({
      name: suggestion.name,
      lat: suggestion.lat,
      lon: suggestion.lon
    });
    setQuery('');
    setSuggestions([]);
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="modern-location-search">
      <div className="coastal-dialog-search-container">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={onInputFocus}
          placeholder={loading ? "Searching..." : placeholder}
          className="coastal-dialog-input"
          aria-busy={loading}
        />
        {query && (
          <button
            className="coastal-dialog-search-clear"
            onClick={clearSearch}
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div style={{
          color: '#dc2626',
          fontSize: '0.9rem',
          marginTop: '8px',
          padding: '8px',
          background: '#fee2e2',
          borderRadius: '6px'
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{
          color: '#7c2d12',
          fontSize: '0.9rem',
          marginTop: '8px',
          padding: '8px',
          background: '#fef3c7',
          borderRadius: '6px'
        }}>
          🔍 Searching locations...
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="coastal-dialog-list" style={{ marginTop: '8px' }}>
          {suggestions.map((suggestion, index) => (
            <li key={index} className="coastal-dialog-list-item">
              <button
                className="coastal-dialog-list-btn"
                onClick={() => handleSelect(suggestion)}
              >
                <div className="coastal-dialog-search-result">
                  <span className="coastal-dialog-result-type">📍</span>
                  <div className="coastal-dialog-result-content">
                    <span className="coastal-dialog-result-main">{suggestion.name}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ModernLocationSearch;
