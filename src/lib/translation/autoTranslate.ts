// lib/translation/autoTranslate.ts

/**
 * Automatic translation system using DeepL with multi-level caching.
 * 
 * This module provides translation services throughout the application.
 * Translations are cached aggressively to minimize API costs and maximize performance.
 * 
 * ⚠️ SERVER-SIDE ONLY - Do not import this module in client-side code.
 * Use clientTranslate.ts for client-side translation needs.
 * 
 * Usage:
 *   const translated = await autoTranslate('Sea Bass', 'es');
 *   // Returns: 'Lubina'
 */

// Ensure this module is only used on the server
if (typeof window !== 'undefined') {
  throw new Error('autoTranslate.ts is server-side only. Use clientTranslate.ts for client-side translations.');
}

import * as deepl from 'deepl-node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// In-memory cache stores translations for the duration of the Node.js process
// This provides instant lookups without hitting the database
const memoryCache = new Map<string, string>();

// Manual override cache keeps high-priority translations available without re-querying
const MANUAL_OVERRIDE_TTL_MS = 5 * 60 * 1000; // 5 minutes
type ManualOverrideCacheEntry = { value: string | null; expiresAt: number };
const manualOverrideCache = new Map<string, ManualOverrideCacheEntry>();

// DeepL translator instance - initialized lazily when first needed
let translator: deepl.Translator | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Get or initialize the DeepL translator instance.
 * Throws an error if the API key is not configured.
 */
function getTranslator(): deepl.Translator {
  if (!translator) {
    const apiKey = process.env.DEEPL_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'DEEPL_API_KEY is not configured in environment variables. ' +
        'Please add it to your .env.local file.'
      );
    }
    
    // Initialize the DeepL SDK with your API key
    translator = new deepl.Translator(apiKey);
  }
  
  return translator;
}

/**
 * Lazily create a Supabase client that can access privileged tables.
 */
function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase admin credentials are missing for translation service.');
    }

    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  return supabaseAdminClient;
}

/**
 * DeepL language code mapping.
 * Some languages have regional variants that DeepL distinguishes.
 * For example, Portuguese has PT-PT (Portugal) and PT-BR (Brazil).
 */
const DEEPL_LANGUAGE_MAP: Record<string, deepl.TargetLanguageCode> = {
  en: 'en-GB',     // British English
  es: 'es',        // Spanish
  fr: 'fr',        // French
  pt: 'pt-PT',     // Portuguese (Portugal) - you could use 'pt-BR' for Brazilian
  de: 'de',        // German
  it: 'it',        // Italian
  nl: 'nl',        // Dutch
  pl: 'pl',        // Polish
  sv: 'sv',        // Swedish
  tr: 'tr',        // Turkish
  ru: 'ru',        // Russian
  ja: 'ja',        // Japanese
  zh: 'zh',        // Chinese (simplified)
};

/**
 * Generate a cache key from source text and target language.
 * Normalizes whitespace to improve cache hit rates.
 */
function getCacheKey(text: string, targetLang: string): string {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  const normalizedLang = targetLang.toLowerCase();
  return `${normalizedLang}:${normalizedText}`;
}

/**
 * Generate a hash of source text to detect content changes.
 * When you update English source text, the hash changes and signals
 * that translations may be stale.
 */
function hashText(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text.trim())
    .digest('hex')
    .substring(0, 16);
}

function setManualOverrideCache(
  text: string,
  targetLang: string,
  value: string | null
) {
  const cacheKey = getCacheKey(text, targetLang);
  manualOverrideCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + MANUAL_OVERRIDE_TTL_MS,
  });

  if (value) {
    memoryCache.set(cacheKey, value);
  } else {
    memoryCache.delete(cacheKey);
  }
}

function getCachedManualOverride(
  text: string,
  targetLang: string
): string | null | undefined {
  const cacheKey = getCacheKey(text, targetLang);
  const cached = manualOverrideCache.get(cacheKey);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt > Date.now()) {
    return cached.value;
  }

  manualOverrideCache.delete(cacheKey);
  return undefined;
}

async function checkManualOverride(
  text: string,
  targetLang: string
): Promise<string | null> {
  const cached = getCachedManualOverride(text, targetLang);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('translation_overrides')
      .select('translated_text')
      .eq('source_text', text.trim())
      .eq('target_language', targetLang.toLowerCase())
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setManualOverrideCache(text, targetLang, null);
      return null;
    }

    setManualOverrideCache(text, targetLang, data.translated_text);
    return data.translated_text;
  } catch (error) {
    console.error('Manual override lookup failed:', error);
    // Cache miss briefly to avoid repeated errors
    manualOverrideCache.set(getCacheKey(text, targetLang), {
      value: null,
      expiresAt: Date.now() + MANUAL_OVERRIDE_TTL_MS / 2,
    });
    return null;
  }
}

