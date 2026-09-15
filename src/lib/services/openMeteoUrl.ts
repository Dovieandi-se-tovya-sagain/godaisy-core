/**
 * The one place an Open-Meteo request URL is built.
 *
 * With OPEN_METEO_API_KEY set, requests go to the paid customer servers and carry
 * `apikey`; without it they go to the free servers exactly as before. Nothing else
 * about a request changes -- the customer API takes the same paths and parameters.
 *
 * Confirmed 2026-09-15 from open-meteo.com:
 *   - /en/pricing: "The customer endpoint is customer-api.open-meteo.com; requests
 *     include &apikey=abc123."
 *   - every /en/docs page: "the server URL requires the prefix customer-".
 *   - the docs site's own URL builder (open-meteo/open-meteo-website,
 *     results-preview.svelte) forms it as `https://customer-${serverPrefix}.open-meteo.com`,
 *     where serverPrefix is the free host's first label -- so customer-marine-api,
 *     customer-air-quality-api, customer-geocoding-api and so on.
 *
 * Every builder takes an optional `apiKey` override. Omitted (or `undefined`), it
 * defaults to the environment; either way the value is normalised once -- trimmed,
 * and empty or whitespace means "no key" -- and that single value decides both the
 * host and the `apikey` parameter.
 *
 * The key is read on the server only. In a browser bundle OPEN_METEO_API_KEY is
 * undefined (it is not NEXT_PUBLIC_), so browser code keeps using the free host and
 * the key cannot leak into client JS.
 *
 * A URL built here carries the key. Never log, store, throw or return one without
 * redactOpenMeteoApiKey(); never log or record a caught error from a request made
 * with one without redactOpenMeteoError(). Node's fetch puts the full URL in the
 * message and stack of a "Failed to parse URL" TypeError (measured 2026-09-15).
 */

/** Only APIs whose free host was verified against open-meteo.com/en/docs. */
export type OpenMeteoApi =
  | 'forecast'
  | 'marine'
  | 'airQuality'
  | 'geocoding'
  | 'elevation'
  | 'archive'
  | 'ensemble'
  | 'flood';

/** First label of each API's FREE host; the customer host is `customer-` + this. */
const HOST_PREFIX: Record<OpenMeteoApi, string> = {
  forecast: 'api',
  elevation: 'api',
  marine: 'marine-api',
  airQuality: 'air-quality-api',
  geocoding: 'geocoding-api',
  archive: 'archive-api',
  ensemble: 'ensemble-api',
  flood: 'flood-api',
};

export type OpenMeteoParamValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string | number>
  | null
  | undefined;

/**
 * Trim a key; empty or whitespace-only means no key. Trimming matters because a
 * pasted secret with a trailing newline would otherwise be sent and rejected.
 */
export function normaliseOpenMeteoApiKey(value: string | null | undefined): string | undefined {
  const key = typeof value === 'string' ? value.trim() : '';
  return key ? key : undefined;
}

/** The configured customer key from OPEN_METEO_API_KEY, normalised, or undefined. */
export function getOpenMeteoApiKey(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return normaliseOpenMeteoApiKey(process.env.OPEN_METEO_API_KEY);
}

/**
 * Host for an ALREADY-normalised key. Deliberately has no default: passing a key
 * that normalised to undefined into openMeteoHost() would trigger its default
 * parameter and pick the environment key back up.
 */
function hostFor(api: OpenMeteoApi, key: string | undefined): string {
  return `${key ? 'customer-' : ''}${HOST_PREFIX[api]}.open-meteo.com`;
}

export function openMeteoHost(api: OpenMeteoApi, apiKey: string | null | undefined = getOpenMeteoApiKey()): string {
  return hostFor(api, normaliseOpenMeteoApiKey(apiKey));
}

