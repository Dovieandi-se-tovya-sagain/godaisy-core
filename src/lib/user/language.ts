// lib/user/language.ts

import { supabase } from '../supabase/client';

const LOCAL_STORAGE_KEY = 'findr-language';
const LANGUAGE_UPDATE_DEBOUNCE_MS = 500;

type LanguageDescriptor = { code: string; name: string; nativeName: string };

const SUPPORTED_LANGUAGE_DESCRIPTORS: LanguageDescriptor[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
];

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_DESCRIPTORS)[number]['code'];

export const SUPPORTED_LANGUAGE_CODES: SupportedLanguageCode[] = SUPPORTED_LANGUAGE_DESCRIPTORS.map((lang) => lang.code);

const DEFAULT_LANGUAGE = 'en';

type RemoteProfile = { preferred_language?: string | null };

let pendingRemoteLanguage: string | null = null;
let remoteUpdateTimer: number | null = null;
let remoteLanguageSyncAvailable = true;
let hasLoggedMissingColumn = false;

const isBrowser = () => typeof window !== 'undefined';

type SupabaseError = { code?: string; message?: string; details?: string; hint?: string };

function isMissingPreferredLanguageColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const supabaseError = error as SupabaseError;
  const message = `${supabaseError.message ?? ''} ${supabaseError.details ?? ''}`.toLowerCase();

  if (supabaseError.code === '42703') {
    return true;
  }

  return message.includes('preferred_language') && message.includes('does not exist');
}

function disableRemoteLanguageSync(error: unknown) {
  remoteLanguageSyncAvailable = false;
  if (!hasLoggedMissingColumn) {
    hasLoggedMissingColumn = true;
    console.info('Remote language sync disabled: preferred_language column not available yet.', error);
  }
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguageCode {
  return typeof value === 'string' && SUPPORTED_LANGUAGE_CODES.includes(value);
}

function persistLocalLanguage(lang: string, broadcast = true) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, lang);
    if (broadcast) {
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
  } catch (error) {
    console.warn('Failed to persist language preference locally', error);
  }
}

async function pushLanguageToSupabase(lang: string) {
  if (!remoteLanguageSyncAvailable) {
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: lang })
      .eq('id', session.user.id);

    if (error) {
      if (isMissingPreferredLanguageColumn(error)) {
        disableRemoteLanguageSync(error);
        return;
      }
      throw error;
    }
  } catch (error) {
    console.warn('Failed to sync language preference to Supabase', error);
  }
}

function queueRemoteLanguageUpdate(lang: string) {
  if (!isBrowser()) return;

  pendingRemoteLanguage = lang;
  if (remoteUpdateTimer) {
    window.clearTimeout(remoteUpdateTimer);
  }

  remoteUpdateTimer = window.setTimeout(() => {
    const languageToSync = pendingRemoteLanguage;
    pendingRemoteLanguage = null;
    remoteUpdateTimer = null;
    if (!languageToSync) return;
    void pushLanguageToSupabase(languageToSync);
  }, LANGUAGE_UPDATE_DEBOUNCE_MS);
}

export function getUserLanguage(): string {
  if (!isBrowser()) {
    return DEFAULT_LANGUAGE;
  }

  const manualSelection = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (isSupportedLanguage(manualSelection)) {
    return manualSelection;
  }

  const browserLang = window.navigator.language.split('-')[0];
  if (isSupportedLanguage(browserLang)) {
    return browserLang;
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Save the user's language preference locally and queue a debounced Supabase update.
 */
export function setUserLanguage(lang: string, options?: { syncRemote?: boolean }) {
  const safeLang = isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  persistLocalLanguage(safeLang);

  if (options?.syncRemote === false) {
    return;
  }

  queueRemoteLanguageUpdate(safeLang);
}

export async function fetchRemoteUserLanguage(): Promise<string | null> {
  if (!isBrowser()) return null;
  if (!remoteLanguageSyncAvailable) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle<RemoteProfile>();

    if (error) {
      if (isMissingPreferredLanguageColumn(error)) {
        disableRemoteLanguageSync(error);
        return null;
      }
      throw error;
    }

    if (data && isSupportedLanguage(data.preferred_language)) {
      return data.preferred_language;
    }
  } catch (error) {
    console.warn('Failed to fetch language preference from Supabase', error);
  }

  return null;
}

/**
 * Get list of supported languages with display names.
 */
export function getSupportedLanguages(): LanguageDescriptor[] {
  return SUPPORTED_LANGUAGE_DESCRIPTORS;
}
