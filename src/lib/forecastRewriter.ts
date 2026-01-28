// forecastRewriter.ts
export function rewriteForecast(raw: string, tone: 'cheeky' | 'plain' = 'cheeky'): string {
  let s = (raw ?? '').trim();

  // --- Normalise awkward source phrasing (order matters) ---
  const rules: Array<[RegExp, string]> = [
    // Dump robotic intros
    [/\bYou can expect\b[\s,:-]*/gi, ''],
    [/\bThere will be\b[\s,:-]*/gi, ''],
    [/\bExpect a day of\b[\s,:-]*/gi, ''],
    [/\bExpect\b[\s,:-]*/gi, ''],

    // Ensure "partly cloudy" always expands to "partly cloudy skies"
    [/\bpartly\s+cloudy\b/gi, 'partly cloudy skies'],

    // “with rain” → “with showers” (more natural UK usage)
    [/\bwith\s+rain\b/gi, 'with showers'],
    [/\bwith\s+occasional\s+rain\b/gi, 'with occasional showers'],

    // Morning/afternoon constructions
    [/\bin the morning,?\s*with\s+(.*?)\s+in the afternoon\b/gi, 'in the morning; $1 later'],
    [/\brain in the morning,?\s*with\s+partly cloudy(?: skies)?\s+in the afternoon\b/gi, 'Rain in the morning, turning partly cloudy later'],
    [/\bpartly cloudy(?: skies)?\s+in the morning,?\s*with\s+clearing\s+in the afternoon\b/gi, 'Partly cloudy skies in the morning, clearing later'],

    // Tidy loose "today" and duplicate punctuation
    [/\btoday\b\s*$/i, ''],
    [/\s{2,}/g, ' '],
    [/;\s*;/g, ';'],
    [/,\s*,/g, ','],
    [/^[,;]\s*|\s*[,;]\s*$/g, ''],
  ];

  for (const [pat, repl] of rules) s = s.replace(pat, repl).trim();

  // Capitalise start
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);

  if (tone === 'plain') return finalise(s);

  // --- Cheeky British embellishments (keeps "skies") ---
  const cheeky: Array<[RegExp, string]> = [
    // Keep "skies" and add sunny spells if it's bare
    [/\bPartly cloudy skies\b(?! with)/i, 'Partly cloudy skies with sunny spells'],
    // Clear spells phrasing → sunny spells
    [/\bwith (?:some )?clear spells\b/i, 'with sunny spells'],
    // Showers → brolly nudge
    [/\bwith (?:occasional )?showers\b/i, 'with showers — pack a brolly'],
    // Clearing later → tea-time brightness
    [/\bclearing later\b/i, 'clearing later — brighter by tea time'],
    // Turning partly cloudy → perks up
    [/\bturning partly cloudy\b/i, 'perking up later'],
    // Rain in the morning → gentle apology
    [/\bRain in the morning\b/i, 'Rain in the morning (sorry)'],
    // Plain "in the morning; X later" → add small nudge
    [/\bPartly cloudy skies in the morning\b/i, 'Partly cloudy skies in the morning — decent for a quick dash out'],
  ];

  for (const [pat, repl] of cheeky) s = s.replace(pat, repl).trim();

  return finalise(s);
}

function finalise(s: string): string {
  s = s
    .replace(/\s+—\s+/g, ' — ')
    .replace(/\s+,/g, ',')
    .replace(/\s+;/g, ';')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}