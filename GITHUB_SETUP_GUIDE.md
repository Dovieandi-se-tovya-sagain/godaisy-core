# GitHub Setup Guide - App Separation

**Created:** January 7, 2026
**Updated:** January 22, 2026
**Purpose:** Set up GitHub repositories and shared library infrastructure before database migration

---

## Recent Progress (cleanup branch)

### Completed Pre-Migration Cleanup

The following cleanup work has been completed on the `cleanup` branch, preparing the codebase for separation:

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

### Updated File Counts (as of Jan 22, 2026)

```
GROW DAISY (significantly expanded):
- components/grow/: 63 files (was 43, +47% growth)
- lib/grow/: 40 files (was 20, +100% growth)
- pages/api/grow/: 57 endpoints (was 23, +148% growth)
- hooks/useGrow*.ts: 2 hooks (new)

FINDR (stable/consolidated):
- components/findr/: 72 files (was 58, +24% growth)
- lib/findr/: 34 files (was 45, consolidated)
- pages/api/findr/: 32 endpoints (was 30, +7% growth)
```

---

## Overview

We'll create 4 GitHub repositories:
1. **`godaisy-core`** - Shared component library (npm package)
2. **`findr`** - Fishing predictions app (standalone)
3. **`growdaisy`** - Gardening app (standalone)
4. **`godaisy`** - General activity app (standalone)

---

## Phase 1: Create GitHub Repositories

### Step 1: Create `godaisy-core` Repository

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

## Phase 2: Set Up `godaisy-core` (Shared Library)

### Step 1: Initialize TypeScript Library

```bash
cd E:\Go_Daisy\godaisy-core
npm init -y
```

### Step 2: Install Dependencies

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

### Step 3: Create `package.json` Configuration

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

### Step 4: Create `tsconfig.json`

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

### Step 5: Create `tsup.config.ts`

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

### Step 6: Create Directory Structure

```bash
cd E:\Go_Daisy\godaisy-core
mkdir -p src/contexts
mkdir -p src/hooks
mkdir -p src/components
mkdir -p src/lib/supabase
mkdir -p src/lib/weather
mkdir -p src/lib/capacitor
mkdir -p src/lib/translation
mkdir -p src/lib/utils
mkdir -p src/types
```

### Step 7: Create `src/index.ts` (Entry Point)

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

// Hooks
export { useOnlineStatus } from './hooks/useOnlineStatus';
export { useTideData } from './hooks/useTideData';
export { useTranslation } from './hooks/useTranslation';
// ... export all shared hooks

// Components
export { LocationPicker } from './components/LocationPicker';
export { LanguageSelector } from './components/LanguageSelector';
export { TranslatedText } from './components/TranslatedText';
// ... export all shared components

// Utilities
export { formatCoordinates } from './lib/utils/coordinates';
export { formatDate } from './lib/utils/dates';
// ... export all utility functions

// Types
export type * from './types';
```

---

## Phase 3: Copy Shared Code from Monorepo

### Step 1: Copy Contexts

```bash
cd E:\Go_Daisy\wotnow

# Copy contexts (we'll modify these for dual Supabase clients)
cp context/AuthContext.tsx ../godaisy-core/src/contexts/
cp context/UnifiedLocationContext.tsx ../godaisy-core/src/contexts/
cp context/LanguageContext.tsx ../godaisy-core/src/contexts/
cp context/UserPreferencesContext.tsx ../godaisy-core/src/contexts/
```

### Step 2: Copy Shared Libraries

```bash
# Supabase clients (we'll create new dual-client versions)
cp -r lib/supabase ../godaisy-core/src/lib/

# Weather services
cp -r lib/weather ../godaisy-core/src/lib/
cp lib/services/weatherService.ts ../godaisy-core/src/lib/weather/

# Capacitor integration
cp -r lib/capacitor ../godaisy-core/src/lib/

# Translation
cp -r lib/translation ../godaisy-core/src/lib/

# Utilities
cp -r lib/utils ../godaisy-core/src/lib/
cp -r lib/tides ../godaisy-core/src/lib/
cp -r lib/astro ../godaisy-core/src/lib/
```

### Step 3: Copy Shared Hooks

```bash
# Copy all shared hooks (not Findr/Grow specific)
cp hooks/useOnlineStatus.ts ../godaisy-core/src/hooks/
cp hooks/useTideData.ts ../godaisy-core/src/hooks/
cp hooks/useTranslation.ts ../godaisy-core/src/hooks/
cp hooks/useUserLocation.ts ../godaisy-core/src/hooks/
cp hooks/useOfflineData.ts ../godaisy-core/src/hooks/
cp hooks/useSharing.ts ../godaisy-core/src/hooks/
cp hooks/useInstallPrompt.ts ../godaisy-core/src/hooks/
cp hooks/useCapacitorInit.ts ../godaisy-core/src/hooks/
# ... copy all 28 shared hooks
```

### Step 4: Copy Shared Components

```bash
# This is a lot of files - let's use a script
cd E:\Go_Daisy\wotnow

