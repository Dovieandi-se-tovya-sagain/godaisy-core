import React, { useState, useEffect } from 'react';
import OptimizedImage from './OptimizedImage';
import OptimizedBackgroundImage from './OptimizedBackgroundImage';
import { WeatherData } from '../types/weatherData';
// WindIcon copied from pages/index.tsx for local use
type WindIconProps = {
  windMs: number;
  size?: number;
  alt?: string;
};

function WindIcon({ windMs, size = 28, alt = 'Wind' }: WindIconProps) {
  // Convert m/s to Beaufort scale
  function getBeaufortNumber(windMs: number) {
    // Standard Beaufort scale for m/s
    if (windMs < 0.3) return 0;
    if (windMs < 1.5) return 1;
    if (windMs < 3.3) return 2;
    if (windMs < 5.4) return 3;
    if (windMs < 7.9) return 4;
    if (windMs < 10.7) return 5;
    if (windMs < 13.8) return 6;
    if (windMs < 17.1) return 7;
    if (windMs < 20.7) return 8;
    if (windMs < 24.4) return 9;
    if (windMs < 28.4) return 10;
    if (windMs < 32.6) return 11;
    return 12;
  }
  const beaufort = getBeaufortNumber(windMs);
  let iconName = '';
  let needsGlow = false;
  if (beaufort < 3) {
    iconName = 'windsock.svg';
    needsGlow = false;
  } else if (beaufort <= 12) {
    iconName = `wind-beaufort-${beaufort}.svg`;
    needsGlow = true;
  } else {
    iconName = 'wind.svg';
    needsGlow = false;
  }
  return (
    <OptimizedImage
      src={`/weather-icons/design/fill/final/${iconName}`}
      alt={alt}
      width={size}
      height={size}
      style={{
        verticalAlign: 'middle',
        filter: needsGlow
          ? 'drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.9)) drop-shadow(0px 0px 1px rgba(255, 255, 255, 1)) drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.5))'
          : 'none',
      }}
    />
  );
}
import { getMoonLore, MoonPhase } from '../data/moonLore';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { describeIssPass } from '../utils/issHelper';
import '../styles/Card.css';
import { indieFlower, oxanium } from "../app/fonts";
import { describeClearestSkiesFromHourly } from '../lib/services/goingOutTonight';

// Astronomy highlight interfaces
// Keeping for reference but marking with underscore since it's not used directly
interface _AstronomyEvent {
  type: 'sunset' | 'sunrise' | 'moonrise' | 'moonset' | 'eclipse' | 'meteor_shower' | 'new_moon' | 'full_moon';
  time: string;
  description?: string;
  name?: string;
  peak?: string;
  visible_from?: string;
  duration?: string;
}

interface SpecialEvent {
  type: 'meteor_shower' | 'moon_event' | 'seasonal' | 'planet' | 'eclipse';
  name: string;
  description: string;
  visibility: 'excellent' | 'good' | 'fair' | 'poor';
  activitySuggestion?: string;
  bestTime?: string;
  direction?: string;
}

interface AstronomyHighlight {
  date: string;
  dayName: string;
  isToday: boolean;
  sun: {
    sunset?: string;
    sunrise?: string;
  };
  moon: {
    rise?: string;
    set?: string;
    phaseName: string;
    illumination: number;
    icon: string;
  };
  darkWindow?: {
    start: string;
    end: string;
    durationHours: number;
  };
  events: SpecialEvent[];
  wotnowMessage: string;
}

interface AstronomyCardProps {
  className?: string;
  style?: React.CSSProperties;
  weatherData?: WeatherData;
}

// Helper function to get appropriate astronomy icon based on events
const getAstronomyIcon = (events: SpecialEvent[], moonIllumination: number, cloudCover: number) => {
  // Priority 1: Eclipse events
  const eclipseEvent = events.find(e => e.type === 'eclipse' || e.name.toLowerCase().includes('eclipse'));
  if (eclipseEvent) {
    return 'solar-eclipse.svg';
  }

  // Priority 2: Meteor shower events
  const meteorEvent = events.find(e => e.type === 'meteor_shower' || e.name.toLowerCase().includes('meteor'));
  if (meteorEvent) {
    return 'falling-stars.svg';
  }

  // Priority 3: Good stargazing conditions (low moon, low clouds)
  if (moonIllumination < 50 && cloudCover < 30) {
    return 'starry-night.svg';
  }

  // Default: Star icon
  return 'star.svg';
};

