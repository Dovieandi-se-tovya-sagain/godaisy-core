import type { NextApiRequest, NextApiResponse } from 'next';

type MockRes = {
  res: NextApiResponse;
  payload: { status: number; body: unknown };
  headers: Map<string, unknown>;
};

function createMockReqRes(query: Record<string, string | string[] | undefined>): { req: NextApiRequest; res: NextApiResponse; meta: MockRes } {
  const req = {
    method: 'GET',
    query,
  } as unknown as NextApiRequest;

  const headers = new Map<string, unknown>();
  const payload = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) {
      payload.status = code;
      return this as NextApiResponse;
    },
    json(body: unknown) {
      payload.body = body;
      return this as NextApiResponse;
    },
    setHeader(name: string, value: unknown) {
      headers.set(name, value);
      return this as NextApiResponse;
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    end(data?: unknown) {
      payload.body = data ?? payload.body;
      return this as NextApiResponse;
    },
  } as unknown as NextApiResponse;

  return { req, res, meta: { res, payload, headers } };
}

const okJsonResponse = (data: unknown) => ({
  ok: true,
  async json() {
    return data;
  },
}) as Response;

describe('free provider priority selection', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.FREE_PROVIDERS_ENABLED = 'true';
    delete process.env.OPENWEATHER_KEY;
    delete process.env.NEXT_PUBLIC_OPENWEATHER_KEY;
    delete process.env.FREE_PROVIDER_ORDER;
    delete process.env.NEXT_PUBLIC_FREE_PROVIDER_ORDER;
  });

  it('polls MET Norway before OpenWeather for European coordinates', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.met.no/weatherapi/locationforecast/2.0/complete')) {
        const now = Date.now();
        return okJsonResponse({
          properties: {
            timeseries: [
              {
                time: new Date(now).toISOString(),
                data: {
                  instant: {
                    details: {
                      air_temperature: 12,
                      wind_speed: 4,
                      wind_from_direction: 180,
                      air_pressure_at_sea_level: 1015,
                      dew_point_temperature: 6,
                      relative_humidity: 75,
                      cloud_area_fraction: 20,
                    },
                  },
                  next_1_hours: {
                    summary: { symbol_code: 'clearsky_day' },
                    details: { precipitation_amount: 0.1 },
                    probability_of_precipitation: 20,
                  },
                },
              },
              {
                time: new Date(now + 3600_000).toISOString(),
                data: {
                  instant: {
                    details: {
                      air_temperature: 13,
                      wind_speed: 3,
                      wind_from_direction: 190,
                      air_pressure_at_sea_level: 1013,
                      relative_humidity: 70,
                    },
                  },
                  next_1_hours: {
                    summary: { symbol_code: 'partlycloudy_day' },
                    details: { precipitation_amount: 0 },
                    probability_of_precipitation: 10,
                  },
                },
              },
            ],
          },
        });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return okJsonResponse({ hourly: { time: [], pm10: [], pm2_5: [] } });
      }
      if (url.includes('api.open-meteo.com')) {
        return okJsonResponse({ hourly: { time: [], temperature_2m: [], snowfall: [], snow_depth: [] } });
      }
      throw new Error(`Unexpected fetch URL in MET test: ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { default: handler } = await import('../../pages/api/unified-weather');

    const { req, res, meta } = createMockReqRes({ lat: '48.8566', lon: '2.3522', units: 'metric' });
    await handler(req, res);

    expect(meta.payload.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.met.no');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('openweathermap'))).toBe(false);

    const json = meta.payload.body as { name?: string };
    expect(json?.name).toBe('MET Norway');
    expect(meta.headers.get('X-Weather-Source')).toBe('free:metno');
  });

  it('polls NOAA before any other provider for US coordinates', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.weather.gov/points')) {
        return okJsonResponse({
          properties: {
            forecast: 'https://api.weather.gov/gridpoints/OKX/33,37/forecast',
            forecastHourly: 'https://api.weather.gov/gridpoints/OKX/33,37/forecast/hourly',
          },
        });
      }
      if (url.includes('/forecast/hourly')) {
        const now = Date.now();
        return okJsonResponse({
          properties: {
            periods: [
              {
                startTime: new Date(now).toISOString(),
                temperature: 70,
                windSpeed: '12 mph',
                windGust: '18 mph',
                shortForecast: 'Sunny',
                icon: 'https://api.weather.gov/icons/land/day/few?size=medium',
                probabilityOfPrecipitation: { value: 30 },
              },
            ],
          },
        });
      }
      if (url.endsWith('/forecast')) {
        const tomorrow = Date.now() + 24 * 3600_000;
        return okJsonResponse({
          properties: {
            periods: [
              {
                startTime: new Date(tomorrow).toISOString(),
                isDaytime: true,
                temperature: 75,
                shortForecast: 'Mostly Sunny',
                icon: 'https://api.weather.gov/icons/land/day/few?size=medium',
              },
              {
                startTime: new Date(tomorrow + 12 * 3600_000).toISOString(),
                isDaytime: false,
                temperature: 60,
                shortForecast: 'Clear',
                icon: 'https://api.weather.gov/icons/land/night/few?size=medium',
              },
            ],
          },
        });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return okJsonResponse({ hourly: { time: [], pm10: [], pm2_5: [] } });
      }
      if (url.includes('api.open-meteo.com')) {
        return okJsonResponse({ hourly: { time: [], temperature_2m: [], snowfall: [], snow_depth: [] } });
      }
      throw new Error(`Unexpected fetch URL in NOAA test: ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { default: handler } = await import('../../pages/api/unified-weather');

    const { req, res, meta } = createMockReqRes({ lat: '40.7128', lon: '-74.0060', units: 'metric' });
    await handler(req, res);

    expect(meta.payload.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.weather.gov/points');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('openweathermap'))).toBe(false);

    const json = meta.payload.body as { name?: string };
    expect(json?.name).toBe('NOAA NWS');
    expect(meta.headers.get('X-Weather-Source')).toBe('free:noaa');
  });
});

describe('MET Norway fetch helpers', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('rounds coordinates to 4dp for ocean forecast requests', async () => {
    const json = { properties: { timeseries: [{ time: '2024-01-01T00:00:00Z', data: { instant: { details: { sea_surface_wave_height: 0.4 } } } }] } };
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit | undefined]>(async () => okJsonResponse(json));
    global.fetch = fetchMock as unknown as typeof fetch;

  const { fetchMetNoOceanForecast } = await import('./weatherService');

    const result = await fetchMetNoOceanForecast(60.123456, 5.987654);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain('lat=60.1235');
  expect(String(url)).toContain('lon=5.9877');
  expect(init?.headers).toBeDefined();
    expect(result?.properties?.timeseries?.length).toBe(1);
  });

  it('applies default User-Agent for location forecast', async () => {
    const json = { properties: { timeseries: [] } };
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit | undefined]>(async () => okJsonResponse(json));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchMetNoLocationForecast } = await import('./weatherService');

    await fetchMetNoLocationForecast(10.1234, -0.9876);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0];
  const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['User-Agent'] ?? headers['user-agent']).toMatch(/WotNow/);
  });

  it('returns null when MET Norway responds with error', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit | undefined]>(async () => ({ ok: false, status: 429 } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchMetNoOceanForecast } = await import('./weatherService');

    const result = await fetchMetNoOceanForecast(50, 10);
    expect(result).toBeNull();
  });
});
