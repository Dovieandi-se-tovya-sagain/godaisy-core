// Contexts
export { AuthProvider, useAuth, useRequireAuth } from './contexts/AuthContext';
export { UnifiedLocationProvider, useUnifiedLocation } from './contexts/UnifiedLocationContext';
export { LanguageProvider, useLanguage } from './contexts/LanguageContext';
export { UserPreferencesProvider, useUserPreferences } from './contexts/UserPreferencesContext';

// Supabase clients
export { authClient } from './lib/supabase/authClient';
export { createDataClient } from './lib/supabase/dataClient';
export type { DataClientConfig } from './lib/supabase/dataClient';

// Hooks
export { useOnlineStatus } from './hooks/useOnlineStatus';
export { useTideData } from './hooks/useTideData';
export { useTranslation } from './hooks/useTranslation';
export { useUserLocation } from './hooks/useUserLocation';
export { useOfflineData } from './hooks/useOfflineData';
export { useOfflineStorageReady, useNetworkStatus, useSyncStatus, useOfflinePrediction, useCacheSize } from './hooks/useOfflineStorage';
export { useSharing } from './hooks/useSharing';
export { useInstallPrompt } from './hooks/useInstallPrompt';
export { useCapacitorInit } from './hooks/useCapacitorInit';
export { useLocationConsent } from './hooks/useLocationConsent';
export { useTideExtremes } from './hooks/useTideExtremes';
export { useLocalSignals } from './hooks/useLocalSignals';
export { useWeatherDataSource } from './hooks/useWeatherDataSource';
export { useWeatherTasks } from './hooks/useWeatherTasks';
// useRequireAuth already exported from AuthContext
// export { useUserStatus } from './hooks/useUserStatus'; // TODO: Has Findr-specific dependencies (statusMedals, badgeDefinitions)
export { useFounderStatus } from './hooks/useFounderStatus';
export { useSubscription } from './hooks/useSubscription';
// export { useNotificationPreferences } from './hooks/useNotificationPreferences'; // TODO: Has Findr-specific dependency (API types)
export { useProfileHydration } from './hooks/useProfileHydration';
export { useImageCompression } from './hooks/useImageCompression';
export { useImpressionTracking } from './hooks/useImpressionTracking';
export { useDialogHistory } from './hooks/useDialogHistory';
export { useReducedMotion } from './hooks/useReducedMotion';
export { useScrolledPast } from './hooks/useScrolledPast';
export { useLazyBackground } from './hooks/useLazyBackground';
// export { useAutoPreCache } from './hooks/useAutoPreCache'; // TODO: Has Findr-specific dependency (preCachePredictions)
export { useUIText } from './hooks/useUIText';

// Components
export { LocationPicker } from './components/LocationPicker';
export { LanguageSelector } from './components/LanguageSelector';
// Translation components
export { TranslatedFishName, TranslatedFishBio, TranslatedText } from './components/translation/TranslatedFishCard';
// Location components
export { default as CoastalLocationDialog, type BasicLocation } from './components/CoastalLocationDialog';
// TODO: Add more component exports as needed

// Utilities
export { roundNdp, round0dp, round1dp, round2dp, createCacheKey, COORDINATE_PRECISION, CACHE_DURATION_MS } from './lib/utils/coordinates';
// Weather utilities
export { getWeatherMessage } from './lib/utils/weatherMessages';
// UI utilities
export { toast, showToast } from './lib/ui/toast';
export type { ToastType, ToastOptions } from './lib/ui/toast';
// Image utilities
export { generateBlurDataURL } from './lib/image/placeholder';
export { compressForUpload } from './lib/image/compressForUpload';
// Offline cache utilities
export {
  getCachedSpeciesAdvice,
  cacheSpeciesDetails,
  cacheTacticalAdvice,
  cacheStrategicAdvice,
  isTacticalAdviceStale,
  isStrategicAdviceStale,
  getAdviceCacheAge,
  clearSpeciesAdviceCache,
  speciesAdviceCacheApi,
  type CachedSpeciesDetails,
  type CachedSpeciesAdvice,
} from './lib/offline/speciesAdviceCache';

// Multi-location utilities
export { toLegacyFormat } from './types/multiLocation';
// TODO: Add more utility exports as needed

// Types
export type * from './types';
export type { SavedLocation, LegacyUnifiedLocationRecord } from './types/multiLocation';

// Capacitor/Platform utilities
export { isNative, getPlatform } from './lib/capacitor/platform';

// Date utilities
export { getTodayIso } from './lib/date/today';

// Share utilities
export { generateShareToken, getShareUrl } from './lib/share/shareToken';
export type { FindrShareData } from './lib/share/shareToken';

// Components
export { default as SEO } from './components/SEO';
export { default as FindrFooter } from './components/footer';
export { PlanItSheet } from './components/PlanItSheet';
export type { PlannedActivity } from './components/PlanItSheet';
