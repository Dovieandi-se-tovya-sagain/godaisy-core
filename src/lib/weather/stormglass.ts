/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/weather/stormglass.ts
// Go Daisy Stormglass integration using existing utils/fetchStormglass.ts

import { fetchMarineWithCache, fetchStormglassBio, StormglassResponse } from '../../utils/fetchStormglass'
import { getRectangleDayKey, type RectangleAnchor } from './rectangleAnchors'

export interface StormglassAnchorContext {
  rectangle?: RectangleAnchor | null;
  /** Override anchor latitude (falls back to rectangle.anchorLat if provided). */
  anchorLat?: number;
  anchorLon?: number;
  /** Optional cache day key (defaults to ISO date of now). */
  cacheDay?: string;
}

export interface ProcessedWeatherData {
  seaTemp: number           // °C
  windSpeedKnots: number    // knots (fishermen prefer knots)
  windDirection: number     // degrees
  waveHeight: number        // meters
  pressure: number          // hPa
  visibility: number        // km
  currentSpeed: number      // m/s
  currentDirection: number  // degrees
  conditions: 'excellent' | 'good' | 'moderate' | 'poor' | 'dangerous'
  safetyWarnings: string[]
  timestamp: string
  // Bio data for advanced predictions
  chlorophyll?: number      // Affects fish feeding
  dissolvedOxygen?: number  // Fish activity indicator
}

export interface TidalData {
  currentHeight: number
  nextHigh: { time: string; height: number } | null
  nextLow: { time: string; height: number } | null
  currentPhase: 'rising' | 'falling' | 'high_slack' | 'low_slack'
  timeToNextChange: number // minutes
  tidalRange: number
  currentStrength: 'weak' | 'moderate' | 'strong'
}

export interface ProcessedWeatherWithTides extends ProcessedWeatherData {
  tides: TidalData
}

export interface TidalContext {
  favorableTide: boolean
  tidalAdvice: string[]
  urgency: 'low' | 'medium' | 'high'
}

interface TidalAPIResponse {
  success: boolean
  data: Array<{
    time: string
    type: 'high' | 'low'
    height: number
  }>
  limited?: boolean
}

/**
 * Get comprehensive marine weather for fishing predictions
 */
export async function getWeatherForFishing(lat: number, lon: number, context?: StormglassAnchorContext): Promise<ProcessedWeatherData> {
  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
  
  const startISO = now.toISOString()
  const endISO = oneHourLater.toISOString()

  const rectangleCode = context?.rectangle?.rectangleCode
  const cacheDay = context?.cacheDay ?? getRectangleDayKey(now)
  const anchorLat = context?.anchorLat ?? context?.rectangle?.anchorLat ?? lat
  const anchorLon = context?.anchorLon ?? context?.rectangle?.anchorLon ?? lon

  try {
    // Get marine data (waves, wind, water temp, currents)
    const marineData = await fetchMarineWithCache(anchorLat, anchorLon, startISO, endISO, {
      rectangleCode,
      dayKey: cacheDay,
    })
    
    // Get bio data (chlorophyll, SST, oxygen) - optional for advanced predictions
    let bioData: StormglassResponse | null = null
    try {
      bioData = await fetchStormglassBio(anchorLat, anchorLon, startISO, endISO, {
        params: [
          'chlorophyll',
          'dissolvedOxygen', 
          'seaSurfaceTemperature'
        ],
        rectangleCode,
        dayKey: cacheDay,
      })
    } catch (error) {
      console.warn('Bio data not available:', error)
    }

    return processStormglassData(marineData, bioData)

  } catch (error) {
    console.error('Stormglass API error:', error)
    throw new Error('Failed to fetch marine weather data')
  }
}

/**
 * Enhanced version that includes tidal data from your internal API
 */
export async function getWeatherForFishingWithTides(lat: number, lon: number, context?: StormglassAnchorContext): Promise<ProcessedWeatherWithTides> {
  const anchorLat = context?.anchorLat ?? context?.rectangle?.anchorLat ?? lat
  const anchorLon = context?.anchorLon ?? context?.rectangle?.anchorLon ?? lon

  // Get standard weather data using anchor-aware context
  const weather = await getWeatherForFishing(lat, lon, {
    ...context,
    anchorLat,
    anchorLon,
  })
  
  // Get tidal data from your existing internal API (using anchor coordinates for Stormglass parity)
  const tides = await getInternalTidalData(anchorLat, anchorLon)
  
  return {
    ...weather,
    tides
  }
}

/**
 * Call your existing /api/tides endpoint internally
 */
