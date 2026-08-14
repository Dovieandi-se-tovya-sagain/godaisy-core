/**
 * Copernicus Regional Model Router
 * 
 * Maps ICES rectangle regions to appropriate Copernicus Marine datasets.
 * Different regions require different regional models for accurate data.
 */

export interface CopernicusDatasetConfig {
  physics: string;  // Main physics dataset (or temperature for split datasets)
  salinity?: string;  // Separate salinity dataset (for Mediterranean)
  currents?: string;  // Separate currents dataset (for Mediterranean)
  mixedLayerDepth?: string;  // 2D physics dataset for mlotst (thermocline depth)
  // Where sea-bed temperature comes from. It is never its own request — it rides as an
  // extra --variable on a call already being made, so `source` says which one and
  // `variable` says what it is called there. Asking a product for a variable it does
  // not have fails the whole call, so this is set only where the dataset this repo
  // actually requests was confirmed to carry it (`copernicusmarine describe`,
  // 2026-08-11):
  //
  //   BAL / IBI / ARC  physics carries `bottomT`   → source: 'physics'
  //   GLO              the split thetao product has no bottom field, but the combined
  //                    product already fetched for mlotst carries `tob`
  //   NWS              physics is GLO's split thetao (no bottom field) and its MLD
  //                    product is mlotst-only — no bottom temperature available
  //   MED / BLK        physics carries `bottomT`   → source: 'physics'. The dataset ids
  //                    below are the split single-variable "-tem"/"-temp" datasets
  //                    (verified live via the CMEMS STAC catalogue, 2026-08-14), not the
  //                    old bundled "Daily" ids these two regions used to carry. Those
  //                    bundled ids were retired when CMEMS split MED/BLK physics into
  //                    per-variable datasets; requesting them still intermittently
  //                    resolved an old, superseded dataset version instead of failing
  //                    clean, which is why `describe` could never confirm the variable
  //                    list against them and why ~50% of MED/BLK cell fetches were
  //                    silently falling back to GLOBAL and losing bottom temperature.
  //                    BAL/IBI/ARC's bundled ids were never split and remain current, so
  //                    they don't need this.
  bottomTemperature?: { source: 'physics' | 'mixedLayerDepth'; variable: 'bottomT' | 'tob' };
  biogeochemistry: string;
  planktonFunctionalTypes?: string;  // PFT dataset for phytoplankton carbon (phyc)
  zooplankton?: string;  // Plankton dataset for zooplankton carbon (zooc)
  nutrients?: string;  // Separate nutrients dataset (no3, po4, si, fe) for split BGC models
  carbonateChemistry?: string;  // Separate carbonate dataset (ph) for split BGC models
  transparency?: string;  // Satellite ocean color transparency (kd490)
  waves: string;
  region: string;
  coverage: string;
}

/**
 * Get dataset configuration directly from CMEMS region code (IBI, NWS, BAL, MED, BLK, ARC, GLO)
 * This is the preferred method when rectangles are pre-mapped to CMEMS regions
 *
 * DECISION (2025-01-05): Switched from GLO to regional products after GLO showed 0% success rate
 * for coastal rectangles. See docs/COPERNICUS_GLO_TO_REGIONAL_DECISION.md for rationale.
 * Regional products provide better resolution (2-4.5x) and coastal coverage.
 */
