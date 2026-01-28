import type { ActivityType } from './types';

export const iceSports: ActivityType[] = [
  {
    id: 'ice_hockey',
    name: 'Ice Hockey (Outdoor)',
    category: 'Winter Sports',
    secondaryCategory: 'Ice Sports',
    weatherSensitive: true,
    tags: ['winter', 'sport', 'ice', 'outdoors', 'tradition', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [
      'temperature>2',
      'temperature<-20',
      'precipitation>2',
      'windSpeed>20',
      'visibility<2',
      'snowfallRateMmH>2',
      'snowDepthCm>5'
    ],
    fairConditions: [
      'temperature=-20..-15',
      'windSpeed=15..20',
      'precipitation=1..2',
      'visibility=2..5'
    ],
    goodConditions: [
      'temperature=-15..0',
      'windSpeed<15',
      'precipitation=0',
      'visibility>5'
    ],
    perfectConditions: [
      'temperature=-5..-1',
      'windSpeed<8',
      'visibility>10',
      'precipitation=0'
    ],
    seasonalMonths: [12, 1, 2],
    indoorAlternative: 'Play at a local indoor rink or practise stickhandling drills at home'
  },
  {
    id: 'ice_hockey_indoor',
    name: 'Ice Hockey (Indoor)',
    category: 'Winter Sports',
    secondaryCategory: 'Ice Sports',
    weatherSensitive: false,
    tags: ['winter', 'sport', 'ice', 'team', 'indoor', 'Saturday', 'Sunday', 'holiday'],
    poorConditions: [],
    goodConditions: [],
    perfectConditions: [],
    seasonalMonths: [9, 10, 11, 12, 1, 2, 3, 4],
    indoorAlternative: ''
  },
  {
    id: 'ice_fishing',
    name: 'Ice Fishing',
    category: 'Winter Sports',
    secondaryCategory: 'Ice Sports',
    weatherSensitive: true,
    tags: ['winter', 'ice', 'fishing', 'outdoors', 'patience', 'Saturday', 'Sunday'],
    perfectConditions: [
      'temperature=-12..-6',
      'windSpeed<8',
      'visibility>5',
      'snowfallRateMmH=0..1'
    ],
    goodConditions: [
      'temperature=-18..-2',
      'windSpeed<15',
      'visibility>2',
      'snowfallRateMmH=0..2'
    ],
    fairConditions: [
      'temperature=-22..-18 or temperature=-2..0',
      'windSpeed=15..22',
      'visibility=1..2',
      'snowfallRateMmH=2..4'
    ],
    poorConditions: [
      'temperature>0 or temperature<-22',
      'windSpeed>22',
      'visibility<1',
      'snowfallRateMmH>4',
      'snowDepthCm>25'
    ],
    seasonalMonths: [12, 1, 2],
    indoorAlternative: 'Prep tackle, tie rigs, or plan your next session'
  },
  {
    id: 'curling',
    name: 'Curling',
    category: 'Indoor Sports',
    secondaryCategory: 'Ice Sports',
    weatherSensitive: false,
    tags: ['winter', 'ice', 'indoor', 'social', 'strategic', 'team', 'fun', 'leisure', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    poorConditions: [],
    goodConditions: [],
    perfectConditions: [],
    seasonalMonths: [1, 2, 3, 10, 11, 12],
  },
   {
    id: 'ice_skating',
    name: 'Outdoor Ice Skating',
    category: 'Winter Sports',
    secondaryCategory: 'Ice Sports',
    weatherSensitive: true,
    tags: ['winter', 'sport', 'leisure', 'social', 'Saturday', 'Sunday', 'Friday', 'evening'],

    perfectConditions: [
      'temperature=-5..-1',          // ideal balance of ice stability and comfort
      'windSpeed<10',                // little wind chill or disruption
      'cloudCover=10-50',            // some sun for ambience and visibility
      'visibility>10'                // clear for spotting obstacles and safe skating
    ],

    goodConditions: [
      'temperature=-15..0',          // comfortably cold, safe for the ice
      'windSpeed<15',                // light wind, manageable chill
      'cloudCover=0-80',             // overcast or bright, both acceptable
      'visibility>5'                 // safe for families, dusk or cloudy is okay
    ],

    fairConditions: [
      'temperature=0..2 or temperature=-20..-15',  // ice may be soft or bitterly cold
      'windSpeed=15..20',                          // stronger wind, less fun
      'cloudCover=80-100',                         // very gloomy or snowy light
      'precipitation=0..2',                        // light flurries possible but tolerable
      'visibility=2..5'                             // mist, low sun glare, or snow may reduce visibility
    ],

    poorConditions: [
      'temperature>2 or temperature<-20',          // ice melts or frostbite risk
      'precipitation>2',                           // snow/rain obscures or softens ice
      'windSpeed>20',                              // strong gusts risk imbalance and cold
      'visibility<2',                              // dangerous for group skating
      'snowfallRateMmH>2',                         // heavy flakes obscure the ice fast
      'snowDepthCm>5'                              // thick snow drift prevents clearing
    ],

    seasonalMonths: [12, 1, 2],  // core winter skating season

    indoorAlternative: 'Skate at an indoor rink or practise balance & drills at home'
  },
];

export default iceSports;
