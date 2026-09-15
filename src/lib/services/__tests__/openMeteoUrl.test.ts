import { inspect } from 'util';
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
const everything = (value: unknown, seen: Set<unknown> = new Set()): string => {
  if (value instanceof Error) {
    if (seen.has(value)) return '[cycle]';
    seen.add(value);
    const cause = (value as Error & { cause?: unknown }).cause;
    return [value.name, value.message, value.stack ?? '', cause === undefined ? '' : everything(cause, seen)].join('\n');
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

  describe('redactOpenMeteoError: whatever a logger could print is checked', () => {
    const keyed = () => openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }, FAKE_KEY).toString();
    /** util.inspect as console.log uses it, and with hidden properties, plus a serialised view. */
    const shown = (value: unknown) =>
      [inspect(value, { depth: null }), inspect(value, { depth: null, showHidden: true }), everything(value)].join('\n');
    const withCause = <E extends Error>(err: E, cause: unknown): E => {
      Object.defineProperty(err, 'cause', { value: cause, writable: true, configurable: true, enumerable: false });
      return err;
    };
    const AggregateCtor = (globalThis as unknown as {
      AggregateError: new (errors: unknown[], message?: string) => Error & { errors: unknown[] };
    }).AggregateError;

    beforeEach(() => {
      process.env.OPEN_METEO_API_KEY = FAKE_KEY;
    });

    it('redacts a cause deeper than three levels, keeping its text', () => {
      let err: Error = new Error(`innermost ${keyed()}`);
      for (let i = 0; i < 6; i++) err = withCause(new Error(`level ${i}`), err);

      const safe = redactOpenMeteoError(err) as Error;
      expect(safe).not.toBe(err);
      expect(shown(safe)).not.toContain(FAKE_KEY);
      expect(safe.message).toBe('level 5');
      expect(safe.stack).toContain('innermost');
      expect(safe.stack).toContain('apikey=REDACTED');
    });

    it('handles a cyclic cause and keeps the error type', () => {
      const outer = new TypeError(`outer ${keyed()}`);
      withCause(outer, withCause(new Error('inner'), outer));

      const safe = redactOpenMeteoError(outer) as Error;
      expect(safe).toBeInstanceOf(TypeError);
      expect(safe.stack).toContain('[Circular]');
      expect(shown(safe)).not.toContain(FAKE_KEY);
    });

    it('redacts AggregateError.errors and keeps the type', () => {
      const agg = new AggregateCtor([new RangeError(`one ${keyed()}`), `two ${keyed()}`], 'several');
      const safe = redactOpenMeteoError(agg) as Error;
      expect(safe).toBeInstanceOf(AggregateCtor);
      expect(safe.stack).toContain('one');
      expect(safe.stack).toContain('two');
      expect(shown(safe)).not.toContain(FAKE_KEY);
    });

    it('redacts { cause: new Error(url) }, which JSON.stringify alone would miss', () => {
      const input = { cause: new Error(`failed ${keyed()}`) };
      expect(JSON.stringify(input)).not.toContain(FAKE_KEY);
      const safe = redactOpenMeteoError(input);
      expect(safe).not.toBe(input);
      expect(safe).toBeInstanceOf(Error);
      expect(shown(safe)).not.toContain(FAKE_KEY);
    });

    it('redacts an unserialisable object instead of returning it', () => {
      const cyclic: Record<string, unknown> = { url: keyed() };
      cyclic.self = cyclic;
      Object.defineProperty(cyclic, 'boom', {
        enumerable: true,
        get() {
          throw new Error('getter');
        },
      });
      expect(() => JSON.stringify(cyclic)).toThrow();

      const safe = redactOpenMeteoError(cyclic);
      expect(safe).not.toBe(cyclic);
      expect(shown(safe)).not.toContain(FAKE_KEY);
    });

    it('redacts errors and strings inside arrays and objects, and class instances', () => {
      const input = [new TypeError(`a ${keyed()}`), { nested: [`b ${keyed()}`], at: new URL(keyed()) }];
      const safe = redactOpenMeteoError(input);
      expect(safe).not.toBe(input);
      expect(shown(safe)).not.toContain(FAKE_KEY);
    });

    it('checks custom properties on an array, Map or Set inside a cause', () => {
      const containers: object[] = [
        Object.assign([1, 2], { extra: keyed() }),
        Object.assign(new Map([['a', 1]]), { extra: keyed() }),
        Object.assign(new Set([1]), { extra: keyed() }),
      ];
      for (const container of containers) {
        const err = withCause(new Error('outer'), container);
        expect(inspect(err, { depth: null })).toContain(FAKE_KEY); // what a logger would have printed
        const safe = redactOpenMeteoError(err);
        expect(safe).not.toBe(err);
        expect(shown(safe)).not.toContain(FAKE_KEY);
      }
    });

    it('checks symbol-keyed properties, enumerable or not', () => {
      for (const enumerable of [true, false]) {
        const err = new Error('plain message');
        Object.defineProperty(err, Symbol('meta'), { value: keyed(), enumerable });
        const safe = redactOpenMeteoError(err);
        expect(safe).not.toBe(err);
        expect(shown(safe)).not.toContain(FAKE_KEY);
      }
      const obj = { [Symbol('meta')]: keyed() };
      const safeObj = redactOpenMeteoError(obj);
      expect(safeObj).not.toBe(obj);
      expect(shown(safeObj)).not.toContain(FAKE_KEY);
    });

    it('redacts a symbol whose description contains the key', () => {
      const err = new Error('plain message');
      Object.defineProperty(err, Symbol(`key ${FAKE_KEY}`), { value: 'v', enumerable: true });
      for (const input of [err, { tag: Symbol(keyed()) }, Symbol(`bare ${FAKE_KEY}`)]) {
        const safe = redactOpenMeteoError(input);
        expect(safe).not.toBe(input);
        expect(shown(safe)).not.toContain(FAKE_KEY);
      }
    });

    it('redacts the key used as a property name, on errors, objects and Map keys', () => {
      const inputs: object[] = [
        Object.assign(new TypeError('plain message'), { [FAKE_KEY]: 1 }),
        Object.assign(new Error('plain message'), { [`url_${FAKE_KEY}`]: 1 }),
        { [FAKE_KEY]: 'v' },
        new Map([[FAKE_KEY, 'v']]),
      ];
      for (const input of inputs) {
        const safe = redactOpenMeteoError(input);
        expect(safe).not.toBe(input);
        expect(shown(safe)).not.toContain(FAKE_KEY);
      }
      expect(redactOpenMeteoError(inputs[0])).toBeInstanceOf(TypeError);
    });

    it('never passes through an inspect hook or a function property', () => {
      const hooked = { [inspect.custom]: () => `secret ${FAKE_KEY}` };
      expect(inspect(hooked)).toContain(FAKE_KEY); // what console.log would have printed
      const safe = redactOpenMeteoError(hooked);
      expect(safe).not.toBe(hooked);
      expect(shown(safe)).not.toContain(FAKE_KEY);

      const withFn = Object.assign(new Error('plain'), { toJSON: () => ({ url: keyed() }) });
      expect(redactOpenMeteoError(withFn)).not.toBe(withFn);
      expect(shown(redactOpenMeteoError(withFn))).not.toContain(FAKE_KEY);
    });

    it('never returns the unverified original, even when the chain exhausts the stack', () => {
      const limit = Error.stackTraceLimit;
      Error.stackTraceLimit = 0;
      try {
        let err: Error = new Error(`deep ${keyed()}`);
        for (let i = 0; i < 100_000; i++) err = withCause(new Error('wrap'), err);
        const safe = redactOpenMeteoError(err);
        expect(safe).not.toBe(err);
        expect(safe).toBeInstanceOf(Error);
        expect((safe as Error).message).not.toContain(FAKE_KEY);
        expect((safe as Error).stack).not.toContain(FAKE_KEY);
      } finally {
        Error.stackTraceLimit = limit;
      }
    });

    it('returns a clean nested structure as the same object', () => {
      const clean = withCause(
        new Error('outer'),
        withCause(new Error('inner'), { code: 'ECONNRESET', list: [1, 'x'], [Symbol('ok')]: 1, map: new Map([['a', 1]]) })
      );
      expect(redactOpenMeteoError(clean)).toBe(clean);
    });
  });

  describe('bare and encoded apikey assignments', () => {
    // A secret that is NOT the configured key, so only the apikey pattern can catch it.
    const SECRET = 'customer-secret';
    const shownAll = (value: unknown) =>
      [inspect(value, { depth: null }), inspect(value, { depth: null, showHidden: true }), everything(value)].join('\n');

    beforeEach(() => {
      delete process.env.OPEN_METEO_API_KEY;
    });

    it('redacts apikey= at the start and after every separator', () => {
      const separators = [' ', '"', "'", ',', ';', '(', '[', '{', '<', '\n', '\t', '?', '&', '=', ':', '|', '/', '_'];
      const texts = [
        `apikey=${SECRET}`,
        `APIKEY=${SECRET}`,
        `apikey="${SECRET}"`,
        `apikey='${SECRET}'`,
        ...separators.map((sep) => `failed${sep}apikey=${SECRET} tail`),
      ];
      for (const text of texts) {
        const redacted = redactOpenMeteoApiKey(text);
        expect(redacted).not.toContain(SECRET);
        expect(redacted).toMatch(/apikey=["']?REDACTED/i);
        expect(shownAll(redactOpenMeteoError(new Error(text)))).not.toContain(SECRET);
      }
    });

    it('redacts URL-encoded apikey%3D and double-encoded apikey%253D', () => {
      const url = `https://customer-api.open-meteo.com/v1/forecast?latitude=1&apikey=${SECRET}&hourly=x`;
      const once = `next=${encodeURIComponent(url)}`;
      const twice = encodeURIComponent(once);
      for (const text of [once, twice, `apikey%3d${SECRET}`, `APIKEY%3D${SECRET}`]) {
        expect(redactOpenMeteoApiKey(text)).not.toContain(SECRET);
        expect(shownAll(redactOpenMeteoError(new Error(text)))).not.toContain(SECRET);
      }
      // The value stops at the encoded &, so the next parameter survives.
      expect(redactOpenMeteoApiKey(once)).toContain('hourly%3Dx');
    });

    it('redacts the configured key in URL-encoded form too', () => {
      const awkward = 'a/b+c=d';
      const text = `x ${encodeURIComponent(awkward)} y ${awkward}`;
      const redacted = redactOpenMeteoApiKey(text, awkward);
      expect(redacted).not.toContain(encodeURIComponent(awkward));
      expect(redacted).not.toContain(awkward);
    });

    it('redacts the configured key in the form encoding the request URL uses', () => {
      // URLSearchParams writes a space as + and escapes some punctuation differently
      // from encodeURIComponent (for example ' ( ) * ~ !).
      for (const awkward of ['a b', "a'b(c)*d~e!f", 'a b/c+d']) {
        const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }, awkward);
        const formEncoded = url.searchParams.toString().split('apikey=')[1];
        const text = `failed near ${formEncoded} while fetching`;
        const redacted = redactOpenMeteoApiKey(text, awkward);
        expect(redacted).not.toContain(formEncoded);
        expect(redacted).toBe('failed near REDACTED while fetching');
      }
    });

    it('leaves no part of a key containing &, plain or inside an encoded URL', () => {
      // The request carries apikey=abc%26def; the generic match stops at %26.
      const awkward = 'abc&def';
      const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }, awkward).toString();
      const text = `fetch failed: ${url} (from next=${encodeURIComponent(url)}) raw ${awkward}`;
      const redacted = redactOpenMeteoApiKey(text, awkward);
      expect(redacted).not.toContain('abc');
      expect(redacted).not.toContain('def');
    });

    it('redacts an apikey that is the first parameter of an encoded URL', () => {
      // %3Fapikey: the character before apikey is the F of the encoded ?.
      const url = 'https://customer-api.open-meteo.com/v1/forecast?apikey=s3cr3tv4lue&latitude=1';
      const once = encodeURIComponent(url);
      for (const text of [once, encodeURIComponent(once)]) {
        const redacted = redactOpenMeteoApiKey(text, null);
        expect(redacted).not.toContain('s3cr3tv4lue');
        expect(redacted).toContain('latitude');
      }
    });

    it('redacts an apikey written as a property: JSON, inspected or plain', () => {
      for (const text of ['{"apikey":"s3cr3tv4lue"}', "{ apikey: 's3cr3tv4lue' }", 'apikey : s3cr3tv4lue']) {
        expect(redactOpenMeteoApiKey(text, null)).not.toContain('s3cr3tv4lue');
      }
    });

    it('sanitises an object carrying an apikey property, with no key configured', () => {
      delete process.env.OPEN_METEO_API_KEY;
      const safe = redactOpenMeteoError({ apikey: 's3cr3tv4lue' });
      expect(everything(safe)).not.toContain('s3cr3tv4lue');
    });

    it('redacts a whole bare value, %26 and all, with no key configured', () => {
      expect(redactOpenMeteoApiKey('GET /v1/forecast?apikey=abc%26def&latitude=1', null)).toBe(
        'GET /v1/forecast?apikey=REDACTED&latitude=1'
      );
      // Encoded once, the key's own & is %2526 and the separator %26.
      const once = encodeURIComponent('https://x.test/v1/forecast?apikey=abc%26def&latitude=1');
      const redacted = redactOpenMeteoApiKey(once, null);
      expect(redacted).not.toContain('def');
      expect(redacted).toContain('latitude');
    });

    it('keeps a DOMException a DOMException of the same name, redacting its message', () => {
      const key = 'k3y-for-dom';
      const safe = redactOpenMeteoError(new DOMException(`aborted apikey=${key}`, 'AbortError'), key);
      expect(safe).toBeInstanceOf(DOMException);
      expect((safe as DOMException).name).toBe('AbortError');
      expect(everything(safe)).not.toContain(key);
    });
  });

  describe('a caller-supplied apikey param', () => {
    it('is never sent by openMeteoUrl, with or without a configured key', () => {
      const params = { latitude: 1, apikey: 'caller', APIKey: 'caller2' };
      const free = openMeteoUrl('forecast', '/v1/forecast', params, null);
      expect(free.hostname).toBe('api.open-meteo.com');
      expect(free.toString()).not.toMatch(/apikey|caller/i);

      const keyed = openMeteoUrl('forecast', '/v1/forecast', params, 'k1');
      expect(keyed.searchParams.getAll('apikey')).toEqual(['k1']);
      expect(keyed.toString()).not.toContain('caller');
    });

    it('is never passed on in SDK params, with or without a configured key', () => {
      const params: Record<string, unknown> = { latitude: 1, apikey: 'caller', APIKey: 'caller2' };
      const free = openMeteoSdkRequest('forecast', '/v1/forecast', params, null);
      expect(free.params).toEqual({ latitude: 1 });

      const keyed = openMeteoSdkRequest('forecast', '/v1/forecast', params, 'k1');
      expect(keyed.params).toEqual({ latitude: 1, apikey: 'k1' });
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

    it('monitoredFetch keeps an AbortError from a request with no apikey as it is', async () => {
      // NWS, Met.no and OpenWeather share this wrapper; cancellation must stay an AbortError.
      const abort = new DOMException('The operation was aborted.', 'AbortError');
      global.fetch = jest.fn(async () => {
        throw abort;
      }) as unknown as typeof fetch;
      const thrown = await monitoredFetch('nws', 'points', new URL('https://api.weather.gov/points/1,1')).catch(
        (e: unknown) => e
      );
      expect(thrown).toBe(abort);
      expect((thrown as DOMException).name).toBe('AbortError');
    });

    it('monitoredFetch keeps an AbortError from a keyed request an AbortError', async () => {
      const url = openMeteoUrl('forecast', '/v1/forecast', { latitude: 1 }).toString();
      global.fetch = jest.fn(async () => {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }) as unknown as typeof fetch;
      const thrown = await monitoredFetch('open-meteo', 'forecast', url).catch((e: unknown) => e);
      expect(thrown).toBeInstanceOf(DOMException);
      expect((thrown as DOMException).name).toBe('AbortError');
      expect(everything(thrown)).not.toContain(FAKE_KEY);
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
