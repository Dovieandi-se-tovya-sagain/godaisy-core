/**
 * Bottom temperature routing, which had no test and one silent hole.
 *
 * The variable rides along on a call the fetcher already makes — see the comment above `bottomTemp`
 * in realClient. That makes the routing easy to get wrong in a way nothing notices: name a dataset
 * that does not carry the variable and the WHOLE call fails, or omit the config and the region
 * quietly returns nothing forever. NWS did the latter, reading 0 of 800 cells against BAL's 640 of
 * 707, and it took a coverage audit months later to see it.
 *
 * These tests encode the two rules that hole broke.
 */
import { getDatasetForCmemsRegion } from '../regionRouter';

/**
 * CMEMS splits its physics products. A `-mld` product carries `mlotst` and nothing else; a `-thetao`
 * product carries temperature and no bottom field. Only the COMBINED 2D physics products carry
 * `tob` alongside `mlotst`, so a `mixedLayerDepth`-sourced bottom temperature is only satisfiable
 * from one of those.
 */
const isSplitProduct = (dataset: string) => /-(mld|thetao|so|cur)[_-]/.test(dataset);

const CMEMS_REGIONS = ['BAL', 'MED', 'BLK', 'IBI', 'NWS', 'ARC', 'GLO'] as const;

describe('bottom temperature routing', () => {
  it('NWS routes bottom temperature, having previously routed none', () => {
    const cfg = getDatasetForCmemsRegion('NWS');
    expect(cfg).not.toBeNull();
    // The regression this file exists for. NWS is the UK shelf: 800 grid cells, and the place
    // demersal species are most worth predicting.
    expect(cfg!.bottomTemperature).toBeDefined();
  });

  it.each(CMEMS_REGIONS)(
    '%s does not ask a split product for a variable it cannot carry',
    (region) => {
      const cfg = getDatasetForCmemsRegion(region);
      if (!cfg?.bottomTemperature) return; // a region may legitimately have none

      const { source, variable } = cfg.bottomTemperature;
      const dataset = source === 'physics' ? cfg.physics : cfg.mixedLayerDepth;
      expect(dataset).toBeDefined();

      // Asking a product for a variable it lacks fails the entire call, taking the surface reading
      // down with it — so this is not a cosmetic mismatch.
      expect(isSplitProduct(dataset!)).toBe(false);

      // The two spellings are not interchangeable: regional physics products call it `bottomT`,
      // GLO's combined product calls it `tob`.
      expect(['bottomT', 'tob']).toContain(variable);
    },
  );

  it('BAL still reads bottom temperature from its bundled regional physics', () => {
    // The comparison case that made NWS's zero visible, pinned so a future NWS fix cannot quietly
    // regress the region that already worked.
    const cfg = getDatasetForCmemsRegion('BAL');
    expect(cfg!.bottomTemperature).toEqual({ source: 'physics', variable: 'bottomT' });
  });

  it('every configured region still returns a physics dataset', () => {
    for (const region of CMEMS_REGIONS) {
      const cfg = getDatasetForCmemsRegion(region);
      expect(cfg?.physics).toBeTruthy();
    }
  });
});
