import {
  getOpenMeteoApiKey,
  normaliseOpenMeteoApiKey,
  openMeteoHost,
  openMeteoSdkRequest,
  openMeteoUrl,
  redactOpenMeteoApiKey,
  redactOpenMeteoError,
} from '../openMeteoUrl';
import { monitoredFetch, weatherMetrics } from '../../monitoring/weatherMetrics';

/** Everything a logger or serialiser could show for a value, as one string. */
const everything = (value: unknown): string => {
  if (value instanceof Error) {
    const cause = (value as Error & { cause?: unknown }).cause;
    return [value.name, value.message, value.stack ?? '', cause === undefined ? '' : everything(cause)].join('\n');
  }
  try {
    return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

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

  describe('apiKey override is normalised like the environment', () => {
    it('treats an empty or whitespace override as no key in every builder', () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY; // an explicit override wins over the env
      for (const override of ['', '   ', '\n']) {
        expect(normaliseOpenMeteoApiKey(override)).toBeUndefined();
        expect(openMeteoHost('forecast', override)).toBe('api.open-meteo.com');
        const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }, override);
        expect(url.origin).toBe('https://api.open-meteo.com');
        expect(url.searchParams.has('apikey')).toBe(false);
        const req = openMeteoSdkRequest('marine', '/v1/marine', { latitude: 1 }, override);
        expect(req.url).toBe('https://marine-api.open-meteo.com/v1/marine');
        expect(req.params).toEqual({ latitude: 1 });
      }
    });

    it('trims an override before choosing the host and sending apikey', () => {
      const padded = `  ${FAKE_KEY}\n`;
      expect(openMeteoHost('marine', padded)).toBe('customer-marine-api.open-meteo.com');
      expect(openMeteoUrl('forecast', '/v1/forecast', {}, padded).searchParams.get('apikey')).toBe(FAKE_KEY);
      expect(openMeteoSdkRequest('marine', '/v1/marine', {}, padded).params).toEqual({ apikey: FAKE_KEY });
    });

    it('null behaves as no key; undefined falls back to the environment', () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      expect(openMeteoHost('forecast', null)).toBe('api.open-meteo.com');
      expect(openMeteoHost('forecast', undefined)).toBe('customer-api.open-meteo.com');
    });

    it('does not mangle text when redacting with a whitespace override', () => {
      expect(redactOpenMeteoApiKey('a b c', '  ')).toBe('a b c');
      expect(redactOpenMeteoApiKey('a b c', '')).toBe('a b c');
    });
  });

  describe('redactOpenMeteoError', () => {
    const keyedUrl = () => openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }, FAKE_KEY).toString();

    it('redacts message, stack and cause, keeping the error name', () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      const err = new TypeError(`Failed to parse URL from ${keyedUrl()}`) as TypeError & { cause?: unknown };
      err.cause = new Error(`inner ${keyedUrl()}`);
      const safe = redactOpenMeteoError(err);
      expect(safe).toBeInstanceOf(Error);
      expect((safe as Error).name).toBe('TypeError');
      expect(everything(safe)).not.toContain(FAKE_KEY);
      expect((safe as Error).message).toContain('apikey=REDACTED');
    });

    it('redacts an apikey parameter even when no key is configured', () => {
      const safe = redactOpenMeteoError(new Error('bad https://x.test/v1?apikey=something'));
      expect(everything(safe)).not.toContain('something');
    });

    it('returns the same object when there is nothing to redact', () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      const err = new Error('fetch failed');
      expect(redactOpenMeteoError(err)).toBe(err);
      const obj = { status: 500 };
      expect(redactOpenMeteoError(obj)).toBe(obj);
    });

    it('redacts thrown strings and plain objects', () => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      expect(everything(redactOpenMeteoError(`x ${keyedUrl()}`))).not.toContain(FAKE_KEY);
      expect(everything(redactOpenMeteoError({ url: keyedUrl() }))).not.toContain(FAKE_KEY);
    });
  });

  describe('weather metrics never store the key', () => {
    beforeEach(() => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
      weatherMetrics.reset();
    });

    it('redacts errors and notes recorded directly on a span', () => {
      const url = openMeteoUrl('marine', '/v1/marine', { latitude: 1 }).toString();
      const span = weatherMetrics.start('open-meteo', 'marine', `note ${url}`);
      span.failure(new TypeError(`Failed to parse URL from ${url}`));
      const snapshot = JSON.stringify(weatherMetrics.snapshot());
      expect(snapshot).not.toContain(FAKE_KEY);
      expect(snapshot).toContain('apikey=REDACTED');
    });

    it('redacts before truncating, so a long error cannot leave part of the key', () => {
      const url = openMeteoUrl('forecast', '/v1/forecast', { pad: 'x'.repeat(470) }).toString();
      weatherMetrics.start('open-meteo', 'forecast').failure(new Error(url));
      expect(JSON.stringify(weatherMetrics.snapshot())).not.toContain(FAKE_KEY.slice(0, 6));
    });

    it('monitoredFetch records and rethrows a redacted error', async () => {
      const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }).toString();
      global.fetch = jest.fn(async () => {
        throw new TypeError(`Failed to parse URL from ${url}`);
      }) as unknown as typeof fetch;

      const thrown = await monitoredFetch('open-meteo', 'forecast', url).catch((e: unknown) => e);
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).name).toBe('TypeError');
      expect(everything(thrown)).not.toContain(FAKE_KEY);
      expect(JSON.stringify(weatherMetrics.snapshot())).not.toContain(FAKE_KEY);
    });

    it('monitoredFetch passes other errors through as the same object', async () => {
      const original = new Error('fetch failed');
      global.fetch = jest.fn(async () => {
        throw original;
      }) as unknown as typeof fetch;
      await expect(monitoredFetch('metno', 'x', 'https://example.test')).rejects.toBe(original);
    });

    it('the SDK marine path logs and records nothing that carries the key', async () => {
      global.fetch = jest.fn(async (input: unknown) => {
        throw new TypeError(`Failed to parse URL from ${String(input)}`);
      }) as unknown as typeof fetch;
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const { fetchOpenMeteoMarineSeries } = await import('../weatherService');
      const result = await fetchOpenMeteoMarineSeries(50, -5, '2026-09-15T00:00:00Z', '2026-09-16T00:00:00Z');

      expect(result).toBeNull();
      expect((global.fetch as unknown as jest.Mock).mock.calls[0][0]).toContain(`apikey=${FAKE_KEY}`);
      expect(warn).toHaveBeenCalled();
      for (const call of warn.mock.calls) {
        for (const arg of call) expect(everything(arg)).not.toContain(FAKE_KEY);
      }
      expect(JSON.stringify(weatherMetrics.snapshot())).not.toContain(FAKE_KEY);
      warn.mockRestore();
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
