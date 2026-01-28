import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { activityTypes } from '../data/activityTypes';
import { useUnifiedLocation } from './UnifiedLocationContext';
import { useAuth } from './AuthContext';
import type { SavedLocation } from '../types/multiLocation';
import { supabase } from '../lib/supabase/client';

// --- Types ---
type LocationType = 'home' | 'coastal';

interface Location {
  name: string;
  lat: number;
  lon: number;
  type?: LocationType;
}

interface EventPreferences {
  sport: boolean;
  music: boolean;
  arts: boolean;
  musicCategories: string[];
  artsCategories: string[];
  sportsCategories: string[];
}

// Minimal OpenWeather 3-hour forecast entry
interface ForecastEntry {
  dt_txt: string; // e.g. "2025-09-19 12:00:00"
  // retain other properties without using any
  [key: string]: unknown;
}

interface ForecastSlots {
  date: string; // YYYY-MM-DD
  morning?: ForecastEntry;
  afternoon?: ForecastEntry;
  night?: ForecastEntry;
}

interface OpenWeatherForecastResponse {
  list: ForecastEntry[];
}

interface Preferences {
  locations: Location[];           // Now supports multiple locations!
  interests: string[];
  forecast?: ForecastSlots[];
  category?: string;
  genre?: string;
  eventPreferences?: EventPreferences;
}

// --- Constants ---
const waterActivityIds = [
  'kayaking', 'canoeing', 'surfing', 'stand_up_paddleboarding', 'snorkeling',
  'swimming', 'sea_fishing_shore', 'sea_fishing_boat'
];

const DEFAULT_HOME_LOCATION: Location = {
  name: 'London, UK',
  lat: 51.5074,
  lon: -0.1278,
  type: 'home',
};

const DEFAULT_COASTAL_LOCATION: Location = {
  name: 'Brighton Beach',
  lat: 50.8198,
  lon: -0.1367,
  type: 'coastal',
};

const VALID_ACTIVITY_IDS = new Set(activityTypes.map(a => a.id));

const DEFAULT_INTEREST_IDS = [
  'hiking',
  'running',
  'cycling',
  'dog_walking',
  'gym_workout',
  'yoga',
  'picnicking',
  'bbq',
  'cinema',
  'museum',
  'cafe',
  'going_to_pub',
] as const;

const defaultEventPreferences: EventPreferences = {
  sport: false,
  music: false,
  arts: false,
  musicCategories: [],
  artsCategories: [],
  sportsCategories: [],
};

const defaultPreferences: Preferences = {
  locations: [DEFAULT_HOME_LOCATION],
  interests: [...DEFAULT_INTEREST_IDS],
  forecast: [],
  category: 'Music',
  genre: '',
  eventPreferences: { ...defaultEventPreferences },
};

const COORD_TOLERANCE = 0.0001;

const normalizeLocationType = (type?: LocationType): LocationType => (type === 'coastal' ? 'coastal' : 'home');

const _getTypedLocation = (locations: Location[], type: LocationType): Location | null => {
  const found = locations.find((loc) => normalizeLocationType(loc.type) === type);
  return found ? { ...found, type } : null;
};

const coordsEqual = (a: number, b: number) => Math.abs(a - b) <= COORD_TOLERANCE;

const locationsEqual = (a?: Location | null, b?: Location | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    normalizeLocationType(a.type) === normalizeLocationType(b.type) &&
    coordsEqual(a.lat, b.lat) &&
    coordsEqual(a.lon, b.lon) &&
    (a.name || '') === (b.name || '')
  );
};

const savedToPreferenceLocation = (saved: SavedLocation, type: LocationType): Location => ({
  name: saved.name || saved.rectangleRegion || 'Saved Location',
  lat: saved.lat,
  lon: saved.lon,
  type,
});

