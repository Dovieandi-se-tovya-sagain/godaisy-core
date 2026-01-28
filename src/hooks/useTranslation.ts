// hooks/useTranslation.ts

import { useState, useEffect } from 'react';
import { clientTranslate, clientTranslateBatch } from '../lib/translation/clientTranslate';
import { getUserLanguage, setUserLanguage } from '../lib/user/language';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * React hook for translating text with loading states.
 * Returns translated text and loading status.
 */
export function useTranslation(text: string, targetLang?: string) {
  // Use context for reactive language changes, fallback to getUserLanguage
  const { language: contextLang } = useLanguage();
  const detectedLang = targetLang || contextLang || getUserLanguage();
  const [translated, setTranslated] = useState(text);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (detectedLang === 'en' || !text?.trim()) {
      setTranslated(text);
      return;
    }

    setLoading(true);
    clientTranslate(text, detectedLang)
      .then((result) => {
        setTranslated(result);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Translation failed:', error);
        setTranslated(text); // Fall back to original text
        setLoading(false);
      });
  }, [text, detectedLang]);

  return { translated, loading };
}

/**
 * React hook for translating multiple texts at once.
 * More efficient than using useTranslation multiple times.
 */
export function useTranslationBatch(texts: string[], targetLang?: string) {
  const detectedLang = targetLang || getUserLanguage();
  const [translations, setTranslations] = useState<string[]>(texts);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (detectedLang === 'en') {
      setTranslations(texts);
      return;
    }

    setLoading(true);
    clientTranslateBatch(texts, detectedLang)
      .then((results) => {
        setTranslations(results);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Batch translation failed:', error);
        setTranslations(texts); // Fall back to original texts
        setLoading(false);
      });
  }, [texts, detectedLang]);

  return { translations, loading };
}

/**
 * React hook for current user language with setter.
 * Provides reactive language state management.
 */
export function useUserLanguage() {
  const [language, setLanguage] = useState<string>('en');

  useEffect(() => {
    setLanguage(getUserLanguage());
  }, []);

  const updateLanguage = (newLang: string) => {
    setUserLanguage(newLang);
    setLanguage(newLang);
    // Note: You might want to trigger a re-render of the entire app
    // or use a context provider for global language state
  };

  return { language, setLanguage: updateLanguage };
}