async function getInternalTidalData(lat: number, lon: number): Promise<TidalData> {
  try {
    // Call your existing tides API endpoint internally
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
    const cleanBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    const response = await fetch(`${cleanBaseUrl}/api/tides?lat=${lat}&lon=${lon}`)
    
    if (!response.ok) {
      console.warn(`Internal tides API error: ${response.status}`)
      return getDefaultTidalData()
    }
    
    const result = await response.json() as TidalAPIResponse
    
    // Handle your API's graceful degradation
    if (result.limited || !result.success || !Array.isArray(result.data)) {
      console.warn('Tidal data limited or unavailable, using defaults')
      return getDefaultTidalData()
    }
    
    // Process the raw Stormglass extremes data from your API
    return processTidalExtremes(result.data)
    
  } catch (error) {
    console.error('Error fetching internal tidal data:', error)
    return getDefaultTidalData()
  }
}

/**
 * Process raw Stormglass extremes data from your existing API
 */
function processTidalExtremes(extremesData: Array<{time: string; type: 'high' | 'low'; height: number}>): TidalData {
  const now = new Date()
  
  // Filter upcoming tides
  const upcomingTides = extremesData.filter(tide => new Date(tide.time) > now)
  
  // Find next high and low
  const nextHigh = upcomingTides.find(tide => tide.type === 'high')
  const nextLow = upcomingTides.find(tide => tide.type === 'low')
  
  // Determine current phase and timing
  const nextTide = upcomingTides[0]
  const timeToNext = nextTide ? 
    Math.round((new Date(nextTide.time).getTime() - now.getTime()) / (1000 * 60)) : 360
  
  // Determine current phase
  let currentPhase: 'rising' | 'falling' | 'high_slack' | 'low_slack'
  let currentStrength: 'weak' | 'moderate' | 'strong'
  
  if (!nextTide) {
    currentPhase = 'rising'
    currentStrength = 'moderate'
  } else if (timeToNext < 30) {
    // Near tide change - slack water
    currentPhase = nextTide.type === 'high' ? 'high_slack' : 'low_slack'
    currentStrength = 'weak'
  } else {
    // Active tide
    currentPhase = nextTide.type === 'high' ? 'rising' : 'falling'
    currentStrength = timeToNext < 120 ? 'strong' : 'moderate'
  }
  
  // Calculate tidal range from recent tides
  const recentTides = extremesData.slice(0, 4)
  const highs = recentTides.filter(t => t.type === 'high').map(t => t.height)
  const lows = recentTides.filter(t => t.type === 'low').map(t => t.height)
  const tidalRange = (highs.length && lows.length) ? Math.abs(highs[0] - lows[0]) : 3.0
  
  // Estimate current height (simple interpolation)
  const currentHeight = estimateCurrentHeight(extremesData, now)
  
  return {
    currentHeight,
    nextHigh: nextHigh ? { time: nextHigh.time, height: nextHigh.height } : null,
    nextLow: nextLow ? { time: nextLow.time, height: nextLow.height } : null,
    currentPhase,
    timeToNextChange: timeToNext,
    tidalRange,
    currentStrength
  }
}

/**
 * Estimate current tidal height from extremes data
 */
function estimateCurrentHeight(
  extremes: Array<{time: string; height: number}>, 
  now: Date
): number {
  if (extremes.length < 2) return 2.0 // Default
  
  // Find the tide periods around current time
  const pastTides = extremes.filter(tide => new Date(tide.time) <= now).slice(0, 2)
  const futureTides = extremes.filter(tide => new Date(tide.time) > now).slice(0, 2)
  
  if (pastTides.length === 0 && futureTides.length >= 1) {
    return futureTides[0].height * 0.5 // Rough estimate
  }
  
  if (pastTides.length >= 1 && futureTides.length >= 1) {
    // Linear interpolation between closest tides
    const lastTide = pastTides[0]
    const nextTide = futureTides[0]
    const lastTime = new Date(lastTide.time).getTime()
    const nextTime = new Date(nextTide.time).getTime()
    const currentTime = now.getTime()
    
    const ratio = (currentTime - lastTime) / (nextTime - lastTime)
    return lastTide.height + (nextTide.height - lastTide.height) * ratio
  }
  
  return 2.0 // Default
}

/**
 * Default tidal data when API is unavailable
 */
function getDefaultTidalData(): TidalData {
  const now = new Date()
  return {
    currentHeight: 2.0,
    nextHigh: { 
      time: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(), 
      height: 4.0 
    },
    nextLow: { 
      time: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(), 
      height: 1.0 
    },
    currentPhase: 'rising',
    timeToNextChange: 360,
    tidalRange: 3.0,
    currentStrength: 'moderate'
  }
}

/**
 * Analyze tidal conditions for fishing advice context
 */
