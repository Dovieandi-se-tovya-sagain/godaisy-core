import type { ActivityType } from './types';

export const outdoorRecreation: ActivityType[] = [
  {
    id: 'hiking',
    name: 'Hiking',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['nature', 'walking', 'outdoors', 'leisure', 'Saturday', 'Sunday'],
    perfectConditions: [
      'temperature=15..18',
      'windSpeed<10',
      'clouds=20..50',
      'humidity=40..60',
      'soilMoisture=20..35',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'temperature=8..24',
      'windSpeed<15',
      'clouds=20..80',
      'humidity<75',
      'soilMoisture=20..45',
      'visibility>5',
      'precipitation=0'
    ],
    fairConditions: [
      'temperature=2..8 or 24..28',
      'windSpeed=15..25',
      'clouds=0..20 or 80..100',
      'humidity=75..90',
      'precipitation=1..5',
      'soilMoisture=45..60',
      'visibility=1..5'
    ],
    poorConditions: [
      'temperature<2 or temperature>28',
      'windSpeed>25',
      'precipitation>5',
      'humidity>90',
      'soilMoisture>60',
      'visibility<1',
      'snowfallRateMmH>1',
      'snowDepthCm>4'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Hit the gym for a treadmill incline workout or a strength session'
  },
  {
    id: 'rock_climbing',
    name: 'Rock Climbing',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'outdoors', 'adventure', 'technical', 'Saturday', 'Sunday', 'Friday'],
    perfectConditions: [
      'temperature=12..18',
      'windSpeed<8',
      'humidity=30-50',
      'cloudCover=20-40',
      'visibility>10',
      'precipitation=0'
    ],
    goodConditions: [
      'temperature=10..22',
      'windSpeed<15',
      'humidity<60',
      'cloudCover=20-50',
      'visibility>5',
      'precipitation=0'
    ],
    fairConditions: [
      'temperature=5..10 or 22..28',
      'windSpeed=15..25',
      'humidity=60..80',
      'cloudCover=50-100',
      'visibility=2..5'
    ],
    poorConditions: [
      'temperature<5 or temperature>28',
      'windSpeed>25',
      'precipitation>2',
      'humidity>80',
      'visibility<2',
      'snowfallRateMmH>1',
      'snowDepthCm>2'
    ],
    seasonalMonths: [3, 4, 5, 6, 9, 10],
    indoorAlternative: 'Train at an indoor climbing gym or work on finger strength at home'
  },
  {
    id: 'rock_hopping',
    name: 'Rock Hopping',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['adventure', 'walking', 'nature', 'coastal', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'temperature<5',
      'temperature>28',
      'precipitation>0',
      'windSpeed>15',
      'visibility<2',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    fairConditions: [
      'temperature=5..10',
      'temperature=22..26',
      'windSpeed=10..15',
      'cloudCover=60-90',
      'visibility=2..5',
      'precipitation=0..0.5'
    ],
    goodConditions: [
      'temperature=10..22',
      'windSpeed<10',
      'cloudCover=10-60',
      'precipitation=0',
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=15..20',
      'windSpeed<5',
      'cloudCover=20-50',
      'precipitation=0',
      'visibility>10'
    ],
    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Plan your next coastal walk or practise balance & agility exercises'
  },
  {
    id: 'outdoor_playground',
    name: 'Playground Time',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: [
      'leisure', 'outdoor', 'family',
      'Saturday', 'Sunday', 'holiday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
    ],
    poorConditions: [
      'precipitation>0',
      'windSpeed>20',
      'temperature<5',
      'temperature>30',
      'soilMoisture<10 or soilMoisture>60',
      'snowfallRateMmH>0.5',
      'snowDepthCm>1'
    ],
    fairConditions: [
      'temperature=5..10 or 25..30',
      'windSpeed=15..20',
      'cloudCover=70-100',
      'humidity=70..85',
      'soilMoisture=10..15 or soilMoisture=45..60',
      'visibility=2..5'
    ],
    goodConditions: [
      'temperature=15..25',
      'windSpeed<15',
      'precipitation=0',
      'soilMoisture=15..45'
    ],
    perfectConditions: [
      'temperature=18..22',
      'windSpeed<10',
      'precipitation=0',
      'soilMoisture=20..35'
    ],
    seasonalMonths: [4, 5, 6, 7, 8, 9, 10]
  },
  {
    id: 'riding_motorbike',
    name: 'Motorbiking',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'auto', 'social', 'group', 'solo', 'Saturday', 'Sunday', 'Wednesday'],
    perfectConditions: [
      'temperature=16..22',
      'windSpeed<8',
      'clouds=10..50',
      'humidity=40..55',
      'precipitation=0',
      'visibility>10'
    ],
    goodConditions: [
      'temperature=10..28',
      'windSpeed<15',
      'clouds=0..80',
      'humidity<75',
      'precipitation=0',
      'visibility>5'
    ],
    fairConditions: [
      'temperature=5..10 or 28..32',
      'windSpeed=15..25',
      'humidity=80..90',
      'precipitation=1..3',
      'visibility=2..5'
    ],
    poorConditions: [
      'temperature<5 or temperature>30',
      'windSpeed>25',
      'precipitation>3',
      'humidity>90',
      'visibility<2',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10]
  },
  {
    id: 'beekeeping',
    name: 'Beekeeping',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['hobby', 'nature', 'craft', 'stewardship', 'agriculture', 'Saturday', 'Sunday', 'Wednesday'],
    poorConditions: [
      'temperature<12',                // bees stay clustered
      'temperature>32',                // stressful for bees & beekeeper
      'precipitation>2',              // bees stay inside
      'windSpeed>15',                 // bees irritable & hard to control
      'cloudCover>80',                // bees defensive under dark skies
      'humidity>85',                  // damp, sticky, bees agitated
      'snowfallRateMmH>0.5',          // snowfall chills colonies rapidly
      'snowDepthCm>2'                 // hive access blocked by drifts
    ],
    fairConditions: [
      'temperature=12..15',           // cooler, bees less active
      'windSpeed=10..15',             // light breeze, not ideal
      'cloudCover=60-80',             // duller conditions
      'humidity=75..85',              // borderline sticky
      'precipitation=0..2'            // light drizzle
    ],
    goodConditions: [
      'temperature=15..28',
      'windSpeed<10',
      'cloudCover=10-60',
      'humidity<75'
    ],
    perfectConditions: [
      'temperature=18..24',
      'windSpeed<5',
      'cloudCover=10-30',
      'humidity=50-65',
      'precipitation=0'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Inspect and repair equipment, assemble frames, render wax, or read up on hive management'
  },
  {
    id: 'foraging',
    name: 'Foraging',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['nature', 'food', 'hiking', 'quiet', 'discovery', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'temperature<5',                 // uncomfortable & limited growth
      'temperature>30',                // too dry or hot
      'precipitation>10',              // soaking, slippery, poor footing
      'windSpeed>25',                  // makes identifying & reaching plants harder
      'visibility<2',                  // unsafe, difficult to see or ID
      'soilMoisture<10 or soilMoisture>60', // parched ground or boggy forest floor
      'snowfallRateMmH>1',             // active snow hides foliage & paths
      'snowDepthCm>3'                  // ground cover inaccessible under snow
    ],
    fairConditions: [
      'temperature=6..12',
      'windSpeed<20',
      'precipitation=0..5',            // light drizzle okay
      'cloudCover=30-100',
      'visibility=3..5',
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],
    goodConditions: [
      'temperature=12..20',
      'windSpeed<15',
      'precipitation=0..1',            // recent light rain helps growth
      'cloudCover=30-80',
      'humidity=60..85',
      'visibility>5',
      'soilMoisture=15..45'
    ],
    perfectConditions: [
      'temperature=14..18',
      'windSpeed<8',
      'precipitation=0',
      'cloudCover=40-70',
      'humidity=65..75',
      'visibility>10',
      'soilMoisture=20..35'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    indoorAlternative: 'Research seasonal finds, preserve what you’ve picked, or prep recipes with past harvests'
  },
  {
    id: 'frisbee',
    name: 'Frisbee',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['leisure', 'outdoor', 'social', 'fun', 'light_exercise', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'temperature<5',              // too cold to enjoy
      'temperature>32',             // too hot & uncomfortable
      'windSpeed>20',               // frisbee control very poor
      'precipitation>2',            // wet & slippery
      'visibility<2',               // foggy, unsafe
      'snowfallRateMmH>0.5',        // flakes ruin disc flight & grip
      'snowDepthCm>1'               // settling snow hides footing
    ],

    fairConditions: [
      'temperature=5..10 or temperature=28..32', // chilly or hot but playable
      'windSpeed=15..20',                        // breezy, throws go wild
      'cloudCover=80-100',                       // overcast or grey skies
      'precipitation=0.5..2',                    // light drizzle possible
      'visibility=2..5'                          // a bit murky
    ],

    goodConditions: [
      'temperature=10..28',        // comfortable for most
      'windSpeed<15',              // still playable
      'cloudCover=0-80',
      'visibility>5',
      'precipitation=0'
    ],

    perfectConditions: [
      'temperature=18..24',        // ideal comfort
      'windSpeed<8',               // calm & easy control
      'cloudCover=20-50',
      'visibility>10',
      'precipitation=0'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise throws indoors or play a tabletop game with friends'
  },
   {
    id: 'geocaching',
    name: 'Geocaching',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['outdoors', 'adventure', 'hiking', 'game', 'exploration', 'social', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'temperature<-2',               // freezing and uncomfortable
      'temperature>34',              // risk of overheating
      'windSpeed>30',                // dangerous in wooded or exposed areas
      'precipitation>10',           // heavy rain or storms
      'visibility<2',                // poor navigation and safety risks
      'soilMoisture<10 or soilMoisture>60', // frozen ground or boggy terrain
      'snowfallRateMmH>1',           // snow hides caches & trails fast
      'snowDepthCm>3'                // deep snow makes tracking unsafe
    ],

    fairConditions: [
      'temperature=0..8',            // chilly but manageable
      'temperature=26..32',          // a bit hot for walking, but fine in short bursts
      'windSpeed=20..30',            // gusty but not extreme
      'precipitation=2..6',          // light to moderate rain, may affect enjoyment
      'visibility=2..5',             // limited visibility but not unsafe
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],

    goodConditions: [
      'temperature=8..26',
      'windSpeed<20',
      'cloudCover=0-80',
      'precipitation=0..2',          // light drizzle at most
      'visibility>5',
      'soilMoisture=15..45'
    ],

    perfectConditions: [
      'temperature=15..22',
      'windSpeed<10',
      'cloudCover=10-50',            // pleasant light, not too bright or gloomy
      'precipitation=0',
      'visibility>10',
      'soilMoisture=20..35'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],

    indoorAlternative: 'Log past finds online, solve puzzle caches, or plan your next route'
  },
 {
    id: 'horse_riding',
    name: 'Horse Riding',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'animal', 'leisure', 'outdoors', 'Saturday', 'Sunday'],

    perfectConditions: [
      'temperature=15..20',         // optimal comfort for horse and rider
      'windSpeed<10',               // low wind = safe control and calm horses
      'cloudCover=20-50',           // soft light, not glaring or gloomy
      'soilMoisture=20..35',        // secure footing without deep mud
      'visibility>10'               // ideal for hacking, eventing, or lessons
    ],

    goodConditions: [
      'temperature=8..27',          // broad comfortable range
      'windSpeed<15',               // manageable breeze
      'cloudCover=10-80',           // sunny to overcast, no issue
      'soilMoisture=15..45',        // some give but not hazardous
      'visibility>5'                // clear enough for trail or arena riding
    ],

    fairConditions: [
      'temperature=5..8 or 27..30', // cool or hot but rideable
      'windSpeed=15..25',           // windier = less pleasant, possibly spookier
      'cloudCover=80-100',          // flat light or gloom
      'precipitation=0..10',        // light rain or recent damp, may affect footing
      'soilMoisture=10..15 or soilMoisture=45..60', // hard or boggy patches
      'visibility=2..5'             // murky conditions, not unsafe but not ideal
    ],

    poorConditions: [
      'temperature<5 or temperature>30',  // icy or dangerously hot
      'windSpeed>25',                    // hard to control horses, trees blowing
      'precipitation>10',                // muddy, unsafe ground
      'soilMoisture<10 or soilMoisture>60', // either rock-hard or deep mud
      'visibility<2',                    // fog, dusk, or heavy rain limit sight
      'snowfallRateMmH>1',               // heavy snow spooks horses & destroys footing
      'snowDepthCm>3'                    // deeper snow risks slips & tendon strains
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],  // reflects most outdoor riding seasons

    indoorAlternative: 'Ride in the indoor school, groom your horse, or clean tack'
  },
  {
    id: 'rollerblading',
    name: 'Rollerblading',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['exercise', 'outdoor', 'fitness', 'fun', 'leisure', 'Saturday', 'Sunday', 'holiday'],

    // Unsafe or unpleasant conditions
    poorConditions: [
      'temperature<5',               // cold, stiff joints
      'temperature>32',              // heat stress
      'windSpeed>20',                // gusty, unstable
      'precipitation>0',             // wet surface, dangerous
      'visibility<2',                // fog, unsafe
      'snowfallRateMmH>0.5',         // light snow makes surfaces slick instantly
      'snowDepthCm>0.5'              // thin snow cover hides cracks
    ],

    // Manageable but not ideal — may require caution
    fairConditions: [
      'temperature=5..10 or 28..30', // brisk or slightly hot
      'windSpeed=15..20',            // breezy, may affect balance
      'cloudCover=80-100',           // overcast skies
      'visibility=2..5'              // misty or hazy
    ],

    // Comfortable and safe conditions
    goodConditions: [
      'temperature=10..28',          // wide comfort range
      'windSpeed<15',
      'cloudCover=0-80',
      'visibility>5',
      'precipitation=0'
    ],

    // Optimal, enjoyable weather
    perfectConditions: [
      'temperature=18..24',          // mild and comfortable
      'windSpeed<8',                 // stable and safe
      'cloudCover=10-50',
      'visibility>10',
      'precipitation=0'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],

    indoorAlternative: 'Visit an indoor roller rink or practise strength & balance exercises at home'
  },
  {
    id: 'skateboarding',
    name: 'Skateboarding',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['exercise', 'outdoor', 'leisure', 'lifestyle', 'creative', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'temperature<5',               // too cold, stiff joints
      'temperature>32',              // oppressive heat
      'windSpeed>20',                // gusty, unstable
      'precipitation>0',             // wet surface, unsafe
      'visibility<2',                // fog, unsafe
      'snowfallRateMmH>0.5',         // snow makes decks & ramps treacherous
      'snowDepthCm>0.5'              // light snow hides cracks & coping
    ],

    fairConditions: [
      'temperature=5..12 or temperature=28..32', // cool or hot but tolerable
      'windSpeed=18..20',                        // breezy but manageable
      'cloudCover=90-100',                       // overcast, not ideal
      'visibility=2..5'                          // dim or hazy
    ],

    goodConditions: [
      'temperature=12..28',         // broad range
      'windSpeed<18',
      'cloudCover=0-90',
      'visibility>5',
      'precipitation=0'

    ],

    perfectConditions: [
      'temperature=18..24',         // comfortable
      'windSpeed<10',               // calm
      'cloudCover=10-50',
      'precipitation=0',
      'visibility>10'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Find a covered spot under a bridge, in a garage, or at an indoor skatepark'
  },
  {
    id: 'stargazing',
    name: 'Stargazing',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['night', 'sky', 'astronomy', 'Friday', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'clouds>50',          // too much cloud cover
      'precipitation>0',    // rain blocks view
      'windSpeed>20',       // hard to stay comfortable
      'temperature<-5',     // extreme cold
      'snowfallRateMmH>0.5',// falling snow obscures the sky instantly
      'snowDepthCm>2'       // deep snow makes travel & setup difficult
    ],

    fairConditions: [
      'temperature=-5..5',    // chilly but manageable
      'clouds=20..50',        // patchy, some gaps
      'windSpeed=10..20'      // breezy, may reduce comfort
    ],

    goodConditions: [
      'temperature=5..15',     // crisp but pleasant
      'clouds<=20',            // mostly clear
      'windSpeed<10',           // calm or gentle breeze
      'precipitation=0',     // no rain
    ],

    perfectConditions: [
      'temperature=8..12',     // just right
      'clouds=0',              // clear skies
      'windSpeed<5',           // still night
      'precipitation=0',      // no rain
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10]
  },
  {
    id: 'urban_exploring',
    name: 'Go for a Walk',
    category: 'Outdoor Activities',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['wellbeing', 'leisure', 'fitness', 'outdoors', 'urban', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    poorConditions: [
      'temperature<-5',                // freezing & icy
      'temperature>35',               // heat exhaustion risk
      'windSpeed>40',                 // strong gales
      'precipitation>3',             // torrential rain
      'visibility<2',                 // fog, unsafe
      'snowfallRateMmH>1',            // heavy snow reduces visibility & traction
      'snowDepthCm>4'                 // deep snow makes pavements slippery
    ],
    fairConditions: [
      'temperature=-5..5',            // cold but tolerable
      'temperature=25..30',           // warm for brisk walking
      'windSpeed=15..30',             // breezy but manageable
      'precipitation=0..3',          // light to moderate rain
      'visibility=2..5'               // reduced visibility but acceptable
    ],
    goodConditions: [
      'temperature=6..25',
      'windSpeed<15',
      'cloudCover=0-90',
      'precipitation=0',
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=12..20',
      'windSpeed<8',
      'cloudCover=20-60',
      'precipitation=0',
      'visibility>10'
    ],
    seasonalMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    indoorAlternative: 'Stretch, do light yoga, or walk laps indoors at a mall or gym'
  },
  {
    id: 'trail_running',
    name: 'Trail Running',
    category: 'Active Sports',
    secondaryCategory: 'Cardio & Running',
    weatherSensitive: true,
    tags: ['sport','trail','nature','outdoors','Saturday','Sunday'],
  perfectConditions: ['temperature=8..14','windSpeed<8','clouds=10..50','humidity=40..55','soilMoisture=20..35','visibility>10','precipitation=0'],
  goodConditions: ['temperature=5..20','windSpeed<15','clouds=0..80','humidity<80','soilMoisture=20..45','visibility=2','precipitation=0'],
  fairConditions: ['temperature=2..5 or 20..25','windSpeed<=25','humidity<=90','precipitation=2..4','soilMoisture=45..60','visibility=1..2'],
  poorConditions: ['temperature=2..5 or 20..25','windSpeed>25','precipitation>4','humidity>90','soilMoisture>60','visibility<1','snowfallRateMmH>1','snowDepthCm>4'],
    seasonalMonths: [3,4,5,6,7,8,9,10]
  },
  {
    id: 'camping',
    name: 'Camping',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['nature', 'leisure', 'adventure', 'outdoors', 'social', 'holiday', 'Saturday', 'Sunday'],
    poorConditions: [
      'temperature<5',                // freezing nights
      'temperature>30',              // uncomfortable heat
      'windSpeed>25',                // tents unsafe
      'precipitation>5',            // heavy rain
      'soilMoisture<10 or soilMoisture>60', // ground either baked hard or boggy
      'visibility<2',                // fog & disorienting
      'snowfallRateMmH>1',           // tents collapse in active snowfall
      'snowDepthCm>3'                // deep snow makes pitching hazardous
    ],
    fairConditions: [
      'temperature=5..10',           // chilly mornings
      'temperature=25..30',          // hot but manageable
      'windSpeed=12..18',            // breezy but fine with guy lines
      'precipitation=0..5',         // showers, muddy but okay
      'humidity=80..90',             // muggy
      'soilMoisture=10..15 or soilMoisture=45..60', // firming or sloppy ground
      'visibility=2..5'              // misty but still campable
    ],
    goodConditions: [
      'temperature=10..25',
      'windSpeed<12',
      'cloudCover=10-70',
      'precipitation=0',
      'humidity<80',
      'soilMoisture=15..45',
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=15..20',
      'windSpeed<8',
      'cloudCover=20-50',
      'precipitation=0',
      'humidity=40-60',
      'soilMoisture=20..35',
      'visibility>10'
    ],
    seasonalMonths: [4, 5, 6, 7, 8, 9],
    indoorAlternative: 'Plan your next trip, check and pack gear, or camp in your garden for fun'
  },
];

export default outdoorRecreation;
