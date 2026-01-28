"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SavedLocation, LocationSlot, LocationSource } from '../lib/multiLocation';
import { toLegacyFormat as convertToLegacy } from '../lib/multiLocation';

/**
 * Legacy format for backward compatibility
 * @deprecated Use SavedLocation with multi-location API instead
 */
export interface UnifiedLocationRecord {
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
 * Legacy update input format (still supported)
 */
export interface UpdateLocationInput {
  coordinates?: { lat: number; lon: number };
  rectangleCode?: string | null;
  rectangleRegion?: string | null;
  rectangleLabel?: string | null;
  source?: LocationSource;
  accuracy?: number | null;
  resolveRectangle?: boolean;
  slot?: LocationSlot; // NEW: Optional slot specification
}

/**
 * Multi-location update input
 */
export interface UpdateLocationBySlotInput {
  slot: LocationSlot;
  coordinates: { lat: number; lon: number };
  name?: string;
  rectangleCode?: string | null;
  rectangleRegion?: string | null;
  source?: LocationSource;
  accuracy?: number | null;
  resolveRectangle?: boolean;
  makeActive?: boolean;
}

interface UnifiedLocationContextValue {
  // Legacy interface (backward compatible)
  location: UnifiedLocationRecord | null;
  updateLocation: (input: UpdateLocationInput) => Promise<UnifiedLocationRecord | null>;
  clearLocation: () => Promise<void>;

  // NEW: Multi-location interface
  locations: SavedLocation[];
  activeLocation: SavedLocation | null;
  homeLocation: SavedLocation | null;
  coastalLocation: SavedLocation | null;
  findrLocation: SavedLocation | null;

  getLocationBySlot: (slot: LocationSlot) => SavedLocation | null;
  updateLocationBySlot: (input: UpdateLocationBySlotInput) => Promise<SavedLocation>;
  setActiveLocation: (locationId: string) => Promise<void>;
  deleteLocation: (locationId: string) => Promise<void>;

  // Shared state
  loading: boolean;
  syncing: boolean;
  lastError: string | null;
  refreshRemote: () => Promise<void>;
}

const UnifiedLocationContext = createContext<UnifiedLocationContextValue | null>(null);

const STORAGE_KEY = 'findr.location.multi';
const LEGACY_STORAGE_KEY = 'findr.location'; // For migration

interface StoredState {
  locations: SavedLocation[];
  activeLocationId: string | null;
}

function readStoredState(): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try migrating from legacy storage
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as UnifiedLocationRecord;
        // Use rectangleLabel as the best available user-friendly name
        const location: SavedLocation = {
          id: crypto.randomUUID(),
          slot: 'home',
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
        return { locations: [location], activeLocationId: location.id };
      }
      return null;
    }
    const parsed = JSON.parse(raw) as StoredState;
    return parsed;
  } catch (error) {
    console.warn('[UnifiedLocation] Failed to read stored state', error);
    return null;
  }
}

function persistState(state: StoredState | null) {
  if (typeof window === 'undefined') return;
  if (!state || state.locations.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY); // Clean up legacy too
    // Also clear from Capacitor Preferences
    persistToNativePreferences(null);
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Also persist in legacy format for backward compatibility
    const active = state.locations.find(loc => loc.id === state.activeLocationId) ?? state.locations[0];
    if (active) {
      const legacy = convertToLegacy(active);
      window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

      // Persist active location to Capacitor Preferences for offline shell access
      persistToNativePreferences(active);
    }
  } catch (error) {
    console.warn('[UnifiedLocation] Failed to persist state', error);
  }
}

/**
 * Persist active location to Capacitor Preferences for offline shell access.
 * This enables the offline shell to know the last-used location.
 */
async function persistToNativePreferences(location: SavedLocation | null) {
  // Only run on native platforms
  if (typeof window === 'undefined') return;

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    const { Preferences } = await import('@capacitor/preferences');

    if (!location) {
      await Preferences.remove({ key: 'findr_offline_location' });
      return;
    }

    const offlineLocation = {
      rectangleCode: location.rectangleCode,
      region: location.rectangleRegion,
      name: location.name,
      lat: location.lat,
      lon: location.lon,
      savedAt: new Date().toISOString(),
    };

    await Preferences.set({
      key: 'findr_offline_location',
      value: JSON.stringify(offlineLocation),
    });

    console.log('[UnifiedLocation] Persisted location to Preferences for offline:', offlineLocation.rectangleCode);
  } catch (error) {
    // Silently ignore - Preferences might not be available
    console.warn('[UnifiedLocation] Failed to persist to Preferences:', error);
  }
}

