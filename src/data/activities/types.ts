// Shared type for activities
// Visibility semantics: `visibility` refers to above-water horizontal visibility in km.
// Wind-relative keys (windRelative=offshore/cross-shore/onshore/side-onshore/side-offshore)
// are derived by the app from wind direction and beach orientation where applicable.

export interface ActivityType {
  id: string;
  name: string;
  category: string;
  secondaryCategory?: string;
  description?: string;
  weatherSensitive: boolean;
  tags: string[];
  seasonalMonths?: number[];              // Optional: indicates best months for this activity
  poorConditions?: string[];              // Conditions where the activity becomes unsuitable or unsafe
  fairConditions?: string[];              // Acceptable but not ideal conditions
  goodConditions?: string[];              // Recommended and generally enjoyable
  perfectConditions?: string[];           // Ideal and most desirable conditions
  applyBeaufort?: boolean;                // Effect of wind on small inland waters
  indoorAlternative?: string;             // Optional fallback if the activity is weather-sensitive
  /** If true, scoring should derive wind-relative direction (onshore/cross/offshore) from beach orientation */
  usesWindRelative?: boolean;
  /** If true, activity benefits from a known beach orientation (e.g., surfing, sea swimming) */
  requiresBeachOrientation?: boolean;
}
