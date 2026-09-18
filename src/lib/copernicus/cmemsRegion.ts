/**
 * Which CMEMS regional model covers a coordinate.
 *
 * This existed as three hand-copied blocks — in `ingest-copernicus-data.ts`,
 * `trim-grid-density.ts` and `fix-rectangle-data.ts` — which drifted apart. `trim-grid-density`
 * carried a Black Sea box under a comment claiming it "matches ingest-copernicus-data.ts"; the
 * ingest copy had no Black Sea box at all, so no grid cell was ever classified BLK and the
 * ingestion workflow's BLK matrix job processed zero cells twice daily from the day it was added.
 *
 * Only the geographic half lives here. Each caller keeps its own region-NAME matching, because
 * those genuinely differ: the ingest path passes an empty string (making its name branches dead
 * code), while `fix-rectangle-data` passes real ICES region names and relies on them.
 */

/** Regions with a dedicated CMEMS model, plus the longitude-split GLOBAL scheduling buckets. */
export type CmemsRegion = 'ARC' | 'BLK' | 'MED' | 'BAL' | 'NWS' | 'IBI' | 'GLO' | 'GLO_AM' | 'GLO_AP' | 'GLO_AF';

/**
 * The Black Sea, deliberately tighter than the basin's full extent.
 *
 * Getting a region wrong is not a soft failure. The dataset is fixed when the provider is
 * constructed, there is no regional→GLOBAL fallback, and fetch errors are swallowed — so a cell
 * routed at a product that does not cover it loses everything, silently. These bounds therefore
 * cede the margins to whichever product is already serving them:
 *
 * - `lat >= 41.0` leaves the Sea of Marmara and the Dardanelles with MED. All 22 such cells in
 *   the grid sit between 40.38°N and 40.88°N, and MEDSEA demonstrably serves them today
 *   (measured 2026-08-13: they carry `copernicus-MED` in `grid_conditions_latest.sources`).
 *   It still admits the Bulgarian shelf at 42–43°N, 27.5–28.5°E, which is genuine Black Sea and
 *   would be lost to a naive `lon >= 29` cut.
 * - `lat <= 46.9` stops short of the northern Sea of Azov, which is at the edge of the BLKSEA
 *   domain. The 38 cells above 46.5°N are the least certain part of this box and the first
 *   place to look if Black Sea coverage drops after a run.
 */
export const BLACK_SEA_BOX = { latMin: 41.0, latMax: 46.9, lonMin: 27.4, lonMax: 42.0 } as const;

export function isBlackSea(lat: number, lon: number): boolean {
  const b = BLACK_SEA_BOX;
  return lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;
}

/**
 * @param splitGlobal `true` (the ingestion default) returns the longitude-split GLO_AM/GLO_AP/
 *                    GLO_AF buckets the CI matrix schedules on. `false` returns a single 'GLO',
 *                    which is what `fix-rectangle-data` stores — do not change that without
 *                    migrating the values already in its table.
 */
export function cmemsRegionFromCoords(
  lat: number,
  lon: number,
  { splitGlobal = true }: { splitGlobal?: boolean } = {},
): CmemsRegion {
  if (lat > 66) return 'ARC';

  // BLK is tested BEFORE MED and must stay that way. The MED box below reaches 46°N and 36°E
  // and so covers most of the Black Sea: a BLK box placed after it is shadowed for every cell
  // south of 46°N and west of 36°E, which is 151 of the 323 Black Sea cells in the grid.
  if (isBlackSea(lat, lon)) return 'BLK';

  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) return 'MED';
  if (lat >= 53 && lat <= 66 && lon >= 10 && lon <= 30) return 'BAL';
  if (lat >= 48 && lat <= 63 && lon >= -12 && lon <= 13) return 'NWS';
  if (lat >= 36 && lat <= 54 && lon >= -20 && lon <= -5) return 'IBI';

  if (!splitGlobal) return 'GLO';
  if (lon <= -30) return 'GLO_AM';
  if (lon >= 90) return 'GLO_AP';
  return 'GLO_AF';
}
