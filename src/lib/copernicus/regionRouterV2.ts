/**
 * Copernicus Regional Product Router with Multi-Tier Fallback
 * 
 * Maps ICES rectangle regions to appropriate Copernicus Marine datasets with priority cascade:
 * 1. Regional OC/BGC products (chlorophyll, optical)
 * 2. Regional PHY products (temperature, currents, salinity)
 * 3. Regional BGC model products (nutrients, oxygen)
 * 4. Global fallback products
 * 
 * Based on Copernicus support guidance (Oct 2025):
 * - Regional coastal products DO exist and work within 30-50km of shore
 * - Different variables come from different product families (OC vs PHY vs BGC)
 * - Each region has specific product IDs optimized for coastal/shelf waters
 */

export type DataVariable = 
  | 'temperature'
  | 'salinity'
  | 'currents'
  | 'chlorophyll'
  | 'clarity'
  | 'nitrate'
  | 'phosphate'
  | 'oxygen';

export interface ProductConfig {
  datasetId: string;
  variables: string[];  // Variable names in the dataset
  source: 'regional-oc' | 'regional-phy' | 'regional-bgc' | 'global-fallback';
  quality: 'satellite' | 'model' | 'interpolated';
  resolution: string;
  coverage: string;
}

export interface RegionalDatasetBundle {
  region: string;
  temperature: ProductConfig[];      // Priority order: [primary, fallback, ...]
  chlorophyll: ProductConfig[];
  clarity: ProductConfig[];
  nutrients: ProductConfig[];        // Nitrate, phosphate, oxygen together
  currents: ProductConfig[];
}

/**
 * Get prioritized product list for a specific region and variable
 * Returns array in priority order - try [0] first, fallback to [1], etc.
 */
export function getRegionalProducts(
  cmemsRegion: string,
  variable: DataVariable
): ProductConfig[] {
  const region = cmemsRegion.toUpperCase();
  const bundle = REGIONAL_PRODUCT_BUNDLES[region];
  
  if (!bundle) {
    return getGlobalFallback(variable);
  }
  
  // Map individual variables to bundle categories
  switch (variable) {
    case 'temperature':
      return bundle.temperature;
    case 'salinity':
      // MED has separate salinity dataset in nutrients bundle
      if (region === 'MED') {
        const salinityProducts = bundle.nutrients.filter(p => p.variables.includes('so'));
        if (salinityProducts.length > 0) {
          return salinityProducts;
        }
      }
      return bundle.temperature; // Other regions bundle salinity with temperature
    case 'currents':
      return bundle.currents;
    case 'chlorophyll':
      return bundle.chlorophyll;
    case 'clarity':
      return bundle.clarity;
    case 'nitrate':
    case 'phosphate':
    case 'oxygen':
      return bundle.nutrients;
    default:
      return getGlobalFallback(variable);
  }
}

/**
 * Regional Product Bundles
 * Each region has optimized products for coastal/shelf waters
 */
