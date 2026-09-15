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
  const key = normaliseOpenMeteoApiKey(apiKey);
  const redacted = text.replace(APIKEY_PARAM, '$1REDACTED');
  return key ? redacted.split(key).join('REDACTED') : redacted;
}

/**
 * An error that is safe to log, record or rethrow: message, stack and cause chain
 * redacted. Returns the original value untouched when there is nothing to redact,
 * so callers that compare identity or inspect other providers' errors see no change.
 */
export function redactOpenMeteoError(
  error: unknown,
  apiKey: string | null | undefined = getOpenMeteoApiKey(),
  depth = 0
): unknown {
  if (typeof error === 'string') return redactOpenMeteoApiKey(error, apiKey);
  if (!(error instanceof Error)) {
    if (error === null || typeof error !== 'object') return error;
    // A thrown plain object (e.g. { status, url }). Only replace it if it leaks.
    try {
      const text = JSON.stringify(error);
      if (text !== undefined) {
        const safe = redactOpenMeteoApiKey(text, apiKey);
        if (safe !== text) return safe;
      }
    } catch {
      // Unserialisable (cyclic) -- leave it; String() of it cannot carry a URL.
    }
    return error;
  }

  const message = redactOpenMeteoApiKey(error.message, apiKey);
  const stack = error.stack === undefined ? undefined : redactOpenMeteoApiKey(error.stack, apiKey);
  const original = error as Error & { cause?: unknown };
  const hasCause = 'cause' in original && original.cause !== undefined;
  const cause = hasCause && depth < 3 ? redactOpenMeteoError(original.cause, apiKey, depth + 1) : original.cause;
  if (message === error.message && stack === error.stack && cause === original.cause) return error;

  const safe = new Error(message) as Error & { cause?: unknown };
  safe.name = error.name;
  if (stack !== undefined) safe.stack = stack;
  if (hasCause) safe.cause = cause;
  return safe;
}
