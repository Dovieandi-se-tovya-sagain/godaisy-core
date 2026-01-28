import { useCallback } from 'react';
import { supabase } from '../lib/supabase/client';

export interface RankedSpecies {
  species_id: string;
  species_name: string;
  rank: number;
  confidence: number;
  urgency: 'high' | 'medium' | 'low';
  bait_suggestions?: string[];
  habitat?: string;
}

export interface EnvironmentalSnapshot {
  sea_temp?: number;
  tide_phase?: string;
  wind_speed?: number;
  wave_height?: number;
  salinity?: number;
  chlorophyll?: number;
  dissolved_oxygen?: number;
  [key: string]: string | number | undefined;
}

export interface RecordImpressionData {
  rectangle_code: string;
  prediction_date: string;
  ranked_species: RankedSpecies[];
  environmental_snapshot?: EnvironmentalSnapshot;
  urgency_level: 'high' | 'medium' | 'low';
  source?: string;
}

interface UseImpressionTrackingResult {
  recordImpression: (data: RecordImpressionData) => Promise<boolean>;
  recordPredictionView: (
    rectangleCode: string,
    fishMatches: Array<{
      id: string;
      name: string;
      commonName: string;
      confidence: number;
      baitSuggestions?: string[];
      habitat?: string;
    }>,
    environmentalData?: EnvironmentalSnapshot,
    urgencyLevel?: 'high' | 'medium' | 'low'
  ) => Promise<boolean>;
}

/**
 * React Hook: useImpressionTracking
 * 
 * Handles automatic recording of prediction impressions when users view
 * fishing predictions. This creates the historical context that catches
 * can later link back to for validation analysis.
 * 
 * Features:
 * - Automatic rate limiting to prevent duplicate impressions
 * - Graceful failure - doesn't block UI if tracking fails
 * - Convenient wrapper for common prediction view scenarios
 * - Detailed logging for debugging validation flows
 */
export function useImpressionTracking(): UseImpressionTrackingResult {
  // Get authentication token from Supabase session
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[useImpressionTracking] Failed to get session:', error.message);
        return null;
      }
      if (!session) {
        console.info('[useImpressionTracking] No active session, skipping impression tracking');
        return null;
      }
      return session.access_token || null;
    } catch (error) {
      console.warn('[useImpressionTracking] Error getting auth token:', error);
      return null;
    }
  }, []);

  const recordImpression = useCallback(async (data: RecordImpressionData): Promise<boolean> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('[useImpressionTracking] No auth token, skipping impression recording');
        return false;
      }

      const response = await fetch('/api/findr/record-impression', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[useImpressionTracking] Recording failed:', response.status, errorData);
        return false;
      }

      const result = await response.json();
      
      if (result.success) {
        if (result.skipped) {
          console.info('[useImpressionTracking] Impression skipped (rate limited)');
        } else {
          console.info('[useImpressionTracking] Impression recorded successfully', {
            impression_id: result.impression_id,
            rectangle: data.rectangle_code,
            species_count: data.ranked_species.length
          });
        }
        return true;
      } else {
        console.warn('[useImpressionTracking] Server returned error:', result.error);
        return false;
      }

    } catch (error) {
      console.warn('[useImpressionTracking] Network error, continuing silently:', error);
      // Don't throw - impression tracking should never block the UI
      return false;
    }
  }, [getAuthToken]);

  const recordPredictionView = useCallback(async (
    rectangleCode: string,
    fishMatches: Array<{
      id: string;
      name: string;
      commonName: string;
      confidence: number;
      baitSuggestions?: string[];
      habitat?: string;
    }>,
    environmentalData?: EnvironmentalSnapshot,
    urgencyLevel: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<boolean> => {
    // Transform fish matches into ranked species format
    const rankedSpecies: RankedSpecies[] = fishMatches.map((fish, index) => ({
      species_id: fish.id,
      species_name: fish.commonName,
      rank: index + 1,
      confidence: fish.confidence,
      urgency: index === 0 ? 'high' : index === 1 ? 'medium' : 'low', // Top species get higher urgency
      bait_suggestions: fish.baitSuggestions,
      habitat: fish.habitat
    }));

    const impressionData: RecordImpressionData = {
      rectangle_code: rectangleCode,
      prediction_date: new Date().toISOString().split('T')[0], // Today's date
      ranked_species: rankedSpecies,
      environmental_snapshot: environmentalData,
      urgency_level: urgencyLevel,
      source: 'findr-catch-log-v1'
    };

    return recordImpression(impressionData);
  }, [recordImpression]);

  return {
    recordImpression,
    recordPredictionView,
  };
}