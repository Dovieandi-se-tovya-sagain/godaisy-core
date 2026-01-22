// hooks/useLocationConsent.ts
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface LocationPreferences {
  // Core preferences
  preferredRectangles: string[]; // e.g. ['31F2', '31F3']
  homeRegion: string; // e.g. 'English Channel'
  maxDistance: number; // km from home
  
  // Privacy settings
  shareGPS: boolean;
  shareCourse: boolean; // city-level
  autoDetect: boolean;
  
  // Metadata
  lastUpdated: string;
  source: 'manual' | 'gps' | 'ip' | 'postcode';
}

export interface LocationConsentState {
  hasConsent: boolean;
  preferences: LocationPreferences | null;
  showConsentModal: boolean;
  loading: boolean;
}

const DEFAULT_PREFERENCES: LocationPreferences = {
  preferredRectangles: [],
  homeRegion: '',
  maxDistance: 50,
  shareGPS: false,
  shareCourse: true,
  autoDetect: false,
  lastUpdated: new Date().toISOString(),
  source: 'manual'
};

export function useLocationConsent(): LocationConsentState & {
  requestConsent: () => void;
  updatePreferences: (prefs: Partial<LocationPreferences>) => Promise<void>;
  dismissModal: () => void;
} {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<LocationConsentState>({
    hasConsent: false,
    preferences: null,
    showConsentModal: false,
    loading: true
  });

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setState(prev => ({ ...prev, loading: true }));
        
        // Try to load from database first
        if (user) {
          const response = await fetch('/api/user/location-preferences');
          if (response.ok) {
            const preferences = await response.json();
            setState(prev => ({
              ...prev,
              hasConsent: true,
              preferences,
              loading: false
            }));
            return;
          }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('findr-location-preferences');
        if (stored) {
          const preferences = JSON.parse(stored);
          setState(prev => ({
            ...prev,
            hasConsent: true,
            preferences,
            loading: false
          }));
        } else {
          setState(prev => ({
            ...prev,
            hasConsent: false,
            preferences: null,
            loading: false
          }));
        }
      } catch (error) {
        console.error('Failed to load location preferences:', error);
        setState(prev => ({
          ...prev,
          hasConsent: false,
          preferences: null,
          loading: false
        }));
      }
    };
    
    loadPreferences();
  }, [user]);

  const requestConsent = () => {
    setState(prev => ({ ...prev, showConsentModal: true }));
  };

  const dismissModal = () => {
    setState(prev => ({ ...prev, showConsentModal: false }));
  };

  const updatePreferences = async (updates: Partial<LocationPreferences>) => {
    const newPreferences = {
      ...DEFAULT_PREFERENCES,
      ...state.preferences,
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    try {
      // Save to database if authenticated
      if (user) {
        await fetch('/api/user/location-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPreferences)
        });
      }
      
      // Always save to localStorage as backup
      localStorage.setItem('findr-location-preferences', JSON.stringify(newPreferences));
      
      setState(prev => ({
        ...prev,
        hasConsent: true,
        preferences: newPreferences,
        showConsentModal: false
      }));
      
    } catch (error) {
      console.error('Failed to save location preferences:', error);
      throw error;
    }
  };

  return {
    ...state,
    requestConsent,
    updatePreferences,
    dismissModal
  };
}