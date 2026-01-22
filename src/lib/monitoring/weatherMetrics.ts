type OutcomeDetails = {
  status?: number;
  note?: string;
};

type ProviderMetric = {
  provider: string;
  requests: number;
  successes: number;
  failures: number;
  lastRequestAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastDurationMs?: number;
  avgDurationMs?: number;
  totalDurationMs: number;
  consecutiveFailures: number;
  lastStatus?: number;
  lastError?: string;
  lastEndpoint?: string;
  lastNote?: string;
  endpoints: Map<string, EndpointMetric>;
};

type EndpointMetric = {
  endpoint: string;
  requests: number;
  successes: number;
  failures: number;
  lastRequestAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastDurationMs?: number;
  avgDurationMs?: number;
  totalDurationMs: number;
  lastStatus?: number;
  lastError?: string;
};

type ProviderSnapshot = Omit<ProviderMetric, 'endpoints'> & {
  successRate: number;
  endpoints: EndpointSnapshot[];
};

type EndpointSnapshot = EndpointMetric & {
  successRate: number;
};

export type WeatherMetricsSnapshot = {
  startedAt: string;
  uptimeSeconds: number;
  totalProviders: number;
  totalRequests: number;
  providers: ProviderSnapshot[];
};

const nowISO = () => new Date().toISOString();
const clampError = (value: unknown, max = 500) =>
  String(value instanceof Error ? value.message : value ?? 'Unknown error').slice(0, max);

class WeatherMetrics {
  private providers = new Map<string, ProviderMetric>();
  private startedAt = Date.now();

  start(provider: string, endpoint: string, note?: string) {
    const providerMetric = this.ensureProvider(provider);
    const endpointMetric = this.ensureEndpoint(providerMetric, endpoint);
    const ts = nowISO();

    providerMetric.requests += 1;
    providerMetric.lastRequestAt = ts;
    providerMetric.lastEndpoint = endpoint;
    providerMetric.lastNote = note;

    endpointMetric.requests += 1;
    endpointMetric.lastRequestAt = ts;

    const started = Date.now();

    return {
      success: (details?: OutcomeDetails) => {
        const duration = Date.now() - started;
        this.applySuccess(providerMetric, endpointMetric, duration, details);
      },
      failure: (error: unknown, details?: OutcomeDetails) => {
        const duration = Date.now() - started;
        this.applyFailure(providerMetric, endpointMetric, duration, error, details);
      },
    };
  }

  snapshot(providerFilter?: string): WeatherMetricsSnapshot {
    const uptimeSeconds = (Date.now() - this.startedAt) / 1000;
    const providers = providerFilter
      ? [this.providers.get(providerFilter)].filter((p): p is ProviderMetric => p !== undefined)
      : Array.from(this.providers.values());

    const providerSnapshots: ProviderSnapshot[] = providers.map((metric) => {
      const { endpoints, totalDurationMs, ...rest } = metric;
      const endpointSnapshots: EndpointSnapshot[] = Array.from(endpoints.values()).map((endpoint) => ({
        ...endpoint,
        successRate: endpoint.requests ? endpoint.successes / endpoint.requests : 0,
      }));
      return {
        ...rest,
        totalDurationMs,
        endpoints: endpointSnapshots.sort((a, b) => b.requests - a.requests),
        successRate: metric.requests ? metric.successes / metric.requests : 0,
      };
    });

    const totalRequests = providerSnapshots.reduce((sum, p) => sum + p.requests, 0);

    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds,
      totalProviders: providerSnapshots.length,
      totalRequests,
      providers: providerSnapshots.sort((a, b) => b.requests - a.requests),
    };
  }

  reset(): void {
    this.providers.clear();
    this.startedAt = Date.now();
  }

  private ensureProvider(provider: string): ProviderMetric {
    if (!this.providers.has(provider)) {
      this.providers.set(provider, {
        provider,
        requests: 0,
        successes: 0,
        failures: 0,
        totalDurationMs: 0,
        consecutiveFailures: 0,
        endpoints: new Map<string, EndpointMetric>(),
      });
    }
    return this.providers.get(provider)!;
  }

  private ensureEndpoint(providerMetric: ProviderMetric, endpoint: string): EndpointMetric {
    if (!providerMetric.endpoints.has(endpoint)) {
      providerMetric.endpoints.set(endpoint, {
        endpoint,
        requests: 0,
        successes: 0,
        failures: 0,
        totalDurationMs: 0,
      });
    }
    return providerMetric.endpoints.get(endpoint)!;
  }

  private applySuccess(
    providerMetric: ProviderMetric,
    endpointMetric: EndpointMetric,
    duration: number,
    details?: OutcomeDetails
  ) {
    const ts = nowISO();
    providerMetric.successes += 1;
    providerMetric.totalDurationMs += duration;
    providerMetric.lastDurationMs = duration;
    providerMetric.avgDurationMs = providerMetric.successes
      ? providerMetric.totalDurationMs / providerMetric.successes
      : undefined;
    providerMetric.lastSuccessAt = ts;
    providerMetric.lastStatus = details?.status ?? providerMetric.lastStatus;
    providerMetric.consecutiveFailures = 0;
    providerMetric.lastError = undefined;

    endpointMetric.successes += 1;
    endpointMetric.totalDurationMs += duration;
    endpointMetric.lastDurationMs = duration;
    endpointMetric.avgDurationMs = endpointMetric.successes
      ? endpointMetric.totalDurationMs / endpointMetric.successes
      : undefined;
    endpointMetric.lastSuccessAt = ts;
    endpointMetric.lastStatus = details?.status ?? endpointMetric.lastStatus;
    endpointMetric.lastError = undefined;
  }

  private applyFailure(
    providerMetric: ProviderMetric,
    endpointMetric: EndpointMetric,
    duration: number,
    error: unknown,
    details?: OutcomeDetails
  ) {
    const ts = nowISO();
    const message = clampError(error);
    providerMetric.failures += 1;
    providerMetric.totalDurationMs += duration;
    providerMetric.lastDurationMs = duration;
    providerMetric.lastFailureAt = ts;
    providerMetric.lastError = message;
    providerMetric.lastStatus = details?.status ?? providerMetric.lastStatus;
    providerMetric.consecutiveFailures += 1;

    endpointMetric.failures += 1;
    endpointMetric.totalDurationMs += duration;
    endpointMetric.lastDurationMs = duration;
    endpointMetric.lastFailureAt = ts;
    endpointMetric.lastError = message;
    endpointMetric.lastStatus = details?.status ?? endpointMetric.lastStatus;
  }
}

export const weatherMetrics = new WeatherMetrics();

export async function monitoredFetch(
  provider: string,
  endpoint: string,
  input: RequestInfo | URL,
  init?: RequestInit,
  note?: string
): Promise<Response> {
  const span = weatherMetrics.start(provider, endpoint, note);
  try {
    const response = await fetch(input, init);
    if (response.ok) {
      span.success({ status: response.status });
    } else {
      span.failure(new Error(`HTTP ${response.status} ${response.statusText}`), { status: response.status });
    }
    return response;
  } catch (error) {
    span.failure(error);
    throw error;
  }
}
