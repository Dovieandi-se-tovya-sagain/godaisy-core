declare module 'openmeteo' {
  interface OpenMeteoVariable {
    value(): number | undefined;
    valuesArray(): ArrayLike<number> | null;
  }

  interface OpenMeteoSection {
    time(): number;
    timeEnd(): number;
    interval(): number;
    variables(index: number): OpenMeteoVariable | undefined;
  }

  interface OpenMeteoResponse {
    hourly(): OpenMeteoSection | undefined;
    current(): OpenMeteoSection | undefined;
  }

  export function fetchWeatherApi(url: string, params: Record<string, unknown>): Promise<OpenMeteoResponse[]>;
}
