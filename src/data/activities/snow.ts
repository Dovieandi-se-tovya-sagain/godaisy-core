import type { ActivityType } from './types';

export const snowSports: ActivityType[] = [
  {
    id: 'skiing',
    name: 'Skiing',
    category: 'Winter Sports',
    secondaryCategory: 'Snow Sports',
    weatherSensitive: true,
    tags: ['winter', 'snow', 'mountain', 'sport', 'Saturday', 'Sunday', 'Friday'],
    perfectConditions: [
      'temperature=-6..-2',
      'windSpeed<10',
      'clouds=10..50',
      'visibility>5',
      'snowDepthCm=60..200'
    ],
    goodConditions: [
      'temperature=-12..0',
      'windSpeed<20',
      'clouds=25..75',
      'visibility>2',
      'snowDepthCm=30..200'
    ],
    fairConditions: [
      'temperature=0..2 or temperature=-20..-12',
      'windSpeed=20..30',
      'clouds=0..25 or 75..100',
      'visibility=1..2'
    ],
    poorConditions: [
      'temperature>2 or temperature<-20',
      'windSpeed>30',
      'precipitation>2',
      'visibility<1',
      'snowDepthCm<20',
      'snowfallRateMmH>4'
    ],
    seasonalMonths: [11, 12, 1, 2, 3],
    indoorAlternative: 'Tune your skis, check avalanche reports, or hit the gym for leg day'
  },
  {
    id: 'snowboarding',
    name: 'Snowboarding',
    category: 'Winter Sports',
    secondaryCategory: 'Snow Sports',
    weatherSensitive: true,
    tags: ['winter', 'snow', 'mountain', 'sport', 'Saturday', 'Sunday', 'Friday'],
    perfectConditions: [
      'temperature=-8..-2',
      'windSpeed<10',
      'visibility>5',
      'snowDepthCm=50..200'
    ],
    goodConditions: [
      'temperature=-15..0',
      'windSpeed<20',
      'visibility>2',
      'snowDepthCm=30..200'
    ],
    fairConditions: [
      'temperature=0..2 or temperature=-20..-15',
      'windSpeed=20..30',
      'visibility=1..2'
    ],
    poorConditions: [
      'temperature>2 or temperature<-20',
      'windSpeed>30',
      'precipitation>2',
      'visibility<1',
      'snowDepthCm<20',
      'snowfallRateMmH>4'
    ],
    seasonalMonths: [11, 12, 1, 2, 3],
    indoorAlternative: 'Tune your board, wax edges, or hit the gym for core & balance'
  },
  {
    id: 'cross_country_skiing',
    name: 'Cross-country Skiing',
    category: 'Winter Sports',
    secondaryCategory: 'Snow Sports',
    weatherSensitive: true,
    tags: ['winter', 'snow', 'endurance', 'sport', 'Saturday', 'Sunday'],
    perfectConditions: [
      'temperature=-10..-3',
      'windSpeed<10',
      'visibility>5',
      'snowDepthCm=30..120'
    ],
    goodConditions: [
      'temperature=-15..0',
      'windSpeed<18',
      'visibility>2',
      'snowDepthCm=15..120'
    ],
    fairConditions: [
      'temperature=0..2 or temperature=-20..-15',
      'windSpeed=18..25',
      'visibility=1..2'
    ],
    poorConditions: [
      'temperature>2 or temperature<-20',
      'windSpeed>25',
      'precipitation>2',
      'visibility<1',
      'snowDepthCm<10',
      'snowfallRateMmH>4'
    ],
    seasonalMonths: [11, 12, 1, 2, 3],
    indoorAlternative: 'Roller-ski session or endurance training indoors'
  }
];

export default snowSports;
