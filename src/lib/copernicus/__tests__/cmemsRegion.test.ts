/**
 * Region assignment, which had a hole that hid for as long as the BLK job had existed.
 *
 * `getCmemsRegion` in ingest-copernicus-data.ts had no Black Sea box in its geographic fallback,
 * and its only grid caller passes the region name as `''` — so every name branch was dead and no
 * cell could ever be classified BLK. The ingestion workflow's BLK matrix job ran twice daily
 * against zero cells and reported success, which is why nothing surfaced it.
 *
 * The two rules below are the ones that were broken, plus the ordering trap that makes the
 * obvious fix a non-fix.
 */
import { cmemsRegionFromCoords, isBlackSea, BLACK_SEA_BOX } from '../cmemsRegion';

describe('CMEMS region assignment', () => {
  describe('the Black Sea is reachable at all', () => {
    // Sampled across the basin: Bulgarian shelf, Romanian shelf, Crimea, Georgian coast,
    // central abyssal plain, and the Kerch approach.
    it.each([
      ['Bulgarian shelf (Burgas)', 42.5, 27.9],
      ['Romanian shelf (Constanța)', 44.1, 29.0],
      ['Crimea, south coast', 44.4, 34.0],
      ['Georgian coast (Batumi)', 41.7, 41.6],
      ['central Black Sea', 43.5, 34.0],
      ['Kerch approach', 45.2, 36.5],
    ])('%s → BLK', (_label, lat, lon) => {
      expect(cmemsRegionFromCoords(lat, lon)).toBe('BLK');
    });
  });

  describe('the ordering trap', () => {
    it('BLK wins over MED where the two boxes overlap', () => {
      // The MED box is lat 30–46, lon -6–36, so it covers most of the Black Sea. A BLK box
      // added AFTER it is shadowed for every cell south of 46°N and west of 36°E — 151 of the
      // 323 Black Sea cells in the grid. This coordinate is inside both boxes.
      const lat = 43.5, lon = 33.0;
      const insideMedBox = lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36;
      expect(insideMedBox).toBe(true);
      expect(cmemsRegionFromCoords(lat, lon)).toBe('BLK');
    });
  });

  describe('the margins stay where they are already served', () => {
    it.each([
      ['Sea of Marmara', 40.7, 28.0],
      ['Dardanelles', 40.4, 26.4],
      ['north Aegean', 40.0, 25.0],
    ])('%s stays MED, not BLK', (_label, lat, lon) => {
      // Measured 2026-08-13: the 22 grid cells in this zone carry `copernicus-MED` in
      // grid_conditions_latest.sources, so MEDSEA serves them today. Routing them at a product
      // that may not cover them would trade working data for a guess — and there is no
      // regional→GLOBAL fallback to catch it.
      expect(cmemsRegionFromCoords(lat, lon)).toBe('MED');
    });

    it('the Bulgarian shelf is not sacrificed to keep Marmara out', () => {
      // A naive `lon >= 29` cut would exclude Marmara but also throw away the Bulgarian coast,
      // which sits at the same longitudes and is unambiguously Black Sea. Latitude separates
      // them: Marmara is below 41°N, the Bulgarian shelf above 42°N.
      expect(cmemsRegionFromCoords(42.5, 27.9)).toBe('BLK');
      expect(cmemsRegionFromCoords(40.7, 27.9)).toBe('MED');
    });

    it('northern Azov is left outside the box', () => {
      // The BLKSEA domain fades out here. Unverified margins are ceded rather than claimed.
      expect(cmemsRegionFromCoords(47.0, 38.0)).not.toBe('BLK');
    });
  });

  describe('regions that must not move', () => {
    it.each([
      ['west Mediterranean', 40.0, 5.0, 'MED'],
      ['Aegean', 37.5, 25.0, 'MED'],
      ['east Mediterranean (Cyprus)', 34.5, 33.0, 'MED'],
      ['Baltic', 58.0, 20.0, 'BAL'],
      ['North Sea', 55.0, 3.0, 'NWS'],
      ['Biscay', 47.0, -6.0, 'IBI'],
      ['Arctic', 75.0, 20.0, 'ARC'],
      ['Americas', 40.0, -70.0, 'GLO_AM'],
      ['Asia-Pacific', 35.0, 140.0, 'GLO_AP'],
      ['Indian Ocean', -10.0, 60.0, 'GLO_AF'],
    ])('%s → %s', (_label, lat, lon, expected) => {
      expect(cmemsRegionFromCoords(lat, lon)).toBe(expected);
    });

    it('Cyprus and Batumi share a latitude but not a region', () => {
      // Guards against a BLK box widened westward or southward in a later edit: both are near
      // 34–35°N, and only one of them is Black Sea.
      expect(cmemsRegionFromCoords(34.5, 33.0)).toBe('MED');
      expect(cmemsRegionFromCoords(41.7, 41.6)).toBe('BLK');
    });
  });

  describe('splitGlobal', () => {
    it('collapses the GLO buckets for fix-rectangle-data', () => {
      // That script stores 'GLO'; the ingestion scripts need the longitude split their CI
      // matrix schedules on. Changing its stored values would be a data migration.
      expect(cmemsRegionFromCoords(40.0, -70.0, { splitGlobal: false })).toBe('GLO');
      expect(cmemsRegionFromCoords(35.0, 140.0, { splitGlobal: false })).toBe('GLO');
      expect(cmemsRegionFromCoords(-10.0, 60.0, { splitGlobal: false })).toBe('GLO');
    });

    it('does not change the named regions', () => {
      expect(cmemsRegionFromCoords(43.5, 34.0, { splitGlobal: false })).toBe('BLK');
      expect(cmemsRegionFromCoords(40.0, 5.0, { splitGlobal: false })).toBe('MED');
    });
  });

  describe('isBlackSea agrees with the box it is derived from', () => {
    it('is inclusive at every edge', () => {
      const b = BLACK_SEA_BOX;
      expect(isBlackSea(b.latMin, b.lonMin)).toBe(true);
      expect(isBlackSea(b.latMax, b.lonMax)).toBe(true);
      expect(isBlackSea(b.latMin - 0.01, b.lonMin)).toBe(false);
      expect(isBlackSea(b.latMax + 0.01, b.lonMax)).toBe(false);
    });
  });
});
