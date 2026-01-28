// src/types/index.ts

// Weather types (shared across all apps)
export * from './weather';
export * from './weatherData';
export * from './weatherTypes';

// Multi-location types
export * from './multiLocation';

// Note: capacitor-optional.d.ts and react-hot-toast.d.ts are declaration files
// They provide type augmentation automatically and don't need explicit exports