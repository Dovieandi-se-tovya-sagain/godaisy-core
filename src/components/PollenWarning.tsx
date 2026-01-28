import React from 'react';
import OptimizedImage from './OptimizedImage';
import { PollenLevel, PollenAssessment, getPollenLevelDescription, assessPollenConditions, PollenSummary, getPollenIndex } from '../utils/pollenUtils';

interface PollenWarningProps {
  pollen?: PollenSummary;
  assessment?: PollenAssessment;
  mode?: 'compact' | 'full';
  className?: string;
}

/**
 * Get color for pollen level - health-focused color scheme
 */
function getPollenLevelColor(level: PollenLevel): string {
  switch (level) {
    case PollenLevel.NONE: return '#6b7280'; // Gray for no data/none
    case PollenLevel.LOW: return '#2ECC71'; // Green - Little to no pollen risk
    case PollenLevel.MODERATE: return '#F1C40F'; // Yellow - Noticeable for some  
    case PollenLevel.HIGH: return '#E67E22'; // Orange - Difficult for allergy sufferers
    case PollenLevel.VERY_HIGH: return '#E74C3C'; // Red - Severe, strong risk
    case PollenLevel.EXTREME: return '#8E44AD'; // Purple - Unusually severe
    default: return '#6b7280'; // Gray fallback
  }
}

/**
 * Get background color with opacity for better visual hierarchy
 */
function getPollenBackgroundColor(level: PollenLevel): string {
  switch (level) {
    case PollenLevel.NONE: return 'rgba(107, 114, 128, 0.1)'; // Light gray
    case PollenLevel.LOW: return 'rgba(46, 204, 113, 0.1)'; // Light green
    case PollenLevel.MODERATE: return 'rgba(241, 196, 15, 0.15)'; // Light yellow
    case PollenLevel.HIGH: return 'rgba(230, 126, 34, 0.15)'; // Light orange
    case PollenLevel.VERY_HIGH: return 'rgba(231, 76, 60, 0.15)'; // Light red
    case PollenLevel.EXTREME: return 'rgba(142, 68, 173, 0.15)'; // Light purple
    default: return 'rgba(107, 114, 128, 0.1)'; // Light gray
  }
}

/**
 * Get appropriate pollen type icon
 */
function getPollenTypeIcon(type: 'grass' | 'tree' | 'weed' | 'all'): string {
  const basePath = '/weather-icons/design/fill/final';
  switch (type) {
    case 'grass': return `${basePath}/pollen-grass.svg`;
    case 'tree': return `${basePath}/pollen-tree.svg`;  
    case 'weed': return `${basePath}/pollen-flower.svg`; // Using flower for weed pollen
    case 'all': return `${basePath}/pollen.svg`; // General pollen icon
    default: return `${basePath}/pollen.svg`;
  }
}

/**
 * Individual pollen type indicator component - compact icon-only version
 */
function PollenTypeIndicator({ 
  type, 
  level, 
  value 
}: { 
  type: 'grass' | 'tree' | 'weed'; 
  level: PollenLevel; 
  value?: number;
}) {
  if (level === PollenLevel.NONE) return null;

  const color = getPollenLevelColor(level);
  const bgColor = getPollenBackgroundColor(level);
  const levelText = getPollenLevelDescription(level);
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  
  // Create comprehensive tooltip text
  const tooltipText = `${typeLabel} pollen: ${levelText} level${value ? ` (index ${getPollenIndex(value)})` : ''}`;
  
  return (
    <div 
      className="pollen-type-indicator"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px', // 60% of original 20px would be 12px, but 16px for better visibility
        height: '16px',
        borderRadius: '50%', // Perfect circle
        backgroundColor: bgColor,
        border: `2px solid ${color}`, // Slightly thicker border for definition
        cursor: 'help',
        flexShrink: 0 // Prevent shrinking in flex containers
      }}
      role="status"
      aria-label={tooltipText}
      title={tooltipText}
    >
      <OptimizedImage 
        src={getPollenTypeIcon(type)}
        alt=""
        width={15}
        height={15}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}

/**
 * Overall pollen level indicator for compact mode - icon-only version
 */
