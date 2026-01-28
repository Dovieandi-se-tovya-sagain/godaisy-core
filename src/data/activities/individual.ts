import type { ActivityType } from './types';

export const individualSports: ActivityType[] = [
  {
    id: 'golf',
    name: 'Golf',
    category: 'Outdoor Activities',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: true,
    tags: ['sport', 'leisure', 'outdoors', 'social', 'Saturday', 'Sunday', 'Wednesday'],

    perfectConditions: [
      'temperature=15..21',
      'windSpeed<10',
      'cloudCover=30-60',
      'precipitation=0',
      'soilMoisture=20..35',
      'visibility>10'
    ],

    goodConditions: [
      'temperature=10..25',
      'windSpeed<20',
      'cloudCover=20..90',
      'precipitation=0',
      'soilMoisture=15..45',
      'visibility>5'
    ],
    fairConditions: [
      'temperature=5..10 or 25..32',
      'windSpeed=20..30',
      'precipitation=3..10',
      'cloudCover=90-100',
      'visibility=2..5',
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],
    poorConditions: [
      'temperature<5 or temperature>32',
      'windSpeed>30',
      'precipitation>10',
      'visibility<2',
      'soilMoisture<10 or soilMoisture>60',
      'snowfallRateMmH>1',
      'snowDepthCm>1'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],

    indoorAlternative: 'Practise your swing at the driving range or putting indoors with a mat'
  },
  {
    id: 'tennis',
    name: 'Outdoor Tennis',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: true,
    tags: ['sport', 'leisure', 'outdoors', 'social', 'Saturday', 'Sunday', 'Wednesday'],

    perfectConditions: [
      'temperature=15..21',
      'windSpeed<8',
      'cloudCover=30-60',
      'precipitation=0',
      'visibility>10'
    ],

    goodConditions: [
      'temperature=10..25',
      'windSpeed<15',
      'cloudCover=20-80',
      'precipitation=0',
      'visibility>5'
    ],
    fairConditions: [
      'temperature=5..10 or 25..32',
      'windSpeed=15..25',
      'cloudCover=80-100',
      'precipitation=1..5',
      'visibility=2..5'
    ],
    poorConditions: [
      'temperature<5 or temperature>32',
      'windSpeed>25',
      'precipitation>5',
      'visibility<2',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],

    seasonalMonths: [4, 5, 6, 7, 8, 9, 10],

    indoorAlternative: 'Book a court at an indoor tennis centre or work on fitness at the gym'
  },
  {
    id: 'archery',
    name: 'Archery',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: true,
    tags: ['sport', 'outdoors', 'precision', 'focus', 'social', 'Saturday', 'Sunday', 'Wednesday'],
    poorConditions: [
      'temperature<5',
      'temperature>32',
      'windSpeed>25',
      'precipitation>5',
      'visibility<2',
      'soilMoisture<10 or soilMoisture>60',
      'snowfallRateMmH>0.5',
      'snowDepthCm>1'
    ],
    fairConditions: [
      'temperature=5..10',
      'temperature=26..30',
      'windSpeed=15..20',
      'precipitation=1..5',
      'visibility=3..5',
      'soilMoisture=10..15 or soilMoisture=45..60'
    ],
    goodConditions: [
      'temperature=10..25',
      'windSpeed<12',
      'cloudCover=0-80',
      'precipitation=0',
      'visibility>5',
      'soilMoisture=15..45'
    ],
    perfectConditions: [
      'temperature=15..22',
      'windSpeed<5',
      'cloudCover=20-50',
      'precipitation=0',
      'visibility>10',
      'soilMoisture=20..35'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Practise at an indoor range, tune your bow, or work on strength & focus exercises'
  },
  {
    id: 'padel',
    name: 'Padel',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: true,
    tags: ['sport', 'racquet', 'social', 'outdoors', 'leisure', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'precipitation>2',
      'windSpeed>25',
      'temperature<8',
      'temperature>32',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    fairConditions: [
      'temperature=8..10 or 28..32',
      'windSpeed=20..25',
      'precipitation=0..2'
    ],
    goodConditions: [
      'temperature=10..28',
      'windSpeed<20',
      'precipitation=0'
    ],
    perfectConditions: [
      'temperature=18..22',
      'windSpeed<10',
      'precipitation=0'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Book an indoor court, practise drills at home, or watch strategy videos'
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: true,
    tags: ['sport', 'racquet', 'social', 'outdoors', 'leisure', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'precipitation>0',
      'windSpeed>15',
      'temperature<8',
      'temperature>32',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    fairConditions: [
      'temperature=8..10 or 28..32',
      'windSpeed=12..15'
    ],
    goodConditions: [
      'temperature=10..28',
      'windSpeed<12',
      'precipitation=0'
    ],
    perfectConditions: [
      'temperature=18..22',
      'windSpeed<8',
      'precipitation=0'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    indoorAlternative: 'Book an indoor court, practise drills at home, or watch strategy videos'
  },
  {
    id: 'tennis_indoor',
    name: 'Tennis (Indoor)',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: false,
    tags: ['sport','racquet','indoor','Saturday','Sunday','Wednesday']
  },
  {
    id: 'squash',
    name: 'Squash',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: false,
    tags: ['sport','racquet','indoor','Saturday','Sunday','Wednesday']
  },
  {
    id: 'badminton',
    name: 'Badminton',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: false,
    tags: ['sport','racquet','indoor','Saturday','Sunday','Wednesday']
  },
  {
    id: 'table_tennis',
    name: 'Table Tennis',
    category: 'Active Sports',
    secondaryCategory: 'Individual Sports',
    weatherSensitive: false,
    tags: ['sport','indoor','Saturday','Sunday','Wednesday']
  },
   {
    id: 'indoor_climbing',
    name: 'Indoor Climbing',
    category: 'Fitness & Wellness',
    secondaryCategory: 'Indoor Recreation',
    weatherSensitive: false,
    tags: ['fun', 'adventure', 'social', 'evening', 'leisure', 'Tuesday', 'Wednesday', 'Saturday'],
  },
  
];

export default individualSports;
