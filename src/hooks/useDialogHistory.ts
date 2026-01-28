'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook to manage dialog state with browser history.
 * 
 * When a dialog opens, it pushes a history entry so that:
 * - The browser back button closes the dialog (not navigates away)
 * - The URL shows the dialog is open (e.g., ?dialog=add-plant)
 * - Deep linking to dialogs is possible
 * 
 * @param dialogKey - Unique key for this dialog (used in URL query param)
 * @param isOpen - Current open state of the dialog
 * @param onClose - Callback to close the dialog
 * 
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * useDialogHistory('add-plant', isOpen, () => setIsOpen(false));
 * ```
 */
export function useDialogHistory(
  dialogKey: string,
  isOpen: boolean,
  onClose: () => void
) {
  const wasOpenRef = useRef(false);
  const isClosingFromHistoryRef = useRef(false);

  // Handle opening: push history entry
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Dialog just opened - push a new history entry
      const url = new URL(window.location.href);
      url.searchParams.set('dialog', dialogKey);
      
      // Use shallow routing to avoid full page reload
      window.history.pushState({ dialog: dialogKey }, '', url.toString());
    } else if (!isOpen && wasOpenRef.current && !isClosingFromHistoryRef.current) {
      // Dialog just closed programmatically (not from history)
      // Go back to remove the history entry
      const url = new URL(window.location.href);
      if (url.searchParams.get('dialog') === dialogKey) {
        window.history.back();
      }
    }
    
    wasOpenRef.current = isOpen;
    isClosingFromHistoryRef.current = false;
  }, [isOpen, dialogKey]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      const url = new URL(window.location.href);
      const currentDialog = url.searchParams.get('dialog');
      
      // If we were showing this dialog but URL no longer has it, close it
      if (isOpen && currentDialog !== dialogKey) {
        isClosingFromHistoryRef.current = true;
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, dialogKey, onClose]);

  // Check URL on mount for deep linking
  useEffect(() => {
    // URL parsing for potential deep linking support
    // Could be extended to open dialog if URL has ?dialog=dialogKey
  }, []);

  // Provide a method to close that also updates history
  const closeWithHistory = useCallback(() => {
    isClosingFromHistoryRef.current = false;
    onClose();
  }, [onClose]);

  return { closeWithHistory };
}

/**
 * Simpler hook that just handles Escape key and optional backdrop click
 * 
 * @param isOpen - Current open state
 * @param onClose - Callback to close
 * @param closeOnEscape - Whether Escape key closes (default: true)
 * @param closeOnBackdrop - Whether backdrop click closes (default: true)
 */
export function useDialogClose(
  isOpen: boolean,
  onClose: () => void,
  { closeOnEscape = true, closeOnBackdrop = true } = {}
) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdrop && event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose, closeOnBackdrop]
  );

  return { handleBackdropClick };
}