const REGIONAL_PRODUCT_BUNDLES: Record<string, RegionalDatasetBundle> = {
  
  // ============================================================================
  // IBI - Iberian-Biscay-Irish (Spain, Portugal, Bay of Biscay, Irish Sea)
  // ============================================================================
  IBI: {
    region: 'Iberian-Biscay-Irish',
    
    temperature: [
      {
        datasetId: 'cmems_mod_ibi_phy_anfc_0.027deg-3D_P1D-m',  // VERIFIED: ANFC physics with temp + salinity
        variables: ['thetao', 'so'],  // Temperature, salinity bundled
        source: 'regional-phy',
        quality: 'model',
        resolution: '0.027deg (~3km)',
        coverage: 'IBI_ANALYSIS_FORECAST_PHYSICS',
      },
      {
        datasetId: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
        variables: ['thetao', 'so'],
        source: 'global-fallback',
        quality: 'model',
        resolution: '0.083deg (~9km)',
        coverage: 'GLOBAL_ANALYSIS_FORECAST',
      },
    ],
    
    chlorophyll: [
      {
        datasetId: 'cmems_obs-oc_atl_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D',  // VERIFIED: Gap-free L4, covers IBI/NWS/Nordic (NRT for freshest data)
        variables: ['CHL'],  // Chlorophyll-a in mg/m³
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'ATLANTIC_OCEAN_COLOUR_L4_GAPFREE',
      },
      {
        datasetId: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',  // VERIFIED: 3D BGC model fallback
        variables: ['chl'],  // Chlorophyll model
        source: 'regional-bgc',
        quality: 'model',
        resolution: '0.027deg (~3km)',
        coverage: 'IBI_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
    ],
    
    clarity: [
      {
        datasetId: 'cmems_obs-oc_atl_bgc-transp_nrt_l3-multi-1km_P1D',  // VERIFIED: KD490 light attenuation (NRT avoids MY lag)
        variables: ['KD490'],  // Light attenuation coefficient in m⁻¹
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'ATLANTIC_OCEAN_COLOUR_TRANSPARENCY',
      },
      {
        datasetId: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',
        variables: ['zeu'],  // Euphotic depth (proxy for clarity)
        source: 'regional-bgc',
        quality: 'model',
        resolution: '0.027deg (~3km)',
        coverage: 'IBI_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
    ],
    
    nutrients: [
      {
        datasetId: 'cmems_mod_ibi_bgc_anfc_0.027deg-3D_P1D-m',  // VERIFIED: 50+ depth layers, all BGC vars
        variables: ['no3', 'po4', 'o2', 'chl', 'phyc'],  // Nitrate, phosphate, oxygen, chlorophyll, phytoplankton carbon
        source: 'regional-bgc',
        quality: 'model',
        resolution: '0.027deg (~3km)',
        coverage: 'IBI_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
    ],
    
    currents: [
      {
        datasetId: 'IBI_MULTIYEAR_PHY_005_002',
        variables: ['uo', 'vo'],  // U/V current components
        source: 'regional-phy',
        quality: 'model',
        resolution: '0.083deg (~9km)',
        coverage: 'IBI_MULTIYEAR_PHYSICS',
      },
    ],
  },

  // ============================================================================
  // MED - Mediterranean Sea
  // ============================================================================
  MED: {
    region: 'Mediterranean Sea',
    
    temperature: [
      {
        datasetId: 'cmems_mod_med_phy-tem_anfc_4.2km_P1D-m',  // VERIFIED WORKING: Physics temperature model
        variables: ['thetao'],  // Temperature only (salinity in separate dataset)
        source: 'regional-phy',
        quality: 'model',
        resolution: '4.2km',
        coverage: 'MEDSEA_ANALYSIS_FORECAST_PHYSICS',
      },
      {
        datasetId: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
        variables: ['thetao', 'so'],
        source: 'global-fallback',
        quality: 'model',
        resolution: '0.083deg (~9km)',
        coverage: 'GLOBAL_ANALYSIS_FORECAST',
      },
    ],
    
    chlorophyll: [
      {
        datasetId: 'cmems_obs-oc_med_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D',  // VERIFIED: Gap-free L4 (NRT for freshest data)
        variables: ['CHL'],  // Chlorophyll-a in mg/m³, case 1 + case 2 algorithms
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'MEDITERRANEAN_OCEANCOLOUR_L4_GAPFREE',
      },
      {
        datasetId: 'cmems_mod_med_bgc-pft_anfc_4.2km_P1D-m',  // BGC model fallback with phytoplankton functional types
        variables: ['chl'],  // Chlorophyll model (lowercase!)
        source: 'regional-bgc',
        quality: 'model',
        resolution: '4.2km',
        coverage: 'MEDSEA_ANALYSIS_FORECAST_PHYTOPLANKTON',
      },
    ],
    
    clarity: [
      {
        datasetId: 'cmems_obs-oc_med_bgc-transp_nrt_l3-multi-1km_P1D',  // VERIFIED: KD490 light attenuation (NRT avoids MY lag)
        variables: ['KD490'],  // Light attenuation coefficient in m⁻¹
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'MEDITERRANEAN_OCEANCOLOUR_TRANSPARENCY',
      },
    ],
    
    nutrients: [
      {
        datasetId: 'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m',  // VERIFIED WORKING: BGC biological model with oxygen
        variables: ['o2'],  // Dissolved oxygen in mmol/m³
        source: 'regional-bgc',
        quality: 'model',
        resolution: '4.2km',
        coverage: 'MEDSEA_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
      {
        datasetId: 'cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m',  // VERIFIED WORKING: BGC nutrients model
        variables: ['no3', 'po4'],  // Nitrate, phosphate in mmol/m³
        source: 'regional-bgc',
        quality: 'model',
        resolution: '4.2km',
        coverage: 'MEDSEA_ANALYSIS_FORECAST_NUTRIENTS',
      },
      {
        datasetId: 'cmems_mod_med_phy-sal_anfc_4.2km_P1D-m',  // VERIFIED WORKING: Physics salinity model
        variables: ['so'],  // Salinity in PSU (practical salinity units)
        source: 'regional-phy',
        quality: 'model',
        resolution: '4.2km',
        coverage: 'MEDSEA_ANALYSIS_FORECAST_PHYSICS_SALINITY',
      },
    ],
    
    currents: [
      {
        datasetId: 'MED_PHY_ANFC',
        variables: ['uo', 'vo'],
        source: 'regional-phy',
        quality: 'model',
        resolution: '4.2km',
        coverage: 'MEDSEA_ANALYSIS_FORECAST',
      },
    ],
  },

  // ============================================================================
  // BAL - Baltic Sea
  // ============================================================================
  BAL: {
    region: 'Baltic Sea',
    
    temperature: [
      {
        datasetId: 'cmems_mod_bal_phy_anfc_P1D-m',  // VERIFIED: ANFC physics with temp + salinity
        variables: ['thetao', 'so'],  // Temperature, salinity bundled
        source: 'regional-phy',
        quality: 'model',
        resolution: '0.025deg (~2.8km)',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST_PHYSICS',
      },
    ],
    
    chlorophyll: [
      {
        datasetId: 'cmems_obs-oc_bal_bgc-plankton_nrt_l3-olci-300m_P1D',  // VERIFIED: 300m resolution NRT
        variables: ['CHL'],  // Chlorophyll-a in mg/m³
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '300m',
        coverage: 'BALTICSEA_OCEANCOLOUR_L3_NRT',
      },
      {
        datasetId: 'cmems_mod_bal_bgc_anfc_P1D-m',  // BGC model fallback
        variables: ['chl'],
        source: 'regional-bgc',
        quality: 'model',
        resolution: 'Variable',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
    ],
    
    clarity: [
      {
        datasetId: 'cmems_obs-oc_bal_bgc-transp_nrt_l3-olci-300m_P1D',  // VERIFIED: KD490 + Secchi depth
        variables: ['KD490'],  // Light attenuation coefficient in m⁻¹
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '300m',
        coverage: 'BALTICSEA_OCEANCOLOUR_TRANSPARENCY_NRT',
      },
      {
        datasetId: 'cmems_mod_bal_bgc_anfc_P1D-m',  // Model has kd and zsd variables
        variables: ['kd', 'zsd'],  // Light attenuation, Secchi depth
        source: 'regional-bgc',
        quality: 'model',
        resolution: 'Variable',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
    ],
    
    nutrients: [
      {
        datasetId: 'cmems_mod_bal_bgc_anfc_P1D-m',  // VERIFIED: ANFC BGC with all nutrients
        variables: ['no3', 'po4', 'o2', 'chl', 'phyc'],  // Nitrate, phosphate, oxygen, chlorophyll, phytoplankton carbon
        source: 'regional-bgc',
        quality: 'model',
        resolution: '0.025deg (~2.8km)',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST_BIOGEOCHEMISTRY',
      },
    ],
    
    currents: [
      {
        datasetId: 'cmems_mod_bal_phy_anfc_P1D-m',
        variables: ['uo', 'vo'],
        source: 'regional-phy',
        quality: 'model',
        resolution: 'Variable',
        coverage: 'BALTICSEA_ANALYSIS_FORECAST',
      },
    ],
  },

  // ============================================================================
  // BLK - Black Sea
  // ============================================================================
  BLK: {
    region: 'Black Sea',
    
    temperature: [
      {
        datasetId: 'cmems_mod_blk_phy_anfc_2.5km_P1D-m',
        variables: ['thetao', 'so'],
        source: 'regional-phy',
        quality: 'model',
        resolution: '2.5km',
        coverage: 'BLKSEA_ANALYSIS_FORECAST',
      },
    ],
    
    chlorophyll: [
      {
        datasetId: 'OCEANCOLOUR_BLK_BGC_L3_NRT_009_151',  // NRT
        variables: ['CHL'],
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'BLKSEA_OCEANCOLOUR_NRT',
      },
      {
        datasetId: 'OCEANCOLOUR_BLK_BGC_L3_MY_009_153',  // MY
        variables: ['CHL'],
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'BLKSEA_OCEANCOLOUR_REANALYSIS',
      },
    ],
    
    clarity: [
      {
        datasetId: 'OCEANCOLOUR_BLK_BGC_L3_NRT_009_151',
        variables: ['KD490'],
        source: 'regional-oc',
        quality: 'satellite',
        resolution: '1km',
        coverage: 'BLKSEA_OCEANCOLOUR_NRT',
      },
    ],
    
    nutrients: [
      {
        datasetId: 'cmems_mod_blk_bgc_anfc_2.5km_P1D-m',
        variables: ['no3', 'po4', 'o2'],
        source: 'regional-bgc',
        quality: 'model',
        resolution: '2.5km',
        coverage: 'BLKSEA_BIOGEOCHEMISTRY',
      },
    ],
    
    currents: [
      {
        datasetId: 'cmems_mod_blk_phy_anfc_2.5km_P1D-m',
        variables: ['uo', 'vo'],
        source: 'regional-phy',
        quality: 'model',
        resolution: '2.5km',
        coverage: 'BLKSEA_ANALYSIS_FORECAST',
      },
    ],
  },

  // ============================================================================
  // NWS - NorthWest European Shelf (TODO: Find specific NWS products)
  // ============================================================================
  NWS: {
    region: 'NorthWest European Shelf',
    
    temperature: [
      {
        datasetId: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',  // Global fallback until NWS product found
        variables: ['thetao', 'so'],
        source: 'global-fallback',
        quality: 'model',
        resolution: '0.083deg (~9km)',
        coverage: 'GLOBAL_ANALYSIS_FORECAST',
      },
    ],
    
    chlorophyll: [
      {
        datasetId: 'OCEANCOLOUR_GLO_BGC_L4_NRT_009_102',
        variables: ['CHL'],
        source: 'global-fallback',
        quality: 'satellite',
        resolution: '4km',
        coverage: 'GLOBAL_OCEANCOLOUR',
      },
    ],
    
    clarity: [
      {
        datasetId: 'OCEANCOLOUR_GLO_BGC_L4_NRT_009_102',
        variables: ['KD490'],
        source: 'global-fallback',
        quality: 'satellite',
        resolution: '4km',
        coverage: 'GLOBAL_OCEANCOLOUR',
      },
    ],
    
    nutrients: [],  // TODO: Find NWS BGC product
    
    currents: [
      {
        datasetId: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
        variables: ['uo', 'vo'],
        source: 'global-fallback',
        quality: 'model',
        resolution: '0.083deg (~9km)',
        coverage: 'GLOBAL_ANALYSIS_FORECAST',
      },
    ],
  },
};

/**
 * Global fallback products when regional products unavailable
 */
function getGlobalFallback(variable: DataVariable): ProductConfig[] {
  switch (variable) {
    case 'temperature':
    case 'salinity':
    case 'currents':
      return [{
        datasetId: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
        variables: variable === 'currents' ? ['uo', 'vo'] : ['thetao', 'so'],
        source: 'global-fallback',
        quality: 'model',
        resolution: '0.083deg (~9km)',
        coverage: 'GLOBAL_ANALYSIS_FORECAST',
      }];
    
    case 'chlorophyll':
    case 'clarity':
      return [{
        datasetId: 'OCEANCOLOUR_GLO_BGC_L4_NRT_009_102',
        variables: variable === 'chlorophyll' ? ['CHL'] : ['KD490'],
        source: 'global-fallback',
        quality: 'satellite',
        resolution: '4km',
        coverage: 'GLOBAL_OCEANCOLOUR',
      }];
    
    case 'nitrate':
    case 'phosphate':
    case 'oxygen':
      return [{
        datasetId: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
        variables: ['no3', 'po4', 'o2'],
        source: 'global-fallback',
        quality: 'model',
        resolution: '0.25deg (~25km)',
        coverage: 'GLOBAL_BIOGEOCHEMISTRY',
      }];
    
    default:
      return [];
  }
}

/**
 * Legacy function for backward compatibility
 * Use getRegionalProducts() for new code
 */
export function getDatasetForCmemsRegion(cmemsRegion: string) {
  const region = cmemsRegion.toUpperCase();
  const bundle = REGIONAL_PRODUCT_BUNDLES[region];
  
  if (!bundle) {
    return {
      physics: 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
      biogeochemistry: 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
      waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
      region: 'Global Ocean',
      coverage: 'GLOBAL_ANALYSIS_FORECAST',
    };
  }
  
  return {
    physics: bundle.temperature[0].datasetId,
    biogeochemistry: bundle.nutrients[0]?.datasetId || 'cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m',
    waves: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
    region: bundle.region,
    coverage: bundle.temperature[0].coverage,
  };
}

/**
 * Get all subdataset IDs for a main dataset
 * Helper for finding specific cmems_mod_* subdatasets
 */
export function getSubdatasetPattern(mainDatasetId: string): string {
  // IBI_MULTIYEAR_PHY_005_002 → cmems_mod_ibi_phy_my_0.083deg-3D_*
  if (mainDatasetId.includes('IBI_MULTIYEAR_PHY')) {
    return 'cmems_mod_ibi_phy_my_0.083deg-3D_*';
  }
  if (mainDatasetId.includes('IBI_MULTIYEAR_BGC')) {
    return 'cmems_mod_ibi_bgc_my_0.083deg-3D_*';
  }
  
  // Return the dataset ID as-is for OC products
  return mainDatasetId;
}
