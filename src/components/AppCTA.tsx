"use client";
import React from 'react';

interface AppCTAProps {
  deepLinkPath: string; // path appended to scheme, e.g. 'species/dicentrarchus-labrax'
}

export default function AppCTA({ deepLinkPath }: AppCTAProps) {
  const isBrowser = typeof window !== 'undefined';

  const detectPlatform = () => {
    if (!isBrowser) return { isAndroid: false, isPWA: false };
    const ua = navigator.userAgent || '';
    const isAndroid = /android/i.test(ua);
    const isPWA = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || ((navigator as unknown) && (navigator as unknown as { standalone?: boolean }).standalone === true);
    return { isAndroid, isPWA };
  };

  const { isAndroid } = detectPlatform();

  const openDeepLink = () => {
    if (!isBrowser) return;
    const scheme = `godaisy://${deepLinkPath}`;
    const start = Date.now();
    window.location.href = scheme;

    const fallbackIOS = 'https://apps.apple.com/search?term=findr';
    const fallbackAndroid = 'https://play.google.com/store/search?q=findr&c=apps';

    const t = setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.location.href = isAndroid ? fallbackAndroid : fallbackIOS;
      }
    }, 900);

    setTimeout(() => clearTimeout(t), 3000);
  };

  return (
    <div className="mb-4">
      <div className="card bg-base-100 p-3 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Open in the Findr app</div>
            <div className="text-sm text-base-content/70">Open this page in the native app for a richer experience and faster access to offline features.</div>
          </div>

          <div className="flex gap-2">
            <button onClick={openDeepLink} className="btn btn-primary">Open in app</button>
            <a href="https://apps.apple.com/search?term=findr" target="_blank" rel="noopener noreferrer" className="btn btn-outline">App Store</a>
            <a href="https://play.google.com/store/search?q=findr&c=apps" target="_blank" rel="noopener noreferrer" className="btn btn-outline">Google Play</a>
          </div>
        </div>
      </div>
    </div>
  );
}
