import type * as React from 'react';

declare module 'react-hot-toast' {
  export type ToastHandler = (message: string, options?: Record<string, unknown>) => string;

  export interface ToastApi extends ToastHandler {
    success: ToastHandler;
    error: ToastHandler;
    dismiss: (toastId?: string) => void;
  }

  export const toast: ToastApi;

  export const Toaster: React.ComponentType<Record<string, unknown>>;
}
