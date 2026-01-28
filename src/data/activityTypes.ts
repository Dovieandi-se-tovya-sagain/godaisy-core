// All condition keys are normalised: temp → temperature, wind_speed → windSpeed, rain → precipitation
// Visibility semantics
// --------------------
// `visibility` in all condition arrays refers to ABOVE-WATER (atmospheric) horizontal visibility,
// i.e. how far you can see in the air/sky from the shore or boat. It is NOT underwater clarity.
// Units: kilometres (km) after normalisation; if your source provides metres, convert to km.
// Rationale: This controls safety around fog/mist and surface navigation/observation.
// If we later add underwater clarity, use a separate key such as `waterClarity` (m) or `secchiDepth` (m).

import type { ActivityType } from './activities/types';
export type { ActivityType } from './activities/types';
import allSports from './activities/index';

const sportActivities = allSports as ActivityType[];

// Keep this hook for any activity definitions that don't belong in the module
// folders yet. Everything should eventually live inside data/activities/*.
const baseActivities: ActivityType[] = [];

const mergedById = new Map<string, ActivityType>();
for (const activity of [...sportActivities, ...baseActivities]) {
  if (!mergedById.has(activity.id)) {
    mergedById.set(activity.id, activity);
    continue;
  }

  if (process.env.NODE_ENV !== 'production') {
    const existing = mergedById.get(activity.id)!;
    console.warn(
      `[activities] Duplicate activity id "${activity.id}" from "${existing.name}" and "${activity.name}"`
    );
  }
}

export const activityTypes: ActivityType[] = Array.from(mergedById.values());

export const ACTIVITY_NAME_MAP: Record<string, string> = Object.fromEntries(
  activityTypes.map(activity => [activity.id, activity.name])
);

export const ACTIVITY_OPTIONS: { id: string; name: string }[] =
  activityTypes.map(activity => ({ id: activity.id, name: activity.name }));

export const getActivityName = (id: string) => ACTIVITY_NAME_MAP[id] ?? id;

if (process.env.NODE_ENV !== 'production') {
  const moduleIds = new Set(sportActivities.map(activity => activity.id));

  const overlaps = baseActivities.filter(activity => moduleIds.has(activity.id));
  if (overlaps.length) {
    console.warn(
      `[activities] Base activities overriding module definitions (${overlaps.length}):` +
        overlaps.map(activity => `\n - ${activity.id} (${activity.name})`).join('')
    );
  }

  const missingFromModules = baseActivities.filter(
    activity => !moduleIds.has(activity.id)
  );
  if (missingFromModules.length) {
    console.warn(
      `[activities] Activities still in base array (${missingFromModules.length}):` +
        missingFromModules.map(activity => `\n - ${activity.id} (${activity.name})`).join('')
    );
  }
}
