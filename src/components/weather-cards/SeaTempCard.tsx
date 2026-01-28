"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { round3dp, createCacheKey, COORDINATE_PRECISION } from "../../lib/utils/coordinates";

/* -------------------------------------------------------------------------- */
/*                                 Utilities                                  */
/* -------------------------------------------------------------------------- */

const clamp = (v: number, min = 0, max = 40) => Math.max(min, Math.min(max, v));

function getSeaTempColor(tempC: number): string {
  if (tempC <= 5)  return "#08306b";
  if (tempC <= 10) return "#2171b5";
  if (tempC <= 15) return "#41b6c4";
  if (tempC <= 18) return "#a1dab4";
  if (tempC <= 21) return "#ffffb2";
  if (tempC <= 24) return "#fecc5c";
  if (tempC <= 27) return "#fd8d3c";
  if (tempC <= 30) return "#e31a1c";
  return "#b10026";
}

const chipTextColorForTemp = (tempC: number): string =>
  (tempC <= 12 || tempC >= 27) ? "#fff" : "#000";

/* -------------------------------------------------------------------------- */
/*                               Temperature Bands                            */
/* -------------------------------------------------------------------------- */

const BANDS = [
  { min: -5, max: 8,  id: "freezing"  as const },
  { min: 8,  max: 12, id: "very_cold" as const },
  { min: 12, max: 15, id: "chilly"    as const },
  { min: 15, max: 18, id: "cool"      as const },
  { min: 18, max: 21, id: "mild"      as const },
  { min: 21, max: 25, id: "warm"      as const },
  { min: 25, max: 40, id: "hot"       as const },
];
type BandId = typeof BANDS[number]["id"];

const bandFor = (c: number) => BANDS.find(b => c >= b.min && c < b.max) ?? BANDS[0];

// Order of bands for display (hot → cold) with matching range labels
const BAND_DISPLAY: Array<{ band: BandId; label: string }> = [
  { band: "hot",       label: "25°+ — " },
  { band: "warm",      label: "21–25° — " },
  { band: "mild",      label: "18–21° — " },
  { band: "cool",      label: "15–18° — " },
  { band: "chilly",    label: "12–15° — " },
  { band: "very_cold", label: "8–12° — " },
  { band: "freezing",  label: "Below 8° — " },
];

// Default (generic) text for each band if an activity doesn't specify one
const DEFAULT_SHORT_BY_BAND: Record<BandId, string> = {
  hot:       "Swimsuit optional",
  warm:      "Swimsuit",
  mild:      "Shorty / swimwear",
  cool:      "3/2 full suit",
  chilly:    "4/3 + boots",
  very_cold: "6/5 or 5/4 + hood",
  freezing:  "Are you mad?",
};

function buildScaleLinesForActivity(act: ActivityKey): string[] {
  const v = VARIANTS[act] ?? VARIANTS.surfing;
  return BAND_DISPLAY.map(({ band, label }) => {
    const txt = v.shortByBand[band] ?? DEFAULT_SHORT_BY_BAND[band];
    return `${label}${txt}`;
  });
}

/* -------------------------------------------------------------------------- */
/*                               Activity Variants                            */
/* -------------------------------------------------------------------------- */

export type ActivityKey =
  | "kayaking"
  | "canoeing"
  | "surfing"
  | "stand_up_paddleboarding"
  | "snorkeling"
  | "kitesurfing"
  | "windsurfing"
  | "jet_skiing"
  | "scuba_diving"
  | "sailing"
  | "sea_fishing_shore"
  | "sea_fishing_boat"
  | "beach"
  | "sea_swimming";

const ACTIVITY_LABELS: Record<ActivityKey, string> = {
  kayaking: "Kayak",
  canoeing: "Canoe",
  surfing: "Surf",
  stand_up_paddleboarding: "SUP",
  snorkeling: "Snorkel",
  kitesurfing: "Kitesurf",
  windsurfing: "Windsurf",
  jet_skiing: "Jet ski",
  scuba_diving: "Scuba",
  sailing: "Sailing",
  sea_fishing_shore: "Shore fishing",
  sea_fishing_boat: "Boat fishing",
  beach: "Beach",
  sea_swimming: "Swim",
};