export function getDatasetForCmemsRegion(cmemsRegion: string): CopernicusDatasetConfig | null {
  const region = cmemsRegion.toUpperCase();

  // Use regional datasets for better coastal coverage and resolution
  switch (region) {
    case 'BAL':
      return {
        physics: 'cmems_mod_bal_phy_anfc_P1D-m',
        mixedLayerDepth: 'cmems_mod_bal_phy_anfc_P1D-m', // BAL bundled physics includes mlotst
        bottomTemperature: { source: 'physics', variable: 'bottomT' },
        biogeochemistry: 'cmems_mod_bal_bgc_anfc_P1D-m',
        planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        transparency: 'cmems_obs-oc_bal_bgc-transp_nrt_l3-olci-300m_P1D',
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i', // Baltic has no wave product, use GLO
        region: 'Baltic Sea',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST',
      };
    case 'MED':
      return {
        // Fixed 2026-08-14: was 'cmems_mod_med_phy_anfc_4.2km_P1D-m', the retired bundled
        // "Daily" id. CMEMS split MED physics into single-variable datasets; that id 404s
        // against the live STAC catalogue and only intermittently resolved an old,
        // superseded dataset version (worker logs showed "Selected dataset version:
        // 202406" against a catalogue now on 202511), which is why ~50% of MED cell
        // fetches were silently falling back to GLOBAL and losing bottom temperature.
        // `cmems_mod_med_phy-tem_anfc_4.2km_P1D-m` is the current split temperature
        // dataset — verified live, carries both `thetao` and `bottomT`.
        physics: 'cmems_mod_med_phy-tem_anfc_4.2km_P1D-m',
        mixedLayerDepth: 'cmems_mod_med_phy-mld_anfc_4.2km_P1D-m', // MED dedicated MLD product
        // Routed 2026-08-12, re-confirmed 2026-08-14 against the split dataset above.
        bottomTemperature: { source: 'physics', variable: 'bottomT' },
        biogeochemistry: 'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m', // Fixed: added -bio suffix, changed resolution
        planktonFunctionalTypes: 'cmems_mod_med_bgc-pft_anfc_4.2km_P1D-m', // Med has its own PFT product
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        nutrients: 'cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m', // MED split: no3, po4, si, fe
        carbonateChemistry: 'cmems_mod_med_bgc-car_anfc_4.2km_P1D-m', // MED split: ph, spco2, talk
        transparency: 'cmems_obs-oc_med_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i', // Med has no wave product, use GLO
        region: 'Mediterranean Sea',
        coverage: 'MEDSEA_ANALYSIS_FORECAST',
      };
    case 'BLK':
      return {
        // Fixed 2026-08-14: was 'cmems_mod_blk_phy_anfc_2.5km_P1D-m', the retired bundled
        // "Daily" id — same catalogue split as MED, same silent-fallback symptom. Note the
        // naming is NOT consistent with MED's: BLK's split temperature dataset is
        // "-temp", not "-tem". Verified live, carries both `thetao` and `bottomT`.
        physics: 'cmems_mod_blk_phy-temp_anfc_2.5km_P1D-m',
        // BLK's MLD is also split out now — the old bundled id no longer carries mlotst.
        mixedLayerDepth: 'cmems_mod_blk_phy-mld_anfc_2.5km_P1D-m',
        // Routed 2026-08-12 alongside MED, which had the same gap. Re-pointed 2026-08-14 to the
        // split -temp dataset, which still bundles bottomT with thetao.
        bottomTemperature: { source: 'physics', variable: 'bottomT' },
        biogeochemistry: 'cmems_mod_blk_bgc_anfc_2.5km_P1D-m',
        planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        transparency: 'cmems_obs-oc_blk_bgc-transp_nrt_l3-multi-1km_P1D',
        waves: 'cmems_mod_blk_wav_anfc_2.5km_PT1H-i',
        region: 'Black Sea',
        coverage: 'BLKSEA_ANALYSIS_FORECAST',
      };
    case 'IBI':
      return {
        physics: 'cmems_mod_ibi_phy_anfc_0.027deg-3D_P1D-m',
        mixedLayerDepth: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m', // IBI 3D physics may not expose mlotst; use GLO 2D
        bottomTemperature: { source: 'physics', variable: 'bottomT' },
        biogeochemistry: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',
        planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        transparency: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i', // Fixed: was 0.083deg_PT1H-m, now 0.027deg_PT1H-i
        region: 'Iberia-Biscay-Ireland',
        coverage: 'IBI_ANALYSIS_FORECAST',
      };
    case 'NWS':
      // NWS has no analysis/forecast product, so this borrows GLO: the SPLIT products for
      // temperature and salinity, and the COMBINED 2D physics for mixed layer depth. The mix is
      // deliberate — the combined product is the only one carrying `tob`, and pointing
      // mixedLayerDepth anywhere else takes bottom temperature back to zero for all 800 cells.
      // See the note on mixedLayerDepth below before changing either.
      return {
        physics: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m', // Temperature dataset
        salinity: 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m', // Salinity dataset (split from physics)
        // GLO's combined 2D physics, not the NWS 7km MLD product. This is the trade the comment
        // that stood here declined to make — now made deliberately, with the measurement it was
        // waiting for.
        //
        // The constraint it described is real: bottom temperature rides along on a call we already
        // make, and asking a product for a variable it lacks fails that whole call. NWS's physics is
        // GLO's split thetao (no bottom field) and the NWS 7km MLD product carries mlotst and
        // nothing else, so between those two datasets there is nowhere to put `tob`. Only swapping
        // one of them changes that.
        //
        // What settles it is what each field is worth. Measured against production 2026-08-12:
        // NEITHER prediction engine reads mixed layer depth — `mlotst` and `mixed_layer_depth_m`
        // appear nowhere in get_fishing_confidence_v3 or get_global_fishing_predictions — while
        // get_global_fishing_predictions DOES read bottom_temperature_c, and it is the engine that
        // serves these cells. MLD survives only in the conditions dashboard, as display.
        //
        // Cost: MLD resolution on a field nothing scores, 7km to GLO's 0.083° (~9km).
        // Gain: bottom temperature across all 800 NWS cells, which read 0/800 before this against
        // BAL's 640/707, and which the 43 species carrying surface_temp_applies = false need before
        // they can score temperature at all rather than abstaining. The UK shelf is not a marginal
        // place to be missing demersal temperature.
        mixedLayerDepth: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
        bottomTemperature: { source: 'mixedLayerDepth', variable: 'tob' },
        biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
        planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        nutrients: 'cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m', // GLO split: no3, po4, si, fe
        carbonateChemistry: 'cmems_mod_glo_bgc-car_anfc_0.25deg_P1D-m', // GLO split: ph, spco2, talk
        transparency: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
        region: 'Northwest European Shelf',
        coverage: 'GLOBAL_ANALYSIS_FORECAST', // Using GLO fallback
      };
    case 'ARC':
      return {
        physics: 'cmems_mod_arc_phy_anfc_6km_detided_P1D-m',
        mixedLayerDepth: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m', // ARC: use GLO 2D physics for mlotst
        bottomTemperature: { source: 'physics', variable: 'bottomT' },
        biogeochemistry: 'cmems_mod_arc_bgc_anfc_ecosmo_P1D-m',
        planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        transparency: 'cmems_obs-oc_arc_bgc-transp_nrt_l4-multi-4km_P1M',
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i', // Arctic has no wave product, use GLO
        region: 'Arctic',
        coverage: 'ARCTIC_ANALYSIS_FORECAST',
      };
    case 'GLO':
      // Global Ocean uses the SPLIT products for temperature and salinity, and the COMBINED 2D
      // physics for mixed layer depth. That last one is not interchangeable with the split
      // products: it is the only one carrying `tob`, which is where GLO's bottom temperature comes
      // from. This is also the majority path — getProvider passes no region for GLO_AM/AP/AF, so
      // realClient falls back to these same datasets for 3,568 of the 7,649 cells.
      return {
        physics: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m', // Temperature dataset
        salinity: 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m', // Salinity dataset (split from physics)
        mixedLayerDepth: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m', // GLO 2D physics for mlotst (no depth dimension)
        bottomTemperature: { source: 'mixedLayerDepth', variable: 'tob' }, // split thetao product has no bottom field
        biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
        planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
        zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
        nutrients: 'cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m', // GLO split: no3, po4, si, fe
        carbonateChemistry: 'cmems_mod_glo_bgc-car_anfc_0.25deg_P1D-m', // GLO split: ph, spco2, talk
        transparency: 'cmems_obs-oc_glo_bgc-transp_nrt_l4-gapfree-multi-4km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
        region: 'Global Ocean',
        coverage: 'GLOBAL_ANALYSIS_FORECAST',
      };
    default:
      return null;
  }
}

