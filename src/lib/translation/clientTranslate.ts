// lib/translation/clientTranslate.ts

/**
 * Client-side translation utility that calls the server API.
 * This avoids importing Node.js modules in the browser.
 * 
 * Features:
 * - Request throttling to prevent rate limit errors
 * - Queue system for managing concurrent requests
 * - Exponential backoff for retry logic
 * - localStorage caching with 1-week TTL for instant load
 */

// In-memory cache for client-side performance
const clientCache = new Map<string, string>();

// localStorage cache configuration
const LOCALSTORAGE_KEY_PREFIX = 'tr_';
const LOCALSTORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

interface LocalStorageCacheEntry {
  v: string;  // translated value
  t: number;  // timestamp
}

/**
 * Get cached translation from localStorage (persistent across page loads)
 */
function getLocalStorageCache(cacheKey: string): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + cacheKey);
    if (!stored) return null;
    
    const entry: LocalStorageCacheEntry = JSON.parse(stored);
    const now = Date.now();
    
    // Check if expired (older than 1 week)
    if (now - entry.t > LOCALSTORAGE_TTL_MS) {
      localStorage.removeItem(LOCALSTORAGE_KEY_PREFIX + cacheKey);
      return null;
    }
    
    return entry.v;
  } catch {
    return null;
  }
}

/**
 * Store translation in localStorage for persistent caching
 */
function setLocalStorageCache(cacheKey: string, value: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entry: LocalStorageCacheEntry = {
      v: value,
      t: Date.now(),
    };
    localStorage.setItem(LOCALSTORAGE_KEY_PREFIX + cacheKey, JSON.stringify(entry));
  } catch (e) {
    // localStorage might be full or disabled - ignore
    console.warn('Failed to cache translation in localStorage:', e);
  }
}

// Request queue to prevent overwhelming the API
interface QueuedRequest {
  text: string;
  targetLang: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  retryCount: number;
}

const requestQueue: QueuedRequest[] = [];
const pendingRequests = new Map<string, QueuedRequest[]>(); // Track pending requests by cache key
let isProcessingQueue = false;
const MAX_CONCURRENT_REQUESTS = 1; // Only 1 concurrent request to avoid rate limits
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests
let activeRequests = 0;

// Batch processing - collect requests for a short time then send together
const batchQueue: QueuedRequest[] = [];
let batchTimer: NodeJS.Timeout | null = null;
const BATCH_DELAY = 100; // Wait 100ms to collect more requests
const MAX_BATCH_SIZE = 50; // Send up to 50 translations at once

/**
 * Generate a short hash for long texts (for localStorage key)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getCacheKey(text: string, targetLang: string): string {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  const normalizedLang = targetLang.toLowerCase();
  // For long texts, use hash to keep localStorage keys manageable
  const textKey = normalizedText.length > 100 
    ? simpleHash(normalizedText) 
    : normalizedText;
  return `${normalizedLang}:${textKey}`;
}

/**
 * Process batch translations - send multiple translations at once
 */
async function processBatch() {
  if (batchQueue.length === 0) return;

  const batch = batchQueue.splice(0, MAX_BATCH_SIZE);
  const uniqueTexts = new Map<string, QueuedRequest[]>();

  // Group by unique text+lang combinations
  for (const request of batch) {
    const key = getCacheKey(request.text, request.targetLang);
    if (!uniqueTexts.has(key)) {
      uniqueTexts.set(key, []);
    }
    uniqueTexts.get(key)!.push(request);
  }

  // Send batch request for this language
  const targetLang = batch[0].targetLang;
  const textsToTranslate = Array.from(uniqueTexts.keys()).map(key => {
    const firstRequest = uniqueTexts.get(key)![0];
    return firstRequest.text;
  });

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: textsToTranslate,
        targetLang,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const translations = data.translations || [];

      // Resolve all requests with their translations
      textsToTranslate.forEach((text, index) => {
        const translation = translations[index] || text;
        const key = getCacheKey(text, targetLang);
        
        // Store in both memory and localStorage
        clientCache.set(key, translation);
        setLocalStorageCache(key, translation);

        const requests = uniqueTexts.get(key) || [];
        requests.forEach(req => req.resolve(translation));
      });
    } else if (response.status === 429) {
      // Rate limited - fall back to queue processing
      batch.forEach(req => requestQueue.push(req));
      processQueue();
    } else {
      // Error - resolve with original text
      batch.forEach(req => req.resolve(req.text));
    }
  } catch (error) {
    console.error('Batch translation failed:', error);
    // Fallback: resolve with original text
    batch.forEach(req => req.resolve(req.text));
  }

  // Process next batch if any
  if (batchQueue.length > 0) {
    setTimeout(processBatch, DELAY_BETWEEN_REQUESTS);
  }
}

/**
 * Process the translation queue with rate limiting
 */
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const request = requestQueue.shift();
    if (!request) continue;

    activeRequests++;

    // Add delay between requests to avoid rate limiting
    if (activeRequests > 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    translateWithRetry(request)
      .finally(() => {
        activeRequests--;
        processQueue(); // Continue processing queue
      });
  }

  isProcessingQueue = false;
}

