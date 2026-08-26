// components/MapPicker.tsx
'use client';

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

export interface MapPickerCoords {
  lat: number;
  lon: number;
}

export interface MapPickerSearchResult {
  label: string;
  lat: number;
  lon: number;
}

export interface MapPickerProps {
  /**
   * The currently selected point, or null if nothing is selected yet. The pin is
   * drawn as soon as this is non-null — the user does not have to click first,
   * which is the whole point of a picker that can show an *existing* location.
   *
   * This is a controlled prop: clicking or dragging fires `onChange` and nothing
   * else. If the parent does not feed the new coordinates back in, the pin
   * springs back to `value`.
   */
  value: MapPickerCoords | null;
  /** Fired when the user clicks the map, drags the pin, or picks a search result. */
  onChange: (lat: number, lon: number) => void;
  /**
   * Radius in metres of the accuracy circle drawn around the pin. Pass the
   * `coords.accuracy` a geolocation fix came with so the user can see how loose
   * it is — a browser fix on a desktop is routinely tens of kilometres out.
   */
  accuracyM?: number | null;
  /** Where to centre when `value` is null. Defaults to a world view. */
  defaultCenter?: MapPickerCoords;
  /** Zoom used for a located pin. Defaults to 13 (roughly a neighbourhood). */
  zoom?: number;
  /** Height of the map itself; a bare number is treated as px. Defaults to 400. */
  height?: string | number;
  /**
   * Optional place lookup. When supplied a search box is rendered; when omitted
   * there is no search UI at all.
   *
   * 🔴 This component NEVER geocodes. The lookup is injected because the app is
   * expected to run it through its own server route with a server-only key: a
   * geocoding key in a browser bundle is a billable credential behind nothing
   * but referrer checks. Hardcoding a provider here would also force every
   * consumer onto it. The component owns the input and the result list; the app
   * owns the request.
   *
   * Reject the promise to signal failure — the component shows a recoverable
   * error and leaves the map usable.
   */
  searchPlace?: (query: string) => Promise<MapPickerSearchResult[]>;
  /** Applied to the outermost element, so the app controls spacing and borders. */
  className?: string;
  /** Accessible name for the map region. */
  ariaLabel?: string;
  /** Placeholder and accessible name for the search box. */
  searchPlaceholder?: string;
  /** Pin colour, so the pin can match the host app. Any CSS colour keyword or hex. */
  markerColor?: string;
}

/**
 * 🔴 Leaflet touches `window` at module scope — `import 'leaflet'` throws
 * `window is not defined` in Node, full stop. `src/index.ts` re-exports
 * `MapPicker`, and this package's index is imported by server code (findr has
 * eight API routes doing it), so the Leaflet half has to stay behind a dynamic
 * import. A static one would hoist `import 'leaflet'` into `dist/index.mjs` and
 * take down every server-side consumer of the package.
 *
 * `splitting: true` in tsup.config.ts is what turns this into its own chunk.
 */
const MapPickerMap = lazy(() => import('./MapPickerMap'));

const DEFAULT_HEIGHT = 400;

function toCssHeight(height: string | number): string {
  return typeof height === 'number' ? `${height}px` : height;
}

/**
 * A map location picker: OpenStreetMap tiles, one draggable pin, and an optional
 * injected place search.
 *
 * The app owns two things this component deliberately does not:
 *
 *   1. The stylesheet. `import 'leaflet/dist/leaflet.css'` belongs in the app,
 *      not in a library — importing it here would drag CSS into every bundle
 *      that touches this package, including ones that never render a map.
 *   2. The tile hosts' place in the CSP. Tiles are images from
 *      `{a,b,c}.tile.openstreetmap.org`; if `img-src` omits them the map renders
 *      grey and nothing throws.
 *
 * Next.js (pages router):
 *
 *   const MapPicker = dynamic(
 *     () => import('@dovieandi-se-tovya-sagain/godaisy-core').then((m) => m.MapPicker),
 *     { ssr: false },
 *   );
 */
export function MapPicker(props: MapPickerProps) {
  const { className, height = DEFAULT_HEIGHT } = props;

  // The lazy chunk must not be requested while rendering on the server either,
  // so nothing map-shaped renders until we are demonstrably in a browser. That
  // makes the component safe whether or not the consumer wraps it in
  // `dynamic(..., { ssr: false })`, and it reserves the layout height either way.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const placeholder = (
    <div className={className}>
      <div
        className="flex items-center justify-center bg-base-200 rounded-box"
        style={{ height: toCssHeight(height), width: '100%' }}
      >
        <span className="loading loading-spinner loading-lg" />
      </div>
    </div>
  );

  if (!mounted) return placeholder;

  return (
    <Suspense fallback={placeholder}>
      <MapPickerMap {...props} />
    </Suspense>
  );
}

/**
 * @deprecated Legacy prop shape, kept only so `CoastalLocationDialog` keeps
 * working against `lazy(() => import('./MapPicker'))` — it is the one in-repo
 * consumer and it was written against the click-to-place-only first draft.
 * New code should use the named `MapPicker` export with `value`/`onChange`.
 *
 * `className="map-picker-container"` is not decoration: findr's globals.css
 * sizes `.map-picker-container .leaflet-container` at 400px, and dropping the
 * class would silently change that dialog's layout.
 */
export interface LegacyMapPickerProps {
  homeLocation?: MapPickerCoords;
  onSelect: (lat: number, lon: number) => void;
}

/** @deprecated See {@link LegacyMapPickerProps}. Use the named `MapPicker` export. */
function LegacyMapPicker({ homeLocation, onSelect }: LegacyMapPickerProps) {
  const [picked, setPicked] = useState<MapPickerCoords | null>(null);

  const handleChange = useCallback(
    (lat: number, lon: number) => {
      setPicked({ lat, lon });
      onSelect(lat, lon);
    },
    [onSelect],
  );

  return (
    <MapPicker
      value={picked}
      onChange={handleChange}
      defaultCenter={homeLocation}
      zoom={8}
      height={400}
      className="map-picker-container"
    />
  );
}

export default LegacyMapPicker;
