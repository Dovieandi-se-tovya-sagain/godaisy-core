// components/MapPickerMap.tsx
'use client';

/**
 * The Leaflet half of <MapPicker />.
 *
 * 🔴 Never import this module statically from anywhere reachable from
 * `src/index.ts` — Leaflet reads `window` at module scope and throws in Node.
 * `MapPicker.tsx` pulls it in with `lazy()` for exactly that reason.
 *
 * Apps import `leaflet/dist/leaflet.css` themselves; a library must not.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, DomEvent, type LatLngExpression, type Marker as LeafletMarker } from 'leaflet';
import type { MapPickerCoords, MapPickerProps, MapPickerSearchResult } from './MapPicker';

const DEFAULT_ZOOM = 13;
const DEFAULT_HEIGHT = 400;
const DEFAULT_MARKER_COLOR = '#166534';
const MIN_QUERY_LENGTH = 2;

/** Where to look when there is no location at all: the whole world, so the user can navigate. */
const WORLD_CENTER: MapPickerCoords = { lat: 20, lon: 0 };
const WORLD_ZOOM = 2;

const PIN_WIDTH = 24;
const PIN_HEIGHT = 34;

/**
 * Leaflet renders `html` as raw markup, so the one interpolated value is checked
 * against a colour-shaped pattern rather than trusted. Hex and keyword forms
 * only — `rgb()` and `var()` fall back to the default rather than widen this.
 */
const CSS_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+)$/i;

function safeColor(color: string): string {
  return CSS_COLOR.test(color) ? color : DEFAULT_MARKER_COLOR;
}

/**
 * 🔴 An inline SVG in a `divIcon`, NOT an image URL — and it must stay that way.
 *
 * The usual Leaflet "fix" copied around this org deletes
 * `L.Icon.Default._getIconUrl` and points `iconUrl` at cdnjs. Consuming apps run
 * a CSP whose `img-src` does not list that host, so those markers load happily
 * on localhost (`next dev` never applies the production CSP) and then silently
 * fail to render once deployed. An inline SVG issues no request at all: nothing
 * to allow, nothing to block, no third party in the render path.
 */
function createPinIcon(fill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 24 34" aria-hidden="true" focusable="false">`
    + `<path d="M12 33.2S22.4 20.2 22.4 12.4C22.4 6.1 17.7 1 12 1S1.6 6.1 1.6 12.4C1.6 20.2 12 33.2 12 33.2z" fill="${fill}" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<circle cx="12" cy="12.2" r="4.1" fill="#ffffff"/>`
    + `</svg>`;

  return divIcon({
    html: svg,
    // Leaflet's default `leaflet-div-icon` class paints a white box with a
    // border behind the content; a class of our own removes it.
    className: 'godaisy-map-pin',
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT - 1],
  });
}

function toCssHeight(height: string | number): string {
  return typeof height === 'number' ? `${height}px` : height;
}

