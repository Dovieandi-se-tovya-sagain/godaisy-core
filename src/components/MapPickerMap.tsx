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

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, DomEvent, type LatLngExpression, type Marker as LeafletMarker } from 'leaflet';
import type { MapPickerCoords, MapPickerProps, MapPickerSearchResult } from './MapPicker';

const DEFAULT_ZOOM = 13;
const DEFAULT_HEIGHT = 400;
const DEFAULT_MARKER_COLOR = '#166534';
const MIN_QUERY_LENGTH = 2;

/**
 * How long the box waits for typing to stop before it looks anything up.
 *
 * 🔴 This is a COMPLIANCE FLOOR, not a UX preference. Do not tune it down
 * because type-ahead "feels sluggish".
 *
 * Consumers resolve `searchPlace` through Nominatim, whose usage policy sets an
 * **absolute maximum of one request per second** and whose penalty for
 * exceeding it is blocking the application — search would disappear for every
 * user at once. Worse, the app's own geocoding route enforces that spacing by
 * *waiting* rather than by rejecting, so a burst of keystroke-triggered lookups
 * does not fail fast: it queues, and each answer lands a second after the one
 * before it. Undebounced type-ahead would be non-compliant and feel broken at
 * the same time.
 */
const SEARCH_DEBOUNCE_MS = 500;

/**
 * The hard floor between two dispatched lookups.
 *
 * The debounce alone does **not** bound the request rate, which is the trap
 * here: a hunt-and-peck typist leaving a little over SEARCH_DEBOUNCE_MS between
 * characters fires one lookup per character — close to two per second, i.e.
 * double the ceiling, from entirely ordinary typing. This gate is what actually
 * holds the 1 req/sec property. A lookup that comes due too early is delayed to
 * the end of the window rather than dropped, so the user's final query always
 * runs.
 */
const MIN_SEARCH_INTERVAL_MS = 1000;

/**
 * Visually hidden, but still announced.
 *
 * An inline style rather than Tailwind's `sr-only`, because a library cannot
 * assume its own `dist/` is in the consuming app's Tailwind `content` globs —
 * Grow Daisy's, for one, is not. A utility class that fails to generate here
 * would not degrade quietly: the result count would render as visible text
 * under the search box.
 */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Trims, and collapses internal runs of whitespace, so that "Berwick  upon
 * Tweed " and "Berwick upon Tweed" are one query rather than two. Used both for
 * the value sent and for the "have we already searched this?" comparison, so a
 * stray space can never buy a request.
 */
function normaliseQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

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

/**
 * The search box: a debounced type-ahead combobox over an injected geocoder.
 *
 * Three guards stand between the user's keyboard and the geocoder, and they are
 * not interchangeable:
 *
 *   1. **The debounce** (SEARCH_DEBOUNCE_MS) waits for typing to stop.
 *   2. **The rate floor** (MIN_SEARCH_INTERVAL_MS) spaces whatever survives it,
 *      because the debounce on its own does not bound the rate.
 *   3. **`AbortController` + the request id** deal with what is already on the
 *      wire — the first stops the request, the second stops its answer being
 *      rendered if the abort loses the race or the consumer ignores the signal.
 */