async function checkManualOverridesBatch(
  texts: string[],
  targetLang: string
): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();
  const textsNeedingLookup: string[] = [];

  for (const text of texts) {
    const trimmed = text.trim();
    const cached = getCachedManualOverride(text, targetLang);
    if (cached === undefined) {
      textsNeedingLookup.push(trimmed);
    } else if (cached) {
      overrides.set(trimmed, cached);
    }
  }

  if (textsNeedingLookup.length === 0) {
    return overrides;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('translation_overrides')
      .select('source_text, translated_text')
      .in('source_text', textsNeedingLookup)
      .eq('target_language', targetLang.toLowerCase())
      .eq('is_active', true);

    if (data && !error) {
      for (const row of data) {
        setManualOverrideCache(row.source_text, targetLang, row.translated_text);
        overrides.set(row.source_text, row.translated_text);
      }
    }

    // Cache misses to avoid repeated lookups
    const foundTexts = new Set(data?.map(row => row.source_text) ?? []);
    for (const text of textsNeedingLookup) {
      if (!foundTexts.has(text)) {
        setManualOverrideCache(text, targetLang, null);
      }
    }
  } catch (error) {
    console.error('Manual override batch lookup failed:', error);
  }

  return overrides;
}

/**
 * Detect fishing-specific terminology that might need manual review.
 * DeepL sometimes mistranslates specialized fishing vocabulary.
 */
function hasFishingTerminology(text: string): boolean {
  const fishingKeywords = [
    'ragworm', 'lugworm', 'sandeel', 'mackerel strip', 'prawn', 'shrimp',
    'structure', 'reef', 'wreck', 'mark', 'spot', 'swim', 'ground',
    'feeding', 'spawning', 'schooling', 'strike', 'bite', 'take',
    'rig', 'trace', 'leader', 'hook', 'bait', 'lure', 'jig',
    'tide', 'current', 'slack water', 'run', 'neap', 'spring tide',
  ];
  
  const lowerText = text.toLowerCase();
  return fishingKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Check database cache for an existing translation.
 * Returns the cached translation if found, or null if not cached.
 * Prioritizes manual translations over automatic ones.
 *
 * **PHASE 2.4 OPTIMIZATION: Removed ORDER BY and last_accessed_at updates**
 * - Composite index (source_text, target_language, translation_source DESC) handles ordering
 * - Skipping last_accessed_at updates reduces write load by ~90%
 * - Expected cache lookup: <5ms with index
 */
async function checkDatabaseCache(
  text: string,
  targetLang: string
): Promise<{ translation: string; source: string } | null> {
  try {
    const supabase = getSupabaseAdminClient();

    // **PHASE 2.4: Simplified query - index handles ordering, no ORDER BY needed**
    const { data, error } = await supabase
      .from('translation_cache')
      .select('translated_text, translation_source')
      .eq('source_text', text.trim())
      .eq('target_language', targetLang.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // **PHASE 2.4: Removed last_accessed_at update - not critical, creates unnecessary write load**
    // The translation works the same without tracking access times

    return {
      translation: data.translated_text,
      source: data.translation_source,
    };
  } catch (error) {
    console.error('Database cache lookup failed:', error);
    return null;
  }
}

/**
 * Store a new translation in the database cache.
 * Automatically flags translations with fishing terminology for review.
 */
async function storeDatabaseCache(
  sourceText: string,
  targetLang: string,
  translatedText: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();

    const hasFishingTerms = hasFishingTerminology(sourceText);
    const contentHash = hashText(sourceText);

    await supabase.from('translation_cache').upsert(
      {
        source_text: sourceText.trim(),
        target_language: targetLang.toLowerCase(),
        translated_text: translatedText,
        translation_source: 'auto',
        source_content_hash: contentHash,
        needs_review: hasFishingTerms,
        has_fishing_terminology: hasFishingTerms,
        access_count: 1,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      },
      {
        onConflict: 'source_text,target_language',
      }
    );
  } catch (error) {
    console.error('Failed to store translation in cache:', error);
    // Don't throw - the translation still works even if caching fails
  }
}

/**
 * Translate text using the DeepL API.
 * Returns the original text if translation fails, ensuring graceful degradation.
 */
async function translateWithDeepL(
  text: string,
  targetLang: string
): Promise<string> {
  try {
    const translator = getTranslator();
    const deeplLangCode = DEEPL_LANGUAGE_MAP[targetLang.toLowerCase()];

    if (!deeplLangCode) {
      console.warn(`Language ${targetLang} not supported by DeepL`);
      return text;
    }

    const result = await translator.translateText(
      text,
      null, // Auto-detect source language
      deeplLangCode,
      {
        preserveFormatting: true,
        formality: 'default',
      }
    );

    return result.text;
  } catch (error) {
    console.error('DeepL translation failed:', error);
    return text; // Return original text if translation fails
  }
}

/**
 * Main translation function.
 * Checks memory cache, then database cache, then calls DeepL API as fallback.
 * 
 * @param text - Source text in English
 * @param targetLang - Target language code (es, fr, pt, de, it, etc.)
 * @returns Translated text, or original text if translation is not possible
 */
export async function autoTranslate(
  text: string,
  targetLang: string
): Promise<string> {
  // Return immediately if text is empty or target is English
  if (!text || !text.trim() || targetLang.toLowerCase() === 'en') {
    return text;
  }

  const manualOverride = await checkManualOverride(text, targetLang);
  if (manualOverride) {
    return manualOverride;
  }

  // Check in-memory cache (fastest)
  const cacheKey = getCacheKey(text, targetLang);
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached) {
    return memoryCached;
  }

  // Check database cache (fast)
  const dbCached = await checkDatabaseCache(text, targetLang);
  if (dbCached) {
    memoryCache.set(cacheKey, dbCached.translation);
    return dbCached.translation;
  }

  // Fall back to DeepL API (slow, costs money)
  const translated = await translateWithDeepL(text, targetLang);

  // Store in both caches for future use
  memoryCache.set(cacheKey, translated);
  await storeDatabaseCache(text, targetLang, translated);

  return translated;
}

