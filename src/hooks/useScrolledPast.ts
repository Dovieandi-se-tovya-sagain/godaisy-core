import { useEffect, useRef, useState } from 'react';

interface UseScrolledPastOptions {
  /** Root margin for IntersectionObserver (e.g., '-56px 0px 0px 0px'). Default: '0px' */
  rootMargin?: string;
  /** Threshold for intersection (0-1). Default: 0 */
  threshold?: number;
}

interface UseScrolledPastReturn<T extends HTMLElement> {
  /** Ref to attach to the element being observed */
  ref: React.RefObject<T | null>;
  /** True when the element has scrolled past (is no longer visible) */
  isScrolledPast: boolean;
}

/**
 * Hook to detect when an element has scrolled past the viewport.
 * Useful for triggering sticky headers or other scroll-based UI changes.
 *
 * @example
 * const { ref, isScrolledPast } = useScrolledPast<HTMLDivElement>();
 * return (
 *   <>
 *     <div ref={ref}>Hero content</div>
 *     {isScrolledPast && <StickyHeader />}
 *   </>
 * );
 */
export function useScrolledPast<T extends HTMLElement = HTMLElement>(
  options: UseScrolledPastOptions = {}
): UseScrolledPastReturn<T> {
  const { rootMargin = '0px', threshold = 0 } = options;
  const ref = useRef<T>(null);
  const [isScrolledPast, setIsScrolledPast] = useState(false);

  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined' || !ref.current) {
      return;
    }

    const element = ref.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Element is "scrolled past" when it's NOT intersecting
        setIsScrolledPast(!entry.isIntersecting);
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return { ref, isScrolledPast };
}