function baseUrl(api: OpenMeteoApi, path: string, key: string | undefined): string {
  return `https://${hostFor(api, key)}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Build a request URL. Arrays are joined with commas, null/undefined params are
 * skipped, and `apikey` is appended only when a key is configured.
 *
 * Cache keys must not be derived from this URL -- it contains the key when one is set.
 */
export function openMeteoUrl(
  api: OpenMeteoApi,
  path: string,
  params: Record<string, OpenMeteoParamValue> = {},
  apiKey: string | null | undefined = getOpenMeteoApiKey()
): URL {
  const key = normaliseOpenMeteoApiKey(apiKey);
  const url = new URL(baseUrl(api, path, key));
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  if (key) url.searchParams.set('apikey', key);
  return url;
}

/**
 * Arguments for the `openmeteo` SDK's fetchWeatherApi(url, params), which appends
 * `?${new URLSearchParams(params)}` itself -- so the URL must carry no query string
 * and the key has to travel in params.
 */
export function openMeteoSdkRequest<P extends Record<string, unknown>>(
  api: OpenMeteoApi,
  path: string,
  params: P,
  apiKey: string | null | undefined = getOpenMeteoApiKey()
): { url: string; params: P & { apikey?: string } } {
  const key = normaliseOpenMeteoApiKey(apiKey);
  return {
    url: baseUrl(api, path, key),
    params: key ? { ...params, apikey: key } : params,
  };
}

const APIKEY_PARAM = /([?&]apikey=)[^&#\s"'\\]*/gi;

/**
 * Replace any `apikey=` value in a URL or message with REDACTED, and any literal
 * occurrence of the configured key as well. Safe to call on text with no key in it.
 */
export function redactOpenMeteoApiKey(text: string, apiKey: string | null | undefined = getOpenMeteoApiKey()): string {
  return redactText(text, normaliseOpenMeteoApiKey(apiKey));
}

/** Redact with an ALREADY-normalised key. No default, for the same reason as hostFor(). */
function redactText(text: string, key: string | undefined): string {
  const redacted = text.replace(APIKEY_PARAM, '$1REDACTED');
  return key ? redacted.split(key).join('REDACTED') : redacted;
}

/** Built-in error types a redacted copy keeps. AggregateError is handled separately. */
const BUILTIN_ERROR_TYPES: ReadonlyArray<new (message?: string) => Error> = [
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  EvalError,
  URIError,
];
const AggregateErrorCtor = (globalThis as {
  AggregateError?: new (errors: Iterable<unknown>, message?: string) => Error;
}).AggregateError;

/** Stands in for anything that could not be read. */
const UNREADABLE = '[unreadable]';
/** Arrays longer than this are not walked item by item; they are treated as unverifiable. */
const MAX_ARRAY_ITEMS = 10_000;
/** The fields of an error a logger prints, when present. */
const ERROR_FIELDS = ['name', 'message', 'stack', 'cause', 'errors'];

type FieldRead = { ok: true; value: unknown } | { ok: false };
type Field = { name: unknown; read: FieldRead };
type Shape = 'error' | 'array' | 'plain' | 'map' | 'set' | 'opaque';

function readField(target: object, name: PropertyKey): FieldRead {
  try {
    return { ok: true, value: (target as Record<PropertyKey, unknown>)[name] };
  } catch {
    return { ok: false };
  }
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return UNREADABLE;
  }
}

function shapeOf(value: object): Shape {
  try {
    if (value instanceof Error) return 'error';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Map) return 'map';
    if (value instanceof Set) return 'set';
    const proto: unknown = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null ? 'plain' : 'opaque';
  } catch {
    return 'opaque'; // e.g. a proxy whose traps throw
  }
}

/**
 * Every field a logger could print, or null when the structure cannot be read:
 * an error's name, message, stack, cause and errors plus its own enumerable
 * properties; array items; plain-object properties; Map and Set entries.
 */
function fieldsOf(value: object, shape: Exclude<Shape, 'opaque'>): Field[] | null {
  try {
    switch (shape) {
      case 'error': {
        const names = ERROR_FIELDS.filter((name) => name in value);
        for (const own of Object.keys(value)) if (!names.includes(own)) names.push(own);
        return names.map((name) => ({ name, read: readField(value, name) }));
      }
      case 'array': {
        const { length } = value as unknown[];
        if (length > MAX_ARRAY_ITEMS) return null;
        return Array.from({ length }, (_, index) => ({ name: index, read: readField(value, index) }));
      }
      case 'plain':
        return Object.keys(value).map((name) => ({ name, read: readField(value, name) }));
      case 'map':
        return Array.from((value as Map<unknown, unknown>).entries(), ([name, entry]) => ({
          name,
          read: { ok: true, value: entry } as const,
        }));
      case 'set':
        return Array.from((value as Set<unknown>).values(), (entry, index) => ({
          name: index,
          read: { ok: true, value: entry } as const,
        }));
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** True if anything reachable could print a key, or could not be verified. */
function leaks(value: unknown, key: string | undefined, seen: Set<object>): boolean {
  if (typeof value === 'string') return redactText(value, key) !== value;
  if (typeof value === 'function' || typeof value === 'symbol') return true;
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const shape = shapeOf(value);
  if (shape === 'opaque') return true;
  const fields = fieldsOf(value, shape);
  if (fields === null) return true;
  return fields.some((field) => !field.read.ok || leaks(field.name, key, seen) || leaks(field.read.value, key, seen));
}

function errorLike(original: object, message: string): Error {
  try {
    if (AggregateErrorCtor && original instanceof AggregateErrorCtor) return new AggregateErrorCtor([], message);
    for (const Ctor of BUILTIN_ERROR_TYPES) if (original instanceof Ctor) return new Ctor(message);
  } catch {
    // A hostile prototype chain: fall through to a plain Error.
  }
  return new Error(message);
}

/** A redacted copy. `memo` maps each original object to its copy, so cycles survive. */
function copy(value: unknown, key: string | undefined, memo: Map<object, unknown>): unknown {
  if (typeof value === 'string') return redactText(value, key);
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'symbol') return redactText(safeString(value), key);
  if (value === null || typeof value !== 'object') return value;
  if (memo.has(value)) return memo.get(value);

  const shape = shapeOf(value);
  const fields = shape === 'opaque' ? null : fieldsOf(value, shape);
  if (shape === 'opaque' || fields === null) {
    // Class instances and unreadable structures become a redacted string; a URL
    // object, for instance, renders as its (redacted) href.
    const text = redactText(safeString(value), key);
    memo.set(value, text);
    return text;
  }
  const item = (read: FieldRead) => (read.ok ? copy(read.value, key, memo) : UNREADABLE);

  switch (shape) {
    case 'array': {
      const out: unknown[] = [];
      memo.set(value, out);
      for (const field of fields) out.push(item(field.read));
      return out;
    }
    case 'plain': {
      const out: Record<string, unknown> = {};
      memo.set(value, out);
      for (const field of fields) out[redactText(safeString(field.name), key)] = item(field.read);
      return out;
    }
    case 'map': {
      const out = new Map<unknown, unknown>();
      memo.set(value, out);
      for (const field of fields) out.set(copy(field.name, key, memo), item(field.read));
      return out;
    }
    case 'set': {
      const out = new Set<unknown>();
      memo.set(value, out);
      for (const field of fields) out.add(item(field.read));
      return out;
    }
    default: {
      const messageRead = fields.find((field) => field.name === 'message')?.read;
      const message = messageRead?.ok
        ? redactText(typeof messageRead.value === 'string' ? messageRead.value : safeString(messageRead.value), key)
        : UNREADABLE;
      const out = errorLike(value, message) as Error & Record<string, unknown>;
      memo.set(value, out);
      for (const field of fields) {
        const name = String(field.name);
        if (name === 'message') continue;
        if (name === 'stack') {
          out.stack = field.read.ok && typeof field.read.value === 'string'
            ? redactText(field.read.value, key)
            : `${out.name}: ${message}`;
          continue;
        }
        if (name === 'name') {
          if (field.read.ok && typeof field.read.value === 'string') {
            const redactedName = redactText(field.read.value, key);
            if (redactedName !== out.name) out.name = redactedName;
          }
          continue;
        }
        const safeValue = item(field.read);
        if (name === 'cause' || name === 'errors') {
          // Non-enumerable, as on a native error, so loggers print [cause] / [errors].
          Object.defineProperty(out, name, { value: safeValue, writable: true, configurable: true, enumerable: false });
        } else {
          out[name] = safeValue;
        }
      }
      return out;
    }
  }
}

/**
 * A value that is safe to log, record, rethrow or return.
 *
 * The whole structure is walked -- cycle-safe, with no depth limit -- through every
 * field a logger could print: an error's name, message, stack, `cause` and `errors`
 * (AggregateError) and its own enumerable properties; array items; plain-object keys
 * and values; Map and Set entries.
 *
 * If nothing reachable carries a key, the original is returned unchanged, so other
 * providers' errors keep their identity (monitoredFetch relies on this). Otherwise a
 * redacted copy is returned: errors keep their built-in type (TypeError,
 * AggregateError, ...) and name, cycles are preserved, and anything that cannot be
 * verified -- class instances, functions, throwing getters, proxies -- becomes a
 * redacted string or a placeholder rather than being passed through. If even that
 * fails (a chain deep enough to exhaust the stack, say), a generic Error is returned.
 * The original is never handed back unverified.
 */
export function redactOpenMeteoError(error: unknown, apiKey: string | null | undefined = getOpenMeteoApiKey()): unknown {
  const key = normaliseOpenMeteoApiKey(apiKey);
  try {
    return leaks(error, key, new Set()) ? copy(error, key, new Map()) : error;
  } catch {
    return new Error('[Open-Meteo error withheld: it could not be inspected safely]');
  }
}
