/**
 * Multi-Location System Types
 *
 * Supports multiple named locations across Go Daisy and Findr with latest-wins
 * conflict resolution. Locations are stored in user_location_preferences.locations
 * as a JSONB array.
 */

/**
 * Location slot types (predefined + extensible)
 * - home: Primary home location (Go Daisy general activities)
 * - coastal: Coastal location (Go Daisy water activities)
 * - findr: Primary fishing spot (Findr)
 * - custom: User-created slots (future: "work", "vacation", etc.)
 */
export type LocationSlot = 'home' | 'coastal' | 'findr' | 'custom';

/**
 * Location source indicates how the location was obtained
 */
export type LocationSource = 'manual' | 'gps' | 'ip' | 'auto' | 'unknown';

/**
 * A saved location with all metadata
 */
export interface SavedLocation {
  /** Unique identifier (UUID) for stable references */
  id: string;

  /** Which "slot" this location fills (home, coastal, etc.) */
  slot: LocationSlot;

  /** User-friendly display name */
  name: string;

  /** Latitude (WGS84) */
  lat: number;

  /** Longitude (WGS84) */
  lon: number;

  /** ICES rectangle code (e.g., "31F1") - null for non-European locations */
  rectangleCode: string | null;

  /** Human-readable region name (e.g., "English Channel") */
  rectangleRegion: string | null;

  /** GPS accuracy in meters (null if unknown) */
  accuracy: number | null;

  /** How the location was obtained */
  source: LocationSource;

  /** ISO timestamp of last update */
  updatedAt: string;

  /** Usage counter for popularity tracking (used for auto-cleanup) */
  usageCount: number;

  /** Extensible metadata for future features */
  metadata?: Record<string, unknown>;
}

/**
 * Multi-location state stored in database
 */
export interface MultiLocationState {
  /** Array of all saved locations */
  locations: SavedLocation[];

  /** ID of currently active location (references locations[].id) */
  activeLocationId: string | null;

  /** Most recently modified slot (used for cross-app sync hints) */
  lastModifiedSlot: LocationSlot | null;
}

/**
 * Input for creating/updating a location
 */
export interface UpdateLocationInput {
  /** If provided, update existing location with this ID */
  id?: string;

  /** Required: which slot to create/update */
  slot: LocationSlot;

  /** Coordinates (required for new locations) */
  coordinates?: { lat: number; lon: number };

  /** Display name (auto-generated if not provided) */
  name?: string;

  /** If true, automatically fetch ICES rectangle for European waters */
  resolveRectangle?: boolean;

  /** How the location was obtained */
  source?: LocationSource;

  /** GPS accuracy in meters */
  accuracy?: number | null;

  /** If true, set this location as active after update */
  makeActive?: boolean;

  /** Optional rectangle code (if already known) */
  rectangleCode?: string | null;

  /** Optional region name (if already known) */
  rectangleRegion?: string | null;

  /** Optional label (if already known) */
  rectangleLabel?: string | null;

  /** Extensible metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context value for multi-location management
 */
export interface MultiLocationContextValue {
  // Current state
  /** All saved locations */
  locations: SavedLocation[];

  /** Currently active location (null if none selected) */
  activeLocation: SavedLocation | null;

  // Slot-based accessors (convenience)
  /** Get location by slot name */
  getLocationBySlot: (slot: LocationSlot) => SavedLocation | null;

  /** Home location (slot="home") */
  homeLocation: SavedLocation | null;

  /** Coastal location (slot="coastal") */
  coastalLocation: SavedLocation | null;

  /** Findr fishing location (slot="findr") */
  findrLocation: SavedLocation | null;

  // Actions
  /** Set active location by ID */
  setActiveLocation: (locationId: string) => Promise<void>;

  /** Create or update a location by slot */
  updateLocation: (input: UpdateLocationInput) => Promise<SavedLocation>;

  /** Delete a location by ID */
  deleteLocation: (locationId: string) => Promise<void>;

  /** Clear all locations */
  clearAllLocations: () => Promise<void>;

  /** Refresh locations from server */
  refreshRemote: () => Promise<void>;

  // Metadata
  /** Loading state (initial fetch) */
  loading: boolean;

  /** Syncing state (background sync to database) */
  syncing: boolean;

  /** Last error message (null if no error) */
  lastError: string | null;

  /** True if local changes haven't been synced to server yet */
  pendingSync: boolean;
}

/**
 * Legacy UnifiedLocationRecord for backward compatibility
 * @deprecated Use SavedLocation with slots instead
 */
export interface LegacyUnifiedLocationRecord {
  lat: number | null;
  lon: number | null;
  rectangleCode: string | null;
  rectangleRegion: string | null;
  rectangleLabel: string | null;
  source: LocationSource;
  accuracy: number | null;
  updatedAt: string;
  pendingSync?: boolean;
}

/**
 * Helper: Convert SavedLocation to legacy format
 */
export function toLegacyFormat(location: SavedLocation | null): LegacyUnifiedLocationRecord | null {
  if (!location) return null;

  return {
    lat: location.lat,
    lon: location.lon,
    rectangleCode: location.rectangleCode,
    rectangleRegion: location.rectangleRegion,
    rectangleLabel: location.name,
    source: location.source,
    accuracy: location.accuracy,
    updatedAt: location.updatedAt,
  };
}

/**
 * Helper: Convert legacy format to SavedLocation
 */
export function fromLegacyFormat(
  legacy: LegacyUnifiedLocationRecord,
  slot: LocationSlot = 'home'
): SavedLocation {
  return {
    id: crypto.randomUUID(),
    slot,
    name: legacy.rectangleLabel ?? 'Saved Location',
    lat: legacy.lat ?? 0,
    lon: legacy.lon ?? 0,
    rectangleCode: legacy.rectangleCode,
    rectangleRegion: legacy.rectangleRegion,
    accuracy: legacy.accuracy,
    source: legacy.source,
    updatedAt: legacy.updatedAt,
    usageCount: 1,
  };
}
