/**
 * Catch Sync Service
 *
 * Synchronizes pending offline catches to the server when back online.
 * Handles retries, error tracking, and progress reporting.
 */

import {
  getPendingCatches,
  getCatchesReadyForSync,
  updatePendingCatchStatus,
  removePendingCatch,
  reconstructCatchInput,
  type PendingCatch,
} from './pendingCatches';
import type { CatchLogInput, CatchLogResponse } from '../findr-enrichment';

export interface SyncProgress {
  total: number;
  synced: number;
  failed: number;
  inProgress: boolean;
  currentCatch: PendingCatch | null;
}

export interface SyncResult {
  success: number;
  failed: number;
  errors: Array<{ catchId: string; error: string }>;
}

type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * Build FormData from CatchLogInput (extracted from useCatchLogger)
 */
function buildFormData(input: CatchLogInput): FormData {
  const formData = new FormData();

  // Core fields
  formData.append('species_name', input.speciesCommonName);
  formData.append('quantity', String(input.quantity));
  formData.append('catch_date', input.catchDate);

  // Optional fields
  if (input.catchTime) formData.append('catch_time', input.catchTime);
  if (input.speciesId) formData.append('species_id', input.speciesId);
  if (input.scientificName) formData.append('scientific_name', input.scientificName);
  if (input.rectangleCode) formData.append('rectangle_code', input.rectangleCode);
  if (input.sizeCategory) formData.append('size_category', input.sizeCategory);
  if (input.weightKg !== undefined && input.weightKg !== null) {
    formData.append('weight_kg', String(input.weightKg));
  }
  if (input.lengthCm !== undefined && input.lengthCm !== null) {
    formData.append('length_cm', String(input.lengthCm));
  }
  if (input.baitUsed) formData.append('bait_used', input.baitUsed);
  if (input.tackleUsed) formData.append('tackle_used', input.tackleUsed);
  if (input.method) formData.append('method', input.method);
  if (input.habitatType) formData.append('habitat_type', input.habitatType);
  if (input.depthRange) formData.append('depth_range', input.depthRange);
  if (input.notes) formData.append('notes', input.notes);
  if (input.entryType) formData.append('entry_type', input.entryType);
  if (input.isBlankTrip !== undefined) {
    formData.append('is_blank_trip', String(input.isBlankTrip));
  }

  // Location
  if (input.userLocation) {
    formData.append('user_lat', String(input.userLocation.lat));
    formData.append('user_lon', String(input.userLocation.lon));
  }

  // AI identification fields
  if (input.aiSuggestedSpeciesId) {
    formData.append('ai_suggested_species_id', input.aiSuggestedSpeciesId);
  }
  if (input.aiSuggestedSpeciesName) {
    formData.append('ai_suggested_species_name', input.aiSuggestedSpeciesName);
  }
  if (input.aiConfidence !== undefined && input.aiConfidence !== null) {
    formData.append('ai_confidence', String(input.aiConfidence));
  }
  if (input.aiMethod) formData.append('ai_method', input.aiMethod);
  if (input.aiReasoning) formData.append('ai_reasoning', input.aiReasoning);
  if (input.aiWasCorrected !== undefined) {
    formData.append('ai_was_corrected', String(input.aiWasCorrected));
  }
  if (input.aiGaveUp !== undefined) {
    formData.append('ai_gave_up', String(input.aiGaveUp));
  }
  if (input.identificationSource) {
    formData.append('identification_source', input.identificationSource);
  }

  // Photo
  if (input.photo) {
    formData.append('photo', input.photo, 'catch-photo.jpg');
  }

  return formData;
}

/**
 * Sync a single catch to the server
 */
async function syncSingleCatch(
  pendingCatch: PendingCatch,
  accessToken: string
): Promise<{ success: boolean; error?: string; response?: CatchLogResponse }> {
  try {
    // Mark as syncing
    await updatePendingCatchStatus(pendingCatch.id, 'syncing');

    // Reconstruct the catch input with photo blob
    const catchInput = reconstructCatchInput(pendingCatch);

    // Build form data
    const formData = buildFormData(catchInput);

    // Submit to API
    const response = await fetch('/api/findr/log-catch-enriched', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || `HTTP ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      await updatePendingCatchStatus(pendingCatch.id, 'failed', errorMessage);
      return { success: false, error: errorMessage };
    }

    const data = (await response.json()) as CatchLogResponse;

    // Mark as synced and remove from pending
    await updatePendingCatchStatus(pendingCatch.id, 'synced');
    await removePendingCatch(pendingCatch.id);

    return { success: true, response: data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updatePendingCatchStatus(pendingCatch.id, 'failed', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get Supabase access token
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import('../../lib/supabase/client');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Sync all pending catches
 */
export async function syncPendingCatches(
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const result: SyncResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Get catches ready for sync
  const pendingCatches = await getCatchesReadyForSync();

  if (pendingCatches.length === 0) {
    console.log('[catchSync] No pending catches to sync');
    return result;
  }

  console.log('[catchSync] Starting sync of', pendingCatches.length, 'catches');

  // Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[catchSync] No access token available, skipping sync');
    return result;
  }

  // Report initial progress
  onProgress?.({
    total: pendingCatches.length,
    synced: 0,
    failed: 0,
    inProgress: true,
    currentCatch: null,
  });

  // Sync each catch
  for (const pendingCatch of pendingCatches) {
    onProgress?.({
      total: pendingCatches.length,
      synced: result.success,
      failed: result.failed,
      inProgress: true,
      currentCatch: pendingCatch,
    });

    const syncResult = await syncSingleCatch(pendingCatch, accessToken);

    if (syncResult.success) {
      result.success++;
      console.log('[catchSync] Synced catch:', pendingCatch.id);
    } else {
      result.failed++;
      result.errors.push({
        catchId: pendingCatch.id,
        error: syncResult.error || 'Unknown error',
      });
      console.warn('[catchSync] Failed to sync catch:', pendingCatch.id, syncResult.error);
    }

    // Small delay between syncs to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Report final progress
  onProgress?.({
    total: pendingCatches.length,
    synced: result.success,
    failed: result.failed,
    inProgress: false,
    currentCatch: null,
  });

  console.log('[catchSync] Sync complete:', result);

  return result;
}

/**
 * Check if there are catches pending sync
 */
export async function hasPendingCatches(): Promise<boolean> {
  const catches = await getPendingCatches();
  return catches.some(c => c.syncStatus !== 'synced');
}

/**
 * Get summary of pending catches
 */
export async function getPendingSummary(): Promise<{
  total: number;
  pending: number;
  failed: number;
}> {
  const catches = await getPendingCatches();
  return {
    total: catches.length,
    pending: catches.filter(c => c.syncStatus === 'pending').length,
    failed: catches.filter(c => c.syncStatus === 'failed').length,
  };
}

export const catchSyncApi = {
  syncPendingCatches,
  hasPendingCatches,
  getPendingSummary,
};

export default catchSyncApi;