function OverallPollenIndicator({ 
  level, 
  assessment 
}: { 
  level: PollenLevel; 
  assessment: PollenAssessment;
}) {
  if (level === PollenLevel.NONE) return null;

  const color = getPollenLevelColor(level);
  const bgColor = getPollenBackgroundColor(level);
  const levelText = getPollenLevelDescription(level);
  
  // Count active pollen types for summary
  const activeTypes: string[] = [];
  if (assessment.grass > PollenLevel.NONE) activeTypes.push('grass');
  if (assessment.tree > PollenLevel.NONE) activeTypes.push('tree'); 
  if (assessment.weed > PollenLevel.NONE) activeTypes.push('weed');
  
  const typesSummary = activeTypes.length > 1 
    ? `${activeTypes.length} types` 
    : activeTypes[0] || 'pollen';

  // Choose the appropriate icon based on active pollen types
  const iconType = activeTypes.length === 1 
    ? activeTypes[0] as 'grass' | 'tree' | 'weed'  // Use specific icon if only one type is active
    : 'all'; // Use generic icon if multiple types or none

  // Create comprehensive tooltip text
  const tooltipText = `Overall pollen level: ${levelText} from ${typesSummary}`;

  return (
    <div 
      className="pollen-overall-indicator"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px', // 60% of original 24px would be ~14px, but 18px for better visibility
        height: '18px',
        borderRadius: '50%', // Perfect circle
        backgroundColor: bgColor,
        border: `2px solid ${color}`, // Consistent border thickness
        cursor: 'help',
        flexShrink: 0 // Prevent shrinking in flex containers
      }}
      role="status"
      aria-label={tooltipText}
      title={tooltipText}
    >
      <OptimizedImage 
        src={getPollenTypeIcon(iconType)}
        alt=""
        width={15}
        height={15}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}

/**
 * Main PollenWarning component with improved UX
 */
export default function PollenWarning({ 
  pollen, 
  assessment, 
  mode = 'full', 
  className = '' 
}: PollenWarningProps) {
  // Use provided assessment or calculate from pollen data
  const pollenAssessment = assessment || (pollen ? assessPollenConditions(pollen) : null);
  
  // Show pollen warnings for LOW levels and above (helpful for sensitive individuals)
  if (!pollenAssessment || pollenAssessment.overall < PollenLevel.LOW) {
    return null;
  }

  if (mode === 'compact') {
    return (
      <div className={`pollen-warning-compact ${className}`}>
        <OverallPollenIndicator level={pollenAssessment.overall} assessment={pollenAssessment} />
      </div>
    );
  }

  return (
    <div 
      className={`pollen-warning-full ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb'
      }}
      role="region"
      aria-label="Pollen level information"
    >
      {/* Header with overall level - compact version */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px'
      }}>
        <div style={{ 
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px', // Slightly larger for the header
          height: '20px',
          borderRadius: '50%',
          backgroundColor: getPollenBackgroundColor(pollenAssessment.overall),
          border: `2px solid ${getPollenLevelColor(pollenAssessment.overall)}`,
          flexShrink: 0
        }}>
          {(() => {
            // Choose the appropriate icon based on active pollen types (same logic as compact mode)
            const activeTypes: string[] = [];
            if (pollenAssessment.grass > PollenLevel.NONE) activeTypes.push('grass');
            if (pollenAssessment.tree > PollenLevel.NONE) activeTypes.push('tree'); 
            if (pollenAssessment.weed > PollenLevel.NONE) activeTypes.push('weed');
            
            const iconType = activeTypes.length === 1 
              ? activeTypes[0] as 'grass' | 'tree' | 'weed'  // Use specific icon if only one type is active
              : 'all'; // Use generic icon if multiple types or none
            
            return (
              <OptimizedImage 
                src={getPollenTypeIcon(iconType)}
                alt=""
                width={14}
                height={14}
                style={{ objectFit: 'contain' }}
              />
            );
          })()}
        </div>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: '600', 
          color: '#374151' 
        }}>
          Pollen
        </span>
      </div>

      {/* Individual pollen type indicators - compact icons */}
      <div style={{
        display: 'flex',
        gap: '6px', // Slightly more space between circular indicators
        alignItems: 'center',
        flexWrap: 'wrap' // Allow wrapping if needed
      }}>
        <PollenTypeIndicator 
          type="grass" 
          level={pollenAssessment.grass} 
          value={pollen?.grass}
        />
        <PollenTypeIndicator 
          type="tree" 
          level={pollenAssessment.tree} 
          value={pollen?.tree}
        />
        <PollenTypeIndicator 
          type="weed" 
          level={pollenAssessment.weed} 
          value={pollen?.weed}
        />
      </div>

      {/* Warning messages if any - more compact */}
      {pollenAssessment.warnings.length > 0 && (
        <div style={{
          marginTop: '4px',
          padding: '6px',
          borderRadius: '6px',
          backgroundColor: getPollenBackgroundColor(pollenAssessment.overall),
          border: `1px solid ${getPollenLevelColor(pollenAssessment.overall)}`,
          fontSize: '11px',
          lineHeight: '1.3'
        }}>
          {pollenAssessment.warnings.map((warning, index) => (
            <div key={index} style={{ color: '#374151' }}>
              • {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
