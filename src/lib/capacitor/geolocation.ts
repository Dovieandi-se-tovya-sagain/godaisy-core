/**
 * Geolocation Wrapper
 *
 * Unified geolocation API that works seamlessly across web and native platforms
 *
 * Features:
 * - Uses native Geolocation plugin on iOS/Android
 * - Falls back to web Geolocation API in browser
 * - Handles permissions automatically
 * - Type-safe error handling
 * - High accuracy positioning
 *
 * Usage:
 * ```typescript
 * import { getCurrentPosition, watchPosition } from './geolocation';
 *
 * // Get current position once
 * const coords = await getCurrentPosition();
 * console.log(coords.latitude, coords.longitude);
 *
 * // Watch position updates
 * const watchId = await watchPosition((coords) => {
 *   console.log('Position updated:', coords);
 * });
 *
 * // Clear watch
 * await clearWatch(watchId);
 * ```
 */

import { Geolocation as CapacitorGeolocation } from '@capacitor/geolocation';
import { isNative } from './platform';

/**
 * Unified coordinates interface
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

/**
 * Position result with timestamp
 */
export interface Position {
  coords: Coordinates;
  timestamp: number;
}

/**
 * Geolocation error types
 */
export type GeolocationError =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Custom error class for geolocation errors
 */
export class GeolocationException extends Error {
  constructor(
    public type: GeolocationError,
    message: string
  ) {
    super(message);
    this.name = 'GeolocationException';
  }
}

/**
 * Get current position
 * High accuracy enabled by default
 */
export const getCurrentPosition = async (): Promise<Position> => {
  try {
    if (isNative()) {
      // Use native Capacitor plugin
      const position = await CapacitorGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      return {
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
        },
        timestamp: position.timestamp,
      };
    } else {
      // Use web Geolocation API
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(
            new GeolocationException(
              'POSITION_UNAVAILABLE',
              'Geolocation is not supported by this browser'
            )
          );
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            });
          },
          (error) => {
            const errorType: GeolocationError =
              error.code === 1
                ? 'PERMISSION_DENIED'
                : error.code === 2
                  ? 'POSITION_UNAVAILABLE'
                  : error.code === 3
                    ? 'TIMEOUT'
                    : 'UNKNOWN';

            reject(new GeolocationException(errorType, error.message));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      });
    }
  } catch (error) {
    if (error instanceof GeolocationException) {
      throw error;
    }

    // Handle Capacitor-specific errors
    if (error instanceof Error) {
      if (error.message.includes('location permissions')) {
        throw new GeolocationException('PERMISSION_DENIED', error.message);
      }
      throw new GeolocationException('UNKNOWN', error.message);
    }

    throw new GeolocationException('UNKNOWN', 'Failed to get current position');
  }
};

/**
 * Options for watching position
 */
export interface WatchPositionOptions {
  /** Minimum time between updates in milliseconds (default: 120000ms = 2 minutes) */
  minInterval?: number;
  /** Enable high accuracy GPS (default: true) */
  enableHighAccuracy?: boolean;
  /** Maximum time to wait for a position (default: 10000ms) */
  timeout?: number;
  /** Maximum age of a cached position (default: 0) */
  maximumAge?: number;
}

/**
 * Watch position updates with debouncing to prevent battery drain
 * Returns watch ID that can be used to clear the watch
 *
 * Note: minInterval defaults to 120000ms (2 minutes) to maximize battery
 * savings. GPS can fully power down between updates at this interval.
 * Ideal for fishing app where users are mostly stationary.
 *
 * For active use cases (moving between spots), use shorter intervals:
 * - 30000ms (30s) for walking/driving between locations
 * - 5000ms (5s) for precise boat trolling
 */
export const watchPosition = async (
  callback: (position: Position) => void,
  errorCallback?: (error: GeolocationException) => void,
  options: WatchPositionOptions = {}
): Promise<string> => {
  const {
    minInterval = 120000, // 2 minute interval (optimal for battery, ideal for fishing)
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
  } = options;

  let lastUpdateTime = 0;

  // Debounced callback wrapper
  const debouncedCallback = (position: Position) => {
    const now = Date.now();

    // Skip update if within debounce interval
    if (now - lastUpdateTime < minInterval) {
      return;
    }

    lastUpdateTime = now;
    callback(position);
  };
  if (isNative()) {
    // Use native Capacitor plugin
    const watchId = await CapacitorGeolocation.watchPosition(
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
      (position, error) => {
        if (error) {
          if (errorCallback) {
            const errorType: GeolocationError = error.message.includes('permission')
              ? 'PERMISSION_DENIED'
              : 'UNKNOWN';
            errorCallback(new GeolocationException(errorType, error.message));
          }
          return;
        }

        if (position) {
          debouncedCallback({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          });
        }
      }
    );

    return watchId;
  } else {
    // Use web Geolocation API
    if (!navigator.geolocation) {
      throw new GeolocationException(
        'POSITION_UNAVAILABLE',
        'Geolocation is not supported by this browser'
      );
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        debouncedCallback({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        });
      },
      (error) => {
        if (errorCallback) {
          const errorType: GeolocationError =
            error.code === 1
              ? 'PERMISSION_DENIED'
              : error.code === 2
                ? 'POSITION_UNAVAILABLE'
                : error.code === 3
                  ? 'TIMEOUT'
                  : 'UNKNOWN';

          errorCallback(new GeolocationException(errorType, error.message));
        }
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    return watchId.toString();
  }
};

/**
 * Clear position watch
 */
export const clearWatch = async (watchId: string): Promise<void> => {
  if (isNative()) {
    await CapacitorGeolocation.clearWatch({ id: watchId });
  } else {
    navigator.geolocation.clearWatch(parseInt(watchId, 10));
  }
};

/**
 * Check if geolocation permissions are granted
 */
export const checkPermissions = async (): Promise<boolean> => {
  if (isNative()) {
    const permissions = await CapacitorGeolocation.checkPermissions();
    return permissions.location === 'granted';
  } else {
    // Web Geolocation API doesn't have a direct permission check
    // Try to get position to check if permission is granted
    try {
      await getCurrentPosition();
      return true;
    } catch (error) {
      if (error instanceof GeolocationException && error.type === 'PERMISSION_DENIED') {
        return false;
      }
      // Other errors (like position unavailable) don't mean permission denied
      return true;
    }
  }
};

/**
 * Request geolocation permissions
 * On web, this will trigger the browser permission prompt when getCurrentPosition is called
 */
export const requestPermissions = async (): Promise<boolean> => {
  if (isNative()) {
    const permissions = await CapacitorGeolocation.requestPermissions();
    return permissions.location === 'granted';
  } else {
    // Web doesn't have explicit permission request - it's triggered by getCurrentPosition
    // So we'll just check if we can get position
    return checkPermissions();
  }
};
