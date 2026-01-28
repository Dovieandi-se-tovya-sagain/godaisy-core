/**
 * Share Wrapper
 *
 * Unified share API that works seamlessly across web and native platforms
 *
 * Features:
 * - Uses native Share plugin on iOS/Android
 * - Falls back to Web Share API in modern browsers
 * - Provides fallback for older browsers (copy to clipboard)
 * - Share text, URLs, and files
 * - Type-safe error handling
 *
 * Usage:
 * ```typescript
 * import { share, shareText, shareUrl, canShare } from './share';
 *
 * // Share text and URL
 * await share({
 *   title: 'Check this out!',
 *   text: 'Amazing fishing predictions',
 *   url: 'https://fishfindr.eu',
 * });
 *
 * // Share a file (native only)
 * await share({
 *   title: 'My Catch',
 *   text: 'Caught a bass!',
 *   files: [imageDataUrl],
 * });
 *
 * // Check if sharing is supported
 * if (await canShare()) {
 *   // Show share button
 * }
 * ```
 */

import { Share as CapacitorShare } from '@capacitor/share';
import { isNative } from './platform';
import { createLogger } from '../utils/logger';

const logger = createLogger('Share');

/**
 * Share options
 */
export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string; // Android only
  files?: string[]; // Data URLs or file paths (native only)
}

/**
 * Share error types
 */
export type ShareError = 'CANCELLED' | 'UNAVAILABLE' | 'UNKNOWN';

/**
 * Custom error class for share errors
 */
export class ShareException extends Error {
  constructor(
    public type: ShareError,
    message: string
  ) {
    super(message);
    this.name = 'ShareException';
  }
}

/**
 * Share content (text, URL, or files)
 */
export const share = async (options: ShareOptions): Promise<void> => {
  const { title, text, url, dialogTitle, files } = options;

  // Validate at least one shareable item is provided
  if (!title && !text && !url && (!files || files.length === 0)) {
    throw new ShareException('UNKNOWN', 'Must provide at least one of: title, text, url, or files');
  }

  try {
    if (isNative()) {
      // Use native Share plugin
      await CapacitorShare.share({
        title,
        text,
        url,
        dialogTitle,
        files,
      });
    } else {
      // Check if Web Share API is available
      if (navigator.share) {
        // Web Share API (Chrome, Safari, Edge)
        const shareData: ShareData = {};
        if (title) shareData.title = title;
        if (text) shareData.text = text;
        if (url) shareData.url = url;

        // Web Share API supports files in some browsers
        if (files && files.length > 0 && navigator.canShare) {
          // Convert data URLs to File objects
          const fileObjects = await Promise.all(
            files.map(async (dataUrl) => {
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              return new File([blob], 'shared-file', { type: blob.type });
            })
          );

          // Check if browser can share files
          if (navigator.canShare({ files: fileObjects })) {
            shareData.files = fileObjects;
          }
        }

        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard and show notification
        const shareText = [title, text, url].filter(Boolean).join('\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareText);
          // In a real app, you might want to show a toast notification here
          logger.info('Share content copied to clipboard:', shareText);
        } else {
          // Even older fallback: Create temporary textarea
          const textarea = document.createElement('textarea');
          textarea.value = shareText;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          logger.info('Share content copied to clipboard:', shareText);
        }
      }
    }
  } catch (error) {
    if (error instanceof ShareException) {
      throw error;
    }

    // Handle specific error cases
    if (error instanceof Error) {
      // User cancelled the share dialog
      if (
        error.name === 'AbortError' ||
        error.message.includes('cancelled') ||
        error.message.includes('cancel')
      ) {
        throw new ShareException('CANCELLED', 'User cancelled sharing');
      }

      // Share not available
      if (error.message.includes('not available') || error.message.includes('unavailable')) {
        throw new ShareException('UNAVAILABLE', 'Sharing is not available');
      }

      throw new ShareException('UNKNOWN', error.message);
    }

    throw new ShareException('UNKNOWN', 'Failed to share content');
  }
};

/**
 * Share text only
 * Convenience method for sharing plain text
 */
export const shareText = async (text: string, title?: string): Promise<void> => {
  return share({ text, title });
};

/**
 * Share URL only
 * Convenience method for sharing URLs
 */
export const shareUrl = async (url: string, title?: string, text?: string): Promise<void> => {
  return share({ url, title, text });
};

/**
 * Check if sharing is supported on this platform
 */
export const canShare = async (): Promise<boolean> => {
  if (isNative()) {
    // Native platforms always support sharing
    return true;
  } else {
    // Check for Web Share API
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      return true;
    }

    // Fallback (clipboard) is always available
    return true;
  }
};

/**
 * Check if file sharing is supported
 * Native platforms and some modern browsers support file sharing
 */
export const canShareFiles = async (): Promise<boolean> => {
  if (isNative()) {
    // Native platforms support file sharing
    return true;
  } else {
    // Check if Web Share API supports files
    if (typeof navigator !== 'undefined' && 'canShare' in navigator && 'share' in navigator) {
      try {
        // Test with a dummy file
        const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
        return navigator.canShare({ files: [testFile] });
      } catch {
        return false;
      }
    }
    return false;
  }
};