async function fetchRectangleMetadata(lat: number, lon: number) {
  try {
    const query = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    const res = await fetch(`/api/findr/rectangle-lookup?${query.toString()}`);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(msg?.error || `Rectangle lookup failed (${res.status})`);
    }
    return (await res.json()) as {
      rectangleCode: string;
      region: string;
      centerLat: number;
      centerLon: number;
      distance?: number;
    };
  } catch (error) {
    console.warn('[UnifiedLocation] Failed to resolve rectangle metadata', error);
    throw error;
  }
}

type RemoteUpsertResult =
  | { ok: true; location: SavedLocation }
  | { ok: false; reason: 'unauthorized' };

async function upsertRemoteLocationBySlot(input: UpdateLocationBySlotInput): Promise<RemoteUpsertResult> {
  // Ensure session is fresh before making request (fixes SameSite=Lax cookie issues after OAuth)
  const { createClient } = await import('../lib/supabase/client');
  const supabase = createClient();
  await supabase.auth.getSession();

  const res = await fetch('/api/user/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // Explicitly include cookies
    body: JSON.stringify({
      slot: input.slot,
      name: input.name,
      lat: input.coordinates.lat,
      lon: input.coordinates.lon,
      rectangleCode: input.rectangleCode,
      rectangleRegion: input.rectangleRegion,
      source: input.source ?? 'manual',
      accuracy: input.accuracy,
    }),
  });

  if (res.status === 401) {
    console.warn('[UnifiedLocation] POST failed with 401 despite session refresh');
    return { ok: false, reason: 'unauthorized' };
  }

  if (!res.ok) {
    const message = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(message?.error || `Remote location write failed (${res.status})`);
  }

  const location = (await res.json()) as SavedLocation;
  return { ok: true, location };
}

async function loadRemoteLocations(): Promise<StoredState | null> {
  try {
    const res = await fetch('/api/user/location?multiLocation=true', {
      method: 'GET',
      credentials: 'same-origin' // Explicitly include cookies
    });

    if (res.status === 401) {
      return null;
    }

    if (!res.ok) {
      console.warn('[UnifiedLocation] Remote fetch failed with status:', res.status);
      return null;
    }

    const payload = (await res.json()) as {
      locations: SavedLocation[];
      activeLocationId: string | null;
    };

    return {
      locations: payload.locations ?? [],
      activeLocationId: payload.activeLocationId,
    };
  } catch (error) {
    console.warn('[UnifiedLocation] Remote lookup failed', error);
    return null;
  }
}

async function setRemoteActiveLocation(locationId: string): Promise<void> {
  // For now, we'll implement this by re-saving the location
  // In the future, we could add a dedicated endpoint for this
  const res = await fetch('/api/user/location?multiLocation=true', { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch locations');

  const { locations } = (await res.json()) as { locations: SavedLocation[] };
  const location = locations.find(loc => loc.id === locationId);
  if (!location) throw new Error('Location not found');

  // Re-save to make it active
  await fetch('/api/user/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slot: location.slot,
      name: location.name,
      lat: location.lat,
      lon: location.lon,
      rectangleCode: location.rectangleCode,
      rectangleRegion: location.rectangleRegion,
      source: location.source,
      accuracy: location.accuracy,
    }),
  });
}

async function deleteRemoteLocation(locationId: string): Promise<void> {
  const res = await fetch(`/api/user/location?locationId=${locationId}`, {
    method: 'DELETE',
  });

  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to delete location');
  }
}

