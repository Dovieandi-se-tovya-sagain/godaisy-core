import type { ActivityType } from './types';

export const natureActivities: ActivityType[] = [
  {
    id: 'birdwatching',
    name: 'Birdwatching',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['nature', 'wildlife', 'observation', 'leisure', 'patience', 'Saturday', 'Sunday'],

    perfectConditions: [
      'temperature=12..18',
      'windSpeed<5',
      'cloudCover=30-60',
      'visibility>10',
      'precipitation=0',
      'soilMoisture=20..35'
    ],

    goodConditions: [
      'temperature=5..24',
      'windSpeed<12',
      'cloudCover=20-80',
      'visibility>5',
      'precipitation=0',
      'soilMoisture=15..45'
    ],

    fairConditions: [
      'temperature=0..5 or 24..28',
      'windSpeed=12..15',
      'cloudCover=0-20 or 80-100',
      'precipitation=0..2',
      'visibility=2..5',
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],

    poorConditions: [
      'temperature<0 or temperature>28',
      'windSpeed>15',
      'precipitation>2',
      'visibility<2',
      'soilMoisture<10 or soilMoisture>60',
      'snowfallRateMmH>1',
      'snowDepthCm>2'
    ],

    seasonalMonths: [3, 4, 5, 9, 10, 11],

    indoorAlternative: 'Review your field guide and update your sightings log'
  },
  {
    id: 'outdoor_gardening',
    name: 'Gardening',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['hobby', 'relaxation', 'nature', 'creative', 'Saturday', 'Sunday'],
    perfectConditions: [
      'airTemperature=18..24',
      'windSpeed<5',
      'cloudCover=50..90',
      'humidity=50..70',
      'soilMoisture=30..50',
      'precipitation=0',
      'visibility>10'
    ],
    goodConditions: [
      'airTemperature=12..27',
      'windSpeed<12',
      'cloudCover=50..100',
      'precipitation=0',
      'humidity<80',
      'soilMoisture=20..60',
      'visibility>5'
    ],
    fairConditions: [
      'airTemperature=5..12 or 27..32',
      'windSpeed=12..20',
      'cloudCover=20..50',
      'precipitation=2..5',
      'humidity=80..90',
      'soilMoisture=10..20 or 60..70',
      'visibility=2..5'
    ],
    poorConditions: [
      'airTemperature<5 or airTemperature>32',
      'windSpeed>20',
      'precipitation>5',
      'humidity>90',
      'soilMoisture<10 or soilMoisture>70',
      'visibility<2',
      'snowfallRateMmH>1',
      'snowDepthCm>2'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    indoorAlternative: 'Plan garden layout or start seedlings indoors'
  },
   {
    id: 'mushroom_hunting',
    name: 'Mushroom Hunting',
    category: 'Outdoor Activities',
    secondaryCategory: 'Nature Activities',
    weatherSensitive: true,
    tags: ['nature', 'food', 'forest', 'seasonal', 'quiet', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    poorConditions: [
      'temperature<0',                // frost kills fungi
      'temperature>25',              // ground dries out
      'windSpeed>20',                // uncomfortable & risky
  'precipitation>10',            // flooded ground, unpleasant
      'visibility<2',                // fog, unsafe
      'soilMoisture<10 or soilMoisture>60', // barren or waterlogged forest floor
      'snowfallRateMmH>1',           // snow buries mushrooms & trails
      'snowDepthCm>3'                // snowpack hides logs and holes
    ],
    fairConditions: [
      'temperature=0..8',             // cool but possible
      'temperature=18..22',           // a bit warm, but shaded forests may be fine
      'windSpeed=10..20',             // breezy but manageable
      'precipitation=2..5',           // not ideal but damp enough
      'visibility=2..5',              // dim light may still be safe
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],
    goodConditions: [
      'temperature=8..18',
      'windSpeed<10',
      'cloudCover=10-90',
      'visibility>5',
      'soilMoisture=15..45'
    ],
    perfectConditions: [
      'temperature=10..15',
      'windSpeed<5',
      'cloudCover=20-60',
      'visibility>10',
      'soilMoisture=20..35'
    ],
    seasonalMonths: [9, 10, 11],
    indoorAlternative: 'Study a field guide, clean and cook previous finds, or dry mushrooms for storage'
  },
  {
    id: 'orienteering',
    name: 'Orienteering',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'navigation', 'outdoors', 'running', 'adventure', 'Saturday', 'Sunday'],
    poorConditions: [
      'temperature<0',                // icy & unsafe footing
      'temperature>30',              // heat exhaustion risk
      'windSpeed>30',                // unsafe in forested areas
      'precipitation>15',            // heavy rain, slippery
      'visibility<2',                // foggy, disorienting
      'soilMoisture<10 or soilMoisture>60', // icy-hard or boggy ground
      'snowfallRateMmH>1',           // heavy snow hides markers
      'snowDepthCm>3'                // deep snow disrupts footing
    ],
    fairConditions: [
      'temperature=0..5',            // cold but safe
      'temperature=22..26',          // warmer but manageable
      'windSpeed=20..30',            // breezy but doable
      'precipitation=5..10',         // light showers
      'visibility=2..5',             // reduced, but passable
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],
    goodConditions: [
      'temperature=5..22',
      'windSpeed<20',
      'cloudCover=10-80',
      'precipitation=0',
      'visibility>5',
      'soilMoisture=15..45'
    ],
    perfectConditions: [
      'temperature=10..16',
      'windSpeed<10',
      'cloudCover=30-60',
      'precipitation=0',
      'visibility>10',
      'soilMoisture=20..35'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise map reading & route planning or train on a treadmill'
  },
];

export default natureActivities;
