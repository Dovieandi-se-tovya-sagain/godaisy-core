import { useEffect, useState } from 'react';

/**
 * BeforeInstallPrompt event interface
 * This event is fired when the browser determines the app is installable
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Platform detection result
 */
interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isStandalone: boolean;
  isInstallable: boolean;
}

/**
 * Detects platform for install instructions
 */
const detectPlatform = (): PlatformInfo => {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isStandalone: false,
      isInstallable: false,
    };
  }

  const ua = window.navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return {
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isStandalone,
    isInstallable: (isAndroid && isChrome) || (isIOS && isSafari),
  };
};

/**
 * Hook to manage PWA installation prompt
 *
 * Features:
 * - Captures BeforeInstallPrompt event (Chrome/Edge on Android/Desktop)
 * - Detects iOS Safari (manual instructions needed)
 * - Tracks install state (installed, dismissed, pending)
 * - Persists dismissal to localStorage
 *
 * Usage:
 * ```tsx
 * const { showPrompt, installApp, dismissPrompt, platform } = useInstallPrompt();
 *
 * if (showPrompt) {
 *   return <button onClick={installApp}>Install App</button>
 * }
 * ```
 */
export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<PlatformInfo>(detectPlatform());

  useEffect(() => {
    const platformInfo = detectPlatform();
    setPlatform(platformInfo);

    // Don't show prompt if already in standalone mode (already installed)
    if (platformInfo.isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Check if user previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissal = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

      // Show again after 7 days
      if (daysSinceDismissal < 7) {
        setShowPrompt(false);
        return;
      }
    }

    // For iOS Safari, show custom instructions
    if (platformInfo.isIOS && platformInfo.isSafari) {
      setShowPrompt(true);
      return;
    }

    // For Chrome/Edge on Android/Desktop, capture BeforeInstallPrompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was installed
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-install-dismissed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * Trigger the native install prompt (Chrome/Edge only)
   */
  const installApp = async () => {
    if (!deferredPrompt) {
      console.warn('No deferred prompt available');
      return;
    }

    try {
      // Show the native install prompt
      await deferredPrompt.prompt();

      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setShowPrompt(false);
      } else {
        console.log('User dismissed the install prompt');
        dismissPrompt();
      }

      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  /**
   * User dismissed the install prompt
   * Don't show again for 7 days
   */
  const dismissPrompt = () => {
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    setShowPrompt(false);
  };

  return {
    showPrompt,
    installApp,
    dismissPrompt,
    platform,
    canInstall: !!deferredPrompt || (platform.isIOS && platform.isSafari),
  };
};
