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
 * The key is read on the server only. In a browser bundle OPEN_METEO_API_KEY is
 * undefined (it is not NEXT_PUBLIC_), so browser code keeps using the free host and
 * the key cannot leak into client JS. Never log a URL built here without passing it
 * through redactOpenMeteoApiKey().
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
 * The configured customer key, or undefined. Trimmed because a pasted secret with a
 * trailing newline would otherwise be sent as part of the key and rejected.
 */
export function getOpenMeteoApiKey(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const key = process.env.OPEN_METEO_API_KEY?.trim();
  return key ? key : undefined;
}

export function openMeteoHost(api: OpenMeteoApi, apiKey: string | undefined = getOpenMeteoApiKey()): string {
  return `${apiKey ? 'customer-' : ''}${HOST_PREFIX[api]}.open-meteo.com`;
}

function baseUrl(api: OpenMeteoApi, path: string, apiKey: string | undefined): string {
  return `https://${openMeteoHost(api, apiKey)}${path.startsWith('/') ? path : `/${path}`}`;
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
  apiKey: string | undefined = getOpenMeteoApiKey()
): URL {
  const url = new URL(baseUrl(api, path, apiKey));
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  if (apiKey) url.searchParams.set('apikey', apiKey);
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
  apiKey: string | undefined = getOpenMeteoApiKey()
): { url: string; params: P & { apikey?: string } } {
  return {
    url: baseUrl(api, path, apiKey),
    params: apiKey ? { ...params, apikey: apiKey } : params,
  };
}

const APIKEY_PARAM = /([?&]apikey=)[^&#\s"'\\]*/gi;

/**
 * Replace any `apikey=` value in a URL or message with REDACTED, and any literal
 * occurrence of the configured key as well. Safe to call on text with no key in it.
 */
export function redactOpenMeteoApiKey(text: string, apiKey: string | undefined = getOpenMeteoApiKey()): string {
  const redacted = text.replace(APIKEY_PARAM, '$1REDACTED');
  return apiKey ? redacted.split(apiKey).join('REDACTED') : redacted;
}
