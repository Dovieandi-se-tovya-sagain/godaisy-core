/**
 * Camera Wrapper
 *
 * Unified camera API that works seamlessly across web and native platforms
 *
 * Features:
 * - Uses native Camera plugin on iOS/Android
 * - Falls back to web file input with camera capture
 * - Returns base64 data URL compatible with existing EXIF extraction
 * - Configurable quality and size
 * - Multiple source options (camera, gallery)
 *
 * Usage:
 * ```typescript
 * import { takePicture, selectFromGallery } from './camera';
 *
 * // Take a photo with camera
 * const photo = await takePicture({ quality: 90 });
 * console.log(photo.dataUrl); // "data:image/jpeg;base64,..."
 *
 * // Select from gallery
 * const photo = await selectFromGallery();
 * console.log(photo.dataUrl);
 * ```
 */

import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './platform';
import { optimizeImage, type ImageOptimizationResult } from './image-optimizer';
import { createLogger } from '../utils/logger';

const logger = createLogger('Camera');

/**
 * Photo result with data URL
 * Compatible with existing EXIF extraction code
 */
export interface Photo {
  dataUrl: string; // "data:image/jpeg;base64,..."
  format: 'jpeg' | 'png' | 'gif' | 'webp';
  exif?: Record<string, unknown>; // Native platforms may include EXIF
  optimization?: ImageOptimizationResult; // Present if image was optimized
}

/**
 * Camera options
 */
export interface CameraOptions {
  quality?: number; // 0-100, default 90
  width?: number; // Max width in pixels
  height?: number; // Max height in pixels
  allowEditing?: boolean; // Allow user to crop/edit (default false)
  saveToGallery?: boolean; // Save to device gallery (default false)
  optimize?: boolean; // Apply image optimization (default true)
  optimizeMaxWidth?: number; // Max width after optimization (default 960)
  optimizeMaxHeight?: number; // Max height after optimization (default 540)
  optimizeQuality?: number; // JPEG quality 0-1 (default 0.85)
}

/**
 * Camera error types
 */
export type CameraError = 'PERMISSION_DENIED' | 'CANCELLED' | 'UNAVAILABLE' | 'UNKNOWN';

/**
 * Helper: Optimize a photo if requested
 */
async function maybeOptimizePhoto(
  photo: Photo,
  options: CameraOptions
): Promise<Photo> {
  const {
    optimize = true,
    optimizeMaxWidth = 960,
    optimizeMaxHeight = 540,
    optimizeQuality = 0.85,
  } = options;

  // Skip optimization if disabled
  if (!optimize) {
    return photo;
  }

  try {
    // Optimize the image
    const result = await optimizeImage(photo.dataUrl, {
      maxWidth: optimizeMaxWidth,
      maxHeight: optimizeMaxHeight,
      quality: optimizeQuality,
      format: 'image/jpeg', // Always convert to JPEG for best compression
    });

    // Convert blob back to data URL
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read optimized image'));
      reader.readAsDataURL(result.blob);
    });

    return {
      ...photo,
      dataUrl,
      format: 'jpeg',
      optimization: result,
    };
  } catch (error) {
    // If optimization fails, return original photo
    logger.warn('Image optimization failed, using original', error);
    return photo;
  }
}

/**
 * Custom error class for camera errors
 */
export class CameraException extends Error {
  constructor(
    public type: CameraError,
    message: string
  ) {
    super(message);
    this.name = 'CameraException';
  }
}

/**
 * Take a picture using the camera
 */
