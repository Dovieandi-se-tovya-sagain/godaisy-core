// lib/findr/locationDetection.ts
import { findNearestGridCellId } from './gridCellLookup';

import { type RectangleOption } from '../../hooks/useFindrRectangleOptions';

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  method: 'gps' | 'ip' | 'manual';
}

export interface NearestRectangles {
  primary: RectangleOption;
  alternatives: RectangleOption[];
  distance: number; // km to primary rectangle
}

/**
 * Get user's location using various methods (GPS, IP, manual)
 */
export async function detectUserLocation(method: 'gps' | 'ip' | 'manual' = 'gps'): Promise<DetectedLocation | null> {
  try {
    switch (method) {
      case 'gps':
        return await getGPSLocation();
      case 'ip':
        return await getIPLocation();
      case 'manual':
        return null; // User will select manually
      default:
        return null;
    }
  } catch (error) {
    console.warn(`Location detection (${method}) failed:`, error);
    return null;
  }
}

/**
 * Get GPS location with privacy-preserving options
 */
async function getGPSLocation(): Promise<DetectedLocation | null> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          method: 'gps'
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false, // Save battery
        timeout: 10000, // 10 second timeout
        maximumAge: 300000 // Accept 5-minute old location
      }
    );
  });
}

/**
 * Get approximate location from IP address
 */
async function getIPLocation(): Promise<DetectedLocation | null> {
  try {
    // Use a free IP geolocation service
    const response = await fetch('https://ipapi.co/json/');
    
    if (!response.ok) {
      throw new Error('IP location service unavailable');
    }
    
    const data = await response.json();
    
    if (data.latitude && data.longitude) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: 10000, // ~10km accuracy for IP location
        method: 'ip'
      };
    }
    
    return null;
  } catch (error) {
    console.warn('IP location failed:', error);
    return null;
  }
}

/**
 * Find the nearest ICES rectangles to a given location
 */
export function findNearestRectangles(
  location: DetectedLocation,
  rectangles: RectangleOption[],
  maxResults: number = 5
): NearestRectangles | null {
  // Use grid cell lookup for US/CA/MX, fallback to ICES rectangles for Europe
  const lat = location.latitude;
  const lon = location.longitude;
  // Simple region check (should match API logic)
  const isAmericas = lat >= 14 && lat <= 72 && lon <= -66 && lon >= -170;
  if (isAmericas) {
    // Use grid cell lookup
    const cellId = findNearestGridCellId(lat, lon);
    // Return a dummy RectangleOption for grid cell
    return {
      primary: {
        code: cellId,
        label: 'NOAA Grid Cell',
        region: 'Americas',
        centerLat: lat,
        centerLon: lon,
      },
      alternatives: [],
      distance: 0,
    };
  }
  // Otherwise, fallback to ICES rectangles
  if (!rectangles.length) return null;
  const distances = rectangles.map(rectangle => ({
    rectangle,
    distance: calculateDistance(
      lat,
      lon,
      rectangle.centerLat,
      rectangle.centerLon
    )
  }));
  distances.sort((a, b) => a.distance - b.distance);
  const primary = distances[0];
  const alternatives = distances.slice(1, maxResults).map(d => d.rectangle);
  return {
    primary: primary.rectangle,
    alternatives,
    distance: primary.distance
  };
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Privacy-preserving location rounding
 */
export function roundLocationForPrivacy(
  location: DetectedLocation,
  precision: 'coarse' | 'medium' | 'fine' = 'medium'
): DetectedLocation {
  let factor: number;
  
  switch (precision) {
    case 'coarse':
      factor = 0.1; // ~11km
      break;
    case 'medium':
      factor = 0.05; // ~5.5km
      break;
    case 'fine':
      factor = 0.01; // ~1.1km
      break;
  }

  return {
    ...location,
    latitude: Math.round(location.latitude / factor) * factor,
    longitude: Math.round(location.longitude / factor) * factor,
  };
}

/**
 * Check if location is within reasonable fishing distance from shore
 */
export function isValidFishingLocation(location: DetectedLocation, _maxDistanceKm: number = 200): boolean {
  // This is a simplified check - in production you'd want to check against
  // actual coastline data or use the distanceToShoreKm from rectangle data
  
  // For now, just check if it's not in the middle of a continent
  // Most fishing happens within 200km of coast
  return true; // Placeholder - implement proper coastline checking
}

/**
 * Get location suggestions based on user input
 */
export async function getLocationSuggestions(query: string): Promise<RectangleOption[]> {
  try {
    const response = await fetch(`/api/findr/rectangles?search=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    
    const data = await response.json();
    return data.options || [];
  } catch (error) {
    console.warn('Location search failed:', error);
    return [];
  }
}