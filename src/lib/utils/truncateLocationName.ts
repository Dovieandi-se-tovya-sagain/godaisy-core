/**
 * Truncates a location name for mobile display.
 * Breaks at comma boundaries to show the most specific location segment.
 *
 * @example
 * truncateLocationName('Pis, Colunga, Asturias, Spain') // 'Pis'
 * truncateLocationName('San Francisco, California, USA', 25) // 'San Francisco'
 * truncateLocationName('VeryLongCityNameWithNoCommas') // 'VeryLongCityNameWi…'
 *
 * @param location - The full location string
 * @param maxLength - Maximum character length (default: 20)
 * @returns Truncated location string
 */
export function truncateLocationName(
  location: string | null | undefined,
  maxLength: number = 20
): string {
  if (!location) return '';

  const trimmed = location.trim();

  // If already short enough, return as-is
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // Try to break at comma boundaries
  const segments = trimmed.split(',').map((s) => s.trim());

  // Start with the first segment (most specific location)
  if (segments[0] && segments[0].length <= maxLength) {
    return segments[0];
  }

  // If first segment is too long, truncate with ellipsis
  return trimmed.slice(0, maxLength - 1) + '…';
}
