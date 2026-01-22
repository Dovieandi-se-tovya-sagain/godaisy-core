// lib/placesSearch.ts

// 1) Minimal country -> language resolver (prioritise location; language affects labels, not ranking)
export function languageForCountry(countryCode?: string): string {
    if (!countryCode) return 'en';
    const cc = countryCode.toUpperCase();
    // ISO 3166-1 alpha-2 → BCP-47 language tags
    const map: Record<string, string> = {
      ES: 'es', MX: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es', // Spanish
      FR: 'fr', BE: 'fr', CA: 'fr',
      DE: 'de', AT: 'de', CH: 'de',
      IT: 'it', CH_IT: 'it',
      PT: 'pt', BR: 'pt',
      CN: 'zh', HK: 'zh', MO: 'zh', TW: 'zh',
      JP: 'ja',
      // Add more as needed…
    };
    return map[cc] || 'en';
  }
  
  // 2) Suggested Places "type" per activity (kept broad/safe for global coverage)
  export const SUGGESTED_TYPE: Record<string, string> = {
    // Outdoor (examples)
    running: 'park',
    hiking: 'park',
    cycling: 'cafe',
    mountain_biking: 'park',
    dog_walking: 'park',
    skateboarding: 'park',
    rollerblading: 'park',
    picnicking: 'park',
    bbq: 'park',
  
    // Water & fishing
    kayaking: 'tourist_attraction',
    sea_kayaking: 'tourist_attraction',
    canoeing: 'tourist_attraction',
    stand_up_paddleboarding: 'tourist_attraction',
    surfing: 'tourist_attraction',
    windsurfing: 'tourist_attraction',
    kitesurfing: 'tourist_attraction',
    snorkeling: 'tourist_attraction',
    scuba_diving: 'tourist_attraction',
    wild_swimming: 'natural_feature',
    sailing: 'marina',
    sailing_inland: 'marina',
    jetskiing: 'tourist_attraction',
    fishing: 'tourist_attraction',
    fly_fishing_freshwater: 'natural_feature',
    coarse_fishing: 'natural_feature',
    sea_fishing_shore: 'tourist_attraction',
    sea_fishing_boat: 'tourist_attraction',
    ice_fishing: 'natural_feature',
  
    // Indoor / cultural
    museum: 'museum',
    gallery: 'art_gallery',
    cinema: 'movie_theater',
    shopping: 'establishment',
    cafe: 'cafe',
    going_to_pub: 'bar',
  
    // Indoor sports / studios
    indoor_swimming: 'gym',
    tennis: 'park',
    padel: 'gym',
    squash: 'gym',
    badminton: 'gym',
    table_tennis: 'gym',
    pickleball: 'park',
    volleyball_indoor: 'gym',
    climbing_gym: 'gym',
    gym_workout: 'gym',
    yoga: 'gym',
    pilates: 'gym',
    martial_arts: 'gym',
    dance: 'school',
  };
  
  // 3) Pull keywords for the country’s language, then fall back to English
  import { ACTIVITY_KEYWORDS } from '../activitykeywords/ACTIVITY_KEYWORDS';
  
  export function getKeywords(activityId: string, countryCode?: string): string[] {
    const lang = languageForCountry(countryCode);
    const pack = ACTIVITY_KEYWORDS[activityId];
    if (!pack) return [];
    const local = pack[lang] || [];
    const en = pack['en'] || [];
    // Ordered: local phrases first, then English (deduped)
    const seen = new Set<string>();
    const ordered = [...local, ...en].filter(p => {
      const k = p.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return ordered;
  }
  
  // 4) Build a Nearby Search request for a single phrase (location > language)
  export function buildNearbyParams(
    coords: { lat: number; lng: number },
    phrase: string,
    type: string,
    opts?: { openNow?: boolean; radius?: number; language?: string; rankByDistance?: boolean }
  ) {
    const params: Record<string, string> = {
      location: `${coords.lat},${coords.lng}`,
      type,
      keyword: phrase,                // single phrase -> strong intent (space is AND-ish)
      language: opts?.language || 'en',
    };
    if (opts?.rankByDistance ?? ['park','tourist_attraction'].includes(type)) {
      params['rankby'] = 'distance';
    } else {
      params['radius'] = String(opts?.radius ?? 7000);
    }
    if (opts?.openNow) params['opennow'] = 'true';
    return params;
  }
  
  // 5) Do sequential tries: first phrase, then next, etc. Fallback to Text Search at the end.
  export type PlacesApiResult = {
    status?: string;
    statusCode?: string | number;
    results?: unknown[];
  };
  
  export type PlacesClient = {
    nearbySearch: (params: Record<string, string>) => Promise<PlacesApiResult>;
    textSearch: (params: Record<string, string>) => Promise<PlacesApiResult>;
  };
  
  // Define what “has results” means (treat ZERO_RESULTS & empty as fail)
  function hasResults(res: PlacesApiResult): boolean {
    const status = (res?.status || res?.statusCode || '').toString();
    const results = Array.isArray(res?.results) ? res.results : [];
    if (results.length > 0) return true;
    if (status && status !== 'OK') return false;
    return false;
  }
  
  export async function searchPlacesSequential(
    client: PlacesClient,
    activityId: string,
    coords: { lat: number; lng: number },
    countryCode?: string,
    options?: { openNow?: boolean; radius?: number; typeOverride?: string; languageOverride?: string }
  ) {
    const phrases = getKeywords(activityId, countryCode);
    if (phrases.length === 0) return { tried: [], best: null };
  
    const type = options?.typeOverride || SUGGESTED_TYPE[activityId] || 'establishment';
    const language = options?.languageOverride || languageForCountry(countryCode);
  
    const tried: Array<{ endpoint: 'nearby'|'text'; phrase: string; params: Record<string,string>; ok: boolean; count?: number }> = [];
  
    // Try phrases one by one with NearbySearch
    for (const phrase of phrases) {
      const params = buildNearbyParams(
        coords,
        phrase,
        type,
        { openNow: options?.openNow, radius: options?.radius, language, rankByDistance: undefined }
      );
      const res = await client.nearbySearch(params);
      const ok = hasResults(res);
      tried.push({ endpoint: 'nearby', phrase, params, ok, count: Array.isArray(res?.results) ? res.results.length : 0 });
      if (ok) {
        return { tried, best: { endpoint: 'nearby', phrase, params, response: res } };
      }
    }
  
    // Final fallback: Text Search with the FIRST phrase + “near me”
    const first = phrases[0];
    const textParams: Record<string, string> = {
      query: `${first} near me`,
      location: `${coords.lat},${coords.lng}`,
      radius: String(options?.radius ?? 7000),
      language,
    };
    const textRes = await client.textSearch(textParams);
    const textOk = hasResults(textRes);
    tried.push({ endpoint: 'text', phrase: first, params: textParams, ok: textOk, count: Array.isArray(textRes?.results) ? textRes.results.length : 0 });
  
    if (textOk) {
      return { tried, best: { endpoint: 'text', phrase: first, params: textParams, response: textRes } };
    }
  
    return { tried, best: null };
  }