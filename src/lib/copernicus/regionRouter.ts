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
  biogeochemistry: string;
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
        biogeochemistry: 'cmems_mod_bal_bgc_anfc_P1D-m',
        transparency: 'cmems_obs-oc_bal_bgc-transp_nrt_l3-olci-300m_P1D',
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i', // Baltic has no wave product, use GLO
        region: 'Baltic Sea',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST',
      };
    case 'MED':
      return {
        physics: 'cmems_mod_med_phy_anfc_4.2km_P1D-m', // Fixed: was 0.042deg-3D, now 4.2km
        biogeochemistry: 'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m', // Fixed: added -bio suffix, changed resolution
        transparency: 'cmems_obs-oc_med_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i', // Med has no wave product, use GLO
        region: 'Mediterranean Sea',
        coverage: 'MEDSEA_ANALYSIS_FORECAST',
      };
    case 'BLK':
      return {
        physics: 'cmems_mod_blk_phy_anfc_2.5km_P1D-m',
        biogeochemistry: 'cmems_mod_blk_bgc_anfc_2.5km_P1D-m',
        transparency: 'cmems_obs-oc_blk_bgc-transp_nrt_l3-multi-1km_P1D',
        waves: 'cmems_mod_blk_wav_anfc_2.5km_PT1H-i',
        region: 'Black Sea',
        coverage: 'BLKSEA_ANALYSIS_FORECAST',
      };
    case 'IBI':
      return {
        physics: 'cmems_mod_ibi_phy_anfc_0.027deg-3D_P1D-m',
        biogeochemistry: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',
        transparency: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i', // Fixed: was 0.083deg_PT1H-m, now 0.027deg_PT1H-i
        region: 'Iberia-Biscay-Ireland',
        coverage: 'IBI_ANALYSIS_FORECAST',
      };
    case 'NWS':
      // NWS has no analysis/forecast product, use GLO with split datasets
      return {
        physics: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m', // Temperature dataset
        salinity: 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m', // Salinity dataset (split from physics)
        biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
        transparency: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D', // NRT for current data (MY has ~1 week lag)
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
        region: 'Northwest European Shelf',
        coverage: 'GLOBAL_ANALYSIS_FORECAST', // Using GLO fallback
      };
    case 'ARC':
      return {
        physics: 'cmems_mod_arc_phy_anfc_6km_detided_P1D-m',
        biogeochemistry: 'cmems_mod_arc_bgc_anfc_ecosmo_P1D-m',
        transparency: 'cmems_obs-oc_arc_bgc-transp_nrt_l4-multi-4km_P1M',
        waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i', // Arctic has no wave product, use GLO
        region: 'Arctic',
        coverage: 'ARCTIC_ANALYSIS_FORECAST',
      };
    case 'GLO':
      // Global Ocean uses split datasets for temperature and salinity
      return {
        physics: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m', // Temperature dataset
        salinity: 'cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m', // Salinity dataset (split from physics)
        biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
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
      biogeochemistry: 'cmems_mod_bal_bgc_anfc_P1D-m',
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
      physics: 'cmems_mod_med_phy_anfc_4.2km_P1D-m',
      biogeochemistry: 'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m',
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
      physics: 'cmems_mod_blk_phy_anfc_2.5km_P1D-m',
      biogeochemistry: 'cmems_mod_blk_bgc_anfc_2.5km_P1D-m',
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
      biogeochemistry: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',
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
      biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
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
      biogeochemistry: 'cmems_mod_arc_bgc_anfc_ecosmo_P1D-m',
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