export function UnifiedLocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const remoteLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    // Read localStorage first (synchronous, fast)
    const stored = readStoredState();
    if (stored) {
      setLocations(stored.locations);
      setActiveLocationId(stored.activeLocationId);
    }

    // Fetch remote locations (async) - set flag to prevent duplicate calls from refreshRemote
    remoteLoadedRef.current = true;
    void (async () => {
      try {
        const remote = await loadRemoteLocations();
        if (remote && remote.locations.length > 0) {
          // Remote has data - use it and sync to localStorage
          setLocations(remote.locations);
          setActiveLocationId(remote.activeLocationId);
          persistState(remote);
        } else if (remote && !stored) {
          // Remote explicitly returned empty AND we have no local data
          setLocations([]);
          setActiveLocationId(null);
        } else if (!remote && !stored) {
          // Remote failed/unauthorized AND we have no local data
          setLocations([]);
          setActiveLocationId(null);
        }
      } catch (error) {
        console.warn('[UnifiedLocation] Failed to load remote locations on mount', error);
        if (!stored) {
          setLocations([]);
          setActiveLocationId(null);
        }
        // If we have stored data, keep it even if remote fails
      } finally {
        setLoading(false);
        // Reset flag after delay to allow future refreshes
        setTimeout(() => { remoteLoadedRef.current = false; }, 2000);
      }
    })();
  }, []);

  const refreshRemote = useCallback(async () => {
    // Skip if already loading or loaded recently
    if (remoteLoadedRef.current) {
      return;
    }
    // Set flag immediately to prevent concurrent calls
    remoteLoadedRef.current = true;
    
    try {
      const remote = await loadRemoteLocations();
      if (remote) {
        setLocations(remote.locations);
        setActiveLocationId(remote.activeLocationId);
        persistState(remote);
      }
    } finally {
      // Reset flag after a short delay to allow future refreshes
      setTimeout(() => { remoteLoadedRef.current = false; }, 2000);
    }
  }, []);

  const clearLocation = useCallback(async () => {
    setLocations([]);
    setActiveLocationId(null);
    persistState(null);
    setLastError(null);
    try {
      await fetch('/api/user/location', { method: 'DELETE' });
    } catch (error) {
      console.warn('[UnifiedLocation] Remote clear failed', error);
    }
  }, []);

  const updateLocationBySlot = useCallback(
    async (input: UpdateLocationBySlotInput): Promise<SavedLocation> => {
      setSyncing(true);
      setLastError(null);

      // Clear bootstrap flag when user manually updates any location
      // This allows the location to be synced to database on next authentication
      if (typeof window !== 'undefined') {
        localStorage.removeItem('godaisy.bootstrap-applied');
        localStorage.removeItem('godaisy.bootstrap-source');
      }

      try {
        let nextLat = input.coordinates.lat;
        let nextLon = input.coordinates.lon;
        let nextRectangleCode = input.rectangleCode ?? null;
        let nextRectangleRegion = input.rectangleRegion ?? null;
        let nextName = input.name;

        // Resolve ICES rectangle if requested
        if (input.resolveRectangle) {
          try {
            const metadata = await fetchRectangleMetadata(nextLat, nextLon);
            nextRectangleCode = metadata.rectangleCode;
            nextRectangleRegion = metadata.region;
            if (!nextName) {
              nextName = `${metadata.rectangleCode} - ${metadata.region}`;
            }
            nextLat = metadata.centerLat;
            nextLon = metadata.centerLon;
          } catch (_resolveError) {
            console.info('[UnifiedLocation] Rectangle resolution unavailable, using raw coordinates');
          }
        }

        // Always prefer a user-friendly name if provided, fallback to rectangle region, then rectangle code, then 'Saved Location'
        const friendlyName = input.name?.trim() && input.name !== nextRectangleCode ? input.name : null;
        const finalName = friendlyName ?? nextRectangleRegion ?? nextRectangleCode ?? 'Saved Location';

        const updateInput: UpdateLocationBySlotInput = {
          ...input,
          coordinates: { lat: nextLat, lon: nextLon },
          name: finalName,
          rectangleCode: nextRectangleCode,
          rectangleRegion: nextRectangleRegion,
        };

        // Debug logging
        console.log('[UnifiedLocation] Saving location:', {
          name: finalName,
          lat: nextLat,
          lon: nextLon,
          rectangleCode: nextRectangleCode,
          rectangleRegion: nextRectangleRegion,
          accuracy: input.accuracy,
          source: input.source,
          slot: input.slot,
        });

        // Optimistic local update
        const existingIndex = locations.findIndex(loc => loc.slot === input.slot);
        const tempId = existingIndex >= 0 ? locations[existingIndex].id : crypto.randomUUID();
        const optimisticLocation: SavedLocation = {
          id: tempId,
          slot: input.slot,
          name: finalName,
          lat: nextLat,
          lon: nextLon,
          rectangleCode: nextRectangleCode,
          rectangleRegion: nextRectangleRegion,
          accuracy: input.accuracy ?? null,
          source: input.source ?? 'manual',
          updatedAt: new Date().toISOString(),
          usageCount: existingIndex >= 0 ? locations[existingIndex].usageCount + 1 : 1,
        };

        const optimisticLocations = existingIndex >= 0
          ? locations.map((loc, i) => i === existingIndex ? optimisticLocation : loc)
          : [...locations, optimisticLocation];

        setLocations(optimisticLocations);
        if (input.makeActive !== false) {
          setActiveLocationId(optimisticLocation.id);
        }
        persistState({
          locations: optimisticLocations,
          activeLocationId: input.makeActive !== false ? optimisticLocation.id : activeLocationId,
        });

        try {
          const remoteResult = await upsertRemoteLocationBySlot(updateInput);
          if (remoteResult.ok) {
            const remoteLocation = remoteResult.location;
            const syncedLocations = existingIndex >= 0
              ? locations.map((loc, i) => i === existingIndex ? remoteLocation : loc)
              : [...locations.filter(loc => loc.slot !== input.slot), remoteLocation];

            setLocations(syncedLocations);
            if (input.makeActive !== false) {
              setActiveLocationId(remoteLocation.id);
            }
            persistState({
              locations: syncedLocations,
              activeLocationId: input.makeActive !== false ? remoteLocation.id : activeLocationId,
            });
            return remoteLocation;
          }

          setLastError('Sign in to sync your location across devices.');
          return optimisticLocation;
        } catch (error) {
          console.warn('[UnifiedLocation] Remote sync failed', error);
          setLastError((error as Error).message);
          return optimisticLocation;
        }
      } finally {
        setSyncing(false);
      }
    },
    [locations, activeLocationId]
  );

  // Legacy updateLocation method for backward compatibility
  const updateLocation = useCallback(
    async (input: UpdateLocationInput): Promise<UnifiedLocationRecord | null> => {
      if (!input.coordinates && locations.length === 0) {
        setLastError('Cannot update location without coordinates');
        return null;
      }

      const slot = input.slot ?? 'home';
      const existingLocation = locations.find(loc => loc.slot === slot);

      const coordinates = input.coordinates ?? (existingLocation ? {
        lat: existingLocation.lat,
        lon: existingLocation.lon,
      } : null);

      if (!coordinates) {
        setLastError('Cannot update location without coordinates');
        return null;
      }

      const savedLocation = await updateLocationBySlot({
        slot,
        coordinates,
        name: input.rectangleLabel ?? undefined,
        rectangleCode: input.rectangleCode,
        rectangleRegion: input.rectangleRegion,
        source: input.source,
        accuracy: input.accuracy,
        resolveRectangle: input.resolveRectangle,
        makeActive: true,
      });

      return convertToLegacy(savedLocation);
    },
    [locations, updateLocationBySlot]
  );

  const setActiveLocationHandler = useCallback(
    async (locationId: string) => {
      setSyncing(true);
      setLastError(null);

      try {
        setActiveLocationId(locationId);
        persistState({ locations, activeLocationId: locationId });

        await setRemoteActiveLocation(locationId);
      } catch (error) {
        console.warn('[UnifiedLocation] Failed to set active location', error);
        setLastError((error as Error).message);
      } finally {
        setSyncing(false);
      }
    },
    [locations]
  );

  const deleteLocationHandler = useCallback(
    async (locationId: string) => {
      setSyncing(true);
      setLastError(null);

      try {
        const newLocations = locations.filter(loc => loc.id !== locationId);
        const newActiveId = activeLocationId === locationId
          ? (newLocations[0]?.id ?? null)
          : activeLocationId;

        setLocations(newLocations);
        setActiveLocationId(newActiveId);
        persistState(newLocations.length > 0 ? { locations: newLocations, activeLocationId: newActiveId } : null);

        await deleteRemoteLocation(locationId);
      } catch (error) {
        console.warn('[UnifiedLocation] Failed to delete location', error);
        setLastError((error as Error).message);
      } finally {
        setSyncing(false);
      }
    },
    [locations, activeLocationId]
  );

  const getLocationBySlot = useCallback(
    (slot: LocationSlot) => {
      return locations.find(loc => loc.slot === slot) ?? null;
    },
    [locations]
  );

  // Computed values
  const activeLocation = useMemo(
    () => locations.find(loc => loc.id === activeLocationId) ?? locations[0] ?? null,
    [locations, activeLocationId]
  );

  const homeLocation = useMemo(() => getLocationBySlot('home'), [getLocationBySlot]);
  const coastalLocation = useMemo(() => getLocationBySlot('coastal'), [getLocationBySlot]);
  const findrLocation = useMemo(() => getLocationBySlot('findr'), [getLocationBySlot]);

  // Legacy location property for backward compatibility
  const location = useMemo(
    () => activeLocation ? convertToLegacy(activeLocation) : null,
    [activeLocation]
  );

  const value = useMemo<UnifiedLocationContextValue>(
    () => ({
      // Legacy interface
      location,
      updateLocation,
      clearLocation,

      // New multi-location interface
      locations,
      activeLocation,
      homeLocation,
      coastalLocation,
      findrLocation,
      getLocationBySlot,
      updateLocationBySlot,
      setActiveLocation: setActiveLocationHandler,
      deleteLocation: deleteLocationHandler,

      // Shared
      loading,
      syncing,
      lastError,
      refreshRemote,
    }),
    [
      location,
      updateLocation,
      clearLocation,
      locations,
      activeLocation,
      homeLocation,
      coastalLocation,
      findrLocation,
      getLocationBySlot,
      updateLocationBySlot,
      setActiveLocationHandler,
      deleteLocationHandler,
      loading,
      syncing,
      lastError,
      refreshRemote,
    ]
  );

  return (
    <UnifiedLocationContext.Provider value={value}>
      {children}
    </UnifiedLocationContext.Provider>
  );
}

export function useUnifiedLocation(): UnifiedLocationContextValue {
  const ctx = useContext(UnifiedLocationContext);
  if (!ctx) {
    throw new Error('useUnifiedLocation must be used within a UnifiedLocationProvider');
  }
  return ctx;
}
