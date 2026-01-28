# GitHub Setup Guide - App Separation

**Created:** January 7, 2026
**Updated:** January 28, 2026
**Purpose:** Set up GitHub repositories and shared library infrastructure before database migration

---

## Recent Progress

### Completed: godaisy-core Initial Setup (setup/initial-configuration branch)

The following setup work has been completed on the `setup/initial-configuration` branch (Jan 22-26, 2026):

1. **Go Daisy Auth Integration** (Jan 22, 2026)
   - Added `authClient.ts` connected to Go Daisy Auth Supabase project
   - Added `.env.example` template for required environment variables
   - All apps will share authentication through this single Supabase project

2. **Shared Code Migration** (Jan 22, 2026)
   - Copied 108 shared components from wotnow
   - Copied 28 shared hooks from wotnow
   - Copied 120 shared lib files from wotnow
   - Copied 4 contexts (Auth, UnifiedLocation, Language, UserPreferences)

3. **Library Build Configuration** (Jan 16-22, 2026)
   - Added `tsconfig.json` for TypeScript compilation
   - Added `tsup.config.ts` for library building
   - Configured `package.json` with proper exports

### Recent Merge: Grow Daisy Enhancements (Jan 26, 2026)

The following Grow Daisy specific files were added in the `main` → `cleanup` merge and need to be copied to the `growdaisy` repo:

**New Grow Daisy Components (copy to `growdaisy/components/grow/`):**
- `LocalizedNamesCard.tsx` - Display localized plant names
- `PropagationCard.tsx` - Plant propagation information
- `QuickFactsCard.tsx` - Quick plant facts display
- `SafetyCard.tsx` - Plant safety/toxicity warnings
- `VisualCharacteristicsCard.tsx` - Visual plant characteristics
- `WildlifeCard.tsx` - Wildlife interaction info
- `HardinessZoneBar.tsx` - Updated hardiness zone display

**Updated Grow Daisy Lib Files (copy to `growdaisy/lib/grow/`):**
- `formatters.ts` - New formatting utilities (370 lines)
- `weatherTaskEngine.ts` - Enhanced weather task engine (529+ lines)

**New Grow Daisy Scripts (copy to `growdaisy/scripts/`):**
- `audit-toxicity.ts` - Audit plant toxicity data
- `check-perenual-tables.ts` - Check Perenual API data tables
- `merge-perenual-data.ts` - Merge Perenual plant data into database
- `normalize-plant-data.ts` - Normalize plant data format

**Updated API/Pages:**
- `pages/api/grow/weather-tasks.ts` - Weather tasks endpoint
- `pages/api/grow/weather.ts` - Weather endpoint
- `pages/grow/species/[slug].tsx` - Species page with new layout
- `hooks/useGrowSubscription.ts` - Subscription hook fixes

### Completed Pre-Migration Cleanup (cleanup branch)

The following cleanup work was completed on the `cleanup` branch, preparing the codebase for separation:

1. **Mock Data Removal** (Jan 21, 2026)
   - Removed hardcoded/mock data from Findr and Go Daisy components
   - Enabled real data fetching for FishingAreaInfo environmental stats
   - Updated 7-day predictions to fetch real data for missing days
   - Added proper API methods for local signals, weather tasks, and alerts

2. **Grow Daisy Maturation** (Jan 20-22, 2026)
   - Added 84 guild blueprints from database
   - Implemented hardware integrations (4 new integrations with premium tier)
   - Added subscription/premium tier features
   - Improved planting calendar linking with species data
   - Enhanced threat detection (humidity, late blight thresholds)

3. **Code Quality Improvements**
   - Added Vercel env var helper script to prevent line break issues
   - Fixed watering recommendations for frozen soil conditions
   - Improved task authorization flow

### Updated File Counts (as of Jan 27, 2026)

```
GROW DAISY (significantly expanded):
- components/grow/: 70 files (was 63, +7 new from Jan 26 merge)
- components/gardening/: 1 file (GardenAlertBox.tsx)
- lib/grow/: 42 files (was 40, +2 new/updated from Jan 26 merge)
- lib/gardening/: 3 files (gardenAlerts, buildGardenAlertInputs, getGardenAlerts)
- pages/api/grow/: 57 endpoints
- hooks/useGrow*.ts: 2 hooks
- scripts/: 4 new plant data scripts (audit-toxicity, check-perenual-tables, merge-perenual-data, normalize-plant-data)

FINDR (stable/consolidated):
- components/findr/: 72 files
- components/favourites/: 9 files (shared favourites UI - decision needed)
- lib/findr/: 34 files
- pages/api/findr/: 32 endpoints
- hooks: 16 Findr-specific hooks (see detailed list below)

GODAISY-CORE (shared library):
- components/: 108 files
- hooks/: 28 files
- lib/: 120 files
- contexts/: 4 files
- types/: 1 file (needs expansion - see TODO below)
```

### TODO: Missing Type Definitions (add to godaisy-core/src/types/)

The following type files exist in wotnow but are NOT yet in godaisy-core:

**High Priority (shared across apps):**
- `capacitor-optional.d.ts` - Capacitor platform type definitions
- `weather.ts` - Weather condition types
- `weatherData.ts` - Weather data structures
- `weatherTypes.ts` - Weather type definitions
- `react-hot-toast.d.ts` - Toast notification types

**Medium Priority (may be shared):**
- `aiRecommendations.ts` - AI personalization types (if AI features are shared)
- `favourites.ts` - Favourites feature types (if favourites is shared)

**Low Priority (app-specific):**
- `findr-enrichment.ts` - Findr-specific (copy to findr repo)
- `findrSeasonality.ts` - Findr-specific (copy to findr repo)
- `speciesBundle.ts` - Findr-specific (copy to findr repo)

### TODO: Favourites Feature (Decision Required)

The `components/favourites/` directory contains 9 shared UI components that could benefit multiple apps:

