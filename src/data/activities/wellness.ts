import type { ActivityType } from './types';

export const wellnessSports: ActivityType[] = [
  {
    id: 'running',
    name: 'Running',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Cardio & Running',
    weatherSensitive: true,
    tags: ['sport','cardio','exercise','Monday','Tuesday','Wednesday','Thursday','Saturday','Sunday'],
    perfectConditions: ['temperature=10..13','windSpeed<8','clouds=20..60','humidity=45..60','visibility>10','precipitation=0'],
    goodConditions: ['temperature=5..20','windSpeed<18','clouds=0..100','humidity<80','visibility>2','precipitation=0'],
    fairConditions: ['temperature=0..5 or 20..25','windSpeed<=25','humidity<=90','precipitation<=4','visibility>=1'],
    poorConditions: ['temperature<0 or temperature>25..28','windSpeed>25','precipitation>4','humidity>90','visibility<1','snowfallRateMmH>1','snowDepthCm>3']
  },
  
  {
    id: 'cycling',
    name: 'Cycling',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Cardio & Running',
    weatherSensitive: true,
    tags: ['sport','cycling','cardio','group','solo','Saturday','Sunday','Wednesday'],
    perfectConditions: ['temperature=18..24','windSpeed<10','clouds=10..50','humidity=40..60','precipitation=0','visibility>10'],
    goodConditions: ['temperature=14..28','windSpeed<15','clouds=0..80','humidity<75','precipitation=0','visibility>5'],
    fairConditions: ['temperature=8..14 or 28..30','windSpeed=15..20','humidity=75..85','precipitation=1..2','visibility=2..5'],
    poorConditions: ['temperature<8 or temperature>30','windSpeed>20','precipitation>2','humidity>85','visibility<2','snowfallRateMmH>1','snowDepthCm>2']
  },
  {
    id: 'boxing',
    name: 'Boxing',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Strength & Gym',
    weatherSensitive: false,
    tags: ['fitness', 'personal', 'health', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'self-care'],
  },
  
  {
    id: 'gym_workout',
    name: 'Gym',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Strength & Gym',
    weatherSensitive: false,
    tags: ['fitness', 'personal', 'health', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'self-care'],
  },
  {
    id: 'martial_arts',
    name: 'Martial Arts',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: false,
    tags: ['relaxation', 'discipline', 'mindfulness', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'self-care'],
  },
  {
    id: 'meditation',
    name: 'Meditation',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: false,
    tags: ['relaxation', 'wellness', 'mindfulness', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'self-care'],
  },
  {
    id: 'outdoor_gym',
    name: 'Outdoor Gym',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Strength & Gym',
    weatherSensitive: true,
    tags: ['exercise', 'outdoor', 'fitness', 'social', 'accessible', 'Saturday', 'Sunday', 'holiday'],

    poorConditions: [
      'precipitation>5',           // heavy rain makes it unpleasant
      'windSpeed>25',              // strong wind, especially risky for elderly
      'temperature<2',             // too cold, risk of stiffness or slips
      'temperature>35',            // excessive heat, unsafe for older users
      'visibility<2',              // foggy, unsafe
      'snowfallRateMmH>0.5',       // snow turns equipment slick
      'snowDepthCm>1'              // settled snow hides trip hazards
    ],

    fairConditions: [
      'temperature=2..8 or temperature=28..32', // cool or warm but manageable
      'windSpeed=15..20',                       // breezy but not unsafe
      'cloudCover=80-100',                      // overcast or dull light
      'humidity=80..90',                        // muggy but tolerable
      'visibility=2..5'                         // hazy conditions
    ],

    goodConditions: [
      'temperature=8..28',         // broad acceptable range
      'windSpeed<15',
      'cloudCover=0-80',
      'humidity<80',
      'visibility>5',
      'precipitation=0'
    ],

    perfectConditions: [
      'temperature=15..22',        // mild & comfortable
      'windSpeed<8',
      'cloudCover=20-50',
      'humidity=40-65',
      'visibility>10',
      'precipitation=0'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Head to an indoor gym or do a bodyweight workout at home'
  },
  {
    id: 'outdoor_meditation',
    name: 'Outdoor Meditation',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: true,
    tags: [
      'outdoor', 'mindfulness', 'relaxation', 'wellbeing', 'nature',
      'Saturday', 'Sunday', 'holiday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
    ],

    poorConditions: [
      'precipitation>0',         // wet conditions ruin stillness
      'windSpeed>25',            // increased from 20 - strong gusts are distracting, but moderate wind is fine
      'temperature<2',           // reduced from 5 - mildly cool is manageable with proper clothing
      'temperature>32',          // increased from 30 - hot but not dangerous
      'snowfallRateMmH>0.5',     // active snow breaks focus and soaks mats
      'snowDepthCm>1'            // even shallow snow makes sitting grounds unusable
    ],

    fairConditions: [
      'temperature=2..8 or 28..32',   // wider acceptable range
      'windSpeed=20..25',             // moved threshold up
      'cloudCover=80-100',            // dull, but not oppressive
      'humidity=85..95',              // moved humidity threshold up - 84% should be fine
      'visibility=2..5',               // hazy or misty, calming to some
      'precipitation>0.5',               // no Rain
    ],

    goodConditions: [
      'temperature=12..28',           // extended pleasant range
      'windSpeed<20',                 // increased from 15 - light breeze can be pleasant
      'humidity<85',                   // added humidity condition for good weather
      'cloudCover=0-80',              // clear to partly cloudy
      'visibility>5',                 // clear enough to see surroundings
      'precipitation=0'               // no Rain
    ],

    perfectConditions: [
      'temperature=18..24',           // slightly wider ideal balance
      'windSpeed<10',
      'humidity<70',                   // perfect conditions have low humidity
      'cloudCover=20-50',             // some sun for warmth
      'visibility>10',                 // clear and bright
      'precipitation=0'                // no Rain
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10]
  },
  {
    id: 'outdoor_yoga',
    name: 'Yoga in the Park',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: true,
    tags: [
      'exercise',
      'outdoor',
      'mindfulness',
      'relaxation',
      'wellbeing',
      'social',
      'nature',
      'fresh_air',
      'Saturday',
      'Sunday',
      'holiday'
    ],

    poorConditions: [
      'precipitation>0',            // rain makes it wet and unsafe
      'windSpeed>25',               // increased from 20 - strong gusts make balance difficult
      'temperature<5',              // increased tolerance from 8
      'temperature>32',             // increased from 30 - oppressive heat
      'humidity>90',                // increased from 85 - really muggy & sticky
      'visibility<2',               // foggy, gloomy
      'snowfallRateMmH>0.5',        // snow adds slip risk on mats
      'snowDepthCm>1'               // packed snow uneven underfoot
    ],

    fairConditions: [
      'temperature=5..10 or temperature=28..32', // wider range
      'windSpeed=18..25',                        // adjusted range
      'humidity=85..90',                         // narrower range - move 84% to good
      'cloudCover=70-100',                       // dull or overcast
      'visibility=2..5'                          // hazy conditions
    ],

    goodConditions: [
      'temperature=10..28',         // extended range to include 22°C comfortably
      'windSpeed<18',              // increased from 12 to include 9km/h comfortably  
      'cloudCover=0-70',
      'humidity<85',               // 84% humidity should now be good!
      'visibility>5',
      'precipitation=0'
    ],

    perfectConditions: [
      'temperature=18..22',
      'windSpeed<8',
      'cloudCover=20-50',
      'humidity=50-65',
      'visibility>10',
      'precipitation=0'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise at home with a video, visit a studio, or do a short meditation session'
  },
  {
    id: 'pilates',
    name: 'Pilates',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: false,
    tags: ['wellness', 'relaxation', 'mindfulness', 'self-care', 'Sunday', 'Monday', 'Wednesday', 'evening'],
  },
  {
    id: 'spinning',
    name: 'Spinning',
    category: 'Fitness & Wellness',
    weatherSensitive: false,
    tags: ['fitness', 'personal', 'cycling', 'health', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'self-care'],
  },
    {
    id: 'tai_chi',
    name: 'Tai Chi',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: false,
    tags: ['relaxation', 'wellness', 'mindfulness', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'self-care']
  },
  {
    id: 'yoga',
    name: 'Yoga',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Mindfulness',
    weatherSensitive: false,
    tags: ['wellness', 'relaxation', 'mindfulness', 'self-care', 'Sunday', 'Monday', 'Wednesday', 'evening'],
  },
  {
    id: 'zumba',
    name: 'Zumba',
    category: 'Fitness & Wellness',
    weatherSensitive: false,
    tags: ['fitness', 'personal', 'dance', 'health', 'evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'self-care'],
  },
];

export default wellnessSports;