const DEFAULT_ACTIVITY_CHIPS: ActivityKey[] = [
  "surfing",
  "stand_up_paddleboarding",
  "kayaking",
  "canoeing",
  "snorkeling",
  "scuba_diving",
  "kitesurfing",
  "windsurfing",
  "jet_skiing",
  "sailing",
  "sea_fishing_shore",
  "sea_fishing_boat",
  "sea_swimming",
  "beach",
];

type Variant = {
  shortByBand: Partial<Record<BandId, string>>;
  expandedLines?: string[];
  hideThermometer?: boolean;
  title?: string;
};


const SHORE_FISH_LINES: string[] = [
  "25°+ — Bite can be quiet; fish dawn/dusk or in shade and deeper gullies",
  "21–25° — Mixed; best early and late, watch for baitfish in the wash",
  "18–21° — Very good; active fish, use natural baits and keep moving",
  "15–18° — Good; steady bites, try headlands and channels",
  "12–15° — Fair; target deeper holes and sun-warmed pockets",
  "8–12° — Slow; scale down baits and fish deeper water",
  "Below 8° — Unlikely; short windows only in deeper, sheltered marks",
];

const BOAT_FISH_LINES: string[] = [
  "25°+ — Quiet mid‑day; best at dawn/dusk, try deeper, cooler water",
  "21–25° — Mixed; follow birds and bait, vary depth",
  "18–21° — Very good; active predators, steady drifts",
  "15–18° — Good; work drop‑offs, reefs and contours",
  "12–15° — Fair; find warmer patches or current lines",
  "8–12° — Slow; small baits and slow drifts in deeper areas",
  "Below 8° — Very slow; short feeding spells, think deep and slow",
];

