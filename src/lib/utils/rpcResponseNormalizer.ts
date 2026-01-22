/**
 * RPC Response Normalizer
 * 
 * Provides robust type-safe access to RPC function responses, handling
 * column name variations and providing consistent aliases.
 * 
 * PROBLEM: We keep tripping over column names changing between:
 * - species_name vs name_en
 * - confidence_score vs confidence
 * - temperature_score vs temp_score
 * - bio_score vs bio_band_score
 * 
 * SOLUTION: Single source of truth for field access with fallbacks
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface RPCPrediction {
  // Core identification
  species_id: string;
  species_code: string;
  name_en: string;
  scientific_name: string;
  
  // Prediction details
  ices_rectangle: string;
  prediction_date: string;
  confidence: number;
  
  // Score breakdown
  bio_band_score: number;
  temp_score: number;
  substrate_score: number;
  depth_score: number;
  light_score: number;
  habitat_bonus: number;
  lunar_score: number;
  weather_score: number;
  freshness_score: number;
  completeness_score: number;
  
  // Additional context
  moon_phase?: string;
  moon_illumination?: number;
  biogeographic_regions?: string[];
  aliases?: string[];  // Array of alternative names (e.g., "Sea Bass", "Seabass", etc.)
  
  // Optional legacy fields (for backward compatibility)
  species_name?: string;
  confidence_score?: number;
  temperature_score?: number;
  bio_score?: number;
}

/**
 * Safely get the species name from an RPC prediction
 * Handles multiple possible column names
 */
export function getSpeciesName(prediction: AnyRecord): string {
  return prediction?.name_en 
    || prediction?.species_name 
    || prediction?.scientific_name 
    || 'Unknown Species';
}

/**
 * Safely get the confidence score from an RPC prediction
 * Handles multiple possible column names
 */
export function getConfidence(prediction: AnyRecord): number {
  return prediction?.confidence 
    || prediction?.confidence_score 
    || prediction?.total_score 
    || 0;
}

/**
 * Safely get the temperature score from an RPC prediction
 * Handles multiple possible column names
 */
export function getTempScore(prediction: AnyRecord): number {
  return prediction?.temp_score 
    || prediction?.temperature_score 
    || 0;
}

/**
 * Safely get the bio score from an RPC prediction
 * Handles multiple possible column names
 */
export function getBioScore(prediction: AnyRecord): number {
  return prediction?.bio_band_score 
    || prediction?.bio_score 
    || 0;
}

/**
 * Safely get biogeographic regions from an RPC prediction
 */
export function getBiogeographicRegions(prediction: AnyRecord): string[] {
  return prediction?.biogeographic_regions || [];
}

/**
 * Safely get aliases from an RPC prediction
 * Returns array of alternative names (e.g., ["Sea Bass", "Seabass", "European Seabass"])
 */
export function getAliases(prediction: AnyRecord): string[] {
  return prediction?.aliases || [];
}

/**
 * Normalize an RPC prediction to consistent field names
 * Use this to convert any RPC response to a standard format
 */
export function normalizePrediction(rawPrediction: AnyRecord): RPCPrediction {
  return {
    // Core identification
    species_id: rawPrediction.species_id || '',
    species_code: rawPrediction.species_code || '',
    name_en: getSpeciesName(rawPrediction),
    scientific_name: rawPrediction.scientific_name || '',
    
    // Prediction details
    ices_rectangle: rawPrediction.ices_rectangle || '',
    prediction_date: rawPrediction.prediction_date || '',
    confidence: getConfidence(rawPrediction),
    
    // Score breakdown
    bio_band_score: getBioScore(rawPrediction),
    temp_score: getTempScore(rawPrediction),
    substrate_score: rawPrediction.substrate_score || 0,
    depth_score: rawPrediction.depth_score || 0,
    light_score: rawPrediction.light_score || 0,
    habitat_bonus: rawPrediction.habitat_bonus || 0,
    lunar_score: rawPrediction.lunar_score || 0,
    weather_score: rawPrediction.weather_score || 0,
    freshness_score: rawPrediction.freshness_score || 0,
    completeness_score: rawPrediction.completeness_score || 0,
    
    // Additional context
    moon_phase: rawPrediction.moon_phase,
    moon_illumination: rawPrediction.moon_illumination,
    biogeographic_regions: getBiogeographicRegions(rawPrediction),
  };
}

/**
 * Normalize an array of RPC predictions
 */
export function normalizePredictions(rawPredictions: AnyRecord[]): RPCPrediction[] {
  if (!Array.isArray(rawPredictions)) {
    return [];
  }
  return rawPredictions.map(normalizePrediction);
}

/**
 * Type guard to check if a prediction is valid
 */
export function isValidPrediction(prediction: AnyRecord): prediction is RPCPrediction {
  return prediction 
    && typeof prediction === 'object'
    && (prediction.name_en || prediction.species_name)
    && typeof (prediction.confidence || prediction.confidence_score) === 'number';
}

/**
 * Format a prediction for display
 */
export function formatPrediction(prediction: AnyRecord, options: {
  includeScientific?: boolean;
  includeScores?: boolean;
  includeRegions?: boolean;
} = {}): string {
  const name = getSpeciesName(prediction);
  const confidence = getConfidence(prediction);
  
  let result = `${name} (${Math.round(confidence)}%)`;
  
  if (options.includeScientific && prediction.scientific_name) {
    result += ` - ${prediction.scientific_name}`;
  }
  
  if (options.includeScores) {
    const temp = getTempScore(prediction);
    const bio = getBioScore(prediction);
    result += ` [Temp: ${temp}, Bio: ${bio}]`;
  }
  
  if (options.includeRegions) {
    const regions = getBiogeographicRegions(prediction);
    if (regions.length > 0) {
      result += ` {${regions.join(', ')}}`;
    }
  }
  
  return result;
}

/**
 * Search predictions by species name (fuzzy match)
 * Searches name_en, scientific_name, AND aliases for better results
 */
export function findSpeciesByName(predictions: AnyRecord[], searchName: string): AnyRecord | null {
  const searchLower = searchName.toLowerCase().trim();
  return predictions.find(pred => {
    const name = getSpeciesName(pred).toLowerCase();
    const scientific = (pred.scientific_name || '').toLowerCase();
    const aliases = getAliases(pred);
    
    // Check official name
    if (name.includes(searchLower) || searchLower.includes(name)) {
      return true;
    }
    
    // Check scientific name
    if (scientific.includes(searchLower) || searchLower.includes(scientific)) {
      return true;
    }
    
    // Check each alias
    for (const alias of aliases) {
      const aliasLower = (alias || '').toLowerCase();
      if (aliasLower && (aliasLower.includes(searchLower) || searchLower.includes(aliasLower))) {
        return true;
      }
    }
    
    return false;
  }) || null;
}

/**
 * Check if a species exists in predictions
 */
export function hasSpecies(predictions: AnyRecord[], speciesName: string): boolean {
  return findSpeciesByName(predictions, speciesName) !== null;
}

/**
 * Get species rank in predictions (1-indexed)
 */
export function getSpeciesRank(predictions: AnyRecord[], speciesName: string): number | null {
  const found = findSpeciesByName(predictions, speciesName);
  if (!found) return null;
  return predictions.indexOf(found) + 1;
}
