import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlacesAutocompleteNew as usePlacesAutocomplete, getGeocode, getLatLng } from '../lib/hooks/usePlacesAutocompleteNew';
import { loadGoogleMapsAPI } from '../lib/googleMapsLazy';
import { getCurrentPosition, GeolocationException } from '../lib/capacitor/geolocation';

const MapPicker = lazy(() => import('./MapPicker'));

// Remove complex inferred types to avoid mismatches with library typings

type NominatimResponse = {
  name?: string;
  display_name?: string;
  address?: {
    beach?: string;
    water?: string;
    amenity?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
  };
};

// Minimal type for Google Places suggestion items we use
interface SuggestionItem {
  place_id?: string;
  description?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  provider?: 'google' | 'fallback';
  lat?: number;
  lon?: number;
  note?: string;
}

interface NominatimSearchResult extends NominatimResponse {
  place_id?: number | string;
  display_name?: string;
  lat: string;
  lon: string;
}

const NOMINATIM_USER_AGENT = 'WotNowFindr/1.0 (support@wotnow.app)';
const FALLBACK_ERROR_MSG = 'Fallback search is temporarily unavailable. Try again or drop a pin on the map.';

function formatFallbackMainText(result: NominatimSearchResult): string {
  const addr = result.address;
  const primary = addr?.beach || addr?.water || addr?.amenity || addr?.road || addr?.neighbourhood || addr?.suburb || addr?.village || addr?.town || addr?.city || addr?.state || addr?.region;
  if (primary) return primary;
  if (result.display_name) {
    const [first] = result.display_name.split(',');
    if (first?.trim()) return first.trim();
  }
  return 'Selected location';
}

function formatFallbackSecondaryText(result: NominatimSearchResult): string | undefined {
  const addr = result.address;
  const parts: string[] = [];
  const maybeAdd = (value?: string | null) => {
    if (value && !parts.includes(value)) parts.push(value);
  };
  maybeAdd(addr?.city ?? addr?.town ?? addr?.village ?? addr?.county);
  maybeAdd(addr?.state ?? addr?.region);
  maybeAdd(addr?.country);
  if (!parts.length && result.display_name) {
    const [, ...rest] = result.display_name.split(',');
    rest.map((segment) => segment.trim()).filter(Boolean).slice(0, 2).forEach((segment) => parts.push(segment));
  }
  return parts.length ? parts.join(', ') : undefined;
}

// Location-like shape used across components
export type LocationLike = { name: string; lat: number; lon: number; type?: 'home' | 'coastal' };

/**
 * CoastalLocationDialog — DaisyUI modal with Google Places autocomplete wired in.
 * - Solid light theme (scoped) to avoid white-on-white from global styles
 * - Focus management (trap, restore, Esc/Backdrop close)
 * - Renders its own suggestion list INSIDE the modal (no pac-container styling battles)
 */

export type BasicLocation = { name: string; lat: number; lon: number };

interface CoastalLocationDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  onSave: (loc: BasicLocation) => void;
  homeLocation?: LocationLike;
  recentLocations?: BasicLocation[];
  // optional extras for backwards compatibility with callers
  coastalLocation?: LocationLike;
  setHomeLocation?: (loc: LocationLike) => void;
  setCoastalLocation?: (loc: LocationLike) => void;
}