export function getTidalAdviceContext(tides: TidalData): TidalContext {
  const advice: string[] = []
  let favorableTide = false
  let urgency: 'low' | 'medium' | 'high' = 'low'
  
  switch (tides.currentPhase) {
    case 'rising':
      favorableTide = true
      advice.push('Flooding tide - excellent for most species')
      if (tides.timeToNextChange < 90) {
        urgency = 'high'
        advice.push(`Peak tide in ${tides.timeToNextChange} minutes`)
      } else if (tides.timeToNextChange < 180) {
        urgency = 'medium'
      }
      break
      
    case 'falling':
      favorableTide = tides.currentStrength !== 'weak'
      advice.push('Ebbing tide - good for structure fishing')
      if (tides.timeToNextChange < 60) {
        urgency = 'medium'
        advice.push('Approaching slack water')
      }
      break
      
    case 'high_slack':
      advice.push('High slack water - brief window for surface fishing')
      urgency = 'medium'
      favorableTide = false
      break
      
    case 'low_slack':
      advice.push('Low slack - minimal current, try deeper water')
      favorableTide = false
      break
  }
  
  // Tidal range context
  if (tides.tidalRange > 4) {
    advice.push('Strong tidal range - powerful currents expected')
  } else if (tides.tidalRange < 2) {
    advice.push('Weak tidal range - gentle currents')  
  }
  
  // Current strength context
  if (tides.currentStrength === 'strong' && favorableTide) {
    advice.push('Strong tidal flow - prime feeding conditions')
  }
  
  return { favorableTide, tidalAdvice: advice, urgency }
}

/**
 * Process Stormglass data into fishing-friendly format
 */
function processStormglassData(
  marineData: StormglassResponse, 
  bioData: StormglassResponse | null
): ProcessedWeatherData {
  
  // Get current hour data
  const currentHour = marineData.hours?.[0]
  const currentBio = bioData?.hours?.[0]

  if (!currentHour) {
    throw new Error('No current weather data available')
  }

  // Extract marine parameters (handle multiple sources - sg, noaa, etc.)
  const extractValue = (param: string, fallback: number = 0): number => {
    const paramData = currentHour[param] as any
    if (typeof paramData === 'number') return paramData
    if (typeof paramData === 'object' && paramData) {
      // Try different sources in order of preference
      return paramData.sg ?? paramData.noaa ?? paramData.smhi ?? fallback
    }
    return fallback
  }

  const extractBioValue = (param: string, fallback: number = 0): number => {
    if (!currentBio) return fallback
    const paramData = currentBio[param] as any
    if (typeof paramData === 'number') return paramData
    if (typeof paramData === 'object' && paramData) {
      return paramData.sg ?? paramData.noaa ?? fallback
    }
    return fallback
  }

  // Core marine parameters
  const waterTemp = extractValue('waterTemperature', 15)
  const seaSurfaceTemp = extractBioValue('seaSurfaceTemperature', waterTemp)
  const seaTemp = seaSurfaceTemp || waterTemp // Prefer bio SST if available
  
  const windSpeed = extractValue('windSpeed', 0) // m/s
  const windSpeedKnots = windSpeed * 1.94384 // Convert to knots
  const windDirection = extractValue('windDirection', 0)
  
  const waveHeight = extractValue('waveHeight', 0)
  const swellHeight = extractValue('swellHeight', 0)
  const totalWaveHeight = Math.max(waveHeight, swellHeight)
  
  const currentSpeed = extractValue('currentSpeed', 0)
  const currentDirection = extractValue('currentDirection', 0)
  
  // Bio parameters (for advanced predictions)
  const chlorophyll = extractBioValue('chlorophyll')
  const dissolvedOxygen = extractBioValue('dissolvedOxygen')

  // Estimate pressure and visibility (not always in Stormglass marine endpoint)
  const pressure = 1013 // Default sea level pressure
  const visibility = estimateVisibility(windSpeedKnots, totalWaveHeight)

  // Assess conditions
  const conditions = assessFishingConditions({
    windSpeedKnots,
    waveHeight: totalWaveHeight,
    visibility
  })

  // Generate safety warnings
  const safetyWarnings = generateSafetyWarnings({
    windSpeedKnots,
    waveHeight: totalWaveHeight,
    visibility,
    currentSpeed
  })

  return {
    seaTemp: Math.round(seaTemp * 10) / 10,
    windSpeedKnots: Math.round(windSpeedKnots * 10) / 10,
    windDirection: Math.round(windDirection),
    waveHeight: Math.round(totalWaveHeight * 10) / 10,
    pressure,
    visibility,
    currentSpeed: Math.round(currentSpeed * 100) / 100,
    currentDirection: Math.round(currentDirection),
    conditions,
    safetyWarnings,
    timestamp: currentHour.time,
    chlorophyll: chlorophyll || undefined,
    dissolvedOxygen: dissolvedOxygen || undefined
  }
}

/**
 * Estimate visibility based on wind and wave conditions
 */
