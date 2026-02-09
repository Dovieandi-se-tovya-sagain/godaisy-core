// src/components/Popup.tsx

import React, { useEffect, useState, useRef } from 'react';
import OptimizedImage from './OptimizedImage';
// import '../styles/Popup.css'; // Apps must import this themselves
import { getActivityEmoji, getAssessmentEmoji } from '../data/emojiMap';
import { MARINE_ACTIVITY_IDS, isOutdoor } from '../utils/activityHelpers';
import bgMap from '../data/bgMap';
import SwellArrow from './SwellArrow';
import WindDirectionIcon from './WindDirectionIcon';
import EnvironmentalIndicators from './EnvironmentalIndicators';
import { getCompassDirection } from '../utils/weatherLabels';
import { classifyCurrentStrength } from '../utils/currentStrength';
import { classifyWindRelative, computeSimulatedOrientation, resolveBeachOrientationAsync } from '../utils/orientation';
import { getBeaufortNumber } from '../utils/beaufort';
import { mpsToKnots, mpsToKmh } from '../utils/weatherUtils';
import { getOptimizedImageSrc, isImageOptimized } from '../data/bgMapOptimized';
import type { PollenSummary } from '../utils/pollenUtils';
import type { AirQualitySummary } from '../utils/airQualityUtils';
// New imports for snow advisories and activity metadata
import { getSnowActivityRecommendation } from '../utils/snowRecommendations';
import { activityTypes } from '../data/activityTypes';

// --- Types ---
// All windSpeed fields are in meters per second (m/s) throughout the pipeline.
interface MarineData {
  waveHeight?: number;
  /** Wind speed in m/s (meters per second) */
  windSpeed?: number;
  waterTemperature?: number;
  swellHeight?: number;
  swellPeriod?: number;
  gust?: number;
  windDir?: number;
  windDirection?: number; // some sources use windDirection
  swellDir?: number;
  vis?: number;
  beachOrientation?: number;
  currentSpeed?: number;
  current?: number;
  currentDir?: number;
}

// All windSpeed fields are in meters per second (m/s) throughout the pipeline.
interface WeatherData {
  description?: string;
  temperature?: number;
  tempMin?: number;
  tempMax?: number;
  /** Wind speed in m/s (meters per second) */
  windSpeed?: number;
  windDir?: number;
  humidity?: number;
  precipitation?: number;
  beachOrientation?: number;
  icon?: string;
  // Snow-aware fields injected via buildPopupActivityPayload
  snowDepthCm?: number;
  snowfallRateMmH?: number;
}

// Tide types to avoid any
type TideType = 'high' | 'low';
interface TideEntry { time: string; height: number; type: TideType }
function isTideEntry(v: unknown): v is TideEntry {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.time === 'string' &&
    typeof o.height === 'number' &&
    (o.type === 'high' || o.type === 'low')
  );
}

type Category = 'perfect' | 'good' | 'fair' | 'poor';

interface PopupProps {
  activityId: string;
  title: string;
  category: Category;
  message?: string;
  marineData?: MarineData;
  weatherData?: WeatherData;
  score?: number;
  onClose: () => void;
  coastalLocation?: { lat: number; lon: number };
  homeLocation?: { lat: number; lon: number };
  dayTimestamp?: number;
  pollen?: PollenSummary;
  airQuality?: AirQualitySummary;
}

// ---- WhatsApp/Web Share helpers (inline; no new files) ----
type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
  imageUrl?: string;
  phone?: string;
};

const PUBLIC_SITE_URL = (typeof window === 'undefined'
  ? process.env.NEXT_PUBLIC_SITE_URL
  : (process.env.NEXT_PUBLIC_SITE_URL || 'https://wotnow.vercel.app'));

const _isSecure = typeof window !== 'undefined' && window.isSecureContext;