// Helper function to generate weather-aware astronomy message
const getWeatherAwareMessage = (
  primaryEvent: SpecialEvent | undefined,
  tonight: AstronomyHighlight,
  weatherData: WeatherData | undefined,
  stargazingScore: number
) => {
  const cloudCover = weatherData?.clouds || 0;
  // Keeping visibility but marking with underscore since it's not used directly
  const _visibility = weatherData?.visibility || 10000;
  const rain = weatherData?.rain || 0;
  const snow = weatherData?.snow || 0;
  
  // Poor weather conditions
  if (rain > 0 || snow > 0) {
    return "Precipitation expected tonight - not ideal for stargazing. Check forecast for clearer nights.";
  }
  
  if (cloudCover >= 80) {
    return "Heavy cloud cover expected - limited visibility for astronomy tonight.";
  }
  
  if (cloudCover >= 60) {
    return "Cloudy skies expected - some breaks in clouds may allow brief stargazing opportunities.";
  }
  
  // Special events with weather context
  if (primaryEvent) {
    // Build message parts, deduplicate direction, join naturally
    const parts: string[] = [];
    // Do NOT include bestTime here (now shown in data bar)
    if (primaryEvent.description) {
      parts.push(primaryEvent.description);
    }
    // Weather context
    if (cloudCover >= 40) {
      parts.push("Cloud breaks may offer good windows");
    } else if (cloudCover < 20) {
      parts.push("Clear skies expected - excellent viewing conditions!");
    }
    // Direction, only add if not already present
    if (primaryEvent.direction) {
      if (typeof primaryEvent.direction === 'string' && primaryEvent.direction.trim()) {
        const dirPhrase = `Look ${primaryEvent.direction}`;
        const directionLower = primaryEvent.direction.toLowerCase();
        if (!parts.some(p => p.toLowerCase().includes(directionLower))) {
          parts.push(dirPhrase);
        }
      }
    }
    // Remove duplicate phrases
    const deduped = Array.from(new Set(parts));
    return deduped.join('. ') + '.';
  }
  
  // General stargazing conditions
  if (stargazingScore >= 80) {
    return "Excellent conditions for deep space observation and Milky Way photography.";
  } else if (stargazingScore >= 60) {
    return "Good stargazing conditions - planets and bright stars clearly visible.";
  } else if (stargazingScore >= 40) {
    return "Fair conditions for basic stargazing - bright objects will be visible.";
  } else if (tonight.moon.illumination > 80) {
    return "Bright moonlight will wash out fainter stars, but great for lunar observation.";
  } else {
    return "Challenging conditions for stargazing tonight - consider waiting for clearer skies.";
  }
};
const getMidnightWeatherIcon = (weatherData: WeatherData | undefined) => {
  // Always return a night icon since this is for midnight
  if (!weatherData) return '01n.svg'; // Default clear night
  
  const condition = weatherData.condition || '';
  const clouds = weatherData.clouds || 0;
  const rain = weatherData.rain || 0;
  const snow = weatherData.snow || 0;
  
  // Check for precipitation first
  if (snow > 0) return '13n.svg'; // Snow
  if (rain > 0) return '10n.svg'; // Rain
  
  // Check for thunderstorms
  if (condition.toLowerCase().includes('thunderstorm') || condition.toLowerCase().includes('storm')) {
    return '11n.svg';
  }
  
  // Check cloud coverage
  if (clouds >= 75) return '04n.svg'; // Overcast/broken clouds
  if (clouds >= 50) return '03n.svg'; // Scattered clouds  
  if (clouds >= 25) return '02n.svg'; // Few clouds
  
  // Check for fog/mist
  if (condition.toLowerCase().includes('mist') || 
      condition.toLowerCase().includes('fog') || 
      (weatherData.visibility && weatherData.visibility < 5000)) {
    return '50n.svg';
  }
  
  return '01n.svg'; // Clear night
};

