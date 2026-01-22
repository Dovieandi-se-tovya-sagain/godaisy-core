/**
 * Calculate current tide phase from tide predictions
 * Returns tide stage and flow speed estimate for bite score calculation
 */

export interface TideExtreme {
  time: string;
  height: number;
  type: 'high' | 'low';
}

export interface TidePhase {
  stage: 'early_flood' | 'mid_flood' | 'high' | 'early_ebb' | 'mid_ebb' | 'low_slack';
  flowSpeedMS: number; // Estimated flow speed in m/s
  nextExtreme: TideExtreme | null;
  currentHeight: number | null;
}

/**
 * Calculate current tide phase from extremes (high/low tides)
 */
export function calculateTidePhase(extremes: TideExtreme[], now: Date = new Date()): TidePhase | null {
  if (!extremes || extremes.length < 2) {
    return null;
  }

  const nowTime = now.getTime();

  // Find the surrounding tide extremes (previous and next)
  let prevExtreme: TideExtreme | null = null;
  let nextExtreme: TideExtreme | null = null;

  for (let i = 0; i < extremes.length; i++) {
    const extreme = extremes[i];
    const extremeTime = new Date(extreme.time).getTime();

    if (extremeTime <= nowTime) {
      prevExtreme = extreme;
    } else if (extremeTime > nowTime && !nextExtreme) {
      nextExtreme = extreme;
      break;
    }
  }

  if (!prevExtreme || !nextExtreme) {
    return null;
  }

  const prevTime = new Date(prevExtreme.time).getTime();
  const nextTime = new Date(nextExtreme.time).getTime();
  const totalDuration = nextTime - prevTime;
  const elapsed = nowTime - prevTime;
  const progress = elapsed / totalDuration; // 0 to 1

  // Estimate current height (linear interpolation)
  const heightDiff = nextExtreme.height - prevExtreme.height;
  const currentHeight = prevExtreme.height + (heightDiff * progress);

  // Determine tide stage and flow speed
  let stage: TidePhase['stage'];
  let flowSpeedMS: number;

  // Flood tide (low → high)
  if (prevExtreme.type === 'low' && nextExtreme.type === 'high') {
    if (progress < 0.33) {
      stage = 'early_flood';
      // Flow accelerating, estimate based on progress
      flowSpeedMS = 0.3 + (progress / 0.33) * 0.4; // 0.3 - 0.7 m/s
    } else if (progress < 0.67) {
      stage = 'mid_flood';
      // Peak flow, highest speed
      flowSpeedMS = 0.7 + ((progress - 0.33) / 0.34) * 0.5; // 0.7 - 1.2 m/s
    } else {
      stage = 'high';
      // Slowing down approaching high tide
      flowSpeedMS = 0.5 - ((progress - 0.67) / 0.33) * 0.3; // 0.5 - 0.2 m/s
    }
  }
  // Ebb tide (high → low)
  else if (prevExtreme.type === 'high' && nextExtreme.type === 'low') {
    if (progress < 0.33) {
      stage = 'early_ebb';
      // Flow accelerating outward
      flowSpeedMS = 0.3 + (progress / 0.33) * 0.4; // 0.3 - 0.7 m/s
    } else if (progress < 0.67) {
      stage = 'mid_ebb';
      // Peak ebb flow
      flowSpeedMS = 0.7 + ((progress - 0.33) / 0.34) * 0.5; // 0.7 - 1.2 m/s
    } else {
      stage = 'low_slack';
      // Slowing down approaching low tide
      flowSpeedMS = 0.5 - ((progress - 0.67) / 0.33) * 0.3; // 0.5 - 0.2 m/s
    }
  }
  // Should not happen with valid tide data
  else {
    return null;
  }

  return {
    stage,
    flowSpeedMS: Math.round(flowSpeedMS * 100) / 100, // Round to 2dp
    nextExtreme,
    currentHeight: Math.round(currentHeight * 100) / 100,
  };
}

/**
 * Helper to get tide phase for display
 */
export function getTidePhaseLabel(stage: TidePhase['stage']): string {
  const labels: Record<TidePhase['stage'], string> = {
    early_flood: 'Early Flood (Rising)',
    mid_flood: 'Mid Flood (Rising Fast)',
    high: 'High Tide (Slowing)',
    early_ebb: 'Early Ebb (Falling)',
    mid_ebb: 'Mid Ebb (Falling Fast)',
    low_slack: 'Low Slack (Slow)',
  };
  return labels[stage];
}