async function imageUrlToFile(imageUrl?: string): Promise<File | undefined> {
  if (!imageUrl || !_isSecure) return undefined;
  try {
    const res = await fetch(imageUrl, { mode: 'cors', cache: 'no-cache' });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
    return new File([blob], `wotnow-share.${ext}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return undefined;
  }
}

function buildMessage({ text, url }: SharePayload) {
  return [text, url].filter(Boolean).join('\n\n');
}

function _buildEmailishSubject(activityTitle: string) {
  const t = activityTitle.trim();
  const firstWord = t.split(/\s+/)[0] || '';
  const looksGerund = /ing\b/i.test(firstWord);
  if (looksGerund) return `Fancy ${t.toLowerCase()}?`;
  return `Fancy some ${t.toLowerCase()}?`;
}

function buildWhatsAppUrl(payload: SharePayload) {
  const message = buildMessage(payload);
  const encoded = encodeURIComponent(message);
  if (payload.phone) return `https://wa.me/${payload.phone}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

type NavigatorWithCanShare = Navigator & { canShare?: (data: { files?: File[] }) => boolean };
function getErrorName(e: unknown): string | undefined {
  if (typeof e === 'object' && e && 'name' in e) {
    const n = (e as { name?: unknown }).name;
    if (typeof n === 'string') return n;
  }
  return undefined;
}
function getErrorMessage(e: unknown): string | undefined {
  if (typeof e === 'object' && e && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}

async function shareToWhatsApp(payload: SharePayload): Promise<string> {
  const hasNavigatorShare = typeof navigator !== 'undefined' && !!navigator.share;
  const textWithLinks = [payload.text, payload.url, payload.imageUrl].filter(Boolean).join('\n');

  if (hasNavigatorShare && _isSecure && payload.imageUrl) {
    const file = await imageUrlToFile(payload.imageUrl);
    const n = navigator as NavigatorWithCanShare;
    if (file && n.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: payload.title,
          text: [payload.title, textWithLinks].filter(Boolean).join('\n\n'),
          files: [file],
        });
        return 'Shared via system sheet';
      } catch (err: unknown) {
        const nm = getErrorName(err) || '';
        const msg = getErrorMessage(err) || '';
        if (/Abort/i.test(nm) || /Abort/i.test(msg)) return 'Share cancelled';
      }
    }
  }
  if (hasNavigatorShare) {
    try {
      await navigator.share({
        title: payload.title,
        text: textWithLinks,
      });
      return 'Shared via system sheet';
    } catch (err: unknown) {
      const nm = getErrorName(err) || '';
      const msg = getErrorMessage(err) || '';
      if (/Abort/i.test(nm) || /Abort/i.test(msg)) return 'Share cancelled';
    }
  }
  try {
    const href = buildWhatsAppUrl({ ...payload, text: textWithLinks, url: undefined });
    const w = window.open(href, '_blank', 'noopener,noreferrer');
    if (w) return 'Opened WhatsApp';
  } catch {
    void 0; // swallow and continue to next strategy
  }
  try {
    const toCopy = [payload.title, textWithLinks].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(toCopy);
    return 'Copied message to clipboard';
  } catch {
    return 'Unable to share';
  }
}
// ---- end helpers ----

const humidityIcon = '/weather-icons/design/fill/final/humidity.svg';
const rainIcon = '/weather-icons/design/fill/final/raindrop-measure.svg';

function getWeatherIconUrl(iconCode: string) {
  const supportedIcons = [
    '01d','01n','02d','02n','03d','03n','04d','04n',
    '09d','09n','10d','10n','11d','11n','13d','13n','50d','50n'
  ];
  if (supportedIcons.includes(iconCode)) {
    return `/weather-icons/design/fill/final/${iconCode}.svg`;
  }
  return '/weather-icons/design/fill/final/na.svg';
}


// --- Wind speed utilities ---

/**
 * Get wind icon based on Beaufort number, using m/s as input.
 * getBeaufortNumber expects m/s and converts internally to km/h.
 */
function getWindIcon(windMs: number) {
  const beaufort = getBeaufortNumber(windMs); // Pass m/s directly, function handles conversion
  if (beaufort < 3) return '/weather-icons/design/fill/final/windsock.svg';
  if (beaufort <= 12) return `/weather-icons/design/fill/final/wind-beaufort-${beaufort}.svg`;
  return '/weather-icons/design/fill/final/wind.svg';
}

/**
 * Check if wind icon needs glow effect (only numbered Beaufort icons)
 */
function windIconNeedsGlow(windMs: number) {
  const beaufort = getBeaufortNumber(windMs);
  return beaufort >= 3 && beaufort <= 12; // Only numbered Beaufort icons have dark text
}

// Remove kmhToKnots, use mpsToKnots for all wind speed conversions

function formatTideTime(timeString: string): string {
  const date = new Date(timeString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const Popup: React.FC<PopupProps> = ({
  activityId,
  title,
  category,
  message,
  marineData,
  weatherData,
  score,
  onClose,
  coastalLocation,
  homeLocation,
  dayTimestamp,
  pollen,
  airQuality,
}) => {
  const [tideData, setTideData] = useState<{
    nextHighTide?: { time: string; height: number };
    nextLowTide?: { time: string; height: number };
    secondHighTide?: { time: string; height: number };
    secondLowTide?: { time: string; height: number };
  }>({});
  const [isToday, setIsToday] = useState(true);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Use activity type to decide if we should render marine layout
  const isMarineActivity = MARINE_ACTIVITY_IDS.includes(activityId);
  // Consider ANY available marine metric as sufficient to display marine data
  const hasMarineData = !!marineData && (
    typeof marineData.waveHeight === 'number' ||
    typeof marineData.waterTemperature === 'number' ||
    typeof marineData.swellHeight === 'number' ||
    typeof marineData.swellPeriod === 'number' ||
    typeof marineData.windSpeed === 'number' ||
    typeof marineData.gust === 'number' ||
    typeof marineData.vis === 'number'
  );
  const emoji = getActivityEmoji(activityId);
  
  // Smart background image loading with WebP optimization
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    const loadOptimalImage = async () => {
      if (isImageOptimized(activityId)) {
        const webpSrc = getOptimizedImageSrc(activityId, isMobile ? 'webpSmall' : 'webpLarge');
        try {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Image failed to load'));
            img.src = webpSrc;
          });
          setBackgroundImage(webpSrc);
        } catch {
          // Fallback to original
          setBackgroundImage(bgMap[activityId] ?? '/default-bg.jpg');
        }
      } else {
        setBackgroundImage(bgMap[activityId] ?? '/default-bg.jpg');
      }
    };
    
    loadOptimalImage();
  }, [activityId, isMobile]);
  
  // Determine if any valid location exists (coastal preferred, home as fallback)
  const hasAnyLocation = (
    (typeof coastalLocation?.lat === 'number' && typeof coastalLocation?.lon === 'number') ||
    (typeof homeLocation?.lat === 'number' && typeof homeLocation?.lon === 'number')
  );
  
  // Determine if this activity should show pollen warnings
  // Exclude marine, winter, and indoor activities as specified
  const winterActivities = ['skiing', 'snowboarding', 'cross_country_skiing', 'ice_skating', 'sledding'];
  const isWinterActivity = winterActivities.includes(activityId);
  const isIndoorActivity = !isOutdoor(activityId);
  const shouldShowPollenWarning = !isMarineActivity && !isWinterActivity && !isIndoorActivity;
  
  // Determine if this activity should show air quality warnings
  // Use same exclusion logic as pollen
  const shouldShowAirQualityWarning = !isMarineActivity && !isWinterActivity && !isIndoorActivity;

  // --- Snow advisory logic (mirror homepage and activity cards) ---
  const SNOW_DANGER_LEVELS = new Set([
    'dangerous', 'unsafe', 'impossible', 'unplayable', 'too_deep', 'snowfall_unsafe'
  ] as const);
  const SNOW_AMBER_LEVELS = new Set([
    'caution', 'difficult', 'uncomfortable', 'impractical', 'requires_winter_gear', 'snowfall_caution'
  ] as const);
  type SnowDangerLevel = typeof SNOW_DANGER_LEVELS extends Set<infer T> ? T : never;
  type SnowAmberLevel = typeof SNOW_AMBER_LEVELS extends Set<infer T> ? T : never;
  const shouldShowSnowWarning = (aid: string, level?: string) => {
    if (MARINE_ACTIVITY_IDS.includes(aid)) return false; // no snow pills for watersports
    if (!level) return false;
    if (SNOW_DANGER_LEVELS.has(level as SnowDangerLevel)) return true; // always show severe
    // For team sports and lifestyle (Outdoor Leisure), also show amber levels
    const a = activityTypes.find(x => x.id === aid);
    const isTeam = a?.secondaryCategory === 'Team Sports';
    const isLifestyle = a?.category === 'Outdoor Leisure';
    if ((isTeam || isLifestyle) && SNOW_AMBER_LEVELS.has(level as SnowAmberLevel)) return true;
    return false;
  };

  const snowDepthCm = typeof weatherData?.snowDepthCm === 'number' ? weatherData!.snowDepthCm! : 0;
  const snowfallRateMmH = typeof weatherData?.snowfallRateMmH === 'number' ? weatherData!.snowfallRateMmH! : 0;
  const snowRecommendation = getSnowActivityRecommendation(activityId, snowDepthCm, snowfallRateMmH);

  // --- Orientation (OSM-backed) ---
  const [resolvedOrientation, setResolvedOrientation] = useState<number | undefined>(undefined);
  const [orientationVia, setOrientationVia] = useState<string | undefined>(undefined);

  // --- Wind speed display helpers ---
  // Always use m/s internally, convert for display only

  // Document: All wind speed logic, scoring, and messaging should use m/s internally.

  const handleShare = async () => {
    const shareUrl = `${PUBLIC_SITE_URL}?activity=${encodeURIComponent(activityId)}`;
    // Do not include image or separate title in shared payload; keep local vars unused.
    const payload: SharePayload = {
      // Do not include a separate title (prevents duplication) and do not attach image URL.
      title: undefined,
      // Bold opener line, then message with URL appended on same paragraph. No 'WotNow' mention.
      text: [
        `Do you fancy joining me for ${title.toLowerCase()}?`,
        message ? `${message} ${shareUrl}` : shareUrl,
      ].filter(Boolean).join('\n\n'),
      url: undefined,
      imageUrl: undefined,
    };
    const status = await shareToWhatsApp(payload);
    if (status === 'Share cancelled') return;
    if (status === 'Copied message to clipboard') alert('Copied the invite to your clipboard.');
    if (status === 'Unable to share') alert('Sorry, unable to share from this browser.');
  };

  useEffect(() => {
    if (isMarineActivity) {
      const lat = coastalLocation?.lat ?? homeLocation?.lat ?? 50.7192;
      const lon = coastalLocation?.lon ?? homeLocation?.lon ?? -1.8808;
      fetchTideData(lat, lon, dayTimestamp);
    }
  }, [coastalLocation, homeLocation, isMarineActivity, dayTimestamp]);

  // Resolve beach orientation from OSM (cached) when we have a coastal/home point
  useEffect(() => {
    const lat = coastalLocation?.lat ?? homeLocation?.lat;
    const lon = coastalLocation?.lon ?? homeLocation?.lon;
    if (!isMarineActivity || typeof lat !== 'number' || typeof lon !== 'number') {
      setResolvedOrientation(undefined);
      setOrientationVia(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        type OrientationResult = { orientation?: number; source?: string; via?: string };
        const res = (await resolveBeachOrientationAsync({ lat, lon })) as OrientationResult;
        if (cancelled) return;
        const via = res.via || res.source;
        // Fallback to simulated only if resolver couldn't find anything
        const o = typeof res.orientation === 'number' ? res.orientation : computeSimulatedOrientation(lat, lon);
        setResolvedOrientation(o);
        setOrientationVia(via);
      } catch {
        // Last-ditch fallback
        setResolvedOrientation(computeSimulatedOrientation(lat, lon));
        setOrientationVia('sim');
      }
    })();
    return () => { cancelled = true; };
  }, [isMarineActivity, coastalLocation?.lat, coastalLocation?.lon, homeLocation?.lat, homeLocation?.lon]);

  const fetchTideData = async (lat: number, lon: number, dayTimestamp?: number) => {
    try {
      const today = new Date();
      const targetDay = dayTimestamp ? new Date(dayTimestamp * 1000) : today;
      const isCurrentDay = targetDay.toDateString() === today.toDateString();
      setIsToday(isCurrentDay);
      const res = await fetch(`/api/tides?lat=${lat}&lon=${lon}`);
      if (!res.ok) return;
      const data = await res.json();
      const entries: TideEntry[] = Array.isArray(data?.data) ? (data.data as unknown[]).filter(isTideEntry) : [];
      const targetDateStr = targetDay.toISOString().split('T')[0];
      const dayTides = entries.filter((tide) => {
        const tideDateStr = new Date(tide.time).toISOString().split('T')[0];
        return tideDateStr === targetDateStr;
      });
      if (isCurrentDay) {
        const currentTime = new Date();
        const byTime = (a: TideEntry, b: TideEntry) => new Date(a.time).getTime() - new Date(b.time).getTime();
        const highTides = dayTides.filter((t) => t.type === 'high').sort(byTime);
        const lowTides = dayTides.filter((t) => t.type === 'low').sort(byTime);
        const nextHighTide = highTides.find((t) => new Date(t.time) > currentTime);
        const nextLowTide = lowTides.find((t) => new Date(t.time) > currentTime);
        setTideData({
          nextHighTide: nextHighTide
            ? { time: nextHighTide.time, height: nextHighTide.height }
            : undefined,
          nextLowTide: nextLowTide
            ? { time: nextLowTide.time, height: nextLowTide.height }
            : undefined,
          secondHighTide: undefined,
          secondLowTide: undefined,
        });
      } else {
        const firstHighTide = dayTides.find((e) => e.type === 'high');
        const firstLowTide = dayTides.find((e) => e.type === 'low');
        const secondHighTide = dayTides.filter((e) => e.type === 'high')[1];
        const secondLowTide = dayTides.filter((e) => e.type === 'low')[1];
        setTideData({
          nextHighTide: firstHighTide ? { time: firstHighTide.time, height: firstHighTide.height } : undefined,
          nextLowTide: firstLowTide ? { time: firstLowTide.time, height: firstLowTide.height } : undefined,
          secondHighTide: secondHighTide ? { time: secondHighTide.time, height: secondHighTide.height } : undefined,
          secondLowTide: secondLowTide ? { time: secondLowTide.time, height: secondLowTide.height } : undefined,
        });
      }
    } catch { void 0; }
  };

  // Build classes/styles for the content export area
  const exportClass = 'popup__export-area';

  return (
    <div className="popup" onClick={onClose}>
      <div
        className={`popup__content popup__content--${category}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.6)), url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button className="popup__close" onClick={onClose} aria-label="Close">×</button>
        
        {/* Only export this area */}
        <div ref={popupRef} className={exportClass}>
          <header className="popup__card-header">
            <div className="popup__card-emoji">{emoji}</div>
            <div className="popup__card-title">{title}</div>
            <span className={`popup__card-badge popup__badge--${category}`}>{getAssessmentEmoji(category)}</span>
          </header>
          {message && <p className="popup__message">{message}</p>}

          {/* Inline snow advisory pill (mirrors homepage & cards) */}
          {(!isMarineActivity) && shouldShowSnowWarning(activityId, snowRecommendation?.level) && (
            <div className={`${
              (/^(snowfall_)?(unsafe|dangerous|impossible|unplayable|too_deep)/.test(String(snowRecommendation.level)) ? 'bg-red-600 text-white'
               : /(snowfall_)?(difficult|impractical|uncomfortable|caution|requires_winter_gear)/.test(String(snowRecommendation.level)) ? 'bg-amber-500 text-black'
               : 'bg-emerald-500 text-white')
            } mt-2 rounded-md px-2 py-1 text-xs inline-flex items-center gap-2`}>
              <OptimizedImage src={String(snowRecommendation.level).startsWith('snowfall_') ? '/weather-icons/design/fill/final/overcast-snow.svg' : '/weather-icons/design/fill/final/snowman.svg'} alt="Snow advisory" width={18} height={18} />
              <span>{snowRecommendation.message}</span>
            </div>
          )}

          {(marineData || weatherData) && (
            <section className="popup__weather-bar">
              <ul>
                {isMarineActivity && marineData && (
                  <>
                    {typeof weatherData?.temperature === 'number' && (
                      <li>
                        <OptimizedImage src="/weather-icons/design/fill/final/thermometer-celsius.svg" alt="Air temperature" width={24} height={24} style={{ verticalAlign: 'middle' }} />{' '}
                        <strong>{weatherData.temperature.toFixed(1)}°</strong>
                      </li>
                    )}
                    {typeof marineData.waterTemperature === 'number' && (
                      <li>
                        <OptimizedImage src="/weather-icons/design/fill/final/thermometer-water.svg" alt="Water temperature" width={24} height={24} style={{ verticalAlign: 'middle' }} />{' '}
                        <strong>{marineData.waterTemperature.toFixed(1)}°</strong>
                      </li>
                    )}
                    {weatherData?.icon && (
                      <li>
                        <OptimizedImage src={getWeatherIconUrl(weatherData.icon)} alt={weatherData.description || 'weather'} width={28} height={28} style={{ verticalAlign: 'middle' }} />{' '}
                        {weatherData.description}
                        {typeof weatherData?.precipitation === 'number' && weatherData.precipitation > 0 && (
                          <>
                            {' '}
                            <OptimizedImage src={rainIcon} alt="Precipitation" width={24} height={24} style={{ verticalAlign: 'middle', marginLeft: '8px' }} />{' '}
                            <strong>{weatherData.precipitation}mm</strong>
                          </>
                        )}
                      </li>
                    )}
                    {typeof marineData.waveHeight === 'number' && (
                      <li>
                        🌊 <strong>{marineData.waveHeight.toFixed(1)}</strong>m
                      </li>
                    )}
                    {typeof marineData.windSpeed === 'number' && (
                      <li>
                        <OptimizedImage src={getWindIcon(marineData.windSpeed)} alt="Wind" width={28} height={28} style={{ verticalAlign: 'middle', filter: windIconNeedsGlow(marineData.windSpeed) ? 'drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.9)) drop-shadow(0px 0px 1px rgba(255, 255, 255, 1)) drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.5))' : 'none' }} />{' '}
                        <strong>{Math.round(mpsToKnots(marineData.windSpeed))}</strong>knots
                        {typeof marineData.gust === 'number' && <> (gust {mpsToKnots(marineData.gust).toFixed(1)} knots)</>}
                        {(() => {
                          const rawDir = marineData?.windDir ?? marineData?.windDirection;
                          const dir = typeof rawDir === 'number' ? rawDir : undefined;
                          // Priority: provided orientation -> resolved OSM/cache -> simulated fallback
                          const orientProvided = typeof marineData?.beachOrientation === 'number' 
                            ? marineData!.beachOrientation 
                            : (typeof weatherData?.beachOrientation === 'number' ? weatherData!.beachOrientation : undefined);
                          const orient = typeof orientProvided === 'number' 
                            ? orientProvided 
                            : (typeof resolvedOrientation === 'number' ? resolvedOrientation : (
                                coastalLocation ? computeSimulatedOrientation(coastalLocation.lat, coastalLocation.lon) : undefined
                              ));
                          return typeof dir === 'number' ? (
                            <>
                              {' '}
                              <WindDirectionIcon deg={dir} />
                              {' '}
                              <span style={{ fontWeight: 600 }}>
                                {getCompassDirection(dir)}
                              </span>
                              {typeof orient === 'number' && (
                                <>
                                  {' '}
                                  <span>({classifyWindRelative(orient, dir)})</span>
                                  {orientationVia && orientationVia !== 'computed' && (
                                    <em style={{ marginLeft: 6, opacity: 0.75 }}>
                                      ({orientationVia === 'simulated' ? 'sim' : orientationVia})
                                    </em>
                                  )}
                                </>
                              )}
                            </>
                          ) : null;
                        })()}
                      </li>
                    )}
                    {typeof marineData.swellHeight === 'number' && (
                      <li>
                        🏄🏿‍♀️ Swell: <strong>{marineData.swellHeight.toFixed(1)}</strong>m{' '}
                        {typeof marineData.swellDir === 'number' && <SwellArrow deg={marineData.swellDir} />}
                      </li>
                    )}
                    {typeof marineData.swellPeriod === 'number' && (
                      <li>
                        ⏲ <strong>{marineData.swellPeriod.toFixed(1)}</strong>s
                      </li>
                    )}
                    {(() => {
                      const rawSpeed = typeof marineData.currentSpeed === 'number'
                        ? marineData.currentSpeed
                        : typeof marineData.current === 'number'
                          ? marineData.current
                          : undefined;
                      if (typeof rawSpeed !== 'number') return null;
                      const strength = classifyCurrentStrength(rawSpeed);
                      const label = strength?.toLowerCase().includes('current') ? strength : `${strength} current`;
                      return (
                        <li>
                          🧭 Currents: <strong>{label}</strong>
                          <span className="opacity-70"> ({rawSpeed.toFixed(1)} m/s)</span>
                          {typeof marineData.currentDir === 'number' && (
                            <>
                              {' '}
                              <span>
                                {getCompassDirection(marineData.currentDir)} ({Math.round(marineData.currentDir)}°)
                              </span>
                            </>
                          )}
                        </li>
                      );
                    })()}
                    {typeof marineData.vis === 'number' && (
                      <li>
                        👀<strong>
                          {marineData.vis > 3
                            ? Math.round(marineData.vis)
                            : marineData.vis.toFixed(1)}
                        </strong>km
                        <div style={{ marginTop: 4 }}>
                          <progress className="progress w-full" value={(() => {
                            const v = Math.max(0, Math.min(24, marineData.vis));
                            return Math.round((Math.log(1 + v) / Math.log(1 + 24)) * 100);
                          })()} max={100}></progress>
                        </div>
                      </li>
                    )}
                    {(tideData.nextHighTide || tideData.nextLowTide) && (
                      <li className="tide-info">
                        {tideData.nextHighTide && (
                          <span>
                            <OptimizedImage src="/weather-icons/design/fill/final/tide-high.svg"
                                 alt="High Tide"
                                 width={28} height={28} style={{ verticalAlign: 'middle' }} />{' '}
                            {isToday ? 'Next High Tide ' : 'High '}
                            <strong>{formatTideTime(tideData.nextHighTide.time)}</strong>
                            {!isToday && tideData.secondHighTide && (
                              <span> ({formatTideTime(tideData.secondHighTide.time)})</span>
                            )}
                          </span>
                        )}
                        {tideData.nextHighTide && tideData.nextLowTide && <span> | </span>}
                        {tideData.nextLowTide && (
                          <span>
                            <OptimizedImage src="/weather-icons/design/fill/final/tide-low.svg"
                                 alt="Low Tide"
                                 width={28} height={28} style={{ verticalAlign: 'middle' }} />{' '}
                            {isToday ? 'Next Low Tide' : 'Low '}
                            <strong>{formatTideTime(tideData.nextLowTide.time)}</strong>
                            {!isToday && tideData.secondLowTide && (
                              <span> ({formatTideTime(tideData.secondLowTide.time)})</span>
                            )}
                          </span>
                        )}
                      </li>
                    )}
                  </>
                )}
                {!isMarineActivity && weatherData && (
                  <>
                    {typeof weatherData?.tempMax === 'number' && (
                      <li>
                        <OptimizedImage src="/weather-icons/design/fill/final/thermometer-celsius.svg" alt="High Temperature" width={24} height={24} style={{ verticalAlign: 'middle' }} />{' '}
                        <strong>H: {weatherData.tempMax}°</strong>
                      </li>
                    )}
                    {typeof weatherData?.tempMin === 'number' && (
                      <li>
                        <OptimizedImage src="/weather-icons/design/fill/final/thermometer-colder.svg" alt="Low Temperature" width={24} height={24} style={{ verticalAlign: 'middle' }} />{' '}
                        <strong>L: {weatherData.tempMin}°</strong>
                      </li>
                    )}
                    {typeof weatherData?.temperature === 'number' &&
                     typeof weatherData?.tempMin === 'undefined' &&
                     typeof weatherData?.tempMax === 'undefined' && (
                      <li>
                        <OptimizedImage src="/weather-icons/design/fill/final/thermometer-celsius.svg" alt="Temperature" width={24} height={24} style={{ verticalAlign: 'middle' }} />{' '}
                        <strong>{weatherData.temperature}°</strong>
                      </li>
                    )}
                    {weatherData?.icon && (
                      <li>
                        <OptimizedImage src={getWeatherIconUrl(weatherData.icon)} alt={weatherData.description || 'weather'} width={28} height={28} style={{ verticalAlign: 'middle' }} />{' '}
                        {weatherData.description}
                        {typeof weatherData?.precipitation === 'number' && weatherData.precipitation > 0 && (
                          <>
                            {' '}
                            <OptimizedImage src={rainIcon} alt="Precipitation" width={24} height={24} style={{ verticalAlign: 'middle', marginLeft: '8px' }} />{' '}
                            <strong>{weatherData.precipitation}mm</strong>
                          </>
                        )}
                      </li>
                    )}
                    {typeof weatherData?.windSpeed === 'number' && (
                      <li>
                        <OptimizedImage src={getWindIcon(weatherData.windSpeed)} alt="Wind" width={28} height={28} style={{ verticalAlign: 'middle', filter: windIconNeedsGlow(weatherData.windSpeed) ? 'drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.9)) drop-shadow(0px 0px 1px rgba(255, 255, 255, 1)) drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.5))' : 'none' }} />{' '}
                        <strong>{Math.round(mpsToKmh(weatherData.windSpeed))}km/h</strong>
                        {typeof weatherData.windDir === 'number' && (
                          <>
                            {' '}
                            <WindDirectionIcon deg={weatherData.windDir} />
                            {' '}
                            <span style={{ fontWeight: 600 }}>
                              {getCompassDirection(weatherData.windDir)}
                            </span>
                          </>
                        )}
                      </li>
                    )}
                    {typeof weatherData?.humidity === 'number' && (
                      <li>
                        <OptimizedImage src={humidityIcon} alt="Humidity" width={24} height={24} style={{ verticalAlign: 'middle' }} />{' '}
                        <strong>{weatherData.humidity}%</strong>
                      </li>
                    )}
                    {(shouldShowPollenWarning || shouldShowAirQualityWarning || (snowDepthCm > 0 || snowfallRateMmH > 0)) ? (
                      <li>
                        <EnvironmentalIndicators 
                          pollen={shouldShowPollenWarning ? pollen : undefined}
                          airQuality={shouldShowAirQualityWarning ? airQuality : undefined}
                          snowDepthCm={snowDepthCm}
                          snowfallRateMmH={snowfallRateMmH}
                          mode="compact"
                        />
                      </li>
                    ) : null}
                  </>
                )}
              </ul>
            </section>
          )}
          {isMarineActivity && !hasMarineData && (
            <div className="location-prompt">
              {hasAnyLocation
                ? 'Marine conditions are temporarily unavailable.'
                : 'Please set your beach or coastal location.'}
            </div>
          )}
          <footer className="popup__footer">Score: {typeof score === 'number' ? `${score}%` : '—'}</footer>
        </div>
        {/* Buttons are visually in the popup but NOT in export area */}
        <div className="popup__action">
          
          <button className="popup__share-button" onClick={handleShare}>
            📤 Invite a friend to join you
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;
