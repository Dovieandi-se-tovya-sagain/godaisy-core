/**
 * useImageCompression Hook
 * 
 * Manages image compression state for upload workflows.
 * Provides two-step UI feedback: "Compressing..." → "Uploading..."
 * Displays file size context and savings on completion.
 */

import { useState, useCallback } from 'react';
import {
  compressForUpload,
  formatFileSize,
  getSavingsText,
  getCompressionMessage,
  type CompressionResult,
  type CompressionOptions,
} from '@/lib/image/compressForUpload';

export type CompressionStatus = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

export interface UseImageCompressionState {
  status: CompressionStatus;
  originalSize: number | null;
  compressedSize: number | null;
  error: string | null;
  statusMessage: string;
  savingsText: string | null;
}

export interface UseImageCompressionReturn extends UseImageCompressionState {
  compress: (file: File, options?: CompressionOptions) => Promise<CompressionResult>;
  setUploading: () => void;
  setSuccess: () => void;
  setError: (message: string) => void;
  reset: () => void;
  isProcessing: boolean;
}

const initialState: UseImageCompressionState = {
  status: 'idle',
  originalSize: null,
  compressedSize: null,
  error: null,
  statusMessage: '',
  savingsText: null,
};

/**
 * Hook for managing image compression workflow with UI state
 * 
 * @example
 * ```tsx
 * const { compress, setUploading, setSuccess, status, statusMessage, savingsText } = useImageCompression();
 * 
 * const handleUpload = async (file: File) => {
 *   try {
 *     const result = await compress(file);
 *     setUploading();
 *     await uploadToServer(result.file);
 *     setSuccess();
 *     // Show savingsText: "12.5MB → 2.1MB"
 *   } catch (error) {
 *     // Error handled by hook
 *   }
 * };
 * ```
 */
export function useImageCompression(): UseImageCompressionReturn {
  const [state, setState] = useState<UseImageCompressionState>(initialState);

  const compress = useCallback(async (
    file: File,
    options?: CompressionOptions
  ): Promise<CompressionResult> => {
    const originalSize = file.size;
    const compressionMessage = getCompressionMessage(originalSize);

    setState({
      status: 'compressing',
      originalSize,
      compressedSize: null,
      error: null,
      statusMessage: compressionMessage,
      savingsText: null,
    });

    try {
      const result = await compressForUpload(file, options);
      
      setState(prev => ({
        ...prev,
        status: 'compressing', // Still compressing until setUploading called
        compressedSize: result.compressedSize,
        savingsText: getSavingsText(result),
        statusMessage: `Compressed to ${formatFileSize(result.compressedSize)}`,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compression failed';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        statusMessage: errorMessage,
      }));
      throw error;
    }
  }, []);

  const setUploading = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'uploading',
      statusMessage: 'Uploading...',
    }));
  }, []);

  const setSuccess = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'success',
      statusMessage: prev.savingsText 
        ? `Uploaded! (${prev.savingsText})`
        : 'Uploaded successfully!',
    }));
  }, []);

  const setError = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      status: 'error',
      error: message,
      statusMessage: message,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const isProcessing = state.status === 'compressing' || state.status === 'uploading';

  return {
    ...state,
    compress,
    setUploading,
    setSuccess,
    setError,
    reset,
    isProcessing,
  };
}

export { formatFileSize, getSavingsText, getCompressionMessage };