function PlaceSearch({
  searchPlace,
  placeholder,
  onSelect,
}: {
  searchPlace: (query: string, signal?: AbortSignal) => Promise<MapPickerSearchResult[]>;
  placeholder: string;
  onSelect: (result: MapPickerSearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapPickerSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [isOpen, setIsOpen] = useState(false);
  /**
   * Index of the keyboard-highlighted option, or -1 for none.
   *
   * 🔴 Results always arrive at -1, deliberately. Auto-highlighting the first
   * hit would mean an Enter aimed at "search again" moves the user's garden pin
   * to whatever Nominatim happened to rank first — the same class of mistake as
   * a form submitting when nobody asked it to.
   */
  const [highlighted, setHighlighted] = useState(-1);

  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  /** When the last lookup was *dispatched* — the rate floor measures from here. */
  const lastDispatchAtRef = useRef(0);
  /** The last query we actually hold an answer for, normalised. */
  const lastQueryRef = useRef('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const baseId = useId();
  const listId = `${baseId}-places`;
  const optionId = (index: number) => `${baseId}-place-${index}`;

  const cancelPending = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  /**
   * Makes any lookup already on the wire irrelevant, both ways round.
   *
   * `abort()` stops the request itself, which matters because the geocoding
   * route spaces its upstream calls by *waiting*: a request nobody will read
   * still occupies a slot in the one-per-second budget until it is cancelled.
   * Bumping the request id is the belt to that braces — it discards the
   * *answer* of anything the abort loses a race with, and of any consumer whose
   * `searchPlace` ignores the signal it was handed.
   */
  const supersede = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestRef.current += 1;

    if (!inFlightRef.current) return;
    inFlightRef.current = false;
    // What we just cancelled never produced an answer, so it must not count as
    // "already searched" — otherwise Enter on the same text would keep
    // re-opening an empty list and never retry.
    lastQueryRef.current = '';
  }, []);

  const dispatchSearch = useCallback(
    async (normalised: string) => {
      supersede();

      const controller = new AbortController();
      abortRef.current = controller;
      // `supersede` has just bumped this, so it is our id.
      const requestId = requestRef.current;
      inFlightRef.current = true;
      lastQueryRef.current = normalised;
      lastDispatchAtRef.current = Date.now();

      setStatus('searching');
      setHighlighted(-1);
      setIsOpen(true);

      try {
        const found = await searchPlace(normalised, controller.signal);
        if (requestRef.current !== requestId) return;
        inFlightRef.current = false;
        setResults(found);
        // Batched with `setResults` so the two can never disagree. Without it a
        // pointer resting on option 9 of the previous list would still be
        // highlighting index 9 of a list that just came back with three items.
        setHighlighted(-1);
        setStatus(found.length > 0 ? 'idle' : 'empty');
        setIsOpen(true);
      } catch (error) {
        if (requestRef.current !== requestId) return;
        inFlightRef.current = false;
        // A failed lookup is not an answer: clearing this lets the user retry
        // the identical query instead of hitting the de-duplication guard.
        lastQueryRef.current = '';
        console.warn('[MapPicker] Place search failed', error);
        setResults([]);
        setStatus('error');
      }
    },
    [searchPlace, supersede],
  );

  /**
   * Queues a lookup, or declines to spend one.
   *
   * `immediate` skips the type-ahead debounce — Enter and the Search button are
   * an explicit "go now", and a keyboard user should not have to sit out a
   * timer — but it does **not** skip the rate floor, which is not ours to skip.
   */
  const scheduleSearch = useCallback(
    (raw: string, { immediate = false }: { immediate?: boolean } = {}) => {
      cancelPending();

      const normalised = normaliseQuery(raw);
      if (normalised.length < MIN_QUERY_LENGTH) return;

      if (normalised === lastQueryRef.current && (!immediate || results.length > 0)) {
        // Already answered. Typing something only whitespace-different from the
        // last search must never cost a request; an explicit Enter may retry,
        // but only once we are no longer holding the results.
        setIsOpen(true);
        return;
      }

      const sinceLastDispatch = Date.now() - lastDispatchAtRef.current;
      const rateFloor = Math.max(0, MIN_SEARCH_INTERVAL_MS - sinceLastDispatch);
      const delay = immediate ? rateFloor : Math.max(SEARCH_DEBOUNCE_MS, rateFloor);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void dispatchSearch(normalised);
      }, delay);
    },
    [cancelPending, dispatchSearch, results.length],
  );

  /** Closes the list and stops anything pending or in flight. Leaves the query alone. */
  const dismiss = useCallback(() => {
    cancelPending();
    supersede();
    setIsOpen(false);
    setHighlighted(-1);
    setStatus((current) => (current === 'searching' ? 'idle' : current));
  }, [cancelPending, supersede]);

  const handleSelect = useCallback(
    (result: MapPickerSearchResult) => {
      cancelPending();
      supersede();
      setResults([]);
      setStatus('idle');
      setIsOpen(false);
      setHighlighted(-1);
      setQuery(result.label);
      // The box now holds the label of a place we have already resolved. Recorded
      // *after* `supersede`, which clears this ref when it kills a live request.
      lastQueryRef.current = normaliseQuery(result.label);
      onSelect(result);
    },
    [cancelPending, supersede, onSelect],
  );

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setQuery(raw);

      if (normaliseQuery(raw).length < MIN_QUERY_LENGTH) {
        // Below the floor there is nothing to look up, and leaving yesterday's
        // list hanging over an emptied box is worse than closing it.
        cancelPending();
        supersede();
        setResults([]);
        setStatus('idle');
        setIsOpen(false);
        setHighlighted(-1);
        lastQueryRef.current = '';
        return;
      }

      scheduleSearch(raw);
    },
    [cancelPending, scheduleSearch, supersede],
  );

  const runSearch = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      /**
       * 🔴 `stopPropagation` is NOT redundant beside `preventDefault`, and
       * leaving it out was a real bug found by the first consumer.
       *
       * `preventDefault` stops *this* form navigating. It does nothing about
       * the event continuing to bubble — and React replays a submit up the
       * component tree, so a host that renders `MapPicker` inside its own
       * `<form>` gets that form's `onSubmit` fired by our Search button, or by
       * a bare Enter in the search box.
       *
       * In Grow Daisy the surrounding form **saves the gardener's garden
       * coordinates**. So pressing "Search" wrote the very location the user
       * was searching to correct. A host cannot defend against this: the
       * offending button is ours, so no amount of `type="button"` discipline
       * on their side reaches it.
       *
       * A component that renders a `<form>` is responsible for keeping its
       * submits to itself. `handleKeyDown` repeats both calls for the Enter
       * that picks a highlighted option, which never reaches this handler.
       */
      event.stopPropagation();
      scheduleSearch(query, { immediate: true });
    },
    [query, scheduleSearch],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const { key } = event;

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        if (results.length === 0) return;
        // Otherwise the caret jumps to one end of the text as well.
        event.preventDefault();

        if (!isOpen) {
          setIsOpen(true);
          setHighlighted(key === 'ArrowDown' ? 0 : results.length - 1);
          return;
        }

        setHighlighted((current) => {
          if (current < 0) return key === 'ArrowDown' ? 0 : results.length - 1;
          const next = key === 'ArrowDown' ? current + 1 : current - 1;
          return (next + results.length) % results.length;
        });
        return;
      }

      if (key === 'Enter') {
        // Nothing highlighted: fall through to the form's own submit, which
        // searches immediately.
        const choice = isOpen && highlighted >= 0 ? results[highlighted] : undefined;
        if (!choice) return;
        event.preventDefault();
        event.stopPropagation();
        handleSelect(choice);
        return;
      }

      if (key === 'Escape') {
        // Closed already: let it bubble. A host's modal-closing Escape is not
        // ours to swallow.
        if (!isOpen) return;
        /**
         * 🔴 `preventDefault` is load-bearing on `<input type="search">`:
         * Chrome and Safari clear the field on Escape, and Escape here means
         * "close the list", leaving the query the user typed intact.
         */
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    },
    [results, isOpen, highlighted, handleSelect, dismiss],
  );

  const isExpanded = isOpen && results.length > 0;

  // Bumping the id on unmount makes any in-flight lookup stale, so a late
  // resolution cannot write state into a component that is gone; the abort and
  // the cleared timer stop the work happening at all.
  useEffect(
    () => () => {
      cancelPending();
      supersede();
    },
    [cancelPending, supersede],
  );

  useEffect(() => {
    if (!isOpen) return;

    // `mousedown`, not `click`: a `click` listener would fire after the pointer
    // had already moved focus, and on touch the list must close on the press.
    // Anything inside our own container — an option, the input, the button — is
    // not "outside", so this cannot race with a selection.
    const handleOutside = (event: Event) => {
      const container = containerRef.current;
      if (!container || container.contains(event.target as Node)) return;
      dismiss();
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen, dismiss]);

  // The list scrolls once it passes max-h-48, so arrowing past the fold has to
  // bring the highlighted option with it. Focus never leaves the input, which is
  // why the browser will not do this for us.
  useEffect(() => {
    if (highlighted < 0) return;
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  /**
   * One always-mounted live region, carrying result counts as well as the two
   * visible messages.
   *
   * Mounting it up front is the point: a region that appears at the same moment
   * as its text is routinely missed, because there was no region to observe when
   * the text arrived. Counts share it rather than getting a second region of
   * their own, so the two can never talk over each other.
   */
  const announcement = useMemo(() => {
    if (status === 'error') {
      return 'Place search is unavailable right now. You can still drop a pin on the map.';
    }
    if (status === 'empty') return 'No matching places.';
    if (isExpanded) {
      return `${results.length} ${results.length === 1 ? 'place' : 'places'} found.`
        + ' Use the up and down arrow keys to review them, then Enter to choose.';
    }
    return '';
  }, [status, isExpanded, results.length]);

  const isMessageVisible = status === 'error' || status === 'empty';

  return (
    <div className="mb-2" ref={containerRef}>
      <form className="flex gap-2" onSubmit={runSearch} role="search">
        <input
          type="search"
          role="combobox"
          className="input input-bordered input-sm w-full"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={isExpanded}
          // Only while the listbox is actually mounted — a permanent
          // `aria-controls` would be a dangling IDREF for most of the box's life.
          aria-controls={isExpanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={isExpanded && highlighted >= 0 ? optionId(highlighted) : undefined}
          // Ours is the only list of places that should appear under this box.
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-sm"
          disabled={status === 'searching' || normaliseQuery(query).length < MIN_QUERY_LENGTH}
        >
          {status === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </form>

      <p
        role="status"
        aria-live="polite"
        className={
          isMessageVisible
            ? `text-xs mt-1 ${status === 'error' ? 'text-error' : 'opacity-70'}`
            : undefined
        }
        style={isMessageVisible ? undefined : VISUALLY_HIDDEN}
      >
        {announcement}
      </p>

      {isExpanded ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="menu bg-base-100 rounded-box shadow mt-1 max-h-48 overflow-y-auto flex-nowrap"
        >
          {results.map((result, index) => (
            /**
             * An option, not the <button> this used to be: interactive content
             * inside `role="option"` is invalid ARIA, and it is unnecessary here
             * because the keyboard path never focuses the list — focus stays in
             * the input and `aria-activedescendant` does the pointing.
             *
             * The inner <span> is what DaisyUI's `menu` styles (its rules target
             * any non-list child of an li), which is why `menu-focus` — its own
             * class for exactly this "highlighted but not focused" state — goes
             * there rather than on the option.
             */
            <li
              key={`${result.lat},${result.lon},${result.label}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlighted}
              // `mousedown` rather than `click`, so the selection lands before
              // the outside-press handler and before any focus change can
              // reorder things; the default is prevented to keep focus in the
              // input, where the combobox keys are bound.
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(result);
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              <span className={index === highlighted ? 'menu-focus' : undefined}>
                {result.label}
              </span>
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
