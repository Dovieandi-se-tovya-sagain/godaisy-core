import type { ActivityType } from './types';

export const fishingActivities: ActivityType[] = [
  {
    id: 'fly_fishing_freshwater',
    name: 'Fly Fishing',
    category: 'Outdoor Activities',
    secondaryCategory: 'Fishing',
    weatherSensitive: true,
    tags: ['fishing', 'freshwater', 'technique', 'quiet', 'outdoors', 'patience', 'nature', 'Saturday', 'Sunday', 'Friday'],
    perfectConditions: [
      'temperature=12..18',
      'windSpeed<8',
      'clouds=70..100',
      'precipitation=0',
      'visibility>10'
    ],
    goodConditions: [
      'temperature=8..24',
      'windSpeed<12',
      'clouds=50..100',
      'precipitation=0..2',
      'visibility>5'
    ],
    fairConditions: [
      'temperature=4..8 or 24..28',
      'windSpeed=12..20',
      'clouds=20..50',
      'precipitation=2..5',
      'visibility=2..5'
    ],
    poorConditions: [
      'temperature<4 or temperature>28',
      'windSpeed>20',
      'precipitation>5',
      'clouds<20',
      'visibility<2',
      'snowfallRateMmH>3',
      'snowDepthCm>12'
    ],
    indoorAlternative: 'Tie some flies',
    seasonalMonths: [3, 4, 5, 6, 7, 8, 9]
  },
  {
    id: 'coarse_fishing',
    name: 'Coarse & Carp Fishing',
    category: 'Outdoor Activities',
    secondaryCategory: 'Fishing',
    weatherSensitive: true,
    tags: ['fishing', 'freshwater', 'quiet', 'patience', 'outdoors', 'nature', 'Saturday', 'Sunday'],

    perfectConditions: [
      'temperature=18..22',
      'windSpeed=3..8',
      'cloudCover=70-90',
      'visibility>10'
    ],

    goodConditions: [
      'temperature=10..24',
      'windSpeed=0..12',
      'cloudCover=50-100',
      'visibility>5'
    ],

    fairConditions: [
      'temperature=5..10 or 24..28',
      'windSpeed=12..20',
      'cloudCover=10-50',
      'precipitation=1..5',
      'visibility=2..5'
    ],

    poorConditions: [
      'temperature<5 or temperature>28',
      'windSpeed>20',
      'precipitation>5',
      'visibility<2',
      'snowfallRateMmH>2',
      'snowDepthCm>8'
    ],

    seasonalMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],

    indoorAlternative: 'Tie rigs, sort your tackle box, or plan your next session'
  },
  {
    id: 'sea_fishing_shore',
    name: 'Sea Fishing (Shore)',
    category: 'Outdoor Activities',
    secondaryCategory: 'Fishing',
    weatherSensitive: true,
    usesWindRelative: true,
    requiresBeachOrientation: true,
    tags: ['fishing','sea','shore','outdoors','patience','Saturday','Sunday'],
    perfectConditions: [
      'temperature=10..18',
      'windSpeed<8',
      'gust<10',
      'waveHeight=0.3..0.8',
      'visibility>10',
      'precipitation=0..1',
      'windRelative=onshore & windSpeed<8 or windRelative=cross-shore & windSpeed<9'
    ],
    goodConditions: [
      'temperature=6..22',
      'windSpeed<12',
      'gust<14',
      'waveHeight=0.2..1.2',
      'visibility>5',
      'precipitation=0..2',
      'windRelative=onshore & windSpeed<=10 or windRelative=cross-shore & windSpeed<=12 or windRelative=side-onshore & windSpeed<=10'
    ],
    fairConditions: [
      'temperature=2..6 or 22..26',
      'windSpeed=12..15',
      'gust=14..17',
      'waveHeight=1.2..1.8',
      'visibility=2..5',
      'precipitation=2..5',
      'windRelative=offshore & windSpeed<=8'
    ],
    poorConditions: [
      'temperature<2 or temperature>26',
      'windSpeed>15',
      'gust>17',
      'waveHeight>1.8',
      'visibility<2',
      'precipitation>5',
      'windRelative=onshore & windSpeed>12 or windRelative=offshore & windSpeed>10',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [3,4,5,6,7,8,9,10,11]
  },
  {
    id: 'sea_fishing_boat',
    name: 'Sea Fishing (Boat)',
    category: 'Outdoor Activities',
    secondaryCategory: 'Fishing',
    weatherSensitive: true,
    tags: ['fishing','sea','boat','outdoors','Saturday','Sunday'],
    perfectConditions: [
      'temperature=8..20',
      'windSpeed<7',
      'gust<9',
      'waveHeight<0.8',
      'visibility>10',
      'precipitation=0..1'
    ],
    goodConditions: [
      'temperature=5..24',
      'windSpeed<11',
      'gust<14',
      'waveHeight<1.2',
      'visibility>5',
      'precipitation=0..2'
    ],
    fairConditions: [
      'temperature=0..5 or 24..28',
      'windSpeed=11..15',
      'gust=14..18',
      'waveHeight=1.2..1.8',
      'visibility=2..5',
      'precipitation=2..5'
    ],
    poorConditions: [
      'temperature<-2 or temperature>28',
      'windSpeed>15',
      'gust>18',
      'waveHeight>1.8',
      'visibility<2',
      'precipitation>5',
      'snowfallRateMmH>0.5',
      'snowDepthCm>0.5'
    ],
    seasonalMonths: [3,4,5,6,7,8,9,10,11]
  }
];

export default fishingActivities;
