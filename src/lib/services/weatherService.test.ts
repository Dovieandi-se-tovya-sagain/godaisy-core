/**
 * Two suites lived here originally. The other one -- 'free provider priority
 * selection' -- has been removed rather than fixed, because its subject is not
 * in this repository.
 *
 * It dynamically imported ../../pages/api/unified-weather and asserted on the
 * handler's status, body and X-Weather-Source header. There is no src/pages
 * here; this package is a library, and that route lives in the consuming app
 * (findr: pages/api/unified-weather.ts, with the header emitted by
 * lib/weather/unifiedWeatherCore.ts). The import could never have resolved,
 * which nobody discovered because no runner ever executed this file.
 *
 * The intent is worth keeping -- provider ordering is exactly the kind of thing
 * that breaks quietly -- so those cases belong in findr, next to the route they
 * describe. Deleted here, not deleted everywhere.
 */
const okJsonResponse = (data: unknown) => ({
  ok: true,
  async json() {
    return data;
  },
}) as Response;


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
