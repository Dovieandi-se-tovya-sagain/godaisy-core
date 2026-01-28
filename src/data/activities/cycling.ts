import type { ActivityType } from './types';

export const cyclingSports: ActivityType[] = [
  {
    id: 'road_cycling',
    name: 'Road Cycling',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'cycling', 'cardio', 'group', 'solo', 'Saturday', 'Sunday', 'Wednesday'],
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
      'temperature<5 or temperature>32',
      'windSpeed>25',
      'precipitation>3',
      'humidity>90',
      'visibility<2',
      'snowfallRateMmH>1',
      'snowDepthCm>1'
    ]
  },
  {
    id: 'mountain_biking',
    name: 'Mountain Biking',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'cycling', 'trail', 'nature', 'Saturday', 'Sunday'],
    perfectConditions: [
      'temperature=10..18',
      'windSpeed<10',
      'clouds=10..50',
      'humidity=50..65',
      'soilMoisture=20..35',
      'precipitation=0',
      'visibility>10'
    ],
    goodConditions: [
      'temperature=8..24',
      'windSpeed<20',
      'clouds=0..90',
      'humidity<80',
      'soilMoisture=20..45',
      'precipitation=0',
      'visibility>5'
    ],
    fairConditions: [
      'temperature=4..8 or 24..28',
      'windSpeed=20..30',
      'humidity=80..90',
      'precipitation=2..5',
      'soilMoisture=45..60',
      'visibility=2..5'
    ],
    poorConditions: [
      'temperature<4 or temperature>28',
      'windSpeed>30',
      'precipitation>5',
      'humidity>90',
      'soilMoisture>60',
      'visibility<2',
      'snowfallRateMmH>2',
      'snowDepthCm>6'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10]
  },
  {
    id: 'gravel_biking',
    name: 'Gravel Biking',
    category: 'Active Sports',
    secondaryCategory: 'Outdoor Recreation',
    weatherSensitive: true,
    tags: ['sport', 'cycling', 'mixed_surface', 'adventure'],
    perfectConditions: [
      'temperature=10..18',
      'windSpeed<8',
      'clouds=20..50',
      'humidity=45..55',
      'soilMoisture=20..35',
      'precipitation=0',
      'visibility>10'
    ],
    goodConditions: [
      'temperature=7..24',
      'windSpeed<15',
      'clouds=0..75',
      'humidity<75',
      'soilMoisture=20..45',
      'precipitation=0',
      'visibility>5'
    ],
    fairConditions: [
      'temperature=2..7 or 24..28',
      'windSpeed=15..25',
      'humidity=75..90',
      'precipitation=1..4',
      'soilMoisture=45..60',
      'visibility=2..5'
    ],
    poorConditions: [
      'temperature<2 or temperature>28',
      'windSpeed>25',
      'precipitation>4',
      'humidity>90',
      'soilMoisture>60',
      'visibility<2',
      'snowfallRateMmH>2',
      'snowDepthCm>6'
    ],
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10]
  }
];

export default cyclingSports;
