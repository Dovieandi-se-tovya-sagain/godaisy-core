/**
 * Image Optimization Utility
 *
 * Optimizes images before upload to reduce bandwidth and storage:
 * - Resizes to max 960x540 (maintains aspect ratio)
 * - Compresses to 85% JPEG quality
 * - Converts to web-friendly format
 *
 * Critical for mobile apps where users may take high-res photos (12MP+)
 * that would timeout or fail to upload on slow connections.
 *
 * Usage:
 *   import { optimizeImage } from './image-optimizer';
 *
 *   const blob = await optimizeImage(file);
 *   // Original: 4MB, 4032x3024
 *   // Optimized: ~150KB, 720x540
 */

export interface ImageOptimizationOptions {
  /** Maximum width in pixels (default: 960) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 540) */
  maxHeight?: number;
  /** JPEG quality 0-1 (default: 0.85) */
  quality?: number;
  /** Output format (default: 'image/jpeg') */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface ImageOptimizationResult {
  /** Optimized image blob */
  blob: Blob;
  /** Original dimensions */
  originalWidth: number;
  originalHeight: number;
  /** Optimized dimensions */
  optimizedWidth: number;
  optimizedHeight: number;
  /** Original file size in bytes */
  originalSize: number;
  /** Optimized file size in bytes */
  optimizedSize: number;
  /** Compression ratio (e.g., 0.1 = 10% of original size) */
  compressionRatio: number;
  /** Whether the image was resized */
  wasResized: boolean;
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 960,
  maxHeight: 540,
  quality: 0.85,
  format: 'image/jpeg',
};

/**
 * Load an image from a File, Blob, or data URL
 */
function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (typeof source === 'string') {
      // Data URL
      img.src = source;
    } else {
      // File or Blob
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Calculate new dimensions that fit within max bounds while maintaining aspect ratio
 */
function calculateOptimizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; wasResized: boolean } {
  // No resize needed if already within bounds
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return {
      width: originalWidth,
      height: originalHeight,
      wasResized: false,
    };
  }

  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;

  let newWidth = originalWidth;
  let newHeight = originalHeight;

  // Resize based on which dimension exceeds limit more
  if (originalWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round(maxWidth / aspectRatio);
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round(maxHeight * aspectRatio);
  }

  return {
    width: newWidth,
    height: newHeight,
    wasResized: true,
  };
}

/**
 * Optimize an image for upload
 *
 * @param source - File, Blob, or data URL to optimize
 * @param options - Optimization options (max size, quality, format)
 * @returns Optimization result with blob and metrics
 *
 * @example
 * // From file input
 * const file = event.target.files[0];
 * const result = await optimizeImage(file);
 * console.log(`Reduced from ${result.originalSize} to ${result.optimizedSize}`);
 * console.log(`Compression: ${(result.compressionRatio * 100).toFixed(1)}%`);
 *
 * // From Capacitor Camera
 * const photo = await Camera.getPhoto({ resultType: CameraResultType.DataUrl });
 * const result = await optimizeImage(photo.dataUrl);
 *
 * // Upload optimized image
 * const formData = new FormData();
 * formData.append('photo', result.blob, 'catch-photo.jpg');
 */
export async function optimizeImage(
  source: File | Blob | string,
  options: ImageOptimizationOptions = {}
): Promise<ImageOptimizationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Load the image
  const img = await loadImage(source);

  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  const originalSize = source instanceof Blob ? source.size : 0;

  // Calculate optimized dimensions
  const { width, height, wasResized } = calculateOptimizedDimensions(
    originalWidth,
    originalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // Create canvas for resizing
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw image on canvas (this performs the resize)
  ctx.drawImage(img, 0, 0, width, height);

  // Convert canvas to blob with compression
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      opts.format,
      opts.quality
    );
  });

  // Clean up object URL if we created one
  if (source instanceof Blob) {
    URL.revokeObjectURL(img.src);
  }

  // Calculate compression ratio
  const optimizedSize = blob.size;
  const compressionRatio = originalSize > 0 ? optimizedSize / originalSize : 0;

  return {
    blob,
    originalWidth,
    originalHeight,
    optimizedWidth: width,
    optimizedHeight: height,
    originalSize,
    optimizedSize,
    compressionRatio,
    wasResized,
  };
}

/**
 * Optimize multiple images in parallel
 *
 * @param sources - Array of images to optimize
 * @param options - Optimization options
 * @param onProgress - Callback for progress updates
 * @returns Array of optimization results
 *
 * @example
 * const files = Array.from(event.target.files);
 * const results = await optimizeImages(files, {}, (progress) => {
 *   console.log(`Optimizing: ${progress.current}/${progress.total}`);
 * });
 */
export async function optimizeImages(
  sources: (File | Blob | string)[],
  options: ImageOptimizationOptions = {},
  onProgress?: (progress: { current: number; total: number }) => void
): Promise<ImageOptimizationResult[]> {
  const results: ImageOptimizationResult[] = [];

  for (let i = 0; i < sources.length; i++) {
    const result = await optimizeImage(sources[i], options);
    results.push(result);

    if (onProgress) {
      onProgress({ current: i + 1, total: sources.length });
    }
  }

  return results;
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Estimate upload time based on file size and connection speed
 *
 * @param bytes - File size in bytes
 * @param speedMbps - Upload speed in Mbps (default: 5 for 4G)
 * @returns Estimated upload time in seconds
 */
export function estimateUploadTime(bytes: number, speedMbps: number = 5): number {
  const bitsPerSecond = speedMbps * 1024 * 1024;
  const bits = bytes * 8;
  return bits / bitsPerSecond;
}
