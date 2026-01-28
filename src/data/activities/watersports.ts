import type { ActivityType } from './types';

export const waterSports: ActivityType[] = [
  {
    id: 'surfing',
    name: 'Surfing',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['water', 'waves', 'leisure', 'ocean', 'outdoors', 'sport', 'adventure', 'Friday', 'Saturday', 'Sunday'],
    perfectConditions: [
      'waterTemperature=16..20',
      'airTemperature=18..24',
      'waveHeight=0.8..1.5',
      'swellPeriod=10..12',
      'windSpeed=5..10',
      'windRelative=offshore',
      'gust<8',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'waterTemperature=14..26',
      'airTemperature=12..28',
      'waveHeight=0.35..1.8',
      'swellPeriod=8..12',
      'windSpeed=5..15',
      'windRelative=offshore or windRelative=side-offshore & windSpeed<=12 or windRelative=cross-shore & windSpeed<=8 or windRelative=side-onshore & windSpeed<=10 & waveHeight<=1.0',
      'gust<12',
      'visibility>5'
    ],
    fairConditions: [
      'waterTemperature=12..14 or 26..28',
      'airTemperature=8..12 or 28..30',
      'waveHeight=0.25..0.5 or 1.8..2.5',
      'swellPeriod=6..8 or 12..14',
      'windSpeed=15..20',
      'windRelative=cross-shore & windSpeed=8..15 or windRelative=side-onshore & windSpeed<=12 or windRelative=onshore & windSpeed<=8 & swellPeriod>=10 & waveHeight<=1.2',
      'gust=12..18',
      'visibility=2..5',
      'precipitation=2..10'
    ],
    poorConditions: [
      'waterTemperature<12',
      'airTemperature<8 or airTemperature>32',
      'waveHeight<0.25 or waveHeight>2.5',
      'swellPeriod<6 or swellPeriod>14',
      'windSpeed>20',
      'windRelative=onshore & windSpeed>10 or windRelative=onshore & swellPeriod<8 or windRelative=onshore & waveHeight<0.3',
      'gust>18',
      'visibility<2',
      'precipitation>10',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Watch surf films or work on your pop-up at home'
  },
  {
    id: 'kayaking',
    name: 'Kayaking (Inland)',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport', 'water', 'outdoors', 'adventure', 'Saturday', 'Sunday', 'holiday'],

    perfectConditions: [
      'temperature=15..22',
      'windSpeed<8',
      'waveHeight<0.3',
      'gust<5',
      'visibility>10',
      'precipitation=0'
    ],

    goodConditions: [
      'temperature=10..24',
      'windSpeed<15',
      'waveHeight<0.8',
      'gust<10',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'temperature=5..10 or 24..28',
      'windSpeed=15..25',
      'waveHeight=0.8..1.2',
      'gust=10..15',
      'precipitation=2..10',
      'visibility=2..5'
    ],

    poorConditions: [
      'temperature<5 or temperature>28',
      'windSpeed>25',
      'waveHeight>1.2',
      'gust>15',
      'precipitation>10',
      'visibility<2',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],

    indoorAlternative: 'Check your gear, practise strokes on a paddle machine, or plan your next trip'
  },
  {
    id: 'sea_kayaking',
    name: 'Kayaking (Sea)',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['sport', 'water', 'sea', 'coastal', 'outdoors', 'adventure', 'Saturday', 'Sunday', 'holiday'],

    perfectConditions: [
      'temperature=14..20',
      'windSpeed<10',
      'gust<8',
      'waveHeight<0.3',
      'visibility>10',
      'precipitation=0',
      'windRelative=cross-shore & windSpeed<10 or windRelative=onshore & windSpeed<8'
    ],

    goodConditions: [
      'temperature=10..24',
      'windSpeed<15',
      'gust<12',
      'waveHeight<0.6',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=cross-shore & windSpeed<=15 or windRelative=onshore & windSpeed<=12'
    ],

    fairConditions: [
      'temperature=5..10 or 24..28',
      'windSpeed=15..20',
      'gust=12..15',
      'waveHeight=0.6..1.0',
      'visibility=2..5',
      'precipitation=2..10',
      'windRelative=offshore & windSpeed<=6 & gust<=10 & waveHeight<0.4'
    ],

    poorConditions: [
      'temperature<5 or temperature>28',
      'windSpeed>20',
      'gust>15',
      'waveHeight>1.0',
      'visibility<2',
      'precipitation>10',
      'waterTemperature<12',
      'windRelative=offshore & windSpeed>10 or windRelative=offshore & gust>12',
      'windRelative=onshore & waveHeight>0.8',
      'windRelative=cross-shore & windSpeed>20',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Check your kit, practise rescues in a pool, or plan a coastal route'
  },
  {
    id: 'canoeing',
    name: 'Canoeing',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport','water','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'temperature=15..22',
      'windSpeed<6',
      'gust<8',
      'waveHeight<0.3',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'temperature=10..24',
      'windSpeed<12',
      'gust<12',
      'waveHeight<0.6',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'temperature=5..10 or 24..28',
      'windSpeed=12..18',
      'gust=12..15',
      'waveHeight=0.6..1.0',
      'visibility=2..5',
      'precipitation=2..10'
    ],
    poorConditions: [
      'temperature<5 or temperature>28',
      'windSpeed>18',
      'gust>15',
      'waveHeight>1.0',
      'visibility<2',
      'precipitation>10',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [4,5,6,7,8,9,10]
  },
  {
    id: 'stand_up_paddleboarding',
    name: 'Stand-up Paddleboarding',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport','water','outdoors','inland','Saturday','Sunday','holiday'],
    perfectConditions: [
      'temperature=16..24',
      'windSpeed<5',
      'gust<7',
      'waveHeight<0.2',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'temperature=10..26',
      'windSpeed<8',
      'gust<10',
      'waveHeight<0.3',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'temperature=5..10 or 26..30',
      'windSpeed=8..10',
      'gust=10..12',
      'waveHeight=0.3..0.5',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'temperature<5 or temperature>30',
      'windSpeed>10',
      'gust>12',
      'waveHeight>0.5',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [4,5,6,7,8,9,10]
  },
  {
    id: 'snorkeling',
    name: 'Snorkelling',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['water', 'swimming', 'adventure', 'leisure', 'nature', 'sea', 'coastal', 'Saturday', 'Sunday', 'holiday'],

    // Safety-first: avoid offshore winds unless extremely light and in tiny surf; keep waves small; cap gusts; watch for heavy rain (murk)
    poorConditions: [
      'waterTemperature<17',            // uncomfortably cold for most casual snorkellers
      'windSpeed>18',                   // choppy & unsafe (whitecaps likely)
      'gust>16',                        // unpredictable surface disturbance
      'waveHeight>1',                   // hard to breathe & see in the break zone
      'precipitation>6',                // heavy rain reduces water clarity & surface safety
      'visibility<2',                   // foggy, unsafe for navigation/spotters
      // Directional hazards
      'windRelative=offshore & windSpeed>6 or windRelative=offshore & gust>8',
      'windRelative=onshore & waveHeight>0.6',
      'windRelative=cross-shore & windSpeed>14',
      'snowfallRateMmH>0.5',           // airborne snow slashes visibility fast
      'snowDepthCm>0.5'                // launch points quickly become icy
    ],

    fairConditions: [
      'waterTemperature=17..19',        // brisk but tolerable with suitable gear
      'windSpeed=10..16',
      'gust=10..14',
      'waveHeight=0.3..0.8',
      'cloudCover=60-90',
      'visibility=2..5',
      'precipitation=2..6',
      // Directional allowances (only if very light and waves are tiny)
      'windRelative=offshore & windSpeed<=5 & gust<=8 & waveHeight<0.3',
      'windRelative=onshore & windSpeed<=10 & waveHeight<=0.5',
      'windRelative=cross-shore & windSpeed<=12'
    ],

    goodConditions: [
      'waterTemperature=20..28',
      'windSpeed<10',
      'gust<=10',
      'waveHeight<0.5',
      'cloudCover=0-60',
      'visibility>5',
      'precipitation=0..2',
      // Prefer cross-shore or very light onshore; avoid offshore in exposed areas
      'windRelative=cross-shore & windSpeed<=10 or windRelative=onshore & windSpeed<=8'
    ],

    perfectConditions: [
      'waterTemperature=22..26',
      'windSpeed<6',
      'gust<6',
      'waveHeight<0.3',
      'cloudCover=10-40',
      'visibility>10',
      'precipitation=0',
      // Flat, clear, and safe directions (no offshore)
      'windRelative=cross-shore & windSpeed<6 or windRelative=onshore & windSpeed<5'
    ],

    seasonalMonths: [5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise breath-holding techniques, research marine life, or plan your next beach trip'
  },
  {
    id: 'jet_skiing',
    name: 'Jet Skiing',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['water', 'motorised', 'adventure', 'speed', 'sea', 'coastal', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'waterTemperature<14',           // cold spray & hypothermia risk
      'airTemperature<12 or airTemperature>32',
      'windSpeed>22',                  // strong winds create chop
      'gust>25',                       // erratic gusts destabilise riders
      'waveHeight>1.5',                // large chop/waves risky for PWC
      'visibility<2',                  // tough to spot hazards or other craft
      'precipitation>8',               // heavy rain reduces visibility & control
      'windRelative=offshore & windSpeed>12',
      'windRelative=onshore & waveHeight>1.2',
      'snowfallRateMmH>0.5',          // snow squalls devastate sightlines
      'snowDepthCm>0.5'               // ramps/paths icy for launching
    ],

    fairConditions: [
      'waterTemperature=14..18',
      'airTemperature=12..16 or airTemperature=28..32',
      'windSpeed=15..22',
      'gust=18..25',
      'waveHeight=1.0..1.5',
      'visibility=2..5',
      'precipitation=2..8',
      'windRelative=cross-shore & windSpeed<=18',
      'windRelative=offshore & windSpeed<=12 & waveHeight<=0.8'
    ],

    goodConditions: [
      'waterTemperature=18..26',
      'airTemperature=18..28',
      'windSpeed<15',
      'gust<=18',
      'waveHeight<1.0',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=cross-shore & windSpeed<=12 or windRelative=onshore & windSpeed<=10'
    ],

    perfectConditions: [
      'waterTemperature=20..24',
      'airTemperature=20..26',
      'windSpeed<10',
      'gust<12',
      'waveHeight<0.6',
      'visibility>10',
      'precipitation=0',
      'windRelative=cross-shore & windSpeed<10 or windRelative=onshore & windSpeed<8'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Book a session on a jet-ski simulator, plan routes, or watch safety refreshers'
  },
  {
    id: 'wild_swimming',
    name: 'Wild Swimming',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport','water','outdoors','inland','nature','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=16..20',
      'airTemperature=18..24',
      'windSpeed<8',
      'waveHeight<0.3',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'waterTemperature=14..24',
      'airTemperature=14..28',
      'windSpeed<12',
      'waveHeight<0.5',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'waterTemperature=12..14 or 24..28',
      'airTemperature=10..14 or 28..30',
      'windSpeed=12..18',
      'waveHeight=0.5..0.8',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'waterTemperature<12',
      'airTemperature<10 or airTemperature>30',
      'windSpeed>18',
      'waveHeight>0.8',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [5,6,7,8,9]
  },
  {
    id: 'sea_swimming',
    name: 'Sea Swimming',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['sport','water','sea','coastal','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=16..22',
      'airTemperature=18..24',
      'windSpeed<8',
      'gust<10',
      'waveHeight<0.4',
      'visibility>10',
      'precipitation=0',
      'windRelative=onshore & windSpeed<6 or windRelative=cross-shore & windSpeed<8'
    ],
    goodConditions: [
      'waterTemperature=14..24',
      'airTemperature=14..28',
      'windSpeed<12',
      'gust<14',
      'waveHeight<0.6',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=onshore & windSpeed<=8 or windRelative=cross-shore & windSpeed<=12 or windRelative=side-onshore & windSpeed<=10'
    ],
    fairConditions: [
      'waterTemperature=12..14 or 24..28',
      'airTemperature=10..14 or 28..30',
      'windSpeed=12..15',
      'gust=14..18',
      'waveHeight=0.6..0.8',
      'visibility=2..5',
      'precipitation=2..5',
      'windRelative=offshore & windSpeed<=5 & gust<=8 & waveHeight<0.4'
    ],
    poorConditions: [
      'waterTemperature<12',
      'airTemperature<10 or airTemperature>30',
      'windSpeed>15',
      'gust>18',
      'waveHeight>0.8',
      'visibility<2',
      'precipitation>5',
      'windRelative=offshore & windSpeed>6',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [5,6,7,8,9,10]
  },
  {
    id: 'indoor_swimming',
    name: 'Indoor Swimming',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: false,
    tags: ['sport','water','indoor','fitness','year-round']
  },
  {
    id: 'sailing',
    name: 'Sailing (Coastal)',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport','water','sea','coastal','boat','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'airTemperature=14..22',
      'windSpeed=8..15',
      'gust<18',
      'waveHeight<1.0',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'airTemperature=10..26',
      'windSpeed=6..20',
      'gust<24',
      'waveHeight<1.5',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'airTemperature=5..10 or 26..30',
      'windSpeed=4..6 or 20..25',
      'gust=24..30',
      'waveHeight=1.5..2.2',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'airTemperature<5 or airTemperature>30',
      'windSpeed<4 or windSpeed>25',
      'gust>30',
      'waveHeight>2.2',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [4,5,6,7,8,9,10],
    indoorAlternative: 'Study charts, practise knots, or plan a passage'
  },
  {
    id: 'sailing_inland',
    name: 'Sailing (Inland)',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    applyBeaufort: true,
    tags: ['sport','water','inland','lake','dinghy','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'temperature=14..24',
      'windSpeed=6..12',
      'gust<16',
      'waveHeight<0.5',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'temperature=10..26',
      'windSpeed=4..16',
      'gust<20',
      'waveHeight<0.8',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'temperature=5..10 or 26..30',
      'windSpeed=2..4 or 16..20',
      'gust=20..24',
      'waveHeight=0.8..1.0',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'temperature<5 or temperature>30',
      'windSpeed<2 or windSpeed>20',
      'gust>24',
      'waveHeight>1.0',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [4,5,6,7,8,9,10],
    indoorAlternative: 'Knot practice, rules revision, or simulator'
  },
  {
    id: 'windsurfing',
    name: 'Windsurfing',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['sport','water','sea','coastal','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=14..24',
      'airTemperature=12..26',
      'windSpeed=12..20',
      'gust<25',
      'waveHeight=0.5..1.5',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=cross-shore & windSpeed=12..20 or windRelative=side-onshore & windSpeed=12..20'
    ],
    goodConditions: [
      'waterTemperature=12..26',
      'airTemperature=10..28',
      'windSpeed=10..25',
      'gust<30',
      'waveHeight=0.3..2.0',
      'visibility>5',
      'precipitation=0..4',
      'windRelative=cross-shore & windSpeed=10..25 or windRelative=side-onshore & windSpeed=10..22 or windRelative=onshore & windSpeed<=18 & waveHeight<=1.2 or windRelative=side-offshore & windSpeed<=18 & waveHeight<0.6'
    ],
    fairConditions: [
      'waterTemperature=10..12 or 26..28',
      'airTemperature=8..10 or 28..30',
      'windSpeed=8..10 or 25..30',
      'gust=30..35',
      'waveHeight=0.2..0.3 or 2.0..2.5',
      'visibility=2..5',
      'precipitation=4..8',
      'windRelative=onshore & windSpeed<=22 & waveHeight<=1.5 or windRelative=offshore & windSpeed<=6 & waveHeight<0.4'
    ],
    poorConditions: [
      'waterTemperature<10',
      'airTemperature<8 or airTemperature>32',
      'windSpeed<8 or windSpeed>30',
      'gust>35',
      'waveHeight>2.5',
      'visibility<2',
      'precipitation>8',
      'windRelative=offshore & windSpeed>6',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [4,5,6,7,8,9,10],
    indoorAlternative: 'Rig tuning, fitness, or watch technique videos'
  },
  {
    id: 'kitesurfing',
    name: 'Kitesurfing',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['sport','water','sea','coastal','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=16..24',
      'airTemperature=14..26',
      'windSpeed=14..22',
      'gust<28',
      'waveHeight=0.5..1.8',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=cross-shore & windSpeed=14..22 or windRelative=side-onshore & windSpeed=14..22'
    ],
    goodConditions: [
      'waterTemperature=12..26',
      'airTemperature=10..28',
      'windSpeed=12..26',
      'gust<32',
      'waveHeight=0.3..2.2',
      'visibility>5',
      'precipitation=0..4',
      'windRelative=cross-shore & windSpeed=12..26 or windRelative=side-onshore & windSpeed=12..24 or windRelative=onshore & windSpeed<=18 & waveHeight<=1.2'
    ],
    fairConditions: [
      'waterTemperature=10..12 or 26..28',
      'airTemperature=8..10 or 28..30',
      'windSpeed=10..12 or 26..30',
      'gust=32..36',
      'waveHeight=0.2..0.3 or 2.2..2.5',
      'visibility=2..5',
      'precipitation=4..8',
      'windRelative=onshore & windSpeed<=20 & waveHeight<=1.5 or windRelative=offshore & windSpeed<=6 & waveHeight<0.4'
    ],
    poorConditions: [
      'waterTemperature<10',
      'airTemperature<8 or airTemperature>32',
      'windSpeed<10 or windSpeed>30',
      'gust>36',
      'waveHeight>2.5',
      'visibility<2',
      'precipitation>8',
      'windRelative=offshore & windSpeed>6',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [4,5,6,7,8,9,10],
    indoorAlternative: 'Kite maintenance, line tuning, or strength & mobility'
  },
  {
    id: 'scuba_diving',
    name: 'Scuba Diving',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport','water','sea','coastal','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=14..24',
      'airTemperature=12..26',
      'windSpeed<10',
      'gust<12',
      'waveHeight<0.6',
      'swellPeriod=8..14',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'waterTemperature=12..26',
      'airTemperature=10..28',
      'windSpeed<15',
      'gust<18',
      'waveHeight<1.0',
      'swellPeriod=6..14',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'waterTemperature=10..12 or 26..28',
      'airTemperature=8..10 or 28..30',
      'windSpeed=15..20',
      'gust=18..22',
      'waveHeight=1.0..1.5',
      'swellPeriod=5..8',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'waterTemperature<10',
      'airTemperature<8 or airTemperature>32',
      'windSpeed>20',
      'gust>22',
      'waveHeight>1.5',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [5,6,7,8,9,10],
    indoorAlternative: 'Pool skills, gear maintenance, or dive planning'
  },
  {
    id: 'jetskiing',
    name: 'Jet Skiing',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    tags: ['sport','water','sea','coastal','outdoors','motor','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=16..26',
      'airTemperature=18..28',
      'windSpeed<10',
      'gust<12',
      'waveHeight<0.8',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'waterTemperature=14..28',
      'airTemperature=14..30',
      'windSpeed<15',
      'gust<18',
      'waveHeight<1.2',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'waterTemperature=12..14 or 28..30',
      'airTemperature=10..14 or 30..32',
      'windSpeed=15..20',
      'gust=18..22',
      'waveHeight=1.2..1.8',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'waterTemperature<12',
      'airTemperature<10 or airTemperature>32',
      'windSpeed>20',
      'gust>22',
      'waveHeight>1.8',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [5,6,7,8,9],
    indoorAlternative: 'Maintenance, safety review, or route planning'
  },
  {
    id: 'sup_sea',
    name: 'Stand-up Paddleboarding (Sea)',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['sport','water','sea','coastal','outdoors','Saturday','Sunday','holiday'],
    perfectConditions: [
      'waterTemperature=16..24',
      'airTemperature=18..26',
      'windSpeed<6',
      'gust<8',
      'waveHeight<0.3',
      'visibility>10',
      'precipitation=0',
      'windRelative=onshore & windSpeed<6 or windRelative=cross-shore & windSpeed<6'
    ],
    goodConditions: [
      'waterTemperature=14..26',
      'airTemperature=14..28',
      'windSpeed<10',
      'gust<12',
      'waveHeight<0.5',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=onshore & windSpeed<=8 or windRelative=cross-shore & windSpeed<=10 or windRelative=side-onshore & windSpeed<=8'
    ],
    fairConditions: [
      'waterTemperature=12..14 or 26..28',
      'airTemperature=10..14 or 28..30',
      'windSpeed=10..12',
      'gust=12..15',
      'waveHeight=0.5..0.7',
      'visibility=2..5',
      'precipitation=2..5',
      'windRelative=offshore & windSpeed<=5 & gust<=8 & waveHeight<0.4'
    ],
    poorConditions: [
      'waterTemperature<12',
      'airTemperature<10 or airTemperature>30',
      'windSpeed>12',
      'gust>15',
      'waveHeight>0.7',
      'visibility<2',
      'precipitation>5',
      'windRelative=offshore & windSpeed>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [5,6,7,8,9],
    indoorAlternative: 'Practise balance drills, repair kit, or plan a route'
  },
  {
    id: 'windsurfing_inland',
    name: 'Windsurfing (Inland)',
    category: 'Active Sports',
    secondaryCategory: 'Water Sports',
    weatherSensitive: true,
    usesWindRelative: false,            // direction relative to a shoreline not required for lakes
    requiresBeachOrientation: false,
    tags: ['water', 'wind', 'lake', 'reservoir', 'flatwater', 'Saturday', 'Sunday', 'holiday'],
    // Simpler, flat-water focused thresholds (OpenWeather data only)
    poorConditions: [
      'windSpeed<5',                    // too light to make progress/return
      'windSpeed>20',                   // very strong; advanced only
      'gust>16',                        // unstable, unpleasant
      'precipitation>6',                // heavy rain reduces visibility
      'temperature<10',                 // cold air without good gear
      'temperature>32',                 // heat stress
      'visibility<2',                   // fog, low contrast
      'snowfallRateMmH>0.5',            // snowfall hides horizon and gear
      'snowDepthCm>0.5'                 // beach ramps & rigs buried quickly
    ],
    fairConditions: [
      'windSpeed=5..7',                 // learner/float, non-planing
      'windSpeed=16..20',               // strong; experienced riders
      'gust=12..16',                    // gusty but doable
      'temperature=10..14 or temperature=28..32',
      'precipitation=1..6',
      'visibility=2..5'
    ],
    goodConditions: [
      'windSpeed=7..14',                // planing likely for many set-ups
      'gust<=12',
      'temperature=14..28',
      'precipitation<=2',
      'visibility>5'
    ],
    perfectConditions: [
      'windSpeed=8..12',                // steady, forgiving
      'gust<8',
      'temperature=18..24',
      'precipitation=0',
      'visibility>10'
    ],
    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise balance, study technique videos, or maintain your gear'
  },
];