// Helper to get midnight weather from hourly data
const getMidnightWeather = (weatherData: WeatherData | undefined) => {
  if (!weatherData?.hourly) return null;
  // Find the first hour at 00:00 (midnight)
  const midnightHour = weatherData.hourly.find((h) => {
    const date = new Date(h.dt * 1000);
    return date.getHours() === 0;
  });
  return midnightHour || null;
};

// Helper to get current weather
const getCurrentWeather = (weatherData: WeatherData | undefined) => {
  return weatherData?.current || null;
};

// Helper to get daily high/low
const getDailyTemps = (weatherData: WeatherData | undefined) => {
  const today = weatherData?.daily?.[0];
  if (!today) return { tempMin: null, tempMax: null };
  return {
    tempMin: today.temp?.min ?? null,
    tempMax: today.temp?.max ?? null,
  };
};

// Build an Open‑Meteo‑like hourly object from OpenWeather One Call hourly
function buildHourlyForClearSkies(weatherData: WeatherData | undefined) {
  const hourly = Array.isArray(weatherData?.hourly) ? weatherData.hourly : [];
  if (!hourly.length) return null;
  const time = hourly.map((h) => new Date(h.dt * 1000).toISOString());
  const cloudcover = hourly.map((h) => Number(h?.clouds ?? NaN));
  return { time, cloudcover };
}