```
components/favourites/
├── FavouritesDashboard.tsx
├── NotificationSetupModal.tsx
├── SpeciesCard.tsx
├── SpeciesCarousel.tsx
├── SpeciesSelectionView.tsx
├── StatusCards.tsx
└── shared/
    ├── ConfidenceRing.tsx
    ├── LoadingSpinner.tsx
    └── MiniCalendar.tsx
```

**Related hooks:**
- `useFavourites.ts`
- `useFavouriteInsights.ts`
- `useEnhancedFavouriteInsights.ts`
- `useFavoritesTacticalAdvice.ts`
- `useFavoritesStrategicAdvice.ts`

**Decision needed:**
- [ ] If favourites is a shared feature (used by Findr for species, Grow for plants, Go Daisy for activities): Add to `godaisy-core`
- [ ] If favourites is Findr-only: Copy to `findr` repo

### TODO: Missing Shared Components

**Components to consider adding to godaisy-core:**
- `EnhancedFishDeck.tsx` (455 lines) - AI-enhanced deck component with personalization pattern. Could be useful as a shared UI pattern.
- `GardenAlertBox.tsx` - Simple alert box component (currently in `components/gardening/`)

---

### Recent Database/Script Changes (Jan 28, 2026)

**Commits on main affecting Findr data ingestion:**

#### 1. CMEMS Biogeochemical Fields Now Populated (cc7ec33, 1c088ea)

The following fields in `findr_conditions_snapshots` were previously defined but NOT being written by the ingestion scripts. They are now populated:

| Column | Unit | Source | Purpose |
|--------|------|--------|---------|
| `chlorophyll_mg_m3` | mg/m³ | Copernicus | Phytoplankton indicator, affects clarity |
| `dissolved_oxygen_mg_l` | mg/L | Copernicus | Fish respiration, 4-12 mg/L is healthy |
| `salinity_psu` | PSU | Copernicus | Affects species distribution |
| `sea_temp_c` | °C | Copernicus | Water temperature |
| `nitrate_umol_l` | µmol/L | Copernicus | Nutrient levels |
| `phosphate_umol_l` | µmol/L | Copernicus | Nutrient levels |

#### 2. O₂ Unit Conversion Fix

**Bug:** `dissolvedOxygenSurface` from Copernicus is in mmol/m³ but the DB column `dissolved_oxygen_mg_l` expects mg/L.

**Fix:** Apply conversion factor `× 0.032` (O₂ molecular weight = 32 g/mol):
```typescript
dissolved_oxygen_mg_l: snapshot.dissolvedOxygenSurface != null
  ? snapshot.dissolvedOxygenSurface * 0.032  // mmol/m³ → mg/L
  : null,
```

**Result:** Values now land in expected 4-12 mg/L range instead of raw 200-300+.

#### 3. BGC Script Data Preservation Fix

**Bug:** `ingestCopernicusBiogeochemical.ts` used DELETE+INSERT pattern which destroyed currents/waves/weather data written by other scripts.

**Fix:** Changed to UPDATE-only for existing records, INSERT only when no record exists for rectangle+date:
```typescript
if (existing) {
  // UPDATE only BGC fields, preserving currents/waves/weather
  await supabase.from('findr_conditions_snapshots')
    .update(bgcPayload)
    .eq('id', existing.id);
} else {
  // INSERT new record with BGC fields
  await supabase.from('findr_conditions_snapshots')
    .insert({ rectangle_code, captured_at, ...bgcPayload, source });
}
```

#### Scripts Affected (copy to findr repo):

```
scripts/ingest-copernicus-data.ts         # Primary CMEMS ingestion
scripts/ingestCopernicusBiogeochemical.ts # BGC-specific ingestion
```

**Important:** When setting up the findr repo, ensure you copy these updated scripts from the latest `main` branch, not from an older branch.

---

## Overview

We'll create 4 GitHub repositories:
1. **`godaisy-core`** - Shared component library (npm package)
2. **`findr`** - Fishing predictions app (standalone)
3. **`growdaisy`** - Gardening app (standalone)
4. **`godaisy`** - General activity app (standalone)

---

## Phase 1: Create GitHub Repositories

### Step 1: Create `godaisy-core` Repository ✅ COMPLETED

**On GitHub:**
1. Go to https://github.com/new
2. Repository name: `godaisy-core`
3. Description: "Shared component library for the Daisy app family"
4. Visibility: **Private** (or Public if you want to open-source it)
5. Add a README file
6. Add .gitignore: **Node**
7. License: MIT (or your choice)
8. Click **Create repository**

**Clone locally:**
```bash
cd E:\Go_Daisy
git clone https://github.com/YOUR_USERNAME/godaisy-core.git
cd godaisy-core
```

### Step 2: Create `findr` Repository

**On GitHub:**
1. Go to https://github.com/new
2. Repository name: `findr`
3. Description: "Fishing predictions app with real-time marine data"
4. Visibility: **Private**
5. Add a README file
6. Add .gitignore: **Node**
7. License: MIT (or your choice)
8. Click **Create repository**

**Clone locally:**
```bash
cd E:\Go_Daisy
git clone https://github.com/YOUR_USERNAME/findr.git
cd findr
```

### Step 3: Create `growdaisy` Repository

**On GitHub:**
1. Go to https://github.com/new
2. Repository name: `growdaisy`
3. Description: "Smart gardening and plant management app"
4. Visibility: **Private**
5. Add a README file
6. Add .gitignore: **Node**
7. License: MIT (or your choice)
8. Click **Create repository**

**Clone locally:**
```bash
cd E:\Go_Daisy
git clone https://github.com/YOUR_USERNAME/growdaisy.git
cd growdaisy
```

### Step 4: Create `godaisy` Repository

**On GitHub:**
1. Go to https://github.com/new
2. Repository name: `godaisy`
3. Description: "Weather-informed activity recommendations"
4. Visibility: **Private**
5. Add a README file
6. Add .gitignore: **Node**
7. License: MIT (or your choice)
8. Click **Create repository**

**Clone locally:**
```bash
cd E:\Go_Daisy
git clone https://github.com/YOUR_USERNAME/godaisy.git
cd godaisy
```

---

## Phase 2: Set Up `godaisy-core` (Shared Library) ✅ MOSTLY COMPLETED

