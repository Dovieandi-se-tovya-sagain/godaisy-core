import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface TranslationMapResult {
  t: (text: string) => string;
  loading: boolean;
}

/**
 * Lightweight helper that returns a memoised translator function for the supplied strings.
 * Strings are translated via the existing DeepL-backed client translator and cached automatically.
 */
export function useTranslationMap(texts: readonly string[]): TranslationMapResult {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const uniqueTexts = useMemo(() => {
    const unique = new Set<string>();
    texts.forEach(text => {
      if (typeof text === 'string' && text.trim()) {
        unique.add(text);
      }
    });
    return Array.from(unique);
  }, [texts]);

  useEffect(() => {
    if (uniqueTexts.length === 0) {
      setTranslations({});
      setLoading(false);
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      const identity = uniqueTexts.reduce<Record<string, string>>((acc, text) => {
        acc[text] = text;
        return acc;
      }, {});
      setTranslations(identity);
      setLoading(false);
      return;
    }

    if (language === 'en') {
      const identity = uniqueTexts.reduce<Record<string, string>>((acc, text) => {
        acc[text] = text;
        return acc;
      }, {});
      setTranslations(identity);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    import('./clientTranslate')
      .then(({ clientTranslateBatch }) => clientTranslateBatch(uniqueTexts, language))
      .then(results => {
        if (cancelled) return;
        const map = uniqueTexts.reduce<Record<string, string>>((acc, text, index) => {
          acc[text] = results?.[index] ?? text;
          return acc;
        }, {});
        setTranslations(map);
        setLoading(false);
      })
      .catch(error => {
        console.error('Translation map failed:', error);
        if (!cancelled) {
          const fallback = uniqueTexts.reduce<Record<string, string>>((acc, text) => {
            acc[text] = text;
            return acc;
          }, {});
          setTranslations(fallback);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language, uniqueTexts]);

  const translate = useCallback(
    (text: string) => {
      if (!text || !text.trim()) return text;
      return translations[text] ?? text;
    },
    [translations],
  );

  return { t: translate, loading };
}