/** Turns a map click into a selection. Must live inside <MapContainer>. */
function ClickToPlace({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Recentres when `value` changes from outside — the app's "use my location"
 * button, a search result, a saved garden loading in.
 *
 * The rule is deliberately narrow: move only when the selected point is not
 * already visible. Panning belongs to the user, and a picker that yanks the view
 * back on every re-render is unusable. It also means we do not care whether the
 * app rounds the coordinates it echoes back (see COORDINATE_PRECISION in
 * lib/utils/coordinates) — a few metres of drift never leaves the viewport.
 *
 * The exception is the first pin: with no location the map starts at world zoom,
 * where "already visible" is true of everywhere on earth.
 */
function RecentreOnValue({ lat, lon, zoom }: { lat?: number; lon?: number; zoom: number }) {
  const map = useMap();
  const hadValueRef = useRef(lat !== undefined && lon !== undefined);

  useEffect(() => {
    if (lat === undefined || lon === undefined) {
      hadValueRef.current = false;
      return;
    }

    const isFirstPin = !hadValueRef.current;
    hadValueRef.current = true;

    const target: LatLngExpression = [lat, lon];
    if (!isFirstPin && map.getBounds().contains(target)) return;

    map.setView(target, Math.max(map.getZoom(), zoom), { animate: !isFirstPin });
  }, [map, lat, lon, zoom]);

  return null;
}

/**
 * Leaflet caches its container size, so a map that mounts inside something
 * hidden (a modal, a collapsed panel) renders as grey tiles until told to
 * remeasure. The observer is disconnected on unmount.
 */
function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

type SearchStatus = 'idle' | 'searching' | 'empty' | 'error';

function PlaceSearch({
  searchPlace,
  placeholder,
  onSelect,
}: {
  searchPlace: (query: string) => Promise<MapPickerSearchResult[]>;
  placeholder: string;
  onSelect: (result: MapPickerSearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapPickerSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const requestRef = useRef(0);

  // Bumping the id on unmount makes any in-flight lookup stale, so a late
  // resolution cannot write state into a component that is gone.
  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const runSearch = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) return;

      // Searching on submit, not per keystroke: `searchPlace` is a real network
      // round trip through the app's own server, and a text input's onChange
      // fires on every character — including the half-typed ones.
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setStatus('searching');
      setResults([]);

      try {
        const found = await searchPlace(trimmed);
        if (requestRef.current !== requestId) return;
        setResults(found);
        setStatus(found.length > 0 ? 'idle' : 'empty');
      } catch (error) {
        if (requestRef.current !== requestId) return;
        console.warn('[MapPicker] Place search failed', error);
        setResults([]);
        setStatus('error');
      }
    },
    [query, searchPlace],
  );

  const handleSelect = useCallback(
    (result: MapPickerSearchResult) => {
      setResults([]);
      setStatus('idle');
      setQuery(result.label);
      onSelect(result);
    },
    [onSelect],
  );

  return (
    <div className="mb-2">
      <form className="flex gap-2" onSubmit={runSearch} role="search">
        <input
          type="search"
          className="input input-bordered input-sm w-full"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <button
          type="submit"
          className="btn btn-sm"
          disabled={status === 'searching' || query.trim().length < MIN_QUERY_LENGTH}
        >
          {status === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {status === 'error' ? (
        <p className="text-xs text-error mt-1" role="status">
          Place search is unavailable right now. You can still drop a pin on the map.
        </p>
      ) : null}

      {status === 'empty' ? (
        <p className="text-xs opacity-70 mt-1" role="status">
          No matching places.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="menu bg-base-100 rounded-box shadow mt-1 max-h-48 overflow-y-auto flex-nowrap" aria-label="Search results">
          {results.map((result) => (
            <li key={`${result.lat},${result.lon},${result.label}`}>
              <button type="button" className="text-left" onClick={() => handleSelect(result)}>
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function MapPickerMap({
  value,
  onChange,
  accuracyM,
  defaultCenter,
  zoom = DEFAULT_ZOOM,
  height = DEFAULT_HEIGHT,
  searchPlace,
  className,
  ariaLabel = 'Map location picker',
  searchPlaceholder = 'Search for a place',
  markerColor = DEFAULT_MARKER_COLOR,
}: MapPickerProps) {
  // Validated once so the pin and the accuracy circle cannot disagree about the
  // colour when a consumer passes something the SVG cannot carry.
  const pinColor = safeColor(markerColor);
  const icon = useMemo(() => createPinIcon(pinColor), [pinColor]);
  const markerRef = useRef<LeafletMarker | null>(null);

  // <MapContainer> reads center and zoom once, on mount; every later move goes
  // through <RecentreOnValue />.
  const initialPoint = value ?? defaultCenter ?? WORLD_CENTER;
  const initialCenter: LatLngExpression = [initialPoint.lat, initialPoint.lon];
  const initialZoom = value || defaultCenter ? zoom : WORLD_ZOOM;

  const handleDragEnd = useCallback(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const { lat, lng } = marker.getLatLng();
    onChange(lat, lng);
  }, [onChange]);

  const handleSearchSelect = useCallback(
    (result: MapPickerSearchResult) => {
      onChange(result.lat, result.lon);
    },
    [onChange],
  );

  return (
    <div className={className}>
      {searchPlace ? (
        <PlaceSearch
          searchPlace={searchPlace}
          placeholder={searchPlaceholder}
          onSelect={handleSearchSelect}
        />
      ) : null}

      <div role="group" aria-label={ariaLabel} style={{ height: toCssHeight(height), width: '100%' }}>
        <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {value && accuracyM != null && accuracyM > 0 ? (
            <Circle
              center={[value.lat, value.lon]}
              radius={accuracyM}
              // Non-interactive, or a wide accuracy circle would swallow every
              // click meant for the map underneath it.
              interactive={false}
              pathOptions={{
                color: pinColor,
                weight: 1,
                opacity: 0.6,
                fillColor: pinColor,
                fillOpacity: 0.12,
              }}
            />
          ) : null}

          {value ? (
            <Marker
              ref={markerRef}
              position={[value.lat, value.lon]}
              icon={icon}
              draggable
              autoPan
              title="Selected location — drag to move"
              eventHandlers={{
                dragend: handleDragEnd,
                // A click on the pin otherwise reaches the map's click handler
                // too, and the pin's anchor is its tip — so clicking the head
                // would shunt the pin a few metres north of where it already is.
                click: (event) => DomEvent.stopPropagation(event.originalEvent),
              }}
            />
          ) : null}

          <ClickToPlace onPick={onChange} />
          <RecentreOnValue lat={value?.lat} lon={value?.lon} zoom={zoom} />
          <InvalidateOnResize />
        </MapContainer>
      </div>

      <p className="text-xs opacity-70 mt-1">
        {value ? 'Drag the pin, or click elsewhere, to move it.' : 'Click the map to drop a pin.'}
      </p>
    </div>
  );
}
