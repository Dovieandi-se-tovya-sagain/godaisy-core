// Contexts
export { AuthContext, useAuth } from './contexts/AuthContext';
export { UnifiedLocationContext, useUnifiedLocation } from './contexts/UnifiedLocationContext';
export { LanguageContext, useLanguage } from './contexts/LanguageContext';
export { UserPreferencesContext, useUserPreferences } from './contexts/UserPreferencesContext';

// Supabase clients
export { authClient } from './lib/supabase/authClient';
export { createDataClient } from './lib/supabase/dataClient';
export type { SupabaseClientConfig } from './lib/supabase/types';

// Hooks
export { useOnlineStatus } from './hooks/useOnlineStatus';
export { useTideData } from './hooks/useTideData';
export { useTranslation } from './hooks/useTranslation';
// ... export all shared hooks

// Components
export { LocationPicker } from './components/LocationPicker';
export { LanguageSelector } from './components/LanguageSelector';
export { TranslatedText } from './components/TranslatedText';
// ... export all shared components

// Utilities
export { formatCoordinates } from './lib/utils/coordinates';
export { formatDate } from './lib/utils/dates';
// ... export all utility functions

// Types
export type * from './types';