const _shouldSyncLocation = (local: Location | null, remote: SavedLocation | null | undefined) => {
  if (!local) return false;
  if (!Number.isFinite(local.lat) || !Number.isFinite(local.lon)) return false;
  if (!remote) return true;
  return !locationsEqual(local, savedToPreferenceLocation(remote, normalizeLocationType(local.type)));
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const sanitizeInterestList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && VALID_ACTIVITY_IDS.has(id));
};

const interestsEqual = (a?: string[] | null, b?: string[] | null) => {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};

function normalisePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') {
    return { ...defaultPreferences };
  }

  const parsed = value as Partial<Preferences>;
  const parsedInterests = sanitizeInterestList(parsed.interests);
  
  // Use default interests if none are saved
  const interests = parsedInterests.length > 0 ? parsedInterests : [...DEFAULT_INTEREST_IDS];

  const rawLocations = Array.isArray(parsed.locations) ? parsed.locations : [];
  const locations: Location[] = rawLocations
    .map((loc) => {
      if (!loc || typeof loc !== 'object') return null;
      const { name, lat, lon, type } = loc as Location;
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
      return {
        name: typeof name === 'string' && name.trim() ? name : 'Saved place',
        lat: latNum,
        lon: lonNum,
        type: type === 'coastal' ? 'coastal' : 'home',
      } as Location;
    })
    .filter((loc): loc is Location => !!loc);

  const forecast = Array.isArray(parsed.forecast) ? parsed.forecast : [];

  const rawEventPreferences = parsed.eventPreferences && typeof parsed.eventPreferences === 'object'
    ? parsed.eventPreferences as Partial<EventPreferences>
    : undefined;

  const eventPreferences: EventPreferences = rawEventPreferences
    ? {
        sport: !!rawEventPreferences.sport,
        music: !!rawEventPreferences.music,
        arts: !!rawEventPreferences.arts,
        musicCategories: toStringArray(rawEventPreferences.musicCategories),
        artsCategories: toStringArray(rawEventPreferences.artsCategories),
        sportsCategories: toStringArray(rawEventPreferences.sportsCategories),
      }
    : { ...defaultEventPreferences };

  const base: Preferences = {
    locations: locations.length ? locations : [DEFAULT_HOME_LOCATION],
    interests,
    forecast,
    category: typeof parsed.category === 'string' ? parsed.category : 'Music',
    genre: typeof parsed.genre === 'string' ? parsed.genre : '',
    eventPreferences,
  };

  return base;
}

function loadPreferencesFromStorage(): Preferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('preferences');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as unknown;
    return normalisePreferences(parsed);
  } catch (err) {
    console.warn('Failed to load preferences from storage', err);
    return null;
  }
}

