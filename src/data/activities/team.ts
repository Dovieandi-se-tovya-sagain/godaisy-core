import type { ActivityType } from './types';

export const teamSports: ActivityType[] = [
  {
    id: 'football_soccer',
    name: 'Football (Soccer)',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'outdoors', 'football', 'Saturday', 'Sunday', 'Wednesday'],

    perfectConditions: [
      'temperature=12..18',         // comfortable running temperature
      'windSpeed<10',               // no ball drift or discomfort
      'clouds=40..70',              // partial cloud helps visibility without glare
      'precipitation=0',            // dry = best ball control and pitch condition
      'soilMoisture=20..35',        // firm turf with good traction
      'visibility>10'               // long-distance visibility ideal for playmaking
    ],

    goodConditions: [
      'temperature=5..25',          // widely playable for most amateur players
      'windSpeed<20',               // breezy but not disruptive
      'clouds=20..90',              // glare or overcast is manageable
      'precipitation=0',            // tightened: dry required for good
      'soilMoisture=15..45',        // playable with some softness
      'visibility>5'                // enough to see the game well
    ],
    fairConditions: [
      'temperature=0..5 or 25..30', // chilly or hot but not dangerous
      'windSpeed=20..30',           // gusty conditions may affect long balls
      'precipitation=5..15',        // moderate rain, some puddles likely
      'soilMoisture=10..15 or soilMoisture=45..60', // hardening or soggy patches
      'visibility=2..5'             // foggy or poor light, may reduce situational awareness
    ],

    poorConditions: [
      'temperature<0 or temperature>30',   // frozen or dangerously hot
      'windSpeed>30',                      // hard to control ball or run
      'precipitation>15',                  // waterlogged pitch, ball unplayable
      'soilMoisture<10 or soilMoisture>60', // rock-hard or boggy pitch
      'visibility<2',
      // Snow-aware penalties
      'snowfallRateMmH>1',
      'snowDepthCm>1'
    ],

    seasonalMonths: [2, 3, 4, 5, 8, 9, 10, 11],  // popular months outside winter break or summer heat

    indoorAlternative: 'Hit the gym for drills, or play futsal indoors'
  },

  {
    id: 'american_football',
    name: 'American Football',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'football', 'outdoors', 'autumn', 'Saturday', 'Sunday', 'holiday', 'Friday'],

    poorConditions: [
      'precipitation>15',       // very heavy rain, waterlogged
      'windSpeed>30',           // gusty, dangerous
      'temperature<0',          // freezing
      'temperature>30',         // oppressive heat
      'soilMoisture<10 or soilMoisture>60', // frozen/dusty or boggy turf
      'snowfallRateMmH>1',      // sustained snow makes footing unsafe
      'snowDepthCm>1'           // shallow accumulation already obscures lines
    ],

    fairConditions: [
      'temperature=0..5 or 25..30',     // cold warmups or heat-adapted sessions
      'windSpeed=20..30',               // strong winds affect play
      'precipitation=5..15',            // wet but not yet unplayable
      'soilMoisture=10..15 or soilMoisture=45..60', // hard spots or muddy sections
      'visibility=2..5'                 // hazy, dusk or foggy
    ],

    goodConditions: [
      'temperature=5..25',              // acceptable for most
      'windSpeed<20',
      'precipitation=0',
      'soilMoisture=15..45'             // resilient turf
    ],

    perfectConditions: [
      'temperature=12..18',             // mild & comfortable
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35'             // grippy but forgiving surface
    ],

    seasonalMonths: [8, 9, 10, 11, 12],

    indoorAlternative: 'Watch a game on TV, review playbooks, or practise drills at an indoor gym'
  },
  {
    id: 'baseball',
    name: 'Baseball',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'bat-and-ball', 'outdoors', 'social', 'Saturday', 'Sunday', 'holiday', 'Friday'],

    poorConditions: [
      'precipitation>10',      // heavy rain cancels play
      'windSpeed>30',          // gusty, dangerous for fly balls
      'temperature<5',         // freezing & unpleasant
      'temperature>35',        // oppressive heat
      'soilMoisture<10 or soilMoisture>60', // baked infield or waterlogged outfield
      'snowfallRateMmH>1',     // flurries quickly reduce visibility & grip
      'snowDepthCm>1'          // light settling snow already impacts bases
    ],

    fairConditions: [
      'temperature=5..10 or 30..35',   // chilly or hot, not ideal
      'windSpeed=20..30',              // breezy affects ball flight
      'precipitation=5..10',           // showers or on/off rain
      'soilMoisture=10..15 or soilMoisture=45..60', // dusty basepaths or muddy turf
      'visibility=2..5'                // dusk, fog, or haze
    ],

    goodConditions: [
      'temperature=10..30',            // wide range tolerated
      'windSpeed<20',
      'precipitation=0',               // tightened: dry only for good
      'soilMoisture=15..45',           // playable field conditions
      'visibility>5'
    ],

    perfectConditions: [
      'temperature=18..24',            // ideal comfort
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35',           // true bounce, firm footing
      'visibility>10'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9],

    indoorAlternative: 'Practise batting at an indoor cage, watch game film, or work on fitness'
  },

  {
    id: 'hurling_camogie',
    name: 'Hurling & Camogie',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'irish', 'cultural', 'heritage', 'community', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'precipitation>15',           // heavy rain, waterlogged pitch
      'windSpeed>30',               // dangerously gusty
      'temperature<2',              // freezing, hard ground
      'soilMoisture<10 or soilMoisture>60', // baked or boggy surface
      'visibility<2',               // fog, unsafe
      'snowfallRateMmH>1',          // stick-and-ball play suffers in active snow
      'snowDepthCm>1'               // shallow snow hides lines and footing
    ],
    fairConditions: [
      'temperature=2..7',           // chilly but playable
      'windSpeed=20..30',           // blustery, requires skill
      'precipitation=5..15',        // moderate rain, still playable in tradition
      'soilMoisture=10..15 or soilMoisture=45..60', // hard patches or soft sod
      'visibility=2..5'             // hazy but manageable
    ],
    goodConditions: [
      'temperature=7..20',          // broad acceptable range
      'windSpeed<20',
      'precipitation=0',
      'soilMoisture=15..45',        // resilient sod
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=12..18',         // mild & ideal
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35',        // controllable pitch
      'visibility>10'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9],
    indoorAlternative: 'Practise drills indoors, watch match videos, or work on fitness'
  },
  {
    id: 'gaelic_football',
    name: 'Gaelic Football',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'irish', 'cultural', 'heritage', 'community', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'precipitation>15',           // heavy rain, waterlogged pitch
      'windSpeed>30',               // dangerously gusty
      'temperature<2',              // freezing, hard ground
      'soilMoisture<10 or soilMoisture>60', // baked or waterlogged pitch
      'visibility<2',               // fog, unsafe
      'snowfallRateMmH>1',          // active snowfall makes handling difficult
      'snowDepthCm>1'               // quick accumulation hides markings
    ],
    fairConditions: [
      'temperature=2..7',           // chilly but playable
      'windSpeed=20..30',           // gusty, but games often proceed
      'precipitation=5..15',        // steady rain, less pleasant but traditional
      'soilMoisture=10..15 or soilMoisture=45..60', // hard or boggy sections
      'visibility=2..5'             // misty or foggy, but usually tolerated
    ],
    goodConditions: [
      'temperature=7..20',          // broad acceptable range
      'windSpeed<20',
      'precipitation=0',
      'soilMoisture=15..45',        // resilient pitch
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=12..18',         // mild & ideal
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35',        // ideal traction
      'visibility>10'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9],
    indoorAlternative: 'Practise drills indoors, watch match videos, or work on fitness'
  },
  {
    id: 'hockey',
    name: 'Field Hockey',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'field', 'outdoor', 'social', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'precipitation>8',             // heavy rain makes surface unplayable
      'windSpeed>25',                // gusty, uncomfortable
      'temperature<2',               // freezing, unsafe
      'temperature>32',              // oppressive heat
      'soilMoisture<10 or soilMoisture>60', // dusty or saturated pitch
      'visibility<2',                // fog or poor light
      'snowfallRateMmH>1',           // stick-and-ball precision fails in snow
      'snowDepthCm>1'                // carpet of snow ruins turf grip
    ],
    fairConditions: [
      'temperature=2..8 or 28..32',  // chilly or hot but tolerable
      'windSpeed=15..25',            // breezy, not ideal
      'precipitation=3..8',          // showers likely but manageable
      'soilMoisture=10..15 or soilMoisture=45..60', // hard spots or soggy turf
      'visibility=2..5'              // reduced visibility, still playable
    ],
    goodConditions: [
      'temperature=8..28',           // broad range tolerated
      'windSpeed<15',
      'precipitation=0',
      'soilMoisture=15..45',         // consistent surface
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=15..20',          // mild & comfortable
      'windSpeed<8',
      'precipitation=0',
      'soilMoisture=20..35',         // smooth, fast surface
      'visibility>10'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise skills at an indoor hall or watch match replays'
  },

  {
    id: 'netball',
    name: 'Netball',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'outdoors', 'social', 'fitness', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'precipitation>5',           // slippery court, unsafe
      'windSpeed>20',              // disruptive to passing
      'temperature<5',             // uncomfortably cold
      'temperature>30',            // heat stress risk
      'visibility<2',              // fog or very poor light
      'snowfallRateMmH>0.5',       // light snowfall already slicks hardcourts
      'snowDepthCm>0.5'            // thin settled snow makes surfaces treacherous
    ],
    fairConditions: [
      'temperature=5..10 or 28..30', // chilly or hot but tolerable
      'windSpeed=15..20',            // breezy but playable
      'precipitation=2..5',          // damp but possible with caution
      'visibility=2..5'              // dull light, still visible
    ],
    goodConditions: [
      'temperature=10..28',          // broad acceptable range
      'windSpeed<15',
      'precipitation=0',
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=18..22',          // mild & comfortable
      'windSpeed<8',
      'precipitation=0',
      'visibility>10'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Book an indoor court, practise drills, or join a local league training session'
  },
  {
    id: 'volleyball_indoor',
    name: 'Volleyball (Indoor)',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: false,
    tags: ['sport','team','indoor','Saturday','Sunday','Wednesday']
  },
  {
    id: 'basketball_outdoor',
    name: 'Basketball (Outdoor)',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['exercise', 'sport', 'team', 'outdoor', 'social', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'precipitation>0',      // slippery & unsafe
      'windSpeed>35',         // very disruptive to play (was 20)
      'temperature<5',        // too cold for comfort
      'temperature>35',       // risk of heat stress
      'visibility<2',         // fog/darkness
      'snowfallRateMmH>0.5',  // court surface turns slick fast
      'snowDepthCm>0.5'       // even light settling snow is unsafe underfoot
    ],

    fairConditions: [
      'temperature=5..12 or temperature=28..32',  // cool or hot but tolerable
      'windSpeed=20..35',                         // breezy but still playable (expanded range)
      'visibility=2..5',                          // hazy or low light conditions
      'clouds=70..100'                            // overcast but dry (fixed from cloudCover)
    ],

    goodConditions: [
      'temperature=12..28',   // comfortable for most
      'windSpeed<20',         // less windy (increased from 18)
      'visibility>5',
      'precipitation=0',      // no Rain
    ],

    perfectConditions: [
      'temperature=18..22',   // mild & comfortable
      'windSpeed<12',         // calm conditions (increased from 10)
      'visibility>10',
      'precipitation=0'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Play at an indoor gym or practise shooting drills at home'
  },
  {
    id: 'beach_volleyball',
    name: 'Beach Volleyball',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'social', 'beach', 'outdoors', 'Saturday', 'Sunday', 'Friday'],

    perfectConditions: [
      'temperature=22..28',         // warm enough for bare feet, not scorching
      'windSpeed<8',                // minimal wind keeps the ball predictable
  'cloudCover=10-30',           // some sun, great beach vibes
  'precipitation=0',            // dry sand is essential
  'visibility>10',              // full visibility across court
  'waveHeight=0..0.6'           // gentle lapping, no rogue waves
    ],

    goodConditions: [
      'temperature=18..30',         // solid beach weather
      'windSpeed<15',               // light breeze is fine
      'cloudCover=0-60',            // sun or mild overcast
      'precipitation=0',            // still dry enough
      'visibility>5',               // good view of ball & surroundings
      'waveHeight<=0.9'
    ],

    fairConditions: [
      'temperature=12..18 or 30..35', // chilly or very hot, playable but not comfy
      'windSpeed=15..25',             // ball may drift, sand may blow
      'cloudCover=60-100',            // overcast or flat light
      'precipitation=0..5',           // light rain might dampen enthusiasm
      'visibility=2..5',             // misty or dull but not dangerous
      'waveHeight=0.9..1.2'
    ],

    poorConditions: [
      'temperature<12 or temperature>35', // unsafe or deeply unpleasant
      'windSpeed>25',                     // play becomes chaotic
      'precipitation>5',                  // wet sand & discomfort
      'visibility<2',                     // fog = no-go
      'waveHeight>1.2',                   // waves encroaching on court
      'snowfallRateMmH>0.5',              // snow makes footing slippery and visibility poor
      'snowDepthCm>0.5'                   // cold sand and hidden hazards
    ],

    seasonalMonths: [5, 6, 7, 8, 9],       // peak summer activity

    indoorAlternative: 'Play indoor volleyball at a sports hall or practise drills at home'
  },
  {
    id: 'cricket',
    name: 'Cricket',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'bat-and-ball', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'precipitation>1',       // light drizzle tolerated
      'windSpeed>25',          // too gusty
      'temperature<8',         // uncomfortably cold
      'temperature>35',        // oppressive heat
      'soilMoisture<10 or soilMoisture>60', // baked wicket or waterlogged outfield
      'visibility<2',          // bad light
      'snowfallRateMmH>1',     // snow showers kill visibility
      'snowDepthCm>1'          // covers wicket & outfield speed
    ],

    fairConditions: [
      'temperature=8..12',      // brisk morning matches
      'temperature=30..32',     // hot but tolerable with breaks
      'windSpeed=20..25',       // slightly gusty but playable
      'precipitation=0.5..1',   // occasional drizzle
      'soilMoisture=10..15 or soilMoisture=45..60', // dry wickets or soft patches
      'visibility=2..5'         // hazy light but not unsafe
    ],

    goodConditions: [
      'temperature=12..30',     // broad comfortable range
      'windSpeed<20',
      'precipitation=0..2',
      'soilMoisture=15..45',    // well-drained outfield
      'visibility>5'
    ],

    perfectConditions: [
      'temperature=20..25',
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35',    // firm wicket & outfield
      'visibility>10'
    ],

    seasonalMonths: [5, 6, 7, 8, 9],

    indoorAlternative: 'Watch match highlights, practise batting drills, or read cricket biographies'
  },
  {
    id: 'rugby',
    name: 'Rugby',
    category: 'Active Sports',
    secondaryCategory: 'Team Sports',
    weatherSensitive: true,
    tags: ['sport', 'team', 'contact', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'precipitation>15',     // waterlogged pitch
      'windSpeed>30',         // dangerously gusty
      'temperature<0',        // freezing, icy
      'temperature>35',       // oppressive heat
      'soilMoisture<10 or soilMoisture>60', // rock-hard or boggy pitch
      'visibility<2',         // fog, unsafe
      'snowfallRateMmH>1',    // sustained snow kills visibility & ball handling
      'snowDepthCm>1'         // snow cover hides lines and studs lose traction
    ],

    fairConditions: [
      'temperature=0..5',       // cold but common in winter leagues
      'temperature=28..30',     // hot, with breaks/hydration
      'windSpeed=20..30',       // gusty but playable
      'precipitation=5..15',    // moderate rain, slippery pitch
      'soilMoisture=10..15 or soilMoisture=45..60', // baked patches or soft turf
      'visibility=2..5'         // hazy or low light
    ],

    goodConditions: [
      'temperature=5..28',      // tolerable range for most
      'windSpeed<20',
      'precipitation=0..5',
      'soilMoisture=15..45',    // firm footing with give
      'visibility>5'
    ],

    perfectConditions: [
      'temperature=12..18',
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35',    // true bounce and traction
      'visibility>10'
    ],

    seasonalMonths: [9, 10, 11, 12, 1, 2, 3],

    indoorAlternative: 'Hit the gym, practise drills indoors, or watch match footage'
  },
];

export default teamSports;