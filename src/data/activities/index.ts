import type { ActivityType } from './types';

// Re-export everything from each module so named exports remain available
export * from './team';
export * from './individual';
export * from './watersports';
export * from './snow';
export * from './ice';
export * from './fishing';
export * from './cycling';
export * from './outdoor';
export * from './nature';
export * from './social';
export * from './wellness';
export * from './lifestyle';

// Import as namespaces for flexible aggregation (handles any export names)
import * as team from './team';
import * as individual from './individual';
import * as watersports from './watersports';
import * as snow from './snow';
import * as ice from './ice';
import * as fishing from './fishing';
import * as cycling from './cycling';
import * as outdoor from './outdoor';
import * as nature from './nature';
import * as social from './social';
import * as wellness from './wellness';
import * as lifestyle from './lifestyle';

// Type guard to detect ActivityType
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const isActivity = (x: unknown): x is ActivityType => {
  if (!isRecord(x)) return false;
  return typeof x.id === 'string'
    && typeof x.name === 'string'
    && typeof x.category === 'string'
    && Array.isArray(x.tags);
};

// Extract all exported arrays of ActivityType from a module namespace
const arraysFromModule = (mod: Record<string, unknown>): ActivityType[][] => {
  const out: ActivityType[][] = [];
  for (const val of Object.values(mod)) {
    if (Array.isArray(val) && (val.length === 0 || val.every(isActivity))) {
      out.push(val as ActivityType[]);
    }
  }
  return out;
};

// Collect arrays from all modules
const modules = [team, individual, watersports, snow, ice, fishing, cycling, outdoor, nature, social, wellness, lifestyle];

const lists: ActivityType[][] = [];
for (const m of modules) {
  for (const arr of arraysFromModule(m)) {
    lists.push(arr);
  }
}

// Dedupe by id
const byId = new Map<string, ActivityType>();
for (const list of lists) {
  for (const a of list) {
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
}

export const allSports: ActivityType[] = Array.from(byId.values());
export default allSports;