> **Status:** Library structure, config files, and dependencies have been set up.
> Remaining: Build verification and GitHub Packages publishing.

### Step 1: Initialize TypeScript Library ✅

```bash
cd E:\Go_Daisy\godaisy-core
npm init -y
```

### Step 2: Install Dependencies ✅

```bash
# TypeScript and build tools
npm install -D typescript tsup @types/node

# React and Next.js (peer dependencies)
npm install -D react react-dom next @types/react @types/react-dom

# Supabase
npm install @supabase/supabase-js

# Other core dependencies
npm install framer-motion date-fns
```

### Step 3: Create `package.json` Configuration ✅

**Edit `package.json`:**
```json
{
  "name": "@godaisy/core",
  "version": "1.0.0-beta.1",
  "description": "Shared component library for the Daisy app family",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "next": "^15.0.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "framer-motion": "^11.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "next": "^15.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/godaisy-core.git"
  },
  "keywords": [
    "react",
    "nextjs",
    "supabase",
    "weather",
    "component-library"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

### Step 4: Create `tsconfig.json` ✅

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 5: Create `tsup.config.ts` ✅

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'next'],
  treeshake: true,
});
```

### Step 6: Create Directory Structure ✅

**Actual structure created (with populated files):**
```
src/
├── contexts/          # 4 context files
├── hooks/             # 28 hook files
├── components/        # 108 component files
│   ├── layouts/
│   ├── mobile/
│   ├── sharing/
│   ├── translation/
│   ├── ui/
│   └── weather-cards/
├── lib/
│   ├── analytics/
│   ├── api/
│   ├── astro/
│   ├── auth/
│   ├── capacitor/     # 14 files
│   ├── copernicus/    # 6 files (marine data)
│   ├── date/
│   ├── db/
│   ├── i18n/
│   ├── image/
│   ├── monitoring/
│   ├── multiLocation/
│   ├── notifications/
│   ├── offline/       # 20 files
│   ├── performance/
│   ├── predictions/
│   ├── services/
│   ├── share/
│   ├── storage/
│   ├── stripe/
│   ├── supabase/      # 9 files
│   ├── tides/
│   ├── translation/   # 3 files
│   ├── ui/
│   ├── user/
│   ├── utils/         # 15 files
│   └── weather/
├── types/
└── index.ts
```

### Step 7: Create `src/index.ts` (Entry Point) ✅ CREATED (needs expansion)

> **Status:** Basic entry point created. Needs to be expanded to export all shared modules.
> Current state exports core items. TODO: Add exports for all 28 hooks, 108 components, and utility functions.

**Current `src/index.ts`:**
```typescript
// Contexts
export { AuthContext, useAuth } from './contexts/AuthContext';
export { UnifiedLocationContext, useUnifiedLocation } from './contexts/UnifiedLocationContext';
export { LanguageContext, useLanguage } from './contexts/LanguageContext';
export { UserPreferencesContext, useUserPreferences } from './contexts/UserPreferencesContext';

// Supabase clients
export { authClient } from './lib/supabase/authClient';
export { createDataClient } from './lib/supabase/dataClient';
export type { SupabaseClientConfig } from './lib/supabase/types';

// Hooks (partial - expand to include all 28)
export { useOnlineStatus } from './hooks/useOnlineStatus';
export { useTideData } from './hooks/useTideData';
export { useTranslation } from './hooks/useTranslation';
// TODO: Add remaining hooks: useUserLocation, useOfflineData, useOfflineStorage,
// useSharing, useInstallPrompt, useCapacitorInit, useLocationConsent, useTideExtremes,
// useLocalSignals, useWeatherDataSource, useWeatherTasks, useRequireAuth, useUserStatus,
// useFounderStatus, useSubscription, useNotificationPreferences, useProfileHydration,
// useImageCompression, useImpressionTracking, useDialogHistory, useReducedMotion,
// useScrolledPast, useLazyBackground, useAutoPreCache, useUIText

// Components (partial - expand to include all 108)
export { LocationPicker } from './components/LocationPicker';
export { LanguageSelector } from './components/LanguageSelector';
// TODO: Add remaining components

// Utilities
export { formatCoordinates } from './lib/utils/coordinates';
// TODO: Add remaining utilities

// Types
export type * from './types';
```

---

## Phase 3: Copy Shared Code from Monorepo ✅ COMPLETED

> **Status:** This phase has been completed on the `setup/initial-configuration` branch (Jan 22, 2026).
> The following files have been copied from `wotnow` to `godaisy-core/src/`:

### What Was Copied

**Contexts (4 files):**
- `AuthContext.tsx` - Shared authentication context
- `UnifiedLocationContext.tsx` - Location management
- `LanguageContext.tsx` - i18n support
- `UserPreferencesContext.tsx` - User settings

**Hooks (28 files):**
- `useOnlineStatus.ts`, `useTideData.ts`, `useTranslation.ts`
- `useUserLocation.ts`, `useOfflineData.ts`, `useOfflineStorage.ts`
- `useSharing.ts`, `useInstallPrompt.ts`, `useCapacitorInit.ts`
- `useLocationConsent.ts`, `useTideExtremes.ts`, `useLocalSignals.ts`
- `useWeatherDataSource.ts`, `useWeatherTasks.ts`, `useRequireAuth.ts`
- `useUserStatus.ts`, `useFounderStatus.ts`, `useSubscription.ts`
- `useNotificationPreferences.ts`, `useProfileHydration.ts`
- `useImageCompression.ts`, `useImpressionTracking.ts`, `useDialogHistory.ts`
- `useReducedMotion.ts`, `useScrolledPast.ts`, `useLazyBackground.ts`
- `useAutoPreCache.ts`, `useUIText.ts`

