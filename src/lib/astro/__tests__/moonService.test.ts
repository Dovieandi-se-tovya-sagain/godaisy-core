/**
 * Moon and sun times from getMoonSunData, against SunCalc. Measured in
 * production's moon_cache on 2026-09-23: every Open-Meteo row with a local zone
 * had moonrise/moonset shifted by that zone's offset (Valencia 14:20Z for a
 * 16:20Z moonrise), and rows from the paid ipgeolocation fallback held local
 * times labelled UTC (Colunga 18:43Z for a ~16:43Z moonrise).
 */
import suncalc from 'suncalc';

type Row = Record<string, unknown> | null;

// A stand-in for the one Supabase query chain the service uses, with the row a
// read returns and whatever the service upserts.
const cache: { row: Row; upserts: Record<string, unknown>[] } = { row: null, upserts: [] };
jest.mock('../../supabase/serverClient', () => ({
  getSupabaseServerClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: cache.row, error: null }),
    };
    return {
      from: () => ({
        ...query,
        upsert: async (row: Record<string, unknown>) => {
          cache.upserts.push(row);
          return { error: null };
        },
      }),
    };
  },
}));

import { getMoonSunData } from '../moonService';

// Valencia, in Europe/Madrid (UTC+2 on this date).
const VALENCIA = { lat: 39.625, lon: -0.375 };
const DATE = '2026-09-23';

const openMeteoResponse = {
  timezone: 'Europe/Madrid',
  daily: { time: [DATE], sunrise: [`${DATE}T07:51`], sunset: [`${DATE}T19:55`] },
};

const fetchMock = jest.fn();

beforeEach(() => {
  cache.row = null;
  cache.upserts = [];
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.MOON_API_KEY;
});

const truth = (lat: number, lon: number) => suncalc.getMoonTimes(new Date(`${DATE}T12:00:00Z`), lat, lon);

describe('getMoonSunData', () => {
  it('stores the true moonrise and moonset from the Open-Meteo path, not UTC clock times labelled local', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => openMeteoResponse });
    const data = await getMoonSunData({ ...VALENCIA, date: DATE });
    const { rise, set } = truth(VALENCIA.lat, VALENCIA.lon);
    expect(data.moonriseISO).toBe(rise.toISOString());
    expect(data.moonsetISO).toBe(set.toISOString());
  });

  it('still reads Open-Meteo’s local sunrise and sunset in the place’s zone', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => openMeteoResponse });
    const data = await getMoonSunData({ ...VALENCIA, date: DATE });
    expect(data.sunriseISO).toBe(`${DATE}T05:51:00Z`);
    expect(data.sunsetISO).toBe(`${DATE}T17:55:00Z`);
  });

  it('goes straight to SunCalc when Open-Meteo fails, with no paid call even when a key is set', async () => {
    process.env.MOON_API_KEY = 'fake-key-for-tests';
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    const data = await getMoonSunData({ ...VALENCIA, date: DATE });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('ipgeolocation');
    expect(data.source).toBe('suncalc');
    const { rise } = truth(VALENCIA.lat, VALENCIA.lon);
    expect(data.moonriseISO).toBe(rise.toISOString());
    const sun = suncalc.getTimes(new Date(`${DATE}T12:00:00Z`), VALENCIA.lat, VALENCIA.lon);
    expect(data.sunriseISO).toBe(sun.sunrise.toISOString());
  });

  it('marks the rows it writes', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => openMeteoResponse });
    await getMoonSunData({ ...VALENCIA, date: DATE });
    expect((cache.upserts[0].raw as Record<string, unknown>).cache_format).toBe(2);
  });

  it('ignores a cached row written before the fix, and rewrites it', async () => {
    // What production held for Valencia: moonrise two hours early, no marker.
    cache.row = {
      lat_bucket: VALENCIA.lat,
      lon_bucket: VALENCIA.lon,
      local_date: DATE,
      timezone: 'Europe/Madrid',
      moonrise_iso: `${DATE}T14:20:00+00:00`,
      source: 'openmeteo',
      cached_at: `${DATE}T10:00:00Z`,
      expires_at: '2999-01-01T00:00:00Z',
      raw: { date: DATE, timezone: 'Europe/Madrid', moonrise: '14:20' },
    };
    fetchMock.mockResolvedValue({ ok: true, json: async () => openMeteoResponse });
    const data = await getMoonSunData({ ...VALENCIA, date: DATE });
    expect(data.moonriseISO).toBe(truth(VALENCIA.lat, VALENCIA.lon).rise.toISOString());
    expect(cache.upserts).toHaveLength(1);
  });

  it('serves a marked cached row without fetching', async () => {
    cache.row = {
      lat_bucket: VALENCIA.lat,
      lon_bucket: VALENCIA.lon,
      local_date: DATE,
      timezone: 'Europe/Madrid',
      moonrise_iso: `${DATE}T16:20:00Z`,
      source: 'openmeteo',
      cached_at: `${DATE}T10:00:00Z`,
      expires_at: '2999-01-01T00:00:00Z',
      raw: { cache_format: 2 },
    };
    const data = await getMoonSunData({ ...VALENCIA, date: DATE });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.moonriseISO).toBe(`${DATE}T16:20:00Z`);
  });
});
