/**
 * Weather Message Generator for Species Cards
 * Provides guild-specific, personality-driven weather commentary
 */

export interface WeatherConditions {
  windSpeedMS: number;
  pressureHPA: number;
  weatherScore: number;
}

export interface GuildWeatherMessage {
  emoji: string;
  message: string;
  tone: 'excellent' | 'good' | 'fair' | 'poor';
}

// Guild definitions with their weather preferences
const GUILD_PROFILES = {
  // Surface Pelagics (Mackerel, Garfish, Horse Mackerel)
  surface_pelagic: {
    windWeightHigh: true,
    pressureWeightLow: true,
    messages: {
      excellent: [
        "🌊 Surface feeders like me LOVE calm conditions - crystal clear hunting!",
        "☀️ Perfect! Flat seas mean I can spot every baitfish from up here",
        "🎯 Glassy water = easy pickings for a surface hunter like me"
      ],
      good: [
        "🌤️ Light chop keeps the baitfish active - I'm feeding well",
        "💨 Slight breeze is perfect - enough movement to keep prey visible",
        "🐟 Good surface conditions for us pelagic hunters"
      ],
      fair: [
        "💨 Getting choppy up here - harder to spot prey through the waves",
        "🌊 Moderate seas mean I have to work harder for my meals",
        "😐 Surface is getting messy - not ideal but I'm still around"
      ],
      poor: [
        "⛈️ Too rough! I'm heading deeper where it's calmer",
        "🌪️ Strong wind makes surface hunting impossible - gone deep",
        "😓 These conditions are brutal for surface feeders like me"
      ]
    }
  },

  // Baitfish (Anchovy, Herring, Sardine, Sprat)
  baitfish: {
    windWeightHigh: true,
    pressureWeightLow: true,
    messages: {
      excellent: [
        "✨ We shoal tightly in calm water - easy to find us now!",
        "🌊 Perfect conditions for our big schools near the surface",
        "☀️ Glassy seas = tight shoals = great fishing for you!"
      ],
      good: [
        "🐟 Light wind keeps our shoals moving and active",
        "💫 Good conditions for us small fry - we're schooling well",
        "🌤️ Comfortable surface conditions for our massive shoals"
      ],
      fair: [
        "💨 Getting scattered by the chop - harder to find big shoals",
        "🌊 Wind is breaking up our schools into smaller groups",
        "😬 Moderate seas make us spread out for safety"
      ],
      poor: [
        "⛈️ Too rough - we've scattered deep to avoid the turbulence",
        "🌪️ Storm conditions send us deep where predators can't hunt us",
        "😰 Extreme wind = survival mode, not feeding time"
      ]
    }
  },

  // Bottom Feeders - Flatfish (Plaice, Sole, Flounder, Dab)
  bottom_feeder: {
    windWeightLow: true,
    pressureWeightHigh: true,
    messages: {
      excellent: [
        "🎯 Stable pressure has me actively feeding on the bottom - perfect!",
        "⚓ High pressure = happy bottom dweller. Wind? What wind?",
        "😊 Bottom feeders like me love stable conditions - feeding strong!"
      ],
      good: [
        "🐟 Normal pressure keeps me active down here on the seabed",
        "⚓ Comfortable conditions for us flatfish on the bottom",
        "✅ Good pressure = good feeding for bottom dwellers"
      ],
      fair: [
        "😐 Pressure's a bit off but I'm still feeding occasionally",
        "⚓ Not ideal but we bottom feeders adapt - still worth a try",
        "🤔 Pressure change has me less active than usual"
      ],
      poor: [
        "😴 Low pressure makes me sluggish - barely moving down here",
        "⚠️ Storm pressure has me hunkered down, not feeding",
        "💤 Barometric instability = inactive bottom feeder"
      ]
    }
  },

  // Demersal Predators (Cod, Pollack, Whiting, Haddock)
  demersal_predator: {
    windWeightLow: true,
    pressureWeightHigh: true,
    messages: {
      excellent: [
        "🎣 Stable pressure triggers aggressive feeding - I'm hunting hard!",
        "⚡ Perfect conditions for mid-water predators like me",
        "😈 High pressure = predator mode activated!"
      ],
      good: [
        "🐟 Good hunting conditions in the mid-water column",
        "💪 Decent pressure keeps us demersal hunters active",
        "✅ Comfortable conditions for prowling the depths"
      ],
      fair: [
        "😐 Pressure's affecting my feeding rhythm slightly",
        "🤷 Not perfect but I'm still patrolling for prey",
        "⚠️ Less active than usual but still catchable"
      ],
      poor: [
        "😴 Low pressure makes me lethargic - minimal feeding",
        "💤 Storm conditions shut down my hunting instinct",
        "⛈️ Barometric chaos = inactive predator"
      ]
    }
  },

  // Sharks & Rays
  shark_ray: {
    windWeightLow: true,
    pressureWeightVeryHigh: true,
    messages: {
      excellent: [
        "🦈 High pressure = prime feeding time for deep hunters like me!",
        "⚡ Stable barometric pressure triggers my feeding frenzy",
        "😈 Perfect pressure for us predators of the deep!"
      ],
      good: [
        "🦈 Normal pressure keeps me cruising and hunting",
        "💪 Decent conditions for deep water predators",
        "✅ Good pressure = active shark/ray"
      ],
      fair: [
        "😐 Pressure's not quite right - I'm less aggressive",
        "🤔 Falling pressure affects my feeding pattern",
        "⚠️ Not ideal but I might still investigate bait"
      ],
      poor: [
        "😴 Low pressure shuts me down almost completely",
        "💤 Storm barometric readings = zero feeding activity",
        "⛈️ Awful pressure for deep hunters - I'm hiding"
      ]
    }
  },

  // Reef Species (Wrasse, Cuttlefish, Octopus)
  reef_species: {
    windWeightVeryLow: true,
    pressureWeightHigh: true,
    messages: {
      excellent: [
        "🪨 Protected in my reef + stable pressure = active feeding!",
        "😊 Reef dwellers like me barely notice surface wind - pressure is perfect!",
        "🎯 High pressure brings me out of my hiding spots to hunt"
      ],
      good: [
        "🐙 Good pressure keeps me active around the rocks",
        "🪨 Comfortable conditions for reef life like me",
        "✅ Nice pressure for exploring my rocky home"
      ],
      fair: [
        "😐 Pressure change makes me more cautious",
        "🪨 Still around the reef but less bold than usual",
        "⚠️ Not quite right - I'm staying closer to shelter"
      ],
      poor: [
        "😴 Bad pressure has me hiding in crevices",
        "💤 Storm conditions = reef resident in lockdown",
        "⛈️ Terrible pressure - I'm deep in my hole"
      ]
    }
  },

  // Bass (versatile hunters)
  bass: {
    windWeightModerate: true,
    pressureWeightModerate: true,
    messages: {
      excellent: [
        "⚡ Calm + stable pressure = aggressive bass feeding mode!",
        "🎯 Perfect hunting conditions for versatile predators like me",
        "😈 Everything's aligned - I'm actively hunting!"
      ],
      good: [
        "💪 Good all-round conditions for active bass",
        "🐟 Comfortable weather for our hunting patrol",
        "✅ Decent conditions for both shore and structure hunting"
      ],
      fair: [
        "😐 Conditions are okay - I'm around but less aggressive",
        "🤔 Not ideal but bass adapt - still worth trying for",
        "⚠️ Could be better but I haven't shut down completely"
      ],
      poor: [
        "😓 Rough conditions shut down feeding activity",
        "💤 Too extreme - I'm holding tight in shelter",
        "⛈️ Bass in survival mode, not feeding mode"
      ]
    }
  },

  // Large Pelagics (Tuna, Albacore)
  large_pelagic: {
    windWeightVeryHigh: true,
    pressureWeightLow: true,
    messages: {
      excellent: [
        "🚀 Flat seas = fast open-ocean hunting at its best!",
        "⚡ Perfect conditions for high-speed pelagic predators!",
        "😈 Calm water means I can chase down anything!"
      ],
      good: [
        "💨 Light seas keep the action alive for big hunters",
        "🌊 Good conditions for open-water prowling",
        "✅ Comfortable for fast pelagic pursuit"
      ],
      fair: [
        "😐 Getting choppy - affects my high-speed hunting",
        "🌊 Moderate seas make pursuit harder",
        "⚠️ Not ideal for speed hunters like me"
      ],
      poor: [
        "⛈️ Too rough for effective hunting - I'm deeper now",
        "🌪️ Extreme conditions send us big fish down deep",
        "😓 Can't hunt effectively in these seas"
      ]
    }
  },

  // Default for unlisted species
  generalist: {
    messages: {
      excellent: [
        "😊 Great conditions all around - I'm actively feeding!",
        "✅ Perfect weather for active fish like me",
        "🎯 Ideal conditions - I'm on the hunt!"
      ],
      good: [
        "🐟 Good conditions for feeding",
        "✅ Comfortable weather - I'm active",
        "💪 Decent conditions for me"
      ],
      fair: [
        "😐 Conditions are okay - less active than usual",
        "⚠️ Not perfect but I'm still around",
        "🤔 Could be better for feeding"
      ],
      poor: [
        "😴 Poor conditions - I'm less active",
        "💤 Bad weather has me holding tight",
        "⛈️ Tough conditions - minimal feeding"
      ]
    }
  }
};

