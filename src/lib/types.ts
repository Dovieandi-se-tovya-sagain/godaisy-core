/* lib/types.ts */

/** Sub-set of OpenWeather’s /forecast response we actually use */
export interface OWMForecastSlot {
  dt: number;                                   // Unix seconds
  dt_txt: string;                               // "YYYY-MM-DD HH:mm:ss"
  main: { temp: number };
  weather: Array<{
    icon: string;                               // e.g. "01d", "01n"
    description: string;
  }>;
  wind: { speed: number; gust?: number };
  pop: number;                                  // 0–1
  rain?: { ["3h"]: number };
  snow?: { ["3h"]: number };
}

/** Normalised Marine row for a single UTC hour */
export interface MarineRow {
  iso:   string;    // ISO string of hour start
  local: string;    // Locale-formatted time (HH:mm)
  water: number;
  wave:  number;
  wind:  number;
  gust?: number;
  swell:number;
  swellDir:number;  // ° true
  period:number;
  vis:   number;    // kilometres
  current:string;   // knots, already formatted
  className:string; // CSS class for heat-map
}
