"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  FALLBACK_RECTANGLE_OPTIONS as RAW_FALLBACK_RECTANGLE_OPTIONS,
  type FallbackRectangleOption,
} from '../lib/findr/fallbackRectangles';

export interface RectangleOption {
  code: string;
  label: string;
  region: string;
  centerLat: number;
  centerLon: number;
  distanceToShoreKm?: number;
}

interface ApiRectangleOption {
  code?: string;
  label?: string;
  region?: string | null;
  centerLat?: number;
  centerLon?: number;
  distanceToShoreKm?: number | null;
}

interface RectangleOptionsResponsePayload {
  options?: ApiRectangleOption[];
  count?: number;
}

export interface RectangleOptionsState {
  options: RectangleOption[];
  loading: boolean;
  error: string | null;
  isFallback: boolean;
}

function parseOptionNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeApiRectangleOption(input: ApiRectangleOption): RectangleOption | null {
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (!code) return null;

  const centerLat = parseOptionNumber(input.centerLat);
  const centerLon = parseOptionNumber(input.centerLon);

  if (centerLat === undefined || centerLon === undefined) {
    return null;
  }

  const labelSource = typeof input.label === 'string' && input.label.trim() ? input.label.trim() : undefined;
  const region = typeof input.region === 'string' && input.region.trim().length > 0 ? input.region.trim() : labelSource ?? 'Unknown region';
  const distanceToShoreKm = parseOptionNumber(input.distanceToShoreKm);

  return {
    code,
    label: region,
    region,
    centerLat,
    centerLon,
    distanceToShoreKm,
  } satisfies RectangleOption;
}


export const FALLBACK_RECTANGLE_OPTIONS: RectangleOption[] = RAW_FALLBACK_RECTANGLE_OPTIONS.map(
  (option: FallbackRectangleOption) => ({
    ...option,
  })
);

export function useFindrRectangleOptions(fallback: RectangleOption[]): RectangleOptionsState {
  const [options, setOptions] = useState<RectangleOption[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/findr/rectangles', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed to load rectangle options (status ${response.status})`);
        }

        const payload = (await response.json()) as RectangleOptionsResponsePayload;
        const remote = Array.isArray(payload?.options) ? payload.options : [];
        const normalized = remote
          .map((option) => normalizeApiRectangleOption(option))
          .filter((option): option is RectangleOption => option !== null)
          .sort((a, b) => a.code.localeCompare(b.code));

        if (!active) return;

        if (normalized.length > 0) {
          setOptions(normalized);
          setIsFallback(false);
          setError(null);
        } else {
          setOptions(fallback);
          setIsFallback(true);
          setError(null);
        }
      } catch (err) {
        if (!active) return;
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setOptions(fallback);
        setIsFallback(true);
        setError((err as Error).message || 'Failed to load rectangle options');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [fallback]);

  return useMemo(
    () => ({
      options,
      loading,
      error,
      isFallback,
    }),
    [error, isFallback, loading, options]
  );
}
