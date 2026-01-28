// hooks/useUIText.ts

import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { createClient } from '@supabase/supabase-js';

// In-memory cache to avoid repeated DB queries
const translationCache = new Map<string, Record<string, string>>();
let isCacheFilled = false;
let cachePromise: Promise<void> | null = null;

// DeepL translation cache (for strings not in database)
const deeplCache = new Map<string, string>(); // key: "text:lang", value: translation

// Supabase client (browser-safe - uses public anon key)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[useUIText] Missing Supabase credentials');
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Fetch translation from DeepL API with caching
 */
async function fetchDeepLTranslation(text: string, targetLang: string): Promise<string | null> {
  const cacheKey = `${text}:${targetLang}`;

  // Check in-memory cache first
  if (deeplCache.has(cacheKey)) {
    return deeplCache.get(cacheKey)!;
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });

    if (!response.ok) {
      console.warn(`[useUIText] DeepL translation failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.success && data.translation) {
      // Cache the translation
      deeplCache.set(cacheKey, data.translation);
      return data.translation;
    }

    return null;
  } catch (err) {
    console.warn('[useUIText] DeepL translation error:', err);
    return null;
  }
}

/**
 * Fetch all translations from Supabase and populate cache
 */
async function fillCache(): Promise<void> {
  if (isCacheFilled) {
    return;
  }

  // Prevent concurrent cache fills
  if (cachePromise) {
    return cachePromise;
  }

  cachePromise = (async () => {
    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        console.warn('[useUIText] Cannot fetch translations - Supabase client unavailable');
        return;
      }

      const { data, error } = await supabase
        .from('ui_text_strings')
        .select('*');

      if (error) {
        console.error('[useUIText] Error fetching translations:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[useUIText] No translations found in database');
        return;
      }

      // Populate cache
      data.forEach((row: Record<string, string>) => {
        translationCache.set(row.text_key, row);
      });

      isCacheFilled = true;
      console.log(`[useUIText] Cache filled with ${data.length} translations`);
    } catch (err) {
      console.error('[useUIText] Exception filling cache:', err);
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
}

/**
 * Hook to get translated text from database
 *
 * @param key - Translation key (e.g., "homepage.hero.title")
 * @param fallbackText - Optional fallback text if key not found (defaults to key)
 * @returns Translated text in current language
 *
 * @example
 * ```tsx
 * function Component() {
 *   const title = useUIText('support.hero.title', 'Keep Go Daisy Blooming');
 *   return <h1>{title}</h1>;
 * }
 * ```
 */
export function useUIText(key: string, fallbackText?: string): string {
  const { language } = useLanguage();
  const [text, setText] = useState<string>(fallbackText || key);

  useEffect(() => {
    async function fetchTranslation() {
      // Fill cache if not already filled
      await fillCache();

      // Check cache for translation
      if (translationCache.has(key)) {
        const translations = translationCache.get(key)!;
        const langColumn = `text_${language}`;

        // Try current language
        if (translations[langColumn] && translations[langColumn] !== '—') {
          setText(translations[langColumn]);
          return;
        }

        // Fallback to English
        if (translations.text_en && translations.text_en !== '—') {
          setText(translations.text_en);
          return;
        }
      }

      // If not in database and not English, try DeepL translation
      const textToTranslate = fallbackText || key;

      if (language !== 'en' && textToTranslate && textToTranslate.length < 500) {
        const deeplTranslation = await fetchDeepLTranslation(textToTranslate, language);

        if (deeplTranslation) {
          setText(deeplTranslation);
          return;
        }
      }

      // Final fallback to provided fallback text or key
      setText(fallbackText || key);
    }

    fetchTranslation();
  }, [key, language, fallbackText]);

  return text;
}

/**
 * Preload all translations into cache
 * Call this early in app lifecycle to avoid loading delays
 *
 * @example
 * ```tsx
 * function _app({ Component, pageProps }: AppProps) {
 *   useEffect(() => {
 *     preloadTranslations();
 *   }, []);
 *
 *   return <Component {...pageProps} />;
 * }
 * ```
 */
export function preloadTranslations(): void {
  fillCache();
}

/**
 * Clear translation cache (useful for testing or manual refreshes)
 */
export function clearTranslationCache(): void {
  translationCache.clear();
  isCacheFilled = false;
  cachePromise = null;
  console.log('[useUIText] Cache cleared');
}
