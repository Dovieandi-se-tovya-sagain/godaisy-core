import React, { useMemo } from 'react';
import { ArrowUpToLine, ArrowDownToLine, Anchor } from 'lucide-react';

interface TideSummaryCardProps {
  nextHighIso?: string | null;
  nextLowIso?: string | null;
  nextHighHeightM?: number | null;
  nextLowHeightM?: number | null;
}

function formatDisplayTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

function formatRelativeTime(isoString?: string): string | undefined {
  if (!isoString) return undefined;
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) return 'passed';
    if (diffHours === 0) return `in ${diffMinutes}min`;
    if (diffHours < 24) return `in ${diffHours}h ${diffMinutes}min`;
    const days = Math.floor(diffHours / 24);
    return `in ${days}d ${diffHours % 24}h`;
  } catch {
    return undefined;
  }
}

function formatTideHeight(heightM?: number | null): string {
  if (heightM == null) return '—';
  return `${heightM.toFixed(1)}m`;
}

export function TideSummaryCard({
  nextHighIso,
  nextLowIso,
  nextHighHeightM,
  nextLowHeightM
}: TideSummaryCardProps) {
  const highLabel = formatDisplayTime(nextHighIso ?? undefined);
  const highRelative = formatRelativeTime(nextHighIso ?? undefined);
  const lowLabel = formatDisplayTime(nextLowIso ?? undefined);
  const lowRelative = formatRelativeTime(nextLowIso ?? undefined);

  const headline = useMemo(() => {
    if (highRelative && highRelative !== 'passed') return `High tide ${highRelative}`;
    if (lowRelative && lowRelative !== 'passed') return `Low tide ${lowRelative}`;
    return 'Tide data';
  }, [highRelative, lowRelative]);

  const footerText = useMemo(() => {
    const parts = [];
    if (nextHighHeightM != null) parts.push(`High: ${formatTideHeight(nextHighHeightM)}`);
    if (nextLowHeightM != null) parts.push(`Low: ${formatTideHeight(nextLowHeightM)}`);
    return parts.length > 0 ? parts.join(' • ') : undefined;
  }, [nextHighHeightM, nextLowHeightM]);

  return (
    <div className="card weather-card-bg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Anchor className="w-5 h-5 text-white" />
        <h3 className="card__header-title text-white text-lg font-semibold">Tides</h3>
      </div>

      <div className="mb-3">
        <p className="text-white text-sm font-medium">{headline}</p>
        {footerText && <p className="text-white/70 text-xs mt-1">{footerText}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-white/10 border border-white/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1 text-sm text-white">
              <ArrowUpToLine className="w-3 h-3 text-blue-300" />
              High
            </span>
            {nextHighHeightM != null && (
              <span className="badge badge-ghost badge-xs text-white/80">
                {formatTideHeight(nextHighHeightM)}
              </span>
            )}
          </div>
          <p className="text-white/90 text-sm">{highLabel}</p>
          {highRelative && highRelative !== 'passed' && (
            <p className="text-white/60 text-xs">{highRelative}</p>
          )}
        </div>

        <div className="p-3 rounded-lg bg-white/10 border border-white/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1 text-sm text-white">
              <ArrowDownToLine className="w-3 h-3 text-orange-300" />
              Low
            </span>
            {nextLowHeightM != null && (
              <span className="badge badge-ghost badge-xs text-white/80">
                {formatTideHeight(nextLowHeightM)}
              </span>
            )}
          </div>
          <p className="text-white/90 text-sm">{lowLabel}</p>
          {lowRelative && lowRelative !== 'passed' && (
            <p className="text-white/60 text-xs">{lowRelative}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TideSummaryCard;
