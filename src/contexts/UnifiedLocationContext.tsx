"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SavedLocation, LocationSlot, LocationSource } from '../lib/multiLocation';
import { toLegacyFormat as convertToLegacy } from '../lib/multiLocation';
import { authFetch } from '../lib/supabase/authFetch';

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
  const res = await authFetch('/api/user/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    console.warn('[UnifiedLocation] POST /api/user/location returned 401 — Bearer token missing or invalid');
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
    const res = await authFetch('/api/user/location?multiLocation=true', {
      method: 'GET',
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
  const res = await authFetch('/api/user/location?multiLocation=true', { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch locations');

  const { locations } = (await res.json()) as { locations: SavedLocation[] };
  const location = locations.find(loc => loc.id === locationId);
  if (!location) throw new Error('Location not found');

  // Re-save to make it active
  await authFetch('/api/user/location', {
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
  const res = await authFetch(`/api/user/location?locationId=${locationId}`, {
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
  // Slots updated locally within the last 30s. While a slot is in this set,
  // refreshRemote / mount-load will not overwrite it with stale remote data —
  // this prevents the optimistic-update-then-stomped-by-stale-GET oscillation
  // when the POST to sync fails or hasn't completed yet.
  const recentlyUpdatedSlots = useRef<Set<LocationSlot>>(new Set());
  const slotProtectionTimers = useRef<Map<LocationSlot, ReturnType<typeof setTimeout>>>(new Map());

  const markSlotRecentlyUpdated = useCallback((slot: LocationSlot) => {
    recentlyUpdatedSlots.current.add(slot);
    // Reset the 30s window on every re-mark — a second update to the same
    // slot extends protection, instead of inheriting the first call's timer.
    const existing = slotProtectionTimers.current.get(slot);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      recentlyUpdatedSlots.current.delete(slot);
      slotProtectionTimers.current.delete(slot);
    }, 30_000);
    slotProtectionTimers.current.set(slot, timer);
  }, []);

  // Merge remote locations into local state, preserving any slots that have been
  // updated locally within the protection window. Active location id likewise
  // sticks to the local choice if its slot is protected. localStorage stays in
  // sync via the persistence useEffect below — never persist directly here.
  const applyRemoteState = useCallback((remote: StoredState) => {
    const protectedSlots = recentlyUpdatedSlots.current;

    setLocations(prev => {
      // Protected + present in prev: keep local. Protected + absent from prev:
      // drop entirely (local truth is "this slot is deleted/cleared", so we
      // don't want to re-add it from remote). Unprotected: take remote.
      const result = remote.locations
        .map(remoteLoc => {
          if (protectedSlots.has(remoteLoc.slot)) {
            const local = prev.find(l => l.slot === remoteLoc.slot);
            return local ?? null;
          }
          return remoteLoc;
        })
        .filter((l): l is SavedLocation => l !== null);
      // Add any locally-protected slots that exist in prev but not in remote
      // (e.g. a new location picked locally before its POST has synced).
      for (const localLoc of prev) {
        if (protectedSlots.has(localLoc.slot) && !result.some(r => r.slot === localLoc.slot)) {
          result.push(localLoc);
        }
      }
      return result;
    });
    setActiveLocationId(prevActive => {
      const remoteActiveSlot = remote.locations.find(l => l.id === remote.activeLocationId)?.slot;
      // If the remote active slot is locally-protected, don't change activeLocationId.
      return remoteActiveSlot && protectedSlots.has(remoteActiveSlot)
        ? prevActive
        : remote.activeLocationId;
    });
  }, []);

  // Centralized persistence: keep localStorage in lockstep with React state.
  // This replaces scattered persistState calls in handlers and avoids the
  // dead-code race where setState updaters captured the merged value too late
  // for synchronous post-dispatch reads.
  useEffect(() => {
    if (loading) return;
    if (locations.length === 0 && activeLocationId === null) {
      persistState(null);
    } else {
      persistState({ locations, activeLocationId });
    }
  }, [locations, activeLocationId, loading]);

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
          // Remote has data — applyRemoteState merges with any protected slots
          // and persists the merged result to localStorage.
          applyRemoteState(remote);
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
        // applyRemoteState preserves any locally-protected slots and persists
        // the merged result to localStorage in one step.
        applyRemoteState(remote);
      }
    } finally {
      // Reset flag after a short delay to allow future refreshes
      setTimeout(() => { remoteLoadedRef.current = false; }, 2000);
    }
  }, [applyRemoteState]);

  const clearLocation = useCallback(async () => {
    // Mark every currently-known slot as recently-updated so a stale remote
    // refresh can't bring locations back if the DELETE request fails.
    // (Slight closure staleness is OK — the protection window is wide enough.)
    for (const loc of locations) markSlotRecentlyUpdated(loc.slot);
    setLocations([]);
    setActiveLocationId(null);
    setLastError(null);
    try {
      await authFetch('/api/user/location', { method: 'DELETE' });
    } catch (error) {
      console.warn('[UnifiedLocation] Remote clear failed', error);
    }
  }, [locations, markSlotRecentlyUpdated]);

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

        // Compute the optimistic location once, off the latest closure read.
        // The minor staleness in usageCount is acceptable; the actual state
        // mutation below uses a functional setLocations so concurrent updates
        // for different slots don't lose each other.
        const existing = locations.find(loc => loc.slot === input.slot);
        const optimisticLocation: SavedLocation = {
          id: existing?.id ?? crypto.randomUUID(),
          slot: input.slot,
          name: finalName,
          lat: nextLat,
          lon: nextLon,
          rectangleCode: nextRectangleCode,
          rectangleRegion: nextRectangleRegion,
          accuracy: input.accuracy ?? null,
          source: input.source ?? 'manual',
          updatedAt: new Date().toISOString(),
          usageCount: existing ? existing.usageCount + 1 : 1,
        };

        // Track this slot as recently-updated so refreshRemote can't stomp it
        // with stale data while the POST is in flight (or after it fails).
        markSlotRecentlyUpdated(input.slot);

        // Functional setLocations: merges with the latest state, never loses a
        // concurrent update to a different slot. Persistence is handled by the
        // centralized useEffect that watches locations + activeLocationId.
        setLocations(prev => {
          const idx = prev.findIndex(loc => loc.slot === input.slot);
          return idx >= 0
            ? prev.map((loc, i) => (i === idx ? optimisticLocation : loc))
            : [...prev, optimisticLocation];
        });
        if (input.makeActive !== false) {
          setActiveLocationId(optimisticLocation.id);
        }

        try {
          const remoteResult = await upsertRemoteLocationBySlot(updateInput);
          if (remoteResult.ok) {
            const remoteLocation = remoteResult.location;
            setLocations(prev => {
              const idx = prev.findIndex(loc => loc.slot === input.slot);
              // If the slot is no longer in prev (a concurrent delete or clear
              // removed it while our POST was in flight), DO NOT re-add. The
              // user's most recent intent was to remove it.
              return idx >= 0
                ? prev.map((loc, i) => (i === idx ? remoteLocation : loc))
                : prev;
            });
            if (input.makeActive !== false) {
              // Only swap the active id if it's still the optimistic id we set
              // earlier. If a concurrent delete/clear or a different setActive
              // changed it in the meantime, respect that newer intent — don't
              // clobber it with a pointer to a location that may no longer exist.
              setActiveLocationId(prevActive =>
                prevActive === optimisticLocation.id ? remoteLocation.id : prevActive,
              );
            }
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
    [locations, activeLocationId, markSlotRecentlyUpdated]
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
        // Protect the slot of the new active location so a stale refreshRemote
        // can't reset activeLocationId to the previous server-side choice
        // while our setRemoteActiveLocation is in flight (or after it fails).
        const target = locations.find(loc => loc.id === locationId);
        if (target) markSlotRecentlyUpdated(target.slot);

        setActiveLocationId(locationId);

        await setRemoteActiveLocation(locationId);
      } catch (error) {
        console.warn('[UnifiedLocation] Failed to set active location', error);
        setLastError((error as Error).message);
      } finally {
        setSyncing(false);
      }
    },
    [locations, markSlotRecentlyUpdated]
  );

  const deleteLocationHandler = useCallback(
    async (locationId: string) => {
      setSyncing(true);
      setLastError(null);

      try {
        // Protect the deleted slot so refreshRemote can't bring it back if the
        // DELETE request fails. Also protect the new active slot so the active
        // pointer doesn't get reset.
        const deleted = locations.find(loc => loc.id === locationId);
        if (deleted) markSlotRecentlyUpdated(deleted.slot);

        const newLocations = locations.filter(loc => loc.id !== locationId);
        const newActiveId = activeLocationId === locationId
          ? (newLocations[0]?.id ?? null)
          : activeLocationId;
        const newActiveSlot = newLocations.find(loc => loc.id === newActiveId)?.slot;
        if (newActiveSlot) markSlotRecentlyUpdated(newActiveSlot);

        // Functional setLocations: doesn't lose any concurrent update to a
        // different location.
        setLocations(prev => prev.filter(loc => loc.id !== locationId));
        setActiveLocationId(newActiveId);

        await deleteRemoteLocation(locationId);
      } catch (error) {
        console.warn('[UnifiedLocation] Failed to delete location', error);
        setLastError((error as Error).message);
      } finally {
        setSyncing(false);
      }
    },
    [locations, activeLocationId, markSlotRecentlyUpdated]
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
