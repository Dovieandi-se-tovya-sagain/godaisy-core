import {
  getOpenMeteoApiKey,
  openMeteoHost,
  openMeteoSdkRequest,
  openMeteoUrl,
  redactOpenMeteoApiKey,
} from '../openMeteoUrl';

// A placeholder, not a key. The real one lives only in environment stores.
const FAKE_KEY = 'fake-key-for-tests';

describe('openMeteoUrl', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPEN_METEO_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('without a key', () => {
    it('uses the free hosts and sends no apikey', () => {
      const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 50.1, longitude: -5.2 });
      expect(url.origin).toBe('https://api.open-meteo.com');
      expect(url.pathname).toBe('/v1/forecast');
      expect(url.searchParams.get('latitude')).toBe('50.1');
      expect(url.searchParams.has('apikey')).toBe(false);

      expect(openMeteoHost('marine')).toBe('marine-api.open-meteo.com');
      expect(openMeteoHost('airQuality')).toBe('air-quality-api.open-meteo.com');
      expect(openMeteoHost('geocoding')).toBe('geocoding-api.open-meteo.com');
      expect(openMeteoHost('elevation')).toBe('api.open-meteo.com');
    });

    it('treats an empty or whitespace secret as no key', () => {
      process.env.OPEN_METEO_API_KEY = '  \n';
      expect(getOpenMeteoApiKey()).toBeUndefined();
      expect(openMeteoHost('forecast')).toBe('api.open-meteo.com');
    });

    it('leaves SDK params untouched', () => {
      const params = { latitude: 1, hourly: ['wave_height', 'wave_period'] };
      const req = openMeteoSdkRequest('marine', '/v1/marine', params);
      expect(req.url).toBe('https://marine-api.open-meteo.com/v1/marine');
      expect(req.params).toEqual(params);
    });
  });

  describe('with a key', () => {
    beforeEach(() => {
      process.env.OPEN_METEO_API_KEY = `${FAKE_KEY}\n`;
    });

    it('uses the customer host and appends a trimmed apikey', () => {
      const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 50.1, hourly: ['a', 'b'] });
      expect(url.origin).toBe('https://customer-api.open-meteo.com');
      expect(url.searchParams.get('apikey')).toBe(FAKE_KEY);
      expect(url.searchParams.get('hourly')).toBe('a,b');
    });

    it('maps every API to customer- plus its free host', () => {
      expect(openMeteoHost('marine')).toBe('customer-marine-api.open-meteo.com');
      expect(openMeteoHost('airQuality')).toBe('customer-air-quality-api.open-meteo.com');
      expect(openMeteoHost('geocoding')).toBe('customer-geocoding-api.open-meteo.com');
      expect(openMeteoHost('elevation')).toBe('customer-api.open-meteo.com');
      expect(openMeteoHost('archive')).toBe('customer-archive-api.open-meteo.com');
    });

    it('puts the key in SDK params, never in the SDK base URL', () => {
      const req = openMeteoSdkRequest('marine', '/v1/marine', { latitude: 1 });
      expect(req.url).toBe('https://customer-marine-api.open-meteo.com/v1/marine');
      expect(req.url).not.toContain('?');
      expect(req.params).toEqual({ latitude: 1, apikey: FAKE_KEY });
    });

    it('skips null and undefined params', () => {
      const url = openMeteoUrl('forecast', 'v1/forecast', { a: undefined, b: null, c: 0 });
      expect(url.pathname).toBe('/v1/forecast');
      expect([...url.searchParams.keys()]).toEqual(['c', 'apikey']);
    });
  });

  describe('redactOpenMeteoApiKey', () => {
    it('redacts apikey in URLs and in free text', () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      const url = openMeteoUrl('airQuality', '/v1/air-quality', { latitude: 1 }).toString();
      const redacted = redactOpenMeteoApiKey(`failed: ${url} (key ${FAKE_KEY})`);
      expect(redacted).not.toContain(FAKE_KEY);
      expect(redacted).toContain('apikey=REDACTED');
      expect(redacted).toContain('latitude=1');
    });

    it('redacts an apikey parameter even when no key is configured', () => {
      expect(redactOpenMeteoApiKey('https://x.test/v1?apikey=abc&b=1')).toBe(
        'https://x.test/v1?apikey=REDACTED&b=1'
      );
      expect(redactOpenMeteoApiKey('no key here')).toBe('no key here');
    });
  });

  describe('call sites', () => {
    it('air-quality errors report the customer URL with the key redacted', async () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      const fetchMock = jest.fn(async () => ({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ reason: 'test' }),
      })) as unknown as typeof fetch;
      global.fetch = fetchMock;

      const { fetchOpenMeteoAirPollen } = await import('../weatherService');
      const err = await fetchOpenMeteoAirPollen(1, 2, '2026-09-15', '2026-09-16').catch((e: Error) => e);

      const requested = String((fetchMock as unknown as jest.Mock).mock.calls[0][0]);
      expect(requested.startsWith('https://customer-air-quality-api.open-meteo.com/v1/air-quality?')).toBe(true);
      expect(requested).toContain(`apikey=${FAKE_KEY}`);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('customer-air-quality-api.open-meteo.com');
      expect((err as Error).message).not.toContain(FAKE_KEY);
    });

    it('forecast requests use the free host when no key is set', async () => {
      const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
      global.fetch = fetchMock;

      const { fetchOpenMeteoWeather } = await import('../weatherService');
      await fetchOpenMeteoWeather(1, 2, '2026-09-15', '2026-09-16');

      const requested = String((fetchMock as unknown as jest.Mock).mock.calls[0][0]);
      expect(requested.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
      expect(requested).not.toContain('apikey');
    });
  });
});
