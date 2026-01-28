/**
 * Image Compression Utility for Upload
 * 
 * Hybrid approach using:
 * - Canvas API for resizing (max 1920px)
 * - browser-image-compression for EXIF preservation and Web Worker support
 * - Progressive quality reduction (85% → lower until <4MB)
 * 
 * @see docs/IMAGE_COMPRESSION.md for usage documentation
 */

import imageCompression from 'browser-image-compression';

// Configuration
const MAX_DIMENSION = 1920;
const TARGET_SIZE_MB = 4;
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;
const FALLBACK_SIZE_MB = 1; // If compression fails, allow original if under this size

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savings: number; // percentage saved
  wasCompressed: boolean;
}

export interface CompressionOptions {
  maxSizeMB?: number;
  maxDimension?: number;
  initialQuality?: number;
  preserveExif?: boolean;
}

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get savings text for display (e.g., "12.5MB → 2.1MB")
 */
export function getSavingsText(result: CompressionResult): string {
  const original = formatFileSize(result.originalSize);
  const compressed = formatFileSize(result.compressedSize);
  return `${original} → ${compressed}`;
}

/**
 * Compress an image file for upload using hybrid Canvas + browser-image-compression approach.
 * 
 * Uses Web Worker for non-blocking UI.
 * Preserves EXIF data (GPS, timestamp) for server-side extraction.
 * Progressive quality reduction until file is under target size.
 * 
 * On failure: returns original if under 1MB, otherwise throws error.
 * 
 * @param file - The image file to compress
 * @param options - Optional compression settings
 * @returns Promise<CompressionResult> with compressed file and metadata
 */
export async function compressForUpload(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxSizeMB = TARGET_SIZE_MB,
    maxDimension = MAX_DIMENSION,
    initialQuality = INITIAL_QUALITY,
    preserveExif = true,
  } = options;

  const originalSize = file.size;
  const targetBytes = maxSizeMB * 1024 * 1024;

  // If already under target size and small enough, might not need compression
  // But we still resize for consistency (large dimension images)
  
  try {
    // Use browser-image-compression with Web Worker for EXIF preservation
    // and non-blocking operation
    let quality = initialQuality;
    let compressedFile: File = file;
    let attempts = 0;
    const maxAttempts = Math.ceil((initialQuality - MIN_QUALITY) / QUALITY_STEP) + 1;

    while (attempts < maxAttempts) {
      const compressionOptions = {
        maxSizeMB: maxSizeMB,
        maxWidthOrHeight: maxDimension,
        useWebWorker: true,
        preserveExif: preserveExif,
        initialQuality: quality,
        fileType: 'image/jpeg' as const,
      };

      compressedFile = await imageCompression(file, compressionOptions);
      
      console.log(`[compressForUpload] Attempt ${attempts + 1}: quality=${quality.toFixed(2)}, size=${formatFileSize(compressedFile.size)}`);

      // Check if we're under target
      if (compressedFile.size <= targetBytes) {
        break;
      }

      // Reduce quality for next attempt
      quality -= QUALITY_STEP;
      if (quality < MIN_QUALITY) {
        quality = MIN_QUALITY;
        // Final attempt with minimum quality
        if (attempts === maxAttempts - 2) {
          attempts = maxAttempts - 1;
        }
      }
      attempts++;
    }

    // If still too large after all attempts, throw if original is too big
    if (compressedFile.size > targetBytes) {
      console.warn(`[compressForUpload] Could not reduce to target size. Final: ${formatFileSize(compressedFile.size)}`);
      // Still return the compressed file, it's better than original
    }

    const savings = originalSize > 0 
      ? ((originalSize - compressedFile.size) / originalSize) * 100 
      : 0;

    console.log('[compressForUpload] Compression complete:', {
      original: formatFileSize(originalSize),
      compressed: formatFileSize(compressedFile.size),
      savings: `${savings.toFixed(1)}%`,
    });

    return {
      file: compressedFile,
      originalSize,
      compressedSize: compressedFile.size,
      savings,
      wasCompressed: true,
    };

  } catch (error) {
    console.error('[compressForUpload] Compression failed:', error);

    // Fallback: if original is under 1MB, use it
    const fallbackBytes = FALLBACK_SIZE_MB * 1024 * 1024;
    if (originalSize <= fallbackBytes) {
      console.log(`[compressForUpload] Using original file (${formatFileSize(originalSize)} < ${FALLBACK_SIZE_MB}MB)`);
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        savings: 0,
        wasCompressed: false,
      };
    }

    // Otherwise, throw the error
    throw new Error(
      `Image compression failed and original file (${formatFileSize(originalSize)}) exceeds ${FALLBACK_SIZE_MB}MB limit. ` +
      `Please try a smaller image.`
    );
  }
}

/**
 * Check if a file needs compression based on size
 */
export function needsCompression(file: File, maxSizeMB: number = TARGET_SIZE_MB): boolean {
  return file.size > maxSizeMB * 1024 * 1024;
}

/**
 * Validate file is an acceptable image type
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  return validTypes.includes(file.type.toLowerCase());
}

/**
 * Get estimated compression time message based on file size
 */
export function getCompressionMessage(fileSize: number): string {
  const sizeMB = fileSize / (1024 * 1024);
  const sizeText = formatFileSize(fileSize);
  
  if (sizeMB > 10) {
    return `Compressing ${sizeText} (this may take a moment)...`;
  } else if (sizeMB > 5) {
    return `Compressing ${sizeText}...`;
  } else {
    return `Optimizing ${sizeText}...`;
  }
}