**Components (108 files):**
- Core UI: `Card.tsx`, `BottomNav.tsx`, `TopTabs.tsx`, `AppHeader.tsx`
- Location: `LocationPicker.tsx`, `MapPicker.tsx`, `ModernLocationSearch.tsx`, `CoastalLocationDialog.tsx`
- Weather cards: 20+ weather-related card components
- Sharing: `ShareButton.tsx`, `ShareModal.tsx`, and related components
- UI primitives: `ui/` folder with button, dialog, input, etc.
- Translation: `TranslatedFishCard.tsx`
- Layouts: `InlandLayout.tsx`, `MarineLayout.tsx`

**Libraries (120 files):**
- `lib/supabase/` - Auth and data clients (including new `authClient.ts`)
- `lib/capacitor/` - Mobile platform integration (14 files)
- `lib/translation/` - Translation services
- `lib/utils/` - Utility functions (15 files)
- `lib/weather/` - Weather data services
- `lib/tides/` - Tide calculations
- `lib/astro/` - Moon/astronomy services
- `lib/services/` - Weather service, sharing service
- `lib/offline/` - Offline data management
- `lib/copernicus/` - Marine data (Copernicus API)
- `lib/performance/` - Performance monitoring
- `lib/notifications/` - Push notification support

### Shared Location/Weather/Tide Services (Jan 26, 2026)

These files support location, weather, and tide functionality used by ALL apps:

**Location Services (`lib/findr/` - shared despite folder name):**
- `locationDetection.ts` - Location detection and grid cell lookup
- `gridCellLookup.ts` - Grid cell ID lookup
- `fallbackRectangles.ts` - Fallback rectangle definitions
- `conditionHelpers.ts` - Weather condition helpers
- `emailTemplates.ts` - Email template utilities

**Weather/Signals (`lib/grow/` - shared despite folder name):**
- `weatherDataSource.ts` - Weather data source abstraction
- `localSignals.ts` - Local weather signals
- `weatherTaskEngine.ts` - Weather task engine

**Hooks:**
- `useFindrRectangleOptions.ts` - Rectangle selection hook (shared)

### ⚠️ App-Specific Files (Removed from Shared Library)

The following files were removed from godaisy-core as they are truly app-specific:

**Findr-specific (copy to `findr` repo from wotnow):**
- `lib/offline/findrDatabase.ts`
- `lib/offline/findrSync.ts`
- `lib/offline/catchHistory.ts`
- `lib/offline/catchSync.ts`
- `lib/offline/pendingCatches.ts`
- `lib/offline/speciesAdviceCache.ts`
- `lib/copernicus/*` (marine data API)
- `lib/predictions/biogeochemicalEnhancer.ts`

**Grow Daisy-specific (copy to `growdaisy` repo from wotnow):**
- `lib/offline/growSync.ts`
- `lib/offline/growSubscriptionCache.ts`

### Original Copy Commands (For Reference)

<details>
<summary>Click to expand original copy commands</summary>

```bash
cd E:\Go_Daisy\wotnow

# Copy contexts
cp context/AuthContext.tsx ../godaisy-core/src/contexts/
cp context/UnifiedLocationContext.tsx ../godaisy-core/src/contexts/
cp context/LanguageContext.tsx ../godaisy-core/src/contexts/
cp context/UserPreferencesContext.tsx ../godaisy-core/src/contexts/

# Copy shared libraries
cp -r lib/supabase ../godaisy-core/src/lib/
cp -r lib/weather ../godaisy-core/src/lib/
cp -r lib/capacitor ../godaisy-core/src/lib/
cp -r lib/translation ../godaisy-core/src/lib/
cp -r lib/utils ../godaisy-core/src/lib/
cp -r lib/tides ../godaisy-core/src/lib/
cp -r lib/astro ../godaisy-core/src/lib/

# Copy all hooks
cp hooks/*.ts ../godaisy-core/src/hooks/

# Copy all shared components (excluding findr/ and grow/ subdirectories)
# Components were copied with subdirectories: ui/, sharing/, weather-cards/, layouts/, mobile/, translation/
```

</details>

---

## Phase 4: Modify for Dual Supabase Clients ✅ COMPLETED

### Step 1: Create Auth Client ✅ COMPLETED

> **Status:** Auth client has been created and integrated (Jan 22, 2026).
> See `src/lib/supabase/authClient.ts` and `.env.example` for configuration.

**Environment Variables Required (see `.env.example`):**
```bash
# Go Daisy Auth - Shared authentication (used by all apps)
NEXT_PUBLIC_SUPABASE_AUTH_URL=https://bcjeobdhajxbdzhmbjne.supabase.co
NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY=your-anon-key-here

# App-specific database (each app has its own)
NEXT_PUBLIC_APP_DATABASE_URL=https://your-app-db.supabase.co
NEXT_PUBLIC_APP_DATABASE_ANON_KEY=your-app-anon-key-here
```

**`src/lib/supabase/authClient.ts`:**
```typescript
import { createClient } from '@supabase/supabase-js';

// Shared auth client - connects to daisy-auth Supabase project
export const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
```

### Step 1.5: Complete Missing Shared Code (DO THIS NOW)

> **Status:** Added Jan 27, 2026 - These items were identified as missing from godaisy-core.

Before proceeding, copy these missing files from wotnow to godaisy-core:

**1. Copy Missing Type Definitions:**
```bash
cd E:\Go_Daisy\wotnow

# Weather types (shared across all apps)
cp types/weather.ts ../godaisy-core/src/types/
cp types/weatherData.ts ../godaisy-core/src/types/
cp types/weatherTypes.ts ../godaisy-core/src/types/

# Platform types
cp types/capacitor-optional.d.ts ../godaisy-core/src/types/

# UI library types
cp types/react-hot-toast.d.ts ../godaisy-core/src/types/
```

**2. Decision Required - Favourites Feature:**

The favourites feature has 9 components and 5 hooks. Decide now:

- **Option A: Shared Feature** (recommended if Grow Daisy will have favourite plants)
  ```bash
  # Copy to godaisy-core
  cp -r components/favourites ../godaisy-core/src/components/
  cp hooks/useFavourites.ts ../godaisy-core/src/hooks/
  cp hooks/useFavouriteInsights.ts ../godaisy-core/src/hooks/
  cp hooks/useEnhancedFavouriteInsights.ts ../godaisy-core/src/hooks/
  cp hooks/useFavoritesTacticalAdvice.ts ../godaisy-core/src/hooks/
  cp hooks/useFavoritesStrategicAdvice.ts ../godaisy-core/src/hooks/
  cp types/favourites.ts ../godaisy-core/src/types/
  ```