/**
 * Map ICES region names to Copernicus regional models
 */
export function getDatasetForRegion(region: string): CopernicusDatasetConfig | null {
  const regionLower = region.toLowerCase();
  
  // Baltic Sea (Finland, Sweden, Poland, Danish Baltic, etc.)
  if (
    regionLower.includes('finnish') ||
    regionLower.includes('swedish baltic') ||
    regionLower.includes('polish baltic') ||
    regionLower.includes('danish baltic') ||
    regionLower.includes('baltic')
  ) {
    return {
      physics: 'cmems_mod_bal_phy_anfc_P1D-m',
      mixedLayerDepth: 'cmems_mod_bal_phy_anfc_P1D-m',
      bottomTemperature: { source: 'physics', variable: 'bottomT' },
      biogeochemistry: 'cmems_mod_bal_bgc_anfc_P1D-m',
      planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
      zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
      transparency: 'cmems_obs-oc_bal_bgc-transp_nrt_l3-olci-300m_P1D',
      waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
      region: 'Baltic Sea',
      coverage: 'BALTICSEA_ANALYSIS_FORECAST',
    };
  }

  // Mediterranean Sea (Italian, Greek, Turkish Med, French Med, Spanish islands, etc.)
  if (
    regionLower.includes('mediterranean') ||
    regionLower.includes('adriatic') ||
    regionLower.includes('italian') ||
    regionLower.includes('greek') ||
    regionLower.includes('turkish mediterranean') ||
    regionLower.includes('croatian') ||
    regionLower.includes('albanian') ||
    regionLower.includes('slovenian') ||
    regionLower.includes('montenegrin') ||
    regionLower.includes('french mediterranean') ||
    regionLower.includes('malta') ||
    regionLower.includes('cyprus') ||
    regionLower.includes('sicily') ||
    regionLower.includes('sardinia') ||
    regionLower.includes('corsica') ||
    regionLower.includes('mallorca') ||
    regionLower.includes('menorca') ||
    regionLower.includes('ibiza') ||
    regionLower.includes('crete') ||
    regionLower.includes('rhodes') ||
    regionLower.includes('dodecanese') ||
    regionLower.includes('cyclades') ||
    regionLower.includes('ionian') ||
    regionLower.includes('aegean') ||
    regionLower.includes('corfu') ||
    regionLower.includes('peloponnese')
  ) {
    return {
      // See getDatasetForCmemsRegion's 'MED' case: the old bundled id was retired by CMEMS.
      physics: 'cmems_mod_med_phy-tem_anfc_4.2km_P1D-m',
      mixedLayerDepth: 'cmems_mod_med_phy-mld_anfc_4.2km_P1D-m',
      biogeochemistry: 'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m',
      planktonFunctionalTypes: 'cmems_mod_med_bgc-pft_anfc_4.2km_P1D-m',
      zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
      nutrients: 'cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m',
      carbonateChemistry: 'cmems_mod_med_bgc-car_anfc_4.2km_P1D-m',
      transparency: 'cmems_obs-oc_med_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
      waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
      region: 'Mediterranean Sea',
      coverage: 'MEDSEA_ANALYSIS_FORECAST',
    };
  }

    // Black Sea (Bulgarian, Romanian, Turkish Black Sea)
  if (
    regionLower.includes('black sea') ||
    regionLower.includes('bulgarian black') ||
    regionLower.includes('romanian black') ||
    regionLower.includes('turkish black') ||
    regionLower.includes('ukrainian') ||
    regionLower.includes('georgian') ||
    regionLower.includes('crimea')
  ) {
    return {
      // See getDatasetForCmemsRegion's 'BLK' case: the old bundled id was retired by CMEMS.
      // Note BLK's split temperature dataset is "-temp", not "-tem" like MED's.
      physics: 'cmems_mod_blk_phy-temp_anfc_2.5km_P1D-m',
      mixedLayerDepth: 'cmems_mod_blk_phy-mld_anfc_2.5km_P1D-m',
      biogeochemistry: 'cmems_mod_blk_bgc_anfc_2.5km_P1D-m',
      planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
      zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
      transparency: 'cmems_obs-oc_blk_bgc-transp_nrt_l3-multi-1km_P1D',
      waves: 'cmems_mod_blk_wav_anfc_2.5km_PT1H-i',
      region: 'Black Sea',
      coverage: 'BLKSEA_ANALYSIS_FORECAST',
    };
  }

  // IBI - Iberia-Biscay-Ireland (Portugal, Spain Atlantic, Ireland, SW UK, Bay of Biscay)
  if (
    regionLower.includes('portuguese') ||
    regionLower.includes('galician') ||
    regionLower.includes('bay of biscay') ||
    regionLower.includes('irish') ||
    regionLower.includes('ireland') ||
    regionLower.includes('celtic sea') ||
    regionLower.includes('cornwall') ||
    regionLower.includes('devon') ||
    regionLower.includes('bristol channel') ||
    regionLower.includes('pembrokeshire') ||
    regionLower.includes('cardigan bay') ||
    regionLower.includes('anglesey') ||
    regionLower.includes('wales') ||
    regionLower.includes('merseyside') ||
    regionLower.includes('lancashire') ||
    regionLower.includes('cumbria') ||
    regionLower.includes('hebrides') ||
    regionLower.includes('west of scotland') ||
    regionLower.includes('ibi')
  ) {
    return {
      physics: 'cmems_mod_ibi_phy_anfc_0.027deg-3D_P1D-m',
      mixedLayerDepth: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
      bottomTemperature: { source: 'physics', variable: 'bottomT' },
      biogeochemistry: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',
      planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
      zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
      transparency: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
      waves: 'cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i',
      region: 'Iberia-Biscay-Ireland',
      coverage: 'IBI_ANALYSIS_FORECAST',
    };
  }

  // Northwest European Shelf (North Sea, English Channel, Scottish waters, Norwegian coast)
  if (
    regionLower.includes('north sea') ||
    regionLower.includes('english channel') ||
    regionLower.includes('dutch coast') ||
    regionLower.includes('danish north') ||
    regionLower.includes('danish skagerrak') ||
    regionLower.includes('norwegian') ||
    regionLower.includes('scottish') ||
    regionLower.includes('shetland') ||
    regionLower.includes('orkney') ||
    regionLower.includes('dogger bank') ||
    regionLower.includes('yorkshire') ||
    regionLower.includes('durham') ||
    regionLower.includes('northumberland') ||
    regionLower.includes('lincolnshire') ||
    regionLower.includes('norfolk') ||
    regionLower.includes('suffolk') ||
    regionLower.includes('essex') ||
    regionLower.includes('kent') ||
    regionLower.includes('sussex') ||
    regionLower.includes('hampshire') ||
    regionLower.includes('dorset') ||
    regionLower.includes('somerset') ||
    regionLower.includes('thames')
  ) {
    return {
      physics: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m', // Temperature dataset (split from salinity)
      salinity: 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m', // Salinity dataset (split from physics)
      mixedLayerDepth: 'cmems_mod_nws_phy-mld_anfc_7km-2D_P1D-m', // NWS dedicated MLD product (7km)
      biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
      planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
      zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
      nutrients: 'cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m',
      carbonateChemistry: 'cmems_mod_glo_bgc-car_anfc_0.25deg_P1D-m',
      transparency: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
      waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
      region: 'Northwest European Shelf',
      coverage: 'GLOBAL_ANALYSIS_FORECAST',
    };
  }

  // Arctic (Norwegian Arctic)
  if (regionLower.includes('arctic')) {
    return {
      physics: 'cmems_mod_arc_phy_anfc_6km_detided_P1D-m',
      mixedLayerDepth: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
      bottomTemperature: { source: 'physics', variable: 'bottomT' },
      biogeochemistry: 'cmems_mod_arc_bgc_anfc_ecosmo_P1D-m',
      planktonFunctionalTypes: 'cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m',
      zooplankton: 'cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m',
      transparency: 'cmems_obs-oc_arc_bgc-transp_nrt_l4-multi-4km_P1M',
      waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
      region: 'Arctic',
      coverage: 'ARCTIC_ANALYSIS_FORECAST',
    };
  }

  // No specific regional model found
  return null;
}

/**
 * Get human-readable description of coverage
 */
export function getCoverageDescription(config: CopernicusDatasetConfig): string {
  switch (config.coverage) {
    case 'BALTICSEA_ANALYSISFORECAST':
      return 'High-resolution Baltic Sea model (1-2km)';
    case 'MEDSEA_ANALYSISFORECAST':
      return 'High-resolution Mediterranean model (4.2km)';
    case 'BLKSEA_ANALYSISFORECAST':
      return 'High-resolution Black Sea model (2.5km)';
    case 'IBI_ANALYSISFORECAST':
      return 'High-resolution IBI model (2.7km) - Portugal/Spain/Ireland/W.UK';
    case 'NORTHWESTSHELF_ANALYSISFORECAST':
      return 'High-resolution NW Shelf model (2.7km) - North Sea/English Channel';
    case 'ARCTIC_ANALYSISFORECAST':
      return 'Arctic Ocean model (6km)';
    default:
      return 'Unknown coverage';
  }
}

/**
 * Check if a region has Copernicus coverage
 */
export function hasCopernicusCoverage(region: string): boolean {
  return getDatasetForRegion(region) !== null;
}