/**
 * Determine guild category from species data
 */
function getGuildCategory(speciesCode: string, _scientificName: string): keyof typeof GUILD_PROFILES {
  // Surface Pelagics
  if (['mac', 'gar', 'horse-mack', 'chub-mack', 'g-mackerel'].includes(speciesCode)) {
    return 'surface_pelagic';
  }
  
  // Baitfish
  if (['anc', 'her', 'pil', 'spr', 'sand-smelt'].includes(speciesCode)) {
    return 'baitfish';
  }
  
  // Flatfish (bottom feeders)
  if (['ple', 'sol', 'dab', 'fle', 'turbot', 'bll', 'meg', 'wedge-sole'].includes(speciesCode)) {
    return 'bottom_feeder';
  }
  
  // Demersal Predators
  if (['cod', 'had', 'pol', 'pok', 'whg'].includes(speciesCode)) {
    return 'demersal_predator';
  }
  
  // Sharks & Rays
  if (['BUH', 'LBD', 'GFH', 'POR', 'SMA', 'rjc', 'rju', 'blonde-ray', 'small-eyed', 'sting-ray'].includes(speciesCode)) {
    return 'shark_ray';
  }
  
  // Reef Species
  if (['wrb', 'wra', 'cuc', 'cuttlefish', 'octopus', 'mug', 'fgm'].includes(speciesCode)) {
    return 'reef_species';
  }
  
  // Bass
  if (['bss', 'bsp', 'gilthead-bm'].includes(speciesCode)) {
    return 'bass';
  }
  
  // Large Pelagics
  if (['alb', 'bft', 'yft', 'bonito', 'bluefish'].includes(speciesCode)) {
    return 'large_pelagic';
  }
  
  return 'generalist';
}