function estimateVisibility(windKnots: number, waveHeight: number): number {
  // Rough estimation - in practice would use actual visibility data
  if (windKnots > 25 || waveHeight > 3) return 2 // Poor visibility
  if (windKnots > 15 || waveHeight > 2) return 5 // Moderate visibility  
  if (windKnots > 10 || waveHeight > 1) return 8 // Good visibility
  return 12 // Excellent visibility
}

/**
 * Assess fishing conditions for small boats
 */
function assessFishingConditions(params: {
  windSpeedKnots: number
  waveHeight: number
  visibility: number
}): 'excellent' | 'good' | 'moderate' | 'poor' | 'dangerous' {
  const { windSpeedKnots, waveHeight, visibility } = params

  // Dangerous conditions (small boat safety)
  if (windSpeedKnots > 25 || waveHeight > 3.0 || visibility < 1.0) {
    return 'dangerous'
  }

  // Poor conditions
  if (windSpeedKnots > 20 || waveHeight > 2.0 || visibility < 2.0) {
    return 'poor'
  }

  // Moderate conditions
  if (windSpeedKnots > 15 || waveHeight > 1.5 || visibility < 5.0) {
    return 'moderate'
  }

  // Good conditions
  if (windSpeedKnots > 10 || waveHeight > 1.0) {
    return 'good'
  }

  // Excellent conditions
  return 'excellent'
}

/**
 * Generate safety warnings for small boat fishermen
 */
function generateSafetyWarnings(params: {
  windSpeedKnots: number
  waveHeight: number  
  visibility: number
  currentSpeed: number
}): string[] {
  const warnings: string[] = []
  const { windSpeedKnots, waveHeight, visibility, currentSpeed } = params

  if (windSpeedKnots > 20) {
    warnings.push(`Strong winds: ${Math.round(windSpeedKnots)} knots - Consider postponing trip`)
  } else if (windSpeedKnots > 15) {
    warnings.push(`Moderate winds: ${Math.round(windSpeedKnots)} knots - Experienced boaters only`)
  }

  if (waveHeight > 2.5) {
    warnings.push(`High waves: ${waveHeight}m - Dangerous for small boats`)
  } else if (waveHeight > 1.5) {
    warnings.push(`Moderate waves: ${waveHeight}m - Use caution`)
  }

  if (visibility < 2.0) {
    warnings.push(`Poor visibility: ${visibility}km - Navigation hazard`)
  }

  if (currentSpeed > 2.0) {
    warnings.push(`Strong currents: ${currentSpeed}m/s - Anchoring may be difficult`)
  }

  return warnings
}

/**
 * Calculate weather impact on fish species (enhanced with bio data)
 */
export function calculateWeatherImpact(
  species: {
    windSensitivity: number
    temperatureSensitivity: number
    pressureSensitivity: number
    optimalTempMin: number
    optimalTempMax: number
    optimalWindMax: number
  },
  weather: ProcessedWeatherData
): number {
  let modifier = 1.0

  // Temperature impact (most important)
  if (weather.seaTemp >= species.optimalTempMin && weather.seaTemp <= species.optimalTempMax) {
    modifier *= 1.2 // Perfect temperature
  } else {
    const tempDeviation = Math.min(
      Math.abs(weather.seaTemp - species.optimalTempMin),
      Math.abs(weather.seaTemp - species.optimalTempMax)
    )
    modifier *= Math.max(0.3, 1 - (tempDeviation * species.temperatureSensitivity * 0.1))
  }

  // Wind impact
  if (weather.windSpeedKnots > species.optimalWindMax) {
    const windExcess = weather.windSpeedKnots - species.optimalWindMax
    modifier *= Math.max(0.2, 1 - (windExcess * species.windSensitivity * 0.05))
  }

  // Current impact (strong currents can improve feeding)
  if (weather.currentSpeed > 0.5 && weather.currentSpeed < 2.0) {
    modifier *= 1.1 // Moderate currents good for feeding
  } else if (weather.currentSpeed > 2.0) {
    modifier *= 0.9 // Very strong currents disrupt feeding
  }

  // Bio enhancement (if available)
  if (weather.chlorophyll && weather.chlorophyll > 0.5) {
    modifier *= 1.15 // Higher chlorophyll = more food = more fish
  }
  
  if (weather.dissolvedOxygen && weather.dissolvedOxygen > 6) {
    modifier *= 1.1 // Good oxygen levels = active fish
  }

  // Safety factor (can't fish if dangerous)
  if (weather.conditions === 'dangerous') {
    modifier *= 0.1
  } else if (weather.conditions === 'poor') {
    modifier *= 0.4
  } else if (weather.conditions === 'excellent') {
    modifier *= 1.3
  }

  return Math.max(0.05, Math.min(2.5, modifier))
}