import { supabase } from '../supabase/client';

const CATCH_PHOTO_BUCKET = 'catch-photos';
const LEGACY_BUCKET = 'findr-catch-photos';
const SUPABASE_PUBLIC_PATH_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  path?: string;
  error?: string;
}

/**
 * Upload a photo to Supabase Storage with automatic organization by user and date
 * 
 * @param file - The image file or blob to upload
 * @param catchId - Unique identifier for the catch (for organizing photos)
 * @param userId - User ID for organizing photos by user
 * @returns Upload result with public URL or error
 */
export async function uploadCatchPhoto(
  file: File | Blob,
  catchId: string,
  userId: string
): Promise<PhotoUploadResult> {
  try {
    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileExt = file instanceof File ? file.name.split('.').pop() : 'jpg';
    const fileName = `${userId}/${catchId}/${timestamp}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(CATCH_PHOTO_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file instanceof File ? file.type : 'image/jpeg'
      });

    if (error) {
      console.error('[Photo Upload] Supabase error:', error);
      return { success: false, error: `Upload failed: ${error.message}` };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(CATCH_PHOTO_BUCKET)
      .getPublicUrl(data.path);

    let thumbnailUrl: string | undefined;
    // Try to request a transformed (thumbnail) public URL; fall back to base public URL
    const basePublicUrl = urlData.publicUrl ?? undefined;
    try {
      const { data: thumbnailData } = supabase.storage
        .from(CATCH_PHOTO_BUCKET)
        .getPublicUrl(data.path, {
          transform: {
            width: 320,
            height: 320,
            resize: 'cover',
            quality: 80,
          },
        });

      const tUrl = thumbnailData.publicUrl ?? null;
      // If Supabase returns a render/transform endpoint (tenant may not support it),
      // prefer the base public URL so clients don't attempt to fetch a 403 render URL.
      if (tUrl && tUrl.includes('/render/image/')) {
        thumbnailUrl = basePublicUrl;
      } else {
        thumbnailUrl = tUrl ?? basePublicUrl;
      }
    } catch (_err) {
      thumbnailUrl = basePublicUrl;
    }

    return { 
      success: true, 
      url: urlData.publicUrl,
      thumbnailUrl,
      path: data.path,
    };

  } catch (error) {
    console.error('[Photo Upload] Unexpected error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

/**
 * Delete a photo from Supabase Storage
 * 
 * @param photoPath - The path of the photo in storage (extracted from URL)
 * @returns Success status
 */
export async function deleteCatchPhoto(photoPath: string): Promise<boolean> {
  try {
    const { bucket, path } = resolveBucketAndPath(photoPath);
    if (!bucket || !path) {
      console.error('[Photo Delete] Unable to resolve storage path for', photoPath);
      return false;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('[Photo Delete] Supabase error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Photo Delete] Unexpected error:', error);
    return false;
  }
}

/**
 * Extract storage path from Supabase public URL
 * 
 * @param publicUrl - The public URL returned by Supabase
 * @returns The storage path for use with delete operations
 */
export function extractStoragePath(publicUrl: string): string {
  try {
    const url = new URL(publicUrl);
    const match = url.pathname.match(SUPABASE_PUBLIC_PATH_REGEX);
    if (!match) return '';
    const [, bucket, path] = match;

    if (bucket === CATCH_PHOTO_BUCKET || bucket === LEGACY_BUCKET) {
      return path;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Create the Supabase Storage bucket for catch photos if it doesn't exist
 * This should be called during app initialization or migration
 */
export async function createPhotoBucket(): Promise<boolean> {
  try {
    // Create bucket with public read access
    const { error } = await supabase.storage.createBucket(CATCH_PHOTO_BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      fileSizeLimit: 5 * 1024 * 1024, // 5MB limit for processed images
    });

    if (error && !error.message.includes('already exists')) {
      console.error('[Photo Bucket] Creation failed:', error);
      return false;
    }

    console.info('[Photo Bucket] Ready for catch photos');
    return true;
  } catch (error) {
    console.error('[Photo Bucket] Unexpected error:', error);
    return false;
  }
}

function resolveBucketAndPath(reference: string): { bucket: string | null; path: string | null } {
  const trimmed = reference.trim();

  if (!trimmed) {
    return { bucket: null, path: null };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(SUPABASE_PUBLIC_PATH_REGEX);
      if (match) {
        return { bucket: match[1], path: match[2] };
      }
    } catch {
      return { bucket: null, path: null };
    }
    return { bucket: null, path: null };
  }

  if (trimmed.startsWith(`${CATCH_PHOTO_BUCKET}/`)) {
    return { bucket: CATCH_PHOTO_BUCKET, path: trimmed.slice(CATCH_PHOTO_BUCKET.length + 1) };
  }

  if (trimmed.startsWith(`${LEGACY_BUCKET}/`)) {
    return { bucket: LEGACY_BUCKET, path: trimmed.slice(LEGACY_BUCKET.length + 1) };
  }

  return { bucket: CATCH_PHOTO_BUCKET, path: trimmed };
}

/**
 * Compresses an image file to reduce storage size while maintaining acceptable quality
 * 
 * CURRENT SETTINGS (optimized for storage efficiency):
 * - Max width: 600px (maintains aspect ratio)
 * - JPEG quality: 60% 
 * - Typical size reduction: 80-90% of original
 * 
 * FUTURE ADJUSTMENT GUIDE:
 * If storage fills up too fast, consider these options in order:
 * 1. Reduce maxWidth to 400px (for thumbnails only)
 * 2. Lower JPEG quality to 50% (noticeable quality loss)
 * 3. Convert to WebP format (better compression, check browser support)
 * 4. Implement progressive deletion of old photos after 6 months
 * 5. Add photo count limits per user (e.g., max 50 photos)
 * 
 * If quality complaints arise:
 * 1. Increase JPEG quality to 70-75%
 * 2. Increase maxWidth to 800px
 * 3. Consider different settings for different photo types
 */
export const compressImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions (max 600px width, maintain aspect ratio)
      // Adjust these values based on storage usage and quality requirements
      const maxWidth = 600;   // STORAGE SETTING: Reduce to 400px if storage issues
      const maxHeight = 600;  // STORAGE SETTING: Reduce proportionally with maxWidth
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress with storage-optimized settings
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.6 // 60% quality - STORAGE SETTING: Reduce to 0.5 if storage issues, increase to 0.7-0.75 if quality complaints
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