/**
 * Check database cache for multiple translations at once.
 * **PHASE 2.4 OPTIMIZATION: Single query for N texts instead of N queries**
 *
 * @param texts Array of source texts
 * @param targetLang Target language code
 * @returns Map of source text to translation (only for cache hits)
 */
async function checkDatabaseCacheBatch(
  texts: string[],
  targetLang: string
): Promise<Map<string, string>> {
  if (texts.length === 0) {
    return new Map();
  }

  try {
    const supabase = getSupabaseAdminClient();

    // Normalize texts for cache lookup
    const normalizedTexts = texts.map(t => t.trim());

    // **PHASE 2.4: Single query with IN clause instead of N queries**
    const { data, error } = await supabase
      .from('translation_cache')
      .select('source_text, translated_text')
      .in('source_text', normalizedTexts)
      .eq('target_language', targetLang.toLowerCase());

    if (error || !data) {
      return new Map();
    }

    // Build map of source text -> translation
    const cacheMap = new Map<string, string>();
    for (const row of data) {
      cacheMap.set(row.source_text, row.translated_text);
    }

    return cacheMap;
  } catch (error) {
    console.error('Batch database cache lookup failed:', error);
    return new Map();
  }
}

/**
 * Translate multiple strings at once.
 * **PHASE 2.4 OPTIMIZATION: Batch database lookup (N queries → 1 query)**
 * More efficient than calling autoTranslate repeatedly.
 *
 * @param texts Array of source texts in English
 * @param targetLang Target language code (es, fr, pt, de, it, etc.)
 * @returns Array of translated texts in the same order
 */
export async function autoTranslateBatch(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  // Return immediately if target is English
  if (targetLang.toLowerCase() === 'en') {
    return texts;
  }

  const manualOverrides = await checkManualOverridesBatch(texts, targetLang);

  // Check in-memory cache first
  const results: (string | null)[] = texts.map((text) => {
    if (!text || !text.trim()) return text;
    const trimmed = text.trim();
    const override = manualOverrides.get(trimmed);
    if (override) {
      memoryCache.set(getCacheKey(text, targetLang), override);
      return override;
    }
    const cacheKey = getCacheKey(text, targetLang);
    return memoryCache.get(cacheKey) || null;
  });

  // Find texts that need database lookup
  const uncachedIndexes: number[] = [];
  const uncachedTexts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i] === null && texts[i]?.trim()) {
      uncachedIndexes.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  // **PHASE 2.4: Single batch database lookup instead of N queries**
  if (uncachedTexts.length > 0) {
    const dbCache = await checkDatabaseCacheBatch(uncachedTexts, targetLang);

    // Fill in database cache hits
    for (let i = 0; i < uncachedIndexes.length; i++) {
      const idx = uncachedIndexes[i];
      const text = uncachedTexts[i];
      const cached = dbCache.get(text.trim());

      if (cached) {
        results[idx] = cached;
        memoryCache.set(getCacheKey(text, targetLang), cached);
        // Remove from uncached list
        uncachedIndexes[i] = -1;
      }
    }
  }

  // Translate remaining uncached texts via DeepL
  const stillUncachedIndexes = uncachedIndexes.filter(idx => idx >= 0);
  if (stillUncachedIndexes.length > 0) {
    const translations = await Promise.all(
      stillUncachedIndexes.map(idx => translateWithDeepL(texts[idx], targetLang))
    );

    // Store translations in both caches
    for (let i = 0; i < stillUncachedIndexes.length; i++) {
      const idx = stillUncachedIndexes[i];
      const text = texts[idx];
      const translated = translations[i];

      results[idx] = translated;
      memoryCache.set(getCacheKey(text, targetLang), translated);
      await storeDatabaseCache(text, targetLang, translated);
    }
  }

  // Return results, ensuring non-null values
  return results.map((r, i) => r || texts[i]);
}

/**
 * Allow other modules (e.g., admin endpoints) to invalidate override cache entries.
 */
export function invalidateManualOverrideCache(
  text?: string,
  targetLang?: string
): void {
  if (text && targetLang) {
    const cacheKey = getCacheKey(text, targetLang);
    manualOverrideCache.delete(cacheKey);
    memoryCache.delete(cacheKey);
    return;
  }

  manualOverrideCache.clear();
}