const VARIANTS: Record<ActivityKey, Variant> = {
  surfing: {
    shortByBand: {
      freezing:  "🧊 Are you mad?",
      very_cold: "🥶 6/5 or 5/4 + hood",
      chilly:    "🐋 4/3 + boots",
      cool:      "🏄🏿‍♀️ 3/2 full suit",
      mild:      "🩳 Shorty / swimwear",
      warm:      "🩱 Swimsuit",
      hot:       "🧜🏼‍♀️ Swimsuit optional",
    },
  },
  stand_up_paddleboarding: {
    shortByBand: {
      freezing:  "It's no fun in this cold",
      very_cold: "5/4 + boots; leash essential",
      chilly:    "3/2–4/3; boots",
      cool:      "3/2 or long-john",
      mild:      "Shorty / UV top",
      warm:      "Rash vest / hat",
      hot:       "Swimwear; hydrate",
    },
  },
  kayaking: {
    shortByBand: {
      freezing:  "Is it worth it?",
      very_cold: "5/4 + boots; spraydeck",
      chilly:    "4/3; boots; cag",
      cool:      "3/2 or semi-dry",
      mild:      "Shorty / cag top",
      warm:      "Light layers + PFD",
      hot:       "Sun shirt + PFD",
    },
  },
  canoeing: {
    shortByBand: {
      freezing:  "Mate, really?",
      very_cold: "5/4 + boots; cag",
      chilly:    "4/3; boots; wind layer",
      cool:      "3/2 or long-john",
      mild:      "Shorty / light cag",
      warm:      "Light layers + PFD",
      hot:       "Sun shirt + PFD",
    },
  },
  kitesurfing: {
    shortByBand: {
      freezing:  "Ain't going to happen",
      very_cold: "5/4 + hood/boots",
      chilly:    "4/3; boots",
      cool:      "3/2 full suit",
      mild:      "Shorty OK",
      warm:      "Rash vest",
      hot:       "Impact vest only",
    },
  },
  windsurfing: {
    shortByBand: {
      freezing:  "Misery",
      very_cold: "5/4 + hood/boots",
      chilly:    "4/3; boots",
      cool:      "3/2 full suit",
      mild:      "Shorty OK",
      warm:      "Rash vest",
      hot:       "Light lycra",
    },
  },
  jet_skiing: {
    shortByBand: {
      freezing:  "You'll freeze to death",
      very_cold: "5/4 + boots/gloves",
      chilly:    "4/3 full suit",
      cool:      "3/2 + impact vest",
      mild:      "Shorty",
      warm:      "Rash vest",
      hot:       "Swimwear + sunscreen",
    },
  },
  snorkeling: {
    shortByBand: {
      freezing:  "Utter insanity",
      very_cold: "7 mm + hood/boots/gloves",
      chilly:    "5 mm + boots",
      cool:      "3–4 mm steamer",
      mild:      "Shorty",
      warm:      "Rash vest",
      hot:       "Swimwear only",
    },
  },
  scuba_diving: {
    shortByBand: {
      freezing:  "Only if you are being paid a shit ton",
      very_cold: "7 mm + hood/gloves/boots",
      chilly:    "5–7 mm; hood",
      cool:      "5 mm steamer",
      mild:      "3 mm steamer",
      warm:      "Shorty / skin",
      hot:       "Skin / rash vest",
    },
  },
  sailing: {
    title: "Sea temperature (sailing)",
    shortByBand: {
      freezing:  "Thermal base + dry suit",
      very_cold: "Neoprene 5/4 + spray top",
      chilly:    "4/3 + spray top",
      cool:      "3/2 + windproof",
      mild:      "Light layers",
      warm:      "T-shirt + spray top",
      hot:       "Sun shirt + hat",
    },
  },
  sea_fishing_shore: {
    title: "Fishing outlook (shore)",
    shortByBand: {
      freezing:  "Very unlikely — deeper, sheltered rock marks only; short bite windows",
      very_cold: "Slow; fish deeper holes/channels with smaller baits; mid‑day can help",
      chilly:    "Fair; seek sun‑warmed pockets and water with colour; steady small fish",
      cool:      "Good; cover ground along gutters and headlands; mixed species",
      mild:      "Very good; first/last light are prime — watch for baitfish in the wash",
      warm:      "Patchy in daylight; shade and dawn/dusk produce — try slightly deeper water",
      hot:       "Quiet mid‑day; best at dawn/dusk or after dark; fish deeper gullies",
    },
    expandedLines: SHORE_FISH_LINES,
  },
  sea_fishing_boat: {
    title: "Fishing outlook (boat)",
    shortByBand: {
      freezing:  "Very slow — think deep and slow: small baits, patient drifts",
      very_cold: "Slow; small baits and slow presentations over deeper structure",
      chilly:    "Fair; find current lines, reefs or wrecks and vary depth",
      cool:      "Good; work drop‑offs and contours — steady drifts pick fish",
      mild:      "Very good; birds and bait show where to fish — predators active",
      warm:      "Mixed; move deeper or chase temperature breaks — watch the birds",
      hot:       "Best at dawn/dusk; fish deeper, cooler layers through the day",
    },
    expandedLines: BOAT_FISH_LINES,
  },
  beach: {
    shortByBand: {
      freezing:  "☕️ Stay on the sand — hot choc",
      very_cold: "Too nippy — paddles only",
      chilly:    "Ankles only; watch the waves",
      cool:      "Brief splash; keep them close",
      mild:      "Quick dip; towels ready",
      warm:      "🧴 Lovely swim — hats & SPF",
      hot:       "🪼 Very warm — shade & hydrate",
    },
  },
  sea_swimming: {
    shortByBand: {
      freezing:  "❄️ Are you mad? Full cold‑water kit & a safety buddy",
      very_cold: "😰 5/4–6/5 with hood/gloves/boots; acclimatised only and with a buddy",
      chilly:    "4/3 + boots/gloves; keep it short",
      cool:      "3/2 wetsuit helps; neoprene cap",
      mild:      "🏊🏽‍♀️ Bracing skins/shorty; buddy up",
      warm:      "🩲 Lovely and pretty much perfect",
      hot:       "🪼 Enjoy a warm one but keep an eye out for stingers",
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                     Backend Marine API fetch + hook                        */
/* -------------------------------------------------------------------------- */

/**
 * Fetch sea temperature from our backend /api/marine endpoint
 * This endpoint uses free data sources (Copernicus, Met.no, Open-Meteo)
 * with Stormglass only as emergency fallback
 */
async function fetchSeaTempFromBackend(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<number | null> {
  // Round coordinates to 3dp to match backend caching
  const rlat = round3dp(lat);
  const rlon = round3dp(lon);
  
  // Request 24h of data centered around now
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  
  const url = `/api/marine?lat=${rlat}&lon=${rlon}&start=${start}&end=${end}`;
  
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  
  interface MarineResponse {
    hours: Array<{
      time: string;
      waterTemperature?: { value: number | null };
    }>;
    source?: string;
  }
  
  const data: MarineResponse = await res.json();
  
  // Find the temperature closest to now
  const nowMs = Date.now();
  let bestVal: number | null = null;
  let bestDiff = Infinity;
  
  for (const h of data.hours || []) {
    const temp = h.waterTemperature?.value;
    if (typeof temp === 'number') {
      const diff = Math.abs(new Date(h.time).getTime() - nowMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestVal = temp;
      }
    }
  }
  
  return bestVal;
}

/**
 * Hook to fetch sea temperature from backend API
 * Uses 30-minute localStorage cache to minimize API calls
 */
function useSeaTemp(lat?: number, lon?: number) {
  const [tempC, setTempC] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cacheKey =
    lat != null && lon != null ? createCacheKey(lat, lon, COORDINATE_PRECISION.STANDARD, 'marine:seaTemp') : null;

  useEffect(() => {
    if (lat == null || lon == null) return;
    let mounted = true;

    // Check localStorage cache first
    if (cacheKey && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const { value, ts } = JSON.parse(raw) as { value: number; ts: number };
          // Use 30-minute cache
          if (Date.now() - ts < 30 * 60 * 1000) {
            setTempC(clamp(value));
            return; // Use cached value, don't fetch
          }
        }
      } catch {
        /* ignore localStorage read errors */
      }
    }

    setLoading(true);
    setErr(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    fetchSeaTempFromBackend(lat, lon, ac.signal)
      .then(v => {
        if (!mounted) return;
        if (typeof v === "number") {
          const c = clamp(v);
          setTempC(c);
          // Cache the result
          if (cacheKey && typeof window !== "undefined") {
            localStorage.setItem(cacheKey, JSON.stringify({ value: c, ts: Date.now() }));
          }
        } else {
          setTempC(null);
        }
      })
      .catch(() => mounted && setErr("Failed to fetch sea temperature"))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  return { tempC, loading, err };
}

/* -------------------------------------------------------------------------- */
/*                                   Card                                     */
/* -------------------------------------------------------------------------- */

type SeaTempCardProps = {
  lat?: number;
  lon?: number;
  seaTempProp?: number | null;
  locationName?: string;
  activity: ActivityKey;
  className?: string;
  defaultOpen?: boolean;
  activityOptions?: ActivityKey[];
  activityLabels?: Partial<Record<ActivityKey, string>>;
  onActivityChangeAction?: (activity: ActivityKey) => void;
};

export default function SeaTempCard({
  lat,
  lon,
  seaTempProp,
  locationName,
  activity,
  className = "",
  defaultOpen = false,
  activityOptions,
  activityLabels,
  onActivityChangeAction,
}: SeaTempCardProps) {
  const { tempC: sgTempC, loading } = useSeaTemp(lat, lon);

  const [activeActivity, setActiveActivity] = useState<ActivityKey>(activity);

  const lastChoiceKey = useMemo(() => {
    const locKey = locationName ? locationName.split(",")[0].trim() : "global";
    return `seaTemp:lastActivity:${locKey}`;
  }, [locationName]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(lastChoiceKey);
      if (saved && Object.prototype.hasOwnProperty.call(VARIANTS, saved)) {
        setActiveActivity(saved as ActivityKey);
      }
    } catch {
      /* ignore localStorage read errors */
    }
  }, [lastChoiceKey]);

  useEffect(() => { setActiveActivity(activity); }, [activity]);

  const setActivityAndPersist = (key: ActivityKey) => {
    setActiveActivity(key);
    try { localStorage.setItem(lastChoiceKey, key); } catch {
      /* ignore localStorage write errors */
    }
    onActivityChangeAction?.(key);
  };

  const rawC = typeof sgTempC === "number" ? sgTempC : (typeof seaTempProp === "number" ? seaTempProp : null);
  const displayC = rawC != null ? clamp(rawC) : null;

  const variant = VARIANTS[activeActivity] ?? VARIANTS.surfing;

  const short = useMemo(() => {
    if (displayC == null) return loading ? "Loading…" : "No recent data";
    const b = bandFor(displayC).id;
    return variant.shortByBand[b] ?? "Sea temperature update";
  }, [displayC, loading, variant]);

  const titleText = "Sea Temp";

  const locality = useMemo(() => (locationName ? locationName.split(",")[0].trim() : undefined), [locationName]);
  const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const description = useMemo(() => {
    if (displayC == null) return loading ? "Loading…" : "No recent data";
    const base = capitalise(short);
    if (locality) return `${base} recommended for ${locality}`;
    return `${base} recommended`;
  }, [displayC, loading, short, locality]);

  const chipStyle: React.CSSProperties =
    displayC != null
      ? { backgroundColor: getSeaTempColor(displayC), color: chipTextColorForTemp(displayC), border: "none", fontWeight: "bold" }
      : {};

  const domainMin = 0, domainMax = 40;
  const pct = displayC != null
    ? Math.max(0, Math.min(100, ((displayC - domainMin) / (domainMax - domainMin)) * 100))
    : 0;

  const chipValue = displayC == null ? "—" : `${Math.round(displayC)}°C`;
  const chipBorderColour = displayC != null ? getSeaTempColor(displayC) : undefined;

  const expandedLines = useMemo(() => variant.expandedLines ?? buildScaleLinesForActivity(activeActivity), [variant, activeActivity]);

  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(!!defaultOpen);
  const labelFor = (k: ActivityKey) => (activityLabels && activityLabels[k]) || ACTIVITY_LABELS[k];


  return (
    <section
      className={`relative rounded-2xl shadow-sm border border-base-300 bg-base-100 ${className}`}
      aria-label="Sea temperature card"
    >
      <details
        ref={detailsRef}
        className="collapse collapse-arrow"
        open={isOpen}
        onToggle={() => setIsOpen(!!detailsRef.current?.open)}
      >
        <summary className="collapse-title p-3 text-base-content after:opacity-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="card__header-title">{titleText}</h2>
            <div
              className="px-3 py-1 rounded-full font-semibold tracking-tight"
              style={{ ...chipStyle, fontSize: "0.8rem" }}
              aria-label={displayC != null ? `Water ${chipValue}` : "No data"}
            >
              {chipValue}
            </div>
          </div>
          <p className="mt-1 text-sm md:text-base font-medium text-white/90 whitespace-normal break-words">
            {description}
          </p>
        </summary>

        <div className="collapse-content px-4 pb-4">
          <div className={`grid ${variant.hideThermometer ? "grid-cols-1" : "grid-cols-[auto_1fr]"} gap-4 items-stretch`}>
            {!variant.hideThermometer && (
              <div className="relative w-4 rounded-full overflow-hidden bg-base-200">
                <div className="absolute inset-0 bg-gradient-to-t from-blue-700 via-yellow-400 to-red-500" />
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-6 h-0.5 bg-base-100/90 rounded"
                  style={{ bottom: `${pct}%` }}
                  aria-hidden
                />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-blue-700" />
              </div>
            )}
            <ul className="text-xs leading-tight space-y-2">
              {expandedLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Activity advice cards below the generic scale (only visible when expanded) */}
        <div className="px-3 pt-3 border-t border-base-200">
          <h4 className="text-xs uppercase tracking-wide opacity-70 mb-2">ACTIVITY ADVICE</h4>
          <div className="flex flex-wrap gap-2">
            {(activityOptions?.length ? activityOptions : DEFAULT_ACTIVITY_CHIPS).map((key) => {
              const selected = key === activeActivity;
              return (
                <div className="indicator" key={key}>
                  {selected && (
                    <span
                      className="indicator-item indicator-top indicator-end rounded-full"
                      style={{
                        width: "10px",
                        height: "10px",
                        backgroundColor: chipBorderColour || "#22d3ee",
                        border: "2px solid rgba(255,255,255,0.85)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
                      }}
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setActivityAndPersist(key)}
                    className={`btn btn-xs md:btn-sm px-3 rounded-full whitespace-normal break-words btn-outline ${selected ? "border-2" : ""}`}
                    style={{
                      ...(selected && chipBorderColour ? { borderColor: chipBorderColour } : {}),
                      fontSize: "0.75rem",
                    }}
                    title={`Show ${labelFor(key)} advice`}
                  >
                    <span className="font-medium">{labelFor(key)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      {/* Bottom-right toggle */}
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (detailsRef.current) detailsRef.current.open = next;
        }}
        className="absolute bottom-2 right-2 w-8 h-8 grid place-items-center rounded-md text-white bg-transparent hover:bg-transparent focus:bg-transparent border-0 shadow-none outline-none ring-0 focus:ring-0"
        style={{ backgroundColor: "transparent", boxShadow: "none", border: "none" }}
        aria-expanded={isOpen}
        aria-controls="sea-temp-thermo"
        title={isOpen ? "Collapse details" : "Expand details"}
      >
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
    </section>
  );
}