// --- Context/Provider ---
interface UserPreferencesContextType {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  fetchForecast: () => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Lazy-load preferences synchronously on first render (client only)
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof window === 'undefined') return defaultPreferences;
    return loadPreferencesFromStorage() ?? defaultPreferences;
  });
  const ipBootstrapAttempted = useRef(false);
  const { user } = useAuth();
  const {
    homeLocation: unifiedHome,
    coastalLocation: unifiedCoastal,
    updateLocationBySlot,
    refreshRemote,
    loading: unifiedLoading,
  } = useUnifiedLocation();
  const remoteActivitiesLoaded = useRef(false);
  const lastSyncedActivities = useRef<string[] | null>(null);

  useEffect(() => {
    if (!user?.id) {
      remoteActivitiesLoaded.current = false;
      lastSyncedActivities.current = null;
      return;
    }

    remoteActivitiesLoaded.current = false;
    lastSyncedActivities.current = null;
    let cancelled = false;

    const hydrateActivities = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('activities')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn('[UserPreferences] Failed to fetch activities', error);
        } else {
          const remoteActivities = sanitizeInterestList(data?.activities);
          if (remoteActivities.length > 0) {
            setPreferences((prev) => {
              if (interestsEqual(prev.interests, remoteActivities)) return prev;
              return { ...prev, interests: remoteActivities };
            });
          }
          lastSyncedActivities.current = remoteActivities;
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[UserPreferences] Error loading activities from Supabase', err);
        }
      } finally {
        if (!cancelled) {
          remoteActivitiesLoaded.current = true;
        }
      }
    };

    void hydrateActivities();

    return () => {
      cancelled = true;
    };
  }, [user?.id, setPreferences]);

  useEffect(() => {
    if (!user?.id) return;
    if (!remoteActivitiesLoaded.current) return;

    const nextInterests = preferences.interests ?? [];
    if (interestsEqual(lastSyncedActivities.current, nextInterests)) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ activities: nextInterests })
          .eq('id', user.id);

        if (error) {
          console.warn('[UserPreferences] Failed to persist activities', error);
          return;
        }
        lastSyncedActivities.current = [...nextInterests];
      } catch (err) {
        console.warn('[UserPreferences] Error saving activities', err);
      }
    }, 1200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user?.id, preferences.interests]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromStorage = () => {
      const stored = loadPreferencesFromStorage();
      if (!stored) return;
      setPreferences((prev) => {
        const sameInterests = prev.interests.length === stored.interests.length && prev.interests.every((id, idx) => id === stored.interests[idx]);
        const sameLocations = prev.locations.length === stored.locations.length && prev.locations.every((loc, idx) => {
          const other = stored.locations[idx];
          if (!other) return false;
          return (
            loc.type === other.type &&
            loc.name === other.name &&
            Number(loc.lat).toFixed(4) === Number(other.lat).toFixed(4) &&
            Number(loc.lon).toFixed(4) === Number(other.lon).toFixed(4)
          );
        });
        if (sameInterests && sameLocations) return prev;
        return { ...prev, ...stored };
      });
    };

    // Hydrate immediately after mount
    syncFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'preferences') {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ipBootstrapAttempted.current) return;
    
    // Wait for unified location to finish loading from database
    if (unifiedLoading) return;
    
    // If user has saved locations in database, use those instead of IP bootstrap
    if (unifiedHome || unifiedCoastal) {
      ipBootstrapAttempted.current = true;
      console.log('[GoDaisy] Skipping IP bootstrap - user has saved locations in database');
      return;
    }
    
    const stored = loadPreferencesFromStorage();
    if (stored) return;
    ipBootstrapAttempted.current = true;

    void (async () => {
      let bootstrapSource: 'ip' | 'fallback' = 'fallback';
      try {
        const response = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          const latitude = Number(payload?.latitude);
          const longitude = Number(payload?.longitude);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            bootstrapSource = 'ip';
            const city = typeof payload?.city === 'string' && payload.city.trim().length > 0 ? payload.city.trim() : null;
            const region = typeof payload?.region === 'string' && payload.region.trim().length > 0 ? payload.region.trim() : null;
            const country = typeof payload?.country_name === 'string' && payload.country_name.trim().length > 0 ? payload.country_name.trim() : null;
            const displayName = [city, region].filter(Boolean).join(', ') || country || 'Your area';

            setPreferences((prev) => {
              const withoutHome = Array.isArray(prev.locations) ? prev.locations.filter((loc) => loc?.type !== 'home') : [];
              return {
                ...prev,
                locations: [
                  {
                    name: displayName,
                    lat: latitude,
                    lon: longitude,
                    type: 'home' as const,
                  },
                  ...withoutHome,
                ],
              };
            });
          }
        }
      } catch (error) {
        console.info('IP bootstrap failed, falling back to default London location', error);
      } finally {
        try {
          localStorage.setItem('godaisy.bootstrap-applied', '1');
          localStorage.setItem('godaisy.bootstrap-source', bootstrapSource);
        } catch (err) {
          console.warn('Failed to persist bootstrap metadata', err);
        }
      }
    })();
  }, [setPreferences, unifiedLoading, unifiedHome, unifiedCoastal]);

  useEffect(() => {
    if (!user) return;
    void refreshRemote();
  }, [user, user?.id, refreshRemote]);

  useEffect(() => {
    if (!user) return;
    if (unifiedLoading) return;

    if (!unifiedHome && !unifiedCoastal) return;

    setPreferences((prev) => {
      const nextLocations = Array.isArray(prev.locations) ? [...prev.locations] : [];
      let changed = false;

      const applyRemote = (type: LocationType, remote: SavedLocation | null | undefined) => {
        if (!remote) return;
        const normalizedType = normalizeLocationType(type);
        const candidate = savedToPreferenceLocation(remote, normalizedType);
        const index = nextLocations.findIndex((loc) => normalizeLocationType(loc.type) === normalizedType);
        const current = index >= 0 ? nextLocations[index] : null;
        if (!locationsEqual(current, candidate)) {
          changed = true;
          if (index >= 0) {
            nextLocations[index] = candidate;
          } else {
            nextLocations.push(candidate);
          }
        }
      };

      applyRemote('home', unifiedHome);
      applyRemote('coastal', unifiedCoastal);

      if (!changed) return prev;
      return { ...prev, locations: nextLocations };
    });
  }, [user, user?.id, unifiedHome, unifiedCoastal, unifiedLoading]);

  useEffect(() => {
    if (!user) return;
    if (unifiedLoading) return;

    // Check if current locations are from IP bootstrap (not user-chosen)
    const isBootstrapped = typeof window !== 'undefined' &&
      localStorage.getItem('godaisy.bootstrap-applied') === '1';

    // If locations are IP-bootstrapped, don't sync them to database
    // User hasn't manually chosen these locations yet
    if (isBootstrapped) {
      return;
    }

    // IMPORTANT: For old localStorage data without bootstrap flag, treat it as bootstrapped
    // to prevent auto-syncing default/IP locations to database
    // Only sync if user has explicitly updated locations after we deployed the bootstrap system
    return;

    // This code is now disabled - kept for reference but will be removed in future cleanup
    // const home = getTypedLocation(preferences.locations, 'home');
    // const coastal = getTypedLocation(preferences.locations, 'coastal');

    // const syncPromises: Promise<unknown>[] = [];

    // if (shouldSyncLocation(home, unifiedHome)) {
    //   console.log('[UserPreferences] Syncing user-chosen home location to database');
    //   syncPromises.push(
    //     updateLocationBySlot({
    //       slot: 'home',
    //       coordinates: { lat: home!.lat, lon: home!.lon },
    //       name: home!.name,
    //       rectangleRegion: home!.name,
    //       makeActive: false,
    //     })
    //   );
    // }

    // if (shouldSyncLocation(coastal, unifiedCoastal)) {
    //   console.log('[UserPreferences] Syncing user-chosen coastal location to database');
    //   syncPromises.push(
    //     updateLocationBySlot({
    //       slot: 'coastal',
    //       coordinates: { lat: coastal!.lat, lon: coastal!.lon },
    //       name: coastal!.name,
    //       rectangleRegion: coastal!.name,
    //       makeActive: false,
    //     })
    //   );
    // }

    // if (syncPromises.length > 0) {
    //   void Promise.allSettled(syncPromises);
    // }
  }, [user, user?.id, preferences.locations, unifiedHome, unifiedCoastal, unifiedLoading, updateLocationBySlot]);

  // --- Auto-detect home location if not set ---
  useEffect(() => {
    // Wait for unified location to finish loading
    if (unifiedLoading) return;
    
    // If user has saved location in database, don't auto-detect
    if (unifiedHome) return;
    
    const hasHome = preferences.locations.some(l => l.type === 'home');
    if (!hasHome && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPreferences(prev => ({
            ...prev,
            locations: [
              ...prev.locations.filter(l => l.type !== 'home'),
              {
                name: 'Current Location',
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                type: 'home'
              }
            ]
          }));
        },
        () => {
          // Only fallback to London if no saved location exists
          if (!unifiedHome) {
            setPreferences(prev => ({
              ...prev,
              locations: [
                ...prev.locations.filter(l => l.type !== 'home'),
                DEFAULT_HOME_LOCATION
              ]
            }));
          }
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unifiedLoading, unifiedHome]);

  // --- Watch for water activities, auto-add coastal location if needed ---
  useEffect(() => {
    const wantsCoastal = preferences.interests.some(id => waterActivityIds.includes(id));
    const hasCoastal = preferences.locations.some(l => l.type === 'coastal');
    if (wantsCoastal && !hasCoastal) {
      setPreferences(prev => ({
        ...prev,
        locations: [...prev.locations, DEFAULT_COASTAL_LOCATION]
      }));
    }
    // Optional: You might want to remove the coastal location if no more water activities
    // else if (!wantsCoastal && hasCoastal) {
    //   setPreferences(prev => ({
    //     ...prev,
    //     locations: prev.locations.filter(l => l.type !== 'coastal')
    //   }));
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.interests]);

  // --- Track location changes to clear bootstrap flag ---
  const prevLocationsRef = useRef<Location[]>(preferences.locations);
  useEffect(() => {
    const prev = prevLocationsRef.current;
    const curr = preferences.locations;

    // Check if locations have actually changed
    const locationsChanged = prev.length !== curr.length ||
      prev.some((loc, idx) => {
        const other = curr[idx];
        return !other ||
          loc.name !== other.name ||
          Math.abs(loc.lat - other.lat) > 0.0001 ||
          Math.abs(loc.lon - other.lon) > 0.0001;
      });

    if (locationsChanged && typeof window !== 'undefined') {
      const isBootstrapped = localStorage.getItem('godaisy.bootstrap-applied') === '1';
      if (isBootstrapped) {
        localStorage.removeItem('godaisy.bootstrap-applied');
        localStorage.removeItem('godaisy.bootstrap-source');
      }
      prevLocationsRef.current = curr;
    }
  }, [preferences.locations]);

  // --- Persist preferences to localStorage with debounce ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timeoutId = setTimeout(() => {
        localStorage.setItem('preferences', JSON.stringify(preferences));
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [preferences]);

  // --- Weather forecast fetcher (fetches for home location) ---
  const fetchForecast = async () => {
    const home = preferences.locations.find(l => l.type === 'home');
    if (!home?.lat || !home.lon) return;

    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_KEY;
    if (!apiKey) {
      console.warn('OpenWeather API key is missing');
      return;
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${home.lat}&lon=${home.lon}&appid=${apiKey}&units=metric`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Failed to fetch forecast:', res.statusText);
        return;
      }
      const data: OpenWeatherForecastResponse = await res.json();

      // Structure forecast by day/slot (morning, afternoon, night)
      const byDay: ForecastSlots[] = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dayStr = date.toISOString().split('T')[0];
        const daySlots = data.list.filter((entry: ForecastEntry) => entry.dt_txt.startsWith(dayStr));
        const slots: ForecastSlots = {
          date: dayStr,
          morning: daySlots.find((e: ForecastEntry) => {
            const hour = parseInt(e.dt_txt.slice(11, 13), 10);
            return hour >= 6 && hour < 12;
          }),
          afternoon: daySlots.find((e: ForecastEntry) => {
            const hour = parseInt(e.dt_txt.slice(11, 13), 10);
            return hour >= 12 && hour < 18;
          }),
          night: daySlots.find((e: ForecastEntry) => {
            const hour = parseInt(e.dt_txt.slice(11, 13), 10);
            return hour >= 18 || hour < 6;
          }),
        };
        byDay.push(slots);
      }
      setPreferences(prev => ({
        ...prev,
        forecast: byDay,
      }));
    } catch (error) {
      console.warn('Error fetching forecast:', error);
    }
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, setPreferences, fetchForecast }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = (): UserPreferencesContextType => {
  const context = useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  return context;
};

export { UserPreferencesContext };