/**
 * Get weather tone based on score
 */
function getWeatherTone(weatherScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (weatherScore >= 8) return 'excellent';
  if (weatherScore >= 6) return 'good';
  if (weatherScore >= 4) return 'fair';
  return 'poor';
}

/**
 * Generate a personalized weather message for a species
 */
export function getWeatherMessage(
  speciesCode: string,
  scientificName: string,
  weather: WeatherConditions
): GuildWeatherMessage {
  const guild = getGuildCategory(speciesCode, scientificName);
  const tone = getWeatherTone(weather.weatherScore);
  const profile = GUILD_PROFILES[guild];
  
  // Get appropriate messages for this tone
  const messages = profile.messages[tone];
  
  // Pick a random message from the available ones
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  // Determine emoji based on tone
  const emoji = tone === 'excellent' ? '🌟' : 
                tone === 'good' ? '✅' : 
                tone === 'fair' ? '😐' : '⚠️';
  
  return {
    emoji,
    message,
    tone
  };
}

/**
 * Get a simple weather summary (for dashboard/header)
 */
export function getWeatherSummary(weather: WeatherConditions): string {
  const windDesc = weather.windSpeedMS < 3 ? 'Calm' :
                   weather.windSpeedMS < 5 ? 'Light breeze' :
                   weather.windSpeedMS < 8 ? 'Moderate' :
                   weather.windSpeedMS < 12 ? 'Fresh' : 'Strong winds';
  
  const pressureDesc = weather.pressureHPA > 1020 ? 'High pressure' :
                       weather.pressureHPA >= 1010 ? 'Normal pressure' :
                       weather.pressureHPA >= 1000 ? 'Falling pressure' : 'Low pressure';
  
  return `${windDesc}, ${pressureDesc}`;
}

/**
 * Get guild emoji
 */
export function getGuildEmoji(speciesCode: string): string {
  const guild = getGuildCategory(speciesCode, '');
  
  const emojiMap = {
    surface_pelagic: '🌊',
    baitfish: '🐠',
    bottom_feeder: '🥞',
    demersal_predator: '🎣',
    shark_ray: '🦈',
    reef_species: '🪨',
    bass: '⚡',
    large_pelagic: '🚀',
    generalist: '🐟'
  };
  
  return emojiMap[guild];
}
