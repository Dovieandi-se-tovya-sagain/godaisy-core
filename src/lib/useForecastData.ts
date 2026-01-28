"use client";
import { useEffect, useState } from "react";
import type { OWMForecastSlot, MarineRow } from "./types";
import dayjs from "dayjs";

// Keep client requests aligned with server/cache precision (~110 m)
const round3dp = (n: number) => Math.round(n * 1e3) / 1e3;

/**
 * Fetches OpenWeather and Stormglass marine data using Next.js API routes.
 * Always uses /api/marine for marine data requests from the frontend.
 */
export function useForecastData(mainLat?: number, mainLon?: number, coastalLat?: number, coastalLon?: number) {
  const [slots, setSlots] = useState<OWMForecastSlot[]>([]);
  const [marine, setMarine] = useState<MarineRow[][]>([[], [], [], [], [], [], [], []]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    // OpenWeather
    if (mainLat && mainLon) {
      fetch(`/api/owm?lat=${mainLat}&lon=${mainLon}&units=metric`)
        .then(r => r.json())
        .then(d => setSlots(d.list as OWMForecastSlot[]))
        .catch(() => setSlots([]));
    } else {
      setSlots([]);
    }

    // Always use /api/marine for marine data
    if (coastalLat && coastalLon) {
      const rlat = round3dp(coastalLat);
      const rlon = round3dp(coastalLon);
      fetch(`/api/marine?lat=${rlat}&lon=${rlon}`)
        .then(r => r.json())
        .then(d => {
          const rows: MarineRow[] = mapStormglass(d as unknown);
          const grouped: MarineRow[][] = [[], [], [], [], [], [], [], []];
          rows.forEach(r => {
            const diff = dayjs(r.iso).startOf("day")
              .diff(dayjs().startOf("day"), "day");
            if (diff >= 0 && diff < 8) grouped[diff].push(r);
          });
          setMarine(grouped);
        })
        .catch(() => setMarine([[], [], [], [], [], [], [], []]))
        .finally(() => setLoading(false));
    } else {
      setMarine([[], [], [], [], [], [], [], []]);
      setLoading(false);
    }
  }, [mainLat, mainLon, coastalLat, coastalLon]);

  return { slots, marine, loading };
}

function mapStormglass(json: unknown): MarineRow[] {
  const hours = (json as { hours?: unknown[] })?.hours;
  const arr: unknown[] = Array.isArray(hours) ? hours : [];
  return arr.map((hUnknown): MarineRow => {
    const h = hUnknown as Record<string, unknown>;
    const iso = String(h.time ?? "");
    const local = new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const pick = (p: string) => {
      const slot = h[p] as Record<string, unknown> | undefined;
      const sg = typeof slot?.sg === 'number' ? slot?.sg as number : Number(slot?.sg);
      const noaa = typeof slot?.noaa === 'number' ? slot?.noaa as number : Number(slot?.noaa);
      const val = Number.isFinite(sg) ? sg : (Number.isFinite(noaa) ? noaa : 0);
      return val;
    };

    const water = pick("waterTemperature");
    const classify = (v: number) =>
      v < 15
        ? "very-cold"
        : v < 18
          ? "cold"
          : v < 20
            ? "cool"
            : v < 24
              ? "comfort"
              : v < 28
                ? "warm"
                : "hot";

    return {
      iso,
      local,
      water,
      className: classify(water),
      wave: pick("waveHeight"),
      wind: pick("windSpeed"),
      gust: pick("windGusts"),
      swell: pick("swellHeight"),
      swellDir: pick("swellDirection"),
      period: Math.round(pick("swellPeriod")),
      vis: Math.round(pick("visibility")),
      current: pick("currentSpeed").toFixed(1),
    } as MarineRow;
  });
}

// NOTE: This module exports only the hook. Page components live under pages/.
