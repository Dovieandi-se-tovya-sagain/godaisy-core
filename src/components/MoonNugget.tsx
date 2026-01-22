// MoonNugget.tsx
// A compact React component that displays a culturally-varied moon folklore “nugget”.
// - Detects current lunar phase
// - Picks randomly from all cultures (serendipity)
// - Avoids repeating nuggets via localStorage
//
// Requirements:
// - Tailwind available
// - `data/moonLore.ts` present from previous step (exports MoonPhase, Culture, getMoonLoreDistinct)

import * as React from 'react';
import type { MoonPhase } from '@/data/moonLore';
import { getMoonLoreDistinct } from '@/data/moonLore';

// ---- Lunar phase helpers ----------------------------------------------------
function getLunarPhase(date = new Date()): MoonPhase {
  const synodic = 29.530588;
  const epoch = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC
  const now = date.getTime();
  const days = (now - epoch) / (1000 * 60 * 60 * 24);
  const phase = ((days % synodic) + synodic) % synodic;
  const eighth = synodic / 8;
  if (phase < 0.5 * eighth) return 'new';
  if (phase < 1.5 * eighth) return 'waxing_crescent';
  if (phase < 2.5 * eighth) return 'first_quarter';
  if (phase < 3.5 * eighth) return 'waxing_gibbous';
  if (phase < 4.5 * eighth) return 'full';
  if (phase < 5.5 * eighth) return 'waning_gibbous';
  if (phase < 6.5 * eighth) return 'last_quarter';
  if (phase < 7.5 * eighth) return 'waning_crescent';
  return 'new';
}

// ---- Local storage keys -----------------------------------------------------
const LS_KEY = 'wotnow:moon-nuggets:v1';

interface StoredState {
  used: Record<string, string[]>;
  month?: string;
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { used: {} };
    return { used: {}, ...JSON.parse(raw) };
  } catch {
    return { used: {} };
  }
}

function saveState(state: StoredState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ---- Hook to choose a distinct nugget --------------------------------------
function useMoonNugget(opts?: { phase?: MoonPhase; resetMonthly?: boolean }) {
  const phase = opts?.phase ?? getLunarPhase();
  const monthStamp = new Date().toISOString().slice(0, 7);
  const [state, setState] = React.useState<StoredState>(() => loadState());

  React.useEffect(() => {
    if (opts?.resetMonthly === false) return;
    if (state.month !== monthStamp) {
      const next = { ...state, used: {}, month: monthStamp };
      setState(next);
      saveState(next);
    }
  }, [monthStamp, opts?.resetMonthly, state]);

  const usedKey = `${phase}|any`;
  const usedSet = React.useMemo(() => new Set(state.used[usedKey] ?? []), [state.used, usedKey]);

  const pick = React.useMemo(() => {
    const { item, key } = getMoonLoreDistinct(phase, { used: usedSet });
    return { item, key };
  }, [phase, usedSet]);

  const markUsed = React.useCallback(() => {
    const next = { ...state, used: { ...state.used } };
    const arr = Array.from(usedSet);
    if (!arr.includes(pick.key)) arr.push(pick.key);
    next.used[usedKey] = arr;
    saveState(next);
    setState(next);
  }, [state, usedSet, usedKey, pick.key]);

  return { phase, item: pick.item, markUsed };
}

// ---- UI Component -----------------------------------------------------------
export interface MoonNuggetProps {
  phase?: MoonPhase;            // override detected phase
  header?: string;              // optional heading
  className?: string;           // wrapper styles
}

export default function MoonNugget(props: MoonNuggetProps) {
  const { phase, item, markUsed } = useMoonNugget({ phase: props.phase });

  // Fix potential infinite loop by adding a ref to track first render
  const isFirstRender = React.useRef(true);
  React.useEffect(() => { 
    if (isFirstRender.current) {
      markUsed();
      isFirstRender.current = false;
    }
  }, [markUsed]);

  return (
    <div className={"rounded-2xl border p-4 shadow-sm bg-white/70 dark:bg-zinc-900/60 backdrop-blur " + (props.className ?? '')}>
      <div className="flex items-center gap-2 mb-2">
        <span className="indie-text">
          Moon folklore - {item?.title ?? <span className="italic opacity-70">No lore available</span>}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{phase?.replace('_', ' ')}</span>
        {item?.culture && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{item.culture.replace('_', ' ')}</span>
        )}
      </div>

      {props.header && (
        <h3 className="text-base font-semibold mb-1">{props.header}</h3>
      )}

      <div className="text-sm leading-relaxed">
        {item?.text ? (
          <>
            <div className="font-medium mb-0.5"></div>
            <div className="opacity-90">{item.text}</div>
          </>
        ) : (
          <div className="italic opacity-70">No lore available for this phase.</div>
        )}
      </div>
    </div>
  );
}

// ---- Usage -----------------------------------------------------------------
// <MoonNugget /> // auto phase, random culture, no controls
// <MoonNugget phase="full" />
