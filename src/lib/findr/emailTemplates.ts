/**
 * Email Templates for Findr Notifications
 *
 * Daily digest format - one email per user with all species alerts
 */

export interface EmailSpeciesAlert {
  speciesName: string;
  confidence: number;
  locationName: string;
  rectangleCode?: string;
  imageUrl?: string;
}

export interface DailyDigestData {
  userName?: string;
  alerts: EmailSpeciesAlert[];
  date: string;
  unsubscribeUrl?: string;
}

export interface TieredEmailSpeciesAlert extends EmailSpeciesAlert {
  tier: 'hot_bites' | 'good_conditions' | 'status_updates';
}

export interface TieredDailyDigestData {
  userName?: string;
  hotBites: TieredEmailSpeciesAlert[];
  goodConditions: TieredEmailSpeciesAlert[];
  statusUpdates: TieredEmailSpeciesAlert[];
  date: string;
  locationName: string;
  unsubscribeUrl?: string;
}

/**
 * Generate HTML email template for daily fishing digest
 */
export function generateDailyDigestHTML(data: DailyDigestData): string {
  const { userName, alerts, date, unsubscribeUrl } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Findr - Daily Fishing Forecast</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">

  <!-- Container -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">

        <!-- Email Content -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🎣 Findr Daily Forecast
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${date}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 24px 16px;">
              <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.5;">
                ${greeting},
              </p>
              <p style="margin: 12px 0 0; font-size: 16px; color: #374151; line-height: 1.5;">
                Great fishing conditions detected for <strong>${alerts.length} species</strong> you're tracking:
              </p>
            </td>
          </tr>

          <!-- Species Alerts -->
          ${alerts.map(alert => `
          <tr>
            <td style="padding: 0 24px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top; width: 60px;">
                          ${alert.imageUrl ? `
                          <img src="${alert.imageUrl}" alt="${alert.speciesName}" width="50" height="50" style="border-radius: 8px; display: block;" />
                          ` : `
                          <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                            🐟
                          </div>
                          `}
                        </td>
                        <td style="vertical-align: top; padding-left: 16px;">
                          <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #111827;">
                            ${alert.speciesName}
                          </h3>
                          <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                            ${alert.locationName}${alert.rectangleCode ? ` • ${alert.rectangleCode}` : ''}
                          </p>
                          <div style="display: inline-block; background-color: ${getConfidenceColor(alert.confidence)}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            ${alert.confidence}% Confidence
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 24px 32px;" align="center">
              <a href="https://fishfindr.eu/findr/favourites" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(14, 165, 233, 0.3);">
                View Full Forecast →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-align: center;">
                You're receiving this email because you enabled email notifications for these species.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                <a href="https://fishfindr.eu/findr/settings" style="color: #0ea5e9; text-decoration: none;">Manage notification preferences</a>
                ${unsubscribeUrl ? ` • <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer Text -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
          <tr>
            <td style="text-align: center; padding: 16px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2025 Findr • <a href="https://fishfindr.eu" style="color: #0ea5e9; text-decoration: none;">fishfindr.eu</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of daily digest email
 */
export function generateDailyDigestText(data: DailyDigestData): string {
  const { userName, alerts, date, unsubscribeUrl } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';

  return `
FINDR DAILY FISHING FORECAST
${date}

${greeting},

Great fishing conditions detected for ${alerts.length} species you're tracking:

${alerts.map(alert => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐟 ${alert.speciesName}
📍 ${alert.locationName}${alert.rectangleCode ? ` • ${alert.rectangleCode}` : ''}
📊 ${alert.confidence}% Confidence
`).join('')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View full forecast: https://fishfindr.eu/findr/favourites

---
You're receiving this email because you enabled email notifications for these species.
Manage notification preferences: https://fishfindr.eu/findr/settings${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ''}

© 2025 Findr • fishfindr.eu
  `.trim();
}

/**
 * Get confidence color for email badge
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 85) return '#10b981'; // green
  if (confidence >= 75) return '#0ea5e9'; // blue
  if (confidence >= 65) return '#f59e0b'; // amber
  return '#6b7280'; // gray
}

/**
 * Generate tiered daily digest HTML with species grouped by confidence bands
 * HOT BITES (85%+), GOOD CONDITIONS (60-84%), STATUS UPDATES (<60%)
 */
export function generateTieredDailyDigestHTML(data: TieredDailyDigestData): string {
  const { userName, hotBites, goodConditions, statusUpdates, date, locationName, unsubscribeUrl } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';

  const totalSpecies = hotBites.length + goodConditions.length + statusUpdates.length;

  // Helper to render species card
  const renderSpeciesCard = (alert: TieredEmailSpeciesAlert, bgColor: string) => `
    <tr>
      <td style="padding: 0 24px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${bgColor}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: top; width: 50px;">
                    ${alert.imageUrl ? `
                    <img src="${alert.imageUrl}" alt="${alert.speciesName}" width="40" height="40" style="border-radius: 6px; display: block;" />
                    ` : `
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                      🐟
                    </div>
                    `}
                  </td>
                  <td style="vertical-align: top; padding-left: 12px;">
                    <h4 style="margin: 0 0 2px; font-size: 16px; font-weight: 600; color: #111827;">
                      ${alert.speciesName}
                    </h4>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">
                      ${alert.rectangleCode || ''}
                    </p>
                  </td>
                  <td style="vertical-align: top; text-align: right;">
                    <div style="display: inline-block; background-color: ${getConfidenceColor(alert.confidence)}; color: #ffffff; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600;">
                      ${alert.confidence}%
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Findr - Daily Fishing Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🎣 Daily Fishing Digest
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${date} • ${locationName}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 24px 16px;">
              <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.5;">
                ${greeting},
              </p>
              <p style="margin: 12px 0 0; font-size: 16px; color: #374151; line-height: 1.5;">
                Here's your fishing forecast for <strong>${totalSpecies} species</strong>:
              </p>
            </td>
          </tr>

          ${hotBites.length > 0 ? `
          <!-- Hot Bites Section (85%+) -->
          <tr>
            <td style="padding: 8px 24px 12px;">
              <div style="background-color: #10b981; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                🔥 HOT BITES (${hotBites.length}) - Go Fish Now!
              </div>
            </td>
          </tr>
          ${hotBites.map(alert => renderSpeciesCard(alert, '#f0fdf4')).join('')}
          ` : ''}

          ${goodConditions.length > 0 ? `
          <!-- Good Conditions Section (60-84%) -->
          <tr>
            <td style="padding: 16px 24px 12px;">
              <div style="background-color: #0ea5e9; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                👍 GOOD CONDITIONS (${goodConditions.length}) - Worth a Trip
              </div>
            </td>
          </tr>
          ${goodConditions.map(alert => renderSpeciesCard(alert, '#f0f9ff')).join('')}
          ` : ''}

          ${statusUpdates.length > 0 ? `
          <!-- Status Updates Section (<60%) -->
          <tr>
            <td style="padding: 16px 24px 12px;">
              <div style="background-color: #6b7280; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                📊 STATUS UPDATES (${statusUpdates.length})
              </div>
            </td>
          </tr>
          ${statusUpdates.map(alert => renderSpeciesCard(alert, '#f9fafb')).join('')}
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px 24px 32px;" align="center">
              <a href="https://fishfindr.eu/findr/favourites" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(14, 165, 233, 0.3);">
                View Full Forecast →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-align: center;">
                You're receiving this daily digest because you enabled email notifications.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                <a href="https://fishfindr.eu/findr/settings" style="color: #0ea5e9; text-decoration: none;">Manage notification preferences</a>${unsubscribeUrl ? ` • <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer Text -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
          <tr>
            <td style="text-align: center; padding: 16px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2025 Findr • <a href="https://fishfindr.eu" style="color: #0ea5e9; text-decoration: none;">fishfindr.eu</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of tiered daily digest email
 */
export function generateTieredDailyDigestText(data: TieredDailyDigestData): string {
  const { userName, hotBites, goodConditions, statusUpdates, date, locationName, unsubscribeUrl } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';
  const totalSpecies = hotBites.length + goodConditions.length + statusUpdates.length;

  let text = `
FINDR DAILY FISHING DIGEST
${date} • ${locationName}

${greeting},

Here's your fishing forecast for ${totalSpecies} species:
`;

  if (hotBites.length > 0) {
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 HOT BITES (${hotBites.length}) - Go Fish Now!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    hotBites.forEach(alert => {
      text += `\n🐟 ${alert.speciesName}
📍 ${alert.rectangleCode || locationName}
📊 ${alert.confidence}% Confidence\n`;
    });
  }

  if (goodConditions.length > 0) {
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👍 GOOD CONDITIONS (${goodConditions.length}) - Worth a Trip
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    goodConditions.forEach(alert => {
      text += `\n🐟 ${alert.speciesName}
📍 ${alert.rectangleCode || locationName}
📊 ${alert.confidence}% Confidence\n`;
    });
  }

  if (statusUpdates.length > 0) {
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATUS UPDATES (${statusUpdates.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    statusUpdates.forEach(alert => {
      text += `\n🐟 ${alert.speciesName}
📍 ${alert.rectangleCode || locationName}
📊 ${alert.confidence}% Confidence\n`;
    });
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View full forecast: https://fishfindr.eu/findr/favourites

---
You're receiving this daily digest because you enabled email notifications.
Manage notification preferences: https://fishfindr.eu/findr/settings${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ''}

© 2025 Findr • fishfindr.eu
  `;

  return text.trim();
}

/**
 * Weekly Forecast Email Types
 */
export interface WeeklyForecastDay {
  date: string;         // e.g., "Mon 15"
  confidence: number;   // 0-100
}

export interface WeeklyForecastSpecies {
  speciesName: string;
  speciesCode: string;
  imageUrl: string;     // Full URL to species image
  forecast: WeeklyForecastDay[];  // 7 days
  peakDay: string;      // e.g., "Wednesday" - best day of the week
  peakConfidence: number;
}

export interface WeeklyForecastData {
  userName?: string;
  species: WeeklyForecastSpecies[];
  weekStart: string;    // e.g., "Week of January 15, 2025"
  locationName: string;
  unsubscribeUrl?: string;
}

/**
 * Enhanced Weekly Forecast Types (V2 - Revolutionary Redesign)
 */
export type Guild = 'pelagic' | 'reef_kelp' | 'benthic' | 'surf_estuary' | 'cephalopod';

export interface SpeciesBadge {
  key: string;
  emoji: string;
  label: string;
}

export interface WeeklyForecastSpeciesEnhanced extends WeeklyForecastSpecies {
  // Personality & Identity
  playfulBio?: string;           // From species.playful_bio_en
  scientificName?: string;       // From species.scientific_name
  guild?: Guild;                 // Species habitat group
  badges?: SpeciesBadge[];       // From species_badges ['shark', 'gamefish', etc.]

  // Tactical Advice
  recommendedBaits?: string[];   // From speciesAdviceData.json.contexts[].favouriteBaits
  bestTime?: string;             // From speciesAdviceData.json.contexts[].bestTime
  tideSensitivity?: string;      // From speciesAdviceData.json.contexts[].tideSensitivity
  effectiveTechnique?: string;   // From species.effective_techniques
  funFact?: string;              // From speciesAdviceData.json.funFact
}

export interface EnvironmentalSummary {
  // Water conditions
  seaTempC: number;
  seaTempTrend: 'warming' | 'cooling' | 'stable';
  waterClarity: 'excellent' | 'good' | 'moderate' | 'poor';

  // Tide pattern
  tidePattern: 'spring' | 'neap';
  nextHighTide?: string;         // ISO timestamp
  nextLowTide?: string;          // ISO timestamp

  // Weather outlook
  pressureHpa: number;
  pressureTrend: 'rising' | 'falling' | 'stable';
  waveHeightM: number;

  // Moon
  moonPhase: string;             // e.g., "Waxing Gibbous"
  moonIllumination: number;      // 0-100

  // Derived insights
  overallRating: 'exceptional' | 'good' | 'fair' | 'challenging';
  bestDaysOfWeek: string[];      // e.g., ['Wednesday', 'Thursday']
  conditionsSummary: string;     // Human-readable summary
}

export interface TacticalSummary {
  topBaits: string[];            // Aggregated across species
  topTechniques: string[];       // Key techniques for the week
  tideAdvice: string;            // "Best fishing around the flood tide"
  timeAdvice: string;            // "Dawn and dusk show best activity"
}

export interface NearbyTackleShop {
  name: string;
  address: string;
  distance: string;              // e.g., "2.5km"
  rating?: number;               // 0-5 stars
  totalRatings?: number;
  phone?: string;
  mapsUrl: string;               // Google Maps link
}

export interface WeeklyForecastDataEnhanced {
  userName?: string;
  species: WeeklyForecastSpeciesEnhanced[];
  starSpecies: WeeklyForecastSpeciesEnhanced[];  // 85%+ confidence
  weekStart: string;             // e.g., "Week of January 15, 2025"
  locationName: string;
  rectangleCode?: string;
  unsubscribeUrl?: string;

  // New enhanced data
  environmental: EnvironmentalSummary;
  tactical: TacticalSummary;

  // Nearby tackle shops for bait pickup
  tackleShops?: NearbyTackleShop[];
}

// ============================================================================
// Daily Digest V2 - Decision-focused email ("Should I fish today?")
// ============================================================================

/** Daily verdict type */
export type DailyVerdict = 'go' | 'good' | 'skip';

/** Top species for daily digest with tactical advice */
export interface DailyTopSpecies {
  speciesName: string;
  speciesCode: string;
  confidence: number;
  imageUrl?: string;
  guild?: Guild;
  // Tactical advice specific to this species
  approach: string;           // "Spinning from rocky shore at dawn"
  baits: string[];            // ["Sandeel", "Mackerel strips"]
  technique: string;          // "Spinning"
  tideAdvice: string;         // "Flood tide preferred"
}

/** Alternative species for daily digest (compact) */
export interface DailyAlternativeSpecies {
  speciesName: string;
  confidence: number;
  guild?: Guild;
}

/** Optimal fishing window for the day */
export interface OptimalWindow {
  start: string;              // "6:30 AM"
  end: string;                // "9:30 AM"
  duration: string;           // "3 hours"
  reason: string;             // "Dawn + tide alignment"
  highTide?: string;          // "7:15 AM"
  lowTide?: string;           // "1:30 PM"
  sunrise?: string;           // "6:42 AM"
  sunset?: string;            // "4:58 PM"
}

/** Conditions snapshot for daily digest (compact) */
export interface DailyConditionsSnapshot {
  seaTempC: number;
  waveHeightM: number;
  waterClarity: 'excellent' | 'good' | 'moderate' | 'poor';
  pressureTrend: 'rising' | 'falling' | 'stable';
  moonPhase: string;
  moonIllumination: number;
  windSpeedKts?: number;
}

/** Complete data for daily digest V2 email */
export interface DailyDigestDataV2 {
  userName?: string;
  date: string;               // "Wednesday, January 8"
  locationName: string;
  rectangleCode?: string;
  unsubscribeUrl?: string;

  // The verdict
  verdict: DailyVerdict;
  verdictScore: number;       // 0-100
  verdictReason: string;      // "88% Sea Bass + rising pressure = perfect"

  // Best opportunity
  topSpecies: DailyTopSpecies;

  // Alternatives (max 2, only if 70%+)
  alternatives?: DailyAlternativeSpecies[];

  // Time window
  optimalWindow: OptimalWindow;

  // Conditions snapshot
  conditions: DailyConditionsSnapshot;

  // Single nearest tackle shop
  nearestShop?: NearbyTackleShop;
}

/**
 * Guild color configuration for email theming
 */
export const GUILD_COLORS: Record<Guild, { primary: string; light: string; name: string }> = {
  pelagic: { primary: '#0369A1', light: '#e0f2fe', name: 'Ocean Blue' },
  reef_kelp: { primary: '#0D9488', light: '#ccfbf1', name: 'Teal' },
  benthic: { primary: '#D97706', light: '#fef3c7', name: 'Amber' },
  surf_estuary: { primary: '#475569', light: '#f1f5f9', name: 'Slate' },
  cephalopod: { primary: '#7C3AED', light: '#ede9fe', name: 'Purple' },
};

/**
 * Get guild colors for a species, with fallback
 */
export function getGuildColors(guild?: Guild): { primary: string; light: string } {
  if (!guild || !GUILD_COLORS[guild]) {
    return { primary: '#0ea5e9', light: '#f0f9ff' }; // Default sky blue
  }
  return GUILD_COLORS[guild];
}

/**
 * Generate HTML version of weekly forecast email with species images and 7-day charts
 */
export function generateWeeklyForecastHTML(data: WeeklyForecastData): string {
  const { userName, species, weekStart, locationName, unsubscribeUrl } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Fishing Forecast</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <!-- Main Container -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <!-- Email Content -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #ffffff;">
                📅 Your Weekly Fishing Forecast
              </h1>
              <p style="margin: 0; font-size: 16px; color: #e0f2fe;">
                ${weekStart} • ${locationName}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 24px 16px;">
              <p style="margin: 0; font-size: 16px; color: #374151;">
                ${greeting},
              </p>
              <p style="margin: 12px 0 0; font-size: 16px; color: #374151;">
                Plan your week with confidence forecasts for your ${species.length} favourite species:
              </p>
            </td>
          </tr>

          ${species.map(s => `
          <!-- Species Card: ${s.speciesName} -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 16px;">
                    <!-- Species Header with Image -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="80" valign="top">
                          <div style="width: 80px; height: 80px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                            <img src="https://fishfindr.eu${s.imageUrl}" alt="${s.speciesName}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; display: block;" />
                          </div>
                        </td>
                        <td style="padding-left: 16px;" valign="top">
                          <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #111827;">
                            ${s.speciesName}
                          </h3>
                          <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                            Best day: <strong style="color: #0ea5e9;">${s.peakDay}</strong> (${s.peakConfidence}% confidence)
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- 7-Day Forecast Chart -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                      <tr>
                        ${s.forecast.map(day => `
                        <td style="width: 14.28%; text-align: center; vertical-align: bottom; padding: 0 2px;">
                          <!-- Bar Chart -->
                          <div style="background-color: #e5e7eb; border-radius: 4px 4px 0 0; height: 60px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative;">
                            <div style="width: 100%; background: ${day.confidence >= 85 ? 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' : day.confidence >= 60 ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)'}; border-radius: 4px 4px 0 0; height: ${day.confidence}%; display: flex; align-items: center; justify-content: center;">
                              <span style="font-size: 10px; font-weight: 600; color: #ffffff;">${day.confidence}%</span>
                            </div>
                          </div>
                          <!-- Day Label -->
                          <p style="margin: 4px 0 0; font-size: 11px; font-weight: 500; color: #6b7280;">
                            ${day.date}
                          </p>
                        </td>
                        `).join('')}
                      </tr>
                    </table>

                    <!-- Legend -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                      <tr>
                        <td style="text-align: center; padding: 8px; background-color: #ffffff; border-radius: 6px;">
                          <span style="font-size: 11px; color: #6b7280;">
                            <span style="display: inline-block; width: 12px; height: 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 3px; margin-right: 4px; vertical-align: middle;"></span>
                            Hot Bites (85%+) •
                            <span style="display: inline-block; width: 12px; height: 12px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 3px; margin: 0 4px 0 8px; vertical-align: middle;"></span>
                            Good (60-84%) •
                            <span style="display: inline-block; width: 12px; height: 12px; background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); border-radius: 3px; margin: 0 4px 0 8px; vertical-align: middle;"></span>
                            Moderate (<60%)
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px 24px 32px;" align="center">
              <a href="https://fishfindr.eu/findr/favourites" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(14, 165, 233, 0.3);">
                View Full Forecast →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-align: center;">
                You're receiving this weekly forecast because you enabled email notifications.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                <a href="https://fishfindr.eu/findr/settings" style="color: #0ea5e9; text-decoration: none;">Manage notification preferences</a>${unsubscribeUrl ? ` • <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer Text -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
          <tr>
            <td style="text-align: center; padding: 16px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2025 Findr • <a href="https://fishfindr.eu" style="color: #0ea5e9; text-decoration: none;">fishfindr.eu</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of weekly forecast email
 */
export function generateWeeklyForecastText(data: WeeklyForecastData): string {
  const { userName, species, weekStart, locationName, unsubscribeUrl } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';

  let text = `
FINDR WEEKLY FISHING FORECAST
${weekStart} • ${locationName}

${greeting},

Plan your week with 7-day confidence forecasts for your ${species.length} favourite species:

`;

  species.forEach(s => {
    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐟 ${s.speciesName}
Best day: ${s.peakDay} (${s.peakConfidence}% confidence)

7-Day Forecast:
${s.forecast.map(day => {
  const bar = '█'.repeat(Math.round(day.confidence / 10));
  const confidence = day.confidence >= 85 ? '🔥' : day.confidence >= 60 ? '👍' : '📊';
  return `${day.date}: ${bar} ${day.confidence}% ${confidence}`;
}).join('\n')}

`;
  });

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View full forecast: https://fishfindr.eu/findr/favourites

---
You're receiving this weekly forecast because you enabled email notifications.
Manage notification preferences: https://fishfindr.eu/findr/settings${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ''}

© 2025 Findr • fishfindr.eu
  `;

  return text.trim();
}

/**
 * V2 REVOLUTIONARY REDESIGN
 * Enhanced weekly forecast with environmental context, star species, and tactical advice
 */

function getRatingBadge(rating: 'exceptional' | 'good' | 'fair' | 'challenging'): { bg: string; text: string; emoji: string } {
  switch (rating) {
    case 'exceptional': return { bg: '#10b981', text: '#ffffff', emoji: '🌟' };
    case 'good': return { bg: '#0ea5e9', text: '#ffffff', emoji: '👍' };
    case 'fair': return { bg: '#f59e0b', text: '#ffffff', emoji: '☁️' };
    case 'challenging': return { bg: '#6b7280', text: '#ffffff', emoji: '⚠️' };
  }
}

function getClarityBadge(clarity: 'excellent' | 'good' | 'moderate' | 'poor'): { bg: string; text: string } {
  switch (clarity) {
    case 'excellent': return { bg: '#10b981', text: '#ffffff' };
    case 'good': return { bg: '#22c55e', text: '#ffffff' };
    case 'moderate': return { bg: '#f59e0b', text: '#ffffff' };
    case 'poor': return { bg: '#ef4444', text: '#ffffff' };
  }
}

function renderStarSpeciesCard(species: WeeklyForecastSpeciesEnhanced): string {
  const colors = getGuildColors(species.guild);
  const badges = species.badges || [];
  const approachLines: string[] = [];
  if (species.effectiveTechnique) approachLines.push(`▸ ${species.effectiveTechnique}`);
  if (species.recommendedBaits && species.recommendedBaits.length > 0) approachLines.push(`▸ Baits: ${species.recommendedBaits.slice(0, 3).join(', ')}`);
  if (species.tideSensitivity) approachLines.push(`▸ ${species.tideSensitivity}`);

  return `<tr><td style="padding: 0 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.light}; border-radius: 12px; overflow: hidden;">
      <tr><td style="background: ${colors.primary}; height: 4px;"></td></tr>
      <tr><td style="padding: 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="100" valign="top"><div style="width: 100px; height: 70px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 2px solid ${colors.primary};"><img src="https://fishfindr.eu${species.imageUrl}" alt="${species.speciesName}" style="width: 100px; height: 70px; border-radius: 6px; object-fit: cover; display: block;" /></div></td>
            <td style="padding-left: 16px;" valign="top">
              <h3 style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #111827;">${species.speciesName}</h3>
              ${species.scientificName ? `<p style="margin: 0 0 8px; font-size: 13px; font-style: italic; color: #6b7280;">${species.scientificName}</p>` : ''}
              <div style="margin-top: 4px;">${badges.slice(0, 3).map(b => `<span style="display: inline-block; background-color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; color: #374151;">${b.emoji} ${b.label}</span>`).join('')}</div>
            </td>
          </tr>
        </table>
        ${species.playfulBio ? `<p style="margin: 16px 0; font-style: italic; color: #374151; font-size: 14px; line-height: 1.5; border-left: 3px solid ${colors.primary}; padding-left: 12px;">"${species.playfulBio}"</p>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr><td style="background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primary}dd 100%); padding: 12px 16px; border-radius: 8px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td><span style="color: #ffffff; font-size: 14px;">Best day this week:</span></td><td align="right"><span style="color: #ffffff; font-size: 18px; font-weight: 700;">${species.peakDay}</span><span style="color: rgba(255,255,255,0.9); font-size: 14px; margin-left: 8px;">(${species.peakConfidence}%)</span></td></tr></table>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 12px;">
          <tr>${species.forecast.map(day => {
            const isPeak = day.confidence === species.peakConfidence;
            const barColor = day.confidence >= 85 ? 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' : day.confidence >= 60 ? `linear-gradient(180deg, ${colors.primary} 0%, ${colors.primary}cc 100%)` : 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)';
            return `<td style="width: 14.28%; text-align: center; vertical-align: bottom; padding: 0 2px;"><div style="background-color: #f3f4f6; border-radius: 4px 4px 0 0; height: 50px; position: relative;"><div style="position: absolute; bottom: 0; left: 0; right: 0; background: ${barColor}; border-radius: 4px 4px 0 0; height: ${Math.max(day.confidence * 0.5, 5)}px;"></div></div><p style="margin: 4px 0 0; font-size: 10px; font-weight: ${isPeak ? '700' : '500'}; color: ${isPeak ? colors.primary : '#6b7280'};">${day.date}</p><p style="margin: 0; font-size: 9px; font-weight: 600; color: ${day.confidence >= 85 ? '#ef4444' : '#6b7280'};">${day.confidence}%</p></td>`;
          }).join('')}</tr>
        </table>
        ${approachLines.length > 0 ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background-color: #ffffff; border-radius: 8px; padding: 12px;"><tr><td><p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #111827;">🎣 Best Approach</p>${approachLines.map(line => `<p style="margin: 0 0 4px; font-size: 13px; color: #374151;">${line}</p>`).join('')}</td></tr></table>` : ''}
        ${species.funFact ? `<p style="margin: 12px 0 0; font-size: 12px; color: #6b7280;">💡 <em>${species.funFact}</em></p>` : ''}
      </td></tr>
    </table>
  </td></tr>`;
}

function renderCompactSpeciesRow(species: WeeklyForecastSpeciesEnhanced): string {
  const colors = getGuildColors(species.guild);
  return `<tr><td style="padding: 0 24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden; border-left: 4px solid ${colors.primary};">
      <tr><td style="padding: 12px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50" valign="middle"><div style="width: 45px; height: 45px; background-color: #ffffff; border-radius: 6px; overflow: hidden;"><img src="https://fishfindr.eu${species.imageUrl}" alt="${species.speciesName}" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover; display: block;" /></div></td>
            <td style="padding-left: 12px;" valign="middle"><h4 style="margin: 0 0 2px; font-size: 15px; font-weight: 600; color: #111827;">${species.speciesName}</h4><p style="margin: 0; font-size: 12px; color: #6b7280;">Peak: ${species.peakDay}</p></td>
            <td width="80" align="right" valign="middle"><div style="background-color: ${species.peakConfidence >= 75 ? '#22c55e' : species.peakConfidence >= 60 ? '#0ea5e9' : '#6b7280'}; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; display: inline-block;">${species.peakConfidence}%</div></td>
          </tr>
          <tr><td colspan="3" style="padding-top: 8px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>${species.forecast.map(day => `<td style="width: 14.28%; padding: 0 1px;"><div style="background-color: #e5e7eb; height: 20px; border-radius: 2px; position: relative;"><div style="position: absolute; bottom: 0; left: 0; right: 0; background: ${day.confidence >= 85 ? '#ef4444' : day.confidence >= 60 ? colors.primary : '#94a3b8'}; height: ${Math.max(day.confidence * 0.2, 2)}px; border-radius: 2px;"></div></div></td>`).join('')}</tr></table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

export function generateWeeklyForecastHTMLV2(data: WeeklyForecastDataEnhanced): string {
  const { userName, starSpecies, species, weekStart, locationName, rectangleCode, unsubscribeUrl, environmental, tactical, tackleShops } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';
  const regularSpecies = species.filter(s => s.peakConfidence < 85);
  const ratingBadge = getRatingBadge(environmental.overallRating);
  const clarityBadge = getClarityBadge(environmental.waterClarity);

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your Weekly Fishing Forecast</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
  <tr><td style="background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 50%, #38bdf8 100%); padding: 36px 24px; text-align: center;">
    <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 700; color: #ffffff;">🎣 Your Week on the Water</h1>
    <p style="margin: 0 0 16px; font-size: 18px; color: #e0f2fe; font-weight: 500;">${weekStart.replace('Week of ', '')}</p>
    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr>
      <td style="background-color: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px;"><span style="color: #ffffff; font-size: 14px;">📍 ${locationName}</span>${rectangleCode ? `<span style="color: rgba(255,255,255,0.8); font-size: 14px; margin-left: 8px;">• ${rectangleCode}</span>` : ''}</td>
      <td width="12"></td>
      <td style="background-color: ${ratingBadge.bg}; padding: 8px 16px; border-radius: 20px;"><span style="color: ${ratingBadge.text}; font-size: 14px; font-weight: 600;">${ratingBadge.emoji} ${environmental.overallRating.charAt(0).toUpperCase() + environmental.overallRating.slice(1)} Conditions</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding: 24px 24px 16px;"><p style="margin: 0; font-size: 16px; color: #374151;">${greeting},</p><p style="margin: 8px 0 0; font-size: 15px; color: #374151; line-height: 1.5;">${environmental.conditionsSummary}</p></td></tr>
  <tr><td style="padding: 0 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 12px; overflow: hidden; border: 1px solid #bae6fd;">
      <tr><td style="padding: 16px;">
        <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #0369a1;">📊 Environmental Briefing</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 25%; padding: 8px; text-align: center;"><p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase;">Water</p><p style="margin: 0; font-size: 18px; font-weight: 700; color: #0369a1;">${Math.round(environmental.seaTempC)}°C</p><p style="margin: 2px 0 0; font-size: 10px; color: #6b7280;">${environmental.seaTempTrend === 'warming' ? '↑ warming' : environmental.seaTempTrend === 'cooling' ? '↓ cooling' : '→ stable'}</p></td>
            <td style="width: 25%; padding: 8px; text-align: center;"><p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase;">Clarity</p><div style="display: inline-block; background-color: ${clarityBadge.bg}; color: ${clarityBadge.text}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${environmental.waterClarity}</div></td>
            <td style="width: 25%; padding: 8px; text-align: center;"><p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase;">Tides</p><p style="margin: 0; font-size: 15px; font-weight: 600; color: #0369a1;">${environmental.tidePattern === 'spring' ? '🌊 Spring' : '〰️ Neap'}</p></td>
            <td style="width: 25%; padding: 8px; text-align: center;"><p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase;">Moon</p><p style="margin: 0; font-size: 14px; font-weight: 600; color: #0369a1;">${environmental.moonPhase}</p><p style="margin: 2px 0 0; font-size: 10px; color: #6b7280;">${Math.round(environmental.moonIllumination)}% lit</p></td>
          </tr>
          <tr><td colspan="4" style="padding-top: 12px; border-top: 1px solid #bae6fd;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="width: 50%; padding: 4px 0;"><span style="font-size: 12px; color: #6b7280;">Pressure:</span><span style="font-size: 12px; font-weight: 600; color: #374151; margin-left: 4px;">${Math.round(environmental.pressureHpa)} hPa ${environmental.pressureTrend === 'rising' ? '↑' : environmental.pressureTrend === 'falling' ? '↓' : '→'}</span></td><td style="width: 50%; padding: 4px 0;"><span style="font-size: 12px; color: #6b7280;">Waves:</span><span style="font-size: 12px; font-weight: 600; color: #374151; margin-left: 4px;">${environmental.waveHeightM.toFixed(1)}m ${environmental.waveHeightM < 1 ? '(calm)' : environmental.waveHeightM < 2 ? '(light)' : '(moderate)'}</span></td></tr><tr><td colspan="2" style="padding-top: 8px;"><span style="font-size: 12px; color: #6b7280;">Best days:</span><span style="font-size: 12px; font-weight: 700; color: #0369a1; margin-left: 4px;">${environmental.bestDaysOfWeek.join(' & ')}</span></td></tr></table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  ${starSpecies.length > 0 ? `<tr><td style="padding: 0 24px 12px;"><h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #111827;">⭐ Star Species <span style="font-weight: 400; color: #6b7280; font-size: 14px;">(85%+ confidence)</span></h2></td></tr>${starSpecies.map(s => renderStarSpeciesCard(s)).join('')}` : ''}
  ${regularSpecies.length > 0 ? `<tr><td style="padding: 8px 24px 12px;"><h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #111827;">📋 Your Weekly Lineup <span style="font-weight: 400; color: #6b7280; font-size: 14px;">(${regularSpecies.length} more species)</span></h2></td></tr>${regularSpecies.map(s => renderCompactSpeciesRow(s)).join('')}` : ''}
  <tr><td style="padding: 12px 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; overflow: hidden; border: 1px solid #fbbf24;">
      <tr><td style="padding: 16px;">
        <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #92400e;">🧰 Tactical Toolkit</h3>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width: 50%; vertical-align: top; padding-right: 8px;">${tactical.topBaits.length > 0 ? `<p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #92400e;">Top Baits</p><p style="margin: 0 0 12px; font-size: 13px; color: #78350f;">${tactical.topBaits.slice(0, 4).join(', ')}</p>` : ''}<p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #92400e;">Tide Advice</p><p style="margin: 0; font-size: 13px; color: #78350f;">${tactical.tideAdvice}</p></td>
          <td style="width: 50%; vertical-align: top; padding-left: 8px;">${tactical.topTechniques.length > 0 ? `<p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #92400e;">Key Techniques</p><p style="margin: 0 0 12px; font-size: 13px; color: #78350f;">${tactical.topTechniques.slice(0, 3).join(', ')}</p>` : ''}<p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #92400e;">Best Times</p><p style="margin: 0; font-size: 13px; color: #78350f;">${tactical.timeAdvice}</p></td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
  ${tackleShops && tackleShops.length > 0 ? `<tr><td style="padding: 0 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; overflow: hidden; border: 1px solid #6ee7b7;">
      <tr><td style="padding: 16px;">
        <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #065f46;">🏪 Stock Up on Bait</h3>
        <p style="margin: 0 0 12px; font-size: 13px; color: #047857;">Tackle shops near your fishing area:</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${tackleShops.map((shop, i) => `<tr><td style="padding: ${i > 0 ? '8px 0 0' : '0'};">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(255,255,255,0.7); border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="padding: 10px 12px; vertical-align: top;">
                  <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #065f46;">${shop.name}</p>
                  <p style="margin: 0 0 4px; font-size: 12px; color: #047857;">${shop.address}</p>
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td><span style="font-size: 11px; color: #6b7280;">📍 ${shop.distance}</span></td>
                    ${shop.rating ? `<td style="padding-left: 12px;"><span style="font-size: 11px; color: #6b7280;">⭐ ${shop.rating.toFixed(1)}${shop.totalRatings ? ` (${shop.totalRatings})` : ''}</span></td>` : ''}
                  </tr></table>
                </td>
                <td style="padding: 10px 12px; width: 90px; text-align: right; vertical-align: middle;">
                  <a href="https://fishfindr.eu/findr/info${rectangleCode ? `?rect=${rectangleCode}` : ''}#tackle-shops" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 600;">View Shops</a>
                </td>
              </tr>
            </table>
          </td></tr>`).join('')}
        </table>
      </td></tr>
    </table>
  </td></tr>` : ''}
  <tr><td style="padding: 8px 24px 32px;" align="center"><a href="https://fishfindr.eu/findr/favourites" style="display: inline-block; background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);">View Live Forecast →</a></td></tr>
  <tr><td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;"><p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-align: center;">You're receiving this weekly forecast because you enabled email notifications.</p><p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;"><a href="https://fishfindr.eu/findr/settings" style="color: #0ea5e9; text-decoration: none;">Manage preferences</a>${unsubscribeUrl ? ` • <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>` : ''}</p></td></tr>
</table>
<table width="600" cellpadding="0" cellspacing="0" style="margin-top: 16px;"><tr><td style="text-align: center; padding: 16px;"><p style="margin: 0; font-size: 12px; color: #9ca3af;">© 2025 Findr • <a href="https://fishfindr.eu" style="color: #0ea5e9; text-decoration: none;">fishfindr.eu</a></p></td></tr></table>
</td></tr></table>
</body></html>`.trim();
}

export function generateWeeklyForecastTextV2(data: WeeklyForecastDataEnhanced): string {
  const { userName, starSpecies, species, weekStart, locationName, rectangleCode, unsubscribeUrl, environmental, tactical, tackleShops } = data;
  const greeting = userName ? `Hi ${userName}` : 'Hello';
  const regularSpecies = species.filter(s => s.peakConfidence < 85);
  const bar = (conf: number) => '█'.repeat(Math.round(conf / 10)) + '░'.repeat(10 - Math.round(conf / 10));

  let text = `╔════════════════════════════════════════════════════════════╗
║       🎣 YOUR WEEK ON THE WATER - FINDR FORECAST           ║
╚════════════════════════════════════════════════════════════╝

${weekStart.replace('Week of ', '')}
📍 ${locationName}${rectangleCode ? ` • ${rectangleCode}` : ''}
${environmental.overallRating.toUpperCase()} CONDITIONS

${greeting},

${environmental.conditionsSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ENVIRONMENTAL BRIEFING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌡️ Water: ${Math.round(environmental.seaTempC)}°C (${environmental.seaTempTrend})
💧 Clarity: ${environmental.waterClarity}
🌊 Tides: ${environmental.tidePattern === 'spring' ? 'Spring tides' : 'Neap tides'}
🌙 Moon: ${environmental.moonPhase} (${Math.round(environmental.moonIllumination)}% lit)
📈 Pressure: ${Math.round(environmental.pressureHpa)} hPa (${environmental.pressureTrend})
🌊 Waves: ${environmental.waveHeightM.toFixed(1)}m

⭐ Best days: ${environmental.bestDaysOfWeek.join(' & ')}
`;

  if (starSpecies.length > 0) {
    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ STAR SPECIES (85%+ confidence)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    starSpecies.forEach(s => {
      text += `

🐟 ${s.speciesName}${s.scientificName ? ` (${s.scientificName})` : ''}
   Peak: ${s.peakDay} at ${s.peakConfidence}% confidence

   7-Day: ${s.forecast.map(d => `${d.date}: ${bar(d.confidence)} ${d.confidence}%`).join('\n         ')}
${s.playfulBio ? `\n   "${s.playfulBio}"` : ''}
   🎣 Best Approach:${s.effectiveTechnique ? `\n   ▸ ${s.effectiveTechnique}` : ''}${s.recommendedBaits?.length ? `\n   ▸ Baits: ${s.recommendedBaits.slice(0, 3).join(', ')}` : ''}${s.tideSensitivity ? `\n   ▸ ${s.tideSensitivity}` : ''}`;
    });
  }

  if (regularSpecies.length > 0) {
    text += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 YOUR WEEKLY LINEUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    regularSpecies.forEach(s => {
      text += `

🐟 ${s.speciesName} - Peak: ${s.peakDay} (${s.peakConfidence}%)
   ${s.forecast.map(d => `${d.date.split(' ')[0]}:${bar(d.confidence)}`).join(' ')}`;
    });
  }

  text += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧰 TACTICAL TOOLKIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${tactical.topBaits.length > 0 ? `Top Baits: ${tactical.topBaits.slice(0, 4).join(', ')}\n` : ''}${tactical.topTechniques.length > 0 ? `Key Techniques: ${tactical.topTechniques.slice(0, 3).join(', ')}\n` : ''}Tide Advice: ${tactical.tideAdvice}
Best Times: ${tactical.timeAdvice}`;

  if (tackleShops && tackleShops.length > 0) {
    text += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 STOCK UP ON BAIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tackle shops near your fishing area:
`;
    tackleShops.forEach((shop, i) => {
      text += `
${i + 1}. ${shop.name}
   ${shop.address}
   📍 ${shop.distance}${shop.rating ? ` • ⭐ ${shop.rating.toFixed(1)}` : ''}`;
    });
    text += `

View all shops: https://fishfindr.eu/findr/info${rectangleCode ? `?rect=${rectangleCode}` : ''}#tackle-shops`;
  }

  text += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View live forecast: https://fishfindr.eu/findr/favourites

---
You're receiving this weekly forecast because you enabled email notifications.
Manage preferences: https://fishfindr.eu/findr/settings${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ''}

© 2025 Findr • fishfindr.eu`;

  return text.trim();
}

// ============================================================================
// Daily Digest V2 Template Functions - Decision-focused email
// ============================================================================

/**
 * Get verdict banner colors and styling - V3 Modern Design
 * Using teal/coral palette for premium feel
 */
function getVerdictStyle(verdict: DailyVerdict): {
  bgGradient: string;
  emoji: string;
  headline: string;
  subheadline: string;
  textColor: string;
  accentColor: string;
} {
  switch (verdict) {
    case 'go':
      return {
        bgGradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)',
        emoji: '🎣',
        headline: 'Perfect Day to Fish',
        subheadline: 'Conditions are ideal — get out there!',
        textColor: '#ffffff',
        accentColor: '#f97316', // coral
      };
    case 'good':
      return {
        bgGradient: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 50%, #38bdf8 100%)',
        emoji: '👍',
        headline: 'Good Fishing Ahead',
        subheadline: 'Solid conditions for a trip',
        textColor: '#ffffff',
        accentColor: '#14b8a6', // teal
      };
    case 'skip':
      return {
        bgGradient: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
        emoji: '☕',
        headline: 'Better Days Coming',
        subheadline: 'Save your energy for tomorrow',
        textColor: '#ffffff',
        accentColor: '#94a3b8',
      };
  }
}

/**
 * Generate casual, fun copy based on species and confidence
 */
function getCasualCopy(speciesName: string, confidence: number): string {
  if (confidence >= 90) {
    return `${speciesName} is absolutely vibing today — this is as good as it gets!`;
  } else if (confidence >= 80) {
    return `${speciesName} is looking really promising. Great day for a session!`;
  } else if (confidence >= 70) {
    return `${speciesName} conditions are solid. Worth getting out there!`;
  } else {
    return `${speciesName} might show up. Patience could pay off.`;
  }
}

/**
 * Generate confidence bar HTML (visual progress bar)
 */
function renderConfidenceBar(confidence: number): string {
  const barColor = confidence >= 85 ? '#10b981' : confidence >= 70 ? '#0d9488' : confidence >= 55 ? '#f59e0b' : '#94a3b8';
  const barWidth = Math.min(100, Math.max(0, confidence));

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e5e7eb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="width: ${barWidth}%; background: linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 100%); height: 8px;"></td>
              <td style="width: ${100 - barWidth}%; height: 8px;"></td>
            </tr>
          </table>
        </td>
        <td style="width: 50px; text-align: right; padding-left: 12px;">
          <span style="font-size: 18px; font-weight: 700; color: ${barColor};">${confidence}%</span>
        </td>
      </tr>
    </table>`;
}

/**
 * Generate bite score meter (horizontal battery-style gauge)
 */
function renderBiteScoreMeter(score: number): string {
  // Convert score to 5 segments
  const filledSegments = Math.round((score / 100) * 5);
  const segmentColor = score >= 80 ? '#10b981' : score >= 60 ? '#0d9488' : score >= 40 ? '#f59e0b' : '#ef4444';

  let segments = '';
  for (let i = 0; i < 5; i++) {
    const filled = i < filledSegments;
    segments += `<td style="width: 18%; padding: 0 2px;">
      <div style="height: 24px; background-color: ${filled ? segmentColor : '#e5e7eb'}; border-radius: 4px;"></div>
    </td>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width: 80px; padding-right: 12px;">
          <p style="margin: 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Bite Score</p>
        </td>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>${segments}</tr>
          </table>
        </td>
        <td style="width: 50px; text-align: right; padding-left: 8px;">
          <span style="font-size: 16px; font-weight: 700; color: ${segmentColor};">${score}</span>
        </td>
      </tr>
    </table>`;
}

/**
 * Wave SVG pattern for header (email-safe inline)
 */
function getWaveSvg(color1: string, color2: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" style="display: block; width: 100%; height: 50px;">
    <path fill="${color1}" fill-opacity="0.3" d="M0,32L48,37.3C96,43,192,53,288,58.7C384,64,480,64,576,58.7C672,53,768,43,864,42.7C960,43,1056,53,1152,53.3C1248,53,1344,43,1392,37.3L1440,32L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
    <path fill="${color2}" fill-opacity="0.5" d="M0,64L48,58.7C96,53,192,43,288,42.7C384,43,480,53,576,58.7C672,64,768,64,864,58.7C960,53,1056,43,1152,37.3C1248,32,1344,32,1392,32L1440,32L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
  </svg>`;
}

/**
 * Generate HTML email for Daily Digest V2 - Modern Premium Design
 * Features: Wave header, species spotlight, confidence gauge, bite score meter
 * "Should I fish today?" with GO/GOOD verdict and optimal window
 */
export function generateDailyDigestHTMLV2(data: DailyDigestDataV2): string {
  const {
    userName,
    date,
    locationName,
    rectangleCode,
    unsubscribeUrl,
    verdict,
    verdictScore,
    verdictReason,
    topSpecies,
    alternatives,
    optimalWindow,
    conditions,
    nearestShop,
  } = data;

  const greeting = userName ? userName : 'friend';
  const verdictStyle = getVerdictStyle(verdict);
  const guildColors = getGuildColors(topSpecies.guild);
  const casualCopy = getCasualCopy(topSpecies.speciesName, topSpecies.confidence);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Findr - ${verdictStyle.headline}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);">

          <!-- WAVE HEADER WITH VERDICT -->
          <tr>
            <td style="background: ${verdictStyle.bgGradient}; padding: 40px 32px 20px; text-align: center;">
              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: ${verdictStyle.textColor};">
                ${verdictStyle.emoji} ${verdictStyle.headline}
              </h1>
              <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.9);">
                ${verdictReason}
              </p>
            </td>
          </tr>
          <!-- Wave decoration -->
          <tr>
            <td style="background: ${verdictStyle.bgGradient}; padding: 0; line-height: 0;">
              ${getWaveSvg('#ffffff', '#ffffff')}
            </td>
          </tr>

          <!-- GREETING & LOCATION -->
          <tr>
            <td style="padding: 24px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 15px; color: #334155;">Hey ${greeting} 👋</p>
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                      📍 ${locationName}${rectangleCode ? ` • ${rectangleCode}` : ''} &nbsp;·&nbsp; ${date}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BITE SCORE METER -->
          <tr>
            <td style="padding: 16px 32px 24px;">
              ${renderBiteScoreMeter(verdictScore || topSpecies.confidence)}
            </td>
          </tr>

          <!-- SPECIES SPOTLIGHT HERO -->
          <tr>
            <td style="padding: 0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, ${guildColors.light} 0%, #ffffff 100%); border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
                <!-- Large fish image hero -->
                <tr>
                  <td style="padding: 24px 24px 16px; text-align: center;">
                    ${topSpecies.imageUrl
                      ? `<div style="display: inline-block; background-color: #ffffff; border-radius: 16px; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                          <img src="https://fishfindr.eu${topSpecies.imageUrl}" alt="${topSpecies.speciesName}" style="width: 160px; height: 160px; border-radius: 12px; object-fit: cover; display: block;" />
                        </div>`
                      : `<div style="display: inline-block; width: 160px; height: 160px; background: ${guildColors.primary}; border-radius: 16px; font-size: 72px; line-height: 160px;">🐟</div>`
                    }
                  </td>
                </tr>
                <!-- Species name and casual copy -->
                <tr>
                  <td style="padding: 0 24px; text-align: center;">
                    <h2 style="margin: 0 0 8px; font-size: 26px; font-weight: 700; color: #0f172a;">${topSpecies.speciesName}</h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.5;">${casualCopy}</p>
                  </td>
                </tr>
                <!-- Confidence bar -->
                <tr>
                  <td style="padding: 0 24px 20px;">
                    ${renderConfidenceBar(topSpecies.confidence)}
                  </td>
                </tr>
                <!-- Tactical tips grid -->
                <tr>
                  <td style="padding: 0 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="8">
                      <tr>
                        <td style="width: 50%; background-color: #ffffff; border-radius: 10px; padding: 14px; vertical-align: top; border: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 4px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Technique</p>
                          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #334155;">${topSpecies.technique}</p>
                        </td>
                        <td style="width: 50%; background-color: #ffffff; border-radius: 10px; padding: 14px; vertical-align: top; border: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 4px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Best Baits</p>
                          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #334155;">${topSpecies.baits.slice(0, 2).join(', ')}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="background-color: #ffffff; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 4px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Tide Advice</p>
                          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #334155;">${topSpecies.tideAdvice}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- OPTIMAL WINDOW - Clean modern card -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 50px; vertical-align: top;">
                          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 12px; text-align: center; line-height: 44px; font-size: 22px;">⏰</div>
                        </td>
                        <td style="padding-left: 16px; vertical-align: top;">
                          <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Best Time to Fish</p>
                          <p style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">${optimalWindow.start} – ${optimalWindow.end}</p>
                          <p style="margin: 4px 0 0; font-size: 14px; color: #cbd5e1;">${optimalWindow.duration} window • ${optimalWindow.reason}</p>
                        </td>
                      </tr>
                    </table>
                    <!-- Sun & Tide times -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background-color: rgba(255,255,255,0.05); border-radius: 10px; padding: 12px;">
                      <tr>
                        ${optimalWindow.sunrise ? `<td style="text-align: center; padding: 8px;"><p style="margin: 0 0 2px; font-size: 18px;">☀️</p><p style="margin: 0; font-size: 12px; color: #94a3b8;">Sunrise</p><p style="margin: 2px 0 0; font-size: 14px; font-weight: 600; color: #ffffff;">${optimalWindow.sunrise}</p></td>` : ''}
                        ${optimalWindow.highTide ? `<td style="text-align: center; padding: 8px;"><p style="margin: 0 0 2px; font-size: 18px;">🌊</p><p style="margin: 0; font-size: 12px; color: #94a3b8;">High Tide</p><p style="margin: 2px 0 0; font-size: 14px; font-weight: 600; color: #ffffff;">${optimalWindow.highTide}</p></td>` : ''}
                        ${optimalWindow.lowTide ? `<td style="text-align: center; padding: 8px;"><p style="margin: 0 0 2px; font-size: 18px;">〰️</p><p style="margin: 0; font-size: 12px; color: #94a3b8;">Low Tide</p><p style="margin: 2px 0 0; font-size: 14px; font-weight: 600; color: #ffffff;">${optimalWindow.lowTide}</p></td>` : ''}
                        ${optimalWindow.sunset ? `<td style="text-align: center; padding: 8px;"><p style="margin: 0 0 2px; font-size: 18px;">🌅</p><p style="margin: 0; font-size: 12px; color: #94a3b8;">Sunset</p><p style="margin: 2px 0 0; font-size: 14px; font-weight: 600; color: #ffffff;">${optimalWindow.sunset}</p></td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONDITIONS DASHBOARD -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Conditions at a Glance</p>
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  <td style="width: 33%; background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 24px;">🌡️</p>
                    <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">${Math.round(conditions.seaTempC)}°C</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Water Temp</p>
                  </td>
                  <td style="width: 33%; background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 24px;">🌊</p>
                    <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">${conditions.waveHeightM.toFixed(1)}m</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Wave Height</p>
                  </td>
                  <td style="width: 33%; background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 24px;">💧</p>
                    <div style="display: inline-block; background-color: ${getClarityBadge(conditions.waterClarity).bg}; color: #ffffff; padding: 4px 12px; border-radius: 8px; font-size: 14px; font-weight: 600;">${conditions.waterClarity}</div>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Clarity</p>
                  </td>
                </tr>
                <tr>
                  <td style="width: 33%; background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 24px;">${conditions.pressureTrend === 'rising' ? '📈' : conditions.pressureTrend === 'falling' ? '📉' : '➡️'}</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${conditions.pressureTrend === 'rising' ? 'Rising' : conditions.pressureTrend === 'falling' ? 'Falling' : 'Stable'}</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Pressure</p>
                  </td>
                  <td style="width: 33%; background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 24px;">🌙</p>
                    <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">${conditions.moonPhase}</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">${Math.round(conditions.moonIllumination)}% illuminated</p>
                  </td>
                  <td style="width: 33%; background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 24px;">💨</p>
                    <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">${conditions.windSpeedKts || '–'}</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Wind (kts)</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${alternatives && alternatives.length > 0 ? `
          <!-- OTHER SPECIES -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Also On the Radar</p>
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  ${alternatives.slice(0, 2).map(alt => {
                    const altColors = getGuildColors(alt.guild);
                    return `<td style="width: 50%; background-color: #ffffff; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #0f172a;">${alt.speciesName}</p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e5e7eb; border-radius: 4px; overflow: hidden;">
                              <tr>
                                <td style="width: ${alt.confidence}%; background-color: ${altColors.primary}; height: 6px;"></td>
                                <td style="width: ${100 - alt.confidence}%; height: 6px;"></td>
                              </tr>
                            </table>
                            <p style="margin: 6px 0 0; font-size: 13px; font-weight: 600; color: ${altColors.primary};">${alt.confidence}% match</p>
                          </td>
                        </tr>
                      </table>
                    </td>`;
                  }).join('')}
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          ${nearestShop ? `
          <!-- TACKLE SHOP -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 36px; height: 36px; background-color: #0d9488; border-radius: 10px; text-align: center; line-height: 36px; font-size: 18px;">🏪</div>
                        </td>
                        <td style="padding-left: 12px; vertical-align: top;">
                          <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #0f172a;">${nearestShop.name}</p>
                          <p style="margin: 0; font-size: 12px; color: #64748b;">${nearestShop.distance} away${nearestShop.rating ? ` • ⭐ ${nearestShop.rating.toFixed(1)}` : ''}</p>
                        </td>
                        <td style="width: 80px; text-align: right; vertical-align: middle;">
                          <a href="https://fishfindr.eu/findr/info${rectangleCode ? `?rect=${rectangleCode}` : ''}#tackle-shops" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;">View</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA BUTTON -->
          <tr>
            <td style="padding: 8px 32px 32px;" align="center">
              <a href="https://fishfindr.eu/findr/favourites" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);">
                View Full Forecast →
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-align: center;">
                Sent with 🎣 by Findr • Only on good fishing days
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                <a href="https://fishfindr.eu/findr/settings" style="color: #0d9488; text-decoration: none;">Manage preferences</a>
                ${unsubscribeUrl ? ` · <a href="${unsubscribeUrl}" style="color: #94a3b8; text-decoration: none;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>

        </table>

        <!-- FOOTER BRANDING -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 16px;">
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                © 2025 Findr · <a href="https://fishfindr.eu" style="color: #0d9488; text-decoration: none;">fishfindr.eu</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Generate plain text version of Daily Digest V2 email
 */
export function generateDailyDigestTextV2(data: DailyDigestDataV2): string {
  const {
    userName,
    date,
    locationName,
    rectangleCode,
    unsubscribeUrl,
    verdict,
    verdictReason,
    topSpecies,
    alternatives,
    optimalWindow,
    conditions,
    nearestShop,
  } = data;

  const greeting = userName ? `Hi ${userName}` : 'Hello';
  const verdictText = verdict === 'go' ? '🎯 GO FISH!' : verdict === 'good' ? '👍 GOOD DAY' : '⏸️ SKIP TODAY';

  let text = `╔════════════════════════════════════════════════════════════╗
║                    ${verdictText.padEnd(38)}║
╚════════════════════════════════════════════════════════════╝

${verdictReason}

📍 ${locationName}${rectangleCode ? ` • ${rectangleCode}` : ''}
📅 ${date}

${greeting}, here's your fishing opportunity for today:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 YOUR BEST OPPORTUNITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐟 ${topSpecies.speciesName} - ${topSpecies.confidence}% Confidence

🎣 Approach: ${topSpecies.approach}
🪱 Baits: ${topSpecies.baits.join(', ')}
🎯 Technique: ${topSpecies.technique}
🌊 Tide: ${topSpecies.tideAdvice}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ OPTIMAL WINDOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

>>> ${optimalWindow.start} - ${optimalWindow.end} (${optimalWindow.duration}) <<<

${optimalWindow.sunrise ? `☀️ Sunrise: ${optimalWindow.sunrise}` : ''}
${optimalWindow.highTide ? `🌊 High tide: ${optimalWindow.highTide}` : ''}
${optimalWindow.lowTide ? `〰️ Low tide: ${optimalWindow.lowTide}` : ''}
${optimalWindow.sunset ? `🌅 Sunset: ${optimalWindow.sunset}` : ''}

"${optimalWindow.reason}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌊 CONDITIONS AT A GLANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌡️ Water: ${Math.round(conditions.seaTempC)}°C
🌊 Waves: ${conditions.waveHeightM.toFixed(1)}m
💧 Clarity: ${conditions.waterClarity}
📈 Pressure: ${conditions.pressureTrend}
🌙 Moon: ${conditions.moonPhase} (${Math.round(conditions.moonIllumination)}%)
${conditions.windSpeedKts ? `💨 Wind: ${conditions.windSpeedKts} kts` : ''}
`;

  if (alternatives && alternatives.length > 0) {
    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ALSO LOOKING GOOD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    alternatives.slice(0, 2).forEach(alt => {
      text += `• ${alt.speciesName} - ${alt.confidence}%\n`;
    });
  }

  if (nearestShop) {
    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 STOCK UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${nearestShop.name}
${nearestShop.address}
📍 ${nearestShop.distance}${nearestShop.rating ? ` • ⭐ ${nearestShop.rating.toFixed(1)}` : ''}

View shops: https://fishfindr.eu/findr/info${rectangleCode ? `?rect=${rectangleCode}#tackle-shops` : '#tackle-shops'}
`;
  }

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View full forecast: https://fishfindr.eu/findr/favourites

---
You're receiving this daily digest because you enabled email notifications.
Manage preferences: https://fishfindr.eu/findr/settings${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ''}

© 2025 Findr • fishfindr.eu`;

  return text.trim();
}
