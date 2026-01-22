// hooks/useUserLocation.ts
"use client";

import { useState, useEffect } from 'react';

export interface UserLocation {
  rectangleCode: string;
  coordinates: { lat: number; lon: number };
  source: 'ip' | 'gps' | 'manual';
  timestamp: string;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load location from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('findr-user-location');
      if (stored) {
        const parsedLocation = JSON.parse(stored);
        setLocation(parsedLocation);
      }
    } catch (error) {
      console.warn('Failed to load user location:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for location changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'findr-user-location') {
        try {
          const newLocation = e.newValue ? JSON.parse(e.newValue) : null;
          setLocation(newLocation);
        } catch (error) {
          console.warn('Failed to parse updated location:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateLocation = (newLocation: UserLocation) => {
    localStorage.setItem('findr-user-location', JSON.stringify(newLocation));
    setLocation(newLocation);
  };

  const clearLocation = () => {
    localStorage.removeItem('findr-user-location');
    setLocation(null);
  };

  return {
    location,
    isLoading,
    updateLocation,
    clearLocation,
    hasLocation: !!location
  };
}