// Contexts
export { AuthProvider, useAuth, useRequireAuth } from './contexts/AuthContext';
export { UnifiedLocationProvider, useUnifiedLocation } from './contexts/UnifiedLocationContext';
export type { UnifiedLocationRecord } from './contexts/UnifiedLocationContext';
export { LanguageProvider, useLanguage } from './contexts/LanguageContext';
export { UserPreferencesProvider, useUserPreferences } from './contexts/UserPreferencesContext';

// Supabase clients
export { authClient } from './lib/supabase/authClient';
export { createDataClient } from './lib/supabase/dataClient';
export type { DataClientConfig } from './lib/supabase/dataClient';
export { getSupabaseServerClient } from './lib/supabase/serverClient';
export { createServerSupabaseClient } from './lib/supabase/pages-api';

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
export { roundNdp, round0dp, round1dp, round2dp, round3dp, createCacheKey, COORDINATE_PRECISION, CACHE_DURATION_MS } from './lib/utils/coordinates';
// Weather utilities
export { getWeatherMessage } from './lib/utils/weatherMessages';
// Weather services
export { fetchMetNoLocationForecast, fetchWorldTides } from './lib/services/weatherService';
export type { WorldTidesResponse } from './lib/services/weatherService';
// Weather monitoring
export { weatherMetrics } from './lib/monitoring/weatherMetrics';
// Supabase query utilities
export { queryWithTiming, timedParallelQueries } from './lib/supabase/queryWithTiming';
// Tide utilities
export { calculateTidePhase } from './lib/tides/calculateTidePhase';
export type { TideExtreme } from './lib/tides/calculateTidePhase';
// Rate limiting
export { rateLimiter, RateLimitError, addRateLimitHeaders } from './lib/utils/rate-limiter';
// CORS
export { applyCors } from './lib/utils/cors';
// Findr grid utilities
export { findNearestGridCellId } from './lib/findr/gridCellLookup';
// UI utilities
export { toast, showToast } from './lib/ui/toast';
export type { ToastType, ToastOptions } from './lib/ui/toast';
// Image utilities
export { generateBlurDataURL } from './lib/image/placeholder';
export { compressForUpload } from './lib/image/compressForUpload';

// Multi-location utilities
export { toLegacyFormat, fromLegacyFormat } from './types/multiLocation';
export { parseLocationsArray, buildLegacyHomeCoordinatesPayload } from './lib/multiLocation/apiHelpers';
export type { DatabaseRow } from './lib/multiLocation/apiHelpers';

// Types
export type * from './types';
export type { SavedLocation, LegacyUnifiedLocationRecord, LocationSlot } from './types/multiLocation';

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
