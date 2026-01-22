import { useEffect, useRef, useState } from 'react';

interface UseLazyBackgroundOptions {
  /**
   * Root margin for Intersection Observer (default: '50px')
   * Positive values load images before they enter viewport
   */
  rootMargin?: string;
  /**
   * Threshold for Intersection Observer (default: 0.01)
   * 0 = load as soon as any pixel is visible
   * 1 = load only when fully visible
   */
  threshold?: number;
}

/**
 * Hook for lazy loading background images using Intersection Observer
 *
 * @example
 * ```tsx
 * const { ref, loaded } = useLazyBackground();
 *
 * <div
 *   ref={ref}
 *   style={{
 *     backgroundImage: loaded ? `url(${imageUrl})` : 'none'
 *   }}
 * />
 * ```
 */
export function useLazyBackground(options: UseLazyBackgroundOptions = {}) {
  const {
    rootMargin = '50px',
    threshold = 0.01
  } = options;

  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If Intersection Observer is not supported, load immediately
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setLoaded(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [rootMargin, threshold]);

  return { ref, loaded };
}

/**
 * Hook variant that returns the background image style directly
 *
 * @example
 * ```tsx
 * const { ref, backgroundStyle } = useLazyBackgroundStyle(imageUrl);
 *
 * <div ref={ref} style={backgroundStyle} />
 * ```
 */
export function useLazyBackgroundStyle(
  imageUrl: string,
  options: UseLazyBackgroundOptions = {}
) {
  const { ref, loaded } = useLazyBackground(options);

  const backgroundStyle = {
    backgroundImage: loaded ? `url(${imageUrl})` : 'none',
    backgroundColor: loaded ? 'transparent' : '#e5e7eb', // gray-200 placeholder
  };

  return { ref, loaded, backgroundStyle };
}
