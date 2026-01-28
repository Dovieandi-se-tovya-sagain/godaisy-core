import { useState, useEffect } from 'react';

/**
 * Hook to detect user's reduced motion preference.
 * Returns true if the user prefers reduced motion.
 * 
 * Usage:
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * 
 * return (
 *   <div className={prefersReducedMotion ? 'opacity-100' : 'animate-sprout'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Set initial value
    setPrefersReduced(mediaQuery.matches);

    // Listen for changes (user might toggle setting while using app)
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  return prefersReduced;
}

/**
 * SSR-safe version that defaults to reduced motion on server.
 * Use this when you need a value before hydration.
 */
export function useReducedMotionSafe(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(true); // Default to reduced for SSR

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  return prefersReduced;
}
