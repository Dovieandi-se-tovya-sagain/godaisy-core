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

/**
 * A pathname only. A query or fragment here would carry parameters -- an apikey
 * among them -- past the rules that params follow. The message never echoes the
 * path, which could hold a key.
 */
function pathname(path: string): string {
  if (/[?#]/.test(path)) throw new TypeError('Open-Meteo path must be a pathname; pass parameters separately');
  return path.startsWith('/') ? path : `/${path}`;
}

function baseUrl(api: OpenMeteoApi, path: string, key: string | undefined): string {
  return `https://${hostFor(api, key)}${pathname(path)}`;
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
    // One normalised key controls both the host and apikey: never forward a caller's.
    if (name.toLowerCase() === 'apikey') continue;
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
): { url: string; params: Omit<P, 'apikey'> & { apikey?: string } } {
  const key = normaliseOpenMeteoApiKey(apiKey);
  // One normalised key controls both the host and apikey: never forward a caller's.
  const rest = Object.fromEntries(
    Object.entries(params).filter(([name]) => name.toLowerCase() !== 'apikey')
  ) as Omit<P, 'apikey'>;
  return {
    url: baseUrl(api, path, key),
    params: key ? { ...rest, apikey: key } : rest,
  };
}

/**
 * An `apikey` assignment wherever a word can start: at the start of the text, after
 * any non-letter (?, &, space, quote, comma, semicolon, bracket, newline, ...), or
 * after a percent-encoded character (`%3Fapikey`, `%253Fapikey` in an encoded URL).
 * Case-insensitive; plain (`apikey=`), URL-encoded (`apikey%3D`, `apikey%253D`) or a
 * property (`apikey: 'x'`, `"apikey":"x"`), with an optional opening quote. Group 1
 * is the preceding text and group 2 the
 * assignment, both kept. The value runs to the next separator, or in encoded text to
 * an encoded `&`. Over-redacting the tail of a message is acceptable; leaving part of
 * a key is not.
 */
const APIKEY_ASSIGNMENT = /(^|[^a-z]|%(?:25)*[0-9a-f]{2})(apikey(?:\s*=\s*|%((?:25)*)3d|["']?\s*:\s*)["']?)((?:%[0-9a-f]{2}|[^%&#\s"'`\\<>,;()[\]{}])*)/gi;

/**
 * Replace every apikey value. A bare or property value is the key whole, %26 and
 * all. An encoded assignment ends at an & encoded to the same level as its =
 * (`apikey%3D...%26`, `apikey%253D...%2526`); what follows is the next parameter,
 * which is checked again.
 */
function redactAssignments(text: string): string {
  return text.replace(
    APIKEY_ASSIGNMENT,
    (_match: string, before: string, assignment: string, level: string | undefined, value: string) => {
      if (level === undefined) return `${before}${assignment}REDACTED`;
      const end = value.toLowerCase().indexOf(`%${level}26`);
      return `${before}${assignment}REDACTED${end < 0 ? '' : redactAssignments(value.slice(end))}`;
    }
  );
}

/**
 * Replace any `apikey` value in a URL or message with REDACTED, and any literal
 * occurrence of the configured key (plain, URL-encoded or form-encoded) as well. Safe
 * to call on text with no key in it.
 */
export function redactOpenMeteoApiKey(text: string, apiKey: string | null | undefined = getOpenMeteoApiKey()): string {
  return redactText(text, normaliseOpenMeteoApiKey(apiKey));
}

/** Redact with an ALREADY-normalised key. No default, for the same reason as hostFor(). */
function redactText(text: string, key: string | undefined): string {
  let redacted = text;
  if (key) {
    // The exact key goes first. The generic assignment match below stops at an
    // encoded &, so run first it would cut a key like `abc&def` (sent as abc%26def)
    // in half and leave a tail the exact match could no longer find.
    // The key as written, as encodeURIComponent writes it, and as URLSearchParams
    // writes it into a request URL (openMeteoUrl above, and the SDK's own
    // `?${new URLSearchParams(params)}`): space as +, and different escapes for a
    // few punctuation characters. Longest first, so no variant is left half-done.
    // Each also encoded once more, as it appears inside an encoded URL (next=...).
    const form = new URLSearchParams({ k: key }).toString().slice(2);
    const once = [key, encodeURIComponent(key), form];
    const variants = new Set([...once, ...once.map((v) => encodeURIComponent(v))]);
    for (const variant of [...variants].sort((a, b) => b.length - a.length)) {
      redacted = redacted.split(variant).join('REDACTED');
    }
  }
  return redactAssignments(redacted);
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

/** Node's util.inspect.custom hook: user code a logger would run, so never trusted. */
const INSPECT_CUSTOM = Symbol.for('nodejs.util.inspect.custom');
/** Stands in for anything that could not be read. */
const UNREADABLE = '[unreadable]';
/** Collections larger than this are not rendered item by item; they force a copy. */
const MAX_ITEMS = 10_000;
/** The fields of an error a logger prints, when present (own or inherited). */
const ERROR_FIELDS: PropertyKey[] = ['name', 'message', 'stack', 'cause', 'errors'];

type Rendering = { text: string; verified: boolean };

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return UNREADABLE;
  }
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function readString(target: object, name: PropertyKey): string | undefined {
  try {
    const value = (target as Record<PropertyKey, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Everything a logger or serialiser could print for a value, as text, and whether
 * all of it was modelled.
 *
 * Covered, cycle-safe and with no depth limit: every own property -- string AND
 * symbol keys, enumerable or not, names as well as values -- of every error, plain
 * object, array, Map and Set (so custom properties on containers too); an error's
 * name, message, stack, cause and errors (AggregateError), inherited or own; array
 * items; Map keys and values; Set values; symbol descriptions; constructor names.
 *
 * `verified` turns false for anything not modelled -- a class instance, a function,
 * an inspect hook, a getter or proxy trap that throws, an oversized collection, the
 * stack running out -- and an unverified value is never passed through.
 */
function render(value: unknown): Rendering {
  const parts: string[] = [];
  const seen = new Set<object>();
  let verified = true;

  function text(v: unknown): string {
    try {
      return String(v);
    } catch {
      verified = false;
      return UNREADABLE;
    }
  }

  function read(target: object, name: PropertyKey): unknown {
    try {
      return (target as Record<PropertyKey, unknown>)[name];
    } catch {
      verified = false;
      return UNREADABLE;
    }
  }

  function ownKeys(target: object): PropertyKey[] {
    try {
      return Reflect.ownKeys(target);
    } catch {
      verified = false;
      return [];
    }
  }

  function props(target: object, names: PropertyKey[]): void {
    for (const name of names) {
      const value = read(target, name);
      // Printed as `name: value`, so a property like { apikey: 'x' } is seen as the
      // assignment it is, not as two unrelated strings.
      if (typeof name === 'string' && (typeof value === 'string' || typeof value === 'number')) {
        parts.push(`${name}: ${value}`);
        continue;
      }
      walk(name);
      walk(value);
    }
  }

  function walk(v: unknown): void {
    if (typeof v === 'string') {
      parts.push(v);
      return;
    }
    if (typeof v === 'symbol') {
      parts.push(text(v));
      return;
    }
    if (typeof v === 'function') {
      // A logger prints its name, and it may be a hook (toJSON, toString) that runs.
      verified = false;
      parts.push(`[function ${text(read(v, 'name'))}]`);
      return;
    }
    if (v === null || typeof v !== 'object') {
      parts.push(text(v));
      return;
    }
    if (seen.has(v)) {
      parts.push('[Circular]');
      return;
    }
    seen.add(v);
    try {
      if (INSPECT_CUSTOM in v) verified = false;
      const ctor = read(v, 'constructor');
      if (typeof ctor === 'function') parts.push(text(read(ctor, 'name')));

      if (isErrorLike(v)) {
        const names = ERROR_FIELDS.filter((name) => name in v);
        for (const name of ownKeys(v)) if (!names.includes(name)) names.push(name);
        props(v, names);
        return;
      }
      if (Array.isArray(v)) {
        if (v.length > MAX_ITEMS) {
          verified = false;
          return;
        }
        props(v, ownKeys(v).filter((name) => name !== 'length'));
        return;
      }
      if (v instanceof Map) {
        if (v.size > MAX_ITEMS) {
          verified = false;
          return;
        }
        Array.from(v.entries()).forEach(([entryKey, entryValue]) => {
          walk(entryKey);
          walk(entryValue);
        });
        props(v, ownKeys(v));
        return;
      }
      if (v instanceof Set) {
        if (v.size > MAX_ITEMS) {
          verified = false;
          return;
        }
        Array.from(v.values()).forEach((entry) => walk(entry));
        props(v, ownKeys(v));
        return;
      }
      const proto: unknown = Object.getPrototypeOf(v);
      if (proto === Object.prototype || proto === null) {
        props(v, ownKeys(v));
        return;
      }
      // Class instances, Dates, URLs, typed arrays, ...: not modelled. Render what
      // String() and their own properties show, but never pass the original through.
      verified = false;
      parts.push(text(v));
      props(v, ownKeys(v));
    } catch {
      verified = false; // a proxy trap or iterator threw, or the stack ran out
    }
  }

  walk(value);
  return { text: parts.join('\n'), verified };
}

/**
 * An Error, or a DOMException. In Node a DOMException is an Error, but not across
 * realms (Jest's test environment has its own Error), and there it would lose its
 * message and be printed as {}.
 */
function isErrorLike(v: unknown): v is Error {
  if (v instanceof Error) return true;
  return typeof DOMException !== 'undefined' && v instanceof DOMException;
}

function carriesKey(texts: Array<string | undefined>, key: string | undefined): boolean {
  return texts.some((t) => t !== undefined && redactText(t, key) !== t);
}

function errorLike(original: object, message: string, key: string | undefined): Error {
  try {
    // A DOMException (AbortError, TimeoutError, ...) keeps its class and name, so
    // cancellation handling still recognises it.
    if (typeof DOMException !== 'undefined' && original instanceof DOMException) {
      return new DOMException(message, redactText(readString(original, 'name') ?? 'Error', key));
    }
    if (AggregateErrorCtor && original instanceof AggregateErrorCtor) return new AggregateErrorCtor([], message);
    for (const Ctor of BUILTIN_ERROR_TYPES) if (original instanceof Ctor) return new Ctor(message);
  } catch {
    // A hostile prototype chain: fall through to a plain Error.
  }
  return new Error(message);
}

/**
 * The sanitised stand-in: a NEW error of the original's built-in type and name, whose
 * message is the redacted message and whose stack is the redacted rendering, with no
 * other properties -- nothing can survive in a symbol, a property name or a container.
 */
function sanitised(original: unknown, rendering: Rendering, key: string | undefined): unknown {
  if (original === null || (typeof original !== 'object' && typeof original !== 'function')) {
    return redactText(safeString(original), key);
  }
  let isError = false;
  try {
    isError = isErrorLike(original);
  } catch {
    // treat as a non-error
  }
  const ownMessage = isError ? readString(original, 'message') : undefined;
  const message = redactText(ownMessage ?? safeJson(original) ?? rendering.text, key);
  const out = errorLike(original, message, key);
  if (isError) {
    const name = readString(original, 'name');
    if (name !== undefined) {
      const redactedName = redactText(name, key);
      if (redactedName !== out.name) out.name = redactedName;
    }
  }
  out.stack = `${out.name}: ${message}\n    [Open-Meteo key redacted; what the original would have printed follows]\n${redactText(rendering.text, key)}`;
  return out;
}

/**
 * A value that is safe to log, record, rethrow or return -- defined by what gets
 * printed, not by object shape.
 *
 * The value is rendered as a logger or serialiser would see it (see render()), and
 * String() and JSON.stringify() of it are checked too. If none of that carries a key
 * and everything was modelled, the original is returned unchanged, so other
 * providers' errors keep their identity. Otherwise the result is a new error of the
 * same built-in type (TypeError, AggregateError, ...) and name, carrying the redacted
 * message and, as its stack, the redacted rendering -- and nothing else. Strings come
 * back redacted. If even this fails, a generic Error is returned; the original is
 * never handed back unverified.
 *
 * util.inspect is deliberately not used for the rendering: godaisy-core's copy of this
 * helper is part of the package entry point that browser bundles import, where
 * node:util is not reliably available, and the two copies are kept identical.
 */
export function redactOpenMeteoError(error: unknown, apiKey: string | null | undefined = getOpenMeteoApiKey()): unknown {
  const key = normaliseOpenMeteoApiKey(apiKey);
  try {
    if (typeof error === 'string') return redactText(error, key);
    const rendering = render(error);
    if (rendering.verified && !carriesKey([rendering.text, safeString(error), safeJson(error)], key)) return error;
    return sanitised(error, rendering, key);
  } catch {
    return new Error('[Open-Meteo error withheld: it could not be inspected safely]');
  }
}