export const takePicture = async (options: CameraOptions = {}): Promise<Photo> => {
  const {
    quality = 90,
    width,
    height,
    allowEditing = false,
    saveToGallery = false,
  } = options;

  try {
    if (isNative()) {
      // Use native Camera plugin
      const image = await CapacitorCamera.getPhoto({
        quality,
        width,
        height,
        allowEditing,
        saveToGallery,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (!image.dataUrl) {
        throw new CameraException('UNKNOWN', 'Failed to get image data');
      }

      const photo: Photo = {
        dataUrl: image.dataUrl,
        format: (image.format || 'jpeg') as Photo['format'],
        exif: image.exif,
      };

      return await maybeOptimizePhoto(photo, options);
    } else {
      // Use web file input with camera capture
      return new Promise((resolve, reject) => {
        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use rear camera if available
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];

          if (!file) {
            reject(new CameraException('CANCELLED', 'No file selected'));
            return;
          }

          try {
            // Read file as data URL
            const reader = new FileReader();
            reader.onload = async () => {
              const dataUrl = reader.result as string;

              // Determine format from MIME type
              let format: Photo['format'] = 'jpeg';
              if (file.type === 'image/png') format = 'png';
              else if (file.type === 'image/gif') format = 'gif';
              else if (file.type === 'image/webp') format = 'webp';

              const photo: Photo = {
                dataUrl,
                format,
              };

              const optimizedPhoto = await maybeOptimizePhoto(photo, options);
              resolve(optimizedPhoto);

              // Clean up
              document.body.removeChild(input);
            };

            reader.onerror = () => {
              reject(new CameraException('UNKNOWN', 'Failed to read file'));
              document.body.removeChild(input);
            };

            reader.readAsDataURL(file);
          } catch (_error) {
            reject(new CameraException('UNKNOWN', 'Failed to process file'));
            document.body.removeChild(input);
          }
        });

        input.addEventListener('cancel', () => {
          reject(new CameraException('CANCELLED', 'User cancelled'));
          document.body.removeChild(input);
        });

        // Add to DOM and trigger click
        document.body.appendChild(input);
        input.click();
      });
    }
  } catch (error) {
    if (error instanceof CameraException) {
      throw error;
    }

    // Handle Capacitor-specific errors
    if (error instanceof Error) {
      if (error.message.includes('cancelled') || error.message.includes('cancel')) {
        throw new CameraException('CANCELLED', 'User cancelled');
      }
      if (error.message.includes('permission')) {
        throw new CameraException('PERMISSION_DENIED', error.message);
      }
      if (error.message.includes('unavailable') || error.message.includes('not available')) {
        throw new CameraException('UNAVAILABLE', 'Camera is not available');
      }
      throw new CameraException('UNKNOWN', error.message);
    }

    throw new CameraException('UNKNOWN', 'Failed to take picture');
  }
};

/**
 * Select a photo from the gallery/photos
 */
export const selectFromGallery = async (options: CameraOptions = {}): Promise<Photo> => {
  const { quality = 90, width, height, allowEditing = false } = options;

  try {
    if (isNative()) {
      // Use native Camera plugin with Photos source
      const image = await CapacitorCamera.getPhoto({
        quality,
        width,
        height,
        allowEditing,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (!image.dataUrl) {
        throw new CameraException('UNKNOWN', 'Failed to get image data');
      }

      const photo: Photo = {
        dataUrl: image.dataUrl,
        format: (image.format || 'jpeg') as Photo['format'],
        exif: image.exif,
      };

      return await maybeOptimizePhoto(photo, options);
    } else {
      // Use web file input without camera capture
      return new Promise((resolve, reject) => {
        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];

          if (!file) {
            reject(new CameraException('CANCELLED', 'No file selected'));
            return;
          }

          try {
            // Read file as data URL
            const reader = new FileReader();
            reader.onload = async () => {
              const dataUrl = reader.result as string;

              // Determine format from MIME type
              let format: Photo['format'] = 'jpeg';
              if (file.type === 'image/png') format = 'png';
              else if (file.type === 'image/gif') format = 'gif';
              else if (file.type === 'image/webp') format = 'webp';

              const photo: Photo = {
                dataUrl,
                format,
              };

              const optimizedPhoto = await maybeOptimizePhoto(photo, options);
              resolve(optimizedPhoto);

              // Clean up
              document.body.removeChild(input);
            };

            reader.onerror = () => {
              reject(new CameraException('UNKNOWN', 'Failed to read file'));
              document.body.removeChild(input);
            };

            reader.readAsDataURL(file);
          } catch (_error) {
            reject(new CameraException('UNKNOWN', 'Failed to process file'));
            document.body.removeChild(input);
          }
        });

        input.addEventListener('cancel', () => {
          reject(new CameraException('CANCELLED', 'User cancelled'));
          document.body.removeChild(input);
        });

        // Add to DOM and trigger click
        document.body.appendChild(input);
        input.click();
      });
    }
  } catch (error) {
    if (error instanceof CameraException) {
      throw error;
    }

    // Handle Capacitor-specific errors
    if (error instanceof Error) {
      if (error.message.includes('cancelled') || error.message.includes('cancel')) {
        throw new CameraException('CANCELLED', 'User cancelled');
      }
      if (error.message.includes('permission')) {
        throw new CameraException('PERMISSION_DENIED', error.message);
      }
      throw new CameraException('UNKNOWN', error.message);
    }

    throw new CameraException('UNKNOWN', 'Failed to select photo');
  }
};

/**
 * Check if camera permissions are granted
 */
export const checkPermissions = async (): Promise<boolean> => {
  if (isNative()) {
    const permissions = await CapacitorCamera.checkPermissions();
    return permissions.camera === 'granted';
  } else {
    // Web doesn't have explicit camera permission check
    // Permission is requested when user interacts with file input
    return true;
  }
};

/**
 * Request camera permissions
 */
export const requestPermissions = async (): Promise<boolean> => {
  if (isNative()) {
    const permissions = await CapacitorCamera.requestPermissions();
    return permissions.camera === 'granted';
  } else {
    // Web permissions are granted when user interacts with file input
    return true;
  }
};