- **Option B: Findr-Only** (copy to findr repo later in Phase 6)

**3. Update src/types/index.ts:**

After copying type files, create or update `src/types/index.ts`:
```typescript
// Weather types
export * from './weather';
export * from './weatherData';
export * from './weatherTypes';

// Multi-location types
export * from './multiLocation';

// Favourites types (if Option A chosen)
// export * from './favourites';
```

**4. Verify Build Still Works:**
```bash
cd E:\Go_Daisy\godaisy-core
npm run build
```

Fix any TypeScript errors before proceeding to Step 2.

---

### Step 2: Create Data Client Factory

**`src/lib/supabase/dataClient.ts`:**
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// Factory function - each app calls this with their own database URL
export function createDataClient(config: SupabaseClientConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false, // Auth handled by authClient
      autoRefreshToken: false,
    },
  });
}

// Server-side data client factory
export function createDataClientServer(config: SupabaseClientConfig): SupabaseClient {
  if (!config.serviceRoleKey) {
    throw new Error('Service role key required for server-side client');
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

### Step 3: Update AuthContext

**`src/contexts/AuthContext.tsx`:**

Find and replace the Supabase client initialization:

```typescript
// OLD:
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// NEW:
import { authClient } from '@/lib/supabase/authClient';
// Use authClient throughout the context
```

Make sure all auth operations (login, logout, session management) use `authClient`.

---

## Phase 5: Set Up GitHub Packages

### Step 1: Authenticate with GitHub Packages

```bash
# Create a GitHub Personal Access Token (PAT)
# Go to: https://github.com/settings/tokens
# Click "Generate new token (classic)"
# Scopes needed: read:packages, write:packages, delete:packages

# Save your token, then authenticate npm:
npm login --scope=@godaisy --registry=https://npm.pkg.github.com
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_PERSONAL_ACCESS_TOKEN
# Email: YOUR_EMAIL
```

### Step 2: Update `.npmrc` in Each App

**Create `E:\Go_Daisy\godaisy-core\.npmrc`:**
```
@godaisy:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Step 3: Build and Publish

```bash
cd E:\Go_Daisy\godaisy-core

# Build the library
npm run build

# Check what will be published
npm pack --dry-run

# Publish to GitHub Packages
npm publish
```

---

## Phase 6: Set Up App Repositories

### For Each App (Findr, Grow Daisy, Go Daisy):

### Step 1: Initialize Next.js App

```bash
cd E:\Go_Daisy\findr

# Copy package.json from monorepo as template
cp ../wotnow/package.json ./package.json

# Edit package.json:
# - Change name to "findr"
# - Remove Grow/Go Daisy specific dependencies
# - Add @godaisy/core dependency
```

**`package.json` changes:**
```json
{
  "name": "findr",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@godaisy/core": "^1.0.0-beta.1",
    "next": "^15.5.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.39.0",
    // ... other Findr-specific dependencies
  }
}
```

### Step 2: Create `.npmrc` for App

**`E:\Go_Daisy\findr\.npmrc`:**
```
@godaisy:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Step 3: Install Dependencies

```bash
cd E:\Go_Daisy\findr
npm install
```

### Step 4: Copy App-Specific Code

**For Findr (200+ files total including scripts):**
```bash
cd E:\Go_Daisy\wotnow

# Copy Findr-specific pages
cp -r pages/findr ../findr/pages

# Copy Findr-specific components (72 files)
cp -r components/findr ../findr/components

# Copy Favourites components (9 files - if not shared, see decision above)
cp -r components/favourites ../findr/components

# Copy Findr-specific lib (34 files)
cp -r lib/findr ../findr/lib
cp -r lib/copernicus ../findr/lib

# Copy Findr-specific hooks (16+ hooks)
# Fishing predictions & conditions
cp hooks/use7DayFishingPredictions.ts ../findr/hooks/
cp hooks/useBiteScore.ts ../findr/hooks/
cp hooks/useFishingPredictions.ts ../findr/hooks/
cp hooks/useFindrConditions.ts ../findr/hooks/
cp hooks/useFindrEnvironmentalSignals.ts ../findr/hooks/
cp hooks/useFindrMarineWeather.ts ../findr/hooks/
cp hooks/useFindrOfflineInit.ts ../findr/hooks/

# Catch logging
cp hooks/useCatchLogger.ts ../findr/hooks/
cp hooks/useCatchStatistics.ts ../findr/hooks/
cp hooks/useOfflineCatchLogger.ts ../findr/hooks/
cp hooks/useMyCatchPhotos.ts ../findr/hooks/
cp hooks/useQuickLogSpecies.ts ../findr/hooks/

# Species & identification
cp hooks/useFishIdentification.ts ../findr/hooks/
cp hooks/useSpeciesBundle.ts ../findr/hooks/
cp hooks/useSpeciesDetails.ts ../findr/hooks/
cp hooks/useReferenceData.ts ../findr/hooks/

# Settings & badges
cp hooks/useMigrateFindrSettings.ts ../findr/hooks/
cp hooks/usePersistentFindrSettings.ts ../findr/hooks/
cp hooks/useBadgeProgress.ts ../findr/hooks/

# Favourites (if not shared - see decision above)
cp hooks/useFavourites.ts ../findr/hooks/
cp hooks/useFavouriteInsights.ts ../findr/hooks/
cp hooks/useEnhancedFavouriteInsights.ts ../findr/hooks/
cp hooks/useFavoritesTacticalAdvice.ts ../findr/hooks/
cp hooks/useFavoritesStrategicAdvice.ts ../findr/hooks/

# Copy Findr-specific API routes (32 endpoints)
cp -r pages/api/findr ../findr/pages/api

# Copy Findr-specific scripts (see Scripts Categorization below)
# Key scripts: ingestFindrConditions.ts, test-*-predictions.ts, etc.

# Copy config files
cp next.config.js ../findr/
cp tsconfig.json ../findr/
cp tailwind.config.ts ../findr/
cp postcss.config.mjs ../findr/
```

**For Grow Daisy (175+ files total - updated Jan 26):**
```bash
cd E:\Go_Daisy\wotnow

# Copy Grow-specific pages (10 pages)
cp -r pages/grow ../growdaisy/pages

# Copy Grow-specific components (70 files - includes new cards from Jan 26)
cp -r components/grow ../growdaisy/components

# Copy Gardening components (1 file)
cp -r components/gardening ../growdaisy/components

# Copy Grow-specific lib (42 files - includes new formatters.ts)
cp -r lib/grow ../growdaisy/lib

# Copy Gardening lib (3 files - alert system)
cp -r lib/gardening ../growdaisy/lib

# Copy Grow-specific hooks (2 hooks)
cp hooks/useGrow*.ts ../growdaisy/hooks/

# Copy Grow-specific API routes (57 endpoints)
cp -r pages/api/grow ../growdaisy/pages/api

# Copy Grow-specific scripts (4 new plant data scripts from Jan 26)
cp scripts/audit-toxicity.ts ../growdaisy/scripts/
cp scripts/check-perenual-tables.ts ../growdaisy/scripts/
cp scripts/merge-perenual-data.ts ../growdaisy/scripts/
cp scripts/normalize-plant-data.ts ../growdaisy/scripts/

# Copy config files
cp next.config.js ../growdaisy/
cp tsconfig.json ../growdaisy/
cp tailwind.config.ts ../growdaisy/
cp postcss.config.mjs ../growdaisy/
```

### Step 5: Update Imports to Use `@godaisy/core`

In each app, find and replace imports:

```bash
# Example for Findr
cd E:\Go_Daisy\findr

# Find all imports from @/context, @/hooks, @/components that are now in @godaisy/core
# Replace with imports from @godaisy/core

# OLD:
import { useAuth } from '@/context/AuthContext';
import { useUnifiedLocation } from '@/hooks/useUnifiedLocation';
import { LocationPicker } from '@/components/LocationPicker';

# NEW:
import { useAuth, useUnifiedLocation, LocationPicker } from '@godaisy/core';
```

You can use VSCode's find & replace with regex to do this efficiently.

---

## Phase 7: Test Locally

### Step 1: Test `godaisy-core` Build

```bash
cd E:\Go_Daisy\godaisy-core
npm run build
# Should output to dist/ folder without errors
```

### Step 2: Link Locally for Testing

```bash
cd E:\Go_Daisy\godaisy-core
npm link

cd E:\Go_Daisy\findr
npm link @godaisy/core
```

### Step 3: Test Findr App

```bash
cd E:\Go_Daisy\findr
npm run dev
# Should start without import errors
```

If you see errors about missing modules, you need to:
1. Either copy those modules to `godaisy-core`
2. Or keep them in the app (if they're app-specific)

---

## Phase 8: Commit and Push

### For `godaisy-core`:

```bash
cd E:\Go_Daisy\godaisy-core

git add .
git commit -m "Initial commit: Shared component library

- TypeScript library with tsup build pipeline
- Shared contexts (Auth, Location, Language, UserPreferences)
- Dual Supabase client pattern (auth + data)
- Shared hooks (28 hooks)
- Shared components (137 components)
- Published as @godaisy/core@1.0.0-beta.1

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin main
```

### For `findr`:

```bash
cd E:\Go_Daisy\findr

git add .
git commit -m "Initial commit: Findr fishing predictions app

- Migrated from monorepo
- Uses @godaisy/core for shared components
- Findr-specific code (34 lib files, 22 hooks, 72 components)
- Ready for Supabase migration

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin main
```

Repeat for `growdaisy` and `godaisy`.

---

## Summary Checklist

### Pre-Migration Cleanup (COMPLETED Jan 22, 2026):
- [x] Mock data removed from Findr components
- [x] Mock data removed from Go Daisy components
- [x] Grow Daisy features matured (guilds, hardware, subscriptions)
- [x] Real API endpoints wired up across all apps
- [x] Code separation verified (no cross-app imports)

### GitHub Repositories To Create:
- [x] `godaisy-core` (shared library) ✅ Created
- [ ] `findr` (fishing app)
- [ ] `growdaisy` (gardening app)
- [ ] `godaisy` (general app)

### `godaisy-core` Setup (COMPLETED Jan 22-26, 2026):
- [x] TypeScript + tsup build pipeline configured
- [x] Go Daisy Auth integration (`authClient.ts`)
- [x] Shared contexts copied (4 contexts)
- [x] Shared hooks copied (29 hooks)
- [x] Shared components copied (108 components)
- [x] Shared libraries copied (125 files: weather, capacitor, translation, utils, location, etc.)
- [x] Path aliases converted (`@/` → relative paths)
- [x] All dependencies installed (Capacitor, React Query, etc.)
- [x] **Build successful** (`npm run build`) - CJS 324KB, ESM 320KB, DTS 35KB
- [x] App-specific offline sync files removed (findrSync, growSync, etc.)
- [ ] **Add missing type definitions** (see TODO section above):
  - [ ] `capacitor-optional.d.ts`
  - [ ] `weather.ts`, `weatherData.ts`, `weatherTypes.ts`
  - [ ] `react-hot-toast.d.ts`
- [ ] **Decision: Favourites feature** - Add to godaisy-core if shared, or document for findr repo
- [ ] **Expand src/index.ts** - Export all hooks, components, and utilities
- [ ] Published to GitHub Packages

### App Setup (Findr):
- [ ] Next.js app initialized
- [ ] `@godaisy/core` dependency added
- [ ] Findr-specific code copied from wotnow:
  - [ ] `components/findr/` (72 files)
  - [ ] `components/favourites/` (9 files - if not shared)
  - [ ] `lib/findr/` (34 files)
  - [ ] `pages/api/findr/` (32 endpoints)
  - [ ] Findr-specific hooks (24 hooks - see detailed list in Phase 6)
- [ ] Findr-specific types copied:
  - [ ] `types/findr-enrichment.ts`
  - [ ] `types/findrSeasonality.ts`
  - [ ] `types/speciesBundle.ts`
- [ ] **CMEMS ingestion scripts copied (CRITICAL - use latest main):**
  - [ ] `scripts/ingest-copernicus-data.ts` (fixed Jan 28 - all BGC fields)
  - [ ] `scripts/ingestCopernicusBiogeochemical.ts` (fixed Jan 28 - preserves data)
- [ ] Move Findr-specific files from godaisy-core:
  - [ ] `findrDatabase.ts`, `findrSync.ts`, `catchHistory.ts`, etc.
  - [ ] `lib/copernicus/*` (marine data)
  - [ ] `lib/predictions/*`
- [ ] Imports updated to use `@godaisy/core`
- [ ] Local test successful (`npm run dev`)
- [ ] Pushed to GitHub

### App Setup (Grow Daisy):
- [ ] Next.js app initialized
- [ ] `@godaisy/core` dependency added
- [ ] Grow-specific code copied from wotnow:
  - [ ] `components/grow/` (70 files - includes 7 new from Jan 26 merge)
  - [ ] `components/gardening/` (1 file - GardenAlertBox.tsx)
  - [ ] `lib/grow/` (42 files - includes formatters.ts, updated weatherTaskEngine.ts)
  - [ ] `lib/gardening/` (3 files - gardenAlerts.ts, buildGardenAlertInputs.ts, getGardenAlerts.ts)
  - [ ] `pages/api/grow/` (57 endpoints)
  - [ ] `pages/grow/` (species page updated)
  - [ ] `hooks/useGrow*.ts` (2 hooks)
  - [ ] `scripts/` (4 new plant data scripts: audit-toxicity, check-perenual-tables, merge-perenual-data, normalize-plant-data)
- [ ] Move Grow-specific files from godaisy-core:
  - [ ] `growSync.ts`, `growSubscriptionCache.ts`
- [ ] Imports updated to use `@godaisy/core`
- [ ] Local test successful (`npm run dev`)
- [ ] Pushed to GitHub

### App Setup (Go Daisy):
- [ ] Next.js app initialized
- [ ] `@godaisy/core` dependency added
- [ ] Go Daisy-specific code copied from wotnow
- [ ] Imports updated to use `@godaisy/core`
- [ ] Local test successful (`npm run dev`)
- [ ] Pushed to GitHub

---

## Next Steps

### Immediate Next Steps:
1. **Verify godaisy-core build** - Run `npm run build` and fix any TypeScript errors
2. **Add missing type definitions** - Copy weather types, capacitor types, toast types from wotnow
3. **Decision: Favourites feature** - Determine if `components/favourites/` and related hooks should be in godaisy-core (shared) or findr repo (app-specific)
4. **Expand `src/index.ts`** - Add exports for all hooks, components, and utilities
5. **Move app-specific files** - Move Findr/Grow specific files out of godaisy-core
6. **Create remaining repos** - Set up `findr`, `growdaisy`, and `godaisy` repositories
7. **Publish to GitHub Packages** - Complete Phase 5 setup

### After App Repos Are Set Up:
1. Create `daisy-auth` Supabase project (or confirm Go Daisy Auth is ready)
2. Migrate auth data if needed
3. Create `findr-production` Supabase project
4. Configure JWT validation
5. Deploy to Vercel

**Current status: godaisy-core structure is ready, shared code has been copied. Ready to verify build and continue with app repos.**

---

## Pre-Migration Status Checklist

### Codebase Readiness (Updated Jan 26, 2026)

**Cleanup Work Completed:**
- [x] Mock/hardcoded data removed from Findr components
- [x] Mock/hardcoded data removed from Go Daisy components
- [x] Real API endpoints wired up for all features
- [x] Grow Daisy feature maturation (guilds, hardware, subscriptions)
- [x] Proper authentication flow for all protected endpoints

**Ready for Separation:**
- [x] Clean code separation by directory (`lib/findr/`, `lib/grow/`, `components/findr/`, `components/grow/`)
- [x] No cross-app imports (Findr doesn't import Grow, vice versa)
- [x] Distinct domain boundaries maintained
- [x] Shared infrastructure well-documented in CLAUDE.md

**Migration Prerequisites:**
- [x] Create `godaisy-core` GitHub repository
- [x] Set up `@godaisy/core` package structure
- [x] Copy shared code to godaisy-core (108 components, 28 hooks, 120 lib files, 4 contexts)
- [x] Integrate Go Daisy Auth (`authClient.ts` pointing to shared auth project)
- [ ] Create remaining GitHub repositories (findr, growdaisy, godaisy)
- [ ] Build and publish `@godaisy/core` to GitHub Packages
- [ ] Create `daisy-auth` Supabase project (or use existing Go Daisy Auth)
- [ ] Create app-specific Supabase projects

---

## Troubleshooting

### Error: "Cannot find module '@godaisy/core'"

**Solution:**
1. Check `.npmrc` is configured correctly
2. Authenticate with GitHub Packages: `npm login --registry=https://npm.pkg.github.com`
3. Install: `npm install @godaisy/core`

### Error: "Module not found" for Supabase types

**Solution:**
Add to `godaisy-core/src/types/index.ts`:
```typescript
export type { User, Session, AuthError } from '@supabase/supabase-js';
```

### Build Errors in `godaisy-core`

**Solution:**
- Ensure all imports are relative (no `@/` aliases in library)
- Check `tsconfig.json` paths are correct
- Verify all dependencies are in `package.json`

---

## Tips

### Use `npm link` for Local Development

While developing the shared library:
```bash
cd godaisy-core
npm link

cd ../findr
npm link @godaisy/core
```

This lets you test changes to `godaisy-core` immediately without publishing.

### Version Bumping

When you make changes to `godaisy-core`:
```bash
cd godaisy-core
npm version patch  # 1.0.0-beta.1 -> 1.0.0-beta.2
npm run build
npm publish
```

Then update in apps:
```bash
cd findr
npm install @godaisy/core@latest
```

### Automated Publishing with GitHub Actions

**`.github/workflows/publish.yml`:**
```yaml
name: Publish Package

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Now you can publish by creating a git tag:
```bash
git tag v1.0.0-beta.2
git push --tags
```

---

## Important Notes on Recent Cleanup

### Why Cleanup Matters for Migration

The cleanup work completed on January 21-22, 2026 is critical for successful migration:

1. **No Mock Data Dependencies**
   - All components now fetch real data from APIs
   - No hardcoded data that would break when APIs change
   - Easier to verify functionality post-migration

2. **Mature Feature Set**
   - Grow Daisy is now feature-complete for v1.0 (guilds, hardware, subscriptions)
   - Findr has stable prediction and catch logging features
   - Fewer breaking changes expected during migration

3. **Clean API Boundaries**
   - Each app has well-defined API endpoints
   - No shared state between apps (except auth)
   - Clear separation enables independent deployment

### Post-Cleanup Validation

Before starting migration, verify:
```bash
# Run all tests
npm test

# Check for cross-app imports (should return nothing)
grep -r "from '@/lib/findr" components/grow/ lib/grow/
grep -r "from '@/lib/grow" components/findr/ lib/findr/

# Verify builds pass
npm run build
```

---

**Ready to start? Let me know which step you'd like to begin with!**

---

## Appendix: Scripts Categorization for Migration

The `wotnow/scripts/` folder contains 300+ scripts. Here's how to categorize them for migration:

### Findr-Specific Scripts (copy to `findr/scripts/`)

Scripts related to fishing, marine data, species, rectangles, Copernicus, ICES data:

> **⚠️ IMPORTANT (Jan 28, 2026):** The CMEMS ingestion scripts were recently fixed on `main`:
> - `ingest-copernicus-data.ts` - Now populates all biogeochemical fields + O₂ conversion fix
> - `ingestCopernicusBiogeochemical.ts` - Fixed to use UPDATE instead of DELETE+INSERT
>
> **Always copy from latest `main` branch to get these fixes.**

```bash
# Data ingestion (CRITICAL - use latest versions)
ingestFindrConditions.ts
ingestFindrConditionsBatched.ts
ingestCopernicusBiogeochemical.ts      # Fixed Jan 28 - preserves existing data
ingest-copernicus-data.ts              # Fixed Jan 28 - all BGC fields + O₂ conversion
ingest-noaa-oisst-*.ts

# Species and predictions
*-species-*.ts
*-predictions*.ts
*fish*.ts
*-confidence*.ts
*rectangle*.ts
*-bio-bands*.ts

# Marine data
*copernicus*.ts
*cmems*.ts
*-tide*.ts
*-substrate*.ts
*salinity*.ts

# Testing
test-*-predictions.ts
test-*-species*.ts
test-findr-*.ts
```

### Grow Daisy-Specific Scripts (copy to `growdaisy/scripts/`)

Scripts related to plants, gardening, Perenual API:

```bash
# Plant data management (NEW - Jan 26, 2026)
audit-toxicity.ts
check-perenual-tables.ts
merge-perenual-data.ts
normalize-plant-data.ts

# Existing Grow scripts
sync-perenual-*.ts
generate-growdaisy-icons.ts
seedGrowPlantingCalendar.ts
check-guilds.ts
migrate-grow.sh
test-grow-*.ts
test-guild-*.ts
```

### Shared/Utility Scripts (keep in godaisy-core or copy to all)

General utilities that may be useful across apps:

```bash
# Build/deployment
vercel-*.sh
bump-version.sh
build-android.sh

# Environment
env-sync.ts

# General testing
test-weather-*.ts
test-email-templates.ts

# Data utilities
json-to-csv.ts
```

### Scripts to Review Case-by-Case

Some scripts may be shared or need splitting:

```bash
# Weather (shared across apps)
test-weather-*.ts
poll-pressure-*.ts
calculate-pressure-trends.ts

# Notifications (shared)
*notification*.ts
send-test-notification.ts

# Image handling (shared)
*image*.ts
regenerate-*-thumbnails.*
```

---

## Appendix: Environment Variables by App

### godaisy-core (Shared Auth)
```bash
# Go Daisy Auth - Required for all apps
NEXT_PUBLIC_SUPABASE_AUTH_URL=https://bcjeobdhajxbdzhmbjne.supabase.co
NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY=<your-auth-anon-key>
```

### Findr App
```bash
# Shared auth (from godaisy-core)
NEXT_PUBLIC_SUPABASE_AUTH_URL=<from-godaisy-core>
NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY=<from-godaisy-core>

# Findr-specific database
NEXT_PUBLIC_SUPABASE_URL=<findr-db-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<findr-db-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<findr-service-role-key>

# External APIs
COPERNICUS_USER=<your-copernicus-user>
COPERNICUS_PASSWORD=<your-copernicus-password>
STORMGLASS_API_KEY=<your-stormglass-key>
WORLD_TIDES_API_KEY=<your-worldtides-key>
```

### Grow Daisy App
```bash
# Shared auth (from godaisy-core)
NEXT_PUBLIC_SUPABASE_AUTH_URL=<from-godaisy-core>
NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY=<from-godaisy-core>

# Grow-specific database
NEXT_PUBLIC_SUPABASE_URL=<grow-db-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<grow-db-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<grow-service-role-key>

# External APIs
PERENUAL_API_KEY=<your-perenual-key>
STRIPE_SECRET_KEY=<grow-stripe-secret>
STRIPE_WEBHOOK_SECRET=<grow-webhook-secret>
```

### Go Daisy App
```bash
# Shared auth (from godaisy-core)
NEXT_PUBLIC_SUPABASE_AUTH_URL=<from-godaisy-core>
NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY=<from-godaisy-core>

# Go Daisy-specific database
NEXT_PUBLIC_SUPABASE_URL=<godaisy-db-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<godaisy-db-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<godaisy-service-role-key>
```