# Create a temporary script to copy shared components
# Exclude findr/ and grow/ subdirectories
```

**Create `scripts/copy-shared-components.sh`:**
```bash
#!/bin/bash

SOURCE_DIR="E:/Go_Daisy/wotnow/components"
DEST_DIR="E:/Go_Daisy/godaisy-core/src/components"

# Copy all .tsx files except those in findr/ or grow/ subdirectories
find "$SOURCE_DIR" -maxdepth 1 -name "*.tsx" -exec cp {} "$DEST_DIR/" \;

echo "Copied shared components to godaisy-core"
```

Run it:
```bash
bash scripts/copy-shared-components.sh
```

---

## Phase 4: Modify for Dual Supabase Clients

### Step 1: Create Auth Client

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

**For Findr (138 files total):**
```bash
cd E:\Go_Daisy\wotnow

# Copy Findr-specific pages
cp -r pages/findr ../findr/pages

# Copy Findr-specific components (72 files)
cp -r components/findr ../findr/components

# Copy Findr-specific lib (34 files)
cp -r lib/findr ../findr/lib
cp -r lib/copernicus ../findr/lib

# Copy Findr-specific hooks (22 hooks)
cp hooks/useFindr*.ts ../findr/hooks/
cp hooks/useFish*.ts ../findr/hooks/
cp hooks/useCatch*.ts ../findr/hooks/
cp hooks/useFavour*.ts ../findr/hooks/

# Copy Findr-specific API routes (32 endpoints)
cp -r pages/api/findr ../findr/pages/api

# Copy config files
cp next.config.js ../findr/
cp tsconfig.json ../findr/
cp tailwind.config.ts ../findr/
cp postcss.config.mjs ../findr/
```

**For Grow Daisy (162 files total):**
```bash
cd E:\Go_Daisy\wotnow

# Copy Grow-specific pages (10 pages)
cp -r pages/grow ../growdaisy/pages

# Copy Grow-specific components (63 files)
cp -r components/grow ../growdaisy/components

# Copy Grow-specific lib (40 files)
cp -r lib/grow ../growdaisy/lib

# Copy Grow-specific hooks (2 hooks)
cp hooks/useGrow*.ts ../growdaisy/hooks/

# Copy Grow-specific API routes (57 endpoints)
cp -r pages/api/grow ../growdaisy/pages/api

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
- [ ] `godaisy-core` (shared library)
- [ ] `findr` (fishing app)
- [ ] `growdaisy` (gardening app)
- [ ] `godaisy` (general app)

### `godaisy-core` Setup:
- [ ] TypeScript + tsup build pipeline configured
- [ ] Shared contexts copied and updated for dual clients
- [ ] Shared hooks copied (28 hooks)
- [ ] Shared components copied (137 components)
- [ ] Shared libraries copied (weather, capacitor, translation, utils)
- [ ] Build successful (`npm run build`)
- [ ] Published to GitHub Packages

### App Setup (Findr - 138 files total):
- [ ] Next.js app initialized
- [ ] `@godaisy/core` dependency added
- [ ] Findr-specific code copied (72 components, 34 lib files, 32 API endpoints)
- [ ] Imports updated to use `@godaisy/core`
- [ ] Local test successful (`npm run dev`)
- [ ] Pushed to GitHub

### App Setup (Grow Daisy - 162 files total):
- [ ] Next.js app initialized
- [ ] `@godaisy/core` dependency added
- [ ] Grow-specific code copied (63 components, 40 lib files, 57 API endpoints, 2 hooks)
- [ ] Imports updated to use `@godaisy/core`
- [ ] Local test successful (`npm run dev`)
- [ ] Pushed to GitHub

### App Setup (Go Daisy):
- [ ] Next.js app initialized
- [ ] `@godaisy/core` dependency added
- [ ] Go Daisy-specific code copied
- [ ] Imports updated to use `@godaisy/core`
- [ ] Local test successful (`npm run dev`)
- [ ] Pushed to GitHub

---

## Next Steps

Once GitHub setup is complete:
1. Create `daisy-auth` Supabase project (Phase 2A)
2. Migrate auth data
3. Create `findr-production` Supabase project (Phase 3)
4. Configure JWT validation
5. Deploy to Vercel

**You're now ready for the Supabase migration phase!**

---

## Pre-Migration Status Checklist

### Codebase Readiness (Updated Jan 22, 2026)

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
- [ ] Create GitHub repositories (this guide)
- [ ] Set up `@godaisy/core` package
- [ ] Create `daisy-auth` Supabase project
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
