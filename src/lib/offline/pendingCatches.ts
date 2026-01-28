/**
 * Offline Catch Storage
 *
 * Stores catch entries locally when offline, then syncs to server when back online.
 * Uses Capacitor Preferences on native platforms, IndexedDB/localStorage on web.
 */

import type { CatchLogInput } from '../findr-enrichment';

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface PendingCatch {
  id: string;
  createdAt: string;
  syncStatus: SyncStatus;
  syncAttempts: number;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  catchData: Omit<CatchLogInput, 'photo'>;
  photoBase64?: string; // Store photo as base64 for offline
  photoMimeType?: string;
}

export interface PendingCatchesState {
  catches: PendingCatch[];
  lastUpdated: string;
}

const STORAGE_KEY = 'findr_pending_catches';
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB max for offline photo storage

/**
 * Generate a UUID for local catch entries
 */
function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `local_${crypto.randomUUID()}`;
  }
  // Fallback for older browsers
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert a File/Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string } | null> {
  // Check file size
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    console.warn('[pendingCatches] Photo too large for offline storage:', file.size);
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 back to Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Check if running on native platform
 */
async function isNativePlatform(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Read pending catches from storage
 */
async function readFromStorage(): Promise<PendingCatchesState> {
  const defaultState: PendingCatchesState = {
    catches: [],
    lastUpdated: new Date().toISOString(),
  };

  try {
    const isNative = await isNativePlatform();

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return defaultState;
      return JSON.parse(value) as PendingCatchesState;
    } else {
      // Web: use localStorage
      if (typeof localStorage === 'undefined') return defaultState;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState;
      return JSON.parse(raw) as PendingCatchesState;
    }
  } catch (error) {
    console.error('[pendingCatches] Failed to read from storage:', error);
    return defaultState;
  }
}

/**
 * Write pending catches to storage
 */
async function writeToStorage(state: PendingCatchesState): Promise<void> {
  try {
    const isNative = await isNativePlatform();
    const json = JSON.stringify(state);

    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: STORAGE_KEY, value: json });
    } else {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, json);
      }
    }
  } catch (error) {
    console.error('[pendingCatches] Failed to write to storage:', error);
  }
}

/**
 * Add a catch to the pending queue
 */
export async function addPendingCatch(
  catchData: CatchLogInput
): Promise<PendingCatch> {
  const state = await readFromStorage();

  // Handle photo separately
  let photoBase64: string | undefined;
  let photoMimeType: string | undefined;

  if (catchData.photo) {
    const converted = await fileToBase64(catchData.photo);
    if (converted) {
      photoBase64 = converted.base64;
      photoMimeType = converted.mimeType;
    }
  }

  // Create pending catch without the photo File object
  const { photo: _photo, ...catchDataWithoutPhoto } = catchData;

  const pendingCatch: PendingCatch = {
    id: generateLocalId(),
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    syncAttempts: 0,
    catchData: catchDataWithoutPhoto,
    photoBase64,
    photoMimeType,
  };

  state.catches.push(pendingCatch);
  state.lastUpdated = new Date().toISOString();

  await writeToStorage(state);

  console.log('[pendingCatches] Added pending catch:', pendingCatch.id);

  return pendingCatch;
}

/**
 * Get all pending catches
 */
export async function getPendingCatches(): Promise<PendingCatch[]> {
  const state = await readFromStorage();
  return state.catches;
}

/**
 * Get pending catches count
 */
export async function getPendingCatchesCount(): Promise<number> {
  const state = await readFromStorage();
  return state.catches.filter(c => c.syncStatus !== 'synced').length;
}

/**
 * Get catches ready for sync (pending or failed with < 3 attempts)
 */
export async function getCatchesReadyForSync(): Promise<PendingCatch[]> {
  const state = await readFromStorage();
  return state.catches.filter(
    c => c.syncStatus === 'pending' || (c.syncStatus === 'failed' && c.syncAttempts < 3)
  );
}

/**
 * Update a pending catch's sync status
 */
export async function updatePendingCatchStatus(
  id: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const state = await readFromStorage();
  const catch_ = state.catches.find(c => c.id === id);

  if (catch_) {
    catch_.syncStatus = status;
    catch_.lastSyncAttempt = new Date().toISOString();
    if (status === 'syncing' || status === 'failed') {
      catch_.syncAttempts++;
    }
    if (error) {
      catch_.lastSyncError = error;
    }
    state.lastUpdated = new Date().toISOString();
    await writeToStorage(state);
  }
}

/**
 * Remove a synced catch from pending storage
 */
export async function removePendingCatch(id: string): Promise<void> {
  const state = await readFromStorage();
  state.catches = state.catches.filter(c => c.id !== id);
  state.lastUpdated = new Date().toISOString();
  await writeToStorage(state);
  console.log('[pendingCatches] Removed synced catch:', id);
}

/**
 * Remove all synced catches from storage
 */
export async function clearSyncedCatches(): Promise<number> {
  const state = await readFromStorage();
  const before = state.catches.length;
  state.catches = state.catches.filter(c => c.syncStatus !== 'synced');
  state.lastUpdated = new Date().toISOString();
  await writeToStorage(state);
  const removed = before - state.catches.length;
  console.log('[pendingCatches] Cleared', removed, 'synced catches');
  return removed;
}

/**
 * Clear all pending catches (for testing/reset)
 */
export async function clearAllPendingCatches(): Promise<void> {
  await writeToStorage({
    catches: [],
    lastUpdated: new Date().toISOString(),
  });
  console.log('[pendingCatches] Cleared all pending catches');
}

/**
 * Reconstruct CatchLogInput with photo Blob for sync
 */
export function reconstructCatchInput(pendingCatch: PendingCatch): CatchLogInput {
  const input: CatchLogInput = { ...pendingCatch.catchData };

  if (pendingCatch.photoBase64 && pendingCatch.photoMimeType) {
    input.photo = base64ToBlob(pendingCatch.photoBase64, pendingCatch.photoMimeType);
  }

  return input;
}

export const pendingCatchesApi = {
  addPendingCatch,
  getPendingCatches,
  getPendingCatchesCount,
  getCatchesReadyForSync,
  updatePendingCatchStatus,
  removePendingCatch,
  clearSyncedCatches,
  clearAllPendingCatches,
  reconstructCatchInput,
  base64ToBlob,
};

export default pendingCatchesApi;