const CoastalLocationDialog: React.FC<CoastalLocationDialogProps> = ({
  open,
  onClose,
  title = 'Pick your coastal location',
  onSave,
  homeLocation,
  recentLocations: _recentLocations = [],
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [selectedName, setSelectedName] = useState<string | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [confirmLocate, setConfirmLocate] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [showLoadingTimeout, setShowLoadingTimeout] = useState(false);

  const RECENT_KEY = 'coastal_recent_locations_v1';
  const LEGACY_KEY = 'recentCoastalLocations';
  const [recent, setRecent] = useState<BasicLocation[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawNew = localStorage.getItem(RECENT_KEY);
      const rawLegacyLocal = localStorage.getItem(LEGACY_KEY);
      const rawLegacySession = sessionStorage.getItem(LEGACY_KEY);
      const fromNew = rawNew ? (JSON.parse(rawNew) as BasicLocation[]) : [];
      const fromLegacyLocal = rawLegacyLocal ? (JSON.parse(rawLegacyLocal) as BasicLocation[]) : [];
      const fromLegacySession = rawLegacySession ? (JSON.parse(rawLegacySession) as BasicLocation[]) : [];

      const merged = [...fromNew, ...fromLegacyLocal, ...fromLegacySession];
      const keyOf = (l: BasicLocation) => `${l.name}|${Number(l.lat).toFixed(4)},${Number(l.lon).toFixed(4)}`;
      const dedup: Record<string, BasicLocation> = {};
      merged.forEach((l) => { if (l && typeof l.lat !== 'undefined' && typeof l.lon !== 'undefined') dedup[keyOf(l)] = { ...l, lat: Number(l.lat), lon: Number(l.lon) }; });
      const list = Object.values(dedup).slice(0, 8);
      if (list.length) setRecent(list);

      // write back to new key for future reads
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (err) { void err; }
    } catch (err) { void err; }
  }, []);
  // Reload recents from storage every time dialog opens, and listen for storage events
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const load = () => {
      try {
        const rawNew = localStorage.getItem(RECENT_KEY);
        const rawLegacyLocal = localStorage.getItem(LEGACY_KEY);
        const rawLegacySession = sessionStorage.getItem(LEGACY_KEY);
        const fromNew = rawNew ? (JSON.parse(rawNew) as BasicLocation[]) : [];
        const fromLegacyLocal = rawLegacyLocal ? (JSON.parse(rawLegacyLocal) as BasicLocation[]) : [];
        const fromLegacySession = rawLegacySession ? (JSON.parse(rawLegacySession) as BasicLocation[]) : [];
        const merged = [...fromNew, ...fromLegacyLocal, ...fromLegacySession];
        const keyOf = (l: BasicLocation) => `${l.name}|${Number(l.lat).toFixed(4)},${Number(l.lon).toFixed(4)}`;
        const dedup: Record<string, BasicLocation> = {};
        merged.forEach((l) => { if (l && typeof l.lat !== 'undefined' && typeof l.lon !== 'undefined') dedup[keyOf(l)] = { ...l, lat: Number(l.lat), lon: Number(l.lon) }; });
        const list = Object.values(dedup).slice(0, 8);
        if (list.length) setRecent(list);
      } catch (err) { void err; }
    };
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_KEY || e.key === LEGACY_KEY) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [open]);
  const addRecent = (loc: BasicLocation) => {
    setRecent((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const keyOf = (l: BasicLocation) => `${l.name}|${Number(l.lat).toFixed(4)},${Number(l.lon).toFixed(4)}`;
      const idx = list.findIndex((r) => keyOf(r) === keyOf(loc));
      if (idx !== -1) list.splice(idx, 1);
      list.unshift({ ...loc, lat: Number(loc.lat), lon: Number(loc.lon) });
      const trimmed = list.slice(0, 8);
      const payload = JSON.stringify(trimmed);
      try { if (typeof window !== 'undefined') localStorage.setItem(RECENT_KEY, payload); } catch (err) { void err; }
      try { if (typeof window !== 'undefined') sessionStorage.setItem(RECENT_KEY, payload); } catch (err) { void err; }
      // also write legacy keys for compatibility with older code paths
      try { if (typeof window !== 'undefined') localStorage.setItem(LEGACY_KEY, payload); } catch (err) { void err; }
      try { if (typeof window !== 'undefined') sessionStorage.setItem(LEGACY_KEY, payload); } catch (err) { void err; }
      return trimmed;
    });
  };

  // Lazy load Google Maps when dialog opens
  useEffect(() => {
    if (!open) return;

    // Set a timeout to show alternative options if loading takes too long
    const timeoutId = setTimeout(() => {
      setShowLoadingTimeout(true);
    }, 5000); // Show alternatives after 5 seconds

    loadGoogleMapsAPI()
      .then(() => {
        clearTimeout(timeoutId);
        setShowLoadingTimeout(false);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error('Failed to load Google Maps:', err);
        const message = err instanceof Error ? err.message : 'Failed to load location search';

        // Show helpful error based on the issue
        if (message.includes('API key')) {
          setLocationError('Location search unavailable. You can still use "Current location" or "Pick from map".');
        } else if (message.includes('timeout')) {
          setLocationError('Location search is taking longer than expected. You can still use "Current location" or "Pick from map".');
        } else {
          setLocationError('Location search unavailable. You can still use "Current location" or "Pick from map".');
        }
      });

    return () => clearTimeout(timeoutId);
  }, [open]);

  // Google Places hook (we render our own suggestions list)
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
    errorMessage: autocompleteError,
  } = usePlacesAutocomplete({
    debounce: 300,
    requestOptions: {
      types: ['geocode'],
    }
  });

  const [useFallbackSearch, setUseFallbackSearch] = useState(false);
  const [fallbackSuggestions, setFallbackSuggestions] = useState<SuggestionItem[]>([]);
  const fallbackAbortRef = useRef<AbortController | null>(null);
  const autoFallbackTriggeredRef = useRef(false);

  const enableFallbackSearch = useCallback(() => {
    setUseFallbackSearch((prev) => {
      if (prev) return prev;
      setFallbackSuggestions([]);
      return true;
    });
  }, []);

  const disableFallbackSearch = useCallback(() => {
    setUseFallbackSearch((prev) => {
      if (!prev) return prev;
      setFallbackSuggestions([]);
      if (fallbackAbortRef.current) {
        fallbackAbortRef.current.abort();
        fallbackAbortRef.current = null;
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (!autocompleteError) return;
    if (autoFallbackTriggeredRef.current) return;
    if (/referer|blocked|denied|key/i.test(autocompleteError)) {
      autoFallbackTriggeredRef.current = true;
      enableFallbackSearch();
    }
  }, [autocompleteError, enableFallbackSearch]);

  useEffect(() => {
    if (!open) {
      disableFallbackSearch();
    }
  }, [open, disableFallbackSearch]);

  useEffect(() => {
    if (!useFallbackSearch) {
      if (fallbackAbortRef.current) {
        fallbackAbortRef.current.abort();
        fallbackAbortRef.current = null;
      }
      setFallbackSuggestions([]);
      return;
    }

    const query = value.trim();
    if (!query) {
      setFallbackSuggestions([]);
      return;
    }

    const controller = new AbortController();
    fallbackAbortRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('limit', '6');

        const res = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            'User-Agent': NOMINATIM_USER_AGENT,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Fallback search failed (${res.status})`);
        }

        const payload = (await res.json()) as NominatimSearchResult[];
        const normalized: SuggestionItem[] = payload.map((item, index) => ({
          place_id: `osm-${item.place_id ?? index}`,
          description: item.display_name || formatFallbackMainText(item),
          structured_formatting: {
            main_text: formatFallbackMainText(item),
            secondary_text: formatFallbackSecondaryText(item),
          },
          provider: 'fallback',
          lat: Number(item.lat),
          lon: Number(item.lon),
        }));

        setFallbackSuggestions(normalized);
        setLocationError((prev) => (prev === FALLBACK_ERROR_MSG ? null : prev));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Fallback location search failed', error);
        setFallbackSuggestions([]);
        setLocationError(FALLBACK_ERROR_MSG);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [useFallbackSearch, value]);

  // Lock scroll + set/restore focus when opened/closed
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = (document.activeElement as HTMLElement) || null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  // Simple focus trap + Esc close
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      const nodes = Array.from(focusable);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement;
      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    }
  };

  const reverseGeocodeName = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GoDaisy/1.0 (contact: app)'
        }
      });
      if (!res.ok) return null;
      const json: NominatimResponse = await res.json();
      // Prefer beach/amenity/road + town/region where available
      const nameParts: string[] = [];
      const disp = json?.name || json?.display_name;
      if (disp) return disp as string;
      const addr = json?.address || {};
      const name = addr.beach || addr.water || addr.amenity || addr.road || addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.city || addr.county;
      const region = addr.state || addr.region || addr.county;
      if (name) nameParts.push(name);
      if (region) nameParts.push(region);
      return nameParts.length ? nameParts.join(', ') : null;
    } catch {
      return null;
    }
  };

  const getCurrentLocation = async () => {
    setLocationError(null);
    setConfirmLocate(false);
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not available in this browser.');
      return;
    }
    try {
      setIsLocating(true);

      // Use Capacitor geolocation wrapper (native on iOS/Android, web fallback in browser)
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // update local state for UI (optional)
      setSelectedCoords({ lat, lon });
      setSelectedName(null);

      const friendly = await reverseGeocodeName(lat, lon);
      const friendlyName = friendly || `Current location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
      const saved = { name: friendlyName, lat, lon } as BasicLocation;
      addRecent(saved);
      onSave(saved);
      onClose();
    } catch (e: unknown) {
      let msg = 'Unable to get your location.';

      // Handle Capacitor GeolocationException
      if (e instanceof GeolocationException) {
        if (e.type === 'PERMISSION_DENIED') msg = 'Location permission denied.';
        else if (e.type === 'POSITION_UNAVAILABLE') msg = 'Position unavailable.';
        else if (e.type === 'TIMEOUT') msg = 'Location timeout.';
        else msg = e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }

      setLocationError(msg);
    } finally {
      setIsLocating(false);
    }
  };

  const saveAndClose = (loc: BasicLocation) => {
    addRecent(loc);
    onSave(loc);
    clearSuggestions();
    setValue('');
    setSelectedCoords(null);
    setSelectedName(null);
    onClose();
  };

  // Handle click on a Google Places suggestion
  const handleSuggestionClick = async (
    suggestion: SuggestionItem
  ) => {
    setLocationError(null);
    setIsLoadingSuggestion(true);

    try {
      const label: string = suggestion?.structured_formatting?.main_text || suggestion?.description || 'Selected place';
      if (suggestion.provider === 'fallback') {
        if (typeof suggestion.lat !== 'number' || typeof suggestion.lon !== 'number') {
          throw new Error('Fallback suggestion missing coordinates');
        }
        saveAndClose({ name: label, lat: suggestion.lat, lon: suggestion.lon });
        return;
      }

      const placeId: string | undefined = suggestion?.place_id;

      if (!placeId) {
        throw new Error('No place ID found for this location');
      }

      const results = await getGeocode({ placeId });

      if (!results?.length) {
        throw new Error('Unable to find coordinates for this location');
      }

      const { lat, lng } = await getLatLng(results[0]);
      saveAndClose({ name: label, lat, lon: lng });
    } catch (err) {
      console.error('❌ Failed to geocode location:', err);
      const message = err instanceof Error ? err.message : 'Failed to get location details. Please try again.';
      setLocationError(message);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleRecentClick = (loc: BasicLocation) => {
    saveAndClose(loc);
  };

  const handleMapSelect = async (lat: number, lon: number) => {
    setSelectedCoords({ lat, lon });
    const friendly = await reverseGeocodeName(lat, lon);
    const name = friendly || `Selected point (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    setSelectedName(name);
    saveAndClose({ name, lat, lon });
  };

  const googleSuggestions: SuggestionItem[] = status === 'OK'
    ? data.map((prediction) => ({
        place_id: prediction.place_id,
        description: prediction.description,
        structured_formatting: prediction.structured_formatting,
        provider: 'google',
      }))
    : [];

  const suggestionItems = useFallbackSearch ? fallbackSuggestions : googleSuggestions;
  const refererBlocked = Boolean(autocompleteError && /referer/i.test(autocompleteError));

  if (!open) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="bg-white text-gray-900 shadow-xl rounded-lg w-[min(92vw,48rem)] p-6 max-h-[90vh] overflow-y-auto"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coastal-dialog-title"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="coastal-dialog-title" className="text-lg font-semibold">{title}</h2>
          <button aria-label="Close" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="text-sm text-base-content/60 mb-3">
          {/(home|Home)/.test(title) ? 'Search for your town or postcode, or drop a pin on the map.' : 'Search for a beach or coastal spot, or drop a pin on the map.'}
        </p>

        <div className="form-control relative">
          <input
            ref={inputRef}
            type="text"
            className="input input-bordered w-full pr-10"
            data-testid="location-dialog-input"
            placeholder={ready || useFallbackSearch ? 'Search a place…' : 'Loading Google Maps…'}
            value={value}
            onChange={(e) => setValue(e.target.value, !useFallbackSearch)}
            aria-autocomplete="list"
            disabled={(!ready && !useFallbackSearch) || isLoadingSuggestion}
          />
          {((!ready && !useFallbackSearch) || isLoadingSuggestion) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="loading loading-spinner loading-sm"></span>
            </span>
          )}

          {suggestionItems.length > 0 && (
            <ul
              className="absolute left-0 right-0 z-50 mt-1 bg-base-100 rounded-box ring-1 ring-base-300/60 max-h-64 overflow-auto shadow-lg"
              role="listbox"
            >
              {suggestionItems.map((sug, idx) => {
                const key = sug.place_id || `${sug.provider || 'suggestion'}-${idx}`;
                const main = sug?.structured_formatting?.main_text || sug?.description;
                const secondary = sug?.structured_formatting?.secondary_text;
                return (
                  <li key={key}>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-base-200 focus:bg-base-200 text-base-content"
                      onClick={() => handleSuggestionClick(sug)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-start">
                          <span className="font-medium leading-tight text-base-content">{main}</span>
                          {secondary ? <span className="text-xs opacity-70 leading-tight text-base-content">{secondary}</span> : null}
                        </div>
                        {sug.provider === 'fallback' && (
                          <span className="badge badge-outline badge-xs text-[10px]">OSM</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {useFallbackSearch && (
          <div className="alert alert-info mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>Using OpenStreetMap suggestions while Google Places is unavailable.</span>
            <button type="button" className="btn btn-xs" onClick={disableFallbackSearch}>
              Retry Google
            </button>
          </div>
        )}

        {!useFallbackSearch && autocompleteError && (
          <div className="alert alert-warning mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>
              {refererBlocked
                ? 'Google Places blocked this localhost origin. Add the port to your API key or switch to the fallback search below.'
                : 'Google Places is unavailable. You can keep typing, drop a pin, or switch to the fallback search.'}
            </span>
            <button type="button" className="btn btn-xs" onClick={enableFallbackSearch}>
              Use fallback search
            </button>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button className="btn btn-primary" onClick={getCurrentLocation} disabled={isLocating}>
            {isLocating ? 'Locating…' : 'Use current location'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowMapPicker((s) => !s)}>
            {showMapPicker ? 'Hide map' : 'Pick from map'}
          </button>
        </div>

        {locationError ? (
          <div className="alert alert-error mt-3">
            <span>{locationError}</span>
          </div>
        ) : null}

        {!ready && !useFallbackSearch && !locationError ? (
          <div className="alert alert-info mt-3">
            <span>
              {showLoadingTimeout
                ? 'Location search is taking longer than expected. Try using "Current location" or "Pick from map" instead.'
                : 'Loading location search service...'}
            </span>
          </div>
        ) : null}

        {confirmLocate ? (
          <div className="alert mt-3">
            <span>Allow your browser to access location to auto-detect your position.</span>
          </div>
        ) : null}

        {showMapPicker ? (
          <div className="mt-3 rounded-box overflow-hidden ring-1 ring-base-300/60">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="loading loading-spinner loading-lg"></span></div>}>
              <MapPicker homeLocation={homeLocation || undefined} onSelect={handleMapSelect} />
            </Suspense>
          </div>
        ) : null}

        {recent?.length ? (
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Recent</div>
            <div className="flex flex-wrap gap-2">
              {recent.map((r, i) => (
                <button
                  key={`${r.name}-${i}`}
                  className="btn btn-sm btn-outline rounded-full"
                  onClick={() => handleRecentClick(r)}
                  aria-label={`Use recent location ${r.name}`}
                >
                  <span className="truncate max-w-[14rem]">{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(selectedCoords && selectedName) ? (
          <div className="mt-3 text-sm opacity-80">
            Selected: <span className="font-medium">{selectedName}</span>
            <span className="ml-2 badge badge-ghost">{selectedCoords.lat.toFixed(4)}, {selectedCoords.lon.toFixed(4)}</span>
          </div>
        ) : null}

        <div className="modal-action mt-6">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
      {open ? (
        <style>{`
          .pac-container { display: none !important; }
        `}</style>
      ) : null}
    </div>,
    document.body
  );
};

export default CoastalLocationDialog;