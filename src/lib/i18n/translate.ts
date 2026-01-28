import { autoTranslate, autoTranslateBatch } from '../translation/autoTranslate';

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  de: 'German',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  tr: 'Turkish',
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;
export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en';

export function normalizeLanguageCode(code?: string): SupportedLanguageCode {
  const normalized = (code || DEFAULT_LANGUAGE)
    .toLowerCase()
    .split('-')[0] as SupportedLanguageCode;
  return normalized in SUPPORTED_LANGUAGES ? normalized : DEFAULT_LANGUAGE;
}

export function isSupportedLanguage(code: string): code is SupportedLanguageCode {
  return normalizeLanguageCode(code) === code.toLowerCase().split('-')[0];
}

interface TranslateOptions {
  targetLang: string;
}

export async function translateText(text: string, options: TranslateOptions): Promise<string> {
  const targetLang = normalizeLanguageCode(options.targetLang);
  if (targetLang === DEFAULT_LANGUAGE) {
    return text;
  }
  return autoTranslate(text, targetLang);
}

export async function translateTextBatch(
  texts: string[],
  options: TranslateOptions
): Promise<string[]> {
  const targetLang = normalizeLanguageCode(options.targetLang);
  if (targetLang === DEFAULT_LANGUAGE) {
    return texts;
  }
  return autoTranslateBatch(texts, targetLang);
}