// Only treat as ISO if it looks like a date string; otherwise ignore
function toISOIfISOish(s?: string) {
  if (typeof s !== 'string') return undefined;
  if (!(/[TZ]|\d{4}-\d{2}-\d{2}/.test(s))) return undefined;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

const AstronomyCard: React.FC<AstronomyCardProps> = ({ className = '', style = {}, weatherData }) => {

  // Stable moon lore selection
  const [moonLoreText, setMoonLoreText] = useState<string | undefined>(undefined);
  const [moonLoreTitle, setMoonLoreTitle] = useState<string | undefined>(undefined);
  const { preferences } = useUserPreferences();
  const [highlights, setHighlights] = useState<AstronomyHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Defensive: preferences and locations
  const homeLocation = preferences?.locations?.find((l) => l.type === 'home');

  // Defensive: interests array - marked with underscore since it's not used directly
  const _interests = Array.isArray(preferences?.interests) ? preferences.interests : [];

  // Defensive: always call hooks at top level, now pass sunrise/sunset for night time logic
  // We'll use tonight.sun.sunrise/sunset if available, else undefined
  const [_sunTimes, setSunTimes] = useState<{sunrise?: string, sunset?: string}>({});
  useEffect(() => {
    if (highlights && highlights.length > 0 && highlights[0].sun) {
      setSunTimes({
        sunrise: highlights[0].sun.sunrise,
        sunset: highlights[0].sun.sunset
      });
    }
  }, [highlights]);

  // Defensive: fetch astronomy highlights only if lat/lon are available
  useEffect(() => {
    let cancelled = false;
    const fetchAstronomyHighlights = async () => {
      if (!homeLocation?.lat || !homeLocation?.lon) {
        setLoading(false);
        setHighlights([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        
        // Add a retry mechanism for fetching astronomy data
        let response;
        let retries = 2;
        
        while (retries >= 0) {
          try {
            // Create an AbortController for request timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
              response = await fetch(
                `/api/astronomy-highlights?lat=${homeLocation.lat}&lon=${homeLocation.lon}&days=3`,
                { 
                  // Add cache control headers to avoid stale responses
                  headers: { 'Cache-Control': 'no-cache' },
                  // Use the abort controller signal for timeout
                  signal: controller.signal
                }
              );
            } finally {
              clearTimeout(timeoutId);
            }
            
            if (response.ok) break; // If successful, break out of retry loop
            
            if (retries === 0) {
              // On final retry, throw with status info
              throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
            }
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (2 - retries)));
          } catch (fetchErr) {
            if (retries === 0) throw fetchErr; // Rethrow on final retry
          }
          
          retries--;
        }
        
        // Process the response - TypeScript fix for possibly undefined response
        if (!response) {
          throw new Error('Failed to receive response from server');
        }
        
        // Handle potential JSON parse errors
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('JSON parse error:', jsonError);
          throw new Error('Invalid response format from server');
        }
        
        // Validate the data structure with more detailed error
        if (!data) {
          throw new Error('Empty response received from astronomy API');
        }
        
        if (!Array.isArray(data.highlights)) {
          console.error('Invalid API response format:', data);
          // Create minimal fallback data structure if possible
          if (data.error) {
            throw new Error(`API Error: ${data.error}`);
          } else {
            throw new Error('Invalid data format: highlights array missing');
          }
        }
        
        if (!cancelled) setHighlights(data.highlights);
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching astronomy highlights:', err);
          // More descriptive error message for users
          const errorMessage = err instanceof Error 
            ? `${err.message} (Please try again later)`
            : 'Failed to fetch astronomy data - network error or service unavailable';
          setError(errorMessage);
          
          // Provide fallback data in case of error
          setHighlights([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAstronomyHighlights();
    return () => { cancelled = true; };
  }, [homeLocation?.lat, homeLocation?.lon]);

  // Get tonight's astronomy data from the first highlight
  const tonight = Array.isArray(highlights) && highlights.length > 0 ? highlights[0] : undefined;

  useEffect(() => {
    if (tonight?.moon?.phaseName) {
      // Normalize phase name to match enum keys
      const phaseKey = tonight.moon.phaseName.toLowerCase().replace(/\s+/g, '_');
      const loreItems = getMoonLore(phaseKey as MoonPhase);
      if (loreItems && loreItems.length > 0) {
        setMoonLoreText(loreItems[0].text);
        setMoonLoreTitle(loreItems[0].title);
      } else {
        setMoonLoreText(undefined);
        setMoonLoreTitle(undefined);
      }
    } else {
      setMoonLoreText(undefined);
      setMoonLoreTitle(undefined);
    }
  }, [tonight?.moon?.phaseName]);

  // Always render the Astronomy Card, regardless of interests, loading, error, or highlight state
  // Show fallback UI if loading, error, or no highlights
  if (loading) {
    return (
      <OptimizedBackgroundImage
        src="/milkyway.png"
        alt="Night sky background"
        className={`activity-card-enhanced ${className}`}
        style={style}
      >
        <div className="activity-card-overlay" />
        <div className="activity-card-content">
          <div className="forecast-header">
            <div className="date-info">
              <h3 className="date-label">The Sky Tonight</h3>
            </div>
          </div>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            Loading astronomy highlights...
          </div>
        </div>
      </OptimizedBackgroundImage>
    );
  }
  if (error || !tonight) {
    // Create fallback data based on current date/time
    const now = new Date();
    // Calculate a simple moon phase estimate based on date
    // This is just an approximation for fallback display
    const dayOfMonth = now.getDate();
    const phase = (dayOfMonth % 30) / 30; // 0-1 representation of moon cycle
    
    // Choose appropriate moon phase and icon based on cycle position
    let fallbackMoonPhase = "Waxing Gibbous";
    let fallbackMoonIcon = "moon-waxing-gibbous.svg";
    
    if (phase < 0.03) {
      fallbackMoonPhase = "New Moon";
      fallbackMoonIcon = "moon-new.svg";
    } else if (phase < 0.25) {
      fallbackMoonPhase = "Waxing Crescent";
      fallbackMoonIcon = "moon-waxing-crescent.svg";
    } else if (phase < 0.28) {
      fallbackMoonPhase = "First Quarter";
      fallbackMoonIcon = "moon-first-quarter.svg";
    } else if (phase < 0.47) {
      fallbackMoonPhase = "Waxing Gibbous";
      fallbackMoonIcon = "moon-waxing-gibbous.svg";
    } else if (phase < 0.53) {
      fallbackMoonPhase = "Full Moon";
      fallbackMoonIcon = "moon-full.svg";
    } else if (phase < 0.72) {
      fallbackMoonPhase = "Waning Gibbous";
      fallbackMoonIcon = "moon-waning-gibbous.svg";
    } else if (phase < 0.78) {
      fallbackMoonPhase = "Last Quarter";
      fallbackMoonIcon = "moon-last-quarter.svg";
    } else {
      fallbackMoonPhase = "Waning Crescent";
      fallbackMoonIcon = "moon-waning-crescent.svg";
    }
    
    return (
      <OptimizedBackgroundImage
        src="/milkyway.png"
        alt="Night sky background"
        className={`activity-card-enhanced ${className}`}
        style={style}
      >
        <div className="activity-card-overlay" />
        <div className="activity-card-content">
          <div className="forecast-header">
            <div className="date-info">
              <h3 className="date-label">Tonight&apos;s Sky</h3>
            </div>
          </div>
          
          {/* Hero activity section with fallback data */}
          <div className="card__hero-activity">
            <div className="card__hero-icon">
              <OptimizedImage
                src="/weather-icons/design/fill/final/starry-night.svg"
                alt="Astronomy"
                width={96}
                height={96}
              />
            </div>
            <div className="card__hero-title">
              <div className="card__hero-name outdoor">
                Stargazing
              </div>
              <div className="card__hero-message">
                Look up tonight!
              </div>
            </div>
            <div
              className="card__score-badge"
              style={{ background: 'transparent' }}
            >
              <OptimizedImage
                src={`/weather-icons/design/fill/final/${fallbackMoonIcon}`}
                alt={fallbackMoonPhase}
                width={192}
                height={192}
              />
            </div>
          </div>
          
          {/* Error message with retry suggestion */}
          <div style={{ 
            padding: '1rem', 
            margin: '1rem auto', 
            textAlign: 'center', 
            color: '#ef4444',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            maxWidth: '90%'
          }}>
            <p style={{ margin: '0.5rem 0' }}>                <strong>Astronomy data temporarily unavailable</strong>
            </p>              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
              {error ? error : "Could not retrieve astronomical data for your location."}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              style={{ 
                marginTop: '0.5rem',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                padding: '4px 12px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Try again
            </button>
          </div>
          
          {/* Fallback moon lore section */}
          <div className="moon-lore mt-4">
            <h4 className={`${indieFlower.className} font-bold text-lg leading-snug mb-1`}>
              {fallbackMoonPhase} Moon
            </h4>
            <p className={`${indieFlower.className} opacity-90`} style={{ marginTop: 0 }}>
              Even without detailed data, the night sky offers many wonders to observe.
            </p>
          </div>
        </div>
      </OptimizedBackgroundImage>
    );
  }

  // Extract weather info
  const currentWeather = getCurrentWeather(weatherData);
  const midnightWeather = getMidnightWeather(weatherData);
  // Marked with underscore since not used directly
  const { tempMin: _tempMin, tempMax: _tempMax } = getDailyTemps(weatherData);
  // Robust: Get night temperature and description for tonight
  let nightTemp = null;
  let nightDescription = '';
  // Prefer One Call 3.0 daily[0] for tonight
  if (weatherData?.daily?.[0]?.temp?.night !== undefined) {
    nightTemp = weatherData.daily[0].temp.night;
    nightDescription = weatherData.daily[0].weather?.[0]?.description ?? '';
  } else if (weatherData?.nightTemp !== undefined) {
    nightTemp = weatherData.nightTemp;
    // Try to get a description for night: prefer 'nightDescription', else fallback to 'description'
    nightDescription = weatherData.nightDescription ?? weatherData.description ?? '';
  } else if (midnightWeather?.temp !== undefined) {
    nightTemp = midnightWeather.temp;
    nightDescription = midnightWeather.weather?.[0]?.description ?? '';
  } else if (
    tonight?.sun?.sunset &&
    Array.isArray(weatherData?.hourly) &&
    weatherData.hourly.length > 0
  ) {
    // Offset sunset by 2 hours and find nearest hourly data
    const sunsetTime = new Date(tonight.sun.sunset).getTime();
    const targetTime = sunsetTime + 2 * 60 * 60 * 1000;
    let closestHour = weatherData.hourly[0];
    let minDiff = Math.abs(new Date(weatherData.hourly[0].dt * 1000).getTime() - targetTime);
    for (const h of weatherData.hourly) {
      const hTime = new Date(h.dt * 1000).getTime();
      const diff = Math.abs(hTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestHour = h;
      }
    }
    nightTemp = closestHour.temp;
    nightDescription = closestHour.weather?.[0]?.description ?? '';
  } else if (currentWeather?.temp !== undefined) {
    nightTemp = currentWeather.temp;
    nightDescription = currentWeather.weather?.[0]?.description ?? '';
  }

  // Defensive: weather data
  const cloudCover = typeof weatherData?.clouds === 'number' ? weatherData.clouds : 0;
  const astronomyIcon = getAstronomyIcon(Array.isArray(tonight.events) ? tonight.events : [], tonight.moon.illumination, cloudCover);
  const midnightWeatherIcon = midnightWeather ? midnightWeather.weather?.[0]?.icon + '.svg' : getMidnightWeatherIcon(weatherData);

  // Defensive: primary event
  const eventsArr = Array.isArray(tonight.events) ? tonight.events : [];
  const primaryEvent = eventsArr.find(e => e.type === 'eclipse') ||
                      eventsArr.find(e => e.type === 'meteor_shower') ||
                      eventsArr[0];

  // Defensive: stargazing score
  const moonIllum = typeof tonight.moon.illumination === 'number' ? tonight.moon.illumination : 0;
  const stargazingScore = Math.max(0, 100 - moonIllum - cloudCover);

  console.log('AstronomyCard weatherData:', weatherData);
  console.log('midnightWeather:', midnightWeather);
  console.log('currentWeather:', currentWeather);

  // "Clearest skies" message using hourly cloud cover (prefers dark window if provided)
  const hourlyForClear = buildHourlyForClearSkies(weatherData);
  const tzGuess = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
  const windowStartISO = toISOIfISOish(tonight?.darkWindow?.start);
  const windowEndISO = toISOIfISOish(tonight?.darkWindow?.end);
  const clearestSkiesMsg = hourlyForClear
    ? describeClearestSkiesFromHourly(hourlyForClear, tzGuess, { windowStartISO, windowEndISO, smooth: 3 })
    : null;

  return (
    <OptimizedBackgroundImage
      src="/milkyway.png"
      alt="Night sky background"
      className={`activity-card-enhanced ${className}`}
      style={style}
    >
      <div className="activity-card-overlay" />
      <div className="activity-card-content">
        {/* Weather icon top right - show midnight weather icon */}
        <div className="weather-icon-topright">
          <OptimizedImage
            src={`/weather-icons/design/fill/final/${midnightWeatherIcon}`}
            alt="Midnight weather"
            width={48}
            height={48}
          />
        </div>

        {/* Header matching day card structure */}
        <div className="forecast-header">
          <div className="date-info">
            <h3 className="date-label">Tonight&apos;s Sky</h3>
            {/* Astronomy header details: temp, condition, wind - styled as in day cards */}
            <div className="astro-header-details card__header-details">
<span className="temperature-label">
  &nbsp;{typeof nightTemp === 'number' ? Math.round(nightTemp) : '--'}°
  {nightDescription ? ` ${nightDescription}` : ''}
  <WindIcon windMs={
    typeof weatherData?.wind_speed === 'number'
      ? weatherData.wind_speed
      : typeof midnightWeather?.wind_speed === 'number'
      ? midnightWeather.wind_speed / 3.6
      : typeof currentWeather?.wind_speed === 'number'
      ? currentWeather.wind_speed / 3.6
      : 0
  } />
</span>
            </div>
          </div>
        </div>

        {/* Hero activity section - astronomy event or stargazing */}
        <div className="card__hero-activity">
          <div className="card__hero-icon">
            <OptimizedImage
              src={`/weather-icons/design/fill/final/${astronomyIcon}`}
              alt="Astronomy highlight"
              width={96}
              height={96}
            />
          </div>
          <div className="card__hero-title">
            <div className="card__hero-name outdoor">
              {primaryEvent ? primaryEvent.name : 'Stargazing'}
            </div>              <div className="card__hero-message">
                {primaryEvent ? "Do look up!" : `${Math.round(stargazingScore)}% visibility`}
              </div>
          </div>
          <div
            className="card__score-badge"
            style={{ background: 'transparent' }}
          >
            <OptimizedImage
              src={`/weather-icons/design/fill/final/${tonight.moon.icon}`}
              alt={tonight.moon.phaseName}
              width={96}
              height={96}
            />
          </div>
        </div>

        {/* Data bars section - astronomy and weather specific - 2 column layout */}
        <div className="data-grid" style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          marginBottom: '16px',
          padding: '0',
          width: '90%',
          margin: '0 auto'
        }}>
          {/* Row 1: Moon % | Clouds % */}
          <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <OptimizedImage
                  src={`/weather-icons/design/fill/final/${tonight.moon.icon}`}
                  alt="Moon phase"
                  width={25}
                  height={25}
                  style={{ marginRight: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Moon</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{Math.ceil(tonight.moon.illumination)}%</span>
            </div>
          </div>
          
          <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <OptimizedImage
                  src="/weather-icons/design/fill/final/04d.svg"
                  alt="Clouds"
                  width={25}
                  height={25}
                  style={{ marginRight: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Clouds</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {weatherData?.clouds !== undefined ? `${weatherData.clouds}%` : 'N/A'}
              </span>
            </div>
          </div>
          
          {/* Row 2: Visibility km | Precipitation mm */}
          <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <OptimizedImage
                  src="/weather-icons/design/fill/final/haze-night.svg"
                  alt="Visibility"
                  width={25}
                  height={25}
                  style={{ marginRight: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Clarity</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {weatherData?.visibility ? `${Math.round(weatherData.visibility / 1000)}km` : 'N/A'}
              </span>
            </div>
          </div>
          
          <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <OptimizedImage
                  src="/weather-icons/design/fill/final/09d.svg"
                  alt="Precipitation"
                  width={25}
                  height={25}
                  style={{ marginRight: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Rain</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {weatherData?.rain ? `${weatherData.rain}mm` : '0mm'}
              </span>
            </div>
          </div>
          
          {/* Row 3: Sunset | Sunrise */}
          {tonight.sun.sunset && (
            <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <OptimizedImage
                    src="/weather-icons/design/fill/final/sunset.svg"
                    alt="sunset"
                    width={25}
                    height={25}
                    style={{ marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Sunset</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{tonight.sun.sunset}</span>
              </div>
            </div>
          )}
          
          {tonight.sun.sunrise && (
            <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <OptimizedImage
                    src="/weather-icons/design/fill/final/sunrise.svg"
                    alt="sunrise"
                    width={25}
                    height={25}
                    style={{ marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Dawn</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{tonight.sun.sunrise}</span>
              </div>
            </div>
          )}
          
          {/* Row 4: Moon rise | Moon set */}
          {tonight.moon.rise && (
            <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <OptimizedImage
                    src="/weather-icons/design/fill/final/moonrise.svg"
                    alt="Moon rise"
                    width={25}
                    height={25}
                    style={{ marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Rise</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{tonight.moon.rise}</span>
              </div>
            </div>
          )}
          
          {tonight.moon.set && (
            <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <OptimizedImage
                    src="/weather-icons/design/fill/final/moonset.svg"
                    alt="Moon set"
                    width={25}
                    height={25}
                    style={{ marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Set</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{tonight.moon.set}</span>
              </div>
            </div>
          )}
          
          {/* Row 5: Event name | Best viewing (only if primaryEvent exists) */}
          {primaryEvent && (
            <>
              <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <OptimizedImage
                      src="/weather-icons/design/fill/final/falling-stars.svg"
                      alt="Celestial event"
                      width={25}
                      height={25}
                      style={{ marginRight: '4px' }}
                    />
                    {/* Removed "Event" label to improve layout */}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{primaryEvent.name}</span>
                </div>
              </div>
              
              {primaryEvent.bestTime && (
                <div className="data-cell" style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <OptimizedImage
                        src="/weather-icons/design/fill/final/star.svg"
                        alt="Best time"
                        width={20}
                        height={20}
                        style={{ marginRight: '4px' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>Best time</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{primaryEvent.bestTime}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Moon folklore section - stable moon lore below weather bars */}
        {/* Moon folklore — stable snippet below weather bars */}
<div className="moon-lore mt-4">
  <h4 className={`${indieFlower.className} font-bold text-lg leading-snug mb-1`}>
    {tonight?.moon?.phaseName
      ? `${tonight.moon.phaseName.replace(/_/g, ' ')} Moon Folklore${moonLoreTitle ? ' - ' + moonLoreTitle : ''}`
      : 'Moon Folklore'}
  </h4>
  <p className={`${indieFlower.className} opacity-90`} style={{ marginTop: 0 }}>
    {moonLoreText ?? 'No lore available for this phase.'}
  </p>
</div>

        {/* Astronomy message section - formatted similarly to moon lore */}
        <div className={`astronomy-message ${oxanium.className}`} style={{ margin: '16px 0', fontSize: '0.8rem' }}>
          <strong>🔭 Astronomy 🌖utlook</strong>
          <br />
          {getWeatherAwareMessage(primaryEvent, tonight, weatherData, stargazingScore)}
        </div>

        {/* Best sky window hint: only show concise time window message */}
        {clearestSkiesMsg && (
          <div className={`astronomy-message ${oxanium.className}`} style={{ margin: '4px 0 12px', opacity: 0.9, fontSize: '0.8rem' }}>
            <span style={{ fontStyle: 'italic' }}>{clearestSkiesMsg}</span>
          </div>
        )}

        {/* ISS sighting note - only if visible tonight */}
        {/* Next ISS pass tonight (first after sunset) */}
        {homeLocation?.lat && homeLocation?.lon && tonight?.sun?.sunset && (
          <IssNextPassNote lat={homeLocation.lat} lon={homeLocation.lon} sunsetISO={tonight.sun.sunset} />
        )}
      </div>
    </OptimizedBackgroundImage>
  );
};

// Helper component: fetch and show next ISS pass tonight
const IssNextPassNote: React.FC<{ lat: number; lon: number; sunsetISO?: string }> = ({ lat, lon, sunsetISO }) => {
  // Import the helper
  // ...existing imports...
  // import { describeIssPass } from '../utils/issHelper';
  const [pass, setPass] = useState<{ risetime?: string; duration?: number; mag?: number; maxEl?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use a ref to prevent multiple fetches
  const hasFetched = React.useRef(false);
  
  useEffect(() => {
    // Guard against re-fetching and unnecessary API calls
    if (hasFetched.current) return;
    
    let cancelled = false;
    hasFetched.current = true;
    setLoading(true);
    setError(null);
    
    // Fetch ISS next night pass from backend API
    fetch(`/api/iss-next-night-pass?lat=${lat}&lon=${lon}&sunsetISO=${encodeURIComponent(sunsetISO ?? '')}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          if (data?.pass && data.pass.risetime) {
            setPass({
              risetime: data.pass.risetime,
              duration: data.pass.duration,
              mag: data.pass.mag,
              maxEl: data.pass.maxEl
            });
          } else if (data?.error) {
            setError(data.error);
            setPass(null);
          } else {
            setError('No ISS pass found after sunset');
            setPass(null);
          }
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || String(err));
          setPass(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lon, sunsetISO]);
  if (loading) return null;
  if (error) {
    // Friendlier message for no pass found
    const friendlyMsg = error === 'No ISS pass found after sunset'
      ? 'No visible ISS pass tonight for your location. Try again tomorrow!'
      : `ISS sighting info unavailable: ${error}`;
    return (
      <div className={`astronomy-message ${oxanium.className}`} style={{ margin: '8px 0', opacity: 0.8, color: '#ef4444', fontSize: '0.8rem' }}>
        <span style={{ fontWeight: 500 }}>
          {friendlyMsg}
        </span>
      </div>
    );
  }
  if (!pass?.risetime) return null;
  // Use describeIssPass helper for a natural language summary
  // Compose the data object for the helper
  const issData = {
    ok: true,
    risetime: pass.risetime,
    duration: typeof pass.duration === 'number' ? pass.duration : 0,
    mag: typeof pass.mag === 'number' ? pass.mag : 0,
    maxEl: typeof pass.maxEl === 'number' ? pass.maxEl : 0,
    sunset: '', // not needed for summary
    nextSunrise: '' // not needed for summary
  };
  // Import describeIssPass at the top of the file:
  // import { describeIssPass } from '../utils/issHelper';
  // If not already imported, add it.
  // Render the summary
  return (
    <div className={`astronomy-message ${oxanium.className}`} style={{ margin: '8px 0', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
      <OptimizedImage
        src="/satellite_iss.png"
        alt="ISS icon"
        width={28}
        height={28}
        style={{ verticalAlign: 'middle', filter: 'drop-shadow(0px 0px 2px #fff)' }}
      />
      <span style={{ fontWeight: 500 }}>
        {describeIssPass(issData)}
      </span>
    </div>
  );
};

export default AstronomyCard;