/**
 * Execute translation with exponential backoff retry logic
 */
async function translateWithRetry(request: QueuedRequest): Promise<void> {
  const { text, targetLang, resolve, retryCount } = request;
  const maxRetries = 5; // Increased from 3 to handle more retries
  const baseDelay = 1000; // Start with 1 second delay

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLang,
      }),
    });

    if (response.status === 429) {
      if (retryCount < maxRetries) {
        // Rate limited - retry with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Re-queue with incremented retry count and process immediately
        const retryRequest = {
          ...request,
          retryCount: retryCount + 1,
        };
        requestQueue.unshift(retryRequest);
        
        return; // Don't resolve/reject - let the retry handle it
      } else {
        // Max retries exceeded - return original text as fallback
        console.warn(`Rate limit retry exhausted for: ${text.substring(0, 50)}...`);
        resolve(text); // Fallback to original text
        return;
      }
    }

    if (!response.ok) {
      console.warn(`Translation API error ${response.status}, falling back to original text`);
      resolve(text); // Fallback to original text instead of throwing
      return;
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Translation failed');
    }

    const translation = data.translation || text;
    
    // Cache the result in both memory and localStorage
    const cacheKey = getCacheKey(text, targetLang);
    clientCache.set(cacheKey, translation);
    setLocalStorageCache(cacheKey, translation);
    
    // Resolve all pending requests for this text
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      pending.forEach(req => req.resolve(translation));
      pendingRequests.delete(cacheKey);
    } else {
      resolve(translation);
    }
  } catch (error) {
    console.error('Translation request failed:', error);
    
    // Reject all pending requests for this text or just this one
    const cacheKey = getCacheKey(text, targetLang);
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      pending.forEach(req => req.resolve(text)); // Fallback to original text
      pendingRequests.delete(cacheKey);
    } else {
      resolve(text); // Fallback to original text instead of rejecting
    }
  }
}

/**
 * Translate text using the server API with queue management.
 * Uses multi-level caching: memory → localStorage → API
 */
export async function clientTranslate(text: string, targetLang: string): Promise<string> {
  // Return immediately if text is empty or target is English
  if (!text || !text.trim() || targetLang.toLowerCase() === 'en') {
    return text;
  }

  const cacheKey = getCacheKey(text, targetLang);
  
  // Check memory cache first (fastest)
  const memoryCached = clientCache.get(cacheKey);
  if (memoryCached) {
    return memoryCached;
  }
  
  // Check localStorage cache (persists across page loads)
  const storageCached = getLocalStorageCache(cacheKey);
  if (storageCached) {
    // Populate memory cache for subsequent lookups
    clientCache.set(cacheKey, storageCached);
    return storageCached;
  }

  // Check if there's already a pending request for this text
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    // Attach to existing request instead of creating a new one
    return new Promise((resolve, reject) => {
      pending.push({
        text,
        targetLang,
        resolve,
        reject,
        retryCount: 0,
      });
    }).catch(error => {
      console.error('Client translation failed:', error);
      return text; // Fallback to original text
    }) as Promise<string>;
  }

  // Create a new pending request group
  const requestGroup: QueuedRequest[] = [];
  pendingRequests.set(cacheKey, requestGroup);

  // Add to batch queue and return a promise
  return new Promise((resolve, reject) => {
    const request = {
      text,
      targetLang,
      resolve,
      reject,
      retryCount: 0,
    };
    
    requestGroup.push(request);
    batchQueue.push(request);
    
    // Set timer to process batch (allows collecting more requests)
    if (batchTimer) {
      clearTimeout(batchTimer);
    }
    
    // Process immediately if batch is full, otherwise wait to collect more
    if (batchQueue.length >= MAX_BATCH_SIZE) {
      processBatch();
    } else {
      batchTimer = setTimeout(() => {
        batchTimer = null;
        processBatch();
      }, BATCH_DELAY);
    }
  }).catch(error => {
    console.error('Client translation failed:', error);
    return text; // Fallback to original text
  }) as Promise<string>;
}

/**
 * Translate multiple texts using the server API
 */
export async function clientTranslateBatch(texts: string[], targetLang: string): Promise<string[]> {
  // Return immediately if target is English
  if (targetLang.toLowerCase() === 'en') {
    return texts;
  }

  // Check cache for each text
  const cacheResults: (string | null)[] = texts.map(text => {
    if (!text || !text.trim()) return text;
    const cacheKey = getCacheKey(text, targetLang);
    return clientCache.get(cacheKey) || null;
  });

  // If all are cached, return cached results
  if (cacheResults.every(result => result !== null)) {
    return cacheResults as string[];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts,
        targetLang,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Batch translation API error ${response.status}, falling back to original texts`);
      return texts; // Fallback to original texts
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Batch translation failed');
    }

    const translations = data.translations || texts;
    
    // Cache the results
    texts.forEach((text, index) => {
      if (text && text.trim()) {
        const cacheKey = getCacheKey(text, targetLang);
        clientCache.set(cacheKey, translations[index]);
      }
    });
    
    return translations;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Batch translation timed out, falling back to original texts');
    } else {
      console.error('Client batch translation failed:', error);
    }
    return texts; // Fallback to original texts
  }
}