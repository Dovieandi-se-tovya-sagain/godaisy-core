/**
 * Pull to Refresh Component
 *
 * Enables native-feeling pull-to-refresh gesture on iOS and Android.
 * Works in both native Capacitor apps and mobile web browsers.
 *
 * Usage:
 * Wrap your content with <PullToRefresh> in _app.tsx or individual pages.
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

interface PullToRefreshProps {
  children: React.ReactNode;
  /** Custom refresh handler. If not provided, refreshes the current page */
  onRefresh?: () => Promise<void>;
  /** Threshold in pixels to trigger refresh (default: 80) */
  threshold?: number;
  /** Disable pull to refresh (useful for pages with their own scroll handling) */
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  threshold = 80,
  disabled = false,
}) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Check if we're at the top of the page
  const isAtTop = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.scrollY <= 0;
  }, []);

  // Default refresh action - reload the page
  const defaultRefresh = useCallback(async () => {
    // Use router.replace to refresh without full page reload
    await router.replace(router.asPath, undefined, { scroll: false });
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await defaultRefresh();
      }
    } catch (error) {
      console.error('[PullToRefresh] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh, defaultRefresh]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (!isAtTop()) return;

    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing, isAtTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || !isPulling) return;
    if (!isAtTop()) {
      setPullDistance(0);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;

    if (distance > 0) {
      // Apply resistance - pull distance diminishes as you pull further
      const resistedDistance = Math.min(distance * 0.4, threshold * 1.5);
      setPullDistance(resistedDistance);

      // Prevent default scroll when pulling down at top
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [disabled, isRefreshing, isPulling, isAtTop, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || isRefreshing) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, pullDistance, threshold, handleRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false to allow preventDefault on touchmove
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Reset pull distance when route changes
  useEffect(() => {
    setPullDistance(0);
    setIsRefreshing(false);
  }, [router.asPath]);

  const showIndicator = pullDistance > 10 || isRefreshing;
  const isReady = pullDistance >= threshold;

  return (
    <div ref={containerRef} className="pull-to-refresh-container min-h-screen">
      {/* Pull indicator */}
      <div
        className="fixed left-0 right-0 flex justify-center items-center z-50 pointer-events-none transition-all duration-200"
        style={{
          top: 0,
          height: showIndicator ? `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px` : 0,
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full bg-base-100 shadow-lg border border-base-300 transition-transform duration-200 ${
            isReady && !isRefreshing ? 'scale-110' : ''
          }`}
          style={{
            transform: `translateY(${showIndicator ? '8px' : '-40px'}) rotate(${isRefreshing ? 0 : pullDistance * 2}deg)`,
          }}
        >
          {isRefreshing ? (
            <span className="loading loading-spinner loading-sm text-primary" />
          ) : (
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${isReady ? 'text-primary' : 'text-base-content/60'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{
                transform: isReady ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance}px)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
